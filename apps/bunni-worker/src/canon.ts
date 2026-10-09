import { readFileSync } from 'node:fs'
import type { PathGuard } from './guard'

/** Reads the anchor block and the never-list from character/bunni-anchor.md. Verbatim, never paraphrased. */
export const readAnchor = (guard: PathGuard): { anchor: string; never: string } => {
  const text = readFileSync(guard.readPath('character/bunni-anchor.md'), 'utf8')
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.startsWith('Bunni, the same canonical'))
  const neverIdx = lines.findIndex((l) => l.trim() === '## Never')
  const refIdx = lines.findIndex((l) => l.trim() === '## Reference order')
  if (start < 0 || neverIdx < 0) throw new Error('anchor file does not have the expected shape')
  const anchor = lines.slice(start, neverIdx).join('\n').trim()
  const never = lines
    .slice(neverIdx + 1, refIdx > 0 ? refIdx : undefined)
    .join('\n')
    .trim()
  return { anchor, never }
}

export const OUTFITS: Record<string, string> = {
  default: 'her default oversized soft pink knit sweater with the black bunny-face logo',
  'sleep-mode':
    'Sleep Mode outfit: soft pink pyjama set, long sleeves, relaxed trousers, white piping, small heart detail',
  'tiny-ceo':
    'Tiny CEO outfit: tailored pink blazer, white collared shirt, black tie, high-waisted wide-leg pink trousers, elegant pink heels',
  'street-bunni':
    'Street Bunni outfit: oversized pink hoodie, baggy pink cargo trousers, pink and white sneakers',
  cozy: 'Cozy outfit: plush pink belted robe and fluffy pink slippers',
  chef: 'Chef outfit: white chef jacket with pink piping and buttons, pink apron, white chef hat with pink accent',
}

export const ACCESSORIES: Record<string, string> = {
  none: '',
  sunglasses: 'wearing her pink sunglasses over her eyes',
  'sunglasses-on-head': 'pink sunglasses resting on top of her head',
  phone: 'holding her pink smartphone with the pink Bunni logo',
  'pink-baseball-cap': 'wearing her pink baseball cap with the black Bunni logo',
  'oversized-headphones': 'wearing large pink over-ear headphones',
  handbag: 'carrying her tiny black handbag with pink trim and a pink heart',
  facemask: 'wearing her soft pink sleep mask',
}

export const EXPRESSIONS: Record<string, string> = {
  neutral: 'default expression: mouth closed, half-lidded eyes, sleepy and mildly unimpressed',
  'happy-ish': 'happy-ish: small restrained smile, eyes still somewhat half-lidded',
  unhinged: 'unhinged: wide chaotic grin, mouth open, tongue may show, eyes animated',
  sassy: 'sassy: side-eye, raised brow, subtle smirk, confident posture',
  tired: 'tired: heavy eyelids, tiny exhausted pout, slumped posture',
  judging: 'judging: strong side-eye, one brow lifted, mouth closed, arms folded',
  angry: 'angry: brows lowered, tight mouth, tense stare, cute anger',
  excited: 'excited: eyes wider, bright open happy mouth, paws lifted',
  sad: 'sad: inner brows raised, large wet eyes, small downturned mouth',
  confused: 'confused: brows uneven, eyes glancing sideways, tiny open mouth, paw at chin',
}
