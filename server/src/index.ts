import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./lib/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { healthRouter } from "./modules/health/routes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// Routes
app.use("/api/health", healthRouter);
// Sprint 1+ : app.use("/api/auth", authRouter); etc.

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 API SGC sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
