import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { supabase } from '../../lib/supabase';
import type {
  AuthSession,
  AuthTokens,
  LoginInput,
  PublicUser,
  SignupInput,
} from '../../types';
import { conflict, internal, notFound, unauthorized } from '../../utils/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { hashPassword, verifyPassword } from '../../utils/password';

type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  role: 'admin' | 'project_manager' | 'worker';
  auth_provider: 'password' | 'google';
  auth_provider_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    authProvider: row.auth_provider,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function issueTokens(user: UserRow): AuthTokens {
  const payload = { sub: user.id, email: user.email, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function signup(input: SignupInput): Promise<AuthSession> {
  const passwordHash = await hashPassword(input.password);

  const { data, error } = await supabase
    .from('users')
    .insert({
      username: input.username,
      email: input.email.toLowerCase(),
      password_hash: passwordHash,
      auth_provider: 'password',
      role: 'worker',
    })
    .select('*')
    .single<UserRow>();

  if (error) {
    if (error.code === '23505') throw conflict('Email or username already in use');
    throw internal(error.message);
  }
  if (!data) throw internal('Failed to create user');

  return { user: toPublicUser(data), tokens: issueTokens(data) };
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', input.email.toLowerCase())
    .maybeSingle<UserRow>();

  if (error) throw internal(error.message);
  if (!data || !data.password_hash) throw unauthorized('Invalid credentials');

  const ok = await verifyPassword(input.password, data.password_hash);
  if (!ok) throw unauthorized('Invalid credentials');

  return { user: toPublicUser(data), tokens: issueTokens(data) };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', payload.sub)
    .maybeSingle<UserRow>();
  if (error) throw internal(error.message);
  if (!data) throw unauthorized('User not found');
  return issueTokens(data);
}

export async function getMe(userId: string): Promise<PublicUser> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle<UserRow>();
  if (error) throw internal(error.message);
  if (!data) throw notFound('User not found');
  return toPublicUser(data);
}

// ----- Google OAuth ---------------------------------------------------------

const googleClient = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw internal('Google OAuth not configured');
  }
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  });
};

export function buildGoogleAuthUrl(): string {
  return googleClient().generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'consent',
  });
}

export async function handleGoogleCallback(code: string): Promise<AuthSession> {
  const client = googleClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw unauthorized('Missing Google id_token');

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw unauthorized('Google account has no email');

  // Upsert by email+provider; fall back to insert if not present.
  const existing = await supabase
    .from('users')
    .select('*')
    .eq('email', payload.email.toLowerCase())
    .maybeSingle<UserRow>();
  if (existing.error) throw internal(existing.error.message);

  let user: UserRow;
  if (existing.data) {
    const update = await supabase
      .from('users')
      .update({
        auth_provider: 'google',
        auth_provider_id: payload.sub ?? null,
        avatar_url: payload.picture ?? existing.data.avatar_url,
      })
      .eq('id', existing.data.id)
      .select('*')
      .single<UserRow>();
    if (update.error || !update.data) throw internal(update.error?.message ?? 'update failed');
    user = update.data;
  } else {
    const insert = await supabase
      .from('users')
      .insert({
        username: payload.name ?? payload.email.split('@')[0],
        email: payload.email.toLowerCase(),
        password_hash: null,
        auth_provider: 'google',
        auth_provider_id: payload.sub ?? null,
        avatar_url: payload.picture ?? null,
        role: 'worker',
      })
      .select('*')
      .single<UserRow>();
    if (insert.error || !insert.data) throw internal(insert.error?.message ?? 'insert failed');
    user = insert.data;
  }

  return { user: toPublicUser(user), tokens: issueTokens(user) };
}

export function buildOAuthSuccessRedirect(session: AuthSession): string {
  const url = new URL(env.WEB_OAUTH_SUCCESS_URL);
  url.searchParams.set('accessToken', session.tokens.accessToken);
  url.searchParams.set('refreshToken', session.tokens.refreshToken);
  return url.toString();
}
