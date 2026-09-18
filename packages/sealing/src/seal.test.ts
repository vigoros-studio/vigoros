import { sha256Hex } from '@vigoros/domain'
import { describe, expect, it } from 'vitest'
import { buildMerkleTree, hexToBytes, verifyInclusion } from './merkle'
import { OtsClient } from './opentimestamps'
import { sealDay } from './seal'

const PROOF = new Uint8Array([0xf0, 0x01, 0x42, 0x08])

const stubClient = (): { client: OtsClient; stamped: string[] } => {
  const stamped: string[] = []
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    stamped.push(
      Array.from(init?.body as Uint8Array, (b) => b.toString(16).padStart(2, '0')).join(''),
    )
    return new Response(PROOF, { status: 200 })
  }) as typeof fetch
  return { client: new OtsClient({ calendars: ['https://cal.test'], fetchImpl }), stamped }
}

describe('sealDay', () => {
  it('builds the tree, stamps the root and returns a verifying proof per leaf', async () => {
    const leaves = await Promise.all([0, 1, 2, 3, 4].map((i) => sha256Hex(`commitment-${i}`)))
    const { client, stamped } = stubClient()

    const sealed = await sealDay(leaves, client)

    expect(sealed.root).toBe((await buildMerkleTree(leaves)).root)
    expect(sealed.leafCount).toBe(5)
    expect(sealed.proofs.size).toBe(5)
    for (let i = 0; i < leaves.length; i++) {
      const proof = sealed.proofs.get(i)
      expect(proof).toBeDefined()
      expect(await verifyInclusion(leaves[i] as string, proof ?? [], sealed.root)).toBe(true)
    }
    expect(stamped).toEqual([sealed.root])
    expect(sealed.ots).toEqual({ calendar: 'https://cal.test', proof: PROOF })
  })

  it('is deterministic given the leaf order', async () => {
    const leaves = await Promise.all([0, 1, 2].map((i) => sha256Hex(`c-${i}`)))
    const a = await sealDay(leaves, stubClient().client)
    const b = await sealDay(leaves, stubClient().client)
    expect(a.root).toBe(b.root)
    expect([...a.proofs.entries()]).toEqual([...b.proofs.entries()])
    const c = await sealDay([...leaves].reverse(), stubClient().client)
    expect(c.root).not.toBe(a.root)
  })

  it('seals a single commitment with an empty proof', async () => {
    const leaf = await sha256Hex('only')
    const sealed = await sealDay([leaf], stubClient().client)
    expect(sealed.root).toBe(leaf)
    expect(sealed.proofs.get(0)).toEqual([])
    expect(await verifyInclusion(leaf, [], sealed.root)).toBe(true)
  })

  it('does not stamp anything when there are no leaves', async () => {
    const { client, stamped } = stubClient()
    await expect(sealDay([], client)).rejects.toThrow(/no leaves/)
    expect(stamped).toEqual([])
  })

  it('propagates OTS failure', async () => {
    const leaf = await sha256Hex('x')
    const fetchImpl = (async () => new Response('', { status: 503 })) as typeof fetch
    const client = new OtsClient({ calendars: ['https://down.test'], fetchImpl })
    await expect(sealDay([leaf], client)).rejects.toMatchObject({ code: 'all_calendars_failed' })
    expect(hexToBytes(leaf).length).toBe(32)
  })
})
