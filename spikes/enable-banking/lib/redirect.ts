import { SpikeError } from '../../lib/env.ts';

/**
 * Extreu el `code` de l'URL a la qual el banc ha redirigit.
 * Comprova que el `state` coincideixi (protecció CSRF) i detecta errors (`error`, `error_description`).
 */
export function parseRedirectUrl(input: string, expectedState: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new SpikeError("Això no és una URL vàlida. Copia l'adreça completa de la barra del navegador.");
  }
  const p = url.searchParams;
  const error = p.get('error');
  if (error) {
    const desc = p.get('error_description');
    throw new SpikeError(`El banc ha retornat un error: ${error}${desc ? ` (${desc})` : ''}`);
  }
  const state = p.get('state');
  if (state !== expectedState) throw new SpikeError("El paràmetre 'state' no coincideix. Torna a començar eb:connect.");
  const code = p.get('code');
  if (!code) throw new SpikeError("L'URL no conté cap paràmetre 'code'.");
  return code;
}

/** `valid_until` en RFC 3339 amb offset, limitat al màxim de l'ASPSP (amb 5 min de marge). */
export function computeValidUntil(maxConsentSeconds: number | undefined, requestedDays: number | undefined, now = new Date()): string {
  const fallback = 90 * 86_400;
  const max = maxConsentSeconds && maxConsentSeconds > 0 ? maxConsentSeconds : fallback;
  const wanted = requestedDays ? requestedDays * 86_400 : max;
  const seconds = Math.max(3600, Math.min(wanted, max) - 300);
  return new Date(now.getTime() + seconds * 1000).toISOString().replace('Z', '+00:00');
}
