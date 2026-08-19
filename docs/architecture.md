# Architecture et plan produit

## Découpage cible

Le produit commence comme un **monolithe modulaire** NestJS : les règles métier restent faciles à faire évoluer et les transactions SQL traversent les modules sans introduire trop tôt la complexité de microservices. Les frontières (`identity`, `companies`, `market`, `inventory`, `workforce`, puis `production` et `logistics`) sont toutefois explicites. Les modules à forte charge pourront ensuite être extraits derrière des événements versionnés.

```text
Navigateur React
  ├─ REST (commandes, lectures paginées)
  └─ WebSocket (notifications et mises à jour du marché)
        │
API NestJS — autorité serveur
  ├─ Identity / RBAC
  ├─ Companies / Workforce
  ├─ Market / Orders / Ledger
  ├─ Inventory / Warehouses
  ├─ Production (v0.3)
  └─ Logistics (v0.2)
        ├─ PostgreSQL (source de vérité)
        ├─ Redis (cache, rate-limit, présence)
        └─ BullMQ workers (ticks économiques et tâches longues)
```

PostgreSQL est la source de vérité. Redis ne détient jamais seul un solde ou un stock. Les événements transactionnels sont écrits dans une table outbox dans la même transaction que le changement métier, puis publiés par un worker. Cela permet le temps réel et, plus tard, plusieurs instances API sans double traitement.

## Arborescence

```text
apps/
  api/                 API NestJS, Prisma, règles métier, seed et tests
  web/                 React/Vite, React Query, Zustand, Tailwind
packages/
  contracts/           DTO et types partagés sans logique serveur
docs/                  décisions d’architecture et modèle produit
docker-compose.yml     PostgreSQL et Redis locaux
```

## Modèle PostgreSQL

Les tables v0.1 sont implémentées dans Prisma : `users`, `refresh_tokens`, `companies`, `company_members`, `job_offers`, `employee_contracts`, `bank_accounts`, `ledger_transactions`, `products`, `warehouses`, `warehouse_stocks`, `stock_movements`, `market_listings`, `orders`, `order_items`, `notifications`, `audit_logs` et `outbox_events`.

Contraintes essentielles : montants en centimes (`BIGINT`), quantités en `Decimal`, clés d’idempotence uniques, versions de lignes pour le verrouillage optimiste, relations explicites, et ledger en partie double. Le solde mis en cache sur un compte ne peut changer qu’avec des écritures de ledger équilibrées.

Le modèle cible ajoute : monde (`Country`, `Region`, `City`, hubs), actifs (`Land`, `Building`, `Vehicle`, `Machine`), production (`Factory`, `ProductionLine`, `Recipe`, `ProductionOrder`), transport (`Shipment`, `RouteLeg`, `ShipmentVehicle`), finance (`Loan`, `Invoice`, `Contract`), technologie (`Technology`, `ResearchProject`) et énergie. Les données géographiques et les recettes sont configurables, jamais codées dans les composants.

## API v1

Toutes les mutations acceptent un en-tête `Idempotency-Key`. Les listes sont paginées par curseur.

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- `GET /me`, `GET/POST /companies`, `GET /companies/:id`
- `GET/POST /companies/:id/members`, `GET/POST /companies/:id/job-offers`
- `POST /job-offers/:id/apply`, `POST /contracts/:id/accept|resign|terminate`
- `GET /products`, `GET/POST /market/listings`, `DELETE /market/listings/:id`
- `POST /market/listings/:id/buy`, `GET /orders`, `GET /orders/:id`
- `GET/POST /companies/:id/warehouses`, `GET /warehouses/:id/stocks`
- `GET /companies/:id/ledger`, `GET /companies/:id/dashboard`
- cible : `/production-orders`, `/shipments`, `/vehicles`, `/world`, `/research`

Chaque route d’entreprise vérifie l’appartenance et une permission (`COMPANY_ADMIN`, `FINANCE_WRITE`, `MARKET_TRADE`, `INVENTORY_WRITE`, `HR_WRITE`).

## Économie

Le prix affiché est issu du carnet d’offres réel. Un indice régional lissé est calculé en tâche de fond à partir du prix médian pondéré, du volume, des stocks disponibles, de la demande non satisfaite, du coût d’énergie et des importations. L’indice guide les PNJ mais ne remplace jamais le prix négocié entre joueurs.

Un achat est une unique transaction sérialisable : verrouillage de l’offre et des deux comptes, validation de la quantité, débit/crédit en ledger, décrément de l’offre, transfert ou réservation du stock, création de la commande, audit et événement outbox. Une clé d’idempotence empêche un double paiement après retry. Aucun nombre financier fourni par le navigateur n’est accepté comme vérité.

## Stocks

Le stock est attaché à `(warehouse, product, quality)` avec `quantity`, `reservedQuantity` et `version`. Toute variation possède un `StockMovement` immuable : `IN`, `OUT`, `TRANSFER`, `RESERVATION`, `RELEASE`, `SHIPMENT`, `ADJUSTMENT`. La quantité disponible est `quantity - reservedQuantity` et ne peut jamais être négative. Les transferts futurs créeront deux mouvements corrélés ; une marchandise expédiée reste dans un stock `IN_TRANSIT` jusqu’à réception.

## Production

Une recette versionnée contient entrées, sorties, temps, énergie et machines requises. Le démarrage d’un lot réserve atomiquement toutes les entrées. Le worker consomme les réservations à la fin du lot et crédite les sorties ; panne ou énergie insuffisante suspend le lot sans créer de matière. La capacité dépend de la ligne, des machines, des compétences, de l’énergie et de la maintenance.

## Transport

Une vente nécessitant livraison crée une expédition et une suite de segments route/rail/mer/air. Le planificateur calcule capacité, masse, volume, contraintes produit, coût, taxes et ETA. Chaque segment possède son transporteur et une machine à états. La réception du dernier segment libère le stock en transit au destinataire. Les changements sont idempotents et produits par jobs, jamais par une boucle client.

## Multijoueur et montée en charge

REST sert les intentions ; WebSocket diffuse seulement les projections autorisées. Les salons sont segmentés par utilisateur, entreprise et région. À 100 joueurs, une API et un worker suffisent. À 1 000, instances stateless et workers séparés. À 10 000+, partitions régionales, read replicas, projections dédiées et extraction du marché/logistique via l’outbox. Les ticks sont différentiels et distribués, pas un balayage permanent du monde.

## Étapes exactes

1. **v0.1 jouable** : compte/JWT, entreprise, trésorerie initiale, catalogue, entrepôt, stocks, annonces, achat atomique, commandes, offres d’emploi et contrats, dashboard et seed actif.
2. **v0.2** : carte, véhicules, conducteurs, expéditions routières, suivi temps réel et pannes.
3. **v0.3** : usines, recettes versionnées, machines, énergie et jobs de production.
4. **v0.4** : pays, douanes, transport multimodal et import/export.
5. **v0.5** : R&D, technologies, banques, faillite, concurrence et indice économique avancé.
6. **v1.0** : équilibrage, anti-abus, observabilité, exploitation multi-région et contenu commercial.

## Sécurité et exploitation

Argon2 pour les mots de passe, refresh tokens hachés et rotatifs, JWT courts, validation stricte, Helmet, CORS explicite, rate limiting, permissions serveur, journal d’audit et secrets hors dépôt. Les métriques suivent erreurs, latence, retard outbox, déséquilibre ledger et invariants de stock. Sauvegardes PostgreSQL et restauration sont testées avant toute production.
