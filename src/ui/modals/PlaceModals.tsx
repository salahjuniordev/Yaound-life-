import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useGame } from '../../state/store';
import { ACTIVITY_MAP } from '../../data/activities';
import { ITEM_MAP, itemName } from '../../data/items';
import { INTERIORS, PLACE_MAP } from '../../data/places';
import { LANDMARKS } from '../../data/districts';
import { getVendorStock, sellPriceFor } from '../../sim/engine';
import { Icon, SoccerBallIcon, type IconName } from '../icons';
import type { ActivityDef } from '../../sim/types';

const EFFECT_ICONS: Record<string, IconName> = {
  hunger: 'needFood',
  energy: 'needEnergy',
  health: 'needHealth',
  hygiene: 'needHygiene',
  mood: 'needMood',
  social: 'needSocial',
};

function activityPreview(a: ActivityDef, fr: boolean): ReactNode {
  const parts: ReactNode[] = [`${a.minutes} min`];
  if (a.cost) parts.push(`-${a.cost.toLocaleString()} F`);
  if (a.income) parts.push(`+${a.income.toLocaleString()} F`);
  const fx = a.effects;
  if (fx) {
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'money' || typeof v !== 'number') continue;
      parts.push(
        <span key={k} className="fx-line">
          <Icon name={EFFECT_ICONS[k] ?? 'check'} size={12} />
          {v > 0 ? '+' : ''}
          {v}
        </span>,
      );
    }
  }
  if (a.skill) {
    parts.push(
      <span key="skill" className="fx-line">
        <Icon name="skillUp" size={12} />
        {a.skill.key} +{a.skill.gain}
      </span>,
    );
  }
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          {p}
        </Fragment>
      ))}
    </>
  );
}

export function ActivityModal({ placeId, actions }: { placeId: string; actions: string[] }) {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);
  if (!engine) return null;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const close = () => useGame.getState().setModal({ kind: 'none' });
  const place = PLACE_MAP[placeId];
  const landmark = place?.landmarkId ? LANDMARKS.find((l) => l.id === place.landmarkId) : null;
  const list = actions.map((id) => ACTIVITY_MAP[id]).filter(Boolean);

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-kicker">
          {place?.icon === 'ball' ? <SoccerBallIcon size={14} /> : <Icon name="location" size={14} />}{' '}
          {fr ? place?.nameFr : place?.name}
        </div>
        {landmark && (
          <p className="muted small">{fr ? landmark.descriptionFr : landmark.description}</p>
        )}
        <div className="choices">
          {list.map((a) => (
            <button
              key={a.id}
              className="choice-btn activity-choice"
              onClick={() => {
                d({ type: 'activity', activityId: a.id });
                close();
              }}
            >
              <span className="activity-name">{fr && a.nameFr ? a.nameFr : a.name}</span>
              <span className="muted small">{activityPreview(a, fr)}</span>
            </button>
          ))}
          {place?.landmarkId && (
            <button className="choice-btn" onClick={() => useGame.getState().setModal({ kind: 'photo', landmarkId: place.landmarkId })}>
              <span className="choice-line">
                <Icon name="camera" size={15} /> {fr ? 'Prendre une photo' : 'Take a photo'}
              </span>
            </button>
          )}
        </div>
        <button className="choice-btn choice-muted" onClick={close}>
          {fr ? 'Fermer' : 'Close'}
        </button>
      </div>
    </div>
  );
}

