/**
 * Schémas de validation Zod partagés client/serveur.
 * Le client valide les formulaires, le serveur valide les requêtes API.
 */
import { z } from "zod";

export const remiseTypeSchema = z.enum(["AUCUNE", "POURCENTAGE", "MONTANT"]);
export const statutCommandeSchema = z.enum(["BROUILLON", "VALIDEE", "ANNULEE"]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const clientSchema = z.object({
  nom: z.string().trim().min(1),
  telephone: z.string().trim().min(1),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  adresse: z.string().trim().optional(),
});

export const ligneSchema = z.object({
  nomProduit: z.string().trim().min(1),
  quantite: z.number().positive(),
  prixUnitaire: z.number().nonnegative(),
});

export const commandeSchema = z
  .object({
    clientId: z.string().optional(),
    clientNomLibre: z.string().trim().optional(),
    lignes: z.array(ligneSchema).min(1),
    remiseType: remiseTypeSchema.default("AUCUNE"),
    remiseValeur: z.number().nonnegative().default(0),
    montantPaye: z.number().nonnegative().optional(),
    statut: statutCommandeSchema.optional(),
  })
  .refine((d) => Boolean(d.clientId) || Boolean(d.clientNomLibre), {
    message: "CLIENT_REQUIRED",
    path: ["clientId"],
  });

export const modePaiementSchema = z.enum(["ESPECES", "MOBILE_MONEY", "VIREMENT"]);

export const paiementSchema = z.object({
  montant: z.number().positive(),
  mode: modePaiementSchema.default("ESPECES"),
  date: z.string().optional(),
  observation: z.string().trim().optional(),
});

export type ModePaiement = z.infer<typeof modePaiementSchema>;
export type PaiementInput = z.infer<typeof paiementSchema>;

export const commandeFiltersSchema = z.object({
  q: z.string().optional(),
  clientId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  montantMin: z.coerce.number().optional(),
  montantMax: z.coerce.number().optional(),
  statut: statutCommandeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type CommandeInput = z.infer<typeof commandeSchema>;
export type CommandeFilters = z.infer<typeof commandeFiltersSchema>;
