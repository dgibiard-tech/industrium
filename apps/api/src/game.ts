import { BadRequestException, Body, Controller, Get, Headers, Injectable, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { IsInt, IsPositive, IsString, Min, MinLength } from 'class-validator';
import { AuthRequest, JwtGuard } from './auth';
import { PrismaService } from './prisma.service';

class CompanyDto { @IsString() @MinLength(2) name!:string; @IsString() sector!:string; @IsString() headquarters!:string; @IsString() legalForm!:string; @IsInt() @Min(100000) capitalCents!:number }
class ListingDto { @IsString() warehouseStockId!:string; @IsInt() @IsPositive() quantity!:number; @IsInt() @IsPositive() unitPriceCents!:number }
class BuyDto { @IsString() buyerCompanyId!:string; @IsInt() @IsPositive() quantity!:number }
class JobDto { @IsString() @MinLength(2) title!:string; @IsString() city!:string; @IsInt() @IsPositive() salaryCents!:number }

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
}

export function assertPurchase(quantity:number, available:number, balanceCents:bigint, unitPriceCents:bigint){if(quantity<=0||quantity>available)throw new Error('Stock insuffisant');const total=BigInt(quantity)*unitPriceCents;if(total>balanceCents)throw new Error('Trésorerie insuffisante');return total}
