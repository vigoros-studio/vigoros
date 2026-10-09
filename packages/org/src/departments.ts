import type { DepartmentKey, RoomLayout } from '@vigoros/contracts'

export interface Department {
  key: DepartmentKey
  name: string
  purpose: string
}

export const DEPARTMENTS: readonly Department[] = [
  {
    key: 'executive',
    name: 'Executive and Strategy',
    purpose:
      'Priorities, schedules, growth goals, resource allocation, cross-department coordination.',
  },
  {
    key: 'creative',
    name: 'Creative Development',
    purpose:
      "Create, debate and refine content while protecting each character's personality and storyline.",
  },
  {
    key: 'production',
    name: 'Production',
    purpose:
      "Turn approved scripts into packages, renders and QC through each character's production pipeline.",
  },
  {
    key: 'growth',
    name: 'Growth and Distribution',
    purpose:
      'Study performance, recommend experiments, refine content strategy, prepare publishing.',
  },
  {
    key: 'commercial',
    name: 'Commercial and Finance',
    purpose:
      'Opportunities, costs, forecasts and readiness. No deals until the founder opens that door.',
  },
  {
    key: 'operations',
    name: 'Operations and Quality',
    purpose: 'Prevent errors, runaway spend, contradictory instructions and unreliable automation.',
  },
]

/**
 * The building, in isometric tiles. Rooms are data so the HQ scene and the seed read one source.
 * Two meeting rooms and the boardroom are attached to the executive floor.
 */
export const ROOMS: readonly RoomLayout[] = [
  {
    key: 'executive',
    name: 'Executive floor and boardroom',
    origin: [0, 0],
    size: [10, 6],
    desks: 6,
  },
  { key: 'creative', name: "Writers' room", origin: [11, 0], size: [10, 6], desks: 10 },
  { key: 'production', name: 'Production floor', origin: [22, 0], size: [12, 8], desks: 12 },
  { key: 'growth', name: 'Social command centre', origin: [0, 7], size: [10, 6], desks: 10 },
  { key: 'commercial', name: 'Finance and commercial', origin: [11, 7], size: [8, 6], desks: 6 },
  { key: 'operations', name: 'Operations', origin: [20, 9], size: [8, 5], desks: 6 },
]
