/**
 * Shared rules for shared strips.
 *
 * Every upload is stored as oldlunar-strips/<upload time in ms>-<uuid>.<ext>.
 * The upload time is in the name, so expiry is known without a database and
 * cannot be extended by anyone holding the link.
 */

export const PREFIX = 'oldlunar-strips/';
export const TTL_MS = 24 * 60 * 60 * 1000;   // a shared strip is downloadable for 24 hours

const NAME_RE = /^(\d{13})-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/;

/** Upload time (ms) from a file name like "1760000000000-<uuid>.jpg", or null if the name is not ours. */
export function uploadedAtFromName(name) {
  const m = NAME_RE.exec(String(name || ''));
  return m ? Number(m[1]) : null;
}

export function expiresAtFromName(name) {
  const t = uploadedAtFromName(name);
  return t === null ? null : t + TTL_MS;
}

export function isExpired(name, now = Date.now()) {
  const exp = expiresAtFromName(name);
  return exp === null || now >= exp;
}

/** Keeps only the file name part of a pathname (strips the folder). */
export function baseName(pathname) {
  return String(pathname || '').slice(PREFIX.length);
}
