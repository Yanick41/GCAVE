-- IDEMPOTENTE depuis le 2026-09-18 : la base de production a perdu son
-- historique de migrations alors que ces objets existaient déjà. Rejouer
-- l'historique sur une telle base exige que chaque étape sache ne rien faire
-- si son travail est déjà fait. Le résultat sur une base neuve est identique.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'MOBILE_MONEY', 'VIREMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Paiement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "mode" "ModePaiement" NOT NULL DEFAULT 'ESPECES',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Paiement_clientId_idx" ON "Paiement"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Paiement_date_idx" ON "Paiement"("date");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
