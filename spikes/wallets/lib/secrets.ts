// Detecció de coses que NO són adreces públiques i que no s'han d'acceptar mai:
// seed phrases (BIP-39), claus privades en hex, WIF i claus privades esteses (xprv…).
// Si es detecten, el spike s'atura sense mostrar ni desar el valor.

const B58 = '[1-9A-HJ-NP-Za-km-z]';
const BIP39_WORD_COUNTS = new Set([12, 15, 18, 21, 24]);

export type SecretKind = 'seed phrase' | 'clau privada (hex)' | 'clau privada (WIF)' | 'clau privada estesa (xprv)';

export function detectSecret(value: string): SecretKind | undefined {
  const s = value.trim();
  if (!s) return undefined;

  // Seed phrase: 12–24 paraules (BIP-39), separades per espais, comes, punts i coma o salts de línia.
  const words = s.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  if (words.length >= 12 && words.every((w) => /^[a-z]{3,8}$/.test(w))) {
    if (BIP39_WORD_COUNTS.has(words.length) || words.length > 12) return 'seed phrase';
  }
  // Qualsevol fragment amb moltes paraules seguides també es tracta com a seed (p. ex. barrejada amb adreces).
  if (/(?:\b[a-z]{3,8}\b[\s,;]+){11,}\b[a-z]{3,8}\b/i.test(s)) return 'seed phrase';

  if (/^(0x)?[0-9a-fA-F]{64}$/.test(s)) return 'clau privada (hex)';
  // WIF: mainnet 5… (51) o K/L… (52); testnet 9… (51) o c… (52).
  if (new RegExp(`^[59]${B58}{50}$`).test(s) || new RegExp(`^[KLc]${B58}{51}$`).test(s)) return 'clau privada (WIF)';
  if (new RegExp(`^[xyztuvYZUV]prv${B58}{100,}$`).test(s)) return 'clau privada estesa (xprv)';
  return undefined;
}
