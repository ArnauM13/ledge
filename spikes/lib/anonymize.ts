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

/**
 * Emmascara una adreça pública: `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh` -> `bc1q…0wlh`,
 * `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed` -> `0x5aAe…eAed`.
 */
export function maskAddress(address: string | null | undefined): string {
  if (!address) return '—';
  const a = address.trim();
  const head = /^0x/i.test(a) ? 6 : 4;
  if (a.length <= head + 4) return '****';
  return `${a.slice(0, head)}…${a.slice(-4)}`;
}

const EVM_ADDR_RE = /\b0x[0-9a-fA-F]{40}\b/g;
const HEX64_RE = /\b(?:0x)?[0-9a-fA-F]{64}\b/g;
const BECH32_ADDR_RE = /\b(?:bc|tb|bcrt)1[02-9ac-hj-np-z]{8,87}\b/gi;
const BASE58_ADDR_RE = /\b[123mn][1-9A-HJ-NP-Za-km-z]{25,39}\b/g;
const DECIMAL_RE = /-?\b\d+\.\d+\b/g;

/**
 * Com `anonymizeText`, però també per a cripto: emmascara adreces (BTC i EVM),
 * amaga hashes/claus de 64 hex i qualsevol nombre decimal (imports en cripto).
 */
export function anonymizeCryptoText(text: string): string {
  return anonymizeText(text)
    .replace(HEX64_RE, '<hex64>')
    .replace(EVM_ADDR_RE, (m) => maskAddress(m))
    .replace(BECH32_ADDR_RE, (m) => maskAddress(m))
    .replace(BASE58_ADDR_RE, (m) => maskAddress(m))
    .replace(DECIMAL_RE, '<import>');
}
