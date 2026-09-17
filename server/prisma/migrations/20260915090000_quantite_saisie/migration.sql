-- Quantités fractionnées : conservation de l'écriture saisie (« 1/2 »).
--
-- Migration PUREMENT ADDITIVE : deux colonnes nullables, aucune donnée lue,
-- modifiée ni supprimée. Les lignes existantes gardent quantiteSaisie à NULL
-- et continuent de s'afficher à partir de leur valeur décimale.
--
-- La quantité reste stockée en Decimal(12,3) : exact pour 1/2, 1/4, 3/4, 1/8.

-- AlterTable
ALTER TABLE "LigneCommande" ADD COLUMN "quantiteSaisie" TEXT;

-- AlterTable
ALTER TABLE "LigneBon" ADD COLUMN "quantiteSaisie" TEXT;
