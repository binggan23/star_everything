import { detectPlatform } from './platforms';
import type { PlatformKey } from './platforms';

/** A public page fetched without user credentials. */
export type PublicPage = {
  finalUrl: string;
  status: number;
  body: string;
};

/** The replaceable boundary used to read public platform pages. */
export interface PublicPageFetcher {
  fetchPage(url: string): Promise<PublicPage | null>;
}

export type RecognitionProblem =
  | 'NO_INPUT'
  | 'NO_URL'
  | 'UNSUPPORTED_PLATFORM'
  | 'PAGE_UNAVAILABLE'
  | 'VERIFICATION_REQUIRED'
  | 'ERROR_PAGE'
  | 'METADATA_MISSING';

export type RecognitionResult = {
  platform: PlatformKey | null;
  url: string | null;
  title: string | null;
  author: string | null;
  /** Why some or all metadata is missing; `null` when recognition succeeded fully. */
  problem: RecognitionProblem | null;
};

/** Recognizes platform, title, author, and URL from a URL or a share text. */
export interface MetadataRecognizer {
  recognize(input: string): Promise<RecognitionResult>;
}

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[)\]}>,.;:!?，。；：、！？）】》」』”’"']+$/u;

/** The first URL in pasted text, keeping its query string exactly as written. */
export function extractUrl(text: string): string | null {
  for (const match of text.match(URL_PATTERN) ?? []) {
    const candidate = match.replace(TRAILING_PUNCTUATION, '');
    if (candidate !== '') return candidate;
  }
  return null;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
  nbsp: ' ',
};

function decodeHtml(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith('#')) {
      const hexadecimal = entity[1] === 'x' || entity[1] === 'X';
      const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : whole;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
}

type MetaAttributes = Readonly<Record<string, string>>;

function metaAttributes(html: string): MetaAttributes[] {
  const tags: MetaAttributes[] = [];

  for (const tag of html.match(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? []) {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
      const name = match[1]?.toLowerCase();
      if (name === undefined) continue;
      attributes[name] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
    }
    tags.push(attributes);
  }

  return tags;
}

function metaContent(tags: readonly MetaAttributes[], name: string): string | null {
  for (const tag of tags) {
    const value = tag.property === name ? tag.content : tag.name === name ? tag.content : undefined;
    const cleaned = cleanText(value);
    if (cleaned !== null) return cleaned;
  }
  return null;
}

const VERIFICATION_MARKERS = [
  '安全验证',
  '人机验证',
  '验证码',
  'captcha',
  'geetest',
  'bili-mini-captcha',
];

const ERROR_MARKERS = ['页面不存在', '视频不见了', '出错啦', '404 not found'];

type PageMetadata = {
  title: string | null;
  author: string | null;
  problem: RecognitionProblem | null;
};

/** Verification and generic error pages must fail extraction instead of leaking page text. */
function pageFailure(page: PublicPage): RecognitionProblem | null {
  const body = page.body.toLowerCase();
  if (VERIFICATION_MARKERS.some((marker) => body.includes(marker))) {
    return 'VERIFICATION_REQUIRED';
  }
  if (page.status >= 400 || ERROR_MARKERS.some((marker) => body.includes(marker))) {
    return 'ERROR_PAGE';
  }
  return null;
}

function parsePublicPage(page: PublicPage): PageMetadata {
  const failure = pageFailure(page);
  if (failure !== null) return { title: null, author: null, problem: failure };

  const tags = metaAttributes(page.body);
  const title = metaContent(tags, 'og:title');
  const author = metaContent(tags, 'author');
  return {
    title,
    author,
    problem: title === null || author === null ? 'METADATA_MISSING' : null,
  };
}

function trimSharePunctuation(value: string): string {
  return value.replace(/^[，,。.、;；:：\s]+|[，,。.、;；:：\s]+$/gu, '');
}

