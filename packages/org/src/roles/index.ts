import type { RoleDefinition } from '@vigoros/contracts'
import { RoleDefinition as RoleSchema } from '@vigoros/contracts'
import { contentDirector } from './content-director'
import { managingDirector } from './managing-director'

/** The first two hires. Each is validated against the contract at import time. */
export const PHASE_ONE_ROLES: readonly RoleDefinition[] = [managingDirector, contentDirector].map(
  (r) => RoleSchema.parse(r),
)

export const roleByKey = (key: string): RoleDefinition | undefined =>
  PHASE_ONE_ROLES.find((r) => r.key === key)

export { managingDirector, contentDirector }
