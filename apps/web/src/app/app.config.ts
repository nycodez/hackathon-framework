import { provideHttpClient } from '@angular/common/http'
import { type ApplicationConfig } from '@angular/core'
import { provideRouter, withComponentInputBinding, type Routes } from '@angular/router'

const routes: Routes = [
  { path: '', title: 'Dashboard · Hackathon Framework', loadComponent: () => import('./pages/home.page').then((module) => module.HomePage) },
  { path: 'query', title: 'Query · Hackathon Framework', loadComponent: () => import('./pages/query.page').then((module) => module.QueryPage) },
  { path: 'query/:conversationId', title: 'Conversation · Hackathon Framework', loadComponent: () => import('./pages/query.page').then((module) => module.QueryPage) },
  { path: 'results', title: 'Results · Hackathon Framework', loadComponent: () => import('./pages/results.page').then((module) => module.ResultsPage) },
  { path: 'library', title: 'Library · Hackathon Framework', loadComponent: () => import('./pages/library.page').then((module) => module.LibraryPage) },
  { path: 'files', redirectTo: 'library', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
]

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(), provideRouter(routes, withComponentInputBinding())],
}
