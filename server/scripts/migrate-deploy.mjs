/**
 * Applique les migrations Prisma en production (appelé au build Render).
 *
 * Neon expose deux points d'entrée : le POOLER (PgBouncer), pour le trafic
 * applicatif, et un point d'entrée DIRECT, pour les migrations. Les verrous
 * consultatifs PostgreSQL ne traversent pas PgBouncer : une migration lancée
 * sur le pooler échoue en P1002 après 10 s d'attente. `DIRECT_URL` étant saisie
 * à la main dans le tableau de bord Render, on ne s'y fie pas : le point
 * d'entrée direct est dérivé ici en retirant le suffixe `-pooler` de l'hôte.
 *
 * Ce script REFUSE par ailleurs de migrer une base autre que celle que
 * l'application lit. Migrer ailleurs est toujours une erreur de configuration,
 * et c'est une erreur silencieuse : le build passe, la production reste sans
 * ses colonnes. Mieux vaut un build en échec qu'un schéma appliqué au mauvais
 * endroit. Le nom de la base visée est journalisé à chaque fois, pour qu'un
 * log de déploiement réponde seul à la question « quelle base ? ».
 */
// Charge server/.env en développement. Sans effet sur Render, où les variables
// sont déjà dans l'environnement — le script se comporte donc pareil des deux
// côtés, et reste testable en local.
import "dotenv/config";
import { spawnSync } from "node:child_process";

/**
 * Hôte + nom de base d'une URL Postgres, sans identifiants ni options : de quoi
 * dire si deux URL désignent la même base. Le pooler et le point d'entrée
 * direct d'une même base ne diffèrent que par le suffixe `-pooler`, neutralisé
 * ici — jamais affiché avec le mot de passe, qui n'a rien à faire dans un log.
 */
function cible(url) {
  const m = /@([^/?]+)\/([^?]*)/.exec(url || "");
  return m ? `${m[1].replace("-pooler.", ".")}/${m[2]}` : null;
}

const runtime = process.env.DATABASE_URL || "";
const configuree = process.env.DIRECT_URL || runtime;

if (!configuree) {
  console.error("[migrate] ni DIRECT_URL ni DATABASE_URL : migration impossible");
  process.exit(1);
}

// Garde-fou : la base migrée doit être celle que l'application lit.
const cibleRuntime = cible(runtime);
const cibleMigration = cible(configuree);
if (cibleRuntime && cibleMigration && cibleRuntime !== cibleMigration) {
  console.error("[migrate] ARRÊT : DATABASE_URL et DIRECT_URL désignent deux bases différentes.");
  console.error(`[migrate]   l'application lit  : ${cibleRuntime}`);
  console.error(`[migrate]   la migration irait : ${cibleMigration}`);
  console.error("[migrate] Corrigez DIRECT_URL dans le tableau de bord Render : même hôte et");
  console.error("[migrate] même base que DATABASE_URL, simplement sans le suffixe « -pooler ».");
  process.exit(1);
}

const directe = configuree.replace("-pooler.", ".");
const env = { ...process.env, DIRECT_URL: directe };
console.log(`[migrate] base visée : ${cibleMigration ?? "(illisible)"}`);

const resultat = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env,
  shell: true,
  encoding: "utf8",
});
const journal = `${resultat.stdout ?? ""}${resultat.stderr ?? ""}`;
process.stdout.write(journal);

// Les codes Prisma sont opaques dans un log de build : on les traduit en clair
// plutôt que de laisser chercher la cause à chaque échec.
if (journal.includes("P3005")) {
  console.error("");
  console.error("[migrate] P3005 — la base visée contient déjà des tables mais aucun historique");
  console.error("[migrate] de migrations (table _prisma_migrations absente).");
  console.error("[migrate] AVANT toute chose, vérifiez qu'il s'agit bien de la base de production :");
  console.error("[migrate] une base vide ou incomplète ici signale une variable qui a changé de");
  console.error("[migrate] cible, ou une base restaurée à un état antérieur. Ne baselinez jamais");
  console.error("[migrate] une base avant d'avoir confirmé que c'est la bonne.");
} else if (journal.includes("P1002")) {
  console.error("");
  console.error("[migrate] P1002 — délai dépassé sur un verrou consultatif : l'URL de migration");
  console.error("[migrate] passe par le pooler. DIRECT_URL doit viser l'hôte SANS « -pooler ».");
}

process.exit(resultat.status ?? 1);
