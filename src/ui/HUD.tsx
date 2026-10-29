import { useEffect, useState } from 'react';
import { useGame } from '../state/store';
import { NEED_KEYS, NEED_LABELS, DAY_NAMES, DAY_NAMES_FR, formatClock, dayPart } from '../sim/needs';
import { DISTRICT_MAP } from '../data/districts';
import { holidayForDay } from '../data/calendar';
import { JOURNAL_HINTS } from './hints';
import { openNearby, openPhone } from './interactions';
import { Icon, type IconName } from './icons';

const NEED_ICONS: Record<string, IconName> = {
  bolt: 'needEnergy',
  food: 'needFood',
  water: 'needHygiene',
  health: 'needHealth',
  mood: 'needMood',
  people: 'needSocial',
};

export function HUD() {
  const engine = useGame((s) => s.engine);
  const nearby = useGame((s) => s.nearby);
  useGame((s) => s.version);
  const [needsExpanded, setNeedsExpanded] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    if (!engine) return;
    const step = Number(engine.state.storyFlags['tutorialStep'] ?? 0);
    if (step >= 6) setHintVisible(false);
  }, [engine, engine ? Number(engine.state.storyFlags['tutorialStep'] ?? 0) : 0]);

  if (!engine) return null;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const zone = DISTRICT_MAP[s.player.district];
  const dayName = (fr ? DAY_NAMES_FR : DAY_NAMES)[s.world.day % 7];
  const weather: IconName = s.world.weather === 'rain' ? 'rain' : s.world.weather === 'cloud' ? 'cloudSun' : 'sun';
  const strike = s.world.strike;
  const outage = s.world.outages[s.player.district];
  const nowMin = s.world.minute;
  const part = dayPart(nowMin);
  const partLabel = fr
    ? { morning: 'Matin', afternoon: 'Après-midi', evening: 'Soir', night: 'Nuit' }[part]
    : { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' }[part];
  const inOutage = outage && nowMin >= outage.start && nowMin < outage.end;
  const tutorialStep = Number(s.storyFlags['tutorialStep'] ?? 0);
  const hint = JOURNAL_HINTS[tutorialStep];
  const holiday = holidayForDay(s.world.day);
  const policyLabel = String(s.storyFlags['city_policy_label'] ?? '');
  const sortedNeeds = [...NEED_KEYS].sort((a, b) => s.player.needs[a] - s.player.needs[b]);
  const shownNeeds = needsExpanded ? NEED_KEYS : sortedNeeds.slice(0, 3);
  const unread = s.phone.notifications.some((n) => !n.read);
  const initial = (s.player.name || 'Y').trim().charAt(0).toUpperCase();

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-left">
          <div className="hud-location">
            <span className="hud-location-avatar">{initial}</span>
            <div className="hud-location-main">
              <span className="hud-district-name">{fr ? zone?.nameFr : zone?.name}</span>
              <span className="hud-time">
                <Icon name={weather} size={11} /> {formatClock(nowMin)} · {partLabel}
              </span>
            </div>
          </div>
          <div className="hud-flags">
            <span className="flag">
              <Icon name="clock" size={11} /> {dayName} · {fr ? 'Jour' : 'Day'} {s.world.day}
            </span>
            {holiday && (
              <span className="flag flag-holiday">
                <Icon name="holiday" size={11} /> {fr ? holiday.nameFr : holiday.name}
              </span>
            )}
            {strike && (
              <span className="flag flag-warn">
                <Icon name="taxi" size={11} /> {fr ? 'Grève taxis' : 'Taxi strike'}
              </span>
            )}
            {inOutage && (
              <span className="flag flag-warn">
                <Icon name="power" size={11} /> {fr ? 'Délestage' : 'Power out'}
              </span>
            )}
            {policyLabel && (
              <span className="flag">
                <Icon name="city" size={11} /> {policyLabel}
              </span>
            )}
          </div>
        </div>
        <div className="hud-right">
          <div className="hud-wallet">
            <div className="hud-wallet-main">
              <span>{fr ? 'Espèces' : 'Cash'}</span>
              <strong>{s.wallet.cash.toLocaleString()} F</strong>
            </div>
            <div className="hud-wallet-more">
              <span className="chip" title={fr ? 'Mobile Money' : 'Mobile Money'}>
                <Icon name="momo" size={11} /> {s.wallet.momo.toLocaleString()}
              </span>
              <span className="chip" title={fr ? 'Banque' : 'Bank'}>
                <Icon name="bank" size={11} /> {s.wallet.bank.toLocaleString()}
              </span>
              {s.wallet.debt > 0 && (
                <span className="chip chip-debt" title={fr ? 'Dette' : 'Debt'}>
                  <Icon name="debt" size={11} /> -{s.wallet.debt.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`needs ${needsExpanded ? 'needs-open' : ''}`} onClick={() => setNeedsExpanded((v) => !v)}>
        {shownNeeds.map((k) => {
          const v = Math.round(s.player.needs[k]);
          const label = NEED_LABELS[k];
          return (
            <div key={k} className="need">
              <span className="need-icon">
                <Icon name={NEED_ICONS[label.icon] ?? 'needMood'} size={12} />
              </span>
              <div className="need-bar">
                <div
                  className={`need-fill ${v < 25 ? 'need-critical' : v < 50 ? 'need-low' : ''}`}
                  style={{ width: `${v}%` }}
                />
              </div>
              <span className="need-label">{fr ? label.fr : label.en}</span>
            </div>
          );
        })}
        <span className="needs-more">
          <Icon name={needsExpanded ? 'close' : 'more'} size={12} />
        </span>
      </div>

      {nearby && (
        <button className="nearby-pill" onClick={() => openNearby(nearby)}>
          <Icon name={nearby.icon === 'people' ? 'messages' : 'act'} size={16} />
          <span>{fr ? nearby.labelFr : nearby.label}</span>
          <span className="nearby-key">E</span>
        </button>
      )}

      {hintVisible && hint && (
        <div className="hint-pill">
          <span>
            <Icon name="hint" size={14} /> {fr ? hint.fr : hint.en}
          </span>
          <button className="hint-close" onClick={() => setHintVisible(false)}>
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      <div className="dock">
        <button className="dock-btn" onClick={() => openPhone('journal')}>
          <Icon name="journal" size={20} />
          <em>{fr ? 'Journal' : 'Journal'}</em>
        </button>
        <button className="dock-btn" onClick={() => openPhone('messages')}>
          <Icon name="phone" size={20} />
          <em>{fr ? 'Téléphone' : 'Phone'}</em>
          {unread && <span className="badge-dot" />}
        </button>
        <button className="dock-btn" onClick={() => openPhone('map')}>
          <Icon name="map" size={20} />
          <em>{fr ? 'Carte' : 'Map'}</em>
        </button>
        <button className="dock-btn" onClick={() => openPhone('city')}>
          <Icon name="city" size={20} />
          <em>{fr ? 'Mairie' : 'City'}</em>
        </button>
        {nearby && (
          <button className="dock-btn dock-btn-active" onClick={() => openNearby(nearby)}>
            <Icon name="act" size={20} />
            <em>{fr ? 'Agir' : 'Act'}</em>
          </button>
        )}
      </div>
    </div>
  );
}
