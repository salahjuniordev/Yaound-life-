import { useState } from 'react';
import { useGame } from '../../state/store';
import { getTravelPlan, zoneDistance } from '../../sim/engine';
import { ZONES, DISTRICT_MAP } from '../../data/districts';
import { Icon, type IconName } from '../icons';
import type { DistrictId } from '../../sim/types';

const MODE_ICONS: Record<string, IconName> = { walk: 'walk', taxi: 'taxi', moto: 'moto', vehicle: 'car' };

export function TravelModal() {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);
  const [selected, setSelected] = useState<DistrictId | null>(null);
  if (!engine) return null;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const close = () => useGame.getState().setModal({ kind: 'none' });
  const current = s.player.district;
  const plan = selected ? getTravelPlan(s, current, selected) : null;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal travel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-kicker">
          <Icon name="taxi" size={14} /> {fr ? 'Se déplacer' : 'Travel'}
        </div>
        <h2>{fr ? 'Où vas-tu ?' : 'Where to?'}</h2>
        {s.world.strike && <div className="money-out small">{fr ? 'Grève des taxis aujourd’hui — moto ou marche.' : 'Taxi strike today — moto or walk.'}</div>}
        <div className="zone-list">
          {ZONES.filter((z) => z.id !== current).map((z) => (
            <button
              key={z.id}
              className={`zone-item ${selected === z.id ? 'selected' : ''}`}
              onClick={() => setSelected(z.id)}
            >
              <span className="zone-name">{fr ? z.nameFr : z.name}</span>
              <span className="muted small">
                {Math.round(zoneDistance(current, z.id))} · {s.learnedRoutes.includes(z.id) ? (fr ? 'connu' : 'known') : (fr ? 'nouveau' : 'new')}
              </span>
              <span className="zone-flavor muted small">{fr ? z.flavorFr : z.flavor}</span>
            </button>
          ))}
        </div>
        {plan && (
          <div className="travel-options">
            <h3>
              {fr ? 'Vers' : 'To'} {fr ? plan.toNameFr : plan.toName}
            </h3>
            {plan.options.map((o) => (
              <button
                key={`${o.mode}_${o.vehicleId ?? ''}`}
                className="travel-option"
                disabled={!o.available}
                onClick={() => {
                  d({ type: 'travel', to: plan.to, mode: o.mode, vehicleId: o.vehicleId });
                  close();
                }}
              >
                <span className="travel-mode">
                  <Icon name={o.mode === 'vehicle' && o.vehicleKind === 'moto' ? 'moto' : MODE_ICONS[o.mode] ?? 'route'} size={15} />{' '}
                  {o.mode === 'walk'
                    ? fr ? 'Marche' : 'Walk'
                    : o.mode === 'taxi'
                      ? 'Taxi'
                      : o.mode === 'moto'
                        ? 'Moto'
                        : o.mode === 'vehicle'
                          ? o.vehicleLabel ?? (fr ? 'Véhicule perso' : 'Own vehicle')
                          : fr ? 'Trajet connu' : 'Known route'}
                </span>
                <span className="muted small">
                  {o.minutes} {fr ? 'min' : 'min'} ·{' '}
                  {o.mode === 'vehicle'
                    ? `${fr ? 'carburant' : 'fuel'} ${(o.fuelLitres ?? 0).toFixed(1)} L (~${(o.fuelCost ?? 0).toLocaleString()} F)`
                    : o.cost > 0
                      ? `${o.cost.toLocaleString()} F`
                      : fr ? 'gratuit' : 'free'}
                  {o.risk > 0.01 ? ` · ${fr ? 'risque' : 'risk'} ${Math.round(o.risk * 100)}%` : ''}
                </span>
                {!o.available && <span className="muted small">{o.unavailableReason}</span>}
              </button>
            ))}
          </div>
        )}
        <button className="choice-btn choice-muted" onClick={close}>
          {fr ? 'Fermer' : 'Close'}
        </button>
      </div>
    </div>
  );
}
