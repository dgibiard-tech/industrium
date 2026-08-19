import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'argon2';
const db=new PrismaClient();
const products=[['STEEL','Acier','Métaux','t',1000,1.3],['COPPER','Cuivre','Métaux','t',1000,0.14],['ALUMINIUM','Aluminium','Métaux','t',1000,0.37],['PLASTIC','Plastique','Chimie','t',1000,2],['GLASS','Verre','Matériaux','t',1000,0.4],['WOOD','Bois','Matériaux','m³',650,1],['SILICON','Silicium','Électronique','kg',1,0.001],['LITHIUM','Lithium','Métaux','kg',1,0.001],['CPU','Processeur','Électronique','u',0.05,0.0003],['BATTERY','Batterie','Automobile','u',420,0.45],['MOTOR','Moteur','Automobile','u',120,0.3],['TIRE','Pneu','Automobile','u',12,0.06],['COMPUTER','Ordinateur','High-tech','u',3,0.02],['PHONE','Smartphone','High-tech','u',0.2,0.001],['CAR','Voiture','Automobile','u',1600,12],['TRUCK','Camion','Automobile','u',8000,60]] as const;
async function main(){
  const catalog=new Map<string,string>();
  for(const [sku,name,category,unit,weight,volume] of products){const p=await db.product.upsert({where:{sku},update:{},create:{sku,name,category,unit,weightKg:new Prisma.Decimal(weight),volumeM3:new Prisma.Decimal(volume)}});catalog.set(sku,p.id)}
  const user=await db.user.upsert({where:{email:'demo@industrium.test'},update:{},create:{email:'demo@industrium.test',displayName:'Alex Martin',passwordHash:await hash('Demo123!')}});
  const demo=await db.company.upsert({where:{name:'Nova Industrie'},update:{},create:{name:'Nova Industrie',sector:'Automobile',headquarters:'Lyon',legalForm:'SAS',members:{create:{userId:user.id,role:'OWNER'}},account:{create:{balanceCents:250000000}},warehouses:{create:{name:'Hub de Lyon',city:'Lyon',capacityM3:20000}}},include:{warehouses:true,account:true}});
  if(demo.account && await db.ledgerTransaction.count({where:{accountId:demo.account.id}})===0) await db.ledgerTransaction.create({data:{accountId:demo.account.id,type:'CAPITAL',amountCents:250000000,description:'Capital de démonstration'}});
  const ai=[['EuroSteel','Sidérurgie','Duisbourg','STEEL',15000,85000],['Silica Works','Électronique','Grenoble','SILICON',50000,430],['Baltic Cells','Batteries','Gdańsk','BATTERY',8000,1250000]] as const;
  for(const [name,sector,city,sku,qty,price] of ai){
    const company=await db.company.upsert({where:{name},update:{},create:{name,sector,headquarters:city,legalForm:'SA',account:{create:{balanceCents:1000000000}},warehouses:{create:{name:`Dépôt ${city}`,city,capacityM3:50000}}},include:{warehouses:true}});
    const stock=await db.warehouseStock.upsert({where:{warehouseId_productId:{warehouseId:company.warehouses[0].id,productId:catalog.get(sku)!}},update:{},create:{warehouseId:company.warehouses[0].id,productId:catalog.get(sku)!,quantity:qty,reservedQuantity:qty}});
    if(await db.marketListing.count({where:{sellerId:company.id,productId:catalog.get(sku)!}})===0) await db.marketListing.create({data:{sellerId:company.id,productId:catalog.get(sku)!,warehouseStockId:stock.id,quantity:qty,unitPriceCents:price}});
    if(await db.jobOffer.count({where:{companyId:company.id}})===0) await db.jobOffer.create({data:{companyId:company.id,title:sku==='STEEL'?'Technicien de production':'Responsable logistique',city,salaryCents:sku==='STEEL'?340000:390000}});
  }
}
main().finally(()=>db.$disconnect());
