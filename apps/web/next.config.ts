import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@vigoros/db',
    '@vigoros/domain',
    '@vigoros/jobs',
    '@vigoros/prices',
    '@vigoros/questions',
    '@vigoros/reference',
    '@vigoros/scoring',
    '@vigoros/sealing',
  ],
  serverExternalPackages: ['postgres'],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
}

export default config
