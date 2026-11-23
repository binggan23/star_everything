/** Content labels are entered as space-separated `#tag` values and stored without the `#`. */
export function parseContentLabels(value: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const token of value.split(/\s+/)) {
    const name = token.replace(/^#+/, '').trim();
    if (name === '') continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(name);
  }

  return labels;
}

/** Renders stored content labels back into the space-separated editing format. */
export function formatContentLabels(labels: readonly string[]): string {
  return labels.map((label) => `#${label}`).join(' ');
}
