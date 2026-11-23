import { describe, expect, it, vi } from 'vitest';

import { createMetadataRecognizer, extractUrl } from './metadata';
import type { PublicPage } from './metadata';

const BILIBILI_URL = 'https://www.bilibili.com/video/BV123?xsec_token=keep-me';

function fetcherFor(page: PublicPage | null = null) {
  const fetchPage = vi.fn(async (_url: string) => page);
  return { fetchPage, recognizer: createMetadataRecognizer({ fetchPage }) };
}

describe('URL extraction', () => {
  it('returns the first URL, removes trailing punctuation, and preserves query parameters', () => {
    expect(
      extractUrl('See https://www.xiaohongshu.com/item/1?token=a,b) and https://b23.tv/next.'),
    ).toBe('https://www.xiaohongshu.com/item/1?token=a,b');
  });

  it('keeps HTTP URLs and strips repeated trailing punctuation', () => {
    expect(extractUrl('http://b23.tv/short!!!')).toBe('http://b23.tv/short');
  });

  it('returns null when the text contains no HTTP URL', () => {
    expect(extractUrl('www.example.com or file:///tmp/item')).toBeNull();
  });
});

describe('metadata recognition', () => {
  it('reports empty input and input without a URL without fetching', async () => {
    const { fetchPage, recognizer } = fetcherFor();

    await expect(recognizer.recognize('  ')).resolves.toMatchObject({
      platform: null,
      url: null,
      problem: 'NO_INPUT',
    });
    await expect(recognizer.recognize('a pasted note only')).resolves.toMatchObject({
      platform: null,
      url: null,
      problem: 'NO_URL',
    });
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('does not fetch unsupported platforms', async () => {
    const { fetchPage, recognizer } = fetcherFor();

    await expect(recognizer.recognize('https://example.com/item/1')).resolves.toMatchObject({
      platform: null,
      url: 'https://example.com/item/1',
      problem: 'UNSUPPORTED_PLATFORM',
    });
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('parses Bilibili metadata independent of attribute order and decodes entities', async () => {
    const { fetchPage, recognizer } = fetcherFor({
      finalUrl: '',
      status: 200,
      body: `<meta content='  A &amp; B &#x4e2d;  title ' property='og:title'>
        <META content=" Creator &quot;One&quot; " name="author">`,
    });

    await expect(recognizer.recognize(BILIBILI_URL)).resolves.toEqual({
      platform: 'bilibili',
      url: BILIBILI_URL,
      title: 'A & B 中 title',
      author: 'Creator "One"',
      problem: null,
    });
    expect(fetchPage).toHaveBeenCalledWith(BILIBILI_URL);
  });

  it('decodes named and decimal or uppercase hexadecimal entities', async () => {
    const { recognizer } = fetcherFor({
      finalUrl: '',
      status: 200,
      body: `<meta property="og:title" content="A &apos; &gt; &lt; &nbsp; &#65; &#X4e2d;">
        <meta name="author" content="Author">`,
    });

    await expect(recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
      title: "A ' > < A 中",
      author: 'Author',
      problem: null,
    });

    const nbsp = fetcherFor({
      finalUrl: '',
      status: 200,
      body: '<meta property="og:title" content="A&nbsp;B"><meta name="author" content="Author">',
    });
    await expect(nbsp.recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
      title: 'A B',
      problem: null,
    });
  });

  it.each([
    [{ status: 404, body: '<title>Unavailable</title>' }, 'ERROR_PAGE'],
    [{ status: 200, body: '<title>人机验证 captcha</title>' }, 'VERIFICATION_REQUIRED'],
    [{ status: 200, body: '<title>页面不存在</title>' }, 'ERROR_PAGE'],
    [{ status: 200, body: '<title>CAPTCHA</title>' }, 'VERIFICATION_REQUIRED'],
  ] as const)('does not expose metadata from failure pages', async (page, problem) => {
    const { recognizer } = fetcherFor({ finalUrl: '', ...page });

    await expect(recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
      title: null,
      author: null,
      problem,
    });
  });

  it('treats status 400 and mixed error content as a failed page', async () => {
    const { recognizer } = fetcherFor({
      finalUrl: '',
      status: 400,
      body: '<p>ordinary text</p>',
    });
    await expect(recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
      problem: 'ERROR_PAGE',
    });

    const mixed = fetcherFor({
      finalUrl: '',
      status: 200,
      body: '<p>页面不存在, please retry</p>',
    });
    await expect(mixed.recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
      problem: 'ERROR_PAGE',
    });
  });

  it('reports missing metadata when either page field is absent', async () => {
    for (const body of [
      '<meta property="og:title" content="Title">',
      '<meta name="author" content="Author">',
    ]) {
      const { recognizer } = fetcherFor({ finalUrl: '', status: 200, body });
      await expect(recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
        problem: 'METADATA_MISSING',
      });
    }
  });

  it('reports missing metadata and unavailable fetches distinctly', async () => {
    const missing = fetcherFor({ finalUrl: '', status: 200, body: '<html></html>' });
    await expect(missing.recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
      problem: 'METADATA_MISSING',
    });

    const unavailable = fetcherFor();
    unavailable.fetchPage.mockRejectedValue(new Error('offline'));
    await expect(unavailable.recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
      problem: 'PAGE_UNAVAILABLE',
    });
  });

  it('uses a non-empty Bilibili redirect URL', async () => {
    const { recognizer } = fetcherFor({
      finalUrl: 'https://www.bilibili.com/video/BV999',
      status: 200,
      body: '<meta property="og:title" content="Title"><meta name="author" content="Author">',
    });

    await expect(recognizer.recognize(BILIBILI_URL)).resolves.toMatchObject({
      url: 'https://www.bilibili.com/video/BV999',
      problem: null,
    });
  });

  it('prefers Douyin share text and uses the final redirect URL', async () => {
    const { fetchPage, recognizer } = fetcherFor({
      finalUrl: 'https://www.douyin.com/video/123',
      status: 200,
      body: '<meta property="og:title" content="Page title"><meta name="author" content="Page author">',
    });
    const input = '【Author的作品】  Share title #topic https://v.douyin.com/abc/';

    await expect(recognizer.recognize(input)).resolves.toEqual({
      platform: 'douyin',
      url: 'https://www.douyin.com/video/123',
      title: 'Share title',
      author: 'Author',
      problem: null,
    });
    expect(fetchPage).toHaveBeenCalledWith('https://v.douyin.com/abc/');
  });

  it('uses unquoted metadata attributes and keeps an empty final URL on the request URL', async () => {
    const { recognizer } = fetcherFor({
      finalUrl: '',
      status: 200,
      body: '<meta property = og:title content = PageTitle><meta name = author content = PageAuthor>',
    });

    await expect(recognizer.recognize('https://www.douyin.com/video/123')).resolves.toMatchObject({
      url: 'https://www.douyin.com/video/123',
      title: 'PageTitle',
      author: 'PageAuthor',
      problem: null,
    });
  });

  it('uses Douyin page metadata when share text has no title or author', async () => {
    const { recognizer } = fetcherFor({
      finalUrl: '',
      status: 200,
      body: '<meta property="og:title" content="Page title"><meta name="author" content="Page author">',
    });

    await expect(recognizer.recognize('https://www.douyin.com/video/123')).resolves.toMatchObject({
      title: 'Page title',
      author: 'Page author',
      problem: null,
    });
  });

  it('uses HTTP Douyin share text before the URL', async () => {
    const { recognizer } = fetcherFor(null);

    await expect(
      recognizer.recognize('A title http://www.douyin.com/video/123'),
    ).resolves.toMatchObject({
      title: 'A title',
      problem: 'PAGE_UNAVAILABLE',
    });
  });

  it('keeps an author-only Douyin share incomplete when fetching fails', async () => {
    const { recognizer } = fetcherFor(null);

    await expect(
      recognizer.recognize('【Author的作品】 https://www.douyin.com/video/123'),
    ).resolves.toMatchObject({
      title: null,
      author: 'Author',
      problem: 'PAGE_UNAVAILABLE',
    });
  });

  it('uses a bracketed Douyin title when no author marker is present', async () => {
    const { recognizer } = fetcherFor(null);

    await expect(
      recognizer.recognize('【A shared title】 https://www.douyin.com/video/123'),
    ).resolves.toMatchObject({
      title: 'A shared title',
      author: null,
      problem: 'PAGE_UNAVAILABLE',
    });
  });

  it('cleans repeated punctuation and preserves word boundaries around hashtags', async () => {
    const { recognizer } = fetcherFor(null);

    await expect(
      recognizer.recognize(
        '【Author的作品】 ，，Title#topic suffix；； https://www.douyin.com/video/123',
      ),
    ).resolves.toMatchObject({
      title: 'Title suffix',
      author: 'Author',
      problem: null,
    });
  });

  it('requires both Douyin fields when neither source completes the metadata', async () => {
    const { recognizer } = fetcherFor({ finalUrl: '', status: 200, body: '<html></html>' });

    await expect(
      recognizer.recognize('A title https://www.douyin.com/video/123'),
    ).resolves.toMatchObject({
      title: 'A title',
      author: null,
      problem: 'METADATA_MISSING',
    });
  });

  it('parses Xiaohongshu share title and author without altering the URL query', async () => {
    const { fetchPage, recognizer } = fetcherFor();
    const url = 'https://www.xiaohongshu.com/item/1?xsec_token=secret';

    await expect(
      recognizer.recognize(`【A useful note - Author | 小红书】 ${url}`),
    ).resolves.toEqual({
      platform: 'xiaohongshu',
      url,
      title: 'A useful note',
      author: 'Author',
      problem: null,
    });
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('joins multiple Xiaohongshu title parts and rejects an empty suffix', async () => {
    const { recognizer } = fetcherFor();

    await expect(
      recognizer.recognize(
        '【First   -   Second   -   Author | 小红书】 https://www.xiaohongshu.com/item/1',
      ),
    ).resolves.toMatchObject({
      title: 'First - Second',
      author: 'Author',
      problem: null,
    });
    await expect(
      recognizer.recognize('【 | 小红书】 https://www.xiaohongshu.com/item/1'),
    ).resolves.toMatchObject({
      title: null,
      author: null,
      problem: 'METADATA_MISSING',
    });
  });

  it('keeps an in-title Xiaohongshu marker when it is not a suffix', async () => {
    const { recognizer } = fetcherFor();
    await expect(
      recognizer.recognize('【First | 小红书 extra - Author】 https://www.xiaohongshu.com/item/1'),
    ).resolves.toMatchObject({
      title: 'First - 小红书 extra',
      author: 'Author',
      problem: null,
    });
  });

  it('reports incomplete Xiaohongshu share metadata', async () => {
    const { recognizer } = fetcherFor();

    await expect(
      recognizer.recognize('【小红书】 https://www.xiaohongshu.com/item/1'),
    ).resolves.toMatchObject({
      title: null,
      author: null,
      problem: 'METADATA_MISSING',
    });
    await expect(
      recognizer.recognize('【A useful note】 https://www.xiaohongshu.com/item/1'),
    ).resolves.toMatchObject({
      title: 'A useful note',
      author: null,
      problem: 'METADATA_MISSING',
    });
  });
});
