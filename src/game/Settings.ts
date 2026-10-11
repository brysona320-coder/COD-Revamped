export type Quality = 'low' | 'medium' | 'high';
export interface Settings { sensitivity: number; fov: number; volume: number; quality: Quality; reducedMotion: boolean; }
export const defaultSettings: Settings = { sensitivity: 0.2, fov: 80, volume: 0.6, quality: 'medium', reducedMotion: false };
const KEY = 'echofront.settings.v1';
export function loadSettings(): Settings {
  try {
    const candidate = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      sensitivity: clamp(Number(candidate.sensitivity) || defaultSettings.sensitivity, 0.08, 0.5),
      fov: clamp(Number(candidate.fov) || defaultSettings.fov, 65, 105),
      volume: clamp(Number(candidate.volume ?? defaultSettings.volume), 0, 1),
      quality: ['low', 'medium', 'high'].includes(candidate.quality ?? '') ? candidate.quality! : 'medium',
      reducedMotion: Boolean(candidate.reducedMotion),
    };
  } catch { return { ...defaultSettings }; }
}
export function saveSettings(value: Settings): void { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* private browsing */ } }
export function clamp(n: number, min: number, max: number): number { return Math.max(min, Math.min(max, n)); }
