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

-- IDEMPOTENTE depuis le 2026-09-18 : la base de production a perdu son
-- historique de migrations alors que ces colonnes existaient déjà. Rejouer
-- l'historique sur une telle base exige que chaque étape sache ne rien faire
-- si son travail est déjà fait. Le résultat sur une base neuve est identique.

-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN IF NOT EXISTS "commandeId" TEXT;

-- AlterTable
-- DEFAULT false : les lignes existantes basculent donc sur l'ancien système.
ALTER TABLE "Commande" ADD COLUMN IF NOT EXISTS "utiliseNouveauSuiviPaiement" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Paiement_commandeId_idx" ON "Paiement"("commandeId");

-- AddForeignKey
-- SET NULL : supprimer une commande ne détruit pas l'encaissement,
-- le paiement redevient un paiement sur le solde global du client.
DO $$ BEGIN
  ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_commandeId_fkey"
    FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
