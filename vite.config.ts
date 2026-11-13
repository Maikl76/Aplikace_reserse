import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' – aplikace funguje na GitHub Pages bez ohledu na název repozitáře.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
