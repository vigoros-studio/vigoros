import type { DepartmentKey } from '@vigoros/contracts'

/** Every position in the company. Phase 1 positions have full role definitions in ./roles. */
export interface Position {
  key: string
  title: string
  department: DepartmentKey
  scope: 'company' | 'subject'
  phase: 1 | 2 | 3 | 4 | 5
}

export const POSITIONS: readonly Position[] = [
  // Phase 1: two people, made excellent before anyone else is hired.
  {
    key: 'managing-director',
    title: 'Managing Director',
    department: 'executive',
    scope: 'company',
    phase: 1,
  },
  {
    key: 'content-director',
    title: 'Content Director',
    department: 'content',
    scope: 'subject',
    phase: 1,
  },
  // Later hires, each earning a row only when the scoreboard says the channel works.
  {
    key: 'fact-reviewer',
    title: 'Fact Reviewer',
    department: 'content',
    scope: 'subject',
    phase: 2,
  },
  { key: 'analyst', title: 'Analyst', department: 'executive', scope: 'company', phase: 2 },
  {
    key: 'partner-scout',
    title: 'Partner Scout',
    department: 'content',
    scope: 'subject',
    phase: 3,
  },
  {
    key: 'outbound-writer',
    title: 'Outbound Writer',
    department: 'content',
    scope: 'subject',
    phase: 3,
  },
  {
    key: 'devrel-engineer',
    title: 'Developer Relations Engineer',
    department: 'content',
    scope: 'subject',
    phase: 3,
  },
  {
    key: 'listing-manager',
    title: 'Listing Manager',
    department: 'content',
    scope: 'subject',
    phase: 4,
  },
  {
    key: 'request-responder',
    title: 'Request Responder',
    department: 'content',
    scope: 'subject',
    phase: 4,
  },
]
