import { describe, expect, it } from 'vitest';

import { detectPlatform, SEEDED_PLATFORM_LABEL_IDS } from './platforms';

describe('platform detection', () => {
  it.each([
    ['https://www.bilibili.com/video/BV1', 'bilibili'],
    ['http://b23.tv/short', 'bilibili'],
    ['https://m.douyin.com/video/1', 'douyin'],
    ['https://iesdouyin.com/share/video/1', 'douyin'],
    ['https://www.xiaohongshu.com/item/1', 'xiaohongshu'],
    ['https://xhslink.com/a/1', 'xiaohongshu'],
  ] as const)('detects %s', (url, platform) => {
    expect(detectPlatform(url)).toBe(platform);
  });

  it.each([
    'not a URL',
    'ftp://www.bilibili.com/video/1',
    'https://bilibili.com.example.org/video/1',
    'https://notbilibili.com/video/1',
    'https://example.com/?next=https://bilibili.com',
  ])('rejects unsupported or deceptive URL %s', (url) => {
    expect(detectPlatform(url)).toBeNull();
  });

  it('keeps seeded platform IDs stable', () => {
    expect(SEEDED_PLATFORM_LABEL_IDS).toEqual({
      bilibili: 'platform-bilibili',
      douyin: 'platform-douyin',
      xiaohongshu: 'platform-xiaohongshu',
    });
  });
});
