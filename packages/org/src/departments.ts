import type { DepartmentKey, RoomLayout } from '@vigoros/contracts'

export interface Department {
  key: DepartmentKey
  name: string
  purpose: string
}

/** Two departments to start. A third is a new key in the contract, a row here, and a room below. */
export const DEPARTMENTS: readonly Department[] = [
  {
    key: 'executive',
    name: 'Executive',
    purpose:
      "The founder's interface to the company: the weekly plan, the morning briefing, the approval queue in order of value, the scoreboard, and every decision as a row.",
  },
  {
    key: 'content',
    name: 'Content Studio',
    purpose:
      'Everything OneGoodArea publishes in words: district pages, change digests, LinkedIn and X posts, MCP listings and case studies. Every figure cites a signal row; nothing leaves without the fact-check and the founder.',
  },
]

/**
 * The building, in isometric tiles. Rooms are data so the HQ scene and the seed read one source.
 * The executive office holds the boardroom; the content studio is the finished slice.
 */
export const ROOMS: readonly RoomLayout[] = [
  {
    key: 'executive',
    name: 'Executive office and boardroom',
    origin: [0, 0],
    size: [9, 6],
    desks: 4,
  },
  { key: 'content', name: 'Content studio', origin: [10, 0], size: [11, 7], desks: 6 },
]
