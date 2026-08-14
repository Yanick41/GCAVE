import { reglementCommande, type EtatPaiement } from "@gca/shared";

/**
 * Forme minimale d'une commande permettant de calculer son règlement.
 * Les champs sont optionnels : une API déployée avant le client (ou un cache
 * de réponse) peut ne pas encore les renvoyer.
 */
export interface CommandeBrute {
  totalTTC: string | number;
  ancienSolde?: string | number | null;
  montantPaye?: string | number | null;
  utiliseNouveauSuiviPaiement?: boolean;
  paiements?: { montant: string | number }[];
  reglement?: EtatPaiement;
}

/**
 * État de règlement d'une commande, TOUJOURS défini.
 *
 * Le serveur le calcule et l'envoie (`reglement`) : c'est la source de vérité.
 * S'il est absent — API pas encore déployée, réponse servie depuis le cache du
 * service worker —, on le recalcule localement avec le même moteur partagé
 * plutôt que de laisser l'interface planter sur un accès à `undefined`.
 * En l'absence du drapeau, la commande est traitée comme relevant de l'ancien
 * suivi : c'est le comportement conservateur, jamais une bascule implicite.
 */
export function reglementDe(commande: CommandeBrute): EtatPaiement {
  if (commande.reglement) return commande.reglement;
  return reglementCommande(
    {
      totalTTC: Number(commande.totalTTC ?? 0),
      ancienSolde: Number(commande.ancienSolde ?? 0),
      montantPaye: Number(commande.montantPaye ?? 0),
      utiliseNouveauSuiviPaiement: commande.utiliseNouveauSuiviPaiement ?? false,
    },
    (commande.paiements ?? []).map((p) => ({ montant: Number(p.montant) })),
  );
}
