/**
 * Sauvegarde intégrale de la base en un fichier JSON.
 *
 * Écrit après la perte de données du 2026-09-18 : la base n'avait AUCUNE
 * sauvegarde, et un retour en arrière côté Neon a suffi à tout effacer
 * définitivement. Une sauvegarde qui vit chez l'hébergeur de la base ne protège
 * de rien — celle-ci est destinée à être conservée AILLEURS (artefact GitHub,
 * poste de l'utilisateur), pour qu'un incident Neon ne l'emporte pas aussi.
 *
 * Format JSON plutôt que `pg_dump` : lisible, indépendant de la version du
 * serveur PostgreSQL (le client `pg_dump` refuse de lire un serveur plus
 * récent que lui), et relu par `restaurer.mjs` sans outil externe.
 *
 *   npm run sauvegarde --workspace @gca/server            → ./sauvegardes/
 *   npm run sauvegarde --workspace @gca/server -- /chemin → dossier choisi
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

/**
 * Tables dans l'ordre des dépendances (une table ne cite que des tables déjà
 * listées). Cet ordre est celui de la RESTAURATION : il est défini ici, avec la
 * sauvegarde, pour que les deux scripts ne puissent pas diverger.
 */
export const ORDRE_TABLES = [
  "Utilisateur",
  "Client",
  "Commande",
  "LigneCommande",
  "Paiement",
  "Rappel",
  "BonCommande",
  "LigneBon",
];

/** Modèle Prisma correspondant à chaque table (première lettre en minuscule). */
const modele = (table) => table[0].toLowerCase() + table.slice(1);

/**
 * Les Decimal de Prisma et les Date ne survivent pas tels quels à JSON : on les
 * écrit en chaîne, forme que Prisma réaccepte à l'écriture. Un montant passé en
 * nombre flottant perdrait des centimes au passage.
 */
function remplacer(_cle, valeur) {
  if (valeur === null || valeur === undefined) return valeur;
  if (typeof valeur === "object" && typeof valeur.toFixed === "function") return valeur.toString();
  return valeur;
}

export async function sauvegarder(url, dossier) {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tables = {};
    const totaux = {};
    for (const t of ORDRE_TABLES) {
      const lignes = await db[modele(t)].findMany();
      tables[t] = lignes;
      totaux[t] = lignes.length;
    }

    // L'état du schéma est sauvegardé avec les données : une restauration dans
    // une base d'un autre niveau de migration doit pouvoir être signalée.
    const migrations = await db
      .$queryRawUnsafe('select migration_name from "_prisma_migrations" order by started_at')
      .then((r) => r.map((x) => x.migration_name))
      .catch(() => []);

    const [base] = await db.$queryRawUnsafe("select current_database() d");
    const contenu = {
      application: "SGC — GRANDE CAVE",
      horodatage: new Date().toISOString(),
      base: base.d,
      migrations,
      totaux,
      tables,
    };

    mkdirSync(dossier, { recursive: true });
    const jour = contenu.horodatage.slice(0, 10);
    const chemin = join(dossier, `sauvegarde-sgc-${jour}.json`);
    writeFileSync(chemin, JSON.stringify(contenu, remplacer, 2));
    return { chemin, totaux, migrations, total: Object.values(totaux).reduce((s, n) => s + n, 0) };
  } finally {
    await db.$disconnect();
  }
}

// Exécution directe (le module est aussi importé par `restaurer.mjs` et les
// tests). `pathToFileURL` est indispensable : sous Windows, un chemin
// `C:\...` concaténé à la main ne donne jamais la même URL que
// `import.meta.url`, et le script se terminait alors sans rien faire.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("[sauvegarde] ni DIRECT_URL ni DATABASE_URL : sauvegarde impossible");
    process.exit(1);
  }
  const dossier = process.argv[2] || "sauvegardes";
  sauvegarder(url, dossier)
    .then(({ chemin, totaux, total }) => {
      console.log(`[sauvegarde] ${chemin}`);
      for (const [t, n] of Object.entries(totaux)) console.log(`  ${t.padEnd(14)} ${n}`);
      console.log(`[sauvegarde] ${total} enregistrement(s) au total`);
    })
    .catch((e) => {
      console.error(`[sauvegarde] ÉCHEC : ${e.message.split("\n")[0]}`);
      process.exit(1);
    });
}
