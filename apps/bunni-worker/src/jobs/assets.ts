import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { AssetEntry, BunniJobOutput } from '@vigoros/contracts'
import type { PathGuard } from './../guard'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.md': 'text/markdown',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.txt': 'text/plain',
}
const SKIP = new Set(['.DS_Store', 'CLAUDE.md'])

const walk = (dir: string, out: string[]) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = path.join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
}

/** Metadata for every reference file. Production output under production/ is listed too, read-only. */
export const assetsIndex = (guard: PathGuard): BunniJobOutput<'assets.index'> => {
  const files: string[] = []
  walk(guard.root, files)
  const assets: AssetEntry[] = files
    .map((abs) => {
      const rel = path.relative(guard.root, abs)
      const ext = path.extname(abs).toLowerCase()
      const buf = readFileSync(abs)
      return {
        id: createHash('sha256').update(rel).digest('hex').slice(0, 12),
        path: rel,
        category: rel.split(path.sep)[0] ?? '',
        bytes: buf.byteLength,
        sha256: createHash('sha256').update(buf).digest('hex'),
        mime: MIME[ext] ?? 'application/octet-stream',
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
  return { root: guard.root, indexedAt: new Date().toISOString(), assets }
}

export const assetsGet = (guard: PathGuard, id: string): BunniJobOutput<'assets.get'> => {
  const asset = assetsIndex(guard).assets.find((a) => a.id === id)
  if (!asset) throw new Error(`no asset ${id}`)
  const buf = readFileSync(guard.readPath(asset.path))
  const text = asset.mime.startsWith('text/') || asset.mime === 'application/json'
  return {
    asset,
    encoding: text ? 'utf8' : 'base64',
    content: text ? buf.toString('utf8') : buf.toString('base64'),
  }
}
