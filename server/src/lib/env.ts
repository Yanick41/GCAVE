import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL manquant (voir server/.env.example)"),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET trop court (>= 16 caractères)"),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Authentification simple : un seul compte admin (pas de gestion d'utilisateurs)
  ADMIN_EMAIL: z.string().default("admin@gca.local"),
  ADMIN_PASSWORD: z.string().default("admin1234"),
});

/**
 * Retire une éventuelle paire de guillemets entourant la valeur.
 * Utile quand les variables sont collées avec leurs guillemets (ex: Render),
 * ce qui casserait DATABASE_URL, la comparaison ADMIN_EMAIL, etc.
 */
function unquote(v: string | undefined): string | undefined {
  if (
    v &&
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "PORT",
  "CLIENT_ORIGIN",
  "NODE_ENV",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
] as const;

const sanitized = Object.fromEntries(KEYS.map((k) => [k, unquote(process.env[k])]));

const parsed = schema.safeParse(sanitized);

if (!parsed.success) {
  console.error("❌ Variables d'environnement invalides :");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
