import { useState } from 'react';
import { useGame } from '../../state/store';
import { npcActivityText } from '../../sim/npcsim';
import { RELATION_STAGE_LABELS, npcDialogueTone } from '../../sim/relationships';
import { Icon, SoccerBallIcon } from '../icons';

const TONE_LINES = {
  greeting: {
    en: 'You are still getting to know each other — a friendly greeting goes a long way.',
    fr: 'Vous faites encore connaissance — un salut chaleureux fait la différence.',
  },
  friendly: {
    en: 'They light up when they see you — chatting comes easily.',
    fr: 'Leur regard s’illumine — discuter est facile.',
  },
  busy: {
    en: 'They look busy right now — a quick greeting works better than a long chat.',
    fr: 'Ils ont l’air occupé — un bref bonjour vaut mieux qu’une longue discussion.',
  },
} as const;

export function DialogueModal({ npcId }: { npcId: string }) {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);
  const [inviteOpen, setInviteOpen] = useState(false);
  if (!engine) return null;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const npc = s.npcs[npcId];
  if (!npc) return null;
  const rel = s.relationships[npcId];
  const stage = rel?.stage ?? 'stranger';
  const stageLabel = RELATION_STAGE_LABELS[stage];
  const close = () => useGame.getState().setModal({ kind: 'none' });
  const tone = s.settings.language;
  const dialogueTone = npcDialogueTone(s, npc);

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal dialogue-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-kicker">
          <Icon name="contacts" size={14} /> {npc.name}
        </div>
        <div className="muted small">
          {npc.role} · {fr ? stageLabel.fr : stageLabel.en} · {npcActivityText(npc, s.world.minute, fr)}
        </div>
        <div className={`muted small tone-line tone-${dialogueTone}`}>{fr ? TONE_LINES[dialogueTone].fr : TONE_LINES[dialogueTone].en}</div>
        {rel && (
          <div className="rel-bars">
            <span className="muted small">
              <Icon name="trust" size={13} /> {fr ? 'Confiance' : 'Trust'} {Math.round(rel.trust)}
            </span>
            <span className="muted small">
              <Icon name="affection" size={13} /> {fr ? 'Affection' : 'Affection'} {Math.round(rel.affection)}
            </span>
            <span className="muted small">
              <Icon name="respect" size={13} /> {fr ? 'Respect' : 'Respect'} {Math.round(rel.respect)}
            </span>
          </div>
        )}
        <div className="choices">
          <button className="choice-btn" onClick={() => d({ type: 'talk', npcId, kind: 'greet' })}>
            <span className="choice-line">
              <Icon name="greet" size={15} /> {fr ? 'Saluer' : 'Greet'}
            </span>
          </button>
          <button className="choice-btn" onClick={() => d({ type: 'talk', npcId, kind: 'chat' })}>
            <span className="choice-line">
              <Icon name="chat" size={15} /> {fr ? 'Discuter' : 'Chat'}
            </span>
          </button>
          <button className="choice-btn" onClick={() => d({ type: 'talk', npcId, kind: 'help' })}>
            <span className="choice-line">
              <Icon name="help" size={15} /> {fr ? 'Aider' : 'Help'}
            </span>
          </button>
          <button className="choice-btn" onClick={() => d({ type: 'talk', npcId, kind: 'gift' })}>
            <span className="choice-line">
              <Icon name="gift" size={15} /> {fr ? 'Offrir (1 000 F)' : 'Gift (1,000 F)'}
            </span>
          </button>
          {stage === 'friend' || stage === 'close_friend' || stage === 'dating' || stage === 'partner' ? (
            <button className="choice-btn" onClick={() => setInviteOpen(true)}>
              <span className="choice-line">
                <Icon name="invite" size={15} /> {fr ? 'Inviter' : 'Invite out'}
              </span>
            </button>
          ) : null}
          {rel?.memory.some((m) => m.kind === 'promise_broken') && (
            <button className="choice-btn" onClick={() => d({ type: 'talk', npcId, kind: 'apologize' })}>
              <span className="choice-line">
                <Icon name="apologize" size={15} /> {fr ? 'S’excuser' : 'Apologize'}
              </span>
            </button>
          )}
        </div>
        {inviteOpen && (
          <div className="invite-row">
            <span className="muted small">{fr ? 'Inviter à…' : 'Invite to…'}</span>
            <div className="btn-grid">
              <button className="mini" onClick={() => d({ type: 'activity', activityId: 'join_restaurant', npcId })}>
                <Icon name="restaurant" size={13} /> {fr ? 'Restaurant' : 'Restaurant'}
              </button>
              <button className="mini" onClick={() => d({ type: 'activity', activityId: 'watch_match', npcId })}>
                <SoccerBallIcon size={13} /> {fr ? 'Match' : 'Watch a match'}
              </button>
              <button className="mini" onClick={() => d({ type: 'activity', activityId: 'lac_walk', npcId })}>
                <Icon name="walk" size={13} /> {fr ? 'Balade au lac' : 'Lakeside walk'}
              </button>
            </div>
          </div>
        )}
        <p className="muted small">
          {tone === 'fr'
            ? 'Les relations se construisent avec le temps. Un cadeau par jour suffit.'
            : 'Relationships build over time. One meaningful gift a day is enough.'}
        </p>
        <button className="choice-btn choice-muted" onClick={close}>
          {fr ? 'Fermer' : 'Close'}
        </button>
      </div>
    </div>
  );
}

