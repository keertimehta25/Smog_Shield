import type { NextFunction, Request, Response } from 'express';

/** Allows the page itself to ask for device location (the "Use my location" button) and blocks everything else powerful. */
export function permissionsPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()');
  next();
}

/** API answers describe one person's air and household, so browsers and proxies must not keep them. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
