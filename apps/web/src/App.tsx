import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, money } from "./api";
import { useSession } from "./store";
type Company = {
  id: string;
  name: string;
  sector: string;
  account: { balanceCents: string };
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
  product: { name: string; unit: string };
  seller: { name: string };
  warehouseStock: { warehouse: { city: string } };
};
type Job = {
  id: string;
  title: string;
  salaryCents: string;
  city: string;
  company: { name: string };
};
type Vehicle = { id:string; registration:string; model:string; type:string; capacityKg:string; mileageKm:string; condition:number; status:"AVAILABLE"|"ASSIGNED"|"MAINTENANCE" };
type Shipment = { id:string; reference:string; cargoName:string; weightKg:string; originCity:string; destinationCity:string; distanceKm:number; rewardCents:string; status:"OPEN"|"ASSIGNED"|"IN_TRANSIT"|"DELIVERED"; progressPercent:number; carrier?:{name:string}; vehicle?:Vehicle };
const nav = [
  "Vue d’ensemble",
  "Marché mondial",
  "Stocks",
  "Commandes",
  "Emplois",
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
  });
  const listings = useQuery({
    queryKey: ["listings"],
    queryFn: () => api<Listing[]>("/market/listings"),
  });
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<any[]>("/orders"),
  });
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api<Job[]>("/job-offers"),
  });
  const vehicles = useQuery({ queryKey:["vehicles"], queryFn:()=>api<Vehicle[]>("/vehicles") });
  const shipments = useQuery({ queryKey:["shipments"], queryFn:()=>api<Shipment[]>("/shipments") });
  const company = companies.data?.[0];
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
          </div>
        </header>
        {!company ? (
          <CreateCompany />
        ) : tab === "Marché mondial" ? (
          <Market company={company} data={listings.data ?? []} />
        ) : tab === "Stocks" ? (
          <Stocks company={company} />
        ) : tab === "Commandes" ? (
          <Orders data={orders.data ?? []} />
        ) : tab === "Emplois" ? (
          <Jobs data={jobs.data ?? []} />
        ) : tab === "Transport" ? (
          <Transport company={company} vehicles={vehicles.data??[]} shipments={shipments.data??[]} />
        ) : tab === "Carte" ? (
          <WorldMap shipments={shipments.data??[]} />
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
  onNavigate:(tab:string)=>void;
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
            <button onClick={()=>onNavigate("Transport")}>▦ Gérer la flotte</button>
            <button className="secondary" onClick={()=>onNavigate("Carte")}>⌖ Ouvrir la carte</button>
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
function Market({ company, data }: { company: Company; data: Listing[] }) {
  const qc = useQueryClient();
  const buy = useMutation({
    mutationFn: (id: string) =>
      api(`/market/listings/${id}/buy`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ buyerCompanyId: company.id, quantity: 1 }),
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["listings"] }),
        qc.invalidateQueries({ queryKey: ["companies"] }),
        qc.invalidateQueries({ queryKey: ["orders"] }),
      ]),
  });
  return (
    <section>
      <div className="sectionTitle">
        <div>
          <small>CARNET D’OFFRES</small>
          <h2>Matières & produits</h2>
        </div>
        <span>{data.length} offres actives</span>
      </div>
      <div className="table">
        <div className="tr head">
          <span>Produit</span>
          <span>Vendeur</span>
          <span>Origine</span>
          <span>Disponible</span>
          <span>Prix unitaire</span>
          <span></span>
        </div>
        {data.map((l) => (
          <div className="tr" key={l.id}>
            <b>{l.product.name}</b>
            <span>{l.seller.name}</span>
            <span>{l.warehouseStock.warehouse.city}</span>
            <span>
              {l.quantity} {l.product.unit}
            </span>
            <strong>{money(l.unitPriceCents)}</strong>
            <button disabled={buy.isPending} onClick={() => buy.mutate(l.id)}>
              Acheter 1
            </button>
          </div>
        ))}
      </div>
      {buy.error && <p className="error">{buy.error.message}</p>}
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
function Transport({company,vehicles,shipments}:{company:Company;vehicles:Vehicle[];shipments:Shipment[]}){
  const qc=useQueryClient();
  const refresh=()=>Promise.all([qc.invalidateQueries({queryKey:["vehicles"]}),qc.invalidateQueries({queryKey:["shipments"]}),qc.invalidateQueries({queryKey:["companies"]})]);
  const buy=useMutation({mutationFn:()=>api("/vehicles/buy-truck",{method:"POST",body:JSON.stringify({companyId:company.id})}),onSuccess:refresh});
  const assign=useMutation({mutationFn:({shipmentId,vehicleId}:{shipmentId:string;vehicleId:string})=>api(`/shipments/${shipmentId}/assign`,{method:"POST",body:JSON.stringify({companyId:company.id,vehicleId})}),onSuccess:refresh});
  const advance=useMutation({mutationFn:(shipmentId:string)=>api(`/shipments/${shipmentId}/advance`,{method:"POST",body:JSON.stringify({companyId:company.id})}),onSuccess:refresh});
  const available=vehicles.filter(v=>v.status==="AVAILABLE");
  const active=shipments.filter(s=>s.carrier?.name===company.name&&s.status!=="DELIVERED");
  const open=shipments.filter(s=>s.status==="OPEN");
  const error=buy.error||assign.error||advance.error;
  return <section className="transportPage"><div className="fleetHeader"><div><small>DIVISION LOGISTIQUE</small><h2>Centre de transport</h2><p>Gérez votre flotte et exécutez des contrats de fret en temps réel.</p></div><button onClick={()=>buy.mutate()} disabled={buy.isPending}>+ Acheter un Atlas TX 480 · 125 000 €</button></div><div className="transportMetrics"><Card label="Véhicules" value={String(vehicles.length)} delta={`${available.length} disponible(s)`}/><Card label="Missions actives" value={String(active.length)} delta="Opérations en cours"/><Card label="Contrats ouverts" value={String(open.length)} delta="Marché européen"/></div>{error&&<p className="error">{error.message}</p>}<h3>Flotte de l’entreprise</h3><div className="vehicleRow">{vehicles.length?vehicles.map(v=><article className="vehicleCard" key={v.id}><div className="truckVisual"><span>▰</span><i>● ●</i></div><small>{v.registration}</small><h3>{v.model}</h3><p>{v.type} · {Number(v.capacityKg)/1000} t</p><div className="condition"><span style={{width:`${v.condition}%`}}></span></div><footer><b>{v.condition}% état</b><em className={v.status.toLowerCase()}>{v.status}</em></footer></article>):<div className="emptyFleet">Aucun véhicule. Achetez votre premier camion pour accepter une mission.</div>}</div>{active.length>0&&<><h3>Convois en cours</h3><div className="activeConvoys">{active.map(s=><article key={s.id}><div><small>{s.reference} · {s.vehicle?.registration}</small><b>{s.originCity} → {s.destinationCity}</b><span>{s.cargoName} · {Number(s.weightKg)/1000} t</span></div><div className="routeProgress"><i style={{width:`${s.progressPercent}%`}}></i><span>{s.progressPercent}%</span></div><button disabled={advance.isPending} onClick={()=>advance.mutate(s.id)}>{s.progressPercent===75?"Confirmer la livraison":"Avancer de 25%"}</button></article>)}</div></>}<h3>Bourse de fret</h3><div className="missionGrid">{open.map(s=>{const truck=available.find(v=>Number(v.capacityKg)>=Number(s.weightKg));return <article className="missionCard" key={s.id}><div className="missionRef"><small>{s.reference}</small><b>{money(s.rewardCents)}</b></div><h3>{s.originCity} <span>→</span> {s.destinationCity}</h3><p>{s.cargoName}</p><dl><div><dt>Distance</dt><dd>{s.distanceKm.toLocaleString("fr-FR")} km</dd></div><div><dt>Charge</dt><dd>{Number(s.weightKg)/1000} t</dd></div></dl><button disabled={!truck||assign.isPending} onClick={()=>truck&&assign.mutate({shipmentId:s.id,vehicleId:truck.id})}>{truck?`Accepter avec ${truck.registration}`:"Aucun camion compatible"}</button></article>})}</div></section>
}
function WorldMap({shipments}:{shipments:Shipment[]}){
  const active=shipments.filter(s=>s.status==="IN_TRANSIT"||s.status==="ASSIGNED");
  return <section className="mapPage"><div className="mapToolbar"><div><small>RÉSEAU EUROPÉEN</small><h2>Carte des opérations</h2></div><div><span className="legend orange"></span> Convoi actif <span className="legend white"></span> Hub logistique</div></div><div className="europeMap"><div className="mapGrid"></div><span className="city paris">PARIS<i></i></span><span className="city lyon">LYON<i></i></span><span className="city berlin">BERLIN<i></i></span><span className="city gdansk">GDAŃSK<i></i></span><span className="city turin">TURIN<i></i></span><span className="city grenoble">GRENOBLE<i></i></span><div className="route routeOne"></div><div className="route routeTwo"></div>{active.map((s,index)=><div key={s.id} className={`movingTruck truck${index%2}`}><b>▰</b><span>{s.reference}<small>{s.progressPercent}% · {s.destinationCity}</small></span></div>)}<div className="mapPanel"><small>SITUATION RÉSEAU</small><strong>{active.length} convois actifs</strong><span>{shipments.filter(s=>s.status==="OPEN").length} contrats disponibles</span><span>Trafic européen fluide</span></div></div></section>
}
function Jobs({ data }: { data: Job[] }) {
  const qc = useQueryClient();
  const apply = useMutation({
    mutationFn: (id: string) =>
      api(`/job-offers/${id}/apply`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
  return (
    <section>
      <div className="sectionTitle">
        <div>
          <small>CARRIÈRES</small>
          <h2>Offres d’emploi</h2>
        </div>
      </div>
      <div className="jobs">
        {data.map((j) => (
          <article className="card" key={j.id}>
            <small>
              {j.company.name} · {j.city}
            </small>
            <strong>{j.title}</strong>
            <span>{money(j.salaryCents)} / mois</span>
            <button onClick={() => apply.mutate(j.id)}>Postuler</button>
          </article>
        ))}
      </div>
    </section>
  );
}