export function NjangiModal() {
  const engine = useGame((s) => s.engine);
  useGame((s) => s.version);
  const [turn, setTurn] = useState<'early' | 'middle' | 'late'>('middle');
  if (!engine) return null;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const close = () => useGame.getState().setModal({ kind: 'none' });
  const membership = s.njangi.membership;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-kicker">
          <Icon name="njangi" size={14} /> Njangi
        </div>
        {membership ? (
          <>
            <h2>{s.njangi.groups.find((g) => g.id === membership.groupId)?.name}</h2>
            <div className="muted small">
              {fr ? 'Cotisation' : 'Contribution'}: {membership.contribution.toLocaleString()} F · {fr ? 'prochaine séance' : 'next sitting'}: J
              {membership.nextSittingDay}
            </div>
            <div className="choices">
              <button className="choice-btn" onClick={() => d({ type: 'njangi_contribute' })}>
                <span className="choice-line">
                  <Icon name="contribution" size={15} /> {fr ? 'Cotiser maintenant' : 'Contribute now'}
                </span>
              </button>
              <button className="choice-btn choice-muted" onClick={() => d({ type: 'njangi_leave' })}>
                {fr ? 'Quitter le groupe' : 'Leave group'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{fr ? 'Rejoindre un njangi' : 'Join a njangi'}</h2>
            <div className="row">
              <label className="muted small">{fr ? 'Tour préféré' : 'Preferred turn'}</label>
              <select value={turn} onChange={(e) => setTurn(e.target.value as never)}>
                <option value="early">{fr ? 'Tôt' : 'Early'}</option>
                <option value="middle">{fr ? 'Milieu' : 'Middle'}</option>
                <option value="late">{fr ? 'Tard' : 'Late'}</option>
              </select>
            </div>
            <div className="choices">
              {s.njangi.groups.map((g) => (
                <button
                  key={g.id}
                  className={`choice-btn ${g.sketchy ? 'choice-sketchy' : ''}`}
                  onClick={() => d({ type: 'njangi_join', groupId: g.id, turn })}
                >
                  <span>{g.name}</span>
                  <span className="muted small">
                    {g.contribution.toLocaleString()} F · {fr ? 'frais' : 'fee'} {g.joinFee.toLocaleString()} F
                    {g.sketchy && (
                      <>
                        {' '}
                        · <Icon name="warning" size={12} /> {fr ? 'risqué' : 'risky'}
                      </>
                    )}
                  </span>
                </button>
              ))}
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
