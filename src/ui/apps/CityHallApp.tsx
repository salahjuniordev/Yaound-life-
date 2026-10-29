import { useState } from 'react';
import { useGame } from '../../state/store';
import { CITY_CAMPAIGN_UNIT, CITY_POLICIES, CITY_POLICY_MAP, CITY_RUN_FEE } from '../../data/cityHall';
import { activeCityPolicy, isVotingOpen } from '../../sim/city';
import { Icon } from '../icons';
import type { CityPolicyId } from '../../sim/types';

export function CityHallApp() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const dispatch = useGame.getState().dispatch;
  const city = s.city;
  const voting = isVotingOpen(s);
  const active = activeCityPolicy(s);
  const activeDef = active ? CITY_POLICY_MAP[active] : null;
  const [policy, setPolicy] = useState<CityPolicyId>('transport_subsidy');
  const votedFor = city.votedCandidateId;
  const totalVotes = Object.values(city.votes).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(1, ...Object.values(city.votes));
  const playerCandidate = city.candidates.find((c) => c.id === 'player');
  const canAffordRun = s.wallet.cash + s.wallet.momo >= CITY_RUN_FEE;

  return (
    <div>
      <div className="city-hero">
        <h3>{fr ? 'Mairie de Yaoundé' : 'Yaounde City Hall'}</h3>
        <p>
          {fr
            ? 'Tous les sept jours, la ville choisit une politique. Vote, ou présente-toi.'
            : 'Every seven days the city chooses a policy. Vote, or run yourself.'}
        </p>
        <span className="city-countdown">
          <Icon name="event" size={12} />
          {voting
            ? fr
              ? `Vote ouvert · ferme dans ${Math.max(0, city.electionDay - s.world.day)} j`
              : `Voting open · closes in ${Math.max(0, city.electionDay - s.world.day)} d`
            : fr
              ? `Prochaine élection : jour ${city.electionDay}`
              : `Next election: day ${city.electionDay}`}
          {' · '}
          {fr ? 'approbation' : 'approval'} {city.approval}%
        </span>
      </div>

      {activeDef && (
        <div className="city-policy-card">
          <strong>
            <Icon name="city" size={14} /> {fr ? activeDef.nameFr : activeDef.name}
          </strong>
          <span>{fr ? activeDef.effectFr : activeDef.effect}</span>
        </div>
      )}

      {city.lastResult && (
        <div className="card">
          <div className="job-title">
            <Icon name={city.lastResult.playerWon ? 'trophy' : 'city'} size={14} />{' '}
            {fr ? 'Dernier résultat' : 'Last result'}
          </div>
          <div className="muted small">
            {fr
              ? `${city.lastResult.winnerNameFr} a gagné le jour ${city.lastResult.day}.`
              : `${city.lastResult.winnerName} won on day ${city.lastResult.day}.`}
          </div>
        </div>
      )}

      <h3>{fr ? 'Candidats' : 'Candidates'}</h3>
      <div className="city-candidates">
        {city.candidates.map((c) => {
          const votes = city.votes[c.id] ?? 0;
          const p = CITY_POLICY_MAP[c.policy];
          return (
            <div key={c.id} className={`city-candidate ${votedFor === c.id ? 'selected' : ''}`}>
              <span className="city-candidate-avatar">{c.name.trim().charAt(0).toUpperCase()}</span>
              <div className="city-candidate-main">
                <div className="city-candidate-name">
                  {fr ? c.nameFr : c.name} {c.player && <span className="muted small">({fr ? 'toi' : 'you'})</span>}
                </div>
                <div className="city-candidate-sub">
                  {fr ? c.roleFr : c.role} · {fr ? c.sloganFr : c.slogan}
                </div>
                <div className="city-candidate-sub">
                  <Icon name="event" size={11} /> {fr ? p.nameFr : p.name} · {fr ? p.effectFr : p.effect}
                </div>
              </div>
              {voting && !votedFor ? (
                <button className="city-vote-btn" onClick={() => dispatch({ type: 'city_vote', candidateId: c.id })}>
                  {fr ? 'Voter' : 'Vote'}
                </button>
              ) : votedFor === c.id ? (
                <span className="chip">
                  <Icon name="done" size={12} /> {fr ? 'Ton vote' : 'Your vote'}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {votedFor && (
        <div className="muted small">
          <Icon name="check" size={12} />{' '}
          {fr ? 'Ton vote est enregistré. Résultats à la fin de la période.' : 'Your vote is locked in. Results at the end of the window.'}
        </div>
      )}

      <h3>{fr ? 'Résultats en direct' : 'Live results'}</h3>
      <div className="city-results">
        {city.candidates.map((c) => (
          <div key={c.id} className="city-result-row">
            <span>{fr ? c.nameFr : c.name}</span>
            <div className="city-result-bar">
              <div className="city-result-fill" style={{ width: `${((city.votes[c.id] ?? 0) / maxVotes) * 100}%` }} />
            </div>
            <span>{totalVotes > 0 ? Math.round(((city.votes[c.id] ?? 0) / totalVotes) * 100) : 0}%</span>
          </div>
        ))}
      </div>

      <h3>{fr ? 'Te présenter' : 'Run for mayor'}</h3>
      {city.playerRunning ? (
        <div className="card">
          <div className="job-title">
            <Icon name="trophy" size={14} /> {fr ? 'Ta campagne' : 'Your campaign'}
          </div>
          <div className="muted small">
            {fr
              ? `Popularité ${playerCandidate?.popularity ?? 0} · dépensé ${city.campaignSpend.toLocaleString()} F`
              : `Popularity ${playerCandidate?.popularity ?? 0} · spent ${city.campaignSpend.toLocaleString()} F`}
          </div>
          <div className="chip-row">
            {[CITY_CAMPAIGN_UNIT, CITY_CAMPAIGN_UNIT * 2, CITY_CAMPAIGN_UNIT * 4].map((amount) => (
              <button
                key={amount}
                disabled={!voting || s.wallet.cash + s.wallet.momo < amount}
                onClick={() => dispatch({ type: 'city_campaign', amount })}
              >
                {fr ? 'Meeting' : 'Rally'} {amount.toLocaleString()} F
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="muted small">
            {fr
              ? `Dépose ${CITY_RUN_FEE.toLocaleString()} F et choisis la politique que tu défendras.`
              : `Put down ${CITY_RUN_FEE.toLocaleString()} F and choose the policy you will fight for.`}
          </div>
          <div className="chip-row">
            {CITY_POLICIES.map((p) => (
              <button key={p.id} className={policy === p.id ? 'selected' : ''} onClick={() => setPolicy(p.id)}>
                {fr ? p.nameFr : p.name}
              </button>
            ))}
          </div>
          <button
            className="menu-primary"
            disabled={!voting || !canAffordRun}
            onClick={() => dispatch({ type: 'city_run', policy })}
          >
            <Icon name="trophy" size={14} />{' '}
            {!voting
              ? fr
                ? 'Vote fermé'
                : 'Voting closed'
              : `${fr ? 'Se présenter' : 'Declare candidacy'} · ${CITY_RUN_FEE.toLocaleString()} F`}
          </button>
        </div>
      )}

      <h3>{fr ? 'Les politiques' : 'The policies'}</h3>
      {CITY_POLICIES.map((p) => (
        <div key={p.id} className="card">
          <div className="job-title">
            <Icon name="city" size={13} /> {fr ? p.nameFr : p.name}
            {active === p.id && <span className="tag">{fr ? 'En vigueur' : 'Active'}</span>}
          </div>
          <div className="muted small">{fr ? p.blurbFr : p.blurb}</div>
          <div className="muted small">
            <Icon name="check" size={12} /> {fr ? p.effectFr : p.effect}
          </div>
        </div>
      ))}
    </div>
  );
}
