-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'MOBILE_MONEY', 'VIREMENT');

-- CreateTable
CREATE TABLE "Paiement" (
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
CREATE INDEX "Paiement_clientId_idx" ON "Paiement"("clientId");

-- CreateIndex
CREATE INDEX "Paiement_date_idx" ON "Paiement"("date");

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
