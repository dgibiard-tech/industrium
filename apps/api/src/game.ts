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
class BulkVehicleDto extends BuyVehicleDto { @IsInt() @Min(2) quantity!:number }
class GarageSaleDto extends CompanyActionDto { @IsString() @IsIn(['NORD','EURO','ECO']) garageId!:'NORD'|'EURO'|'ECO' }
class AssignShipmentDto extends CompanyActionDto { @IsString() vehicleId!:string }
class ListVehicleDto extends CompanyActionDto { @IsInt() @IsPositive() askingPriceCents!:number }
class EquipmentDto extends CompanyActionDto { @IsString() @IsIn(['ASSEMBLY_LINE','ELECTRONICS_LINE','WOODWORK_LINE','ROBOTICS','SOLAR_ARRAY']) kind!:string }
class ProductionDto extends CompanyActionDto { @IsString() @IsIn(['VEHICLE','COMPUTER','FURNITURE']) productType!:'VEHICLE'|'COMPUTER'|'FURNITURE'; @IsInt() @Min(1) quantity!:number }
class ProposalDto { @IsString() buyerCompanyId!:string; @IsInt() @IsPositive() quantity!:number; @IsInt() @IsPositive() proposedUnitPriceCents!:number }
class AutoDispatchDto extends CompanyActionDto { @IsInt() @Min(1) maxTransports!:number }

const vehicleCatalog={
  'atlas-tx480':{model:'Atlas TX 480',type:'Semi-remorque diesel',capacityKg:24000,price:12_500_000n,prefix:'AT'},
  'voltis-e18':{model:'Voltis E18',type:'Porteur électrique',capacityKg:12000,price:9_800_000n,prefix:'VE'},
  'nova-v6':{model:'Nova V6 Urban',type:'Utilitaire électrique',capacityKg:3500,price:5_900_000n,prefix:'NV'},
} as const;

const companyView={account:true,warehouses:{include:{stocks:{include:{product:true}}}},members:true} as const;
const ACCELERATION_GEM_COST=10;
const DAILY_TRANSPORT_TARGET=30;
const logisticsRoutes=[['Paris','Lyon',465],['Lyon','Berlin',1050],['Marseille','Barcelone',505],['Lille','Amsterdam',290],['Bordeaux','Madrid',690],['Strasbourg','Munich',360],['Nantes','Bruxelles',590],['Grenoble','Turin',325],['Duisbourg','Lyon',780],['Gdańsk','Paris',1540],['Milan','Zurich',280],['Prague','Vienne',335]] as const;
const longDistanceRoutes=[['Lisbonne','Varsovie',3120],['Oslo','Madrid',3030],['Helsinki','Rome',2990],['Dublin','Athènes',3540],['Stockholm','Lisbonne',3660],['Tallinn','Barcelone',3140],['Bucarest','Rotterdam',2240],['Naples','Copenhague',2380],['Sofia','Paris',2180],['Riga','Marseille',2590],['Istanbul','Berlin',2200],['Casablanca','Amsterdam',2730]] as const;
const logisticsCargo=[['Composants électroniques',3200],['Batteries industrielles',10500],['Mobilier professionnel',6800],['Pièces automobiles',14200],['Équipements médicaux',2400],['Acier usiné',22000],['Ordinateurs professionnels',1800],['Machines-outils',11800]] as const;
const cityCountries:Record<string,{country:string;code:string}>={Paris:{country:'France',code:'FR'},Lyon:{country:'France',code:'FR'},Marseille:{country:'France',code:'FR'},Lille:{country:'France',code:'FR'},Bordeaux:{country:'France',code:'FR'},Strasbourg:{country:'France',code:'FR'},Nantes:{country:'France',code:'FR'},Grenoble:{country:'France',code:'FR'},Berlin:{country:'Allemagne',code:'DE'},Duisbourg:{country:'Allemagne',code:'DE'},Munich:{country:'Allemagne',code:'DE'},Gdańsk:{country:'Pologne',code:'PL'},Turin:{country:'Italie',code:'IT'},Milan:{country:'Italie',code:'IT'},Barcelone:{country:'Espagne',code:'ES'},Madrid:{country:'Espagne',code:'ES'},Amsterdam:{country:'Pays-Bas',code:'NL'},Bruxelles:{country:'Belgique',code:'BE'},Zurich:{country:'Suisse',code:'CH'},Prague:{country:'Tchéquie',code:'CZ'},Vienne:{country:'Autriche',code:'AT'}};
const originForCity=(city:string)=>cityCountries[city]??{country:'Europe',code:'EU'};
const shipmentDurationMs=(distanceKm:number)=>Math.min(30,Math.max(2,Math.ceil(distanceKm/100)))*60_000;
const vehicleValue=(purchasePriceCents:bigint,condition:number,mileageKm:number)=>purchasePriceCents*BigInt(Math.max(3000,condition*100-Math.min(5000,Math.floor(mileageKm/50))))/10_000n;
const equipmentCatalog={ASSEMBLY_LINE:{name:'Ligne d’assemblage automobile',price:50_000_000n},ELECTRONICS_LINE:{name:'Ligne électronique automatisée',price:25_000_000n},WOODWORK_LINE:{name:'Atelier mobilier CNC',price:12_000_000n},ROBOTICS:{name:'Cellules robotisées',price:40_000_000n},SOLAR_ARRAY:{name:'Centrale solaire photovoltaïque',price:18_500_000n}} as const;
const productionCatalog={VEHICLE:{name:'Véhicule Industrium',sku:'FACTORY_VEHICLE',equipment:'ASSEMBLY_LINE',unitCost:1_800_000n,seconds:45,staff:3,weight:1600,volume:12},COMPUTER:{name:'Ordinateur professionnel',sku:'FACTORY_COMPUTER',equipment:'ELECTRONICS_LINE',unitCost:45_000n,seconds:15,staff:2,weight:3,volume:.02},FURNITURE:{name:'Mobilier de bureau',sku:'FACTORY_FURNITURE',equipment:'WOODWORK_LINE',unitCost:22_000n,seconds:20,staff:1,weight:45,volume:.4}} as const;

