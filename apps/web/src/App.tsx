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
    stocks: {
      id: string;
      quantity: string;
      reservedQuantity: string;
      product: { name: string; unit: string };
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
};
type EconomyQuote={product:{id:string;name:string;category:string;unit:string};referencePriceCents:string;changePercent:number;supply:number;demand:number;stock:number;production24:number;sold24:number;trend:"UP"|"DOWN"|"STABLE"};
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
    queryFn: () => api<any[]>("/orders"),
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
          <Stocks company={company} />
        ) : tab === "Commandes" ? (
          <Orders data={orders.data ?? []} />
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
          />
        ) : tab === "Carte" ? (
          <WorldMap shipments={shipments.data ?? []} onNavigate={setTab} />
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
      <div className="marketCards">{data.map(l=>{const quote=economy.find(q=>q.product.id===l.product.id),max=Math.floor(Number(l.quantity)),quantity=Math.min(max,quantities[l.id]??1),priceEuros=offerPrices[l.id]??String(Math.round(Number(quote?.referencePriceCents??l.unitPriceCents)/100));return <article key={l.id}><header><div><small>{l.product.category??"PRODUIT INDUSTRIEL"}</small><h3>{l.product.name}</h3></div><strong>{money(l.unitPriceCents)}<em>/{l.product.unit}</em></strong></header>{quote&&<div className={`marketQuote ${quote.trend.toLowerCase()}`}><span>Cours dynamique</span><b>{money(quote.referencePriceCents)}</b><em>{quote.trend==="UP"?"▲":quote.trend==="DOWN"?"▼":"●"} {quote.changePercent>0?"+":""}{quote.changePercent}%</em></div>}<div className="marketOrigin"><span>{l.seller.name}</span><b>{l.warehouseStock.warehouse.city}</b><span>Stock : {l.quantity} {l.product.unit}</span></div><label>Quantité à acheter<input type="number" min="1" max={max} value={quantity} onChange={event=>setQuantities({...quantities,[l.id]:Math.max(1,Math.min(max,Number(event.target.value)))})}/></label><div className="marketTotal"><span>Total au tarif affiché</span><b>{money(BigInt(l.unitPriceCents)*BigInt(quantity))}</b></div><button disabled={buy.isPending||l.seller.id===company.id} onClick={()=>buy.mutate({id:l.id,quantity})}>{l.seller.id===company.id?"Votre offre":"Acheter immédiatement"}</button>{l.seller.id!==company.id&&<div className="priceProposal"><label>Votre prix unitaire conseillé (€)<input type="number" min="1" value={priceEuros} onChange={event=>setOfferPrices({...offerPrices,[l.id]:event.target.value})}/></label><button disabled={propose.isPending} onClick={()=>propose.mutate({id:l.id,quantity,price:Number(priceEuros)})}>Proposer ce prix</button></div>}</article>})}</div>
      {(received.length>0||sent.length>0)&&<div className="negotiations"><div><h3>Propositions reçues</h3>{received.length?received.map(p=><article key={p.id}><div><b>{p.buyer.name}</b><span>{p.quantity} {p.listing.product.unit} de {p.listing.product.name}</span></div><strong>{money(p.proposedUnitPriceCents)} / unité</strong><button onClick={()=>resolve.mutate({id:p.id,action:"accept"})}>Accepter</button><button className="reject" onClick={()=>resolve.mutate({id:p.id,action:"reject"})}>Refuser</button></article>):<p>Aucune proposition en attente.</p>}</div><div><h3>Vos propositions</h3>{sent.length?sent.slice(0,8).map(p=><article key={p.id}><div><b>{p.listing.product.name}</b><span>{p.quantity} unité(s) · {p.listing.seller.name}</span></div><strong>{money(p.proposedUnitPriceCents)}</strong><em className={p.status.toLowerCase()}>{p.status}</em></article>):<p>Aucune proposition envoyée.</p>}</div></div>}
    </section>
  );
}
function Stocks({ company }: { company: Company }) {
  return (
    <section>
      {company.warehouses.map((w) => (
        <div key={w.name}>
          <div className="sectionTitle">
            <div>
              <small>ENTREPÔT</small>
              <h2>{w.name}</h2>
            </div>
          </div>
          <div className="table">
            {w.stocks.map((s) => (
              <div className="tr stock" key={s.id}>
                <b>{s.product.name}</b>
                <span>
                  Total {s.quantity} {s.product.unit}
                </span>
                <span>Réservé {s.reservedQuantity}</span>
                <strong>
                  Disponible {Number(s.quantity) - Number(s.reservedQuantity)}
                </strong>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
function Orders({ data }: { data: any[] }) {
  return (
    <section>
      <div className="sectionTitle">
        <div>
          <small>REGISTRE</small>
          <h2>Commandes</h2>
        </div>
      </div>
      <div className="table">
        {data.map((o) => (
          <div className="tr stock" key={o.id}>
            <b>{o.items[0]?.product.name}</b>
            <span>
              {o.buyer.name} → {o.seller.name}
            </span>
            <span>{o.quantity} unités</span>
            <strong>{money(o.totalCents)}</strong>
          </div>
        ))}
      </div>
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
}: {
  company: Company;
  vehicles: Vehicle[];
  shipments: Shipment[];
  market: VehicleMarketListing[];
}) {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [selling, setSelling] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState("");
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
                <small>{s.reference}</small>
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
  return (
    <section className="factoryPage">
      <div className="factoryHero">
        <div>
          <small>UNITÉ DE PRODUCTION · {factory.city}</small>
          <h2>{factory.name}</h2>
          <p>
            Gérez les investissements, le personnel et les cycles de
            fabrication.
          </p>
        </div>
        <div className="factoryLevel">
          <span>NIVEAU</span>
          <b>{factory.level}</b>
          <button disabled={upgrade.isPending} onClick={() => upgrade.mutate()}>
            Améliorer · {money(factory.level * 20_000_000)}
          </button>
        </div>
      </div>
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
            max="100"
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
