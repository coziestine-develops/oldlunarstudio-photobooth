/**
 * GET /api/cleanup — deletes expired shared strips. Run by the Vercel cron job (vercel.json).
 * Vercel sends "Authorization: Bearer <CRON_SECRET>"; requests without it are refused.
 */
import { removeExpiredStrips } from '../lib/cleanup.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const deleted = await removeExpiredStrips();
    return res.status(200).json({ deleted });
  } catch (err) {
    console.error('cleanup failed', err);
    return res.status(500).json({ error: 'Cleanup failed' });
  }
}
