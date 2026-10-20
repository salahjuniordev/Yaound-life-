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

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-left">
          <div className="hud-district">
            <span className="hud-district-name">{fr ? zone?.nameFr : zone?.name}</span>
            <span className="hud-time">
              {dayName} · Day {s.world.day} · {formatClock(nowMin)} · {partLabel} <Icon name={weather} size={13} />
            </span>
            <div className="hud-flags">
              {holiday && (
                <span className="flag flag-holiday">
                  <Icon name="holiday" size={12} /> {fr ? holiday.nameFr : holiday.name}
                </span>
              )}
              {strike && (
                <span className="flag flag-warn">
                  <Icon name="taxi" size={12} /> {fr ? 'Grève taxis' : 'Taxi strike'}
                </span>
              )}
              {inOutage && (
                <span className="flag flag-warn">
                  <Icon name="power" size={12} /> {fr ? 'Délestage' : 'Power out'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="hud-right">
          <div className="money-chips">
            <span className="chip">
              <Icon name="cash" size={13} /> {s.wallet.cash.toLocaleString()}
            </span>
            <span className="chip">
              <Icon name="momo" size={13} /> {s.wallet.momo.toLocaleString()}
            </span>
            <span className="chip">
              <Icon name="bank" size={13} /> {s.wallet.bank.toLocaleString()}
            </span>
            {s.wallet.debt > 0 && (
              <span className="chip chip-debt">
                <Icon name="debt" size={13} /> -{s.wallet.debt.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`needs ${needsExpanded ? 'needs-open' : ''}`} onClick={() => setNeedsExpanded((v) => !v)}>
        {(needsExpanded ? NEED_KEYS : NEED_KEYS.filter((k) => s.player.needs[k] < 45)).map((k) => {
          const v = Math.round(s.player.needs[k]);
          const label = NEED_LABELS[k];
          return (
            <div key={k} className="need">
              <span className="need-icon">
                <Icon name={NEED_ICONS[label.icon] ?? 'needMood'} size={13} />
              </span>
              <div className="need-bar">
                <div
                  className={`need-fill ${v < 25 ? 'need-critical' : v < 50 ? 'need-low' : ''}`}
                  style={{ width: `${v}%` }}
                />
              </div>
              <span className="need-value">{v}</span>
              <span className="need-label">{fr ? label.fr : label.en}</span>
            </div>
          );
        })}
        {!needsExpanded && (
          <span className="needs-more">
            <Icon name="more" size={12} />
          </span>
        )}
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

      <div className="action-buttons">
        {nearby && (
          <button className="action-btn action-interact" onClick={() => openNearby(nearby)}>
            <Icon name="act" size={22} />
            <em>{fr ? 'Agir' : 'Act'}</em>
          </button>
        )}
        <button className="action-btn" onClick={() => openPhone('journal')}>
          <Icon name="journal" size={20} />
          <em>{fr ? 'Journal' : 'Journal'}</em>
        </button>
        <button className="action-btn action-phone" onClick={() => openPhone('messages')}>
          <Icon name="phone" size={20} />
          <em>{fr ? 'Téléphone' : 'Phone'}</em>
          {s.phone.notifications.some((n) => !n.read) && <span className="badge-dot" />}
        </button>
        <button className="action-btn" onClick={() => useGame.getState().setModal({ kind: 'travel' })}>
          <Icon name="taxi" size={20} />
          <em>{fr ? 'Voyager' : 'Travel'}</em>
        </button>
      </div>
    </div>
  );
}
