import { bootstrapApplication } from '@angular/platform-browser'
import { AppComponent } from './app/app.component'
import { createAppConfig } from './app/app.config'
import { loadAuthConfig } from './app/core/auth-config'

loadAuthConfig()
  .then((authConfig) => bootstrapApplication(AppComponent, createAppConfig(authConfig)))
  .catch((error: unknown) => console.error(error))
