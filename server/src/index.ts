import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./lib/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./modules/auth/routes.js";
import { bonsRouter } from "./modules/bons/routes.js";
import { clientsRouter } from "./modules/clients/routes.js";
import { commandesRouter } from "./modules/commandes/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { healthRouter } from "./modules/health/routes.js";
import { paiementsRouter } from "./modules/paiements/routes.js";
import { rappelsRouter } from "./modules/rappels/routes.js";
import { rapportsRouter } from "./modules/rapports/routes.js";

const app = express();

// Derrière le proxy Render (1 saut) → req.ip = vraie IP client (pour rate-limit)
app.set("trust proxy", 1);

// Origines autorisées : celles configurées (liste séparée par des virgules)
// + tous les domaines *.vercel.app (production ET previews).
const allowedOrigins = env.CLIENT_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Requêtes sans origine (curl, health checks, même origine) : autorisées
      if (!origin) return callback(null, true);
      let host = "";
      try {
        host = new URL(origin).hostname;
      } catch {
        return callback(null, false);
      }
      const ok = allowedOrigins.includes(origin) || host.endsWith(".vercel.app");
      return callback(null, ok);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// Limite globale anti-abus : large (n'impacte pas l'usage normal), bloque les
// rafales. Le health check (enregistré avant) n'est pas concerné.
const apiLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 600, // 600 requêtes / minute / IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use("/api/health", healthRouter);
app.use("/api", apiLimiter);
app.use("/api/auth", authRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/commandes", commandesRouter);
app.use("/api/bons", bonsRouter);
app.use("/api/paiements", paiementsRouter);
app.use("/api/rappels", rappelsRouter);
app.use("/api/rapports", rapportsRouter);
app.use("/api/dashboard", dashboardRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 API SGC sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
