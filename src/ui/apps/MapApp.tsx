import { useState } from 'react';
import { useGame } from '../../state/store';
import { PLACES } from '../../data/places';
import { DISTRICT_MAP, ZONES } from '../../data/districts';
import { getTravelPlan } from '../../sim/engine';
import { openNearby } from '../interactions';
import { Icon, type IconName } from '../icons';
import type { DistrictId, TravelMode } from '../../sim/types';

const PLACE_ICON: Record<string, IconName> = {
  home: 'home',
  food: 'restaurant',
  box: 'market',
  market: 'market',
  laptop: 'jobs',
  shop: 'business',
  health: 'needHealth',
  gym: 'needEnergy',
  taxi: 'taxi',
  landmark: 'location',
  bar: 'restaurant',
  school: 'journal',
  church: 'location',
  bank: 'bank',
};

const MODE_LABEL: Record<TravelMode, { en: string; fr: string; icon: IconName }> = {
  walk: { en: 'Walk', fr: 'À pied', icon: 'walk' },
  taxi: { en: 'Taxi', fr: 'Taxi', icon: 'taxi' },
  moto: { en: 'Moto', fr: 'Moto', icon: 'moto' },
  vehicle: { en: 'My vehicle', fr: 'Mon véhicule', icon: 'car' },
  fast: { en: 'Fast route', fr: 'Trajet rapide', icon: 'route' },
};

export function MapApp() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const [selected, setSelected] = useState<DistrictId>(s.player.district);
  const dispatch = useGame.getState().dispatch;
  const zone = DISTRICT_MAP[selected];
  const current = DISTRICT_MAP[s.player.district];
  const plan = selected === s.player.district ? null : getTravelPlan(s, s.player.district, selected);
  const places = PLACES.filter((p) => p.district === selected);
  const strike = s.world.strike;

  return (
    <div>
      <div className="map-hint">
        <Icon name="map" size={14} />
        {fr ? 'Choisis un quartier, compare les trajets, puis bouge.' : 'Pick a quartier, compare routes, then move.'}
      </div>

      <div className="map-hero">
        <h3>{fr ? current?.nameFr : current?.name}</h3>
        <p>
          <Icon name="location" size={12} /> {fr ? 'Tu es ici' : 'You are here'} ·{' '}
          {s.learnedRoutes.length}/{ZONES.length} {fr ? 'quartiers connus' : 'quartiers known'}
        </p>
      </div>

      <h3>{fr ? 'Quartiers' : 'Quartiers'}</h3>
      <div className="map-zone-list">
        {ZONES.map((z) => {
          const isCurrent = z.id === s.player.district;
          return (
            <div
              key={z.id}
              className={`map-zone ${selected === z.id ? 'selected' : ''}`}
              onClick={() => setSelected(z.id)}
            >
              <span className="map-zone-icon">
                <Icon name={isCurrent ? 'location' : 'map'} size={17} />
              </span>
              <div className="map-zone-main">
                <div className="map-zone-name">{fr ? z.nameFr : z.name}</div>
                <div className="map-zone-meta">
                  {isCurrent
                    ? fr
                      ? 'Tu es ici'
                      : 'You are here'
                    : `${Math.round(getTravelPlan(s, s.player.district, z.id).distance)} m · ${
                        s.learnedRoutes.includes(z.id) ? (fr ? 'trajet connu' : 'route known') : fr ? 'à découvrir' : 'unexplored'
                      }`}
                </div>
              </div>
              <Icon name="back" size={14} />
            </div>
          );
        })}
      </div>

      {plan && (
        <>
          <h3>
            {fr ? 'Aller à' : 'Go to'} {fr ? zone?.nameFr : zone?.name}
          </h3>
          <div className="map-place-list">
            {plan.options.map((o) => {
              const label = MODE_LABEL[o.mode];
              const detail =
                o.mode === 'vehicle'
                  ? `${o.vehicleLabel ?? ''} · ${o.fuelLitres?.toFixed(1) ?? 0} L · ${(o.fuelCost ?? 0).toLocaleString()} F`
                  : o.cost > 0
                    ? `${o.cost.toLocaleString()} F · ${o.minutes} min`
                    : `${o.minutes} min · ${fr ? 'gratuit' : 'free'}`;
              return (
                <div key={`${o.mode}-${o.vehicleId ?? ''}`} className="map-place">
                  <span className="map-zone-icon">
                    <Icon name={label.icon} size={16} />
                  </span>
                  <div className="map-place-main">
                    <div className="map-place-name">{fr ? label.fr : label.en}</div>
                    <div className="map-place-meta">{detail}</div>
                  </div>
                  <button
                    disabled={!o.available || (o.mode === 'taxi' && strike)}
                    onClick={() => dispatch({ type: 'travel', to: selected, mode: o.mode, vehicleId: o.vehicleId })}
                  >
                    {o.available ? (fr ? 'Partir' : 'Go') : fr ? 'Indispo' : 'Unavailable'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!plan && (
        <>
          <h3>{fr ? 'Lieux dans ce quartier' : 'Places in this quartier'}</h3>
          <div className="map-place-list">
            {places.map((p) => (
              <div key={p.id} className="map-place">
                <span className="map-zone-icon">
                  <Icon name={PLACE_ICON[p.icon] ?? 'location'} size={16} />
                </span>
                <div className="map-place-main">
                  <div className="map-place-name">{fr ? p.nameFr : p.name}</div>
                  <div className="map-place-meta">{p.kind.replace('_', ' ')}</div>
                </div>
                <button
                  onClick={() =>
                    openNearby({
                      kind: 'place',
                      id: p.id,
                      label: p.name,
                      labelFr: p.nameFr,
                      icon: p.icon ?? 'location',
                      placeId: p.id,
                    })
                  }
                >
                  {fr ? 'Ouvrir' : 'Open'}
                </button>
              </div>
            ))}
            {places.length === 0 && (
              <div className="muted small">
                {fr ? 'Rien de spécial ici pour le moment.' : 'Nothing special here yet.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
