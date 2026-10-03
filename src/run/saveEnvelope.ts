// The save's wrapper on disk (docs/save-system.md §6): a checksum ahead of the JSON, so a write the
// OS cut short is told apart from a whole one, and the order a read falls back through. Pure — the
// storage half is src/app/saveStorage.ts.

const ENVELOPE_PREFIX = 'tp1:';

/** FNV-1a over UTF-16 code units, as 8 hex digits. A torn-write detector, not a security measure. */
export function checksumOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function wrapEnvelope(payload: string): string {
  return `${ENVELOPE_PREFIX}${checksumOf(payload)}:${payload}`;
}

/**
 * The payload, or null when the checksum does not match. A file written before the envelope is
 * bare JSON and passes through unchecked: refusing it would cost an update the run it carries.
 */
export function unwrapEnvelope(stored: string): string | null {
  if (!stored.startsWith(ENVELOPE_PREFIX)) return stored.startsWith('{') ? stored : null;
  const rest = stored.slice(ENVELOPE_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon !== 8) return null;
  const payload = rest.slice(colon + 1);
  return checksumOf(payload) === rest.slice(0, colon) ? payload : null;
}

/** Where a read found its save: the main key, a write left half-swapped, or the copy before it. */
export type SaveSource = 'main' | 'next' | 'backup';

/** The read order: the main key, then a newer write that never finished swapping in, then the backup. */
export const SAVE_SOURCES: readonly SaveSource[] = ['main', 'next', 'backup'];

/**
 * The first candidate, in SAVE_SOURCES order, whose envelope is whole and whose payload `decode`
 * accepts. `failure` is the first refusal seen, so a run that cannot be read anywhere still says why.
 */
export function pickReadable<T>(
  stored: Partial<Record<SaveSource, string | null>>,
  decode: (payload: string) => { ok: true; value: T } | { ok: false; reason: string }
): { value: T; source: SaveSource } | { failure: string } | null {
  let failure: string | null = null;
  for (const source of SAVE_SOURCES) {
    const raw = stored[source];
    if (!raw) continue;
    const payload = unwrapEnvelope(raw);
    if (payload === null) {
      failure ??= `the ${source} save failed its checksum`;
      continue;
    }
    const decoded = decode(payload);
    if (decoded.ok) return { value: decoded.value, source };
    failure ??= decoded.reason;
  }
  return failure === null ? null : { failure };
}
