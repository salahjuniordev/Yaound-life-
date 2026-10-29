import { useEffect, useState } from 'react';
import { Icon } from './icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useInstallPrompt() {
  const [available, setAvailable] = useState(Boolean(deferredPrompt));
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      setAvailable(true);
    };
    const onInstalled = () => {
      deferredPrompt = null;
      setAvailable(false);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      deferredPrompt = null;
      setAvailable(false);
      return true;
    }
    return false;
  };

  return { available, installed, install, ios: isIos() };
}

export function InstallBanner({ fr = false }: { fr?: boolean }) {
  const { available, installed, install, ios } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (installed) return null;

  if (!available && !ios) {
    return (
      <div className="install-banner">
        <span className="install-banner-icon">
          <Icon name="phone" size={18} />
        </span>
        <div className="install-banner-copy">
          <strong>{fr ? 'Installe Yaoundé Life' : 'Install Yaoundé Life'}</strong>
          {fr ? 'Plein écran, plus rapide, comme une vraie app.' : 'Full screen, faster, like a real app.'}
        </div>
      </div>
    );
  }

  if (ios && !available) {
    return (
      <div className="install-banner">
        <span className="install-banner-icon">
          <Icon name="phone" size={18} />
        </span>
        <div className="install-banner-copy">
          <strong>{fr ? 'Ajoute à ton écran d’accueil' : 'Add to your home screen'}</strong>
          {showIosHelp
            ? fr
              ? 'Partage → Sur l’écran d’accueil.'
              : 'Share → Add to Home Screen.'
            : fr
              ? 'Plein écran et ouverture plus rapide.'
              : 'Full screen and faster launch.'}
        </div>
        <div className="install-banner-actions">
          <button onClick={() => setShowIosHelp((v) => !v)}>{showIosHelp ? (fr ? 'OK' : 'OK') : fr ? 'Comment ?' : 'How?'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="install-banner">
      <span className="install-banner-icon">
        <Icon name="phone" size={18} />
      </span>
      <div className="install-banner-copy">
        <strong>{fr ? 'Installe Yaoundé Life' : 'Install Yaoundé Life'}</strong>
        {fr ? 'Plein écran, plus rapide, comme une vraie app.' : 'Full screen, faster, like a real app.'}
      </div>
      <div className="install-banner-actions">
        <button onClick={() => void install()}>{fr ? 'Installer' : 'Install'}</button>
      </div>
    </div>
  );
}
