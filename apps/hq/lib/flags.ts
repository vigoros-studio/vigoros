'use client'
/** Debug toggles read from the URL, for headless capture and bisecting render problems. Never used in production paths. */
export const flag = (name: string): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(name)
