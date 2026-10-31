export const WORLD_MODE_KEY = 'yaounde-world-mode';
export const WORLD_MODE_EVENT = 'yaounde-world-mode-change';

export function isGeographicWorldEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const query = new URLSearchParams(window.location.search).get('world');
  if (query === 'legacy') return false;
  if (query === 'geo' || query === 'geographic') return true;
  try {
    return window.localStorage.getItem(WORLD_MODE_KEY) !== 'legacy';
  } catch {
    return true;
  }
}

export function setGeographicWorldEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORLD_MODE_KEY, enabled ? 'geo' : 'legacy');
  } catch {
    return;
  }
  window.dispatchEvent(new Event(WORLD_MODE_EVENT));
}
