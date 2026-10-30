import { useState, useSyncExternalStore } from 'react';
import { Icon } from './icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';
type InstallHelpKind = 'ios' | 'mac-safari' | 'chromium' | 'generic';

interface InstallState {
  available: boolean;
  installed: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let state: InstallState = { available: false, installed: false };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): InstallState {
  return state;
}

function setState(patch: Partial<InstallState>) {
  const next = { ...state, ...patch };
  if (next.available === state.available && next.installed === state.installed) return;
  state = next;
  for (const listener of listeners) listener();
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function helpKind(): InstallHelpKind {
  if (isIos()) return 'ios';
  if (typeof navigator === 'undefined') return 'generic';
  const ua = navigator.userAgent;
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) {
    return 'mac-safari';
  }
  if (/Firefox/i.test(ua)) return 'generic';
  return 'chromium';
}

export function installHelpText(fr: boolean, kind: InstallHelpKind): string {
  if (kind === 'ios') {
    return fr
      ? 'Appuie sur Partager, puis sur « Sur l’écran d’accueil ».'
      : 'Tap Share, then Add to Home Screen.';
  }
  if (kind === 'mac-safari') {
    return fr
      ? 'Dans Safari, ouvre Fichier → Ajouter au Dock.'
      : 'In Safari, choose File → Add to Dock.';
  }
  if (kind === 'chromium') {
    return fr
      ? 'Ouvre le menu du navigateur et choisis « Installer l’application » (ou l’icône d’installation dans la barre d’adresse).'
      : 'Open the browser menu and choose Install app (or use the install icon in the address bar).';
  }
  return fr
    ? 'Ouvre le menu du navigateur et choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».'
    : 'Open the browser menu and choose Install app or Add to Home Screen.';
}

async function promptInstall(): Promise<InstallOutcome> {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  setState({ available: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}

if (typeof window !== 'undefined') {
  state = { available: Boolean(deferredPrompt), installed: isStandalone() };
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    setState({ available: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ available: false, installed: true });
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
    setState({ installed: isStandalone() });
  });
}

export function useInstallPrompt() {
  const installState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...installState,
    install: promptInstall,
    ios: isIos(),
    helpKind: helpKind(),
  };
}

export function InstallBanner({ fr = false }: { fr?: boolean }) {
  const { available, installed, install, helpKind: kind } = useInstallPrompt();
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  if (installed) return null;

  const onInstall = async () => {
    if (!available) {
      setShowHelp(true);
      return;
    }
    setBusy(true);
    const outcome = await install();
    setBusy(false);
    if (outcome === 'unavailable') setShowHelp(true);
  };

  return (
    <div className="install-banner">
      <span className="install-banner-icon">
        <Icon name="phone" size={18} />
      </span>
      <div className="install-banner-copy">
        <strong>{fr ? 'Installe Yaoundé Life' : 'Install Yaoundé Life'}</strong>
        <span className="install-help">
          {showHelp
            ? installHelpText(fr, kind)
            : fr
              ? 'Plein écran, plus rapide, comme une vraie app.'
              : 'Full screen, faster, like a real app.'}
        </span>
      </div>
      <div className="install-banner-actions">
        <button onClick={() => void onInstall()} disabled={busy}>
          {busy ? '…' : fr ? 'Installer' : 'Install'}
        </button>
      </div>
    </div>
  );
}
