const nextJest = require('next/jest');

// next/jest ships with the `next` package already installed here, so it
// needs no separate babel/ts-jest transform dependency — it reuses Next's
// own SWC compiler and automatically loads next.config.mjs/.env files.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};

module.exports = createJestConfig(customJestConfig);