function cleanShareTitle(value: string): string | null {
  const withoutHashtags = value.replace(/#[^\s#]+/gu, ' ');
  return cleanText(trimSharePunctuation(withoutHashtags));
}

function parseDouyinShareText(input: string): { title: string | null; author: string | null } {
  const authorMatch = input.match(/【([^】]+)的作品】/u);
  const author = authorMatch?.[1] === undefined ? null : cleanText(authorMatch[1]);

  const remainder =
    authorMatch?.index === undefined
      ? input
      : input.slice(authorMatch.index + authorMatch[0].length);
  const beforeUrl = remainder.split(/https?:\/\//iu)[0] ?? '';
  let title = cleanShareTitle(beforeUrl);

  if (title === null && authorMatch === null) {
    const bracket = input.match(/【([^】]+)】/u);
    title = bracket?.[1] === undefined ? null : cleanShareTitle(bracket[1]);
  }

  return { title, author };
}

function parseXiaohongshuShareText(input: string): {
  title: string | null;
  author: string | null;
} {
  const bracket = input.match(/【([^】]+)】/u);
  const raw = cleanText(bracket?.[1]);
  if (raw === null || raw === '小红书') return { title: null, author: null };

  const content = raw.replace(/\s*[|｜]\s*小红书\s*$/u, '').trim();
  if (content === '') return { title: null, author: null };

  const parts = content
    .split(/\s+(?:-|—|\||｜)\s+/u)
    .map((part) => cleanText(part))
    .filter((part): part is string => part !== null);

  if (parts.length < 2) return { title: content, author: null };

  return {
    title: parts.slice(0, -1).join(' - '),
    author: parts[parts.length - 1] ?? null,
  };
}

function recognizeXiaohongshu(url: string, input: string): RecognitionResult {
  const share = parseXiaohongshuShareText(input);
  return {
    platform: 'xiaohongshu',
    url,
    title: share.title,
    author: share.author,
    problem: share.title !== null && share.author !== null ? null : 'METADATA_MISSING',
  };
}

async function fetchPublicPage(
  pageFetcher: PublicPageFetcher,
  url: string,
): Promise<PublicPage | null> {
  try {
    return await pageFetcher.fetchPage(url);
  } catch {
    return null;
  }
}

function parseBilibiliPage(page: PublicPage, requestedUrl: string): RecognitionResult {
  const metadata = parsePublicPage(page);
  return {
    platform: 'bilibili',
    url: page.finalUrl === '' ? requestedUrl : page.finalUrl,
    title: metadata.title,
    author: metadata.author,
    problem: metadata.problem,
  };
}

async function recognizeDouyin(
  pageFetcher: PublicPageFetcher,
  url: string,
  input: string,
): Promise<RecognitionResult> {
  const share = parseDouyinShareText(input);
  const page = await fetchPublicPage(pageFetcher, url);
  const metadata = page === null ? null : parsePublicPage(page);
  const title = share.title ?? metadata?.title ?? null;
  const author = share.author ?? metadata?.author ?? null;
  const fallbackProblem = page === null ? 'PAGE_UNAVAILABLE' : (metadata?.problem ?? null);

  return {
    platform: 'douyin',
    url: page?.finalUrl === undefined || page.finalUrl === '' ? url : page.finalUrl,
    title,
    author,
    problem: title !== null && author !== null ? null : (fallbackProblem ?? 'METADATA_MISSING'),
  };
}

export function createMetadataRecognizer(pageFetcher: PublicPageFetcher): MetadataRecognizer {
  return {
    async recognize(input) {
      if (input.trim() === '') {
        return { platform: null, url: null, title: null, author: null, problem: 'NO_INPUT' };
      }

      const url = extractUrl(input);
      if (url === null) {
        return { platform: null, url: null, title: null, author: null, problem: 'NO_URL' };
      }

      const platform = detectPlatform(url);
      if (platform === null) {
        return { platform, url, title: null, author: null, problem: 'UNSUPPORTED_PLATFORM' };
      }

      if (platform === 'xiaohongshu') {
        return recognizeXiaohongshu(url, input);
      }

      if (platform === 'douyin') {
        return recognizeDouyin(pageFetcher, url, input);
      }

      const page = await fetchPublicPage(pageFetcher, url);
      if (page === null) {
        return { platform, url, title: null, author: null, problem: 'PAGE_UNAVAILABLE' };
      }

      return parseBilibiliPage(page, url);
    },
  };
}
