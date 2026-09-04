import { Router } from 'express';
import type { AppDeps } from '../../deps.js';

export function contentRoutes(deps: AppDeps): Router {
  const router = Router();

  // The doodle catalog the board renderer needs (id → public SVG URL).
  // Public: the SVGs themselves live in a public bucket, so the catalog is
  // non-sensitive and this keeps asset loading simple (no session required).
  router.get('/doodles', async (_req, res) => {
    const doodles = await deps.content.listDoodles();
    res.json({ doodles });
  });

  return router;
}
