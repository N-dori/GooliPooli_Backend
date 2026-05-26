import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayloadSchema } from '../types';
import type { JwtPayload } from '../types';

type IssuePayload = Omit<JwtPayload, 'type'>;

export function signAccessToken(payload: IssuePayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'] };
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(payload: IssuePayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'] };
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, opts);
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  const parsed = JwtPayloadSchema.parse(decoded);
  if (parsed.type !== 'access') throw new Error('Wrong token type');
  return parsed;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  const parsed = JwtPayloadSchema.parse(decoded);
  if (parsed.type !== 'refresh') throw new Error('Wrong token type');
  return parsed;
}
