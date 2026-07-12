import { betterAuth } from 'better-auth'
import { getPool } from '../db/pool.js'
import { optionalEnv, requireEnv } from '../config/env.js'

export interface LocalAuthUser {
  id: string
  name: string
  email: string
  image?: string | null
}

declare global {
  namespace Express {
    interface Request {
      localAuthUser?: LocalAuthUser
    }
  }
}

export function createLocalAuth() {
  const baseURL = localAuthBaseUrl()
  const corsOrigin = optionalEnv('CORS_ORIGIN')
  return betterAuth({
    appName: 'Hackathon Framework',
    baseURL,
    secret: localAuthSecret(),
    trustedOrigins: [...new Set([baseURL, corsOrigin].filter((value): value is string => Boolean(value)))],
    database: getPool(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    user: {
      modelName: 'auth_users',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    session: {
      modelName: 'auth_sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    account: {
      modelName: 'auth_accounts',
      fields: {
        userId: 'user_id',
        accountId: 'account_id',
        providerId: 'provider_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    verification: {
      modelName: 'auth_verifications',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    advanced: {
      cookiePrefix: 'hackathon-auth',
      database: { generateId: 'uuid' },
    },
  })
}

export type LocalAuth = ReturnType<typeof createLocalAuth>

function localAuthBaseUrl(): string {
  const explicit = optionalEnv('FRONTEND_URL')
  if (explicit) {
    const parsed = new URL(explicit)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('FRONTEND_URL must use HTTP or HTTPS')
    return parsed.origin
  }
  const vercelHost = optionalEnv('VERCEL_PROJECT_PRODUCTION_URL') ?? optionalEnv('VERCEL_URL')
  return vercelHost ? `https://${vercelHost}` : 'http://localhost:4200'
}

function localAuthSecret(): string {
  const configured = optionalEnv('BETTER_AUTH_SECRET')
  if (configured) return configured
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return requireEnv('BETTER_AUTH_SECRET')
  return 'hackathon-framework-local-development-secret-change-before-production'
}
