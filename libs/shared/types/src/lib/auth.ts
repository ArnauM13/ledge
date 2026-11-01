/** Next step after a successful password check. */
export type AuthNextStep = 'totp' | 'totp-setup';

export type SessionStage = 'PASSWORD_VERIFIED' | 'AUTHENTICATED';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
}

/** GET /api/auth/session */
export type SessionInfo =
  | { authenticated: false }
  | {
      authenticated: false;
      stage: 'PASSWORD_VERIFIED';
      next: AuthNextStep;
      csrfToken: string;
    }
  | {
      authenticated: true;
      stage: 'AUTHENTICATED';
      csrfToken: string;
      user: SessionUser;
      households: HouseholdSummary[];
    };

/** POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  next: AuthNextStep;
  csrfToken: string;
}

/** POST /api/auth/totp/setup */
export interface TotpSetupResponse {
  /** Base32 secret for manual entry. */
  secret: string;
  otpauthUrl: string;
  /** PNG data URL of the QR code. */
  qrDataUrl: string;
}

/** POST /api/auth/totp/verify, /api/auth/totp/setup/confirm, /api/auth/recovery */
export interface CodeRequest {
  code: string;
}

export interface AuthenticatedResponse {
  csrfToken: string;
  user: SessionUser;
  /** Only after enrolling TOTP: shown once, never retrievable again. */
  recoveryCodes?: string[];
}
