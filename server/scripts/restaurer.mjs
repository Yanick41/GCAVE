/**
 * Restauration d'une sauvegarde JSON produite par `sauvegarde.mjs`.
 *
 * Une sauvegarde qu'on n'a jamais su relire n'est pas une sauvegarde : ce
 * script est la moitié qui compte. Il est volontairement PRUDENT — restaurer
 * par-dessus des données vivantes serait pire que la panne d'origine.
 *
 *   npm run restaurer --workspace @gca/server -- fichier.json --simuler
 *   npm run restaurer --workspace @gca/server -- fichier.json
 *
 * • `--simuler` (recommandé d'abord) : n'écrit RIEN, annonce ce qui serait fait.
 * • sans option : refuse si la base contient déjà des données.
 * • `--ecraser` : à n'employer que sur une base dont on veut remplacer le
 *   contenu ; les tables sont alors vidées dans l'ordre inverse des dépendances.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import prismaPkg from "@prisma/client";
import { ORDRE_TABLES } from "./sauvegarde.mjs";

const { PrismaClient } = prismaPkg;

const modele = (table) => table[0].toLowerCase() + table.slice(1);

/** Les dates reviennent du JSON en chaîne ; Prisma attend des objets Date. */
const CHAMPS_DATE = /^(date|echeance|createdAt)$/;

function convertir(ligne) {
  const sortie = {};
  for (const [cle, valeur] of Object.entries(ligne)) {
    sortie[cle] = CHAMPS_DATE.test(cle) && typeof valeur === "string" ? new Date(valeur) : valeur;
  }
  return sortie;
}

export async function restaurer(url, fichier, { simuler = false, ecraser = false } = {}) {
  const sauvegarde = JSON.parse(readFileSync(fichier, "utf8"));
  if (!sauvegarde.tables) throw new Error("fichier illisible : aucune section « tables »");

  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    // Le niveau de migration doit correspondre, sinon une colonne attendue peut
    // manquer — ou une colonne récente serait silencieusement laissée vide.
    const actuelles = await db
      .$queryRawUnsafe('select migration_name from "_prisma_migrations" order by started_at')
      .then((r) => r.map((x) => x.migration_name))
      .catch(() => []);
    const manquantes = (sauvegarde.migrations ?? []).filter((m) => !actuelles.includes(m));
    if (manquantes.length) {
      console.warn(`[restaurer] ATTENTION : migrations absentes de la base : ${manquantes.join(", ")}`);
      console.warn("[restaurer] Appliquez les migrations avant de restaurer.");
      if (!simuler) throw new Error("schéma en retard sur la sauvegarde");
    }

    const existant = {};
    for (const t of ORDRE_TABLES) existant[t] = await db[modele(t)].count();
    const totalExistant = Object.values(existant).reduce((s, n) => s + n, 0);

    if (totalExistant > 0 && !ecraser) {
      const detail = Object.entries(existant).filter(([, n]) => n > 0).map(([t, n]) => `${t}=${n}`);
      throw new Error(
        `la base contient déjà ${totalExistant} enregistrement(s) (${detail.join(", ")}). ` +
          "Restauration refusée — relancez avec --ecraser en connaissance de cause.",
      );
    }

    const plan = ORDRE_TABLES.map((t) => [t, (sauvegarde.tables[t] ?? []).length]);
    if (simuler) {
      console.log(`[restaurer] SIMULATION — sauvegarde du ${sauvegarde.horodatage}`);
      for (const [t, n] of plan) console.log(`  ${t.padEnd(14)} ${n} à insérer (base : ${existant[t]})`);
      return { simule: true, plan };
    }

    if (ecraser && totalExistant > 0) {
      for (const t of [...ORDRE_TABLES].reverse()) {
        await db[modele(t)].deleteMany();
        console.log(`  vidée : ${t}`);
      }
    }

    // `createMany` par table, dans l'ordre des dépendances : les clés étrangères
    // trouvent toujours leur cible déjà insérée.
    const inseres = {};
    for (const t of ORDRE_TABLES) {
      const lignes = (sauvegarde.tables[t] ?? []).map(convertir);
      if (lignes.length === 0) {
        inseres[t] = 0;
        continue;
      }
      const r = await db[modele(t)].createMany({ data: lignes, skipDuplicates: true });
      inseres[t] = r.count;
      console.log(`  ${t.padEnd(14)} ${r.count} inséré(s)`);
    }
    return { simule: false, inseres };
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const fichier = args.find((a) => !a.startsWith("--"));
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!fichier) {
    console.error("[restaurer] usage : restaurer.mjs <fichier.json> [--simuler] [--ecraser]");
    process.exit(1);
  }
  if (!url) {
    console.error("[restaurer] ni DIRECT_URL ni DATABASE_URL : restauration impossible");
    process.exit(1);
  }
  restaurer(url, fichier, {
    simuler: args.includes("--simuler"),
    ecraser: args.includes("--ecraser"),
  })
    .then((r) => console.log(r.simule ? "[restaurer] simulation terminée, rien écrit." : "[restaurer] terminé."))
    .catch((e) => {
      console.error(`[restaurer] ÉCHEC : ${e.message.split("\n")[0]}`);
      process.exit(1);
    });
}
