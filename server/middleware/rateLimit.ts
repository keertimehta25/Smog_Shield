import rateLimit from 'express-rate-limit';

/** Per-IP limiter: AI calls cost money, so cap them to protect the key and the budget. */
export function createRateLimiter(max = 30, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a minute and try again.' },
  });
}
