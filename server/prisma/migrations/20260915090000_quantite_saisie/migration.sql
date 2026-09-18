-- Quantités fractionnées : conservation de l'écriture saisie (« 1/2 »).
--
-- Migration PUREMENT ADDITIVE : deux colonnes nullables, aucune donnée lue,
-- modifiée ni supprimée. Les lignes existantes gardent quantiteSaisie à NULL
-- et continuent de s'afficher à partir de leur valeur décimale.
--
-- La quantité reste stockée en Decimal(12,3) : exact pour 1/2, 1/4, 3/4, 1/8.
--
-- IF NOT EXISTS ajouté le 2026-09-18 : la base de production a perdu son
-- historique de migrations alors que cette colonne existait déjà. Sans cette
-- clause, la reprise en main de la base échouait sur une colonne en double.
-- Le résultat sur une base neuve est rigoureusement identique.

-- AlterTable
ALTER TABLE "LigneCommande" ADD COLUMN IF NOT EXISTS "quantiteSaisie" TEXT;

-- AlterTable
ALTER TABLE "LigneBon" ADD COLUMN IF NOT EXISTS "quantiteSaisie" TEXT;
