import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./lib/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./modules/auth/routes.js";
import { clientsRouter } from "./modules/clients/routes.js";
import { commandesRouter } from "./modules/commandes/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { healthRouter } from "./modules/health/routes.js";
import { paiementsRouter } from "./modules/paiements/routes.js";
import { rappelsRouter } from "./modules/rappels/routes.js";
import { rapportsRouter } from "./modules/rapports/routes.js";

const app = express();

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

// Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/commandes", commandesRouter);
app.use("/api/paiements", paiementsRouter);
app.use("/api/rappels", rappelsRouter);
app.use("/api/rapports", rapportsRouter);
app.use("/api/dashboard", dashboardRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 API SGC sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
