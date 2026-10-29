import { useEffect, useState } from 'react';
import { useGame } from '../state/store';
import { setLanguage } from '../i18n';
import { Icon, MboaMark } from './icons';
import { InstallBanner } from './InstallPrompt';

type InfoSheet = 'about' | 'privacy' | 'terms' | null;

function getTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function MainMenu() {
  const saves = useGame((s) => s.menuSaves);
  const booting = useGame((s) => s.booting);
  const cloud = useGame((s) => s.cloud);
  const cloudMessage = useGame((s) => s.cloudMessage);
  const openAccount = useGame((s) => s.openAccount);
  const setScreen = useGame((s) => s.setScreen);
  const continueGame = useGame((s) => s.continueGame);
  const deleteSave = useGame((s) => s.deleteSave);
  const loadCloudLast = useGame((s) => s.loadCloudLast);
  const refreshMenuSaves = useGame((s) => s.refreshMenuSaves);
  const [theme, setTheme] = useState<'light' | 'dark'>(getTheme);
  const [info, setInfo] = useState<InfoSheet>(null);
  const [lang, setLang] = useState<'en' | 'fr'>(() =>
    (typeof localStorage !== 'undefined' ? localStorage.getItem('yaounde-lang') : null) === 'fr' ? 'fr' : 'en',
  );
  const fr = lang === 'fr';
  const latest = saves[0];

  useEffect(() => {
    void refreshMenuSaves();
  }, [refreshMenuSaves]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem('yaounde-theme', next);
    } catch {
      /* private mode */
    }
  };

  const t = (en: string, frText: string) => (fr ? frText : en);

  return (
    <div className="menu-screen">
      <div className="menu-top">
        <div className="menu-brand">
          <span className="menu-brand-mark">
            <MboaMark size={26} />
          </span>
          <span className="menu-brand-name">
            Yaoundé Life
            <span>{t('Mboa Life', 'Mboa Life')}</span>
          </span>
        </div>
        <div className="menu-top-actions">
          <div className="menu-lang" role="group" aria-label={t('Language', 'Langue')}>
            <button
              className={!fr ? 'selected' : ''}
              onClick={() => {
                setLanguage('en');
                setLang('en');
              }}
            >
              EN
            </button>
            <button
              className={fr ? 'selected' : ''}
              onClick={() => {
                setLanguage('fr');
                setLang('fr');
              }}
            >
              FR
            </button>
          </div>
          <button className="menu-icon-btn" onClick={toggleTheme} aria-label={t('Toggle night mode', 'Mode nuit')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
          </button>
          <button className="menu-icon-btn" onClick={openAccount} aria-label={t('Account', 'Compte')}>
            <Icon name="account" size={18} />
          </button>
        </div>
      </div>

      <div className="menu-hero">
        <div className="menu-hero-copy">
          <span className="menu-kicker">
            <span className="chip" aria-hidden="true">CM</span> {t('Yaoundé, Cameroon · free in your browser', 'Yaoundé, Cameroun · gratuit dans ton navigateur')}
          </span>
          <h1 className="menu-title">
            {t('Live your', 'Vis ta')} <em>{t('Yaoundé', 'vie à Yaoundé')}</em> {t('story.', 'story.')}
          </h1>
          <p className="menu-tagline">{t('Nine districts. One hustle. Your story.', 'Neuf quartiers. Une débrouille. Ton histoire.')}</p>
          <p className="menu-sub">
            {t(
              'Ride taxis in Mvog-Mbi, eat beans at Mokolo, dodge delestage, vote for your mayor — and build a life that feels like yours.',
              'Prends le taxi à Mvog-Mbi, mange les haricots à Mokolo, gère le délestage, vote pour ton maire — et construis ta vie.',
            )}
          </p>
          <div className="menu-feature-row">
            <span className="feature-chip">
              <Icon name="location" size={13} /> {t('9 real quartiers', '9 vrais quartiers')}
            </span>
            <span className="feature-chip">
              <Icon name="offline" size={13} /> {t('Offline saves', 'Sauvegarde hors-ligne')}
            </span>
            <span className="feature-chip">
              <Icon name="bank" size={13} /> {t('FCFA economy', 'Économie FCFA')}
            </span>
            <span className="feature-chip">
              <Icon name="njangi" size={13} /> {t('Njangi & business', 'Njangi & business')}
            </span>
            <span className="feature-chip">
              <Icon name="bank" size={13} /> {t('Mayor elections', 'Élections du maire')}
            </span>
          </div>
          <div className="menu-cta-row">
            {latest ? (
              <>
                <button className="menu-cta" onClick={() => void continueGame(latest.characterId)}>
                  <Icon name="play" size={18} /> {t('Continue', 'Continuer')} — {latest.state.player.name}
                </button>
                <button className="menu-cta-secondary" onClick={() => setScreen('create')}>
                  <Icon name="newLife" size={17} /> {t('New life', 'Nouvelle vie')}
                </button>
              </>
            ) : (
              <>
                <button className="menu-cta" onClick={() => setScreen('create')}>
                  <Icon name="newLife" size={18} /> {t('Create your Yaoundéan · free', 'Crée ton Yaoundéen · gratuit')}
                </button>
                <button className="menu-cta-secondary" onClick={openAccount}>
                  <Icon name="account" size={17} /> {t('I have an account', 'J’ai un compte')}
                </button>
              </>
            )}
          </div>
          <p className="menu-cta-note">
            {t(
              'No download. No ads. Your game saves on this device and can sync to the cloud.',
              'Pas de téléchargement. Pas de pubs. Ta partie reste sur cet appareil et peut se synchroniser.',
            )}
          </p>
        </div>

        <div className="menu-panel">
          <div className="menu-panel-head">
            <div>
              <h2 className="menu-panel-title">{latest ? t('Welcome back', 'Bon retour') : t('Your city is waiting', 'Ta ville t’attend')}</h2>
              <p className="menu-panel-sub">
                {booting
                  ? t('Checking your saves…', 'Vérification des sauvegardes…')
                  : t('Pick up where you left off.', 'Reprends là où tu t’es arrêté.')}
              </p>
            </div>
            <span className="chip">
              <Icon name={cloud.connected ? 'cloud' : 'offline'} size={12} /> {cloud.connected ? t('Cloud on', 'Cloud actif') : t('Offline', 'Hors-ligne')}
            </span>
          </div>

          <div className="menu-account-row">
            <span className="menu-account-avatar">
              <Icon name={cloud.connected ? 'cloud' : 'account'} size={18} />
            </span>
            <div className="menu-account-main">
              <strong>
                {cloud.connected
                  ? cloud.anonymous
                    ? t('Anonymous account', 'Compte anonyme')
                    : cloud.displayName || cloud.email || t('My account', 'Mon compte')
                  : t('Play without an account', 'Jouer sans compte')}
              </strong>
              <span>
                {cloud.connected
                  ? t('Progress can sync across devices.', 'La progression peut se synchroniser.')
                  : t('Local save only until you sign in.', 'Sauvegarde locale jusqu’à connexion.')}
              </span>
            </div>
            <button className="mini" onClick={openAccount}>
              {cloud.connected ? t('Account', 'Compte') : t('Sign in', 'Connexion')}
            </button>
          </div>

          {booting ? (
            <p className="muted small">{t('Loading…', 'Chargement…')}</p>
          ) : (
            <>
              {latest && (
                <button className="menu-btn menu-primary" onClick={() => void continueGame(latest.characterId)}>
                  <Icon name="play" size={16} /> {t('Continue', 'Continuer')} — {latest.state.player.name} · {t('Day', 'Jour')}{' '}
                  {latest.gameDay}
                </button>
              )}
              <button className="menu-btn" onClick={() => setScreen('create')}>
                <Icon name="newLife" size={16} /> {t('Start a new life', 'Commencer une nouvelle vie')}
              </button>
              {cloud.connected && (
                <button className="menu-btn" onClick={() => void loadCloudLast()}>
                  <Icon name="cloudDownload" size={16} /> {t('Load cloud save', 'Charger la sauvegarde cloud')}
                </button>
              )}

              {saves.length > 0 && (
                <div className="saves-list">
                  <h3>{t('Your lives', 'Tes vies')}</h3>
                  {saves.slice(0, 4).map((save) => (
                    <div key={save.characterId} className="save-row">
                      <button className="save-card" onClick={() => void continueGame(save.characterId)}>
                        <span className="save-card-avatar" aria-hidden="true">
                          {save.state.player.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="save-card-main">
                          <span className="save-card-name">{save.state.player.name}</span>
                          <span className="save-card-meta">
                            {t('Day', 'Jour')} {save.gameDay} · {new Date(save.updatedAt).toLocaleDateString(fr ? 'fr-FR' : 'en-GB')}
                          </span>
                        </span>
                        <Icon name="play" size={14} />
                      </button>
                      <button
                        className="mini danger"
                        aria-label={t('Delete save', 'Supprimer la sauvegarde')}
                        onClick={() => {
                          if (window.confirm(t('Delete this save?', 'Supprimer cette sauvegarde ?'))) {
                            void deleteSave(save.characterId);
                          }
                        }}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {saves.length === 0 && (
                <p className="muted small">{t('No saved lives yet. Start one — it takes a minute.', 'Aucune vie sauvegardée. Commence-en une.')}</p>
              )}
            </>
          )}

          <InstallBanner fr={fr} />

          {cloudMessage && <p className="muted small">{cloudMessage}</p>}
          <p className="menu-note">
            <Icon name="offline" size={12} /> {t('Your story. Your choices. Your hustle.', 'Ton histoire. Tes choix. Ta débrouille.')}
          </p>
        </div>
      </div>

      <div className="menu-footer">
        <span>(c) {new Date().getFullYear()} Yaoundé Life · {t('a fictional city sim', 'une simulation fictive')}</span>
        <div className="menu-footer-links">
          <button onClick={() => setInfo('about')}>{t('About', 'À propos')}</button>
          <button onClick={() => setInfo('privacy')}>{t('Privacy', 'Confidentialité')}</button>
          <button onClick={() => setInfo('terms')}>{t('Terms', 'Conditions')}</button>
          <button onClick={openAccount}>{t('Account', 'Compte')}</button>
        </div>
      </div>

      {info && (
        <div className="modal-backdrop" onClick={() => setInfo(null)}>
          <div className="modal info-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-kicker">
              <Icon name="location" size={13} /> Yaoundé Life
            </div>
            {info === 'about' && (
              <>
                <h2>{t('Live your Yaoundé story', 'Vis ton histoire à Yaoundé')}</h2>
                <p>
                  {t(
                    'Yaoundé Life is a playable life simulator set in nine quartiers of Yaoundé. Wake up, handle rent and needs, take a taxi or moto, work shifts and gigs, trade at market, run a business, join a njangi, and vote for the city mayor.',
                    'Yaoundé Life est un simulateur de vie jouable dans neuf quartiers de Yaoundé. Réveille-toi, gère le loyer et les besoins, prends taxi ou moto, travaille, fais du commerce, monte une affaire, rejoins un njangi et vote pour le maire.',
                  )}
                </p>
                <p>
                  {t(
                    'It is fiction. Prices, wages and events are indicative, and the game never converts in-game francs to real money.',
                    'C’est une fiction. Les prix, salaires et événements sont indicatifs, et le jeu ne convertit jamais les francs du jeu en argent réel.',
                  )}
                </p>
                <h3>{t('Built for the city', 'Pensé pour la ville')}</h3>
                <p>
                  {t(
                    'Districts, food, transport, delestage and njangi are drawn from Yaoundé life. Every sensitive cultural detail is labelled for local review.',
                    'Les quartiers, la nourriture, le transport, le délestage et le njangi s’inspirent de la vie à Yaoundé. Chaque détail culturel sensible est signalé pour relecture locale.',
                  )}
                </p>
              </>
            )}
            {info === 'privacy' && (
              <>
                <h2>{t('Privacy, simply', 'Confidentialité, simplement')}</h2>
                <p>
                  {t(
                    'The game runs in your browser. Your save is stored locally in IndexedDB on this device. Cloud sync is optional and only happens after you sign in.',
                    'Le jeu tourne dans ton navigateur. Ta sauvegarde est stockée localement dans IndexedDB sur cet appareil. La synchronisation cloud est optionnelle et ne se fait qu’après connexion.',
                  )}
                </p>
                <p>
                  {t(
                    'We do not use ad trackers. Anonymous accounts exist so you can play first and create a permanent account later.',
                    'Nous n’utilisons pas de traqueurs publicitaires. Les comptes anonymes existent pour jouer d’abord et créer un compte permanent ensuite.',
                  )}
                </p>
                <p>
                  {t(
                    'You can export or delete your save at any time from Settings, and delete cloud data from the Account panel.',
                    'Tu peux exporter ou supprimer ta sauvegarde à tout moment depuis les Réglages, et supprimer les données cloud depuis le panneau Compte.',
                  )}
                </p>
              </>
            )}
            {info === 'terms' && (
              <>
                <h2>{t('Terms in plain words', 'Conditions en clair')}</h2>
                <p>
                  {t(
                    'Yaoundé Life is a game. In-game francs have no real-world value. Nothing in the game is financial, legal or medical advice.',
                    'Yaoundé Life est un jeu. Les francs du jeu n’ont aucune valeur réelle. Rien dans le jeu ne constitue un conseil financier, juridique ou médical.',
                  )}
                </p>
                <p>
                  {t(
                    'Be kind in social features. Content that targets real people or groups is not welcome. Report inaccurate cultural content with the in-game report button.',
                    'Sois bienveillant dans les fonctions sociales. Les contenus qui visent des personnes ou groupes réels ne sont pas les bienvenus. Signale les contenus culturels inexacts avec le bouton de signalement.',
                  )}
                </p>
              </>
            )}
            <button className="menu-btn menu-primary" style={{ marginTop: 14 }} onClick={() => setInfo(null)}>
              {t('Back to the city', 'Retour à la ville')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
