import cors from 'cors'
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from 'express'
import { auth, UnauthorizedError } from 'express-oauth2-jwt-bearer'
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
import multer from 'multer'
import { authConfiguration } from './config/auth.js'
import { optionalEnv } from './config/env.js'
import apiRoutes from './routes/api.routes.js'
import { createLocalAuth } from './services/local_auth_service.js'

const app = express()
const corsOrigin = optionalEnv('CORS_ORIGIN')
const authConfig = authConfiguration()
const requireAccessToken = authConfig.mode === 'auth0' ? auth({
  audience: authConfig.audience,
  issuerBaseURL: authConfig.issuerBaseURL,
}) : null
const localAuth = authConfig.mode === 'local' ? createLocalAuth() : null

app.disable('x-powered-by')
if (corsOrigin) app.use(cors({ origin: corsOrigin, credentials: true }))
app.get('/api/auth-config', (_req, res) => res.json({
  success: true,
  data: {
    mode: authConfig.mode,
    enabled: authConfig.enabled,
    domain: authConfig.domain,
    clientId: authConfig.clientId,
    audience: authConfig.audience,
  },
}))
if (localAuth) app.all('/api/auth/*', toNodeHandler(localAuth))
app.use(express.json({ limit: '1mb' }))
if (requireAccessToken) {
  app.use('/api', (req, res, next) => req.path === '/health' ? next() : requireAccessToken(req, res, next))
}
if (localAuth) {
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next()
    void localAuth.api.getSession({ headers: fromNodeHeaders(req.headers) }).then((session) => {
      if (!session) {
        return res.status(401).json({
          success: false,
          errors: [{ rule: 'authorization', field: 'session', message: 'Sign in to continue' }],
        })
      }
      req.localAuthUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }
      next()
    }).catch(next)
  })
}
app.use('/api', apiRoutes)
app.use((_req, res) => res.status(404).json({
  success: false,
  errors: [{ rule: 'route', field: 'path', message: 'Route not found' }],
}))

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof UnauthorizedError) {
    return res.status(error.status).set(error.headers).json({
      success: false,
      errors: [{ rule: 'authorization', field: 'authorization', message: 'A valid access token is required' }],
    })
  }
  console.error(error)
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      errors: [{ rule: 'file_size', field: 'file', message: 'Files must be 4 MB or smaller' }],
    })
  }
  return res.status(500).json({
    success: false,
    errors: [{ rule: 'server', field: 'request', message: 'Internal server error' }],
  })
}

app.use(errorHandler)

export default app
