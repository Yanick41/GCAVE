import type { NextFunction, Request, Response } from "express";

/** Enrobe un handler async pour transmettre les rejets au middleware d'erreur. */
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}
