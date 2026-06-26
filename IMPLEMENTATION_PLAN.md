# Plan d'Implémentation — Système de Gestion Clients (SGC)

> **Source** : CDC-GC-2025-001 v1.0 (Yanick Doba, Juin 2025)
> **Ce document** : plan d'implémentation + approche étape par étape, du setup au déploiement.
> **Langue de l'app** : bilingue **EN / FR** (français par défaut).
> **Monnaie** : **FCFA (XOF/XAF)** — formatage via `Intl.NumberFormat`.
> **Statut** : document de référence pour tout le développement. À mettre à jour à chaque sprint.

---

## 0. Résumé de la décision technique

Le CDC recommande **React + Vite + Express + PostgreSQL/Neon + Prisma + JWT**. Les dossiers
`client/` et `server/` déjà créés confirment une **architecture séparée frontend / backend**.
Je conserve ce choix car il est sain, modulaire et correspond au CDC. J'optimise **à l'intérieur**
de cette architecture pour le coût et la performance.

### Stack retenu (le moins coûteux + performant)

| Couche | Techno retenue | Pourquoi (coût / perf) |
|---|---|---|
| **Frontend** | React 18 + **Vite** + **TypeScript** + **Tailwind CSS** | Build ultra-rapide, bundle léger, calcul temps réel via `useState`/`useMemo` |
| Composants UI | **shadcn/ui** (Radix + Tailwind) | Gratuit, copié dans le repo (pas de dépendance lourde), accessible |
| i18n | **react-i18next** + `i18next-browser-languagedetector` | Standard React, lazy-load des traductions, switch EN/FR instantané |
| État serveur | **TanStack Query** (React Query) | Cache, refetch, pas de Redux → moins de code, plus rapide |
| Formulaires | **React Hook Form** + **Zod** | Validation typée partagée client/serveur, perf (peu de re-renders) |
| Graphiques | **Recharts** | Léger, suffisant pour la courbe de tendance CA |
| Export PDF | **jsPDF** + **jspdf-autotable** | Génération **côté client** → zéro coût serveur (cf. CDC NF Export) |
| **Backend** | **Node.js + Express** + **TypeScript** | API REST légère, déploiement simple |
| ORM | **Prisma** | Schéma typé, migrations simples, compatible Neon (conforme CDC) |
| Base de données | **PostgreSQL — Neon.tech** (free tier serverless) | Gratuit, scale-to-zero, fiable |
| Auth | **JWT** (`jsonwebtoken`) + `bcrypt` (hash mot de passe) | Stateless, conforme CDC |
| Validation API | **Zod** (schémas partagés via dossier `shared/`) | Une seule source de vérité pour les règles |
| **Déploiement** | Front → **Vercel** (gratuit) · API → **Render** (free) ou **Fly.io** · DB → **Neon** | Coût cible : **0 €/mois** |

> ⚠️ **Note coût hébergement** : Railway (cité dans le CDC) n'a plus de plan gratuit permanent.
> Pour l'API, utiliser **Render Free** (s'endort après 15 min d'inactivité, réveil ~30 s) ou
> **Fly.io** (petite VM gratuite, pas de sommeil). Neon + Vercel restent gratuits.
>
> 💡 **Alternative la moins chère en absolu** : tout fusionner dans **un seul projet Next.js**
> (API via Route Handlers) déployé sur Vercel free + Neon → un seul service, 0 €, pas de cold start
> backend. On ne la retient PAS ici car la structure `client/`+`server/` impose la séparation, mais
> c'est l'option à considérer si le coût/cold-start devient un problème.

### Performances ciblées (CDC §4)
- Calcul temps réel **< 50 ms** : tout le calcul des totaux se fait **côté client en mémoire**
  (`useMemo`), aucune requête réseau par frappe. Le réseau n'intervient qu'à la **validation**.
- Sauvegarde auto toutes les 30 s : brouillon de commande persisté en `localStorage` + PATCH
  optionnel vers l'API.

---

## 1. Architecture cible

```
Gestion client GCA/
├─ client/                 # React + Vite (déploie sur Vercel)
│  ├─ src/
│  │  ├─ app/              # routing, providers (Query, i18n, Auth)
│  │  ├─ features/         # clients/ commandes/ historique/ dashboard/ auth/
│  │  ├─ components/ui/    # shadcn/ui
│  │  ├─ lib/              # api client (axios), money.ts, pdf.ts
│  │  ├─ locales/          # en/ fr/  (fichiers JSON de traduction)
│  │  └─ hooks/
│  └─ ...
├─ server/                 # Express + Prisma (déploie sur Render/Fly)
│  ├─ src/
│  │  ├─ modules/          # auth/ clients/ commandes/ dashboard/
│  │  │   └─ <mod>/{routes,controller,service}.ts
│  │  ├─ middleware/       # auth(JWT), error, validate(Zod)
│  │  ├─ lib/prisma.ts
│  │  └─ index.ts
│  └─ prisma/schema.prisma
├─ shared/                 # types + schémas Zod partagés (calcul, DTOs)
├─ IMPLEMENTATION_PLAN.md  # ce fichier
└─ README.md
```

