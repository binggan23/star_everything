import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Live network requests are not allowed in tests.');
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
