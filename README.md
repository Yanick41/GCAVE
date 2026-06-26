# SGC — Système de Gestion Clients & Facturation

Application web bilingue (FR/EN) de gestion clients et de commandes avec calcul en
temps réel. Réf. CDC-GC-2025-001. Plan détaillé : [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Architecture (monorepo npm workspaces)

| Package | Rôle | Stack |
|---|---|---|
| `shared/` | Moteur de calcul + schémas Zod (source de vérité unique) | TypeScript |
| `server/` | API REST | Express + Prisma + PostgreSQL (Neon) + JWT |
| `client/` | Interface | React 19 + Vite + Tailwind v4 + react-i18next |

## Prérequis
- Node.js ≥ 20 (testé sur 24)
- Un projet PostgreSQL gratuit sur [Neon.tech](https://neon.tech)

## Démarrage

```bash
# 1. Installer toutes les dépendances (depuis la racine)
npm install

# 2. Configurer le backend
cp server/.env.example server/.env       # puis renseigner DATABASE_URL (Neon) + JWT_SECRET
cp client/.env.example client/.env

# 3. Initialiser la base
cd server
npm run prisma:migrate -- --name init    # crée les tables
npm run seed                              # données de démo (admin@gca.local / admin1234)
cd ..

# 4. Lancer client + serveur en parallèle
npm run dev                              # client :5173  ·  API :3000
```

Vérifier : ouvrir http://localhost:5173 — la carte « État du système » doit afficher
API et Base de données **En ligne**, et le sélecteur FR/EN doit basculer la langue.

## Scripts utiles
- `npm run dev` — client + serveur (concurrently)
- `npm run dev:server` / `npm run dev:client` — séparément
- `npm run typecheck` — typecheck de tous les workspaces
- `cd server && npm run prisma:studio` — explorateur de base de données

## Déploiement (cible 0 €/mois)
- **DB** : Neon (free) · **API** : Render Free ou Fly.io · **Client** : Vercel (free)
- Voir IMPLEMENTATION_PLAN.md §5 (Sprint 6) pour la procédure.