### Flux du calcul temps réel (cœur — Module B)
1. La saisie de commande vit **100 % côté client** (tableau de lignes en state React).
2. `totalLigne = quantite × prixUnitaire` (recalcul `useMemo` par ligne).
3. `sousTotal = Σ totauxLignes`.
4. `montantRemise = remiseType==='pct' ? sousTotal × pct/100 : montantFixe`.
5. `totalTTC = sousTotal − montantRemise` (jamais < 0).
6. **À la validation seulement** → POST `/api/commandes` avec recalcul serveur (sécurité : ne jamais
   faire confiance aux totaux envoyés par le client → le serveur **recalcule** et persiste).

---

## 2. Modèle de données (Prisma)

Conforme au CDC §5.2, avec suppression logique (archivage) et statut commande.

```prisma
model Utilisateur {
  id           String   @id @default(cuid())
  nom          String
  email        String   @unique
  passwordHash String
  role         Role     @default(OPERATEUR)
  commandes    Commande[]
  createdAt    DateTime @default(now())
}

model Client {
  id        String    @id @default(cuid())
  nom       String
  telephone String
  email     String?
  adresse   String?
  archived  Boolean   @default(false)   // F-A04 suppression logique
  commandes Commande[]
  createdAt DateTime  @default(now())
  @@index([nom])
  @@index([telephone])
}

model Commande {
  id            String          @id @default(cuid())
  numero        String          @unique          // ex CMD-2025-000123
  clientId      String?
  client        Client?         @relation(fields: [clientId], references: [id])
  clientNomLibre String?                          // client occasionnel (F-B01)
  utilisateurId String
  utilisateur   Utilisateur     @relation(fields: [utilisateurId], references: [id])
  lignes        LigneCommande[]
  remiseType    RemiseType      @default(AUCUNE)  // AUCUNE | POURCENTAGE | MONTANT
  remiseValeur  Decimal         @default(0)   @db.Decimal(12,2)
  sousTotal     Decimal         @db.Decimal(12,2)
  montantRemise Decimal         @db.Decimal(12,2)
  totalTTC      Decimal         @db.Decimal(12,2)
  statut        StatutCommande  @default(BROUILLON)
  date          DateTime        @default(now())
  @@index([clientId])
  @@index([date])
}

model LigneCommande {
  id           String   @id @default(cuid())
  commandeId   String
  commande     Commande @relation(fields: [commandeId], references: [id], onDelete: Cascade)
  nomProduit   String
  quantite     Decimal  @db.Decimal(12,3)
  prixUnitaire Decimal  @db.Decimal(12,2)
  totalLigne   Decimal  @db.Decimal(12,2)
}

enum Role            { ADMIN MANAGER OPERATEUR }
enum RemiseType      { AUCUNE POURCENTAGE MONTANT }
enum StatutCommande  { BROUILLON VALIDEE ANNULEE }
```

> **Argent en `Decimal`** (jamais `Float`) pour éviter les erreurs d'arrondi FCFA.
> Le FCFA n'a pas de centimes → arrondir à l'entier à l'affichage, garder la précision en base.

---

## 3. API REST (server) — contrat

| Méthode & route | Fonction CDC | Notes |
|---|---|---|
| `POST /api/auth/login` | E01 / NF Sécurité | renvoie JWT |
| `GET /api/auth/me` | session | middleware JWT |
| `GET /api/clients?q=` | F-A03 | recherche nom/téléphone, exclut archivés |
| `POST /api/clients` | F-A01 | |
| `PATCH /api/clients/:id` | F-A02 | |
| `DELETE /api/clients/:id` | F-A04 | archivage logique |
| `GET /api/clients/:id` | F-A05 | infos + commandes + total cumulé |
| `POST /api/commandes` | F-B09 | **recalcul serveur**, génère `numero` |
| `GET /api/commandes` | F-C01/F-C03 | pagination + filtres (client, période, montant, statut) |
| `GET /api/commandes/:id` | F-C02 | détail lignes |
| `PATCH /api/commandes/:id` | F-C04 | si `statut=BROUILLON` |
| `DELETE /api/commandes/:id` | F-C05 | confirmation côté client |
| `GET /api/dashboard?periode=` | F-E01..E05 | KPIs + top + série 30 j |

