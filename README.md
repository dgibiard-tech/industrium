# Industrium

MVP d’un MMO de gestion d’entreprise, d’industrie et de logistique. Le serveur est l’unique autorité pour l’argent, les stocks et les commandes.

## Démarrage

Prérequis : Node.js 22+, npm 10+, Docker avec Compose.

```bash
npm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Interface : http://localhost:5173
- API : http://localhost:3000/api
- Documentation API : http://localhost:3000/api/docs

Compte de démonstration : `demo@industrium.test` / `Demo123!`

## Commandes

```bash
npm run typecheck
npm test
npm run build
```

L’architecture détaillée, le modèle économique et la feuille de route sont dans [docs/architecture.md](docs/architecture.md).

## Déploiement

Pour Vercel, importer ce dépôt et choisir `apps/web` comme Root Directory. Ajouter ensuite la variable `VITE_API_URL` avec l’URL publique de l’API, terminée par `/api`. L’API NestJS, PostgreSQL et Redis doivent être hébergés séparément sur une plateforme acceptant des processus persistants, par exemple Railway.