export function VendorModal({ placeId, vendorKind }: { placeId: string; vendorKind: string }) {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);
  const [sellQty, setSellQty] = useState<Record<string, number>>({});
  if (!engine) return null;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const close = () => useGame.getState().setModal({ kind: 'none' });
  const place = PLACE_MAP[placeId];
  const stock = useMemo(() => getVendorStock(s, vendorKind, place?.district ?? s.player.district), [vendorKind, s.world.day, s.world.minute]);
  const sellable = s.inventory.filter((i) => (ITEM_MAP[i.itemId]?.tradeable ?? false) && i.qty > 0);

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal vendor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-kicker">
          <Icon name="market" size={14} /> {fr ? place?.nameFr : place?.name}
        </div>
        <h2>{fr ? 'Acheter' : 'Buy'}</h2>
        <div className="vendor-list">
          {stock.length === 0 && <p className="muted small">{fr ? 'Ce vendeur propose des services, pas des biens.' : 'This vendor offers services, not goods.'}</p>}
          {stock.map((entry) => (
            <div key={entry.itemId} className="vendor-row">
              <span>
                {itemName(entry.itemId, fr)}
                {entry.wholesale && <span className="tag">{fr ? 'gros' : 'wholesale'}</span>}
              </span>
              <span className="muted small">{entry.price.toLocaleString()} F</span>
              <span className="qty-btns">
                {[1, 5, 10].map((q) => (
                  <button key={q} className="mini" onClick={() => d({ type: 'buy', itemId: entry.itemId, qty: q, vendor: vendorKind })}>
                    +{q}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
        {sellable.length > 0 && (
          <>
            <h3>{fr ? 'Vendre' : 'Sell'}</h3>
            <div className="vendor-list">
              {sellable.map((inv) => {
                const price = sellPriceFor(s, inv.itemId, s.player.district);
                return (
                  <div key={inv.itemId} className="vendor-row">
                    <span>
                      {itemName(inv.itemId, fr)} <span className="muted small">×{inv.qty}</span>
                    </span>
                    <span className="muted small">{price.toLocaleString()} F</span>
                    <span className="qty-btns">
                      <input
                        type="number"
                        min={1}
                        max={inv.qty}
                        value={sellQty[inv.itemId] ?? 1}
                        onChange={(e) => setSellQty({ ...sellQty, [inv.itemId]: Math.max(1, Math.min(inv.qty, Number(e.target.value))) })}
                        className="qty-input"
                      />
                      <button className="mini" onClick={() => d({ type: 'sell', itemId: inv.itemId, qty: sellQty[inv.itemId] ?? 1 })}>
                        {fr ? 'Vendre' : 'Sell'}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <button className="choice-btn choice-muted" onClick={close}>
          {fr ? 'Fermer' : 'Close'}
        </button>
      </div>
    </div>
  );
}

export function InteriorPanel({ interiorId, placeId }: { interiorId: string; placeId: string }) {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);
  if (!engine) return null;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const def = INTERIORS[interiorId];
  const place = PLACE_MAP[placeId];
  const actions = (def?.actions ?? []).map((id) => ACTIVITY_MAP[id]).filter(Boolean);

  return (
    <div className="interior-panel">
      <div className="interior-header">
        <span>{fr ? def?.nameFr ?? interiorId : def?.name ?? interiorId}</span>
        <button className="phone-close" onClick={() => useGame.getState().setModal({ kind: 'none' })}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="interior-actions">
        {actions.map((a) => (
          <button key={a.id} className="choice-btn activity-choice" onClick={() => d({ type: 'activity', activityId: a.id })}>
            <span className="activity-name">{fr && a.nameFr ? a.nameFr : a.name}</span>
            <span className="muted small">{activityPreview(a, fr)}</span>
          </button>
        ))}
        {def?.special === 'njangi' && (
          <button className="choice-btn" onClick={() => useGame.getState().setModal({ kind: 'njangi' })}>
            <span className="choice-line">
              <Icon name="njangi" size={15} /> {fr ? 'Gérer le njangi' : 'Manage njangi'}
            </span>
          </button>
        )}
        {def?.vendor && (
          <button
            className="choice-btn"
            onClick={() => useGame.getState().setModal({ kind: 'vendor', placeId, vendorKind: def.vendor ?? '' })}
          >
            <span className="choice-line">
              <Icon name="market" size={15} /> {fr ? 'Comptoir / boutique' : 'Counter / shop'}
            </span>
          </button>
        )}
        {def?.special === 'home' && (
          <div className="muted small">
            {fr ? 'Stage logement' : 'Housing stage'}: {Number(s.storyFlags['housing_stage'] ?? 1)}
            {Number(s.storyFlags['housing_stage'] ?? 1) >= 4 ? (
              <span>
                {' '}
                · {fr ? 'Propriétaire' : 'Homeowner'} <Icon name="check" size={12} />
              </span>
            ) : (
              <button className="mini" onClick={() => d({ type: 'housing_upgrade', stage: Number(s.storyFlags['housing_stage'] ?? 1) + 1 })}>
                {fr ? 'Améliorer' : 'Upgrade'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { activityPreview };
