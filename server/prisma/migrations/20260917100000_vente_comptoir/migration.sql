-- Vente comptoir : facture pour un client de passage, sans fiche client.
--
-- Migration PUREMENT ADDITIVE : une colonne nullable, aucune donnée lue,
-- modifiée ni supprimée. Les commandes existantes gardent NULL.
--
-- `clientId` et `clientNomLibre` étaient déjà nullables : seul le téléphone
-- du client de passage manquait pour pouvoir figurer sur la facture.
--
-- IF NOT EXISTS ajouté le 2026-09-18 : la base de production a perdu son
-- historique de migrations alors que cette colonne existait déjà. Sans cette
-- clause, la reprise en main de la base échouait sur une colonne en double.
-- Le résultat sur une base neuve est rigoureusement identique.

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN IF NOT EXISTS "clientTelephoneLibre" TEXT;
