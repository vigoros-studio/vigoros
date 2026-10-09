import { realpathSync } from 'node:fs'
import path from 'node:path'

/**
 * The only path logic in the worker. Reads may touch anything under the root. Writes may touch
 * only an episode directory under production/episodes or Bunni's job inbox. Symlinks are resolved
 * before checking, so a link out of the folder is refused like any other escape. The reference
 * folders listed in Bunni's manifest are never written, whatever the caller asks.
 */
export class PathGuard {
  readonly root: string
  readonly episodesDir: string
  readonly inboxDir: string
  readonly outboxDir: string
  readonly interfaceDir: string

  constructor(root: string) {
    this.root = realpathSync(path.resolve(root))
    this.episodesDir = path.join(this.root, 'production', 'episodes')
    this.inboxDir = path.join(this.root, 'production', 'jobs', 'inbox')
    this.outboxDir = path.join(this.root, 'production', 'jobs', 'outbox')
    this.interfaceDir = path.join(this.root, 'production', 'interface')
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

  /** Absolute path for a job file in Bunni's inbox, or throws. */
  inboxPath(jobId: string): string {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(jobId)) throw new GuardError('write', `inbox/${jobId}`)
    return path.join(this.inboxDir, `${jobId}.json`)
  }

  /** Reference files are canonical and never writable, whatever the caller asks. */
  isReference(abs: string): boolean {
    return !this.within(abs, path.join(this.root, 'production'))
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
