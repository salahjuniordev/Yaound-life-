import { useGame } from '../state/store';
import { setLanguage } from '../i18n';
import { Icon, MboaMark } from './icons';

export function MainMenu() {
  const saves = useGame((s) => s.menuSaves);
  const booting = useGame((s) => s.booting);
  const cloud = useGame((s) => s.cloud);
  const cloudMessage = useGame((s) => s.cloudMessage);
  const setScreen = useGame((s) => s.setScreen);
  const continueGame = useGame((s) => s.continueGame);
  const deleteSave = useGame((s) => s.deleteSave);
  const loadCloudLast = useGame((s) => s.loadCloudLast);
  const fr = (typeof localStorage !== 'undefined' ? localStorage.getItem('yaounde-lang') : null) === 'fr';
  const latest = saves[0];

  return (
    <div className="menu-screen">
      <div className="menu-hero">
        <div className="menu-logo">
          <MboaMark size={56} />
        </div>
        <h1>Yaoundé Life</h1>
        <p className="menu-tagline">{fr ? 'Neuf quartiers. Une débrouille. Ton histoire.' : 'Nine districts. One hustle. Your story.'}</p>
        <div className="menu-lang">
          <button className={!fr ? 'selected' : ''} onClick={() => setLanguage('en')}>
            English
          </button>
          <button className={fr ? 'selected' : ''} onClick={() => setLanguage('fr')}>
            Français
          </button>
        </div>
      </div>

      <div className="menu-panel">
        {booting ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            {latest && (
              <button className="menu-btn menu-primary" onClick={() => void continueGame(latest.characterId)}>
                <Icon name="play" size={16} /> {fr ? 'Continuer' : 'Continue'} — {latest.state.player.name} ·{' '}
                {fr ? 'Jour' : 'Day'} {latest.gameDay}
              </button>
            )}
            <button className="menu-btn" onClick={() => setScreen('create')}>
              <Icon name="newLife" size={16} /> {fr ? 'Nouvelle vie' : 'New life'}
            </button>
            {cloud.connected && (
              <button className="menu-btn" onClick={() => void loadCloudLast()}>
                <Icon name="cloudDownload" size={16} /> {fr ? 'Charger la sauvegarde cloud' : 'Load cloud save'}
              </button>
            )}

            {saves.length > 0 && (
              <div className="saves-list">
                <h3>{fr ? 'Sauvegardes locales' : 'Local saves'}</h3>
                {saves.slice(0, 5).map((save) => (
                  <div key={save.characterId} className="save-row">
                    <button className="list-btn" onClick={() => void continueGame(save.characterId)}>
                      <span>{save.state.player.name}</span>
                      <span className="muted small">
                        {fr ? 'Jour' : 'Day'} {save.gameDay} · {new Date(save.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      className="mini danger"
                      onClick={() => {
                        if (window.confirm(fr ? 'Supprimer cette sauvegarde ?' : 'Delete this save?')) {
                          void deleteSave(save.characterId);
                        }
                      }}
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {saves.length === 0 && <p className="muted small">{fr ? 'Aucune vie sauvegardée. Commence-en une.' : 'No saved lives yet. Start one.'}</p>}

            <p className="muted small menu-note">
              {cloud.connected ? (
                <>
                  <Icon name="cloud" size={13} />{' '}
                  {fr
                    ? 'Sync cloud active' + (cloud.anonymous ? ' (compte anonyme)' : '')
                    : 'Cloud sync active' + (cloud.anonymous ? ' (anonymous account)' : '')}
                </>
              ) : (
                <>
                  <Icon name="offline" size={13} />{' '}
                  {fr
                    ? 'Hors-ligne — la progression reste sur cet appareil'
                    : 'Offline — progress stays on this device'}
                </>
              )}
            </p>
            {cloudMessage && <p className="muted small">{cloudMessage}</p>}
            <p className="muted small menu-note">
              {fr ? 'Ton histoire. Tes choix. Ta débrouille.' : 'Your story. Your choices. Your hustle.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
