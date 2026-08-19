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
  product: { name: string; unit: string };
  seller: { name: string };
  warehouseStock: { warehouse: { city: string } };
};
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
          <Market company={company} data={listings.data ?? []} />
        ) : tab === "Stocks" ? (
          <Stocks company={company} />
        ) : tab === "Commandes" ? (
          <Orders data={orders.data ?? []} />
        ) : tab === "Emplois" ? (
          <Jobs company={company} data={jobs.data ?? []} />
        ) : tab === "Transport" ? (
          <Transport
            company={company}
            vehicles={vehicles.data ?? []}
            shipments={shipments.data ?? []}
            market={vehicleMarket.data ?? []}
          />
        ) : tab === "Carte" ? (
          <WorldMap shipments={shipments.data ?? []} />
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
  const maintain = useMutation({mutationFn:(vehicleId:string)=>api(`/vehicles/${vehicleId}/maintenance`,{method:"POST",body:JSON.stringify({companyId:company.id})}),onSuccess:refresh});
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
    maintain.error;
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
                <div><dt>Prix d’achat</dt><dd>{money(v.purchasePriceCents)}</dd></div>
                <div><dt>Valeur actuelle</dt><dd>{money(v.currentValueCents)}</dd></div>
                <div><dt>Mise en circulation</dt><dd>{new Date(v.createdAt).toLocaleDateString("fr-FR")}</dd></div>
                <div><dt>Kilométrage</dt><dd>{Number(v.mileageKm).toLocaleString("fr-FR")} km</dd></div>
                <div><dt>Dernier entretien</dt><dd>{v.lastMaintenanceAt ? new Date(v.lastMaintenanceAt).toLocaleDateString("fr-FR") : "Jamais"}</dd></div>
                <div><dt>Entretiens</dt><dd>{v.maintenanceCount}</dd></div>
              </dl>
              <div className="condition">
                <span style={{ width: `${v.condition}%` }}></span>
              </div>
              <footer>
                <b>{v.condition}% état</b>
                <em className={v.status.toLowerCase()}>{v.status}</em>
              </footer>
              {v.status === "AVAILABLE" && <button className="maintainVehicle" disabled={maintain.isPending||v.condition===100} onClick={()=>maintain.mutate(v.id)}>Entretien · {money(Math.max(50_000,(100-v.condition)*50_000))}</button>}
              {v.marketListings.length ? <div className="salePublished">En vente · {money(v.marketListings[0].askingPriceCents)}</div> : v.status === "AVAILABLE" && (selling === v.id ? <div className="sellEditor"><input autoFocus type="number" min="1000" step="100" value={salePrice} onChange={(event)=>setSalePrice(event.target.value)} placeholder={String(Math.round(Number(v.currentValueCents)/100))}/><button disabled={!salePrice||listVehicle.isPending} onClick={()=>listVehicle.mutate({vehicleId:v.id,askingPriceCents:Math.round(Number(salePrice)*100)})}>Publier</button><button className="cancelSale" onClick={()=>setSelling(null)}>×</button></div> : <button className="sellVehicle" onClick={()=>{setSelling(v.id);setSalePrice(String(Math.round(Number(v.currentValueCents)/100)))}}>Revendre sur le marché</button>)}
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
        {market.filter(listing=>listing.seller.id!==company.id).length ? market.filter(listing=>listing.seller.id!==company.id).map(listing=><article key={listing.id}><img src={vehicleImage(listing.vehicle.model)} alt={listing.vehicle.model}/><div><small>{listing.seller.name} · {listing.seller.headquarters}</small><h3>{listing.vehicle.model}</h3><p>{listing.vehicle.registration} · {Number(listing.vehicle.mileageKm).toLocaleString("fr-FR")} km · état {listing.vehicle.condition}%</p><dl><span>Valeur estimée <b>{money(listing.currentValueCents)}</b></span><span>Prix vendeur <strong>{money(listing.askingPriceCents)}</strong></span></dl><button disabled={buyUsed.isPending} onClick={()=>buyUsed.mutate(listing.id)}>Acheter ce véhicule</button></div></article>) : <div className="emptyFleet">Aucun véhicule proposé actuellement par une autre entreprise.</div>}
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
function WorldMap({ shipments }: { shipments: Shipment[] }) {
  return (
    <Suspense
      fallback={<div className="empty">Initialisation du monde 3D…</div>}
    >
      <IndustrialMap3D shipments={shipments} />
    </Suspense>
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
