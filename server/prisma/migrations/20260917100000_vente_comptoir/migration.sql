-- Vente comptoir : facture pour un client de passage, sans fiche client.
--
-- Migration PUREMENT ADDITIVE : une colonne nullable, aucune donnée lue,
-- modifiée ni supprimée. Les commandes existantes gardent NULL.
--
-- `clientId` et `clientNomLibre` étaient déjà nullables : seul le téléphone
-- du client de passage manquait pour pouvoir figurer sur la facture.

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN "clientTelephoneLibre" TEXT;
