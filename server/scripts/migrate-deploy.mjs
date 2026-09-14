/**
 * Applique les migrations Prisma en production (appelé au build Render).
 *
 * Neon expose deux points d'entrée : le POOLER (PgBouncer), pour le trafic
 * applicatif, et un point d'entrée DIRECT, pour les migrations. Les verrous
 * consultatifs PostgreSQL ne traversent pas PgBouncer : une migration lancée
 * sur le pooler échoue en P1002 après 10 s d'attente.
 *
 * Or `DIRECT_URL` est saisi à la main dans le tableau de bord Render, et le log
 * de déploiement du 2026-09-14 montre qu'elle pointe sur le pooler :
 *
 *   Datasource "db": ... at "ep-...-pooler.c-2.us-east-1.aws.neon.tech"
 *
 * Ça n'a pas cassé ce jour-là faute de migration en attente, mais la prochaine
 * évolution de schéma aurait échoué. Plutôt que de dépendre d'une variable
 * correctement renseignée, on dérive ici le point d'entrée direct en retirant
 * le suffixe `-pooler` du nom d'hôte.
 */
// Charge server/.env en développement. Sans effet sur Render, où les variables
// sont déjà dans l'environnement — le script se comporte donc pareil des deux
// côtés, et reste testable en local.
import "dotenv/config";
import { spawnSync } from "node:child_process";

const configuree = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const env = { ...process.env };

// Remplacement ciblé sur le nom d'hôte, sans reparser l'URL : un mot de passe
// contenant des caractères spéciaux ne doit pas être ré-encodé au passage.
const directe = configuree.replace("-pooler.", ".");

if (!configuree) {
  console.error("[migrate] ni DIRECT_URL ni DATABASE_URL : migration impossible");
  process.exit(1);
}

if (directe !== configuree) {
  env.DIRECT_URL = directe;
  const hote = directe.match(/@([^/?]+)/)?.[1] ?? "(inconnu)";
  console.log(`[migrate] URL de migration dérivée vers le point d'entrée direct : ${hote}`);
} else {
  console.log("[migrate] URL de migration déjà directe (aucun suffixe -pooler)");
}

const resultat = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env,
  shell: true,
});
process.exit(resultat.status ?? 1);
