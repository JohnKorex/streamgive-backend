import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'unit',
    include: [
      'test/cacheable.test.ts',
      'test/compression.test.ts',
      'test/cors.test.ts',
      'test/metrics.test.ts',
      'test/requestId.test.ts',
      'test/security-headers.test.ts',
      'test/shutdown.test.ts',
      'test/routes/serializeStream.test.ts',
    ],
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
