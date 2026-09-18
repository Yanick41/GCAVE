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
 *
 * Il sait enfin REPRENDRE EN MAIN une base qui a perdu son historique de
 * migrations (P3005) — la situation du 2026-09-18, où la base de production est
 * revenue à un état antérieur, ses tables présentes mais `_prisma_migrations`
 * disparue. La reprise est encadrée par des conditions strictes décrites plus
 * bas : elle n'invente rien et ne touche à aucune donnée.
 */
// Charge server/.env en développement. Sans effet sur Render, où les variables
// sont déjà dans l'environnement — le script se comporte donc pareil des deux
// côtés, et reste testable en local.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

/** Tables créées par la toute première migration, `20260626225301_init`. */
const TABLES_INIT = ["Client", "Commande", "LigneCommande", "Utilisateur"];
const MIGRATION_INIT = "20260626225301_init";

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

function prisma(sousCommande, env) {
  return spawnSync("npx", ["prisma", ...sousCommande], { env, shell: true, encoding: "utf8" });
}

/**
 * État de la base visée : l'historique de migrations existe-t-il, et quelles
 * tables applicatives sont déjà là ?
 */
async function etatBase(url) {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tables = (
      await db.$queryRawUnsafe(
        "select table_name from information_schema.tables where table_schema = current_schema() and table_type = 'BASE TABLE'",
      )
    ).map((r) => r.table_name);
    return { tables, historique: tables.includes("_prisma_migrations") };
  } finally {
    await db.$disconnect();
  }
}

/**
 * Reprise en main d'une base dont l'historique de migrations a disparu.
 *
 * `migrate deploy` refuse de tourner (P3005) dès qu'une base contient des
 * tables sans `_prisma_migrations` : il ne peut pas deviner ce qui a déjà été
 * appliqué. La seule sortie officielle est de déclarer un point de départ avec
 * `migrate resolve --applied`, ce qui crée l'historique et inscrit cette
 * migration — sans exécuter son SQL.
 *
 * On ne déclare QUE `20260626225301_init`, et seulement si les quatre tables
 * qu'elle crée sont TOUTES présentes : l'affirmation est alors vraie, pas une
 * commodité. Toutes les migrations suivantes sont idempotentes ; `deploy` les
 * rejoue ensuite sans risque, et ce qui manque réellement — les tables perdues,
 * par exemple — est recréé au passage.
 *
 * Refus dans tous les autres cas : une base à moitié bâtie, ou contenant des
 * tables étrangères, relève d'un humain, pas d'un script de build.
 */
async function reprendreEnMain(url, env) {
  let tables;
  let historique;
  try {
    ({ tables, historique } = await etatBase(url));
  } catch (e) {
    // Base injoignable : on laisse `migrate deploy` produire son propre
    // diagnostic, toujours plus précis que le nôtre sur une panne de connexion.
    console.log(`[migrate] état de la base illisible (${e.message.split("\n")[0]})`);
    return true;
  }

  if (historique) return true; // cas normal : rien à reprendre
  if (tables.length === 0) return true; // base neuve : `deploy` bâtit tout

  console.log("[migrate] Historique de migrations ABSENT alors que la base contient des tables.");
  console.log(`[migrate] Tables présentes : ${tables.join(", ")}`);

  const manquantes = TABLES_INIT.filter((t) => !tables.includes(t));
  if (manquantes.length > 0) {
    console.error(`[migrate] ARRÊT : base incomplète, il manque ${manquantes.join(", ")}.`);
    console.error("[migrate] Une base à demi bâtie ne se répare pas depuis un script de build :");
    console.error("[migrate] vérifiez d'abord qu'il s'agit bien de la base attendue.");
    return false;
  }

  console.log(`[migrate] Reprise en main : ${MIGRATION_INIT} déclarée appliquée (ses quatre`);
  console.log("[migrate] tables sont présentes). Les migrations suivantes, idempotentes, sont");
  console.log("[migrate] ensuite rejouées et recréent ce qui manque.");
  const r = prisma(["migrate", "resolve", "--applied", MIGRATION_INIT], env);
  process.stdout.write(`${r.stdout ?? ""}${r.stderr ?? ""}`);
  if (r.status !== 0) {
    console.error("[migrate] ARRÊT : la reprise en main a échoué.");
    return false;
  }
  return true;
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
const env = { ...process.env, DIRECT_URL: directe, DATABASE_URL: directe };
console.log(`[migrate] base visée : ${cibleMigration ?? "(illisible)"}`);

if (!(await reprendreEnMain(directe, env))) process.exit(1);

const resultat = prisma(["migrate", "deploy"], env);
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
