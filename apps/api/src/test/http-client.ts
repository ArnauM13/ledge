/* eslint-disable @typescript-eslint/no-explicit-any -- test helper: response bodies are untyped JSON */
/**
 * Tiny cookie-aware HTTP client for the integration tests (Node's fetch has
 * no cookie jar). Mimics the web app: JSON bodies, same-origin, CSRF header.
 */
export class TestClient {
  cookies = new Map<string, string>();
  csrfToken: string | null = null;
  lastSetCookie: string[] = [];

  constructor(private readonly baseUrl: string) {}

  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; body: any; setCookie: string[] }> {
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(method !== 'GET' ? { 'content-type': 'application/json' } : {}),
        ...(this.csrfToken && method !== 'GET'
          ? { 'x-csrf-token': this.csrfToken }
          : {}),
        ...headers,
      },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
    const setCookie = res.headers.getSetCookie();
    this.lastSetCookie = setCookie;
    for (const line of setCookie) {
      const [pair] = line.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line))
        this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // not JSON
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.csrfToken === 'string'
    ) {
      this.csrfToken = parsed.csrfToken;
    }
    return { status: res.status, body: parsed, setCookie };
  }

  get(path: string, headers?: Record<string, string>) {
    return this.request('GET', path, undefined, headers);
  }

  post(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request('POST', path, body, headers);
  }
}
