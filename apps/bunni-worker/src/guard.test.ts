import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PathGuard } from './guard'

const fixture = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'bunni-'))
  mkdirSync(path.join(root, 'master'))
  mkdirSync(path.join(root, 'production', 'episodes', 'EP001-day-one'), { recursive: true })
  writeFileSync(path.join(root, 'master', 'front.png'), 'x')
  symlinkSync(tmpdir(), path.join(root, 'escape'))
  return root
}

describe('PathGuard', () => {
  it('allows reads inside the root and refuses escapes', () => {
    const g = new PathGuard(fixture())
    expect(g.readPath('master/front.png').endsWith('/master/front.png')).toBe(true)
    expect(() => g.readPath('../outside')).toThrow()
    expect(() => g.readPath('/etc/passwd')).toThrow()
  })
  it('confines writes to one episode directory and never to references', () => {
    const g = new PathGuard(fixture())
    expect(
      g
        .writePath('EP001-day-one', 'prompts/shot-01.md')
        .includes('/production/episodes/EP001-day-one/prompts/'),
    ).toBe(true)
    expect(() => g.writePath('EP001-day-one', '../EP002-x/a.md')).toThrow()
    expect(() => g.writePath('EP001-day-one', '../../../master/front.png')).toThrow()
    expect(() => g.writePath('master', 'front.png')).toThrow()
    expect(g.isReference(g.readPath('master/front.png'))).toBe(true)
    expect(g.isReference(g.writePath('EP001-day-one', 'script.md'))).toBe(false)
    expect(
      g
        .inboxPath('ep001-s01-keyframe-abc')
        .endsWith('/production/jobs/inbox/ep001-s01-keyframe-abc.json'),
    ).toBe(true)
    expect(() => g.inboxPath('../x')).toThrow()
  })
})
