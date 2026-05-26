import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type Target = 'body' | 'query' | 'params';

export function validate(target: Target, schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    // overwrite with parsed value so downstream handlers see coerced/defaulted data
    (req as unknown as Record<Target, unknown>)[target] = parsed.data;
    next();
  };
}
