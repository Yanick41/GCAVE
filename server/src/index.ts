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

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/commandes", commandesRouter);
app.use("/api/paiements", paiementsRouter);
app.use("/api/dashboard", dashboardRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 API SGC sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
