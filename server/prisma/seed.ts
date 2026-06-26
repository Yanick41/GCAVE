import { computeCommande } from "@gca/shared";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Utilisateur admin de démo
  const passwordHash = await bcrypt.hash("admin1234", 10);
  const admin = await prisma.utilisateur.upsert({
    where: { email: "admin@gca.local" },
    update: {},
    create: {
      nom: "Admin Démo",
      email: "admin@gca.local",
      passwordHash,
      role: "ADMIN",
    },
  });

  // Clients de démo
  const clientA = await prisma.client.create({
    data: { nom: "Awa Traoré", telephone: "+225 0700000001", email: "awa@example.com" },
  });
  await prisma.client.create({
    data: { nom: "Koffi N'Guessan", telephone: "+225 0700000002" },
  });

  // Commande de démo (totaux calculés via le moteur partagé)
  const lignes = [
    { nomProduit: "Sac de riz 25kg", quantite: 2, prixUnitaire: 15000 },
    { nomProduit: "Bidon d'huile 5L", quantite: 3, prixUnitaire: 6500 },
  ];
  const calc = computeCommande({ lignes, remiseType: "POURCENTAGE", remiseValeur: 10 });

  await prisma.commande.create({
    data: {
      numero: "CMD-2025-000001",
      clientId: clientA.id,
      utilisateurId: admin.id,
      remiseType: "POURCENTAGE",
      remiseValeur: 10,
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

  console.log("✅ Seed terminé. Login: admin@gca.local / admin1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
