export const themes = ['system', 'light', 'dark'] as const;

export type Settings = {
  theme: (typeof themes)[number];
  recognizeMetadata: boolean;
};
