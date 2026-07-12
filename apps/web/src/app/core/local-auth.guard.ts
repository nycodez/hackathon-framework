import { inject } from '@angular/core'
import { Router, type CanActivateFn } from '@angular/router'
import { LocalAuthService } from './local-auth.service'

export const localAuthGuard: CanActivateFn = async (_route, state) => {
  const localAuth = inject(LocalAuthService)
  const router = inject(Router)
  const session = await localAuth.session()
  return session ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
}
