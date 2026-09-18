-- Vente comptoir : un encaissement peut n'avoir aucun client.
--
-- Contrainte ASSOUPLIE, jamais durcie : les paiements existants ont tous un
-- client et restent valides. Aucune donnée lue, modifiée ni supprimée, et la
-- clé étrangère est conservée — elle tolère simplement NULL désormais.
--
-- Sans ce changement, une facture de passage ne pouvait porter aucun règlement :
-- son encaissement n'apparaissait ni dans la page Paiements, ni dans le
-- rapport du jour.

-- AlterTable
ALTER TABLE "Paiement" ALTER COLUMN "clientId" DROP NOT NULL;
