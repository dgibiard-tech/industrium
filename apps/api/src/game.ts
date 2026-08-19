import { BadRequestException, Body, Controller, Get, Headers, Injectable, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { IsIn, IsInt, IsPositive, IsString, Min, MinLength } from 'class-validator';
import { AuthRequest, JwtGuard } from './auth';
import { PrismaService } from './prisma.service';

class CompanyDto { @IsString() @MinLength(2) name!:string; @IsString() sector!:string; @IsString() headquarters!:string; @IsString() legalForm!:string; @IsInt() @Min(100000) capitalCents!:number }
class ListingDto { @IsString() warehouseStockId!:string; @IsInt() @IsPositive() quantity!:number; @IsInt() @IsPositive() unitPriceCents!:number }
class BuyDto { @IsString() buyerCompanyId!:string; @IsInt() @IsPositive() quantity!:number }
class JobDto { @IsString() @MinLength(2) title!:string; @IsString() city!:string; @IsInt() @IsPositive() salaryCents!:number }
class CompanyActionDto { @IsString() companyId!:string }
class BuyVehicleDto extends CompanyActionDto { @IsString() @IsIn(['atlas-tx480','voltis-e18','nova-v6']) modelId!:string }
class AssignShipmentDto extends CompanyActionDto { @IsString() vehicleId!:string }

const vehicleCatalog={
  'atlas-tx480':{model:'Atlas TX 480',type:'Semi-remorque diesel',capacityKg:24000,price:12_500_000n,prefix:'AT'},
  'voltis-e18':{model:'Voltis E18',type:'Porteur électrique',capacityKg:12000,price:9_800_000n,prefix:'VE'},
  'nova-v6':{model:'Nova V6 Urban',type:'Utilitaire électrique',capacityKg:3500,price:5_900_000n,prefix:'NV'},
} as const;

const companyView={account:true,warehouses:{include:{stocks:{include:{product:true}}}},members:true} as const;

@Injectable()
export class GameService {
  constructor(private readonly db:PrismaService){}
  products(){return this.db.product.findMany({orderBy:{name:'asc'}})}
  listings(){return this.db.marketListing.findMany({where:{status:'ACTIVE',quantity:{gt:0}},include:{product:true,seller:{select:{name:true}},warehouseStock:{include:{warehouse:true}}},orderBy:{unitPriceCents:'asc'}})}
  companies(userId:string){return this.db.company.findMany({where:{members:{some:{userId}}},include:companyView,orderBy:{createdAt:'asc'}})}
  async createCompany(userId:string,dto:CompanyDto){
    return this.db.$transaction(async tx=>{
      const company=await tx.company.create({data:{name:dto.name.trim(),sector:dto.sector,headquarters:dto.headquarters,legalForm:dto.legalForm,members:{create:{userId,role:'OWNER'}},account:{create:{balanceCents:BigInt(dto.capitalCents)}},warehouses:{create:{name:'Entrepôt principal',city:dto.headquarters,capacityM3:new Prisma.Decimal(10000)}}},include:companyView});
      await tx.ledgerTransaction.create({data:{accountId:company.account!.id,type:'CAPITAL',amountCents:BigInt(dto.capitalCents),description:'Capital initial'}});
      return company;
    });
  }
  async createListing(userId:string,dto:ListingDto){
    const stock=await this.db.warehouseStock.findFirst({where:{id:dto.warehouseStockId,warehouse:{company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}}}});
    if(!stock) throw new NotFoundException('Stock inaccessible');
    const available=stock.quantity.minus(stock.reservedQuantity);
    if(available.lt(dto.quantity)) throw new BadRequestException('Stock disponible insuffisant');
    return this.db.$transaction(async tx=>{
      const changed=await tx.warehouseStock.updateMany({where:{id:stock.id,version:stock.version,reservedQuantity:{lte:stock.quantity.minus(dto.quantity)}},data:{reservedQuantity:{increment:dto.quantity},version:{increment:1}}});
      if(changed.count!==1) throw new BadRequestException('Le stock vient de changer, réessayez');
      const listing=await tx.marketListing.create({data:{sellerId:(await tx.warehouse.findUniqueOrThrow({where:{id:stock.warehouseId}})).companyId,productId:stock.productId,warehouseStockId:stock.id,quantity:dto.quantity,unitPriceCents:BigInt(dto.unitPriceCents)}});
      await tx.stockMovement.create({data:{type:'RESERVATION',quantity:dto.quantity,warehouseId:stock.warehouseId,stockId:stock.id,referenceId:listing.id}});
      return listing;
    });
  }
  async buy(userId:string,listingId:string,dto:BuyDto,key:string|undefined){
    if(!key) throw new BadRequestException('En-tête Idempotency-Key requis');
    return this.db.$transaction(async tx=>{
      const existing=await tx.order.findUnique({where:{idempotencyKey:key}}); if(existing) return existing;
      const listing=await tx.marketListing.findUnique({where:{id:listingId},include:{warehouseStock:true}});
      if(!listing || listing.status!=='ACTIVE' || listing.quantity.lt(dto.quantity)) throw new BadRequestException('Offre indisponible');
      const buyer=await tx.company.findFirst({where:{id:dto.buyerCompanyId,members:{some:{userId,role:{in:['OWNER','MANAGER']}}}},include:{account:true,warehouses:true}});
      if(!buyer?.account || buyer.id===listing.sellerId) throw new BadRequestException('Acheteur invalide');
      const seller=await tx.company.findUnique({where:{id:listing.sellerId},include:{account:true}}); if(!seller?.account) throw new BadRequestException();
      const total=BigInt(dto.quantity)*listing.unitPriceCents;
      const debited=await tx.bankAccount.updateMany({where:{id:buyer.account.id,balanceCents:{gte:total}},data:{balanceCents:{decrement:total},version:{increment:1}}});
      if(debited.count!==1) throw new BadRequestException('Trésorerie insuffisante');
      const claimed=await tx.marketListing.updateMany({where:{id:listing.id,version:listing.version,quantity:{gte:dto.quantity}},data:{quantity:{decrement:dto.quantity},version:{increment:1}}});
      if(claimed.count!==1) throw new BadRequestException('Offre achetée simultanément');
      await tx.bankAccount.update({where:{id:seller.account.id},data:{balanceCents:{increment:total},version:{increment:1}}});
      const target=buyer.warehouses[0] ?? await tx.warehouse.create({data:{companyId:buyer.id,name:'Entrepôt principal',city:buyer.headquarters,capacityM3:10000}});
      const targetStock=await tx.warehouseStock.upsert({where:{warehouseId_productId:{warehouseId:target.id,productId:listing.productId}},create:{warehouseId:target.id,productId:listing.productId,quantity:dto.quantity},update:{quantity:{increment:dto.quantity},version:{increment:1}}});
      await tx.warehouseStock.update({where:{id:listing.warehouseStockId},data:{quantity:{decrement:dto.quantity},reservedQuantity:{decrement:dto.quantity},version:{increment:1}}});
      const order=await tx.order.create({data:{buyerId:buyer.id,sellerId:seller.id,listingId:listing.id,quantity:dto.quantity,totalCents:total,idempotencyKey:key,items:{create:{productId:listing.productId,quantity:dto.quantity,unitPriceCents:listing.unitPriceCents}}}});
      await Promise.all([
        tx.ledgerTransaction.create({data:{accountId:buyer.account.id,type:'PURCHASE',amountCents:-total,description:'Achat marketplace',referenceId:order.id,idempotencyKey:`${key}:debit`}}),
        tx.ledgerTransaction.create({data:{accountId:seller.account.id,type:'SALE',amountCents:total,description:'Vente marketplace',referenceId:order.id,idempotencyKey:`${key}:credit`}}),
        tx.stockMovement.create({data:{type:'OUT',quantity:dto.quantity,warehouseId:listing.warehouseStock.warehouseId,stockId:listing.warehouseStockId,referenceId:order.id}}),
        tx.stockMovement.create({data:{type:'IN',quantity:dto.quantity,warehouseId:target.id,stockId:targetStock.id,referenceId:order.id}}),
        tx.outboxEvent.create({data:{topic:'market.order.completed',payload:{orderId:order.id}}})
      ]);
      if(listing.quantity.equals(dto.quantity)) await tx.marketListing.update({where:{id:listing.id},data:{status:'SOLD_OUT'}});
      return order;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  orders(userId:string){return this.db.order.findMany({where:{OR:[{buyer:{members:{some:{userId}}}},{seller:{members:{some:{userId}}}}]},include:{buyer:{select:{name:true}},seller:{select:{name:true}},items:{include:{product:true}}},orderBy:{createdAt:'desc'}})}
  jobs(){return this.db.jobOffer.findMany({where:{status:'OPEN'},include:{company:{select:{name:true}}},orderBy:{createdAt:'desc'}})}
  async createJob(userId:string,companyId:string,dto:JobDto){const allowed=await this.db.companyMember.findFirst({where:{companyId,userId,role:{in:['OWNER','MANAGER']}}});if(!allowed) throw new NotFoundException();return this.db.jobOffer.create({data:{...dto,salaryCents:BigInt(dto.salaryCents),companyId}})}
  async apply(userId:string,jobId:string){const job=await this.db.jobOffer.findUnique({where:{id:jobId}});if(!job||job.status!=='OPEN')throw new NotFoundException();return this.db.employeeContract.upsert({where:{userId_jobOfferId:{userId,jobOfferId:jobId}},create:{userId,jobOfferId:jobId,salaryCents:job.salaryCents},update:{}})}
  async vehicles(userId:string){return this.db.vehicle.findMany({where:{company:{members:{some:{userId}}}},orderBy:{createdAt:'asc'}})}
  shipments(userId:string){return this.db.shipment.findMany({where:{OR:[{status:'OPEN'},{carrier:{members:{some:{userId}}}}]},include:{carrier:{select:{name:true}},vehicle:true},orderBy:[{status:'asc'},{rewardCents:'desc'}]})}
  async buyTruck(userId:string,dto:BuyVehicleDto){
    const selected=vehicleCatalog[dto.modelId as keyof typeof vehicleCatalog];
    const price=selected.price;
    return this.db.$transaction(async tx=>{
      const company=await tx.company.findFirst({where:{id:dto.companyId,members:{some:{userId,role:{in:['OWNER','MANAGER']}}}},include:{account:true}});
      if(!company?.account) throw new NotFoundException('Entreprise inaccessible');
      const debit=await tx.bankAccount.updateMany({where:{id:company.account.id,balanceCents:{gte:price}},data:{balanceCents:{decrement:price},version:{increment:1}}});
      if(debit.count!==1) throw new BadRequestException('Trésorerie insuffisante pour ce véhicule');
      const vehicle=await tx.vehicle.create({data:{companyId:company.id,registration:`${selected.prefix}-${Date.now().toString().slice(-6)}`,model:selected.model,type:selected.type,capacityKg:selected.capacityKg,purchasePriceCents:price}});
      await tx.ledgerTransaction.create({data:{accountId:company.account.id,type:'PURCHASE',amountCents:-price,description:`Achat véhicule ${selected.model}`,referenceId:vehicle.id}});
      return vehicle;
    });
  }
  async assignShipment(userId:string,shipmentId:string,dto:AssignShipmentDto){
    return this.db.$transaction(async tx=>{
      const vehicle=await tx.vehicle.findFirst({where:{id:dto.vehicleId,companyId:dto.companyId,status:'AVAILABLE',company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}}});
      const shipment=await tx.shipment.findUnique({where:{id:shipmentId}});
      if(!vehicle||!shipment||shipment.status!=='OPEN') throw new BadRequestException('Mission ou véhicule indisponible');
      if(vehicle.capacityKg.lt(shipment.weightKg)) throw new BadRequestException('Capacité du véhicule insuffisante');
      const claimed=await tx.shipment.updateMany({where:{id:shipment.id,status:'OPEN'},data:{carrierId:dto.companyId,vehicleId:vehicle.id,status:'ASSIGNED',acceptedAt:new Date()}});
      if(claimed.count!==1) throw new BadRequestException('Mission déjà attribuée');
      await tx.vehicle.update({where:{id:vehicle.id},data:{status:'ASSIGNED'}});
      return tx.shipment.findUniqueOrThrow({where:{id:shipment.id},include:{vehicle:true}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  async advanceShipment(userId:string,shipmentId:string,dto:CompanyActionDto){
    return this.db.$transaction(async tx=>{
      const shipment=await tx.shipment.findFirst({where:{id:shipmentId,carrierId:dto.companyId,carrier:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}},include:{vehicle:true,carrier:{include:{account:true}}}});
      if(!shipment?.vehicle||!shipment.carrier?.account||shipment.status==='DELIVERED'||shipment.status==='OPEN') throw new BadRequestException('Mission impossible à avancer');
      const progress=Math.min(100,shipment.progressPercent+25);
      if(progress<100) return tx.shipment.update({where:{id:shipment.id},data:{progressPercent:progress,status:'IN_TRANSIT'}});
      await tx.vehicle.update({where:{id:shipment.vehicle.id},data:{status:'AVAILABLE',mileageKm:{increment:shipment.distanceKm},condition:{decrement:2}}});
      await tx.bankAccount.update({where:{id:shipment.carrier.account.id},data:{balanceCents:{increment:shipment.rewardCents},version:{increment:1}}});
      await tx.ledgerTransaction.create({data:{accountId:shipment.carrier.account.id,type:'SALE',amountCents:shipment.rewardCents,description:`Livraison ${shipment.reference}`,referenceId:shipment.id}});
      return tx.shipment.update({where:{id:shipment.id},data:{progressPercent:100,status:'DELIVERED',deliveredAt:new Date()}});
    });
  }
}

@Controller()
@UseGuards(JwtGuard)
export class GameController {
  constructor(private readonly game:GameService){}
  @Get('products') products(){return this.game.products()} @Get('market/listings') listings(){return this.game.listings()}
  @Get('companies') companies(@Req() r:AuthRequest){return this.game.companies(r.user.sub)} @Post('companies') createCompany(@Req() r:AuthRequest,@Body() d:CompanyDto){return this.game.createCompany(r.user.sub,d)}
  @Post('market/listings') createListing(@Req() r:AuthRequest,@Body() d:ListingDto){return this.game.createListing(r.user.sub,d)}
  @Post('market/listings/:id/buy') buy(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:BuyDto,@Headers('idempotency-key') key?:string){return this.game.buy(r.user.sub,id,d,key)}
  @Get('orders') orders(@Req() r:AuthRequest){return this.game.orders(r.user.sub)} @Get('job-offers') jobs(){return this.game.jobs()}
  @Post('companies/:id/job-offers') createJob(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:JobDto){return this.game.createJob(r.user.sub,id,d)}
  @Post('job-offers/:id/apply') apply(@Req() r:AuthRequest,@Param('id') id:string){return this.game.apply(r.user.sub,id)}
  @Get('vehicles') vehicles(@Req() r:AuthRequest){return this.game.vehicles(r.user.sub)}
  @Post('vehicles/buy-truck') buyTruck(@Req() r:AuthRequest,@Body() d:BuyVehicleDto){return this.game.buyTruck(r.user.sub,d)}
  @Get('shipments') shipments(@Req() r:AuthRequest){return this.game.shipments(r.user.sub)}
  @Post('shipments/:id/assign') assignShipment(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:AssignShipmentDto){return this.game.assignShipment(r.user.sub,id,d)}
  @Post('shipments/:id/advance') advanceShipment(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:CompanyActionDto){return this.game.advanceShipment(r.user.sub,id,d)}
}

export function assertPurchase(quantity:number, available:number, balanceCents:bigint, unitPriceCents:bigint){if(quantity<=0||quantity>available)throw new Error('Stock insuffisant');const total=BigInt(quantity)*unitPriceCents;if(total>balanceCents)throw new Error('Trésorerie insuffisante');return total}
