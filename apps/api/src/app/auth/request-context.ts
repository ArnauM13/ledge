import type { Request } from 'express';
import type { SessionStage } from '../../generated/prisma/client';

export interface AuthContext {
  sessionId: string;
  stage: SessionStage;
  csrfToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    totpEnabled: boolean;
  };
}

export type AuthedRequest = Request & { auth?: AuthContext };

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function requestMeta(req: Request): RequestMeta {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}
