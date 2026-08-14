-- Rattachement des paiements à une commande (relation Commande 1—N Paiement).
--
-- Migration PUREMENT STRUCTURELLE : aucune donnée existante n'est lue,
-- modifiée ni supprimée. Aucun UPDATE, aucun DELETE, aucun parsing du champ
-- `observation`. Les paiements déjà en base conservent `commandeId = NULL`.
--
-- Le nouveau suivi ne s'applique qu'aux commandes créées à partir du
-- déploiement : elles naissent avec `utiliseNouveauSuiviPaiement = true`
-- (posé par le serveur à la création). Les commandes existantes gardent la
-- valeur par défaut `false` et continuent d'utiliser `montantPaye` comme
-- aujourd'hui — comportement strictement inchangé.

-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN "commandeId" TEXT;

-- AlterTable
-- DEFAULT false : les lignes existantes basculent donc sur l'ancien système.
ALTER TABLE "Commande" ADD COLUMN "utiliseNouveauSuiviPaiement" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Paiement_commandeId_idx" ON "Paiement"("commandeId");

-- AddForeignKey
-- SET NULL : supprimer une commande ne détruit pas l'encaissement,
-- le paiement redevient un paiement sur le solde global du client.
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_commandeId_fkey"
  FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE SET NULL ON UPDATE CASCADE;
