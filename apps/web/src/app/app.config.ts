import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { type ApplicationConfig } from '@angular/core'
import { provideRouter, withComponentInputBinding, type Routes } from '@angular/router'
import { AuthService, authGuardFn, authHttpInterceptorFn, provideAuth0 } from '@auth0/auth0-angular'
import type { PublicAuthConfig } from '@hackathon/shared'
import { AUTH_MODE } from './core/auth-config'
import { AUTH_IDENTITY, auth0Identity, localIdentity } from './core/auth-identity'
import { localAuthGuard } from './core/local-auth.guard'
import { LocalAuthService } from './core/local-auth.service'

export function createAppConfig(authConfig: PublicAuthConfig): ApplicationConfig {
  const canActivate = authConfig.mode === 'auth0' ? [authGuardFn] : authConfig.mode === 'local' ? [localAuthGuard] : []
  const routes: Routes = [
    ...(authConfig.mode === 'local' ? [
      { path: 'login', title: 'Sign in · Hackathon Framework', loadComponent: () => import('./pages/local-auth.page').then((module) => module.LocalAuthPage) },
      { path: 'register', title: 'Register · Hackathon Framework', loadComponent: () => import('./pages/local-auth.page').then((module) => module.LocalAuthPage) },
    ] : []),
    { path: '', title: 'Dashboard · Hackathon Framework', canActivate, loadComponent: () => import('./pages/home.page').then((module) => module.HomePage) },
    { path: 'query', title: 'Query · Hackathon Framework', canActivate, loadComponent: () => import('./pages/query.page').then((module) => module.QueryPage) },
    { path: 'query/:conversationId', title: 'Conversation · Hackathon Framework', canActivate, loadComponent: () => import('./pages/query.page').then((module) => module.QueryPage) },
    { path: 'results', title: 'Results · Hackathon Framework', canActivate, loadComponent: () => import('./pages/results.page').then((module) => module.ResultsPage) },
    { path: 'library', title: 'Library · Hackathon Framework', canActivate, loadComponent: () => import('./pages/library.page').then((module) => module.LibraryPage) },
    { path: 'files', redirectTo: 'library', pathMatch: 'full' },
    { path: '**', redirectTo: '' },
  ]

  return {
    providers: [
      { provide: AUTH_MODE, useValue: authConfig.mode },
      provideRouter(routes, withComponentInputBinding()),
      authConfig.mode === 'auth0'
        ? provideHttpClient(withInterceptors([authHttpInterceptorFn]))
        : provideHttpClient(),
      ...(authConfig.mode === 'auth0' ? [provideAuth0({
        domain: authConfig.domain,
        clientId: authConfig.clientId,
        authorizationParams: {
          redirect_uri: window.location.origin,
          audience: authConfig.audience,
        },
        httpInterceptor: {
          allowedList: [{
            uri: '/api/*',
            tokenOptions: { authorizationParams: { audience: authConfig.audience } },
          }],
        },
      })] : []),
      ...(authConfig.mode === 'auth0' ? [{
        provide: AUTH_IDENTITY,
        useFactory: auth0Identity,
        deps: [AuthService],
      }] : authConfig.mode === 'local' ? [{
        provide: AUTH_IDENTITY,
        useFactory: localIdentity,
        deps: [LocalAuthService],
      }] : []),
    ],
  }
}
