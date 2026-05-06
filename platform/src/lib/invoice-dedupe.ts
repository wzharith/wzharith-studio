/**
 * Canonical invoice/quotation numbers and deduplication.
 * Fixes duplicate history rows when localStorage + API merges produce the same
 * document number with different spacing, casing, or zero-padding (QUO-2026-1 vs QUO-2026-001).
 */

export function normalizeInvoiceNumber(raw: string): string {
  const s = raw.trim().replace(/\s+/g, '');
  const m = s.match(/^([A-Za-z]+)-(\d{4})-(\d+)$/);
  if (!m) return s;
  const [, prefix, year, seq] = m;
  return `${prefix.toUpperCase()}-${year}-${seq.padStart(3, '0')}`;
}

function rankInvoice<T extends { id: string; createdAt?: string; updatedAt?: string }>(inv: T): number {
  let r = 0;
  const u = inv.updatedAt ? new Date(inv.updatedAt).getTime() : 0;
  const c = inv.createdAt ? new Date(inv.createdAt).getTime() : 0;
  r += Math.max(u, c);
  // Prefer server UUID ids over legacy numeric timestamp ids
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inv.id)) {
    r += 1e15;
  }
  return r;
}

/** Keep one row per canonical invoice number; prefer newer / server-backed rows. */
export function dedupeInvoicesByInvoiceNumber<
  T extends { invoiceNumber: string; id: string; createdAt?: string; updatedAt?: string },
>(list: T[]): T[] {
  const map = new Map<string, T>();
  for (const inv of list) {
    const key = normalizeInvoiceNumber(inv.invoiceNumber);
    const canon = { ...inv, invoiceNumber: key } as T;
    const prev = map.get(key);
    if (!prev || rankInvoice(canon) >= rankInvoice(prev)) {
      map.set(key, canon);
    }
  }
  return Array.from(map.values());
}
