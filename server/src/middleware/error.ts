import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

/** Erreur applicative avec code stable (traduit côté client) + statut HTTP. */
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ code: "NOT_FOUND" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res
      .status(422)
      .json({ code: "VALIDATION_ERROR", issues: err.flatten() });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code });
  }
  console.error(err);
  return res.status(500).json({ code: "INTERNAL_ERROR" });
}
