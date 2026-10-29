import { useGame } from '../../state/store';
import { FURNITURE, FURNITURE_CATEGORY_LABELS, FURNITURE_MAP } from '../../data/furniture';
import { Icon, type IconName } from '../icons';

export function HomeApp() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const dispatch = useGame.getState().dispatch;
  const comfort = s.home?.comfort ?? 0;
  const owned = new Set(s.home?.items ?? []);
  const moodBonus = Math.min(8, Math.round(comfort / 5));
  const energyBonus = Math.min(6, Math.round(comfort / 8));

  return (
    <div>
      <div className="home-comfort">
        <div>
          <div className="muted small">{fr ? 'Confort de la chambre' : 'Room comfort'}</div>
          <strong>{comfort}</strong>
        </div>
        <div className="muted small" style={{ textAlign: 'right' }}>
          <Icon name="needMood" size={13} /> +{moodBonus} {fr ? 'humeur' : 'mood'}
          <br />
          <Icon name="needEnergy" size={13} /> +{energyBonus} {fr ? 'énergie' : 'energy'}
          <br />
          <span>{fr ? 'chaque matin' : 'each morning'}</span>
        </div>
      </div>

      <div className="map-hint">
        <Icon name="home" size={14} />
        {fr
          ? 'Un chez-soi confortable améliore ton humeur et ton énergie au réveil.'
          : 'A comfortable home lifts your mood and energy when you wake up.'}
      </div>

      <h3>{fr ? 'Tes meubles' : 'Your furniture'}</h3>
      {owned.size === 0 ? (
        <div className="muted small">
          {fr ? 'La chambre est vide. Commence par un matelas ou une marmite.' : 'The room is empty. Start with a mattress or a cooking pot.'}
        </div>
      ) : (
        <div className="home-grid">
          {[...owned].map((id) => {
            const def = FURNITURE_MAP[id];
            if (!def) return null;
            return (
              <div key={id} className="home-item owned">
                <span className="home-item-icon">
                  <Icon name={(def.icon as IconName) ?? 'home'} size={20} />
                </span>
                <span className="home-item-name">{fr ? def.nameFr : def.name}</span>
                <span className="home-item-desc">
                  {fr ? def.blurbFr : def.blurb} · +{def.comfort}
                </span>
                <button onClick={() => dispatch({ type: 'home_sell', itemId: id })}>
                  {fr ? `Vendre (${Math.round(def.price * 0.5).toLocaleString()} F)` : `Sell (${Math.round(def.price * 0.5).toLocaleString()} F)`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <h3>{fr ? 'Boutique' : 'Shop'}</h3>
      {(['sleep', 'kitchen', 'living', 'utility', 'style'] as const).map((cat) => {
        const items = FURNITURE.filter((f) => f.category === cat && !owned.has(f.id));
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <div className="muted small" style={{ margin: '8px 0 5px', fontWeight: 700 }}>
              {fr ? FURNITURE_CATEGORY_LABELS[cat].fr : FURNITURE_CATEGORY_LABELS[cat].en}
            </div>
            <div className="home-grid">
              {items.map((def) => (
                <div key={def.id} className="home-item">
                  <span className="home-item-icon">
                    <Icon name={(def.icon as IconName) ?? 'home'} size={20} />
                  </span>
                  <span className="home-item-name">{fr ? def.nameFr : def.name}</span>
                  <span className="home-item-desc">{fr ? def.blurbFr : def.blurb}</span>
                  <button
                    disabled={s.wallet.cash + s.wallet.momo < def.price}
                    onClick={() => dispatch({ type: 'home_buy', itemId: def.id })}
                  >
                    {def.price.toLocaleString()} F · +{def.comfort}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
