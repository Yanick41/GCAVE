import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

export const healthRouter = Router();

// Commit déployé — Render l'expose automatiquement via RENDER_GIT_COMMIT.
// Permet de vérifier QUELLE version tourne réellement, sans authentification
// (indispensable pour diagnostiquer un front et une API désynchronisés).
const COMMIT = (process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? "").slice(0, 7);

healthRouter.get("/", async (_req, res) => {
  let db: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    db = "down";
  }
  res.json({
    ok: true,
    db,
    ts: new Date().toISOString(),
    commit: COMMIT || null,
    // Runtime réellement servi : `engines` est une contrainte ouverte, l'hôte
    // peut basculer de majeur sans prévenir. L'exposer évite de diagnostiquer
    // à l'aveugle quand un déploiement se comporte mal.
    node: process.version,
    // Capacités servies par cette version : le client peut s'y fier plutôt
    // que de deviner à partir de la forme des réponses.
    features: { paiementCommande: true },
  });
});
