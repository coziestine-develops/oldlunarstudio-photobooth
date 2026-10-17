import { list, del } from '@vercel/blob';
import { PREFIX, isExpired, baseName } from './strips.js';

/** Deletes shared strips whose 24-hour window has passed. Returns how many were removed. */
export async function removeExpiredStrips(now = Date.now()) {
  let cursor;
  let removed = 0;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    const expired = page.blobs
      .filter(b => isExpired(baseName(b.pathname), now))
      .map(b => b.url);
    for (let i = 0; i < expired.length; i += 100) {
      await del(expired.slice(i, i + 100));
    }
    removed += expired.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return removed;
}
