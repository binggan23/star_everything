import { describe, expect, it } from 'vitest';

import { formatContentLabels, parseContentLabels } from './labels';

describe('content labels', () => {
  it('parses whitespace-separated hashes, removes empty values, and deduplicates case-insensitively', () => {
    expect(parseContentLabels('  #Travel   ##Food #travel ###Art #FOOD ### foo#bar ')).toEqual([
      'Travel',
      'Food',
      'Art',
      'foo#bar',
    ]);
  });

  it('formats stored names with one hash and keeps their order', () => {
    expect(formatContentLabels(['Travel', 'Food & Drink'])).toBe('#Travel #Food & Drink');
    expect(formatContentLabels([])).toBe('');
  });
});
