/**
 * Données de DÉMONSTRATION. Ce script EFFACE clients, commandes, lignes et
 * paiements avant d'insérer son jeu d'essai.
 *
 * Il est déclaré comme `prisma.seed` dans package.json : Prisma le lance donc
 * TOUT SEUL lors d'un `prisma migrate reset` ou d'un `prisma db seed`. Une
 * commande tapée dans le mauvais terminal suffisait à vider la production.
 *
 * D'où le garde-fou ci-dessous, ajouté le 2026-09-19 après la perte de données
 * du 18 : le seed REFUSE de s'exécuter ailleurs que sur une base locale, sauf
 * intention déclarée explicitement (`SEED_AUTORISE=oui`).
 */
import { computeCommande } from "@gca/shared";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

/** Une base locale, la seule sur laquelle effacer des données est anodin. */
function estLocale(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

function verifierCible() {
  const url = process.env.DATABASE_URL ?? "";
  if (estLocale(url)) return;
  if (process.env.SEED_AUTORISE === "oui") {
    console.warn("[seed] SEED_AUTORISE=oui : effacement d'une base DISTANTE, à votre demande.");
    return;
  }
  const hote = /@([^/?]+)/.exec(url)?.[1] ?? "(inconnu)";
  console.error("[seed] ARRÊT : ce script EFFACE clients, commandes et paiements.");
  console.error(`[seed] La base visée n'est pas locale : ${hote}`);
  console.error("[seed] Si c'est bien ce que vous voulez, relancez avec SEED_AUTORISE=oui.");
  process.exit(1);
}

async function main() {
  verifierCible();

  // Repartir propre (données de démo uniquement)
  await prisma.paiement.deleteMany();
  await prisma.ligneCommande.deleteMany();
  await prisma.commande.deleteMany();
  await prisma.client.deleteMany();

  const passwordHash = await bcrypt.hash("admin1234", 10);
  await prisma.utilisateur.upsert({
    where: { email: "admin@gca.local" },
    update: {},
    create: { nom: "Admin Démo", email: "admin@gca.local", passwordHash, role: "ADMIN" },
  });

  const clientA = await prisma.client.create({
    data: {
      nom: "Awa Traoré",
      telephone: "+225 0700000001",
      email: "awa@example.com",
      adresse: "Cocody, Abidjan",
    },
  });
  await prisma.client.create({
    data: { nom: "Koffi N'Guessan", telephone: "+225 0700000002", adresse: "Yopougon" },
  });

  // Une commande (dette) pour Awa
  const lignes = [
    { nomProduit: "Casier de bière 65cl", quantite: 5, prixUnitaire: 9000 },
    { nomProduit: "Pack d'eau 1.5L", quantite: 10, prixUnitaire: 2500 },
  ];
  const calc = computeCommande({ lignes, remiseType: "AUCUNE", remiseValeur: 0 });
  await prisma.commande.create({
    data: {
      numero: "CMD-2025-000001",
      clientId: clientA.id,
      sousTotal: calc.sousTotal,
      montantRemise: calc.montantRemise,
      totalTTC: calc.totalTTC,
      statut: "VALIDEE",
      lignes: {
        create: calc.lignes.map((l) => ({
          nomProduit: l.nomProduit,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          totalLigne: l.totalLigne,
        })),
      },
    },
  });

  // Un paiement partiel d'Awa (le solde restant sera commandes − paiements)
  await prisma.paiement.create({
    data: {
      clientId: clientA.id,
      montant: 40000,
      mode: "MOBILE_MONEY",
      observation: "Acompte",
    },
  });

  console.log("✅ Seed terminé. Login: admin@gca.local / admin1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
