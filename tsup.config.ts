import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  bundle: true,
  noExternal: [
    '@modelcontextprotocol/sdk',
    'commander',
    'ws',
    'zod',
    'zod-to-json-schema',
    'selfsigned',
  ],
  platform: 'node',
  target: 'node18',
  clean: true,
  sourcemap: false,
})
