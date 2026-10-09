/**
 * Credit basis for estimates. These are placeholders until read from `higgsfield model list`
 * in phase 2; every estimate carries `basis` so nobody mistakes them for verified prices.
 */
export const PRICING = {
  verified: false,
  basis: 'config v0 placeholder, unverified; replace with higgsfield model list prices in phase 2',
  keyframeCredits: 10,
  videoCreditsPerSecond: 12,
  usdPerCredit: 0.01,
} as const
