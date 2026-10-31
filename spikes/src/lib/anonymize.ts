/**
 * Helpers to produce the shareable (anonymised) report.
 * Rule: the *.report.md never contains amounts, holder names, full addresses,
 * full IBANs, identifiers usable as credentials, keys, tokens or signatures.
 */

/** `ES9121000418450200051332` -> `ES91 **** **** 1332` */
export function maskIban(iban: string | undefined | null): string {
  if (!iban) return '(sense IBAN)';
  const s = iban.replace(/\s+/g, '').toUpperCase();
  if (s.length < 8) return '****';
  return `${s.slice(0, 4)} **** **** ${s.slice(-4)}`;
}

/** `bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq` -> `bc1qar…5mdq` */
export function maskCryptoAddress(addr: string): string {
  if (addr.length <= 10) return '****';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Opaque ids (session ids, account uids): keep only a short prefix. */
export function maskId(id: string | undefined | null): string {
  if (!id) return '(cap)';
  return `${id.slice(0, 4)}…`;
}

const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/;
const HEX64_RE = /\b(?:0x)?[0-9a-fA-F]{64}\b/;
const JWT_RE = /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/;
const PEM_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

export class UnsafeReportError extends Error {}

/**
 * Last line of defence before writing a shareable report.
 * Throws if the text contains any known secret value or anything that looks
 * like an unmasked IBAN, a 256-bit hex value (private key / HMAC signature),
 * a JWT or a PEM private key. The thrown message never includes the match.
 */
export function assertShareable(text: string, secrets: Array<string | undefined> = []): void {
  for (const s of secrets) {
    if (s && s.length >= 6 && text.includes(s)) throw new UnsafeReportError('L’informe conté un secret: no es desa.');
  }
  if (IBAN_RE.test(text)) throw new UnsafeReportError('L’informe conté un IBAN sense emmascarar: no es desa.');
  if (HEX64_RE.test(text)) throw new UnsafeReportError('L’informe conté un valor hex de 64 caràcters (clau/signatura?): no es desa.');
  if (JWT_RE.test(text)) throw new UnsafeReportError('L’informe conté un JWT: no es desa.');
  if (PEM_RE.test(text)) throw new UnsafeReportError('L’informe conté una clau privada PEM: no es desa.');
}

/** Raw files are local-only but must still never contain credentials. */
export function assertNoSecrets(text: string, secrets: Array<string | undefined>): void {
  for (const s of secrets) {
    if (s && s.length >= 6 && text.includes(s)) throw new UnsafeReportError('El fitxer raw conté un secret: no es desa.');
  }
  if (JWT_RE.test(text)) throw new UnsafeReportError('El fitxer raw conté un JWT: no es desa.');
  if (PEM_RE.test(text)) throw new UnsafeReportError('El fitxer raw conté una clau privada PEM: no es desa.');
}

/** Escapes a value for a markdown table cell. */
export function cell(v: unknown): string {
  return String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
