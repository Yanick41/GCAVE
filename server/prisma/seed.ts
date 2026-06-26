import { computeCommande } from "@gca/shared";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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
