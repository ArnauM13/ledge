import { currentTotp } from '../app/auth/totp';
import { TEST_PASSWORD } from './fixtures';
import { TestClient } from './http-client';

/**
 * Full first login over HTTP: password -> TOTP enrolment -> confirmed.
 * Returns a client holding a full session, the TOTP secret and the recovery codes.
 */
export async function signInFirstTime(baseUrl: string, email: string) {
  const client = new TestClient(baseUrl);
  const login = await client.post('/api/auth/login', {
    email,
    password: TEST_PASSWORD,
  });
  if (login.status !== 200 || login.body.next !== 'totp-setup') {
    throw new Error(`login failed: ${login.status}`);
  }
  const setup = await client.post('/api/auth/totp/setup');
  const secret: string = setup.body.secret;
  const confirm = await client.post('/api/auth/totp/setup/confirm', {
    code: currentTotp(secret),
  });
  if (confirm.status !== 200) {
    throw new Error(`TOTP enrolment failed: ${confirm.status}`);
  }
  return {
    client,
    secret,
    recoveryCodes: confirm.body.recoveryCodes as string[],
  };
}
