import { realpathSync } from 'node:fs'
import path from 'node:path'

/**
 * The only path logic in the worker. Reads may touch anything under the root; writes may touch
 * only an episode directory under production/episodes. Symlinks are resolved before checking,
 * so a link out of the folder is refused like any other escape.
 */
export class PathGuard {
  readonly root: string
  readonly episodesDir: string

  constructor(root: string) {
    this.root = realpathSync(path.resolve(root))
    this.episodesDir = path.join(this.root, 'production', 'episodes')
  }

  private within(target: string, base: string): boolean {
    const rel = path.relative(base, target)
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
  }

  /** Absolute path for a read, or throws. */
  readPath(relative: string): string {
    const abs = path.resolve(this.root, relative)
    if (!this.within(abs, this.root)) throw new GuardError('read', relative)
    return abs
  }

  /** Absolute path for a write inside one episode directory, or throws. */
  writePath(episode: string, relative: string): string {
    if (!/^EP\d{3}-[a-z0-9-]{3,40}$/.test(episode))
      throw new GuardError('write', `${episode}/${relative}`)
    const dir = path.join(this.episodesDir, episode)
    const abs = path.resolve(dir, relative)
    if (!this.within(abs, dir)) throw new GuardError('write', `${episode}/${relative}`)
    return abs
  }

  /** Reference files are canonical and never writable, whatever the caller asks. */
  isReference(abs: string): boolean {
    return !this.within(abs, this.episodesDir)
  }
}

export class GuardError extends Error {
  constructor(
    readonly op: 'read' | 'write',
    readonly target: string,
  ) {
    super(`path guard refused ${op} of ${target}`)
  }
}
