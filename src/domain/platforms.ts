export type PlatformKey = 'bilibili' | 'douyin' | 'xiaohongshu';

/**
 * Seeded platform label IDs. They must stay in sync with the initial
 * `platform_labels` rows in `src/data/migrations.ts`.
 */
export const SEEDED_PLATFORM_LABEL_IDS: Readonly<Record<PlatformKey, string>> = {
  bilibili: 'platform-bilibili',
  douyin: 'platform-douyin',
  xiaohongshu: 'platform-xiaohongshu',
};

const PLATFORM_DOMAINS: ReadonlyArray<{ platform: PlatformKey; domains: readonly string[] }> = [
  { platform: 'bilibili', domains: ['bilibili.com', 'b23.tv'] },
  { platform: 'douyin', domains: ['douyin.com', 'iesdouyin.com'] },
  { platform: 'xiaohongshu', domains: ['xiaohongshu.com', 'xhslink.com'] },
];

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** The supported platform whose public domain hosts `url`, if any. */
export function detectPlatform(url: string): PlatformKey | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const hostname = parsed.hostname.toLowerCase();
  const match = PLATFORM_DOMAINS.find(({ domains }) =>
    domains.some((domain) => hostMatches(hostname, domain)),
  );
  return match?.platform ?? null;
}
