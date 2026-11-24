import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

/** Validates req.body against a Zod schema and replaces it with the parsed value. */
export function validateBody<S extends ZodTypeAny>(schema: S) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    req.body = result.data as z.infer<S>;
    next();
  };
}
