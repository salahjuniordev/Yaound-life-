import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { ACTIVITIES, ACTIVITY_MAP } from '../data/activities';
import { BUSINESS_KINDS, MARKETING_CAMPAIGNS, SUPPLIERS } from '../data/businesses';
import { EXAM_MAP, EXAM_TRACKS } from '../data/education';
import { HOBBY_DEFS, hobbyProgressFor } from '../data/hobbies';
import { PREMISES_LEVELS, RENTAL_PROPERTIES } from '../data/properties';
import { FLEET_RIDERS, FLEET_RIDER_MAP, VEHICLES, VEHICLE_MAP, fleetEstimate, vehicleRepairCost, vehicleResaleValue } from '../data/vehicles';
import { STORY_CHAINS } from '../data/storyChains';
import { GLOSSARY } from '../data/glossary';
import { ACHIEVEMENTS, GOALS } from '../data/goals';
import { ITEM_MAP, itemName } from '../data/items';
import { JOBS } from '../data/jobs';
import { getVendorStock, qualificationReport, sellPriceFor } from '../sim/engine';
import { detectAndApply } from '../render/perf';
import { BUDGET_CATEGORIES, budgetCategoryLabel, weeklyBudgetView } from '../sim/budget';
import { generateCityNews, npcActivityText } from '../sim/npcsim';
import { NEED_KEYS, NEED_LABELS, formatClock } from '../sim/needs';
import { RELATION_STAGE_LABELS, relationshipSummary } from '../sim/relationships';
import { DISTRICT_MAP, ZONES } from '../data/districts';
import { setLanguage } from '../i18n';
import { deleteCloudData, linkEmail } from '../persistence/supabase';
import { ReportButton } from './ReportButton';
import { Icon, type IconName } from './icons';

const APPS: { id: string; name: string; nameFr: string; icon: IconName }[] = [
  { id: 'journal', name: 'Journal', nameFr: 'Journal', icon: 'journal' },
  { id: 'messages', name: 'Messages', nameFr: 'Messages', icon: 'messages' },
  { id: 'wallet', name: 'Wallet', nameFr: 'Portefeuille', icon: 'wallet' },
  { id: 'jobs', name: 'Jobs', nameFr: 'Emplois', icon: 'jobs' },
  { id: 'business', name: 'Business', nameFr: 'Business', icon: 'business' },
  { id: 'garage', name: 'Garage', nameFr: 'Garage', icon: 'garage' },
  { id: 'njangi', name: 'Njangi', nameFr: 'Njangi', icon: 'njangi' },
  { id: 'news', name: 'News', nameFr: 'Actu', icon: 'news' },
  { id: 'social', name: 'Social', nameFr: 'Social', icon: 'social' },
  { id: 'contacts', name: 'Contacts', nameFr: 'Contacts', icon: 'contacts' },
  { id: 'glossary', name: 'Glossary', nameFr: 'Glossaire', icon: 'glossary' },
  { id: 'stats', name: 'Stats', nameFr: 'Stats', icon: 'stats' },
  { id: 'settings', name: 'Settings', nameFr: 'Réglages', icon: 'settings' },
];

