-- Rattrapage de l'historique des migrations.
--
-- Les tables Rappel, BonCommande et LigneBon, ainsi que les colonnes
-- Client.soldeInitial et Commande.ancienSolde, ont été créées en production
-- avec `prisma db push` : AUCUNE migration ne les décrit. L'historique ne
-- pouvait donc pas reconstruire le schéma de l'application, et le rejeu
-- s'arrêtait à `20260915090000_quantite_saisie`, qui ajoute une colonne à une
-- table LigneBon que rien n'avait créée. Ce trou est resté invisible tant
-- qu'aucune base n'a eu besoin d'être rebâtie.
--
-- Datée du 14/09 pour s'insérer AVANT `20260915090000_quantite_saisie`, qui en
-- dépend : Prisma applique les migrations dans l'ordre des noms de dossier.
--
-- ENTIÈREMENT IDEMPOTENTE (IF NOT EXISTS, blocs DO) : sans effet sur une base
-- qui possède déjà ces objets — la production restaurée, notamment — et
-- constructive sur une base neuve. Aucune donnée n'est lue ni modifiée.
-- LigneBon est créée SANS `quantiteSaisie` : c'est la migration suivante qui
-- ajoute cette colonne, et son travail doit lui rester.

-- CreateEnum (PostgreSQL n'a pas de CREATE TYPE IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE "PrioriteRappel" AS ENUM ('FAIBLE', 'NORMALE', 'URGENTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatutRappel" AS ENUM ('EN_COURS', 'TERMINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatutBon" AS ENUM ('BROUILLON', 'ENVOYE', 'VALIDE', 'LIVRE', 'PAYE', 'CONVERTI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "soldeInitial" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Commande" ADD COLUMN IF NOT EXISTS "ancienSolde" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Rappel" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "echeance" TIMESTAMP(3) NOT NULL,
    "priorite" "PrioriteRappel" NOT NULL DEFAULT 'NORMALE',
    "statut" "StatutRappel" NOT NULL DEFAULT 'EN_COURS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rappel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BonCommande" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clientId" TEXT,
    "clientNomLibre" TEXT,
    "telephone" TEXT,
    "adresseLivraison" TEXT,
    "notes" TEXT,
    "statut" "StatutBon" NOT NULL DEFAULT 'BROUILLON',
    "allerRetour" BOOLEAN NOT NULL DEFAULT false,
    "montant" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commandeId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonCommande_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LigneBon" (
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(12,3) NOT NULL,
    "servi" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneBon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Rappel_clientId_idx" ON "Rappel"("clientId");
CREATE INDEX IF NOT EXISTS "Rappel_echeance_idx" ON "Rappel"("echeance");
CREATE INDEX IF NOT EXISTS "Rappel_statut_idx" ON "Rappel"("statut");
CREATE UNIQUE INDEX IF NOT EXISTS "BonCommande_numero_key" ON "BonCommande"("numero");
CREATE INDEX IF NOT EXISTS "BonCommande_clientId_idx" ON "BonCommande"("clientId");
CREATE INDEX IF NOT EXISTS "BonCommande_date_idx" ON "BonCommande"("date");
CREATE INDEX IF NOT EXISTS "BonCommande_statut_idx" ON "BonCommande"("statut");
CREATE INDEX IF NOT EXISTS "LigneBon_bonId_idx" ON "LigneBon"("bonId");

-- AddForeignKey (ADD CONSTRAINT n'accepte pas IF NOT EXISTS)
DO $$ BEGIN
  ALTER TABLE "Rappel" ADD CONSTRAINT "Rappel_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LigneBon" ADD CONSTRAINT "LigneBon_bonId_fkey"
    FOREIGN KEY ("bonId") REFERENCES "BonCommande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
