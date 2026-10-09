import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  casing: 'snake_case',
  schema: './src/schema.ts',
  out: './migrations',
  schemaFilter: ['studio'],
  migrations: { schema: 'studio', table: 'migrations' },
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
})
