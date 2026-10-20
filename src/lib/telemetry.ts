type TelemetryEnv = {
  VITE_SENTRY_DSN?: string;
  VITE_POSTHOG_KEY?: string;
  VITE_POSTHOG_HOST?: string;
};

type SentryGlobal = { init(options: { dsn: string; tracesSampleRate: number }): void };
type PostHogGlobal = { init(key: string, options: Record<string, unknown>): void };

const SENTRY_VERSION = '11.8.0';
const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';
const env = import.meta.env as unknown as TelemetryEnv;

function whenIdle(run: () => void): void {
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => run(), { timeout: 4000 });
  else window.setTimeout(run, 2500);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function posthogAssetsUrl(host: string): string {
  try {
    const api = new URL(host);
    if (api.hostname === 'eu.i.posthog.com') return 'https://eu-assets.i.posthog.com/static/array.js';
    if (api.hostname === 'us.i.posthog.com') return 'https://us-assets.i.posthog.com/static/array.js';
    return `${api.origin}/static/array.js`;
  } catch {
    return 'https://eu-assets.i.posthog.com/static/array.js';
  }
}

async function initSentry(dsn: string): Promise<void> {
  try {
    await loadScript(`https://browser.sentry-cdn.com/${SENTRY_VERSION}/bundle.min.js`);
    const sentry = (window as Window & { Sentry?: SentryGlobal }).Sentry;
    sentry?.init({ dsn, tracesSampleRate: 0 });
  } catch {
    /* telemetry is best-effort */
  }
}

async function initPostHog(key: string, host: string): Promise<void> {
  try {
    await loadScript(posthogAssetsUrl(host));
    const posthog = (window as Window & { posthog?: PostHogGlobal }).posthog;
    posthog?.init(key, { api_host: host, capture_pageview: true, autocapture: false });
  } catch {
    /* telemetry is best-effort */
  }
}

export function initTelemetry(): void {
  const dsn = env.VITE_SENTRY_DSN?.trim();
  const posthogKey = env.VITE_POSTHOG_KEY?.trim();
  if (!dsn && !posthogKey) return;
  whenIdle(() => {
    if (dsn) void initSentry(dsn);
    if (posthogKey) void initPostHog(posthogKey, env.VITE_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST);
  });
}