@Injectable()
export class GameService {
  constructor(private readonly db:PrismaService){}
  private dayStart(){const date=new Date();date.setHours(0,0,0,0);return date}
  private async ensureDailyTransportNetwork(){
    const day=this.dayStart();const existing=await this.db.shipment.count({where:{createdAt:{gte:day}}});
    for(let index=existing;index<DAILY_TRANSPORT_TARGET;index++){
      const route=logisticsRoutes[index%logisticsRoutes.length],cargo=logisticsCargo[(index*3)%logisticsCargo.length];
      const dateKey=day.toISOString().slice(0,10).replaceAll('-',''),reference=`NET-${dateKey}-${String(index+1).padStart(2,'0')}`;
      const weight=Math.min(cargo[1]+(index%4)*350,24000);
      await this.db.shipment.upsert({where:{reference},update:{},create:{reference,cargoName:cargo[0],weightKg:weight,originCity:route[0],destinationCity:route[1],distanceKm:route[2],rewardCents:BigInt(Math.round(route[2]*165+weight*4.5))}});
    }
    for(let index=0;index<longDistanceRoutes.length;index++){
      const route=longDistanceRoutes[index],cargo=logisticsCargo[(index*5+1)%logisticsCargo.length];
      const dateKey=day.toISOString().slice(0,10).replaceAll('-',''),reference=`LONG-${dateKey}-${String(index+1).padStart(2,'0')}`;
      const weight=Math.min(cargo[1]+(index%5)*500,24000);
      await this.db.shipment.upsert({where:{reference},update:{},create:{reference,cargoName:cargo[0],weightKg:weight,originCity:route[0],destinationCity:route[1],distanceKm:route[2],rewardCents:BigInt(Math.round(route[2]*205+weight*5.5))}});
    }
  }
  products(){return this.db.product.findMany({orderBy:{name:'asc'}})}
  async listings(){const listings=await this.db.marketListing.findMany({where:{status:'ACTIVE',quantity:{gt:0}},include:{product:true,seller:{select:{id:true,name:true,headquarters:true}},warehouseStock:{include:{warehouse:true}}},orderBy:{unitPriceCents:'asc'}});return listings.map(listing=>({...listing,origin:{city:listing.warehouseStock.warehouse.city,...originForCity(listing.warehouseStock.warehouse.city)}}))}
  async marketEconomy(){
    const now=Date.now(),since48h=new Date(now-48*60*60*1000),since24h=new Date(now-24*60*60*1000);
    const [products,production]=await Promise.all([
      this.db.product.findMany({include:{stocks:true,listings:{where:{status:'ACTIVE',quantity:{gt:0}},include:{proposals:{where:{status:'PENDING'}}}},orderItems:{where:{order:{createdAt:{gte:since48h}}},include:{order:true}}},orderBy:{name:'asc'}}),
      this.db.productionOrder.findMany({where:{OR:[{status:'RUNNING'},{completedAt:{gte:since48h}}]}}),
    ]);
    return products.map(product=>{
      const factoryOutput=production.filter(item=>item.productName===product.name);
      const production24=factoryOutput.filter(item=>item.status==='RUNNING'||(item.completedAt&&item.completedAt>=since24h)).reduce((sum,item)=>sum+item.quantity,0);
      const productionPrevious=factoryOutput.filter(item=>item.completedAt&&item.completedAt<since24h).reduce((sum,item)=>sum+item.quantity,0);
      const stock=product.stocks.reduce((sum,item)=>sum+Number(item.quantity)-Number(item.reservedQuantity),0);
      const listed=product.listings.reduce((sum,item)=>sum+Number(item.quantity),0);
      const proposals=product.listings.flatMap(item=>item.proposals).reduce((sum,item)=>sum+Number(item.quantity),0);
      const sold24=product.orderItems.filter(item=>item.order.createdAt>=since24h).reduce((sum,item)=>sum+Number(item.quantity),0);
      const soldPrevious=product.orderItems.filter(item=>item.order.createdAt<since24h).reduce((sum,item)=>sum+Number(item.quantity),0);
      const demand=Math.round((sold24*2+proposals*.8+12)*10)/10;
      const supply=Math.round((listed+stock*.2+production24*1.3)*10)/10;
      const previousDemand=soldPrevious*2+12,previousSupply=Math.max(1,listed+stock*.2+productionPrevious*1.3);
      const pressure=Math.max(.55,Math.min(1.8,(demand+20)/(supply+20))),previousPressure=Math.max(.55,Math.min(1.8,(previousDemand+20)/(previousSupply+20)));
      const marketValue=product.listings.length?product.listings.reduce((sum,item)=>sum+Number(item.unitPriceCents)*Number(item.quantity),0)/Math.max(1,listed):0;
      const recentItems=product.orderItems.filter(item=>item.order.createdAt>=since24h),recentQty=recentItems.reduce((sum,item)=>sum+Number(item.quantity),0);
      const recentValue=recentItems.reduce((sum,item)=>sum+Number(item.unitPriceCents)*Number(item.quantity),0)/Math.max(1,recentQty);
      const recipe=Object.values(productionCatalog).find(item=>item.name===product.name);
      const base=recentQty?recentValue:marketValue||Number(recipe?.unitCost??BigInt(Math.max(500,Math.round(Number(product.weightKg)*1800))))*1.35;
      const referencePriceCents=Math.max(100,Math.round(base*pressure));
      const changePercent=Math.round((pressure/previousPressure-1)*1000)/10;
      return {product:{id:product.id,name:product.name,category:product.category,unit:product.unit},referencePriceCents:String(referencePriceCents),changePercent,supply,demand,stock:Math.round(stock*10)/10,production24,sold24,trend:changePercent>1?'UP':changePercent<-1?'DOWN':'STABLE'};
    });
  }
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
  marketProposals(userId:string){
    return this.db.marketProposal.findMany({
      where:{OR:[{buyer:{members:{some:{userId}}}},{listing:{seller:{members:{some:{userId}}}}}]},
      include:{buyer:{select:{id:true,name:true}},listing:{include:{product:true,seller:{select:{id:true,name:true}}}}},
      orderBy:{createdAt:'desc'}
    });
  }
  async createProposal(userId:string,listingId:string,dto:ProposalDto){const listing=await this.db.marketListing.findUnique({where:{id:listingId}});const buyer=await this.db.company.findFirst({where:{id:dto.buyerCompanyId,members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}});if(!listing||listing.status!=='ACTIVE'||!buyer||buyer.id===listing.sellerId||listing.quantity.lt(dto.quantity))throw new BadRequestException('Proposition invalide');return this.db.marketProposal.create({data:{listingId,buyerId:buyer.id,quantity:dto.quantity,proposedUnitPriceCents:BigInt(dto.proposedUnitPriceCents)}})}
  async rejectProposal(userId:string,proposalId:string){const proposal=await this.db.marketProposal.findFirst({where:{id:proposalId,status:'PENDING',listing:{seller:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}}}});if(!proposal)throw new NotFoundException();return this.db.marketProposal.update({where:{id:proposal.id},data:{status:'REJECTED',resolvedAt:new Date()}})}
  async acceptProposal(userId:string,proposalId:string){return this.db.$transaction(async tx=>{const proposal=await tx.marketProposal.findFirst({where:{id:proposalId,status:'PENDING',listing:{seller:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}}},include:{buyer:{include:{account:true,warehouses:true}},listing:{include:{seller:{include:{account:true}},warehouseStock:true}}}});if(!proposal||!proposal.buyer.account||!proposal.listing.seller.account||proposal.listing.status!=='ACTIVE'||proposal.listing.quantity.lt(proposal.quantity))throw new BadRequestException('Proposition indisponible');const total=BigInt(proposal.quantity.toString())*proposal.proposedUnitPriceCents;const claimed=await tx.marketProposal.updateMany({where:{id:proposal.id,status:'PENDING'},data:{status:'ACCEPTED',resolvedAt:new Date()}});if(!claimed.count)throw new BadRequestException('Proposition déjà traitée');const paid=await tx.bankAccount.updateMany({where:{id:proposal.buyer.account.id,balanceCents:{gte:total}},data:{balanceCents:{decrement:total},version:{increment:1}}});if(!paid.count)throw new BadRequestException('Trésorerie de l’acheteur insuffisante');await tx.bankAccount.update({where:{id:proposal.listing.seller.account.id},data:{balanceCents:{increment:total},version:{increment:1}}});await tx.marketListing.update({where:{id:proposal.listing.id},data:{quantity:{decrement:proposal.quantity},version:{increment:1}}});const target=proposal.buyer.warehouses[0]??await tx.warehouse.create({data:{companyId:proposal.buyer.id,name:'Entrepôt principal',city:proposal.buyer.headquarters,capacityM3:10000}});const targetStock=await tx.warehouseStock.upsert({where:{warehouseId_productId:{warehouseId:target.id,productId:proposal.listing.productId}},create:{warehouseId:target.id,productId:proposal.listing.productId,quantity:proposal.quantity},update:{quantity:{increment:proposal.quantity},version:{increment:1}}});await tx.warehouseStock.update({where:{id:proposal.listing.warehouseStockId},data:{quantity:{decrement:proposal.quantity},reservedQuantity:{decrement:proposal.quantity},version:{increment:1}}});const order=await tx.order.create({data:{buyerId:proposal.buyer.id,sellerId:proposal.listing.sellerId,listingId:proposal.listing.id,quantity:proposal.quantity,totalCents:total,idempotencyKey:`proposal:${proposal.id}`,items:{create:{productId:proposal.listing.productId,quantity:proposal.quantity,unitPriceCents:proposal.proposedUnitPriceCents}}}});await Promise.all([tx.ledgerTransaction.create({data:{accountId:proposal.buyer.account.id,type:'PURCHASE',amountCents:-total,description:'Achat négocié',referenceId:order.id}}),tx.ledgerTransaction.create({data:{accountId:proposal.listing.seller.account.id,type:'SALE',amountCents:total,description:'Vente négociée',referenceId:order.id}}),tx.stockMovement.create({data:{type:'OUT',quantity:proposal.quantity,warehouseId:proposal.listing.warehouseStock.warehouseId,stockId:proposal.listing.warehouseStockId,referenceId:order.id}}),tx.stockMovement.create({data:{type:'IN',quantity:proposal.quantity,warehouseId:target.id,stockId:targetStock.id,referenceId:order.id}})]);return order},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})}
  async orders(userId:string){const orders=await this.db.order.findMany({where:{OR:[{buyer:{members:{some:{userId}}}},{seller:{members:{some:{userId}}}}]},include:{buyer:{select:{id:true,name:true,headquarters:true}},seller:{select:{id:true,name:true,headquarters:true}},listing:{include:{warehouseStock:{include:{warehouse:true}}}},items:{include:{product:true}}},orderBy:{createdAt:'desc'}});return orders.map(order=>({...order,origin:{city:order.listing.warehouseStock.warehouse.city,...originForCity(order.listing.warehouseStock.warehouse.city)},tracking:[{step:'Commande confirmée',done:true},{step:'Préparation entrepôt',done:true},{step:'Transport organisé',done:true},{step:'Livraison effectuée',done:order.status==='COMPLETED'}]}))}
  async jobs(userId:string){
    const jobs=await this.db.jobOffer.findMany({where:{status:'OPEN'},include:{company:{select:{id:true,name:true}},contracts:{select:{id:true,status:true,userId:true,user:{select:{displayName:true}}}}},orderBy:{createdAt:'desc'}});
    return jobs.map(job=>({...job,applied:job.contracts.some(contract=>contract.userId===userId),applicants:job.contracts.map(contract=>({id:contract.id,status:contract.status,displayName:contract.user.displayName}))}));
  }
  async createJob(userId:string,companyId:string,dto:JobDto){const allowed=await this.db.companyMember.findFirst({where:{companyId,userId,role:{in:['OWNER','MANAGER']}}});if(!allowed) throw new NotFoundException();return this.db.jobOffer.create({data:{...dto,salaryCents:BigInt(dto.salaryCents),companyId}})}
  async apply(userId:string,jobId:string){
    const job=await this.db.jobOffer.findUnique({where:{id:jobId},include:{company:{include:{members:true}}}});
    if(!job||job.status!=='OPEN')throw new NotFoundException();
    if(job.company.members.some(member=>member.userId===userId)) throw new BadRequestException('Vous ne pouvez pas postuler dans votre propre entreprise');
    const contract=await this.db.employeeContract.upsert({where:{userId_jobOfferId:{userId,jobOfferId:jobId}},create:{userId,jobOfferId:jobId,salaryCents:job.salaryCents},update:{}});
    await this.db.notification.createMany({data:job.company.members.filter(member=>member.role==='OWNER'||member.role==='MANAGER').map(member=>({userId:member.userId,title:'Nouvelle candidature',body:`Un joueur a postulé à l’offre ${job.title}`}))});
    return contract;
  }
  async hire(userId:string,jobId:string,contractId:string){
    return this.db.$transaction(async tx=>{
      const job=await tx.jobOffer.findFirst({where:{id:jobId,status:'OPEN',company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}}});
      if(!job) throw new NotFoundException('Offre inaccessible');
      const hired=await tx.employeeContract.updateMany({where:{id:contractId,jobOfferId:job.id,status:'PENDING'},data:{status:'ACTIVE'}});
      if(hired.count!==1) throw new BadRequestException('Candidature indisponible');
      await tx.employeeContract.updateMany({where:{jobOfferId:job.id,id:{not:contractId},status:'PENDING'},data:{status:'TERMINATED'}});
      await tx.jobOffer.update({where:{id:job.id},data:{status:'CLOSED'}});
      return tx.employeeContract.findUniqueOrThrow({where:{id:contractId}});
    });
  }
  async factories(userId:string,companyId:string){
    const company=await this.db.company.findFirst({where:{id:companyId,members:{some:{userId}}},include:{warehouses:true}});if(!company)throw new NotFoundException();
    const factory=await this.db.factory.findFirst({where:{companyId}})??await this.db.factory.create({data:{companyId,name:'Usine principale',city:company.headquarters}});
    const due=await this.db.productionOrder.findMany({where:{factoryId:factory.id,status:'RUNNING',completesAt:{lte:new Date()}}});
    for(const order of due) await this.db.$transaction(async tx=>{const claimed=await tx.productionOrder.updateMany({where:{id:order.id,status:'RUNNING'},data:{status:'COMPLETED',completedAt:new Date()}});if(!claimed.count)return;const recipe=productionCatalog[order.productType];const product=await tx.product.upsert({where:{sku:recipe.sku},update:{},create:{sku:recipe.sku,name:recipe.name,category:'Production industrielle',unit:'u',weightKg:recipe.weight,volumeM3:recipe.volume}});const warehouse=company.warehouses[0]??await tx.warehouse.create({data:{companyId,name:'Entrepôt principal',city:company.headquarters,capacityM3:10000}});await tx.warehouseStock.upsert({where:{warehouseId_productId:{warehouseId:warehouse.id,productId:product.id}},create:{warehouseId:warehouse.id,productId:product.id,quantity:order.quantity},update:{quantity:{increment:order.quantity},version:{increment:1}}});});
    const employees=await this.db.employeeContract.findMany({where:{status:'ACTIVE',jobOffer:{companyId}},include:{user:{select:{displayName:true}},jobOffer:{select:{title:true}}}});
    const result=await this.db.factory.findUniqueOrThrow({where:{id:factory.id},include:{equipment:true,productionOrders:{orderBy:{startedAt:'desc'},take:12}}});
    return {...result,employees,payrollCents:employees.reduce((sum,item)=>sum+item.salaryCents,0n),baseStaff:2};
  }
  async buyEquipment(userId:string,factoryId:string,dto:EquipmentDto){const item=equipmentCatalog[dto.kind as keyof typeof equipmentCatalog];return this.db.$transaction(async tx=>{const factory=await tx.factory.findFirst({where:{id:factoryId,companyId:dto.companyId,company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}},include:{company:{include:{account:true}}}});if(!factory?.company.account)throw new NotFoundException();const paid=await tx.bankAccount.updateMany({where:{id:factory.company.account.id,balanceCents:{gte:item.price}},data:{balanceCents:{decrement:item.price},version:{increment:1}}});if(!paid.count)throw new BadRequestException('Trésorerie insuffisante');return tx.factoryEquipment.create({data:{factoryId,kind:dto.kind,name:item.name,purchasePriceCents:item.price}})});}
  async upgradeFactory(userId:string,factoryId:string,dto:CompanyActionDto){return this.db.$transaction(async tx=>{const factory=await tx.factory.findFirst({where:{id:factoryId,companyId:dto.companyId,company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}},include:{company:{include:{account:true}}}});if(!factory?.company.account)throw new NotFoundException();const cost=BigInt(factory.level)*20_000_000n;const paid=await tx.bankAccount.updateMany({where:{id:factory.company.account.id,balanceCents:{gte:cost}},data:{balanceCents:{decrement:cost},version:{increment:1}}});if(!paid.count)throw new BadRequestException('Trésorerie insuffisante');return tx.factory.update({where:{id:factory.id},data:{level:{increment:1}}})});}
  async startProduction(userId:string,factoryId:string,dto:ProductionDto){const recipe=productionCatalog[dto.productType];return this.db.$transaction(async tx=>{const factory=await tx.factory.findFirst({where:{id:factoryId,companyId:dto.companyId,company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}},include:{company:{include:{account:true}},equipment:true}});if(!factory?.company.account)throw new NotFoundException();if(!factory.equipment.some(item=>item.kind===recipe.equipment))throw new BadRequestException('Équipement de production requis');const employees=await tx.employeeContract.count({where:{status:'ACTIVE',jobOffer:{companyId:dto.companyId}}});if(employees+2<recipe.staff)throw new BadRequestException(`Personnel insuffisant : ${recipe.staff} employés requis`);const cost=recipe.unitCost*BigInt(dto.quantity);const paid=await tx.bankAccount.updateMany({where:{id:factory.company.account.id,balanceCents:{gte:cost}},data:{balanceCents:{decrement:cost},version:{increment:1}}});if(!paid.count)throw new BadRequestException('Trésorerie insuffisante');const robotics=factory.equipment.some(item=>item.kind==='ROBOTICS');const duration=Math.max(10,Math.ceil(recipe.seconds*dto.quantity/(factory.level*(robotics?1.5:1))));return tx.productionOrder.create({data:{factoryId,productType:dto.productType,productName:recipe.name,quantity:dto.quantity,unitCostCents:recipe.unitCost,completesAt:new Date(Date.now()+duration*1000)}})});}
  async payPayroll(userId:string,companyId:string){return this.db.$transaction(async tx=>{const company=await tx.company.findFirst({where:{id:companyId,members:{some:{userId,role:{in:['OWNER','MANAGER']}}}},include:{account:true}});if(!company?.account)throw new NotFoundException();const contracts=await tx.employeeContract.findMany({where:{status:'ACTIVE',jobOffer:{companyId}}});const total=contracts.reduce((sum,item)=>sum+item.salaryCents,0n);if(total===0n)throw new BadRequestException('Aucun salarié actif');const paid=await tx.bankAccount.updateMany({where:{id:company.account.id,balanceCents:{gte:total}},data:{balanceCents:{decrement:total},version:{increment:1}}});if(!paid.count)throw new BadRequestException('Trésorerie insuffisante pour les salaires');await tx.employeeContract.updateMany({where:{id:{in:contracts.map(item=>item.id)}},data:{lastSalaryPaidAt:new Date()}});await tx.ledgerTransaction.create({data:{accountId:company.account.id,type:'SALARY',amountCents:-total,description:'Paie mensuelle'}});return {total}});}
  async vehicles(userId:string){const vehicles=await this.db.vehicle.findMany({where:{company:{members:{some:{userId}}}},include:{marketListings:{where:{status:'ACTIVE'},select:{id:true,askingPriceCents:true}}},orderBy:{createdAt:'asc'}});return vehicles.map(vehicle=>({...vehicle,currentValueCents:vehicleValue(vehicle.purchasePriceCents,vehicle.condition,Number(vehicle.mileageKm))}))}
  async vehicleMarket(){const listings=await this.db.vehicleMarketListing.findMany({where:{status:'ACTIVE'},include:{seller:{select:{id:true,name:true,headquarters:true}},vehicle:true},orderBy:{createdAt:'desc'}});return listings.map(listing=>({...listing,currentValueCents:vehicleValue(listing.vehicle.purchasePriceCents,listing.vehicle.condition,Number(listing.vehicle.mileageKm))}))}
  async listVehicle(userId:string,vehicleId:string,dto:ListVehicleDto){
    const vehicle=await this.db.vehicle.findFirst({where:{id:vehicleId,companyId:dto.companyId,status:'AVAILABLE',company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}},include:{marketListings:{where:{status:'ACTIVE'}}}});
    if(!vehicle) throw new NotFoundException('Véhicule indisponible');
    if(vehicle.marketListings.length) throw new BadRequestException('Ce véhicule est déjà en vente');
    return this.db.vehicleMarketListing.create({data:{vehicleId:vehicle.id,sellerId:dto.companyId,askingPriceCents:BigInt(dto.askingPriceCents)}});
  }
  async maintainVehicle(userId:string,vehicleId:string,dto:CompanyActionDto){
    return this.db.$transaction(async tx=>{
      const vehicle=await tx.vehicle.findFirst({where:{id:vehicleId,companyId:dto.companyId,status:'AVAILABLE',company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}},include:{company:{include:{account:true}}}});
      if(!vehicle?.company.account) throw new NotFoundException('Véhicule indisponible');
      const cost=BigInt(Math.max(50_000,(100-vehicle.condition)*50_000));
      const paid=await tx.bankAccount.updateMany({where:{id:vehicle.company.account.id,balanceCents:{gte:cost}},data:{balanceCents:{decrement:cost},version:{increment:1}}});
      if(paid.count!==1) throw new BadRequestException('Trésorerie insuffisante pour l’entretien');
      const updated=await tx.vehicle.update({where:{id:vehicle.id},data:{condition:100,lastMaintenanceAt:new Date(),maintenanceCount:{increment:1}}});
      await tx.ledgerTransaction.create({data:{accountId:vehicle.company.account.id,type:'PURCHASE',amountCents:-cost,description:`Entretien ${vehicle.model}`,referenceId:vehicle.id}});
      return updated;
    });
  }
  async buyUsedVehicle(userId:string,listingId:string,dto:CompanyActionDto){
    return this.db.$transaction(async tx=>{
      const listing=await tx.vehicleMarketListing.findUnique({where:{id:listingId},include:{vehicle:true,seller:{include:{account:true}}}});
      const buyer=await tx.company.findFirst({where:{id:dto.companyId,members:{some:{userId,role:{in:['OWNER','MANAGER']}}}},include:{account:true}});
      if(!listing||listing.status!=='ACTIVE'||!buyer?.account||!listing.seller.account||listing.sellerId===buyer.id) throw new BadRequestException('Offre de véhicule indisponible');
      const claimed=await tx.vehicleMarketListing.updateMany({where:{id:listing.id,status:'ACTIVE'},data:{status:'SOLD',buyerId:buyer.id,soldAt:new Date()}});
      if(claimed.count!==1) throw new BadRequestException('Ce véhicule vient d’être vendu');
      const paid=await tx.bankAccount.updateMany({where:{id:buyer.account.id,balanceCents:{gte:listing.askingPriceCents}},data:{balanceCents:{decrement:listing.askingPriceCents},version:{increment:1}}});
      if(paid.count!==1) throw new BadRequestException('Trésorerie insuffisante');
      await tx.bankAccount.update({where:{id:listing.seller.account.id},data:{balanceCents:{increment:listing.askingPriceCents},version:{increment:1}}});
      await tx.vehicle.update({where:{id:listing.vehicleId},data:{companyId:buyer.id}});
      await Promise.all([tx.ledgerTransaction.create({data:{accountId:buyer.account.id,type:'PURCHASE',amountCents:-listing.askingPriceCents,description:`Achat international ${listing.vehicle.model}`,referenceId:listing.id}}),tx.ledgerTransaction.create({data:{accountId:listing.seller.account.id,type:'SALE',amountCents:listing.askingPriceCents,description:`Vente internationale ${listing.vehicle.model}`,referenceId:listing.id}})]);
      return tx.vehicle.findUniqueOrThrow({where:{id:listing.vehicleId}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  async shipments(userId:string){
    await this.ensureDailyTransportNetwork();
    const moving=await this.db.shipment.findMany({where:{carrier:{members:{some:{userId}}},status:{in:['ASSIGNED','IN_TRANSIT']},acceptedAt:{not:null},arrivesAt:{not:null}},include:{carrier:{include:{account:true}},vehicle:true}});
    const now=new Date();
    for(const shipment of moving){
      if(!shipment.acceptedAt||!shipment.arrivesAt||!shipment.vehicle||!shipment.carrier?.account) continue;
      if(shipment.arrivesAt<=now){
        await this.completeShipment(shipment.id,shipment.vehicle.id,shipment.carrier.account.id,shipment.rewardCents,shipment.distanceKm,now);
      }else{
        const total=shipment.arrivesAt.getTime()-shipment.acceptedAt.getTime();
        const elapsed=now.getTime()-shipment.acceptedAt.getTime();
        const progress=Math.max(1,Math.min(99,Math.floor(elapsed/total*100)));
        if(progress!==shipment.progressPercent) await this.db.shipment.updateMany({where:{id:shipment.id,status:{in:['ASSIGNED','IN_TRANSIT']}},data:{progressPercent:progress,status:'IN_TRANSIT'}});
      }
    }
    return this.db.shipment.findMany({where:{OR:[{status:'OPEN'},{carrier:{members:{some:{userId}}}}]},include:{carrier:{select:{name:true}},vehicle:true},orderBy:[{status:'asc'},{rewardCents:'desc'}]});
  }
  async fleetNetwork(userId:string,companyId:string){
    await this.ensureDailyTransportNetwork();
    const company=await this.db.company.findFirst({where:{id:companyId,members:{some:{userId}}}});if(!company)throw new NotFoundException('Entreprise inaccessible');
    const since=this.dayStart();
    const [availableToday,deliveredToday,active,vehicles,routes]=await Promise.all([this.db.shipment.count({where:{createdAt:{gte:since}}}),this.db.shipment.count({where:{carrierId:companyId,status:'DELIVERED',deliveredAt:{gte:since}}}),this.db.shipment.count({where:{carrierId:companyId,status:{in:['ASSIGNED','IN_TRANSIT']}}}),this.db.vehicle.count({where:{companyId}}),this.db.shipment.findMany({where:{createdAt:{gte:since}},select:{originCity:true,destinationCity:true,status:true,carrierId:true}})]);
    const hubs=[...new Set(routes.flatMap(route=>[route.originCity,route.destinationCity]))].map(city=>({city,departures:routes.filter(route=>route.originCity===city).length,arrivals:routes.filter(route=>route.destinationCity===city).length,active:routes.filter(route=>(route.originCity===city||route.destinationCity===city)&&route.carrierId===companyId&&route.status!=='DELIVERED'&&route.status!=='OPEN').length})).sort((a,b)=>b.departures+b.arrivals-a.departures-a.arrivals).slice(0,8);
    return {dailyTarget:DAILY_TRANSPORT_TARGET,availableToday,deliveredToday,active,vehicles,hubs};
  }
  async autoDispatch(userId:string,dto:AutoDispatchDto){
    await this.ensureDailyTransportNetwork();
    const company=await this.db.company.findFirst({where:{id:dto.companyId,members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}});if(!company)throw new NotFoundException('Entreprise inaccessible');
    const vehicles=await this.db.vehicle.findMany({where:{companyId:dto.companyId,status:'AVAILABLE'},orderBy:[{capacityKg:'asc'},{condition:'desc'}],take:Math.min(dto.maxTransports,30)});
    const missions=await this.db.shipment.findMany({where:{status:'OPEN'},orderBy:[{rewardCents:'desc'},{createdAt:'asc'}],take:100});let launched=0;
    for(const vehicle of vehicles){const missionIndex=missions.findIndex(item=>vehicle.capacityKg.gte(item.weightKg));if(missionIndex<0)continue;const [mission]=missions.splice(missionIndex,1);try{await this.assignShipment(userId,mission.id,{companyId:dto.companyId,vehicleId:vehicle.id});launched++;}catch{}}
    return {launched};
  }
  private async completeShipment(shipmentId:string,vehicleId:string,accountId:string,rewardCents:bigint,distanceKm:number,completedAt:Date){
    return this.db.$transaction(async tx=>{
      const claimed=await tx.shipment.updateMany({where:{id:shipmentId,status:{in:['ASSIGNED','IN_TRANSIT']}},data:{progressPercent:100,status:'DELIVERED',deliveredAt:completedAt,arrivesAt:completedAt}});
      if(claimed.count!==1) return false;
      await tx.vehicle.update({where:{id:vehicleId},data:{status:'AVAILABLE',mileageKm:{increment:distanceKm},condition:{decrement:2}}});
      await tx.bankAccount.update({where:{id:accountId},data:{balanceCents:{increment:rewardCents},version:{increment:1}}});
      await tx.ledgerTransaction.create({data:{accountId,type:'SALE',amountCents:rewardCents,description:`Livraison automatique`,referenceId:shipmentId}});
      return true;
    });
  }
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
  async buyTruckBatch(userId:string,dto:BulkVehicleDto){
    const selected=vehicleCatalog[dto.modelId as keyof typeof vehicleCatalog],quantity=Math.min(20,dto.quantity),discount=quantity>=10?12:quantity>=5?8:4;
    const unitPrice=selected.price*BigInt(100-discount)/100n,total=unitPrice*BigInt(quantity);
    return this.db.$transaction(async tx=>{
      const company=await tx.company.findFirst({where:{id:dto.companyId,members:{some:{userId,role:{in:['OWNER','MANAGER']}}}},include:{account:true}});if(!company?.account)throw new NotFoundException('Entreprise inaccessible');
      const paid=await tx.bankAccount.updateMany({where:{id:company.account.id,balanceCents:{gte:total}},data:{balanceCents:{decrement:total},version:{increment:1}}});if(!paid.count)throw new BadRequestException('Trésorerie insuffisante pour ce lot');
      const stamp=Date.now().toString().slice(-6);for(let index=0;index<quantity;index++)await tx.vehicle.create({data:{companyId:company.id,registration:`${selected.prefix}-${stamp}-${String(index+1).padStart(2,'0')}`,model:selected.model,type:selected.type,capacityKg:selected.capacityKg,purchasePriceCents:unitPrice}});
      await tx.ledgerTransaction.create({data:{accountId:company.account.id,type:'PURCHASE',amountCents:-total,description:`Achat groupé ${quantity} × ${selected.model} · remise ${discount}%`}});return {quantity,discount,total};
    });
  }
  async sellVehicleToGarage(userId:string,vehicleId:string,dto:GarageSaleDto){
    const garageRates={NORD:78,EURO:82,ECO:86} as const,garageNames={NORD:'Garage Nord Trucks',EURO:'EuroFleet Occasion',ECO:'EcoMotion Reprise'} as const;
    return this.db.$transaction(async tx=>{
      const vehicle=await tx.vehicle.findFirst({where:{id:vehicleId,companyId:dto.companyId,status:'AVAILABLE',company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}},include:{company:{include:{account:true}}}});if(!vehicle?.company.account)throw new BadRequestException('Le camion doit être revenu au garage');
      const value=vehicleValue(vehicle.purchasePriceCents,vehicle.condition,Number(vehicle.mileageKm)),offer=value*BigInt(garageRates[dto.garageId])/100n;
      const garage=await tx.company.upsert({where:{name:garageNames[dto.garageId]},update:{},create:{name:garageNames[dto.garageId],sector:'Garage professionnel',headquarters:'Europe',legalForm:'SA',account:{create:{balanceCents:10_000_000_000n}}}});
      await tx.vehicleMarketListing.updateMany({where:{vehicleId,status:'ACTIVE'},data:{status:'CANCELLED'}});await tx.vehicle.update({where:{id:vehicleId},data:{companyId:garage.id}});await tx.bankAccount.update({where:{id:vehicle.company.account.id},data:{balanceCents:{increment:offer},version:{increment:1}}});
      await tx.ledgerTransaction.create({data:{accountId:vehicle.company.account.id,type:'SALE',amountCents:offer,description:`Reprise garage ${vehicle.model}`,referenceId:vehicle.id}});return {offer};
    });
  }
  async assignShipment(userId:string,shipmentId:string,dto:AssignShipmentDto){
    return this.db.$transaction(async tx=>{
      const vehicle=await tx.vehicle.findFirst({where:{id:dto.vehicleId,companyId:dto.companyId,status:'AVAILABLE',company:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}}});
      const shipment=await tx.shipment.findUnique({where:{id:shipmentId}});
      if(!vehicle||!shipment||shipment.status!=='OPEN') throw new BadRequestException('Mission ou véhicule indisponible');
      if(vehicle.capacityKg.lt(shipment.weightKg)) throw new BadRequestException('Capacité du véhicule insuffisante');
      const acceptedAt=new Date();
      const arrivesAt=new Date(acceptedAt.getTime()+shipmentDurationMs(shipment.distanceKm));
      const claimed=await tx.shipment.updateMany({where:{id:shipment.id,status:'OPEN'},data:{carrierId:dto.companyId,vehicleId:vehicle.id,status:'IN_TRANSIT',acceptedAt,arrivesAt,progressPercent:1}});
      if(claimed.count!==1) throw new BadRequestException('Mission déjà attribuée');
      await tx.vehicle.update({where:{id:vehicle.id},data:{status:'ASSIGNED'}});
      return tx.shipment.findUniqueOrThrow({where:{id:shipment.id},include:{vehicle:true}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  async accelerateShipment(userId:string,shipmentId:string,dto:CompanyActionDto){
    return this.db.$transaction(async tx=>{
      const shipment=await tx.shipment.findFirst({where:{id:shipmentId,carrierId:dto.companyId,carrier:{members:{some:{userId,role:{in:['OWNER','MANAGER']}}}}},include:{vehicle:true,carrier:{include:{account:true}}}});
      if(!shipment?.vehicle||!shipment.carrier?.account||shipment.status==='DELIVERED'||shipment.status==='OPEN') throw new BadRequestException('Transport déjà terminé ou indisponible');
      const now=new Date();
      const claimed=await tx.shipment.updateMany({where:{id:shipment.id,status:{in:['ASSIGNED','IN_TRANSIT']}},data:{progressPercent:100,status:'DELIVERED',deliveredAt:now,arrivesAt:now}});
      if(claimed.count!==1) throw new BadRequestException('Ce transport vient déjà d’être terminé');
      const debit=await tx.company.updateMany({where:{id:dto.companyId,gems:{gte:ACCELERATION_GEM_COST}},data:{gems:{decrement:ACCELERATION_GEM_COST}}});
      if(debit.count!==1) throw new BadRequestException(`Il faut ${ACCELERATION_GEM_COST} gemmes pour accélérer`);
      await tx.vehicle.update({where:{id:shipment.vehicle.id},data:{status:'AVAILABLE',mileageKm:{increment:shipment.distanceKm},condition:{decrement:2}}});
      await tx.bankAccount.update({where:{id:shipment.carrier.account.id},data:{balanceCents:{increment:shipment.rewardCents},version:{increment:1}}});
      await tx.ledgerTransaction.create({data:{accountId:shipment.carrier.account.id,type:'SALE',amountCents:shipment.rewardCents,description:`Livraison accélérée ${shipment.reference}`,referenceId:shipment.id}});
      return tx.shipment.findUniqueOrThrow({where:{id:shipment.id},include:{vehicle:true}});
    });
  }
}

@Controller()
@UseGuards(JwtGuard)
export class GameController {
  constructor(private readonly game:GameService){}
  @Get('products') products(){return this.game.products()} @Get('market/listings') listings(){return this.game.listings()}
  @Get('market/economy') marketEconomy(){return this.game.marketEconomy()}
  @Get('companies') companies(@Req() r:AuthRequest){return this.game.companies(r.user.sub)} @Post('companies') createCompany(@Req() r:AuthRequest,@Body() d:CompanyDto){return this.game.createCompany(r.user.sub,d)}
  @Post('market/listings') createListing(@Req() r:AuthRequest,@Body() d:ListingDto){return this.game.createListing(r.user.sub,d)}
  @Post('market/listings/:id/buy') buy(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:BuyDto,@Headers('idempotency-key') key?:string){return this.game.buy(r.user.sub,id,d,key)}
  @Get('market/proposals') marketProposals(@Req() r:AuthRequest){return this.game.marketProposals(r.user.sub)}
  @Post('market/listings/:id/proposals') createProposal(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:ProposalDto){return this.game.createProposal(r.user.sub,id,d)}
  @Post('market/proposals/:id/accept') acceptProposal(@Req() r:AuthRequest,@Param('id') id:string){return this.game.acceptProposal(r.user.sub,id)}
  @Post('market/proposals/:id/reject') rejectProposal(@Req() r:AuthRequest,@Param('id') id:string){return this.game.rejectProposal(r.user.sub,id)}
  @Get('orders') orders(@Req() r:AuthRequest){return this.game.orders(r.user.sub)} @Get('job-offers') jobs(@Req() r:AuthRequest){return this.game.jobs(r.user.sub)}
  @Post('companies/:id/job-offers') createJob(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:JobDto){return this.game.createJob(r.user.sub,id,d)}
  @Post('job-offers/:id/apply') apply(@Req() r:AuthRequest,@Param('id') id:string){return this.game.apply(r.user.sub,id)}
  @Post('job-offers/:id/contracts/:contractId/hire') hire(@Req() r:AuthRequest,@Param('id') id:string,@Param('contractId') contractId:string){return this.game.hire(r.user.sub,id,contractId)}
  @Get('companies/:id/factories') factories(@Req() r:AuthRequest,@Param('id') id:string){return this.game.factories(r.user.sub,id)}
  @Post('factories/:id/equipment') buyEquipment(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:EquipmentDto){return this.game.buyEquipment(r.user.sub,id,d)}
  @Post('factories/:id/upgrade') upgradeFactory(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:CompanyActionDto){return this.game.upgradeFactory(r.user.sub,id,d)}
  @Post('factories/:id/produce') startProduction(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:ProductionDto){return this.game.startProduction(r.user.sub,id,d)}
  @Post('companies/:id/payroll') payPayroll(@Req() r:AuthRequest,@Param('id') id:string){return this.game.payPayroll(r.user.sub,id)}
  @Get('vehicles') vehicles(@Req() r:AuthRequest){return this.game.vehicles(r.user.sub)}
  @Get('vehicle-market') vehicleMarket(){return this.game.vehicleMarket()}
  @Post('vehicles/buy-truck') buyTruck(@Req() r:AuthRequest,@Body() d:BuyVehicleDto){return this.game.buyTruck(r.user.sub,d)}
  @Post('vehicles/buy-batch') buyTruckBatch(@Req() r:AuthRequest,@Body() d:BulkVehicleDto){return this.game.buyTruckBatch(r.user.sub,d)}
  @Post('vehicles/:id/garage-sale') garageSale(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:GarageSaleDto){return this.game.sellVehicleToGarage(r.user.sub,id,d)}
  @Post('vehicles/:id/list') listVehicle(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:ListVehicleDto){return this.game.listVehicle(r.user.sub,id,d)}
  @Post('vehicles/:id/maintenance') maintainVehicle(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:CompanyActionDto){return this.game.maintainVehicle(r.user.sub,id,d)}
  @Post('vehicle-market/:id/buy') buyUsedVehicle(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:CompanyActionDto){return this.game.buyUsedVehicle(r.user.sub,id,d)}
  @Get('shipments') shipments(@Req() r:AuthRequest){return this.game.shipments(r.user.sub)}
  @Get('companies/:id/fleet-network') fleetNetwork(@Req() r:AuthRequest,@Param('id') id:string){return this.game.fleetNetwork(r.user.sub,id)}
  @Post('fleet/auto-dispatch') autoDispatch(@Req() r:AuthRequest,@Body() d:AutoDispatchDto){return this.game.autoDispatch(r.user.sub,d)}
  @Post('shipments/:id/assign') assignShipment(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:AssignShipmentDto){return this.game.assignShipment(r.user.sub,id,d)}
  @Post('shipments/:id/accelerate') accelerateShipment(@Req() r:AuthRequest,@Param('id') id:string,@Body() d:CompanyActionDto){return this.game.accelerateShipment(r.user.sub,id,d)}
}

export function assertPurchase(quantity:number, available:number, balanceCents:bigint, unitPriceCents:bigint){if(quantity<=0||quantity>available)throw new Error('Stock insuffisant');const total=BigInt(quantity)*unitPriceCents;if(total>balanceCents)throw new Error('Trésorerie insuffisante');return total}
