import { useGame } from '../../state/store';
import { PLACE_MAP } from '../../data/places';
import { EVENT_MAP } from '../../data/events';
import { ReportButton } from '../ReportButton';
import { Icon } from '../icons';

export function EventModal() {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);
  if (!engine) return null;
  const ev = engine.state.pendingEvents[0];
  if (!ev) return null;
  const fr = engine.state.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const template = EVENT_MAP[ev.templateId];
  const requiresValidation = template?.contentLabel === 'requires_local_validation';
  const npc = ev.npcId ? engine.state.npcs[ev.npcId] : null;

  return (
    <div className="modal-backdrop">
      <div className="modal event-modal">
        <div className="modal-kicker">
          <Icon name="event" size={14} /> {fr ? 'Événement' : 'Event'}
        </div>
        <h2>{fr && ev.titleFr ? ev.titleFr : ev.title}</h2>
        {npc && <div className="muted small">{npc.name}</div>}
        <p className="event-body">{fr && ev.bodyFr ? ev.bodyFr : ev.body}</p>
        <div className="choices">
          {ev.choices.length === 0 && (
            <button className="choice-btn" onClick={() => d({ type: 'dismiss_event', eventIndex: 0 })}>
              {fr ? 'Continuer' : 'Continue'}
            </button>
          )}
          {ev.choices.map((c) => (
            <button key={c.id} className="choice-btn" onClick={() => d({ type: 'event_choice', eventIndex: 0, choiceId: c.id })}>
              {fr && c.labelFr ? c.labelFr : c.label}
            </button>
          ))}
          {ev.choices.length > 0 && ev.kind !== 'health' && (
            <button className="choice-btn choice-muted" onClick={() => d({ type: 'dismiss_event', eventIndex: 0 })}>
              {fr ? 'Plus tard' : 'Deal with it later'}
            </button>
          )}
        </div>
        {requiresValidation && (
          <div className="content-label">{fr ? 'Interprétation de design — validation locale à faire' : 'Design interpretation — pending local validation'}</div>
        )}
        <ReportButton kind="event" refId={ev.templateId} />
      </div>
    </div>
  );
}

export function PhotoModal({ landmarkId }: { landmarkId?: string }) {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);
  if (!engine) return null;
  const fr = engine.state.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const close = () => useGame.getState().setModal({ kind: 'none' });
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-kicker">
          <Icon name="camera" size={14} /> {fr ? 'Appareil photo' : 'Camera'}
        </div>
        <h2>{fr ? 'Prendre une photo' : 'Take a photo'}</h2>
        <p className="muted">
          {fr
            ? 'Une bonne photo garde la mémoire du quartier. Partage plus tard depuis le téléphone.'
            : 'A good photo keeps the memory of the neighbourhood. Share it later from the phone.'}
        </p>
        <div className="choices">
          <button
            className="choice-btn"
            onClick={() => {
              d({ type: 'photo_taken', landmarkId });
              close();
            }}
          >
            {fr ? 'Prendre la photo' : 'Take the photo'}
          </button>
          <button className="choice-btn choice-muted" onClick={close}>
            {fr ? 'Fermer' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NearbyPlaceTitle({ placeId }: { placeId: string }) {
  const engine = useGame((s) => s.engine);
  if (!engine) return null;
  const place = PLACE_MAP[placeId];
  if (!place) return null;
  const fr = engine.state.settings.language === 'fr';
  return <div className="muted small">{fr ? place.nameFr : place.name}</div>;
}
