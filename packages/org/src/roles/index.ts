import type { RoleDefinition } from '@vigoros/contracts'
import { RoleDefinition as RoleSchema } from '@vigoros/contracts'
import { comedyWriterA, comedyWriterB } from './comedy-writer'
import { creativeReviewer } from './creative-reviewer'
import { performanceAnalyst } from './performance-analyst'
import { productionManager } from './production-manager'
import { studioDirector } from './studio-director'
import { trendResearcher } from './trend-researcher'

/** The first seven hires. Each is validated against the contract at import time. */
export const PHASE_ONE_ROLES: readonly RoleDefinition[] = [
  studioDirector,
  trendResearcher,
  comedyWriterA,
  comedyWriterB,
  creativeReviewer,
  productionManager,
  performanceAnalyst,
].map((r) => RoleSchema.parse(r))

export const roleByKey = (key: string): RoleDefinition | undefined =>
  PHASE_ONE_ROLES.find((r) => r.key === key)

export {
  studioDirector,
  trendResearcher,
  comedyWriterA,
  comedyWriterB,
  creativeReviewer,
  productionManager,
  performanceAnalyst,
}
