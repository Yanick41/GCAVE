import { loginSchema } from "@gca/shared";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../lib/env.js";
import { signToken } from "../../lib/jwt.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post("/login", loginLimiter, validate(loginSchema), (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const ok =
    email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() &&
    password === env.ADMIN_PASSWORD;

  if (!ok) throw new AppError("INVALID_CREDENTIALS", 401);

  const user = {
    sub: "admin",
    email: env.ADMIN_EMAIL,
    role: "ADMIN",
    nom: "Administrateur",
  };
  res.json({ token: signToken(user), user });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
