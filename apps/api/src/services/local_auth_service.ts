import { createHash } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { createAuthMiddleware, isAPIError } from 'better-auth/api'
import { getPool } from '../db/pool.js'
import { optionalEnv, requireEnv } from '../config/env.js'
import { logActivity, type ActivityLog } from './record_log_service.js'
import { localWorkspaceId } from './workspace_service.js'

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
    hooks: {
      after: createAuthMiddleware(async (context) => {
        if (context.path === '/sign-in/email') {
          const authenticated = context.context.newSession
          if (authenticated) {
            await safeLogActivity({
              workspaceId: localWorkspaceId(authenticated.user.id),
              actorId: authenticated.user.id,
              action: 'login_succeeded',
              recordType: 'auth_user',
              recordId: authenticated.user.id,
              metadata: requestMetadata(context.headers, authenticated.session.id),
            })
            return
          }

          if (isAPIError(context.context.returned)) {
            await safeLogActivity({
              workspaceId: null,
              action: 'login_failed',
              recordType: 'authentication',
              recordId: emailFingerprint(context.body?.email),
              metadata: requestMetadata(context.headers),
            })
          }
          return
        }

        if (context.path === '/sign-up/email') {
          const registered = context.context.newSession
          if (!registered) return
          const baseEvent = {
            workspaceId: localWorkspaceId(registered.user.id),
            actorId: registered.user.id,
            recordType: 'auth_user',
            recordId: registered.user.id,
          } as const
          await safeLogActivity({
            ...baseEvent,
            action: 'registered',
            metadata: requestMetadata(context.headers),
          })
          await safeLogActivity({
            ...baseEvent,
            action: 'login_succeeded',
            metadata: requestMetadata(context.headers, registered.session.id),
          })
        }
      }),
    },
    databaseHooks: {
      session: {
        delete: {
          after: async (session, context) => {
            if (context?.path !== '/sign-out') return
            await safeLogActivity({
              workspaceId: localWorkspaceId(session.userId),
              actorId: session.userId,
              action: 'logged_out',
              recordType: 'auth_user',
              recordId: session.userId,
              metadata: requestMetadata(context.headers, session.id),
            })
          },
        },
      },
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

async function safeLogActivity(entry: ActivityLog): Promise<void> {
  try {
    await logActivity(entry)
  } catch (error) {
    console.error('Activity log write failed', error instanceof Error ? error.name : 'UnknownError')
  }
}

function emailFingerprint(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLocaleLowerCase() : 'unknown'
  return `email:${createHash('sha256').update(normalized).digest('hex')}`
}

function requestMetadata(headers?: Headers, sessionId?: string): Record<string, unknown> {
  const forwardedFor = headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
  return {
    ipAddress: forwardedFor || headers?.get('x-real-ip') || null,
    userAgent: headers?.get('user-agent') || null,
    sessionId: sessionId ?? null,
  }
}
