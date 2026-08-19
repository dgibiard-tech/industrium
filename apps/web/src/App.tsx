import { FormEvent, lazy, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money } from "./api";
import { useSession } from "./store";
const IndustrialMap3D = lazy(() => import("./IndustrialMap3D"));
type Company = {
  id: string;
  name: string;
  sector: string;
  account: { balanceCents: string };
  gems: number;
  warehouses: {
    name: string;
    city:string;
    capacityM3:string;
    stocks: {
      id: string;
      quantity: string;
      reservedQuantity: string;
      product: { name: string; unit: string;category:string;weightKg:string;volumeM3:string };
    }[];
  }[];
};
type Listing = {
  id: string;
  quantity: string;
  unitPriceCents: string;
  product: { id:string; name: string; unit: string; category:string };
  seller: { id:string; name: string };
  warehouseStock: { warehouse: { city: string } };
  origin:{city:string;country:string;code:string};
};
type EconomyQuote={product:{id:string;name:string;category:string;unit:string};referencePriceCents:string;changePercent:number;supply:number;demand:number;stock:number;production24:number;sold24:number;trend:"UP"|"DOWN"|"STABLE"};
type GameOrder={id:string;quantity:string;totalCents:string;status:string;createdAt:string;buyer:{id:string;name:string};seller:{id:string;name:string};origin:{city:string;country:string;code:string};items:{id:string;quantity:string;unitPriceCents:string;product:{name:string;unit:string;category:string}}[];tracking:{step:string;done:boolean}[]};
type MarketProposal={id:string;quantity:string;proposedUnitPriceCents:string;status:"PENDING"|"ACCEPTED"|"REJECTED";buyer:{id:string;name:string};listing:{id:string;unitPriceCents:string;product:{name:string;unit:string};seller:{id:string;name:string}};createdAt:string};
type Job = {
  id: string;
  title: string;
  salaryCents: string;
  city: string;
  company: { id: string; name: string };
  applied: boolean;
  applicants: { id: string; displayName: string; status: string }[];
};
type Vehicle = {
  id: string;
  registration: string;
  model: string;
  type: string;
  capacityKg: string;
  mileageKm: string;
  condition: number;
  purchasePriceCents: string;
  currentValueCents: string;
  createdAt: string;
  lastMaintenanceAt?: string;
  maintenanceCount: number;
  marketListings: { id: string; askingPriceCents: string }[];
  status: "AVAILABLE" | "ASSIGNED" | "MAINTENANCE";
};
type VehicleMarketListing = {
  id: string;
  askingPriceCents: string;
  currentValueCents: string;
  seller: { id: string; name: string; headquarters: string };
  vehicle: Vehicle;
};
type FactoryData = {
  id: string;
  name: string;
  city: string;
  level: number;
  baseStaff: number;
  payrollCents: string;
  equipment: {
    id: string;
    kind: string;
    name: string;
    condition: number;
    purchasePriceCents: string;
    purchasedAt: string;
  }[];
  employees: {
    id: string;
    salaryCents: string;
    lastSalaryPaidAt?: string;
    user: { displayName: string };
    jobOffer: { title: string };
  }[];
  productionOrders: {
    id: string;
    productType: "VEHICLE" | "COMPUTER" | "FURNITURE";
    productName: string;
    quantity: number;
    unitCostCents: string;
    status: "RUNNING" | "COMPLETED";
    startedAt: string;
    completesAt: string;
    completedAt?: string;
  }[];
};
export type Shipment = {
  id: string;
  reference: string;
  cargoName: string;
  weightKg: string;
  originCity: string;
  destinationCity: string;
  distanceKm: number;
  rewardCents: string;
  status: "OPEN" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED";
  progressPercent: number;
  acceptedAt?: string;
  arrivesAt?: string;
  deliveredAt?: string;
  carrier?: { name: string };
  vehicle?: Vehicle;
};
type FleetNetwork = {
  dailyTarget: number;
  availableToday: number;
  deliveredToday: number;
  active: number;
  vehicles: number;
  hubs: { city: string; departures: number; arrivals: number; active: number }[];
};
const nav = [
  "Vue d’ensemble",
  "Marché mondial",
  "Stocks",
  "Commandes",
  "Emplois",
  "Usines",
  "Transport",
  "Carte",
  "Mises à jour",
];
export function App() {
  const { session } = useSession();
  return session ? <Game /> : <Login />;
}
function Login() {
  const setSession = useSession((s) => s.setSession);
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api<{
        accessToken: string;
        user: { displayName: string };
      }>(`/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setSession({ token: r.accessToken, user: r.user });
    } catch (x) {
      setError((x as Error).message);
    }
  }
  return (
    <main className="auth">
      <section>
        <div className="brand">
          INDUSTRIUM <i>ONLINE</i>
        </div>
        <h1>
          Bâtissez l’industrie.
          <br />
          Dirigez l’économie.
        </h1>
        <p>
          Un monde persistant où chaque tonne d’acier, chaque emploi et chaque
          transaction compte.
        </p>
      </section>
      <form onSubmit={submit}>
        <h2>{register ? "Créer un compte" : "Reprendre votre empire"}</h2>
        {register && (
          <label>
            Nom affiché
            <input name="displayName" required minLength={2} />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            defaultValue="demo@industrium.test"
            required
          />
        </label>
        <label>
          Mot de passe
          <input
            name="password"
            type="password"
            defaultValue="Demo123!"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button>{register ? "Créer mon compte" : "Connexion"}</button>
        <button
          type="button"
          className="link"
          onClick={() => setRegister(!register)}
        >
          {register ? "J’ai déjà un compte" : "Créer un nouveau compte"}
        </button>
      </form>
    </main>
  );
}
function Game() {
  const session = useSession((s) => s.session)!;
  const logout = useSession((s) => s.logout);
  const [tab, setTab] = useState(nav[0]);
  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: () => api<Company[]>("/companies"),
    refetchInterval: 5000,
  });
  const listings = useQuery({
    queryKey: ["listings"],
    queryFn: () => api<Listing[]>("/market/listings"),
  });
  const economy=useQuery({queryKey:["market-economy"],queryFn:()=>api<EconomyQuote[]>("/market/economy"),refetchInterval:5000});
  const proposals=useQuery({queryKey:["market-proposals"],queryFn:()=>api<MarketProposal[]>("/market/proposals"),refetchInterval:3000});
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<GameOrder[]>("/orders"),
  });
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api<Job[]>("/job-offers"),
    refetchInterval: 3000,
  });
  const vehicles = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api<Vehicle[]>("/vehicles"),
  });
  const vehicleMarket = useQuery({
    queryKey: ["vehicle-market"],
    queryFn: () => api<VehicleMarketListing[]>("/vehicle-market"),
    refetchInterval: 5000,
  });
  const shipments = useQuery({
    queryKey: ["shipments"],
    queryFn: () => api<Shipment[]>("/shipments"),
    refetchInterval: 5000,
  });
  const company = companies.data?.[0];
  const factory = useQuery({
    queryKey: ["factory", company?.id],
    queryFn: () => api<FactoryData>(`/companies/${company!.id}/factories`),
    enabled: !!company,
    refetchInterval: 3000,
  });
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          INDUSTRIUM <i>ONLINE</i>
        </div>
        <small>OPÉRATIONS</small>
        {nav.map((n) => (
          <button
            className={tab === n ? "active" : ""}
            onClick={() => setTab(n)}
            key={n}
          >
            {n}
          </button>
        ))}
        <footer>
          <span className="avatar">{session.user.displayName[0]}</span>
          <div>
            {session.user.displayName}
            <small>Directeur général</small>
          </div>
          <button onClick={logout}>↪</button>
        </footer>
      </aside>
      <main className="content">
        <header>
          <div>
            <small>MONDE EUROPE 01 · EN LIGNE</small>
            <h1>{tab}</h1>
          </div>
          <div className="company">
            {company?.name ?? "Aucune entreprise"}
            <strong>
              {company ? money(company.account.balanceCents) : "—"}
            </strong>
            {company && <em className="gemBalance">◆ {company.gems} gemmes</em>}
          </div>
        </header>
        {!company ? (
          <CreateCompany />
        ) : tab === "Marché mondial" ? (
          <Market company={company} data={listings.data ?? []} proposals={proposals.data??[]} economy={economy.data??[]} />
        ) : tab === "Stocks" ? (
          <Stocks company={company} onNavigate={setTab} />
        ) : tab === "Commandes" ? (
          <Orders data={orders.data ?? []} company={company} onNavigate={setTab} />
        ) : tab === "Emplois" ? (
          <Jobs company={company} data={jobs.data ?? []} />
        ) : tab === "Usines" ? (
          factory.data ? (
            <FactoryManagement company={company} factory={factory.data} />
          ) : (
            <div className="empty">Initialisation de l’usine…</div>
          )
        ) : tab === "Transport" ? (
          <Transport
            company={company}
            vehicles={vehicles.data ?? []}
            shipments={shipments.data ?? []}
            market={vehicleMarket.data ?? []}
            factory={factory.data}
          />
        ) : tab === "Carte" ? (
          <WorldMap shipments={shipments.data ?? []} onNavigate={setTab} />
        ) : tab === "Mises à jour" ? (
          <Changelog />
        ) : (
          <Dashboard
            company={company}
            listings={listings.data?.length ?? 0}
            orders={orders.data?.length ?? 0}
            onNavigate={setTab}
          />
        )}
      </main>
    </div>
  );
}
const gameUpdates=[
  {title:"Centrale solaire industrielle",items:["Installation photovoltaïque achetable pour chaque usine","Production électrique en temps réel selon l’heure","Autoconsommation, économies mensuelles et CO₂ évité","Parc solaire agrandi automatiquement avec les niveaux"]},
  {title:"Usines évolutives sur 50 niveaux",items:["10 paliers industriels du petit atelier à la mégafactory autonome","Productivité et capacité progressives","Feuille de route complète avec avantages de chaque palier"]},
  {title:"Rentabilité logistique complète",items:["Coût par voyage : énergie, salarié et entretien","Prix du gazole au litre et consommation de chaque camion","Bénéfice net total et détaillé par véhicule","Inventaire des missions livrées et fret longue distance"]},
  {title:"Tour de contrôle des commandes",items:["Recherche, filtres et tri avancés","Indicateurs commerciaux et graphique des flux","Fiches détaillées avec facture, taxes et traçabilité"]},
  {title:"Défilement complet de l’interface",items:["Barres de défilement sur toutes les pages principales","Listes, terminaux et fenêtres 3D désormais défilables","Style industriel et adaptation mobile"]},
  {title:"Intérieurs industriels photoréalistes 360°",items:["Usines et entrepôts entièrement redessinés","Décors continus dans toutes les directions","Machines, racks, quais et zones de sécurité plus réalistes"]},
  {title:"Refonte panoramique et corrections de la carte",items:["Nouveau décor photoréaliste à 360° autour du monde","Routes et marquages stabilisés","Suppression des sauts de véhicules et des ruptures visuelles"]},
  {title:"Réseau routier 3D et suivi GPS",items:["Routes courbes, embranchements et rond-point","Véhicules animés directement sur leur trajet","Informations détaillées pour chaque véhicule en circulation"]},
  {title:"Journal des mises à jour intégré",items:["Nouvel écran accessible dans le jeu","Historique permanent enregistré sur GitHub","Mise à jour prévue après chaque demande publiée"]},
  {title:"Stocks, commandes et siège social",items:["Centre de stocks avancé avec alertes et réservations","Suivi animé des commandes internationales","Siège social 3D avec employés et terminal de direction"]},
  {title:"Traçabilité et économie mondiale",items:["Pays et ville d’origine de chaque offre","Prix variables selon les stocks, achats et productions réelles","Cours, tendances et recommandations de prix"]},
  {title:"Monde industriel 3D",items:["Carte enrichie avec relief, ville, énergie et trafic","Usines et entrepôts ultra-modernes visitables","Terminaux de gestion dans tous les bâtiments"]},
  {title:"Transport et flotte",items:["30 missions minimum chaque jour","Réseau de hubs européens","Dispatch automatique des véhicules"]},
] as const;
const factoryTiers=[
  {level:1,name:"Atelier industriel",benefit:"Production initiale",color:"#8797a1"},{level:5,name:"Manufacture locale",benefit:"Capacité +25 %",color:"#58a6c4"},{level:10,name:"Usine régionale",benefit:"Lignes optimisées",color:"#3fc0aa"},{level:15,name:"Complexe automatisé",benefit:"Robotisation avancée",color:"#63d06f"},{level:20,name:"Pôle national",benefit:"Production continue",color:"#d7ba45"},{level:25,name:"Smart Factory",benefit:"Pilotage par IA",color:"#ef983d"},{level:30,name:"Gigafactory",benefit:"Capacité massive",color:"#ee6547"},{level:35,name:"Campus industriel",benefit:"Logistique intégrée",color:"#da5d9d"},{level:40,name:"Mégafactory",benefit:"Automatisation totale",color:"#9d78ed"},{level:50,name:"Industrie autonome",benefit:"Excellence mondiale",color:"#62dff1"},
] as const;
function Changelog(){return <section className="changelogPage"><div className="changelogHero"><small>INDUSTRIUM · DÉVELOPPEMENT CONTINU</small><h2>Journal des mises à jour</h2><p>Chaque amélioration réalisée et publiée est enregistrée ici.</p><span>DERNIÈRE MISE À JOUR · 19 AOÛT 2026</span></div><div className="releaseTimeline">{gameUpdates.map((update,index)=><article key={update.title}><div className="releaseMarker"><i /><span>{index===0?"NOUVEAU":`VERSION ${gameUpdates.length-index}`}</span></div><div><small>19 AOÛT 2026</small><h3>{update.title}</h3><ul>{update.items.map(item=><li key={item}>{item}</li>)}</ul></div></article>)}</div></section>}
function CreateCompany() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (data: unknown) =>
      api("/companies", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
  return (
    <section className="empty">
      <h2>Créez votre première entreprise</h2>
      <p>
        Un entrepôt principal et un compte bancaire seront ouverts
        automatiquement.
      </p>
      <button
        onClick={() =>
          m.mutate({
            name: `Entreprise ${Date.now().toString().slice(-5)}`,
            sector: "Industrie",
            headquarters: "Paris",
            legalForm: "SAS",
            capitalCents: 10000000,
          })
        }
      >
        Créer avec 100 000 € de capital
      </button>
      {m.error && <p className="error">{m.error.message}</p>}
    </section>
  );
}
function Dashboard({
  company,
  listings,
  orders,
  onNavigate,
}: {
  company: Company;
  listings: number;
  orders: number;
  onNavigate: (tab: string) => void;
}) {
  const stocks = company.warehouses.flatMap((w) => w.stocks);
  return (
    <>
      <section className="worldHero">
        <div className="heroShade"></div>
        <div className="heroTop">
          <span className="live">
            <i></i> COMPLEXE EN ACTIVITÉ
          </span>
          <span>LYON · 18:42 · 12°C</span>
        </div>
        <div className="heroCopy">
          <small>SIÈGE INDUSTRIEL · SECTEUR AUTOMOBILE</small>
          <h2>{company.name}</h2>
          <p>
            Vue stratégique du complexe de production et du terminal logistique.
          </p>
          <div className="heroActions">
            <button onClick={() => onNavigate("Transport")}>
              ▦ Gérer la flotte
            </button>
            <button className="secondary" onClick={() => onNavigate("Carte")}>
              ⌖ Ouvrir la carte
            </button>
          </div>
        </div>
        <div className="sitePins">
          <span className="pin factory">
            <b>01</b>
            <em>Usine principale</em>
          </span>
          <span className="pin warehouse">
            <b>02</b>
            <em>Hub logistique</em>
          </span>
          <span className="pin rail">
            <b>03</b>
            <em>Terminal ferroviaire</em>
          </span>
        </div>
        <div className="heroStatus">
          <span>
            <b>97%</b> Efficacité
          </span>
          <span>
            <b>2</b> Sites actifs
          </span>
          <span>
            <b>0</b> Alertes critiques
          </span>
        </div>
      </section>
      <div className="metrics">
        <Card
          label="Trésorerie"
          value={money(company.account.balanceCents)}
          delta="Compte opérationnel"
        />
        <Card
          label="Commandes"
          value={String(orders)}
          delta="Historique total"
        />
        <Card
          label="Références en stock"
          value={String(stocks.length)}
          delta={`${company.warehouses.length} entrepôt(s)`}
        />
        <Card
          label="Offres mondiales"
          value={String(listings)}
          delta="Marché actif"
        />
      </div>
      <div className="gameGrid">
        <section>
          <h3>Flux opérationnel</h3>
          <div className="activity">
            {stocks.length ? (
              stocks.slice(0, 5).map((s) => (
                <p key={s.id}>
                  <b>{s.product.name}</b>
                  <span>
                    {s.quantity} {s.product.unit} en stock
                  </span>
                </p>
              ))
            ) : (
              <p>
                <b>Aucun stock</b>
                <span>Achetez vos premières matières sur le marché.</span>
              </p>
            )}
          </div>
        </section>
        <section>
          <h3>État du groupe</h3>
          <div className="operationCards">
            <article>
              <span>PRODUCTION</span>
              <b>Prête à démarrer</b>
              <i>En attente de matières</i>
            </article>
            <article>
              <span>LOGISTIQUE</span>
              <b>Hub disponible</b>
              <i>0 quai occupé</i>
            </article>
            <article>
              <span>MARCHÉ</span>
              <b>{listings} opportunités</b>
              <i>Économie mondiale</i>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
function Card(p: { label: string; value: string; delta: string }) {
  return (
    <article className="card">
      <small>{p.label}</small>
      <strong>{p.value}</strong>
      <span>{p.delta}</span>
    </article>
  );
}
function Market({ company, data,proposals,economy }: { company: Company; data: Listing[];proposals:MarketProposal[];economy:EconomyQuote[] }) {
  const qc = useQueryClient();
  const [quantities,setQuantities]=useState<Record<string,number>>({});
  const [offerPrices,setOfferPrices]=useState<Record<string,string>>({});
  const refresh=()=>Promise.all([qc.invalidateQueries({ queryKey: ["listings"] }),qc.invalidateQueries({ queryKey: ["companies"] }),qc.invalidateQueries({ queryKey: ["orders"] }),qc.invalidateQueries({queryKey:["market-proposals"]}),qc.invalidateQueries({queryKey:["market-economy"]})]);
  const buy = useMutation({
    mutationFn: ({id,quantity}:{id:string;quantity:number}) => api(`/market/listings/${id}/buy`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ buyerCompanyId: company.id, quantity }),
      }),
    onSuccess: refresh,
  });
  const propose=useMutation({mutationFn:({id,quantity,price}:{id:string;quantity:number;price:number})=>api(`/market/listings/${id}/proposals`,{method:"POST",body:JSON.stringify({buyerCompanyId:company.id,quantity,proposedUnitPriceCents:Math.round(price*100)})}),onSuccess:refresh});
  const resolve=useMutation({mutationFn:({id,action}:{id:string;action:"accept"|"reject"})=>api(`/market/proposals/${id}/${action}`,{method:"POST"}),onSuccess:refresh});
  const error=buy.error||propose.error||resolve.error;
  const received=proposals.filter(p=>p.listing.seller.id===company.id&&p.status==="PENDING");
  const sent=proposals.filter(p=>p.buyer.id===company.id);
  return (
    <section className="worldMarket">
      <div className="sectionTitle">
        <div>
          <small>MARCHÉ MONDIAL · COTATIONS EN DIRECT</small>
          <h2>Carnet international des offres</h2>
        </div>
        <span>{data.length} offres actives</span>
      </div>
      {error&&<p className="error">{error.message}</p>}
      <div className="economyBoard">{economy.slice(0,8).map(q=><article className={q.trend.toLowerCase()} key={q.product.id}><div><small>{q.product.category}</small><b>{q.product.name}</b></div><strong>{money(q.referencePriceCents)}<em>/{q.product.unit}</em></strong><span>{q.trend==="UP"?"▲":q.trend==="DOWN"?"▼":"●"} {q.changePercent>0?"+":""}{q.changePercent}%</span><dl><div><dt>Offre</dt><dd>{q.supply}</dd></div><div><dt>Demande</dt><dd>{q.demand}</dd></div><div><dt>Production 24 h</dt><dd>{q.production24}</dd></div></dl></article>)}</div>
      <div className="marketCards">{data.map(l=>{const quote=economy.find(q=>q.product.id===l.product.id),max=Math.floor(Number(l.quantity)),quantity=Math.min(max,quantities[l.id]??1),priceEuros=offerPrices[l.id]??String(Math.round(Number(quote?.referencePriceCents??l.unitPriceCents)/100));return <article key={l.id}><header><div><small>{l.product.category??"PRODUIT INDUSTRIEL"}</small><h3>{l.product.name}</h3></div><strong>{money(l.unitPriceCents)}<em>/{l.product.unit}</em></strong></header>{quote&&<div className={`marketQuote ${quote.trend.toLowerCase()}`}><span>Cours dynamique</span><b>{money(quote.referencePriceCents)}</b><em>{quote.trend==="UP"?"▲":quote.trend==="DOWN"?"▼":"●"} {quote.changePercent>0?"+":""}{quote.changePercent}%</em></div>}<div className="marketOrigin"><span>{l.seller.name}</span><div className="countryOrigin"><i>{l.origin.code}</i><b>{l.origin.country}</b><em>{l.origin.city}</em></div><span>Stock : {l.quantity} {l.product.unit}</span></div><label>Quantité à acheter<input type="number" min="1" max={max} value={quantity} onChange={event=>setQuantities({...quantities,[l.id]:Math.max(1,Math.min(max,Number(event.target.value)))})}/></label><div className="marketTotal"><span>Total au tarif affiché</span><b>{money(BigInt(l.unitPriceCents)*BigInt(quantity))}</b></div><button disabled={buy.isPending||l.seller.id===company.id} onClick={()=>buy.mutate({id:l.id,quantity})}>{l.seller.id===company.id?"Votre offre":"Acheter immédiatement"}</button>{l.seller.id!==company.id&&<div className="priceProposal"><label>Votre prix unitaire conseillé (€)<input type="number" min="1" value={priceEuros} onChange={event=>setOfferPrices({...offerPrices,[l.id]:event.target.value})}/></label><button disabled={propose.isPending} onClick={()=>propose.mutate({id:l.id,quantity,price:Number(priceEuros)})}>Proposer ce prix</button></div>}</article>})}</div>
      {(received.length>0||sent.length>0)&&<div className="negotiations"><div><h3>Propositions reçues</h3>{received.length?received.map(p=><article key={p.id}><div><b>{p.buyer.name}</b><span>{p.quantity} {p.listing.product.unit} de {p.listing.product.name}</span></div><strong>{money(p.proposedUnitPriceCents)} / unité</strong><button onClick={()=>resolve.mutate({id:p.id,action:"accept"})}>Accepter</button><button className="reject" onClick={()=>resolve.mutate({id:p.id,action:"reject"})}>Refuser</button></article>):<p>Aucune proposition en attente.</p>}</div><div><h3>Vos propositions</h3>{sent.length?sent.slice(0,8).map(p=><article key={p.id}><div><b>{p.listing.product.name}</b><span>{p.quantity} unité(s) · {p.listing.seller.name}</span></div><strong>{money(p.proposedUnitPriceCents)}</strong><em className={p.status.toLowerCase()}>{p.status}</em></article>):<p>Aucune proposition envoyée.</p>}</div></div>}
    </section>
  );
}
function Stocks({ company,onNavigate }: { company: Company;onNavigate:(tab:string)=>void }) {
  const [search,setSearch]=useState("");
  const allStocks=company.warehouses.flatMap(warehouse=>warehouse.stocks.map(stock=>({warehouse,...stock})));
  const totalUnits=allStocks.reduce((sum,stock)=>sum+Number(stock.quantity),0),reserved=allStocks.reduce((sum,stock)=>sum+Number(stock.reservedQuantity),0);
  return (
    <section className="inventoryControl">
      <div className="inventoryHero"><div><small>WMS · CONTRÔLE EN TEMPS RÉEL</small><h2>Centre de gestion des stocks</h2><p>Supervisez les capacités, réservations et seuils de réapprovisionnement de tous les entrepôts.</p></div><div className="warehousePulse"><i/>SYSTÈMES OPÉRATIONNELS</div></div>
      <div className="inventoryMetrics"><Card label="Stock total" value={totalUnits.toLocaleString("fr-FR")} delta="unités physiques"/><Card label="Disponible" value={(totalUnits-reserved).toLocaleString("fr-FR")} delta="prêt à vendre"/><Card label="Réservé" value={reserved.toLocaleString("fr-FR")} delta="commandes en préparation"/><Card label="Alertes" value={String(allStocks.filter(s=>Number(s.quantity)-Number(s.reservedQuantity)<10).length)} delta="seuil faible"/></div>
      <div className="stockToolbar"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Rechercher un produit ou une catégorie…"/><button onClick={()=>onNavigate("Marché mondial")}>+ Réapprovisionner</button><button onClick={()=>onNavigate("Commandes")}>Voir les commandes</button></div>
      {company.warehouses.map((w) => (
        <div className="warehouseZone" key={w.name}>
          <div className="sectionTitle">
            <div>
              <small>ENTREPÔT CONNECTÉ · {w.city}</small>
              <h2>{w.name}</h2>
            </div>
            <span>{w.stocks.length} références · capacité {Number(w.capacityM3).toLocaleString("fr-FR")} m³</span>
          </div>
          <div className="stockGrid">
            {w.stocks.filter(s=>`${s.product.name} ${s.product.category}`.toLowerCase().includes(search.toLowerCase())).map((s) => {const available=Number(s.quantity)-Number(s.reservedQuantity),fill=Math.min(100,Number(s.quantity)/Math.max(25,Number(s.quantity))*100),alert=available<10;return (
              <article className={alert?"lowStock":""} key={s.id}>
                <header><div><small>{s.product.category}</small><h3>{s.product.name}</h3></div><em>{alert?"STOCK FAIBLE":"DISPONIBLE"}</em></header>
                <div className="stockNumbers"><strong>{available.toLocaleString("fr-FR")}</strong><span>{s.product.unit} disponibles</span></div>
                <div className="stockGauge"><i style={{width:`${fill}%`}}/></div>
                <dl><div><dt>Physique</dt><dd>{s.quantity}</dd></div><div><dt>Réservé</dt><dd>{s.reservedQuantity}</dd></div><div><dt>Poids/unité</dt><dd>{Number(s.product.weightKg).toLocaleString("fr-FR")} kg</dd></div></dl>
                <footer><button onClick={()=>onNavigate("Marché mondial")}>{alert?"Commander maintenant":"Acheter / vendre"}</button><button onClick={()=>onNavigate("Commandes")}>Mouvements →</button></footer>
              </article>);})}
          </div>
        </div>
      ))}
    </section>
  );
}
function Orders({ data,company,onNavigate }: { data: GameOrder[];company:Company;onNavigate:(tab:string)=>void }) {
  const [filter,setFilter]=useState<"ALL"|"BUY"|"SELL">("ALL");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<"RECENT"|"VALUE">("RECENT");
  const [selected,setSelected]=useState<GameOrder|null>(null);
  const sales=data.filter(o=>o.seller.id===company.id),purchases=data.filter(o=>o.buyer.id===company.id),salesValue=sales.reduce((sum,o)=>sum+BigInt(o.totalCents),0n),purchaseValue=purchases.reduce((sum,o)=>sum+BigInt(o.totalCents),0n);
  const visible=data.filter(order=>(filter==="ALL"||(filter==="BUY"?order.buyer.id===company.id:order.seller.id===company.id))&&`${order.id} ${order.items.map(item=>item.product.name).join(" ")} ${order.buyer.name} ${order.seller.name} ${order.origin.country}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==="VALUE"?Number(BigInt(b.totalCents)-BigInt(a.totalCents)):new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  const maxOrder=Math.max(1,...data.slice(0,8).map(order=>Number(order.totalCents)));
  return (
    <section className="orderControl">
      <div className="orderHero"><div><small>ORDER MANAGEMENT SYSTEM · LIVE</small><h2>Tour de contrôle commerciale</h2><p>Supervision des achats, ventes, paiements, préparations et livraisons internationales.</p></div><div className="orderLive"><i/> SYNCHRONISATION ACTIVE<span>{data.length} flux contrôlés</span></div></div>
      <div className="sectionTitle">
        <div>
          <small>OMS · FLUX COMMERCIAUX EN DIRECT</small>
          <h2>Centre de contrôle des commandes</h2>
        </div>
        <button onClick={()=>onNavigate("Marché mondial")}>+ Nouvelle commande</button>
      </div>
      <div className="orderMetrics"><Card label="Commandes" value={String(data.length)} delta="historique total"/><Card label="Chiffre d’affaires" value={money(salesValue)} delta={`${sales.length} vente(s)`}/><Card label="Dépenses achats" value={money(purchaseValue)} delta={`${purchases.length} achat(s)`}/><Card label="Solde commercial" value={money(salesValue-purchaseValue)} delta={salesValue>=purchaseValue?"excédent":"déficit"}/></div>
      <div className="orderAnalytics"><div><small>VOLUME DES DERNIERS FLUX</small><div className="orderBars">{data.slice(0,8).reverse().map(order=><i key={order.id} style={{height:`${Math.max(12,Number(order.totalCents)/maxOrder*100)}%`}} title={money(order.totalCents)}/>)}</div></div><dl><div><dt>Panier moyen</dt><dd>{money(data.length?data.reduce((sum,o)=>sum+BigInt(o.totalCents),0n)/BigInt(data.length):0)}</dd></div><div><dt>Taux livré</dt><dd>{data.length?Math.round(data.filter(o=>o.status==="COMPLETED").length/data.length*100):0}%</dd></div><div><dt>Pays fournisseurs</dt><dd>{new Set(purchases.map(o=>o.origin.country)).size}</dd></div></dl></div>
      <div className="orderCommandBar"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Rechercher une commande, un produit, une entreprise ou un pays…"/><div className="orderFilters">{([['ALL','Toutes'],['BUY','Achats'],['SELL','Ventes']] as const).map(([value,label])=><button className={filter===value?"active":""} key={value} onClick={()=>setFilter(value)}>{label}</button>)}</div><select value={sort} onChange={event=>setSort(event.target.value as "RECENT"|"VALUE")}><option value="RECENT">Plus récentes</option><option value="VALUE">Valeur décroissante</option></select></div>
      <div className="orderList">
        {visible.map((o) => (
          <article key={o.id}>
            <header><div><small>CMD-{o.id.slice(-7).toUpperCase()} · {new Date(o.createdAt).toLocaleDateString("fr-FR")}</small><h3>{o.items[0]?.product.name}</h3></div><div className="orderAmount"><strong>{money(o.totalCents)}</strong><em>{o.status}</em></div></header>
            <div className="orderRoute"><span><i>{o.origin.code}</i>{o.seller.name}<small>{o.origin.city}, {o.origin.country}</small></span><b>→</b><span>{o.buyer.name}<small>Entrepôt destinataire</small></span><strong>{o.quantity} {o.items[0]?.product.unit}</strong></div>
            <div className="orderTimeline">{o.tracking.map((step,index)=><div className={step.done?"done":""} key={step.step}><i>{step.done?"✓":index+1}</i><span>{step.step}</span></div>)}</div>
            <footer><span>{o.buyer.id===company.id?"ACHAT":"VENTE"} · {o.items[0]?.product.category}</span><button className="orderDetails" onClick={()=>setSelected(o)}>Détails / facture</button><button onClick={()=>onNavigate("Stocks")}>Voir le stock</button><button onClick={()=>onNavigate("Transport")}>Suivre le transport</button></footer>
          </article>
        ))}
        {!visible.length&&<div className="emptyFleet">Aucune commande dans cette catégorie.</div>}
      </div>
      {selected&&<aside className="orderDrawer"><button className="closeOrder" onClick={()=>setSelected(null)}>×</button><small>DOSSIER DE COMMANDE</small><h2>CMD-{selected.id.slice(-7).toUpperCase()}</h2><span className="invoiceStatus">✓ PAYÉE ET LIVRÉE</span><div className="invoiceParties"><div><small>FOURNISSEUR</small><b>{selected.seller.name}</b><span>{selected.origin.city}, {selected.origin.country}</span></div><b>→</b><div><small>CLIENT</small><b>{selected.buyer.name}</b><span>Entrepôt destinataire</span></div></div><h3>Détail de la facture</h3><div className="invoiceLines">{selected.items.map(item=><div key={item.id}><span><b>{item.product.name}</b><small>{item.product.category}</small></span><em>{item.quantity} {item.product.unit}</em><strong>{money(item.unitPriceCents)} / u.</strong></div>)}</div><dl className="invoiceTotals"><div><dt>Sous-total HT</dt><dd>{money(BigInt(selected.totalCents)*100n/120n)}</dd></div><div><dt>Taxes estimées</dt><dd>{money(BigInt(selected.totalCents)-BigInt(selected.totalCents)*100n/120n)}</dd></div><div><dt>Total transaction</dt><dd>{money(selected.totalCents)}</dd></div></dl><div className="invoiceTrace"><small>TRAÇABILITÉ</small>{selected.tracking.map(step=><span key={step.step}><i>✓</i>{step.step}</span>)}</div><footer><button onClick={()=>onNavigate("Stocks")}>Ouvrir le stock</button><button onClick={()=>onNavigate("Transport")}>Ouvrir la logistique</button></footer></aside>}
    </section>
  );
}
const vehicleCatalog = [
  {
    id: "atlas-tx480",
    model: "Atlas TX 480",
    type: "Semi-remorque diesel",
    capacity: 24,
    price: 12_500_000,
    image: "/assets/atlas-tx480-world-v2.png",
    range: "1 400 km",
    accent: "orange",
  },
  {
    id: "voltis-e18",
    model: "Voltis E18",
    type: "Porteur électrique",
    capacity: 12,
    price: 9_800_000,
    image: "/assets/voltis-e18-world-v2.png",
    range: "420 km",
    accent: "blue",
  },
  {
    id: "nova-v6",
    model: "Nova V6 Urban",
    type: "Utilitaire électrique",
    capacity: 3.5,
    price: 5_900_000,
    image: "/assets/nova-v6-world-v2.png",
    range: "310 km",
    accent: "navy",
  },
] as const;
const vehicleImage = (model: string) =>
  vehicleCatalog.find((v) => v.model === model)?.image ??
  vehicleCatalog[0].image;
function Transport({
  company,
  vehicles,
  shipments,
  market,
  factory,
}: {
  company: Company;
  vehicles: Vehicle[];
  shipments: Shipment[];
  market: VehicleMarketListing[];
  factory?: FactoryData;
}) {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [selling, setSelling] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState("");
  const [historyVehicle, setHistoryVehicle] = useState("ALL");
  const network = useQuery({
    queryKey: ["fleet-network", company.id],
    queryFn: () =>
      api<FleetNetwork>(`/companies/${company.id}/fleet-network`),
    refetchInterval: 5000,
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["vehicles"] }),
      qc.invalidateQueries({ queryKey: ["vehicle-market"] }),
      qc.invalidateQueries({ queryKey: ["shipments"] }),
      qc.invalidateQueries({ queryKey: ["companies"] }),
      qc.invalidateQueries({ queryKey: ["fleet-network", company.id] }),
    ]);
  const buy = useMutation({
    mutationFn: (modelId: string) =>
      api("/vehicles/buy-truck", {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, modelId }),
      }),
    onSuccess: refresh,
  });
  const assign = useMutation({
    mutationFn: ({
      shipmentId,
      vehicleId,
    }: {
      shipmentId: string;
      vehicleId: string;
    }) =>
      api(`/shipments/${shipmentId}/assign`, {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, vehicleId }),
      }),
    onSuccess: refresh,
  });
  const accelerate = useMutation({
    mutationFn: (shipmentId: string) =>
      api(`/shipments/${shipmentId}/accelerate`, {
        method: "POST",
        body: JSON.stringify({ companyId: company.id }),
      }),
    onSuccess: refresh,
  });
  const listVehicle = useMutation({
    mutationFn: ({
      vehicleId,
      askingPriceCents,
    }: {
      vehicleId: string;
      askingPriceCents: number;
    }) =>
      api(`/vehicles/${vehicleId}/list`, {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, askingPriceCents }),
      }),
    onSuccess: () => {
      setSelling(null);
      setSalePrice("");
      refresh();
    },
  });
  const buyUsed = useMutation({
    mutationFn: (listingId: string) =>
      api(`/vehicle-market/${listingId}/buy`, {
        method: "POST",
        body: JSON.stringify({ companyId: company.id }),
      }),
    onSuccess: refresh,
  });
  const maintain = useMutation({
    mutationFn: (vehicleId: string) =>
      api(`/vehicles/${vehicleId}/maintenance`, {
        method: "POST",
        body: JSON.stringify({ companyId: company.id }),
      }),
    onSuccess: refresh,
  });
  const autoDispatch = useMutation({
    mutationFn: () =>
      api<{ launched: number }>("/fleet/auto-dispatch", {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, maxTransports: 30 }),
      }),
    onSuccess: refresh,
  });
  const available = vehicles.filter((v) => v.status === "AVAILABLE");
  const active = shipments.filter(
    (s) => s.carrier?.name === company.name && s.status !== "DELIVERED",
  );
  const open = shipments.filter((s) => s.status === "OPEN");
  const completed = shipments.filter(
    (s) => s.carrier?.name === company.name && s.status === "DELIVERED",
  );
  const totalFleetRevenue = completed.reduce(
    (sum, shipment) => sum + Number(shipment.rewardCents),
    0,
  );
  const completedDistance = completed.reduce(
    (sum, shipment) => sum + shipment.distanceKm,
    0,
  );
  const DIESEL_PRICE_CENTS = 186;
  const ELECTRICITY_PRICE_CENTS = 29;
  const tripCosts = (shipment: Shipment) => {
    const vehicle = shipment.vehicle;
    const electric = vehicle?.type.toLowerCase().includes("électrique") ?? false;
    const consumption = electric
      ? vehicle?.model.includes("Nova") ? 27 : 92
      : 31;
    const energyQuantity = shipment.distanceKm * consumption / 100;
    const energyCost = energyQuantity * (electric ? ELECTRICITY_PRICE_CENTS : DIESEL_PRICE_CENTS);
    const tripHours = Math.max(2, shipment.distanceKm / 72 + 1.5);
    const employeeIndex = completed.findIndex((item) => item.id === shipment.id);
    const employee = factory?.employees.length
      ? factory.employees[Math.abs(employeeIndex) % factory.employees.length]
      : undefined;
    const hourlyEmployeeCost = employee
      ? Number(employee.salaryCents) / 151.67
      : 2400;
    const employeeCost = hourlyEmployeeCost * tripHours;
    const maintenanceCost = shipment.distanceKm * (electric ? 11 : 18);
    const total = energyCost + employeeCost + maintenanceCost;
    return {electric, consumption, energyQuantity, energyCost, tripHours, employee, employeeCost, maintenanceCost, total, net:Number(shipment.rewardCents)-total};
  };
  const totalFleetCosts = completed.reduce(
    (sum, shipment) => sum + tripCosts(shipment).total,
    0,
  );
  const truckResults = vehicles
    .map((vehicle) => {
      const missions = completed.filter(
        (shipment) => shipment.vehicle?.id === vehicle.id,
      );
      const revenue = missions.reduce(
        (sum, shipment) => sum + Number(shipment.rewardCents),
        0,
      );
      return {
        vehicle,
        missions,
        revenue,
        distance: missions.reduce(
          (sum, shipment) => sum + shipment.distanceKm,
          0,
        ),
        costs: missions.reduce((sum, shipment) => sum + tripCosts(shipment).total, 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const visibleHistory = completed
    .filter(
      (shipment) =>
        historyVehicle === "ALL" || shipment.vehicle?.id === historyVehicle,
    )
    .sort(
      (a, b) =>
        new Date(b.deliveredAt ?? b.arrivesAt ?? 0).getTime() -
        new Date(a.deliveredAt ?? a.arrivesAt ?? 0).getTime(),
    );
  const error =
    buy.error ||
    assign.error ||
    accelerate.error ||
    listVehicle.error ||
    buyUsed.error ||
    maintain.error ||
    autoDispatch.error;
  return (
    <section className="transportPage">
      <div className="fleetHeader">
        <div>
          <small>DIVISION LOGISTIQUE</small>
          <h2>Centre de transport</h2>
          <p>
            Les convois roulent automatiquement, même lorsque vous quittez le
            jeu.
          </p>
        </div>
        <div className="gemWallet">◆ {company.gems} gemmes</div>
      </div>
      <section className="fleetNetwork">
        <div className="networkCommand">
          <div>
            <small>RÉSEAU LOGISTIQUE EUROPÉEN</small>
            <h3>Tour de contrôle de la flotte</h3>
            <p>
              30 nouveaux transports minimum sont générés chaque jour sur le
              réseau. Le dispatch automatique choisit le camion compatible le
              plus rentable.
            </p>
          </div>
          <button
            disabled={autoDispatch.isPending || available.length === 0}
            onClick={() => autoDispatch.mutate()}
          >
            {autoDispatch.isPending
              ? "Planification…"
              : `Lancer le dispatch · ${available.length} camion(s)`}
          </button>
        </div>
        <div className="dailyObjective">
          <div className="objectiveRing">
            <strong>{network.data?.availableToday ?? 30}</strong>
            <span>missions / jour</span>
          </div>
          <div className="objectiveCopy">
            <small>OBJECTIF JOURNALIER</small>
            <b>
              {network.data?.deliveredToday ?? 0} livrée(s) · {network.data?.active ?? active.length} en route
            </b>
            <div className="dailyTrack">
              <i
                style={{
                  width: `${Math.min(100, ((network.data?.deliveredToday ?? 0) / (network.data?.dailyTarget ?? 30)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div className="hubGrid">
          {(network.data?.hubs ?? []).map((hub, index) => (
            <article key={hub.city}>
              <span className={`hubPulse hub${index % 3}`} />
              <div>
                <b>{hub.city}</b>
                <small>
                  {hub.departures} départs · {hub.arrivals} arrivées
                </small>
              </div>
              <em>{hub.active ? `${hub.active} actif` : "disponible"}</em>
            </article>
          ))}
        </div>
      </section>
      <div className="vehicleShop">
        {vehicleCatalog.map((v) => (
          <article className={`shopVehicle ${v.accent}`} key={v.id}>
            <img src={v.image} alt={v.model} />
            <div>
              <small>NOUVEAU VÉHICULE</small>
              <h3>{v.model}</h3>
              <p>{v.type}</p>
              <dl>
                <span>
                  <b>{v.capacity} t</b> capacité
                </span>
                <span>
                  <b>{v.range}</b> autonomie
                </span>
              </dl>
              <button onClick={() => buy.mutate(v.id)} disabled={buy.isPending}>
                Acheter · {money(v.price)}
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="transportMetrics">
        <Card
          label="Véhicules"
          value={String(vehicles.length)}
          delta={`${available.length} disponible(s)`}
        />
        <Card
          label="Missions actives"
          value={String(active.length)}
          delta="Transport automatique"
        />
        <Card
          label="Contrats ouverts"
          value={String(open.length)}
          delta="Marché européen"
        />
      </div>
      {error && <p className="error">{error.message}</p>}
      <h3>Flotte de l’entreprise</h3>
      <div className="vehicleRow">
        {vehicles.length ? (
          vehicles.map((v) => (
            <article className="vehicleCard modern" key={v.id}>
              <img src={vehicleImage(v.model)} alt={v.model} />
              <small>{v.registration}</small>
              <h3>{v.model}</h3>
              <p>
                {v.type} · {Number(v.capacityKg) / 1000} t
              </p>
              <dl className="vehicleFacts">
                <div>
                  <dt>Prix d’achat</dt>
                  <dd>{money(v.purchasePriceCents)}</dd>
                </div>
                <div>
                  <dt>Valeur actuelle</dt>
                  <dd>{money(v.currentValueCents)}</dd>
                </div>
                <div>
                  <dt>Mise en circulation</dt>
                  <dd>{new Date(v.createdAt).toLocaleDateString("fr-FR")}</dd>
                </div>
                <div>
                  <dt>Kilométrage</dt>
                  <dd>{Number(v.mileageKm).toLocaleString("fr-FR")} km</dd>
                </div>
                <div>
                  <dt>Dernier entretien</dt>
                  <dd>
                    {v.lastMaintenanceAt
                      ? new Date(v.lastMaintenanceAt).toLocaleDateString(
                          "fr-FR",
                        )
                      : "Jamais"}
                  </dd>
                </div>
                <div>
                  <dt>Entretiens</dt>
                  <dd>{v.maintenanceCount}</dd>
                </div>
              </dl>
              <div className="condition">
                <span style={{ width: `${v.condition}%` }}></span>
              </div>
              <footer>
                <b>{v.condition}% état</b>
                <em className={v.status.toLowerCase()}>{v.status}</em>
              </footer>
              {v.status === "AVAILABLE" && (
                <button
                  className="maintainVehicle"
                  disabled={maintain.isPending || v.condition === 100}
                  onClick={() => maintain.mutate(v.id)}
                >
                  Entretien ·{" "}
                  {money(Math.max(50_000, (100 - v.condition) * 50_000))}
                </button>
              )}
              {v.marketListings.length ? (
                <div className="salePublished">
                  En vente · {money(v.marketListings[0].askingPriceCents)}
                </div>
              ) : (
                v.status === "AVAILABLE" &&
                (selling === v.id ? (
                  <div className="sellEditor">
                    <input
                      autoFocus
                      type="number"
                      min="1000"
                      step="100"
                      value={salePrice}
                      onChange={(event) => setSalePrice(event.target.value)}
                      placeholder={String(
                        Math.round(Number(v.currentValueCents) / 100),
                      )}
                    />
                    <button
                      disabled={!salePrice || listVehicle.isPending}
                      onClick={() =>
                        listVehicle.mutate({
                          vehicleId: v.id,
                          askingPriceCents: Math.round(Number(salePrice) * 100),
                        })
                      }
                    >
                      Publier
                    </button>
                    <button
                      className="cancelSale"
                      onClick={() => setSelling(null)}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    className="sellVehicle"
                    onClick={() => {
                      setSelling(v.id);
                      setSalePrice(
                        String(Math.round(Number(v.currentValueCents) / 100)),
                      );
                    }}
                  >
                    Revendre sur le marché
                  </button>
                ))
              )}
            </article>
          ))
        ) : (
          <div className="emptyFleet">
            Aucun véhicule. Choisissez votre premier modèle dans le catalogue.
          </div>
        )}
      </div>
      <section className="fleetResults">
        <div className="fleetResultsHeader">
          <div>
            <small>COMPTABILITÉ LOGISTIQUE</small>
            <h3>Inventaire des missions accomplies</h3>
            <p>Revenus certifiés à partir des transports effectivement livrés.</p>
          </div>
          <span className="fleetRevenueTotal">{money(totalFleetRevenue)}</span>
        </div>
        <div className="fleetResultKpis">
          <article><small>Missions terminées</small><strong>{completed.length}</strong><span>livraisons réussies</span></article>
          <article><small>Revenu total</small><strong>{money(totalFleetRevenue)}</strong><span>chiffre d’affaires flotte</span></article>
          <article><small>Distance livrée</small><strong>{completedDistance.toLocaleString("fr-FR")} km</strong><span>trajets accomplis</span></article>
          <article><small>Coûts d’exploitation</small><strong>{money(totalFleetCosts)}</strong><span>énergie, personnel, entretien</span></article>
          <article className="netProfitKpi"><small>Bénéfice net</small><strong>{money(totalFleetRevenue-totalFleetCosts)}</strong><span>après tous les coûts</span></article>
        </div>
        <h4>Résultats par camion</h4>
        <div className="truckResults">
          {truckResults.length ? truckResults.map(({vehicle, missions, revenue, distance, costs}, index) => (
            <article key={vehicle.id} className="truckResultCard">
              <div className="truckResultRank">#{index + 1}</div>
              <img src={vehicleImage(vehicle.model)} alt={vehicle.model} />
              <div className="truckResultIdentity"><small>{vehicle.registration}</small><b>{vehicle.model}</b><span>{vehicle.status}</span></div>
              <dl>
                <div><dt>Missions</dt><dd>{missions.length}</dd></div>
                <div><dt>Revenu généré</dt><dd>{money(revenue)}</dd></div>
                <div><dt>Kilomètres livrés</dt><dd>{distance.toLocaleString("fr-FR")} km</dd></div>
                <div><dt>Charges</dt><dd className="costValue">− {money(costs)}</dd></div>
                <div><dt>Bénéfice net</dt><dd className="profitValue">{money(revenue-costs)}</dd></div>
              </dl>
            </article>
          )) : <div className="emptyFleet">Achetez un camion pour démarrer votre bilan logistique.</div>}
        </div>
        <div className="missionHistoryHeader">
          <div><h4>Registre des livraisons</h4><span>{visibleHistory.length} mission(s) affichée(s)</span></div>
          <select value={historyVehicle} onChange={(event) => setHistoryVehicle(event.target.value)}>
            <option value="ALL">Tous les camions</option>
            {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration} · {vehicle.model}</option>)}
          </select>
        </div>
        <div className="missionHistory">
          {visibleHistory.length ? visibleHistory.map((shipment) => {
            const costs=tripCosts(shipment);
            return <article key={shipment.id}>
              <div className="missionHistoryStatus"><i />LIVRÉE</div>
              <div><small>{shipment.reference}</small><b>{shipment.originCity} → {shipment.destinationCity}</b><span>{shipment.cargoName} · {(Number(shipment.weightKg) / 1000).toLocaleString("fr-FR")} t</span></div>
              <div><small>CAMION</small><b>{shipment.vehicle?.registration ?? "Non renseigné"}</b><span>{shipment.vehicle?.model ?? "Véhicule archivé"}</span></div>
              <div><small>DATE DE LIVRAISON</small><b>{shipment.deliveredAt || shipment.arrivesAt ? new Date((shipment.deliveredAt ?? shipment.arrivesAt)!).toLocaleDateString("fr-FR") : "Historique"}</b><span>{shipment.distanceKm.toLocaleString("fr-FR")} km</span></div>
              <div className="tripAccounting">
                <small>COMPTE DU VOYAGE</small>
                <span>{costs.electric ? "Électricité" : "Gazole"} : {costs.energyQuantity.toLocaleString("fr-FR",{maximumFractionDigits:1})} {costs.electric ? "kWh" : "L"} × {(costs.electric ? ELECTRICITY_PRICE_CENTS/100 : DIESEL_PRICE_CENTS/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}</span>
                <span>Énergie : − {money(costs.energyCost)} · entretien : − {money(costs.maintenanceCost)}</span>
                <span>{costs.employee?.user.displayName ?? "Chauffeur intérimaire"} ({costs.employee?.jobOffer.title ?? "Conducteur"}) : {costs.tripHours.toLocaleString("fr-FR",{maximumFractionDigits:1})} h · − {money(costs.employeeCost)}</span>
                <b>Revenu {money(shipment.rewardCents)} · coûts − {money(costs.total)} · net <em>{money(costs.net)}</em></b>
              </div>
            </article>
          }) : <div className="emptyHistory">Aucune mission terminée pour ce véhicule. Les prochaines livraisons apparaîtront automatiquement ici.</div>}
        </div>
      </section>
      <h3>Marché international des véhicules</h3>
      <div className="usedMarket">
        {market.filter((listing) => listing.seller.id !== company.id).length ? (
          market
            .filter((listing) => listing.seller.id !== company.id)
            .map((listing) => (
              <article key={listing.id}>
                <img
                  src={vehicleImage(listing.vehicle.model)}
                  alt={listing.vehicle.model}
                />
                <div>
                  <small>
                    {listing.seller.name} · {listing.seller.headquarters}
                  </small>
                  <h3>{listing.vehicle.model}</h3>
                  <p>
                    {listing.vehicle.registration} ·{" "}
                    {Number(listing.vehicle.mileageKm).toLocaleString("fr-FR")}{" "}
                    km · état {listing.vehicle.condition}%
                  </p>
                  <dl>
                    <span>
                      Valeur estimée <b>{money(listing.currentValueCents)}</b>
                    </span>
                    <span>
                      Prix vendeur{" "}
                      <strong>{money(listing.askingPriceCents)}</strong>
                    </span>
                  </dl>
                  <button
                    disabled={buyUsed.isPending}
                    onClick={() => buyUsed.mutate(listing.id)}
                  >
                    Acheter ce véhicule
                  </button>
                </div>
              </article>
            ))
        ) : (
          <div className="emptyFleet">
            Aucun véhicule proposé actuellement par une autre entreprise.
          </div>
        )}
      </div>
      {active.length > 0 && (
        <>
          <h3>Convois automatiques en cours</h3>
          <div className="activeConvoys">
            {active.map((s) => {
              const remaining = Math.max(
                0,
                new Date(s.arrivesAt ?? now).getTime() - now,
              );
              const minutes = Math.floor(remaining / 60000),
                seconds = Math.floor((remaining % 60000) / 1000);
              return (
                <article key={s.id}>
                  <div>
                    <small>
                      {s.reference} · {s.vehicle?.registration}
                    </small>
                    <b>
                      {s.originCity} → {s.destinationCity}
                    </b>
                    <span>
                      {s.cargoName} · arrivée dans {minutes}m{" "}
                      {String(seconds).padStart(2, "0")}s
                    </span>
                  </div>
                  <div className="routeProgress">
                    <i style={{ width: `${s.progressPercent}%` }}></i>
                    <span>{s.progressPercent}%</span>
                  </div>
                  <button
                    className="gemSpeed"
                    disabled={accelerate.isPending || company.gems < 10}
                    onClick={() => accelerate.mutate(s.id)}
                  >
                    ◆ Accélérer · 10
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
      <h3>Bourse de fret</h3>
      <div className="missionGrid">
        {open.map((s) => {
          const truck = available.find(
            (v) => Number(v.capacityKg) >= Number(s.weightKg),
          );
          return (
            <article className="missionCard" key={s.id}>
              <div className="missionRef">
                <small>{s.reference} {s.distanceKm >= 2000 && <em className="longHaulBadge">LONGUE DISTANCE</em>}</small>
                <b>{money(s.rewardCents)}</b>
              </div>
              <h3>
                {s.originCity} <span>→</span> {s.destinationCity}
              </h3>
              <p>{s.cargoName}</p>
              <dl>
                <div>
                  <dt>Distance</dt>
                  <dd>{s.distanceKm.toLocaleString("fr-FR")} km</dd>
                </div>
                <div>
                  <dt>Durée</dt>
                  <dd>
                    {Math.min(30, Math.max(2, Math.ceil(s.distanceKm / 100)))}{" "}
                    min
                  </dd>
                </div>
                <div>
                  <dt>Charge</dt>
                  <dd>{Number(s.weightKg) / 1000} t</dd>
                </div>
              </dl>
              <button
                disabled={!truck || assign.isPending}
                onClick={() =>
                  truck &&
                  assign.mutate({ shipmentId: s.id, vehicleId: truck.id })
                }
              >
                {truck
                  ? `Lancer avec ${truck.registration}`
                  : "Aucun camion compatible"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function WorldMap({ shipments,onNavigate }: { shipments: Shipment[];onNavigate:(tab:string)=>void }) {
  return (
    <Suspense
      fallback={<div className="empty">Initialisation du monde 3D…</div>}
    >
      <IndustrialMap3D shipments={shipments} onNavigate={onNavigate} />
    </Suspense>
  );
}
const factoryEquipment = [
  {
    kind: "ASSEMBLY_LINE",
    name: "Ligne automobile",
    price: 50_000_000,
    detail: "Châssis, peinture et assemblage final",
  },
  {
    kind: "ELECTRONICS_LINE",
    name: "Ligne électronique",
    price: 25_000_000,
    detail: "Montage de cartes et ordinateurs",
  },
  {
    kind: "WOODWORK_LINE",
    name: "Atelier mobilier CNC",
    price: 12_000_000,
    detail: "Découpe et assemblage du mobilier",
  },
  {
    kind: "ROBOTICS",
    name: "Cellules robotisées",
    price: 40_000_000,
    detail: "Cadence de toutes les lignes +50 %",
  },
  {
    kind: "SOLAR_ARRAY",
    name: "Centrale photovoltaïque",
    price: 18_500_000,
    detail: "Panneaux solaires, onduleurs et autoconsommation du site",
  },
] as const;
const factoryRecipes = [
  {
    type: "VEHICLE",
    name: "Véhicule Industrium",
    equipment: "ASSEMBLY_LINE",
    unitCost: 1_800_000,
    staff: 3,
    time: "45 s/u",
  },
  {
    type: "COMPUTER",
    name: "Ordinateur professionnel",
    equipment: "ELECTRONICS_LINE",
    unitCost: 45_000,
    staff: 2,
    time: "15 s/u",
  },
  {
    type: "FURNITURE",
    name: "Mobilier de bureau",
    equipment: "WOODWORK_LINE",
    unitCost: 22_000,
    staff: 1,
    time: "20 s/u",
  },
] as const;
function FactoryManagement({
  company,
  factory,
}: {
  company: Company;
  factory: FactoryData;
}) {
  const qc = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [smartModules, setSmartModules] = useState(["Robotique", "Sécurité"]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["factory", company.id] }),
      qc.invalidateQueries({ queryKey: ["companies"] }),
    ]);
  const equipment = useMutation({
    mutationFn: (kind: string) =>
      api(`/factories/${factory.id}/equipment`, {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, kind }),
      }),
    onSuccess: refresh,
  });
  const upgrade = useMutation({
    mutationFn: () =>
      api(`/factories/${factory.id}/upgrade`, {
        method: "POST",
        body: JSON.stringify({ companyId: company.id }),
      }),
    onSuccess: refresh,
  });
  const produce = useMutation({
    mutationFn: (productType: string) =>
      api(`/factories/${factory.id}/produce`, {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, productType, quantity }),
      }),
    onSuccess: refresh,
  });
  const payroll = useMutation({
    mutationFn: () =>
      api(`/companies/${company.id}/payroll`, { method: "POST" }),
    onSuccess: refresh,
  });
  const error =
    equipment.error || upgrade.error || produce.error || payroll.error;
  const staff = factory.baseStaff + factory.employees.length;
  const currentTier = [...factoryTiers].reverse().find((tier) => factory.level >= tier.level)!;
  const nextTier = factoryTiers.find((tier) => tier.level > factory.level);
  const maxBatch = 100 + (factory.level - 1) * 20;
  const productionBonus = Math.round((Math.sqrt(factory.level) - 1) * 35);
  const solarInstalled = factory.equipment.some((item) => item.kind === "SOLAR_ARRAY");
  const solarPanels = solarInstalled ? 120 + factory.level * 40 : 0;
  const solarCapacityKw = solarPanels * .45;
  const solarHour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const sunlight = Math.max(0, Math.sin(((solarHour - 6) / 12) * Math.PI)) * .82;
  const solarProductionKw = solarCapacityKw * sunlight;
  const factoryDemandKw = 180 + factory.level * 35 + factory.equipment.length * 28;
  const selfConsumption = solarInstalled ? Math.min(100, solarProductionKw / factoryDemandKw * 100) : 0;
  const monthlySolarKwh = solarCapacityKw * 112;
  const monthlySolarSavings = monthlySolarKwh * 21;
  return (
    <section className="factoryPage">
      <div className="factoryHero advancedFactoryHero" style={{"--tier-color":currentTier.color} as React.CSSProperties}>
        <div>
          <small>UNITÉ DE PRODUCTION · {factory.city}</small>
          <h2>{factory.name}</h2>
          <p>
            Gérez les investissements, le personnel et les cycles de
            fabrication.
          </p>
          <div className="factoryTierName"><span>{factory.level}</span><div><small>CLASSE INDUSTRIELLE</small><b>{currentTier.name}</b></div></div>
        </div>
        <div className="factoryLevel">
          <span>NIVEAU</span>
          <b>{factory.level}</b>
          <button disabled={upgrade.isPending || factory.level >= 50} onClick={() => upgrade.mutate()}>
            {factory.level >= 50 ? "Niveau maximal" : `Améliorer · ${money(factory.level * 20_000_000)}`}
          </button>
        </div>
      </div>
      <section className="factoryProgression">
        <header><div><small>PROGRESSION DU SITE</small><h3>Niveau {factory.level} sur 50</h3></div><div><b>{currentTier.name}</b>{nextTier && <em>Prochain palier : {nextTier.name} · niveau {nextTier.level}</em>}</div></header>
        <div className="factoryLevelTrack"><i style={{width:`${factory.level/50*100}%`}} /></div>
        <div className="factoryRoadmap">{factoryTiers.map((tier)=><article key={tier.level} className={factory.level>=tier.level?"unlocked":"locked"}><span style={{background:tier.color}}>{tier.level}</span><div><small>NIVEAU {tier.level}</small><b>{tier.name}</b><em>{tier.benefit}</em></div><strong>{factory.level>=tier.level?"DÉBLOQUÉ":"VERROUILLÉ"}</strong></article>)}</div>
      </section>
      <section className={`solarPlant ${solarInstalled ? "online" : "offline"}`}>
        <div className="solarVisual">
          <div className="sunCore"><i /></div>
          <div className="panelField">{Array.from({length:18},(_,index)=><span key={index}><i/><i/><i/></span>)}</div>
          <div className="solarFlow"><i style={{width:`${Math.min(100,selfConsumption)}%`}} /></div>
        </div>
        <div className="solarControl">
          <small>ÉNERGIE · PHOTOVOLTAÏQUE</small><h3>Centrale solaire de {factory.name}</h3>
          <div className="solarStatus"><i />{solarInstalled ? "PRODUCTION CONNECTÉE" : "INSTALLATION REQUISE"}</div>
          <div className="solarKpis">
            <article><span>Puissance installée</span><b>{solarCapacityKw.toLocaleString("fr-FR",{maximumFractionDigits:0})} kWc</b><em>{solarPanels.toLocaleString("fr-FR")} panneaux</em></article>
            <article><span>Production actuelle</span><b>{solarProductionKw.toLocaleString("fr-FR",{maximumFractionDigits:1})} kW</b><em>ensoleillement {Math.round(sunlight*100)} %</em></article>
            <article><span>Autoconsommation</span><b>{selfConsumption.toLocaleString("fr-FR",{maximumFractionDigits:0})} %</b><em>besoin usine {factoryDemandKw} kW</em></article>
            <article><span>Économies mensuelles</span><b>{money(monthlySolarSavings)}</b><em>{monthlySolarKwh.toLocaleString("fr-FR",{maximumFractionDigits:0})} kWh produits</em></article>
            <article><span>CO₂ évité</span><b>{(monthlySolarKwh*.055/1000).toLocaleString("fr-FR",{maximumFractionDigits:1})} t</b><em>par mois</em></article>
          </div>
          {!solarInstalled && <button disabled={equipment.isPending} onClick={()=>equipment.mutate("SOLAR_ARRAY")}>Installer la centrale · {money(18_500_000)}</button>}
          {solarInstalled && <p>Le parc gagne automatiquement 40 panneaux à chaque niveau d’usine.</p>}
        </div>
      </section>
      {error && <p className="error">{error.message}</p>}
      <div className="factoryMetrics">
        <Card
          label="Personnel disponible"
          value={String(staff)}
          delta={`${factory.employees.length} salarié(s) + équipe dirigeante`}
        />
        <Card
          label="Masse salariale"
          value={money(factory.payrollCents)}
          delta="par mois"
        />
        <Card
          label="Machines installées"
          value={String(factory.equipment.length)}
          delta={`Niveau usine ${factory.level}`}
        />
        <Card label="Bonus productivité" value={`+${productionBonus}%`} delta="vitesse de fabrication" />
        <Card label="Capacité par série" value={maxBatch.toLocaleString("fr-FR")} delta="unités maximum" />
      </div>
      <div className="smartModules">
        <div>
          <small>PILOTAGE SMART FACTORY</small>
          <h3>Modules opérationnels</h3>
          <p>Activez les systèmes pour personnaliser l’exploitation du site.</p>
        </div>
        {["Robotique", "Qualité IA", "Énergie verte", "Sécurité", "Maintenance prédictive", "Jumeau numérique"].map((module, index) => {
          const active = smartModules.includes(module);
          return <button className={active ? `active module${index}` : `module${index}`} key={module} onClick={() => setSmartModules((current) => active ? current.filter((item) => item !== module) : [...current, module])}><i />{module}<span>{active ? "ACTIF" : "ACTIVER"}</span></button>;
        })}
      </div>
      <div className="factoryColumns">
        <div>
          <h3>Catalogue d’équipements</h3>
          <div className="equipmentGrid">
            {factoryEquipment.map((item) => {
              const owned = factory.equipment.some((e) => e.kind === item.kind);
              return (
                <article className={owned ? "owned" : ""} key={item.kind}>
                  <span>{owned ? "INSTALLÉ" : "INVESTISSEMENT"}</span>
                  <h4>{item.name}</h4>
                  <p>{item.detail}</p>
                  <b>{money(item.price)}</b>
                  <button
                    disabled={owned || equipment.isPending}
                    onClick={() => equipment.mutate(item.kind)}
                  >
                    {owned ? "En service" : "Acheter et installer"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
        <div className="workforce">
          <h3>Personnel et salaires</h3>
          <div className="staffBase">
            <b>Équipe dirigeante</b>
            <span>2 personnes opérationnelles</span>
          </div>
          {factory.employees.map((employee) => (
            <div className="employeeLine" key={employee.id}>
              <span className="candidateAvatar">
                {employee.user.displayName[0]}
              </span>
              <div>
                <b>{employee.user.displayName}</b>
                <small>{employee.jobOffer.title}</small>
              </div>
              <strong>{money(employee.salaryCents)}</strong>
            </div>
          ))}
          {!factory.employees.length && (
            <p>
              Publiez des offres dans l’onglet Emplois pour recruter des
              joueurs.
            </p>
          )}
          <button
            disabled={!factory.employees.length || payroll.isPending}
            onClick={() => payroll.mutate()}
          >
            Payer les salaires · {money(factory.payrollCents)}
          </button>
        </div>
      </div>
      <h3>Lancer une production</h3>
      <div className="productionControls">
        <label>
          Quantité
          <input
            type="number"
            min="1"
            max={maxBatch}
            value={quantity}
            onChange={(event) =>
              setQuantity(Math.max(1, Number(event.target.value)))
            }
          />
        </label>
        {factoryRecipes.map((recipe) => {
          const ready =
            factory.equipment.some((item) => item.kind === recipe.equipment) &&
            staff >= recipe.staff;
          return (
            <article key={recipe.type}>
              <small>
                {recipe.time} · {recipe.staff} employés requis
              </small>
              <h3>{recipe.name}</h3>
              <p>Coût : {money(recipe.unitCost * quantity)}</p>
              <button
                disabled={!ready || produce.isPending}
                onClick={() => produce.mutate(recipe.type)}
              >
                {ready
                  ? `Fabriquer ${quantity} unité(s)`
                  : !factory.equipment.some(
                        (item) => item.kind === recipe.equipment,
                      )
                    ? "Machine requise"
                    : "Personnel insuffisant"}
              </button>
            </article>
          );
        })}
      </div>
      <h3>Ordres de fabrication</h3>
      <div className="productionOrders">
        {factory.productionOrders.length ? (
          factory.productionOrders.map((order) => {
            const remaining = Math.max(
              0,
              new Date(order.completesAt).getTime() - now,
            );
            return (
              <article key={order.id}>
                <div>
                  <small>{order.productType}</small>
                  <b>
                    {order.quantity} × {order.productName}
                  </b>
                </div>
                <span className={order.status.toLowerCase()}>
                  {order.status === "COMPLETED"
                    ? "Stocké dans l’entrepôt"
                    : `Production · ${Math.floor(remaining / 60000)}m ${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}s`}
                </span>
              </article>
            );
          })
        ) : (
          <div className="emptyFleet">Aucune fabrication lancée.</div>
        )}
      </div>
    </section>
  );
}
function Jobs({ data, company }: { data: Job[]; company: Company }) {
  const qc = useQueryClient();
  const [publishing, setPublishing] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["jobs"] });
  const apply = useMutation({
    mutationFn: (id: string) =>
      api(`/job-offers/${id}/apply`, { method: "POST" }),
    onSuccess: refresh,
  });
  const publish = useMutation({
    mutationFn: (payload: {
      title: string;
      city: string;
      salaryCents: number;
    }) =>
      api(`/companies/${company.id}/job-offers`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setPublishing(false);
      refresh();
    },
  });
  const hire = useMutation({
    mutationFn: ({
      jobId,
      contractId,
    }: {
      jobId: string;
      contractId: string;
    }) =>
      api(`/job-offers/${jobId}/contracts/${contractId}/hire`, {
        method: "POST",
      }),
    onSuccess: refresh,
  });
  const submitJob = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    publish.mutate({
      title: String(values.title),
      city: String(values.city),
      salaryCents: Math.round(Number(values.salary) * 100),
    });
  };
  const error = apply.error || publish.error || hire.error;
  return (
    <section className="jobsPage">
      <div className="sectionTitle">
        <div>
          <small>MARCHÉ MULTIJOUEUR · ACTUALISATION EN DIRECT</small>
          <h2>Offres d’emploi des entreprises</h2>
        </div>
        <button
          className="publishJob"
          onClick={() => setPublishing((value) => !value)}
        >
          {publishing ? "Fermer" : "+ Publier une offre"}
        </button>
      </div>
      {publishing && (
        <form className="jobComposer" onSubmit={submitJob}>
          <label>
            Poste
            <input
              name="title"
              required
              minLength={2}
              placeholder="Responsable logistique"
            />
          </label>
          <label>
            Ville
            <input name="city" required placeholder="Lyon" />
          </label>
          <label>
            Salaire mensuel (€)
            <input
              name="salary"
              required
              type="number"
              min="1000"
              step="50"
              placeholder="3200"
            />
          </label>
          <button disabled={publish.isPending}>Publier en temps réel</button>
        </form>
      )}
      {error && <p className="error">{error.message}</p>}
      <div className="liveJobs">
        <span></span> Marché en direct · {data.length} offre(s) ouverte(s)
      </div>
      <div className="jobs">
        {data.map((j) => {
          const own = j.company.id === company.id;
          return (
            <article
              className={`card jobCard ${own ? "owned" : ""}`}
              key={j.id}
            >
              <small>
                {j.company.name} · {j.city}
              </small>
              <strong>{j.title}</strong>
              <span>{money(j.salaryCents)} / mois</span>
              <div className="applicantCount">
                {j.applicants.length} candidature(s)
              </div>
              {own ? (
                <div className="applicantList">
                  {j.applicants.length ? (
                    j.applicants.map((candidate) => (
                      <div key={candidate.id}>
                        <span className="candidateAvatar">
                          {candidate.displayName[0]}
                        </span>
                        <b>{candidate.displayName}</b>
                        <button
                          disabled={hire.isPending}
                          onClick={() =>
                            hire.mutate({
                              jobId: j.id,
                              contractId: candidate.id,
                            })
                          }
                        >
                          Embaucher
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>En attente de candidats joueurs…</p>
                  )}
                </div>
              ) : (
                <button
                  disabled={apply.isPending || j.applied}
                  onClick={() => apply.mutate(j.id)}
                >
                  {j.applied ? "Candidature envoyée ✓" : "Postuler"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