export function Phone() {
  const engine = useGame((s) => s.engine);
  const panel = useGame((s) => s.panel);
  const phoneApp = useGame((s) => s.phoneApp);
  useGame((s) => s.version);
  const close = () => {
    useGame.getState().setPanel('none');
    useGame.getState().setPhoneApp(null);
  };

  if (!engine || panel !== 'phone') return null;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const app = APPS.find((a) => a.id === phoneApp);

  return (
    <div className="phone-overlay" onClick={close}>
      <div className="phone" onClick={(e) => e.stopPropagation()}>
        <div className="phone-status">
          <span>{formatClock(s.world.minute)}</span>
          <span>
            {s.phone.airtimeFcfa.toLocaleString()} F · {Math.round(s.phone.dataCreditMb)} MB
          </span>
          <button className="phone-close" onClick={close}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="phone-body">
          {!app ? (
            <div className="app-grid">
              {APPS.map((a) => (
                <button key={a.id} className="app-icon" onClick={() => useGame.getState().setPhoneApp(a.id)}>
                  <span className="app-icon-tile">
                    <Icon name={a.icon} size={24} />
                  </span>
                  <span className="app-name">{fr ? a.nameFr : a.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="app-view">
              <div className="app-header">
                <button className="app-back" onClick={() => useGame.getState().setPhoneApp(null)}>
                  <Icon name="back" size={18} />
                </button>
                <span>
                  <Icon name={app.icon} size={15} /> {fr ? app.nameFr : app.name}
                </span>
              </div>
              <div className="app-content">
                {app.id === 'journal' && <JournalApp />}
                {app.id === 'messages' && <MessagesApp />}
                {app.id === 'wallet' && <WalletApp />}
                {app.id === 'jobs' && <JobsApp />}
                {app.id === 'business' && <BusinessApp />}
                {app.id === 'garage' && <GarageApp />}
                {app.id === 'njangi' && <NjangiApp />}
                {app.id === 'news' && <NewsApp />}
                {app.id === 'social' && <SocialApp />}
                {app.id === 'contacts' && <ContactsApp />}
                {app.id === 'glossary' && <GlossaryApp />}
                {app.id === 'stats' && <StatsApp />}
                {app.id === 'settings' && <SettingsApp />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EducationPanel() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const trackId = String(s.storyFlags['exam_track'] ?? '');
  const track = EXAM_MAP[trackId];
  const examDay = Number(s.storyFlags['exam_day'] ?? 0);
  const result = String(s.storyFlags['exam_result'] ?? '');
  const resultTrack = EXAM_MAP[String(s.storyFlags['exam_result_track'] ?? '')];
  return (
    <div>
      <div className="muted small">
        {fr ? 'Niveau' : 'Level'}: {s.player.education.level} · {fr ? 'Académique' : 'Academics'}: {Math.floor(s.player.skills.academics)}
      </div>
      {track ? (
        <div className="card">
          <div className="job-title">{fr ? track.nameFr : track.name}</div>
          <div className="muted small">
            {fr ? 'Examen le jour' : 'Exam day'} {examDay} · {fr ? track.placeFr : track.place}
          </div>
          {s.world.day === examDay ? (
            <button onClick={() => d({ type: 'exam_take' })}>{fr ? "Passer l'examen (4 h)" : 'Sit the exam (4 h)'}</button>
          ) : (
            <div className="muted small">
              {s.world.day < examDay
                ? fr
                  ? 'Prépare-toi : bibliothèque, groupe d’étude, étude à la maison.'
                  : 'Prepare: library, study group, study at home.'
                : fr
                  ? 'Le jour est passé.'
                  : 'The day has passed.'}
            </div>
          )}
        </div>
      ) : (
        <>
          {result && (
            <div className="card">
              <div className="muted small">
                <Icon name={result === 'pass' ? 'done' : result === 'missed' ? 'alarm' : 'error'} size={13} />{' '}
                {fr ? 'Dernier examen' : 'Last exam'}: {resultTrack ? (fr ? resultTrack.nameFr : resultTrack.name) : ''} —{' '}
                {result === 'pass'
                  ? fr ? 'réussi' : 'passed'
                  : result === 'missed'
                    ? fr ? 'manqué (frais perdus)' : 'missed (fees lost)'
                    : fr ? 'échoué' : 'failed'}
              </div>
            </div>
          )}
          {EXAM_TRACKS.map((t) => (
            <div key={t.id} className="card">
              <div className="job-title">{fr ? t.nameFr : t.name}</div>
              <div className="muted small">{fr ? t.descriptionFr : t.description}</div>
              <div className="muted small">
                {fr ? 'Frais' : 'Fee'} {t.fee.toLocaleString()} F · {fr ? 'Académique min' : 'Min academics'} {t.minAcademics} ·{' '}
                {fr ? 'dans' : 'in'} {t.prepDays} {fr ? 'jours' : 'days'}
              </div>
              <button onClick={() => d({ type: 'exam_register', trackId: t.id })}>{fr ? "S'inscrire" : 'Register'}</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StoryPanel() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const visible = STORY_CHAINS.filter((c) => c.id === 'A' || Number(s.storyFlags[`chain_${c.id}_step`] ?? 0) > 0 || s.storyFlags[`chain_${c.id}_done`]);
  return (
    <div>
      {visible.map((c) => {
        const step = Number(s.storyFlags[`chain_${c.id}_step`] ?? 0);
        const done = Boolean(s.storyFlags[`chain_${c.id}_done`]);
        const current = c.steps[Math.min(step, c.steps.length - 1)];
        return (
          <div key={c.id} className="card">
            <div className="job-title">
              {done && <Icon name="stepDone" size={14} />} {fr ? c.nameFr : c.name}
            </div>
            {!done && <div className="muted small">→ {fr ? current.textFr : current.text}</div>}
            <div className="muted small">
              <span className="step-dots">
                {c.steps.map((_, i) => (
                  <Icon key={i} name={i < step ? 'stepDone' : 'stepTodo'} size={13} />
                ))}
              </span>{' '}
              {step}/{c.steps.length}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HobbiesPanel() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  return (
    <div>
      {HOBBY_DEFS.map((h) => {
        const xp = Number(s.player.hobbies[h.id] ?? 0);
        const prog = hobbyProgressFor(h.id, xp);
        const gear = Boolean(s.storyFlags[`hobbygear_${h.id}`]);
        const cd = Number(s.storyFlags[`hobbycomp_${h.id}`] ?? 0);
        const cooling = cd > 0 && s.world.day - cd < h.competition.cooldownDays;
        return (
          <div key={h.id} className="card">
            <div className="job-title">
              {fr ? h.nameFr : h.name}
              <span className="muted small"> · {fr ? 'niveau' : 'level'} {prog.level}/5</span>
            </div>
            <div className="muted small">
              {prog.levelSpan ? `${prog.xpInLevel}/${prog.levelSpan} XP` : fr ? 'Niveau maximum' : 'Max level'}
              {gear ? (
                <>
                  {' '}
                  · {fr ? 'équipement' : 'gear'} <Icon name="check" size={12} />
                </>
              ) : (
                ''
              )}
            </div>
            <div className="btn-grid">
              <button disabled={gear || s.wallet.cash < h.gear.cost} onClick={() => d({ type: 'hobby_buy_gear', hobbyId: h.id })}>
                {gear ? (fr ? 'Équipement possédé' : 'Gear owned') : `${fr ? h.gear.nameFr : h.gear.name} (${h.gear.cost.toLocaleString()} F)`}
              </button>
              <button disabled={prog.level < 2 || cooling} onClick={() => d({ type: 'hobby_compete', hobbyId: h.id })}>
                {fr ? h.competition.nameFr : h.competition.name} ({h.competition.entryCost.toLocaleString()} F)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JournalApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const step = Number(s.storyFlags['tutorialStep'] ?? 0);
  const steps = [
    { en: 'Open your phone', fr: 'Ouvre ton téléphone' },
    { en: 'Eat something', fr: 'Mange quelque chose' },
    { en: 'Travel somewhere new', fr: 'Voyage ailleurs' },
    { en: 'Earn your first francs', fr: 'Gagne tes premiers francs' },
    { en: 'Talk to someone', fr: 'Parle à quelqu’un' },
  ];
  return (
    <div>
      <h3>{fr ? 'Premiers jours à Yaoundé' : 'First days in Yaounde'}</h3>
      <ul className="check-list">
        {steps.map((st, i) => (
          <li key={i} className={step > i ? 'done' : ''}>
            <Icon name={step > i ? 'stepDone' : 'stepTodo'} size={13} /> {fr ? st.fr : st.en}
          </li>
        ))}
      </ul>
      <h3>{fr ? 'Éducation' : 'Education'}</h3>
      <EducationPanel />
      <h3>{fr ? 'Histoires' : 'Stories'}</h3>
      <StoryPanel />
      <h3>{fr ? 'Loisirs' : 'Hobbies'}</h3>
      <HobbiesPanel />
      <h3>{fr ? 'Objectifs actifs' : 'Active goals'}</h3>
      {s.activeGoals.length === 0 && <p className="muted">{fr ? 'Aucun objectif actif. Ajoute-en depuis la liste.' : 'No active goals. Activate some below.'}</p>}
      {s.activeGoals.map((g) => {
        const def = GOALS.find((d) => d.id === g.id);
        if (!def) return null;
        const pct = Math.min(100, Math.round((g.progress / Math.max(1, g.target)) * 100));
        return (
          <div key={g.id} className="goal-row">
            <div className="goal-name">{fr ? def.nameFr : def.name}</div>
            <div className="progress">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="muted small">{g.progress} / {g.target}</div>
          </div>
        );
      })}
      <h3>{fr ? 'Ajouter un objectif' : 'Add a goal'}</h3>
      {GOALS.filter((d) => !s.activeGoals.some((a) => a.id === d.id) && !s.storyFlags[`goal_done_${d.id}`]).slice(0, 6).map((d) => (
        <button key={d.id} className="list-btn" onClick={() => useGame.getState().dispatch({ type: 'goal_activate', goalId: d.id })}>
          + {fr ? d.nameFr : d.name}
        </button>
      ))}
      <h3>{fr ? 'Jalons récents' : 'Recent milestones'}</h3>
      {s.milestones.length === 0 ? (
        <p className="muted">{fr ? 'Aucun jalon pour le moment.' : 'No milestones yet.'}</p>
      ) : (
        <ul className="log-list">
          {s.milestones.slice(0, 5).map((m, i) => (
            <li key={i}>
              <Icon name="milestone" size={13} /> {m}
            </li>
          ))}
        </ul>
      )}
      <h3>{fr ? 'Journal du jour' : 'Day log'}</h3>
      <ul className="log-list">
        {s.log.slice(0, 12).map((l, i) => (
          <li key={i}>
            <span className="muted small">J{l.day} {formatClock(l.minute)}</span> {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessagesApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const [openNpc, setOpenNpc] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const threads = useMemo(() => {
    const map = new Map<string, typeof s.messages>();
    for (const m of s.messages) {
      const list = map.get(m.npcId) ?? [];
      list.push(m);
      map.set(m.npcId, list);
    }
    return [...map.entries()];
  }, [s.messages]);

  if (openNpc) {
    const msgs = s.messages.filter((m) => m.npcId === openNpc).slice(0, 30).reverse();
    const npc = s.npcs[openNpc];
    return (
      <div className="thread">
        <button className="list-btn" onClick={() => setOpenNpc(null)}>
          <span className="choice-line">
            <Icon name="back" size={14} /> {fr ? 'Toutes les conversations' : 'All conversations'}
          </span>
        </button>
        <h3>{npc?.name ?? openNpc}</h3>
        <div className="bubbles">
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.from === 'player' ? 'bubble-mine' : ''}`}>
              {m.text}
              {m.replies && m.from === 'npc' && (
                <div className="replies">
                  {m.replies.map((r) => (
                    <button
                      key={r.id}
                      className="reply-btn"
                      onClick={() =>
                        useGame.getState().dispatch({ type: 'message_send', npcId: openNpc, text: r.label, replyId: r.id })
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="compose">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={fr ? 'Écris un message…' : 'Write a message…'} />
          <button
            disabled={!draft.trim()}
            onClick={() => {
              useGame.getState().dispatch({ type: 'message_send', npcId: openNpc, text: draft.trim() });
              setDraft('');
            }}
          >
            <Icon name="send" size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {threads.length === 0 && <p className="muted">{fr ? 'Pas encore de messages. Parle aux gens.' : 'No messages yet. Talk to people.'}</p>}
      {threads.map(([npcId, list]) => {
        const npc = s.npcs[npcId];
        const last = list[0];
        const unread = list.filter((m) => !m.read && m.from === 'npc').length;
        return (
          <button key={npcId} className="list-btn thread-row" onClick={() => setOpenNpc(npcId)}>
            <span>
              {npc?.name ?? npcId} {unread > 0 && <span className="badge">{unread}</span>}
            </span>
            <span className="muted small">{last.text.slice(0, 40)}…</span>
          </button>
        );
      })}
    </div>
  );
}

function PropertyPanel() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const owned = (id: string) => s.player.properties.includes(id);
  return (
    <div className="card">
      <div className="job-title">{fr ? 'Immobilier locatif' : 'Rental property'}</div>
      <div className="muted small">
        {fr
          ? 'Des loyers nets arrivent en banque chaque dimanche. L’entretien est déjà déduit.'
          : 'Net rent lands in your bank every Sunday. Maintenance is already deducted.'}
      </div>
      {RENTAL_PROPERTIES.map((p) => (
        <div key={p.id} className="row" style={{ alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div>{fr ? p.nameFr : p.name}</div>
            <div className="muted small">
              {p.price.toLocaleString()} F · +{(p.weeklyRent - p.maintenance).toLocaleString()} F/{fr ? 'sem' : 'wk'}
            </div>
          </div>
          <button disabled={owned(p.id) || s.wallet.cash < p.price} onClick={() => d({ type: 'property_buy', propertyId: p.id })}>
            {owned(p.id) ? (
              <>
                {fr ? 'Possédé' : 'Owned'} <Icon name="check" size={12} />
              </>
            ) : fr ? (
              'Acheter'
            ) : (
              'Buy'
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

function BudgetPanel() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const view = weeklyBudgetView(s);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState(20000);
  const [goalAmounts, setGoalAmounts] = useState<Record<string, number>>({});
  const [planDraft, setPlanDraft] = useState<Record<string, string>>({});
  return (
    <div>
      <h3>
        {fr
          ? `Budget hebdo (J${view.sinceDay}–J${view.untilDay})`
          : `Weekly budget (day ${view.sinceDay}–${view.untilDay})`}
      </h3>
      <div className="muted small">
        {fr ? 'Entrées' : 'Income'} {view.income.toLocaleString()} F · {fr ? 'sorties' : 'spending'} {view.expense.toLocaleString()} F
        {view.plannedTotal > 0
          ? ` · ${fr ? 'plan' : 'plan'} ${view.plannedTotal.toLocaleString()} F (${Math.round((view.expense / view.plannedTotal) * 100)}%)`
          : ''}
      </div>
      {BUDGET_CATEGORIES.map((c) => {
        const row = view.byCategory[c.id];
        const pct = row.planned > 0 ? Math.min(100, Math.round((row.expense / row.planned) * 100)) : 0;
        const over = row.planned > 0 && row.expense > row.planned;
        return (
          <div key={c.id} className="budget-row">
            <div className="budget-head">
              <span>{budgetCategoryLabel(c.id, fr)}</span>
              <span className={`muted small${over ? ' money-out' : ''}`}>
                {row.expense.toLocaleString()} F{row.income > 0 ? ` · +${row.income.toLocaleString()} F` : ''}
              </span>
            </div>
            <div className="budget-bar">
              <div className={`budget-fill${over ? ' over' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="amount-row">
              <input
                type="number"
                min={0}
                step={500}
                placeholder={fr ? 'Plan (F)' : 'Plan (F)'}
                value={planDraft[c.id] ?? (row.planned || '')}
                onChange={(e) => setPlanDraft({ ...planDraft, [c.id]: e.target.value })}
              />
              <button
                className="mini"
                onClick={() => {
                  d({ type: 'budget_set_plan', category: c.id, amount: Number(planDraft[c.id] || row.planned) });
                  setPlanDraft({ ...planDraft, [c.id]: '' });
                }}
              >
                {fr ? 'Définir' : 'Set'}
              </button>
            </div>
          </div>
        );
      })}
      <h3>{fr ? "Objectifs d'épargne" : 'Savings goals'}</h3>
      {s.budget.goals.length === 0 && (
        <div className="muted small">
          {fr ? 'Fixez un objectif : moto, loyer, stock, école…' : 'Set a target: moto, rent, stock, school…'}
        </div>
      )}
      {s.budget.goals.map((g) => {
        const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
        const amt = goalAmounts[g.id] ?? 1000;
        return (
          <div key={g.id} className="card">
            <div className="budget-head">
              <span>
                {g.done && <Icon name="done" size={13} />} {g.name}
              </span>
              <span className="muted small">
                {g.saved.toLocaleString()} / {g.target.toLocaleString()} F
              </span>
            </div>
            <div className="budget-bar">
              <div className={`budget-fill${g.done ? ' done' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="amount-row">
              <input
                type="number"
                min={100}
                step={500}
                value={amt}
                onChange={(e) => setGoalAmounts({ ...goalAmounts, [g.id]: Math.max(100, Number(e.target.value)) })}
              />
              <button className="mini" onClick={() => d({ type: 'savings_goal_deposit', goalId: g.id, amount: amt })}>
                {fr ? 'Déposer' : 'Deposit'}
              </button>
              <button className="mini" onClick={() => d({ type: 'savings_goal_withdraw', goalId: g.id, amount: amt })}>
                {fr ? 'Retirer' : 'Withdraw'}
              </button>
              <button className="mini danger" onClick={() => d({ type: 'savings_goal_delete', goalId: g.id })}>
                <Icon name="close" size={12} />
              </button>
            </div>
          </div>
        );
      })}
      <div className="compose">
        <input
          value={goalName}
          onChange={(e) => setGoalName(e.target.value)}
          placeholder={fr ? "Nom de l'objectif" : 'Goal name'}
        />
        <input
          type="number"
          min={1000}
          step={1000}
          value={goalTarget}
          onChange={(e) => setGoalTarget(Math.max(1000, Number(e.target.value)))}
        />
        <button
          disabled={!goalName.trim()}
          onClick={() => {
            d({ type: 'savings_goal_add', name: goalName, target: goalTarget });
            setGoalName('');
          }}
        >
          {fr ? 'Ajouter' : 'Add'}
        </button>
      </div>
    </div>
  );
}

function WalletApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const [amount, setAmount] = useState(5000);
  const [target, setTarget] = useState<string>('');
  const d = useGame.getState().dispatch;
  const contacts = Object.values(s.npcs).filter((n) => s.relationships[n.id]?.stage !== undefined && s.relationships[n.id]?.stage !== 'stranger');
  return (
    <div>
      <div className="wallet-grid">
        <div className="wallet-card">
          <Icon name="cash" size={14} /> {s.wallet.cash.toLocaleString()}
        </div>
        <div className="wallet-card">
          <Icon name="momo" size={14} /> {s.wallet.momo.toLocaleString()}
        </div>
        <div className="wallet-card">
          <Icon name="bank" size={14} /> {s.wallet.bank.toLocaleString()}
        </div>
        <div className="wallet-card wallet-debt">
          <Icon name="debt" size={14} /> {s.wallet.debt.toLocaleString()}
        </div>
      </div>
      <BudgetPanel />
      <PropertyPanel />
      <div className="amount-row">
        <input type="number" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} min={0} step={500} />
        {[1000, 5000, 25000, 100000].map((v) => (
          <button key={v} className="quick-amt" onClick={() => setAmount(v)}>
            {v >= 1000 ? `${v / 1000}k` : v}
          </button>
        ))}
      </div>
      <div className="btn-grid">
        <button onClick={() => d({ type: 'withdraw_momo', amount })}>{fr ? 'MoMo → Cash' : 'MoMo → Cash'}</button>
        <button onClick={() => d({ type: 'deposit_momo', amount })}>{fr ? 'Cash → MoMo' : 'Cash → MoMo'}</button>
        <button onClick={() => d({ type: 'bank_deposit', amount })}>{fr ? 'Dépôt banque' : 'Bank deposit'}</button>
        <button onClick={() => d({ type: 'bank_withdraw', amount })}>{fr ? 'Retrait banque' : 'Bank withdraw'}</button>
        <button onClick={() => d({ type: 'loan_take', amount })}>{fr ? 'Prêt' : 'Take loan'}</button>
        <button onClick={() => d({ type: 'loan_repay', amount })}>{fr ? 'Rembourser' : 'Repay loan'}</button>
      </div>
      <h3>{fr ? 'Crédit téléphonique' : 'Phone credit'}</h3>
      <div className="btn-grid">
        <button onClick={() => d({ type: 'buy_airtime', amount: 1000 })}>{fr ? 'Crédit 1 000 F' : 'Airtime 1,000 F'}</button>
        <button onClick={() => d({ type: 'buy_data', amount: 1000 })}>{fr ? 'Data 1 Go' : 'Data 1 GB'}</button>
      </div>
      <h3>{fr ? 'Transfert MoMo' : 'MoMo transfer'}</h3>
      <div className="amount-row">
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{fr ? 'Choisir contact…' : 'Choose contact…'}</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button disabled={!target || amount <= 0} onClick={() => target && d({ type: 'transfer_momo', npcId: target, amount })}>
          {fr ? 'Envoyer' : 'Send'}
        </button>
      </div>
      <h3>{fr ? 'Transactions récentes' : 'Recent transactions'}</h3>
      <ul className="log-list">
        {s.ledger.slice(0, 14).map((l) => (
          <li key={l.id}>
            <span className="muted small">J{l.day} {formatClock(l.minute)}</span>{' '}
            <span className={l.amount >= 0 ? 'money-in' : 'money-out'}>
              {l.amount >= 0 ? '+' : ''}
              {l.amount.toLocaleString()} F
            </span>{' '}
            {l.note} <span className="muted small">({l.counterparty})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobsApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const current = s.player.job ? JOBS.find((j) => j.id === s.player.job!.jobId) : null;
  return (
    <div>
      {current && s.player.job && (
        <div className="card">
          <h3>{fr ? current.titleFr ?? current.title : current.title}</h3>
          <p className="muted small">
            {current.employer} · {current.pay.toLocaleString()} F/{current.payCadence} · {fr ? 'services' : 'shifts'}:{' '}
            {s.player.job.shiftsWorked}
          </p>
          <div className="btn-grid">
            <button onClick={() => d({ type: 'work_shift', jobId: current.id })}>{fr ? 'Travailler (service)' : 'Work a shift'}</button>
            <button className="danger" onClick={() => d({ type: 'resign_job' })}>
              {fr ? 'Démissionner' : 'Resign'}
            </button>
          </div>
        </div>
      )}
      <h3>{fr ? 'Offres disponibles' : 'Open positions'}</h3>
      {JOBS.map((job) => {
        const q = qualificationReport(s, job.id);
        const isCurrent = s.player.job?.jobId === job.id;
        return (
          <div key={job.id} className="card">
            <div className="job-title">
              {fr ? job.titleFr ?? job.title : job.title}
              <span className="muted small"> · {job.pay.toLocaleString()} F/{job.payCadence}</span>
            </div>
            <div className="muted small">
              {job.employer} · {fr ? DISTRICT_MAP[job.district].nameFr : DISTRICT_MAP[job.district].name}
            </div>
            <div className="muted small">{fr ? job.descriptionFr : job.description}</div>
            {q.missing.length > 0 ? (
              <ul className="req-list">
                {(fr ? q.missingFr : q.missing).map((m, i) => (
                  <li key={i}>
                    <Icon name="error" size={12} /> {m}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="req-list">
                {(fr ? q.reasonsFr : q.reasons).map((m, i) => (
                  <li key={i}>
                    <Icon name="check" size={12} /> {m}
                  </li>
                ))}
              </ul>
            )}
            <button disabled={isCurrent || !q.qualifies} onClick={() => d({ type: 'apply_job', jobId: job.id })}>
              {isCurrent ? (fr ? 'Emploi actuel' : 'Current job') : fr ? 'Postuler' : 'Apply'}
            </button>
          </div>
        );
      })}
      <h3>{fr ? 'Missions freelance' : 'Freelance gigs'}</h3>
      {ACTIVITIES.filter((a) => a.locationKind === 'phone' && a.income)
        .sort((a, b) => (a.income ?? 0) - (b.income ?? 0))
        .map((a) => {
          const req = a.requires?.skill;
          const locked = req ? s.player.skills[req.key] < req.level : false;
          return (
            <div key={a.id} className="card">
              <div className="job-title">
                {fr ? a.nameFr ?? a.name : a.name}
                <span className="muted small"> · {a.income!.toLocaleString()} F</span>
              </div>
              <div className="muted small">
                {a.minutes} min
                {a.skill ? ` · ${a.skill.key} +${a.skill.gain}` : ''}
                {req ? ` · ${fr ? 'requis' : 'requires'} ${req.key} ${req.level}` : ''}
              </div>
              <button disabled={locked} onClick={() => d({ type: 'activity', activityId: a.id })}>
                {locked
                  ? `${fr ? 'Verrouillé' : 'Locked'} (${req!.key} ${Math.floor(s.player.skills[req!.key])}/${req!.level})`
                  : fr
                    ? 'Prendre la mission'
                    : 'Take the gig'}
              </button>
            </div>
          );
        })}
    </div>
  );
}

function BusinessApp() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const [newName, setNewName] = useState('');
  const [kind, setKind] = useState(BUSINESS_KINDS[0].id);
  const [supplierByBiz, setSupplierByBiz] = useState<Record<string, string>>({});
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  return (
    <div>
      {s.businesses.map((b) => {
        const def = BUSINESS_KINDS.find((k) => k.id === b.kind);
        const candidates = Object.values(s.npcs).filter((n) => !b.staffIds.includes(n.id) && !s.player.job);
        const supplierId = supplierByBiz[b.id] ?? 'neighbourhood';
        const supplier = SUPPLIERS.find((sp) => sp.id === supplierId)!;
        return (
          <div key={b.id} className="card">
            <div className="job-title">{b.name}</div>
            <div className="muted small">
              {def ? (fr ? def.nameFr : def.name) : b.kind} · {fr ? 'réputation' : 'reputation'}: {Math.round(b.reputation)} ·{' '}
              {fr ? 'loyer/j' : 'rent/day'}: {b.rentPerDay.toLocaleString()} F
            </div>
            <div className="muted small">
              {fr ? 'Hier' : 'Yesterday'}: +{b.revenueToday.toLocaleString()} F / -{b.costsToday.toLocaleString()} F ·{' '}
              {fr ? 'qualité stock' : 'stock quality'}: {b.stockQuality}
              {b.arrears > 0 && <span className="money-out"> · {fr ? 'arriérés' : 'arrears'}: {b.arrears.toLocaleString()} F</span>}
            </div>
            {b.marketing && s.world.day <= b.marketing.untilDay && (
              <div className="muted small">
                <Icon name="marketing" size={13} /> {fr ? 'Campagne' : 'Campaign'}: {b.marketing.type} ·{' '}
                {fr ? 'jusqu’à J' : 'until day'}
                {b.marketing.untilDay} (+{Math.round((b.marketing.boost - 1) * 100)}%)
              </div>
            )}
            {b.pendingDeliveries.map((dv, i) => (
              <div key={i} className="muted small">
                <Icon name="delivery" size={13} /> {fr ? 'Livraison' : 'Delivery'}: {dv.qty}×{' '}
                {itemName(dv.itemId, fr)} → J{dv.arrivesDay}
              </div>
            ))}
            {(() => {
              const next = PREMISES_LEVELS.find((p) => p.level === b.premises + 1);
              return (
                <div className="row" style={{ alignItems: 'center' }}>
                  <div className="muted small" style={{ flex: 1 }}>
                    <Icon name="premises" size={13} /> {fr ? 'Locaux' : 'Premises'}:{' '}
                    {b.premises === 0
                      ? fr
                        ? 'étal de rue'
                        : 'street stall'
                      : fr
                        ? PREMISES_LEVELS[b.premises - 1].nameFr
                        : PREMISES_LEVELS[b.premises - 1].name}
                  </div>
                  {next && (
                    <button disabled={s.wallet.cash < next.cost} onClick={() => d({ type: 'business_premises_upgrade', businessId: b.id })}>
                      {fr ? next.nameFr : next.name} ({(next.cost / 1000).toLocaleString()}k)
                    </button>
                  )}
                </div>
              );
            })()}
            <div className="row">
              <button onClick={() => d({ type: 'business_toggle', businessId: b.id, open: !b.openToday })}>
                {b.openToday ? (fr ? 'Fermer' : 'Close') : fr ? 'Ouvrir' : 'Open'}
              </button>
              <input
                type="range"
                min={0}
                max={1.3}
                step={0.05}
                defaultValue={b.priceLevel}
                onMouseUp={(e) => d({ type: 'business_set_price', businessId: b.id, priceLevel: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => d({ type: 'business_set_price', businessId: b.id, priceLevel: Number((e.target as HTMLInputElement).value) })}
              />
              {b.arrears > 0 && <button onClick={() => d({ type: 'pay_arrears' })}>{fr ? 'Payer arriérés' : 'Pay arrears'}</button>}
            </div>
            <div className="muted small">{fr ? 'Fournisseur' : 'Supplier'}:</div>
            <div className="btn-grid">
              {SUPPLIERS.map((sp) => (
                <button
                  key={sp.id}
                  className={`mini ${supplierId === sp.id ? 'selected' : ''}`}
                  onClick={() => setSupplierByBiz({ ...supplierByBiz, [b.id]: sp.id })}
                >
                  {fr ? sp.nameFr : sp.name} ×{sp.priceFactor}
                </button>
              ))}
            </div>
            <div className="muted small">
              {fr ? supplier.descriptionFr : supplier.description} · {fr ? 'fiable' : 'reliable'} {Math.round(supplier.reliability * 100)}%
              {supplier.deliveryDays > 0 ? ` · ${fr ? 'livré J+' : 'arrives day +'}${supplier.deliveryDays}` : ''}
            </div>
            <div className="muted small">{fr ? 'Stock' : 'Stock'}:</div>
            <div className="stock-row">
              {def?.stockItems.map((itemId) => {
                const qtyKey = `${b.id}:${itemId}`;
                const qty = qtyByItem[qtyKey] ?? 10;
                return (
                  <span key={itemId} className="stock-chip">
                    {itemName(itemId, fr)} · {b.stock[itemId] ?? 0}
                    <input
                      type="number"
                      className="stock-qty"
                      min={supplier.minQty}
                      step={5}
                      value={qty}
                      onChange={(e) => setQtyByItem({ ...qtyByItem, [qtyKey]: Math.max(1, Number(e.target.value)) })}
                    />
                    <button
                      className="mini"
                      onClick={() => d({ type: 'business_buy_stock', businessId: b.id, itemId, qty, supplier: supplier.id })}
                    >
                      {fr ? 'Acheter' : 'Buy'}
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="muted small">
              {fr ? 'Employés' : 'Staff'}: {b.staffIds.length}
            </div>
            {b.staffIds.map((id) => {
              const info = b.staffInfo[id] ?? { morale: 70, skill: 2 };
              return (
                <div key={id} className="stock-chip">
                  {s.npcs[id]?.name ?? id} · {fr ? 'moral' : 'morale'} {Math.round(info.morale)} · {fr ? 'compétence' : 'skill'} {info.skill}/5
                  <button className="mini" onClick={() => d({ type: 'business_staff_bonus', businessId: b.id, npcId: id, amount: 1000 })}>
                    {fr ? '+1 000 F prime' : '+1,000 F bonus'}
                  </button>
                  <button className="mini" onClick={() => d({ type: 'business_train_staff', businessId: b.id, npcId: id })}>
                    {fr ? 'Former (2 500 F)' : 'Train (2,500 F)'}
                  </button>
                  <button className="mini danger" onClick={() => d({ type: 'business_fire', businessId: b.id, npcId: id })}>
                    <Icon name="close" size={12} />
                  </button>
                </div>
              );
            })}
            {candidates.slice(0, 3).map((n) => (
              <button key={n.id} className="mini" onClick={() => d({ type: 'business_hire', businessId: b.id, npcId: n.id })}>
                {fr ? 'Embaucher' : 'Hire'} {n.name}
              </button>
            ))}
            <div className="muted small">{fr ? 'Marketing' : 'Marketing'}:</div>
            <div className="btn-grid">
              {MARKETING_CAMPAIGNS.map((c) => (
                <button
                  key={c.id}
                  className="mini"
                  disabled={c.minPosts > 0 && s.stats.socialPosts < c.minPosts}
                  onClick={() => d({ type: 'business_marketing', businessId: b.id, campaign: c.id })}
                >
                  {fr ? c.nameFr : c.name} · {c.cost > 0 ? `${c.cost.toLocaleString()} F` : fr ? 'gratuit' : 'free'} (+
                  {Math.round((c.boost - 1) * 100)}%/{c.days}j)
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <h3>{fr ? 'Ouvrir un commerce' : 'Open a business'}</h3>
      {BUSINESS_KINDS.map((k) => (
        <button
          key={k.id}
          className={`list-btn ${kind === k.id ? 'selected' : ''}`}
          onClick={() => setKind(k.id)}
        >
          {fr ? k.nameFr : k.name} · {k.setupCost.toLocaleString()} F
          <span className="muted small"> — {fr ? k.descriptionFr : k.description}</span>
        </button>
      ))}
      <div className="compose">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={fr ? 'Nom du commerce' : 'Business name'} />
        <button
          disabled={!newName.trim()}
          onClick={() => {
            d({ type: 'business_open', kind, name: newName.trim() });
            setNewName('');
          }}
        >
          {fr ? 'Ouvrir' : 'Open'}
        </button>
      </div>
    </div>
  );
}

function GarageApp() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const balance = s.wallet.cash + s.wallet.momo + s.wallet.bank;
  const driving = Math.floor(s.player.skills.driving ?? 0);
  const fleetAssigned = s.vehicles.filter((v) => v.fleetRiderId).length;

  return (
    <div>
      <div className="card">
        <div className="job-title">
          <Icon name="garage" size={15} /> {fr ? 'Mon garage' : 'My garage'}
        </div>
        <div className="muted small">
          {fr
            ? `Permis : niveau ${driving} · ${s.vehicles.length} véhicule(s) · ${fleetAssigned} en flotte`
            : `Driving: level ${driving} · ${s.vehicles.length} vehicle(s) · ${fleetAssigned} in fleet`}
        </div>
        <div className="muted small">
          {fr
            ? 'Les motos confiées à un chauffeur rapportent chaque jour. Les voitures restent pour tes trajets.'
            : 'Motos assigned to a rider earn every day. Cars stay for your own trips.'}
        </div>
      </div>

      {s.vehicles.length === 0 && (
        <p className="muted">{fr ? 'Aucun véhicule. Acheter une moto change la façon de travailler et de voyager.' : 'No vehicle yet. Buying a moto changes how you work and travel.'}</p>
      )}

      {s.vehicles.map((v) => {
        const def = VEHICLE_MAP[v.modelId];
        if (!def) return null;
        const rider = v.fleetRiderId ? FLEET_RIDER_MAP[v.fleetRiderId] : null;
        const estimate = rider ? fleetEstimate(def, rider, v.condition, s.world.fuelPrice) : null;
        const refuelCost = Math.max(0, Math.round((def.tankLitres - v.fuel) * s.world.fuelPrice));
        const repairCost = vehicleRepairCost(def, v.condition);
        const sellValue = vehicleResaleValue(def, v.condition);
        return (
          <div key={v.id} className="card">
            <div className="job-title">
              <Icon name={def.kind === 'moto' ? 'moto' : 'car'} size={15} /> {fr ? def.nameFr : def.name}
            </div>
            <div className="muted small">
              {fr ? 'Carburant' : 'Fuel'} {v.fuel.toFixed(1)}/{def.tankLitres} L · {fr ? 'État' : 'Condition'} {Math.round(v.condition)}%
            </div>
            <div className="muted small">
              {fr ? 'Prix neuf' : 'New price'} {def.price.toLocaleString()} F · {fr ? 'Revente' : 'Resale'} {sellValue.toLocaleString()} F
            </div>
            <div className="btn-grid">
              <button
                className="mini"
                disabled={v.fuel >= def.tankLitres - 0.05 || balance < refuelCost}
                onClick={() => d({ type: 'vehicle_refuel', vehicleId: v.id })}
              >
                {fr ? 'Plein' : 'Fill tank'} · {refuelCost.toLocaleString()} F
              </button>
              <button
                className="mini"
                disabled={v.condition >= 99.5 || balance < repairCost}
                onClick={() => d({ type: 'vehicle_repair', vehicleId: v.id })}
              >
                {fr ? 'Réparer' : 'Repair'} · {repairCost.toLocaleString()} F
              </button>
              <button className="mini" onClick={() => d({ type: 'vehicle_sell', vehicleId: v.id })}>
                {fr ? 'Vendre' : 'Sell'} · {sellValue.toLocaleString()} F
              </button>
            </div>
            {def.kind === 'moto' && (
              <div>
                <div className="muted small">{fr ? 'Chauffeur de flotte' : 'Fleet rider'}</div>
                <select
                  value={v.fleetRiderId ?? ''}
                  onChange={(e) => d({ type: 'vehicle_assign_rider', vehicleId: v.id, riderId: e.target.value || null })}
                >
                  <option value="">{fr ? 'Usage personnel' : 'Personal use'}</option>
                  {FLEET_RIDERS.map((r) => {
                    const taken = s.vehicles.some((other) => other.id !== v.id && other.fleetRiderId === r.id);
                    return (
                      <option key={r.id} value={r.id} disabled={taken}>
                        {fr ? r.nameFr : r.name} · {Math.round(r.reliability * 100)}% · {fr ? 'part' : 'cut'} {Math.round(r.cutRate * 100)}%
                        {taken ? (fr ? ' · déjà pris' : ' · assigned') : ''}
                      </option>
                    );
                  })}
                </select>
                {rider && estimate && (
                  <div className="muted small">
                    {fr ? 'Net estimé' : 'Estimated net'}: {estimate.net.toLocaleString()} F/{fr ? 'jour' : 'day'} ({fr ? 'brut' : 'gross'}{' '}
                    {estimate.gross.toLocaleString()} F · {fr ? 'part' : 'cut'} {estimate.riderCut.toLocaleString()} F · {fr ? 'carburant' : 'fuel'}{' '}
                    {estimate.fuel.toLocaleString()} F · {fr ? 'entretien' : 'upkeep'} {estimate.upkeep.toLocaleString()} F)
                  </div>
                )}
                {rider && (
                  <div className="muted small">
                    {fr ? rider.descriptionFr : rider.description}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <h3>{fr ? 'Acheter un véhicule' : 'Buy a vehicle'}</h3>
      {VEHICLES.map((def) => {
        const skillOk = driving >= def.drivingRequirement;
        return (
          <div key={def.id} className="card">
            <div className="job-title">
              {fr ? def.nameFr : def.name} · {def.price.toLocaleString()} F
            </div>
            <div className="muted small">{fr ? def.descriptionFr : def.description}</div>
            <div className="muted small">
              {fr ? 'Permis' : 'Driving'} {def.drivingRequirement} · {fr ? 'réservoir' : 'tank'} {def.tankLitres} L · {fr ? 'vitesse' : 'speed'}{' '}
              {def.speed}
              {def.kind === 'moto' ? ` · ${fr ? 'flotte possible' : 'fleet ready'}` : ''}
            </div>
            <button
              disabled={!skillOk || balance < def.price}
              onClick={() => d({ type: 'vehicle_buy', modelId: def.id })}
            >
              {!skillOk
                ? fr ? `Permis niveau ${def.drivingRequirement} requis` : `Driving level ${def.drivingRequirement} required`
                : balance < def.price
                  ? fr ? 'Fonds insuffisants' : 'Not enough money'
                  : fr ? 'Acheter' : 'Buy'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function NjangiApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const [turn, setTurn] = useState<'early' | 'middle' | 'late'>('middle');
  const membership = s.njangi.membership;
  return (
    <div>
      {membership ? (
        <div className="card">
          <h3>{s.njangi.groups.find((g) => g.id === membership.groupId)?.name}</h3>
          <div className="muted small">
            {fr ? 'Cotisation' : 'Contribution'}: {membership.contribution.toLocaleString()} F · {fr ? 'tour' : 'turn'}:{' '}
            {membership.turnOrder + 1} · {fr ? 'cycles payés' : 'cycles paid'}: {membership.cyclesPaid} · {fr ? 'reçus' : 'received'}:{' '}
            {membership.cyclesReceived}
            {membership.missed > 0 && <span className="money-out"> · {fr ? 'manqués' : 'missed'}: {membership.missed}</span>}
          </div>
          <div className="btn-grid">
            <button onClick={() => d({ type: 'njangi_contribute' })}>{fr ? 'Cotiser' : 'Contribute'}</button>
            <button className="danger" onClick={() => d({ type: 'njangi_leave' })}>
              {fr ? 'Quitter' : 'Leave'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3>{fr ? 'Rejoindre un njangi' : 'Join a njangi'}</h3>
          <div className="row">
            <label className="muted small">{fr ? 'Préférence de tour' : 'Turn preference'}</label>
            <select value={turn} onChange={(e) => setTurn(e.target.value as never)}>
              <option value="early">{fr ? 'Tôt' : 'Early'}</option>
              <option value="middle">{fr ? 'Milieu' : 'Middle'}</option>
              <option value="late">{fr ? 'Tard' : 'Late'}</option>
            </select>
          </div>
          {s.njangi.groups.map((g) => (
            <div key={g.id} className={`card ${g.sketchy ? 'card-warn' : ''}`}>
              <div className="job-title">{g.name}</div>
              <div className="muted small">
                {fr ? 'Membres' : 'Members'}: {g.members.length}/{g.maxMembers} · {fr ? 'cotisation' : 'contribution'}:{' '}
                {g.contribution.toLocaleString()} F · {fr ? 'frais' : 'fee'}: {g.joinFee.toLocaleString()} F
              </div>
              {g.sketchy && (
                <div className="money-out small">
                  <Icon name="warning" size={13} />{' '}
                  {fr ? 'Aucune garantie. Le "digital" ne protège personne.' : 'No guarantees. "Digital" protects nobody.'}
                </div>
              )}
              <button onClick={() => d({ type: 'njangi_join', groupId: g.id, turn })}>{fr ? 'Rejoindre' : 'Join'}</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function NewsApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const news = useMemo(() => generateCityNews(s), [s.world.day, s.world.minute]);
  return (
    <div>
      <h3>
        <Icon name="news" size={16} /> {fr ? 'Yaoundé aujourd’hui' : 'Yaounde today'}
      </h3>
      {news.map((n, i) => (
        <div key={i} className="card">
          <div className="muted small">
            {fr ? n.textFr : n.text}
          </div>
        </div>
      ))}
      <div className="muted small">
        {fr ? 'Météo' : 'Weather'}: {s.world.weather} · {fr ? 'Carburant' : 'Fuel'}: {s.world.fuelPrice} F/L
      </div>
    </div>
  );
}

function SocialApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const [post, setPost] = useState('');
  const d = useGame.getState().dispatch;
  return (
    <div>
      <p className="muted small">
        {fr ? 'Posts publiés' : 'Posts published'}: {s.stats.socialPosts}. {fr ? 'Une publication coûte un peu de data.' : 'Posting costs a little data.'}
      </p>
      <div className="compose">
        <input value={post} onChange={(e) => setPost(e.target.value)} placeholder={fr ? 'Quoi de neuf à Yaoundé ?' : "What's happening in Yaounde?"} />
        <button
          disabled={!post.trim()}
          onClick={() => {
            d({ type: 'social_post', text: post.trim() });
            setPost('');
          }}
        >
          {fr ? 'Publier' : 'Post'}
        </button>
      </div>
    </div>
  );
}

function ContactsApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const d = useGame.getState().dispatch;
  const [momoFor, setMomoFor] = useState<string | null>(null);
  const [momoAmount, setMomoAmount] = useState(2000);
  return (
    <div>
      {Object.values(s.npcs).map((n) => {
        const rel = s.relationships[n.id];
        const stage = rel?.stage ?? 'stranger';
        const stageLabel = RELATION_STAGE_LABELS[stage];
        return (
          <div key={n.id} className="card">
            <div className="job-title">
              {n.name} <span className="muted small">· {n.role}</span>
            </div>
            <div className="muted small">
              {fr ? stageLabel.fr : stageLabel.en} · {npcActivityText(n, s.world.minute, fr)}
            </div>
            <div className="muted small">
              <Icon name="contactNote" size={13} /> {relationshipSummary(s, n.id, fr)}
            </div>
            <div className="btn-grid">
              <button onClick={() => useGame.getState().setModal({ kind: 'dialogue', npcId: n.id })}>
                {fr ? 'Parler' : 'Talk'}
              </button>
              <button onClick={() => setMomoFor(momoFor === n.id ? null : n.id)}>
                {fr ? 'MoMo' : 'MoMo'}
              </button>
            </div>
            {momoFor === n.id && (
              <div className="amount-row">
                <input type="number" min={100} value={momoAmount} onChange={(e) => setMomoAmount(Math.max(100, Number(e.target.value)))} />
                <button
                  onClick={() => {
                    d({ type: 'transfer_momo', npcId: n.id, amount: momoAmount });
                    setMomoFor(null);
                  }}
                >
                  {fr ? 'Envoyer' : 'Send'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GlossaryApp() {
  const engine = useGame((s) => s.engine)!;
  const fr = engine.state.settings.language === 'fr';
  return (
    <div>
      {GLOSSARY.map((g) => (
        <div key={g.term} className="card">
          <div className="job-title">{fr ? g.termFr : g.term}</div>
          <div className="muted small">{fr ? g.definitionFr : g.definition}</div>
          <ReportButton kind="glossary" refId={g.term} />
        </div>
      ))}
    </div>
  );
}

function StatsApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const rep = Object.entries(s.reputation.perDistrict);
  return (
    <div>
      <div className="wallet-grid">
        <div className="wallet-card">{fr ? 'Jours joués' : 'Days played'}: {s.stats.daysPlayed}</div>
        <div className="wallet-card">{fr ? 'Missions' : 'Gigs'}: {s.stats.gigsDone}</div>
        <div className="wallet-card">{fr ? 'Gains totaux' : 'Total earned'}: {s.stats.totalEarned.toLocaleString()} F</div>
        <div className="wallet-card">{fr ? 'Dépenses' : 'Total spent'}: {s.stats.totalSpent.toLocaleString()} F</div>
        <div className="wallet-card">{fr ? 'Série de travail' : 'Work streak'}: {s.stats.workStreak}</div>
        <div className="wallet-card">{fr ? 'Meilleure série' : 'Best streak'}: {s.stats.bestWorkStreak}</div>
      </div>
      <h3>{fr ? 'Réputation par quartier' : 'Reputation by district'}</h3>
      {rep.map(([zone, v]) => (
        <div key={zone} className="goal-row">
          <span>{fr ? DISTRICT_MAP[zone as keyof typeof DISTRICT_MAP].nameFr : DISTRICT_MAP[zone as keyof typeof DISTRICT_MAP].name}</span>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, (v as number) + 50))}%` }} />
          </div>
        </div>
      ))}
      <h3>{fr ? 'Succès' : 'Achievements'}</h3>
      {ACHIEVEMENTS.map((a) => {
        const unlocked = s.achievements.includes(a.id);
        const masked = !unlocked && a.hidden;
        return (
          <div key={a.id} className={`card ${unlocked ? '' : 'card-locked'}`}>
            <div className="job-title">
              <Icon name={unlocked ? 'trophy' : masked ? 'hidden' : 'locked'} size={14} />{' '}
              {masked ? (fr ? 'Succès caché' : 'Hidden achievement') : fr ? a.nameFr : a.name}
            </div>
            <div className="muted small">
              {masked
                ? fr
                  ? 'Continue de vivre la ville pour le découvrir.'
                  : 'Keep living the city to discover it.'
                : fr
                  ? a.descFr
                  : a.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SettingsApp() {
  const engine = useGame((s) => s.engine)!;
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const store = useGame.getState;
  const [email, setEmail] = useState('');
  const [importErr, setImportErr] = useState('');
  const set = <K extends keyof typeof s.settings>(k: K, v: (typeof s.settings)[K]) => store().setSetting(k, v);

  return (
    <div>
      <h3>{fr ? 'Jeu' : 'Game'}</h3>
      <div className="row">
        <label>{fr ? 'Langue' : 'Language'}</label>
        <select
          value={s.settings.language}
          onChange={(e) => {
            const lang = e.target.value as 'en' | 'fr';
            set('language', lang);
            setLanguage(lang);
          }}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
      </div>
      <div className="row">
        <label>{fr ? 'Qualité' : 'Quality'}</label>
        <select
          value={s.settings.quality}
          onChange={(e) => {
            set('qualityAuto', false);
            set('quality', e.target.value as never);
          }}
        >
          <option value="low">{fr ? 'Basse' : 'Low'}</option>
          <option value="mid">{fr ? 'Équilibrée' : 'Balanced'}</option>
          <option value="high">{fr ? 'Haute' : 'High'}</option>
        </select>
      </div>
      <Toggle
        label={fr ? 'Qualité auto (recommandé)' : 'Auto quality (recommended)'}
        value={s.settings.qualityAuto}
        onChange={(v) => {
          set('qualityAuto', v);
          if (v) {
            void detectAndApply(engine).then((d) => {
              engine.toast(d ? d.reason : 'Auto quality on', 'info', d ? d.reasonFr : undefined);
            });
          }
        }}
      />
      {s.settings.qualityAuto && (
        <button
          className="muted small"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            void detectAndApply(engine).then((d) => {
              engine.toast(d ? d.reason : 'Detection skipped', 'info', d ? d.reasonFr : undefined);
            });
          }}
        >
          {fr ? 'Détecter maintenant' : 'Detect now'}
        </button>
      )}
      <Toggle label={fr ? 'Mode détendu (besoins lents)' : 'Relaxed needs'} value={s.settings.relaxedNeeds} onChange={(v) => set('relaxedNeeds', v)} />
      <Toggle label={fr ? 'Son' : 'Sound'} value={s.settings.sound} onChange={(v) => set('sound', v)} />
      <Toggle label={fr ? 'Notifications' : 'Notifications'} value={s.settings.notifications} onChange={(v) => set('notifications', v)} />
      <Toggle label={fr ? 'Économiseur de data' : 'Data saver'} value={s.settings.dataSaver} onChange={(v) => set('dataSaver', v)} />
      <Toggle label={fr ? 'Réduire les animations' : 'Reduce motion'} value={s.settings.reduceMotion} onChange={(v) => set('reduceMotion', v)} />

      <h3>{fr ? 'Sauvegarde' : 'Save'}</h3>
      <div className="btn-grid">
        <button onClick={() => void store().saveNow()}>{fr ? 'Sauvegarder' : 'Save now'}</button>
        <button
          onClick={() => {
            const json = store().exportCurrent();
            if (!json) return;
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yaounde-life-${s.characterId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {fr ? 'Exporter' : 'Export'}
        </button>
        <label className="file-btn">
          {fr ? 'Importer' : 'Import'}
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const ok = store().importFromJSON(text);
              if (!ok) setImportErr(fr ? 'Fichier invalide.' : 'Invalid file.');
            }}
          />
        </label>
      </div>
      {importErr && <div className="money-out small">{importErr}</div>}

      <h3>{fr ? 'Cloud (optionnel)' : 'Cloud (optional)'}</h3>
      <p className="muted small">
        {useGame.getState().cloud.connected
          ? fr
            ? 'Synchronisation cloud active.'
            : 'Cloud sync active.'
          : fr
            ? 'Hors-ligne. La progression reste sur cet appareil.'
            : 'Offline. Progress stays on this device.'}
      </p>
      <div className="btn-grid">
        <button onClick={() => void store().connectCloud()}>{fr ? 'Connecter' : 'Connect'}</button>
        <button onClick={() => void store().syncCloud()}>{fr ? 'Envoyer' : 'Push'}</button>
        <button onClick={() => void store().loadCloudLast()}>{fr ? 'Charger' : 'Pull'}</button>
        <button
          className="danger"
          onClick={() => {
            const msg = fr ? 'Supprimer les données cloud ?' : 'Delete cloud data?';
            if (window.confirm(msg)) {
              void deleteCloudData().then((r) => store().pushToast(r.message, r.ok ? 'success' : 'error'));
            }
          }}
        >
          {fr ? 'Supprimer cloud' : 'Delete cloud'}
        </button>
      </div>
      <div className="amount-row">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={fr ? 'email@exemple.com' : 'you@example.com'} />
        <button
          disabled={!email.includes('@')}
          onClick={() => {
            void linkEmail(email).then((r) => store().pushToast(r.message, r.ok ? 'success' : 'error'));
          }}
        >
          {fr ? 'Lier' : 'Link'}
        </button>
      </div>

      <h3>{fr ? 'Partie' : 'Session'}</h3>
      <button
        className="danger"
        onClick={async () => {
          await store().saveNow();
          store().setScreen('menu');
          await store().refreshMenuSaves();
        }}
      >
        {fr ? 'Retour au menu' : 'Back to menu'}
      </button>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row toggle-row">
      <label>{label}</label>
      <button className={`toggle ${value ? 'toggle-on' : ''}`} onClick={() => onChange(!value)}>
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

export { getVendorStock, sellPriceFor, ACTIVITY_MAP, ITEM_MAP, ZONES };