Toutes les routes (sauf login) protégées par middleware **JWT**. Validation **Zod** sur chaque body.

---

## 4. Stratégie bilingue EN / FR

- **react-i18next** avec namespaces : `common`, `auth`, `clients`, `commandes`, `dashboard`.
- Fichiers : `client/src/locales/fr/*.json` et `client/src/locales/en/*.json`.
- **FR = langue par défaut** (`fallbackLng: 'fr'`), détection auto + sélecteur dans le header,
  préférence mémorisée en `localStorage`.
- **Aucune chaîne en dur** dans les composants → toujours `t('clé')`.
- **Dates & monnaie** localisées via `Intl` :
  - Monnaie : `new Intl.NumberFormat(lang, { style:'currency', currency:'XOF', maximumFractionDigits:0 })`.
  - Dates : `Intl.DateTimeFormat(lang)`.
- **Données serveur** (messages d'erreur API) : renvoyer des **codes** (`ERR_INVALID_CREDENTIALS`),
  traduits côté client → l'API reste neutre.
- **PDF bilingue** : le libellé du PDF suit la langue active au moment de l'export.

Exemple `fr/commandes.json` :
```json
{ "title": "Nouvelle commande", "addLine": "+ Ajouter un produit",
  "subtotal": "Sous-total", "discount": "Remise", "total": "TOTAL TTC",
  "validate": "Valider la commande", "cancel": "Annuler" }
```

---

## 5. Plan étape par étape (mappé sur les sprints du CDC)

> Coche `[x]` au fur et à mesure. Chaque étape liste les commandes / livrables.

### Sprint 0 — Setup & architecture (3 j) ✅ FAIT
- [x] **Git** : `git init` à la racine, `.gitignore` (node_modules, .env, dist).
- [x] **Monorepo** : npm workspaces (`shared` + `server` + `client`) + `concurrently`.
- [x] **client/** : Vite + React 19 + TS + Tailwind v4 (`@tailwindcss/vite`) + react-i18next + TanStack Query + axios.
- [x] **server/** : Express + TS (`tsx`), `cors`, `helmet`, `zod`, `jsonwebtoken`, `bcryptjs`, `prisma`, env validé par Zod.
- [x] **shared/** : moteur de calcul `computeCommande` + schémas Zod, exporté en `@gca/shared` (importé par client ET serveur).
- [x] **Prisma** : schéma §2 posé, `prisma generate` OK.
- [x] **Seed** : `prisma/seed.ts` (admin@gca.local / admin1234 + clients + 1 commande via le moteur partagé).
- [x] **Health check** : `GET /api/health` répond `{ ok, db, ts }` (ping DB). Vérifié : `{"ok":true,"db":"down"}` sans DB.
- [x] **Smoke tests** : typecheck client+serveur OK, `vite build` OK, serveur boote, page d'accueil affiche statut + switch FR/EN.
- [ ] **DB (action utilisateur)** : créer projet Neon → coller `DATABASE_URL` dans `server/.env` → `npm run prisma:migrate -- --name init` → `npm run seed`.
- **Livrable** : ✅ repo qui démarre client (`localhost:5173`) + API (`localhost:3000`). Reste : brancher Neon.

### Sprint 1 — Auth & navigation (5 j)
- [ ] Backend : `POST /api/auth/login` (bcrypt compare + JWT), middleware `requireAuth`.
- [ ] Frontend : page **E01 Login**, stockage token (mémoire + `localStorage`), axios interceptor.
- [ ] Routing protégé (React Router) : redirige vers /login si pas de token.
- [ ] **Layout responsive** (≥768px) : menu latéral, header avec **sélecteur de langue EN/FR**.
- [ ] i18next configuré + namespaces `common`/`auth`.
- **Tests** : T09 (mauvais mot de passe → erreur traduite).

### Sprint 2 — Module Clients CRUD (5 j) — *Modules A*
- [ ] API clients (list+search, create, update, archive, detail).
- [ ] **E03 Liste clients** : tableau paginé + recherche autocomplétée temps réel (debounce 250 ms).
- [ ] Formulaire créer/modifier (RHF + Zod).
- [ ] **E04 Fiche client** : infos + historique commandes + total cumulé.
- [ ] Suppression logique avec confirmation.
- **Tests** : T01, T08.

### Sprint 3 — Module Commandes — CŒUR (7 j) — *Module B*
- [ ] **E05 Saisie commande** : sélection client (autocomplete) ou client occasionnel.
- [ ] Tableau de lignes : ajout/édition inline/suppression (F-B02→B07).
- [ ] **Calcul temps réel** `useMemo` : total ligne, sous-total, remise (% ou FCFA), TOTAL TTC.
- [ ] Total TTC en grand, **vert**, mis en évidence (CDC §6.2).
- [ ] Sauvegarde auto brouillon (localStorage, 30 s) — NF Fiabilité.
- [ ] Valider (`POST`, recalcul serveur, génère `numero`, redirige vers détail) + Annuler (popup confirm).
- [ ] Schéma Zod de calcul **partagé** (`shared/`) utilisé client ET serveur.
- **Tests** : T02, T03 (<50 ms), T04, T05.

### Sprint 4 — Historique & exports (4 j) — *Modules C & D*
- [ ] **E06 Liste commandes** : tableau paginé + filtres (client, période, montant min/max, statut).
- [ ] **E07 Détail commande** + actions Voir/Modifier/Supprimer.
- [ ] **F-D01 Export PDF** (jsPDF + autotable) : en-tête/logo, lignes, totaux, bilingue.
- [ ] **F-D02 Impression** (`window.print()` + CSS print).
- [ ] **F-D03 Export CSV** de la liste filtrée.
- **Tests** : T06, T07.

### Sprint 5 — Tableau de bord (4 j) — *Module E*
- [ ] API `/api/dashboard` : CA (jour/semaine/mois), nb commandes, top 5 clients, top 5 produits, série 30 j.
- [ ] **E02** : cartes KPI + courbe Recharts + classements.
- **Tests** : T10.

### Sprint 6 — Tests, corrections & déploiement (3 j)
- [ ] Tests E2E (Playwright) sur les 10 scénarios T01–T10.
- [ ] Durcissement : rate-limit login, CORS strict, helmet, validation partout.
- [ ] **Déploiement** : Neon (prod branch) → Render/Fly (API, variables d'env) → Vercel (client, `VITE_API_URL`).
- [ ] README (setup, scripts, .env.example) + check accessibilité navigateurs.
- **Livrable** : app en ligne, recette T01–T10 verte.

---

## 6. Traçabilité — Critères d'acceptation (CDC §8)

| Test | Couvert par | Comment vérifier |
|---|---|---|
| T01 client complet | Sprint 2 | E2E création → visible liste |
| T02 commande 3 lignes | Sprint 3 | totaux exacts |
| T03 modif quantité <50ms | Sprint 3 | calcul mémoire, mesure perf |
| T04 suppr ligne | Sprint 3 | recalcul immédiat |
| T05 remise 10% | Sprint 3 | montant remise + TTC |
| T06 valider + retrouver | Sprint 3+4 | numéro en historique |
| T07 export PDF | Sprint 4 | PDF complet |
| T08 recherche client | Sprint 2 | filtrage temps réel |
| T09 mauvais mot de passe | Sprint 1 | erreur traduite |
| T10 CA du jour | Sprint 5 | = somme commandes du jour |

---

## 7. Sécurité & qualité (NF CDC §4)
- Mots de passe : **bcrypt** (jamais en clair). JWT signé, expiration 12 h, refresh optionnel.
- **Le serveur recalcule toujours les totaux** — ne jamais persister les montants envoyés par le client.
- Validation Zod sur 100 % des entrées API. `helmet`, `cors` whitelist, rate-limit sur `/login`.
- Variables sensibles en `.env` (jamais commitées). `.env.example` fourni.
- Code modulaire + commenté + README (NF Maintenabilité).

---

## 8. Commandes de démarrage rapide

```bash
# Frontend
cd client && npm install && npm run dev          # http://localhost:5173

# Backend
cd server && npm install
npx prisma migrate dev
npm run dev                                       # http://localhost:3000

# Variables d'env
# server/.env  -> DATABASE_URL, JWT_SECRET
# client/.env  -> VITE_API_URL=http://localhost:3000
```

---

## 9. Suivi d'avancement

| Sprint | Statut | Date | Notes |
|---|---|---|---|
| 0 Setup | ✅ Fait | 2026-06-26 | Monorepo, moteur de calcul partagé, health check. Reste : brancher Neon. |
| 1 Auth | ⬜ À faire | | |
| 2 Clients | ⬜ À faire | | |
| 3 Commandes | ⬜ À faire | | |
| 4 Historique/Export | ⬜ À faire | | |
| 5 Dashboard | ⬜ À faire | | |
| 6 Tests/Déploiement | ⬜ À faire | | |

> Mettre à jour ce tableau et cocher les cases des §5 à chaque session de dev.
