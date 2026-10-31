import { createHash } from 'node:crypto';

/** `ES9121000418450200051332` -> `ES91 **** **** 1332` */
export function maskIban(iban: string | null | undefined): string {
  if (!iban) return '—';
  const c = iban.replace(/\s+/g, '').toUpperCase();
  if (c.length < 8) return '****';
  return `${c.slice(0, 4)} **** **** ${c.slice(-4)}`;
}

/** Identificador curt i estable per distingir comptes sense revelar-los. */
export function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){10,30}\b/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const AMOUNT_RE = /-?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\b/g;

/** Neteja text lliure (missatges d'error del banc) abans de posar-lo a l'informe compartible. */
export function anonymizeText(text: string): string {
  return text
    .replace(IBAN_RE, (m) => maskIban(m))
    .replace(UUID_RE, '<uuid>')
    .replace(EMAIL_RE, '<email>')
    .replace(AMOUNT_RE, '<import>');
}

/** `/accounts/<uuid>/balances` -> `/accounts/:id/balances` */
export function templatePath(path: string): string {
  return path.replace(UUID_RE, ':id');
}
