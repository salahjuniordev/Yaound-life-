import { useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { BACKGROUNDS } from '../data/backgrounds';
import { HAIR_STYLES, SHIRT_COLORS, SKIN_TONES, PANTS_COLORS } from '../data/backgrounds';
import { NEED_LABELS } from '../sim/needs';
import { DISTRICT_MAP } from '../data/districts';
import { CHARACTER_PRESETS } from '../data/characterPresets';
import { animateCharacter, buildCharacter } from '../render/characters';
import { useGame } from '../state/store';
import { Icon } from './icons';
import type { Appearance, BackgroundId, NeedsState, SkillKey } from '../sim/types';

const SKILL_LABELS_FR: Record<string, string> = {
  academics: 'Études',
  tech: 'Tech',
  sales: 'Vente',
  negotiation: 'Négociation',
  music: 'Musique',
  fitness: 'Forme',
  cooking: 'Cuisine',
  driving: 'Conduite',
  charisma: 'Charisme',
  crafts: 'Artisanat',
  management: 'Gestion',
  marketing: 'Marketing',
  creativity: 'Créativité',
};

const HAIR_LABELS: Record<string, { en: string; fr: string }> = {
  fade: { en: 'Fade', fr: 'Dégradé' },
  braids: { en: 'Braids', fr: 'Tresses' },
  natural: { en: 'Natural', fr: 'Naturel' },
  bald: { en: 'Bald', fr: 'Rasé' },
  locks: { en: 'Locks', fr: 'Locks' },
  wig: { en: 'Wig', fr: 'Perruque' },
  twists: { en: 'Twists', fr: 'Torsades' },
};

const SKILL_LABELS: Record<string, string> = {
  academics: 'Academics',
  tech: 'Tech',
  sales: 'Sales',
  negotiation: 'Negotiation',
  music: 'Music',
  fitness: 'Fitness',
  cooking: 'Cooking',
  driving: 'Driving',
  charisma: 'Charisma',
  crafts: 'Crafts',
  management: 'Management',
  marketing: 'Marketing',
  creativity: 'Creativity',
};

function PreviewCharacter({ appearance }: { appearance: Appearance }) {
  const appearanceKey = JSON.stringify(appearance);
  const parts = useMemo(() => buildCharacter(appearance), [appearanceKey]);
  useFrame(({ clock }, dt) => {
    animateCharacter(parts, clock.elapsedTime, false, 1, 'idle', Math.min(dt, 0.1));
    parts.group.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.55;
  });
  return (
    <group position={[0, -0.9, 0]}>
      <primitive object={parts.group} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[1.1, 20]} />
        <meshBasicMaterial color="#22262c" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export function CharacterCreator() {
  const newGame = useGame((s) => s.newGame);
  const setScreen = useGame((s) => s.setScreen);
  const fr = (typeof localStorage !== 'undefined' ? localStorage.getItem('yaounde-lang') : null) === 'fr';
  const t = (en: string, frText: string) => (fr ? frText : en);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'m' | 'f' | 'x'>('m');
  const [background, setBackground] = useState<BackgroundId>(BACKGROUNDS[0].id);
  const [appearance, setAppearance] = useState<Appearance>({
    skinTone: 2,
    hair: 'fade',
    bodyType: 'medium',
    faceShape: 'oval',
    facialHair: 'none',
    pattern: 'none',
    shirtColor: SHIRT_COLORS[0],
    pantsColor: PANTS_COLORS[0],
  });
  const [creating, setCreating] = useState(false);

  const bg = BACKGROUNDS.find((b) => b.id === background)!;
  const skills = Object.entries(bg.skills) as [SkillKey, number][];
  const needs = Object.entries(bg.needs) as [keyof NeedsState, number][];
  const startMoney = bg.cash + bg.momo + bg.bank;
  const skillLabel = (key: string) => (fr ? SKILL_LABELS_FR[key] : SKILL_LABELS[key]) ?? key;
  const district = fr ? DISTRICT_MAP[bg.district].nameFr : DISTRICT_MAP[bg.district].name;

  const surprise = () => {
    const preset = CHARACTER_PRESETS[Math.floor(Math.random() * CHARACTER_PRESETS.length)];
    setAppearance({ ...preset.appearance });
  };

  const canNext = step > 0 || name.trim().length > 0;
  const steps = [
    t('You', 'Toi'),
    t('Start', 'Départ'),
    t('Look', 'Look'),
    t('Ready', 'Prêt'),
  ];

  return (
    <div className="creator-screen">
      <div className="creator-preview-col">
        <span className="creator-preview-badge">
          <Icon name="newLife" size={12} /> {t('Your Yaoundéan', 'Ton Yaoundéen')}
        </span>
        <Canvas camera={{ position: [1.6, 1.4, 2.6], fov: 40 }} dpr={1.2}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 4, 3]} intensity={1.15} />
          <PreviewCharacter appearance={appearance} />
        </Canvas>
        <div className="creator-preview-bottom">
          <div className="creator-name-row">
            <input
              value={name}
              maxLength={18}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Your name…', 'Ton nom…')}
              aria-label={t('Your name', 'Ton nom')}
            />
          </div>
          <div className="creator-gender">
            {(['m', 'f', 'x'] as const).map((g) => (
              <button key={g} className={gender === g ? 'selected' : ''} onClick={() => setGender(g)}>
                {g === 'm' ? t('Man', 'Homme') : g === 'f' ? t('Woman', 'Femme') : t('Other', 'Autre')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="creator-options">
        <div className="creator-progress">
          {steps.map((label, i) => (
            <span key={label} className={`creator-progress-dot ${i <= step ? 'done' : ''}`} title={label} />
          ))}
          <span className="creator-progress-label">
            {step + 1}/{steps.length} · {steps[step]}
          </span>
        </div>

        <div className="creator-step-scroll">
          {step === 0 && (
            <div className="creator-step">
              <p className="creator-kicker">{t('Create your Yaoundéan · free', 'Crée ton Yaoundéen · gratuit')}</p>
              <h2 className="creator-step-title">{t('Who is arriving in the city?', 'Qui arrive en ville ?')}</h2>
              <p className="creator-step-sub">
                {t(
                  'Pick a name and how you want to be referred to. You can change your look later — this is your story.',
                  'Choisis un nom et comment on t’appelle. Tu pourras changer ton look plus tard — c’est ton histoire.',
                )}
              </p>
              <div className="creator-section">
                <h3>{t('Name', 'Nom')}</h3>
                <input
                  value={name}
                  maxLength={18}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('e.g. Amina, Brice, Marie…', 'ex. Amina, Brice, Marie…')}
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>
              <div className="creator-section">
                <h3>{t('Gender', 'Genre')}</h3>
                <div className="creator-gender" style={{ padding: 0 }}>
                  {(['m', 'f', 'x'] as const).map((g) => (
                    <button key={g} className={gender === g ? 'selected' : ''} onClick={() => setGender(g)}>
                      {g === 'm' ? t('Man', 'Homme') : g === 'f' ? t('Woman', 'Femme') : t('Other', 'Autre')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="creator-step">
              <p className="creator-kicker">{t('Your starting story', 'Ton point de départ')}</p>
              <h2 className="creator-step-title">{t('Where do you start?', 'Tu commences où ?')}</h2>
              <p className="creator-step-sub">
                {t(
                  'Each background changes your money, skills, needs, home quartier and the first messages you receive.',
                  'Chaque origine change ton argent, tes compétences, tes besoins, ton quartier et les premiers messages.',
                )}
              </p>
              <div className="option-grid">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    className={`option-card ${background === b.id ? 'selected' : ''}`}
                    onClick={() => setBackground(b.id)}
                  >
                    <span className="option-card-emoji" aria-hidden="true">
                      <Icon name="newLife" size={18} />
                    </span>
                    <span className="option-card-title">{fr ? b.nameFr : b.name}</span>
                    <span className="option-card-sub">{fr ? b.blurbFr : b.blurb}</span>
                  </button>
                ))}
              </div>
              <div className="bg-detail">
                <div className="muted small">
                  <Icon name="cash" size={13} /> {startMoney.toLocaleString()} F · <Icon name="location" size={13} />{' '}
                  {district}
                  {bg.debt > 0 ? (
                    <>
                      {' '}
                      · <Icon name="debt" size={13} /> {t('debt', 'dette')} {bg.debt.toLocaleString()} F
                    </>
                  ) : (
                    ''
                  )}
                </div>
                <div className="muted small">
                  {skills.map(([k, v]) => `${skillLabel(k)} ${v}`).join(' · ')}
                </div>
                <div className="muted small">
                  {needs.map(([k, v]) => `${NEED_LABELS[k][fr ? 'fr' : 'en']} ${v}`).join(' · ')}
                </div>
                <p className="muted small">{fr ? bg.blurbFr : bg.storyStart}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="creator-step">
              <p className="creator-kicker">{t('Make them yours', 'À ton image')}</p>
              <h2 className="creator-step-title">{t('How do you show up?', 'Comment tu apparais ?')}</h2>
              <p className="creator-step-sub">
                {t(
                  'Start from a preset, then tweak skin, hair, face and outfit. The 3D preview updates live.',
                  'Pars d’un preset, puis ajuste peau, cheveux, visage et tenue. L’aperçu 3D se met à jour.',
                )}
              </p>

              <div className="creator-section">
                <h3>{t('Quick presets', 'Presets rapides')}</h3>
                <div className="chip-row">
                  {CHARACTER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      title={fr ? p.subtitleFr : p.subtitle}
                      className={JSON.stringify(p.appearance) === JSON.stringify(appearance) ? 'selected' : ''}
                      onClick={() => setAppearance({ ...p.appearance })}
                    >
                      {fr ? p.nameFr : p.name}
                    </button>
                  ))}
                  <button onClick={surprise}>{t('Surprise me', 'Surprends-moi')}</button>
                </div>
              </div>

              <div className="creator-section">
                <h3>{t('Skin tone', 'Teint')}</h3>
                <div className="swatch-row">
                  {SKIN_TONES.map((tone, i) => (
                    <button
                      key={tone}
                      className={`swatch ${appearance.skinTone === i ? 'selected' : ''}`}
                      style={{ background: tone }}
                      aria-label={`${t('Skin tone', 'Teint')} ${i + 1}`}
                      onClick={() => setAppearance({ ...appearance, skinTone: i })}
                    />
                  ))}
                </div>
              </div>

              <div className="creator-section">
                <h3>{t('Hair', 'Cheveux')}</h3>
                <div className="chip-row">
                  {HAIR_STYLES.map((h) => (
                    <button key={h} className={appearance.hair === h ? 'selected' : ''} onClick={() => setAppearance({ ...appearance, hair: h })}>
                      {HAIR_LABELS[h]?.[fr ? 'fr' : 'en'] ?? h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="creator-section">
                <h3>{t('Face', 'Visage')}</h3>
                <div className="chip-row">
                  {(['oval', 'round', 'square'] as const).map((f) => (
                    <button
                      key={f}
                      className={(appearance.faceShape ?? 'oval') === f ? 'selected' : ''}
                      onClick={() => setAppearance({ ...appearance, faceShape: f })}
                    >
                      {f === 'oval' ? t('Oval', 'Ovale') : f === 'round' ? t('Round', 'Rond') : t('Square', 'Carré')}
                    </button>
                  ))}
                </div>
                <div className="chip-row">
                  {(['none', 'stubble', 'goatee', 'beard'] as const).map((f) => (
                    <button
                      key={f}
                      className={(appearance.facialHair ?? 'none') === f ? 'selected' : ''}
                      onClick={() => setAppearance({ ...appearance, facialHair: f })}
                    >
                      {f === 'none' ? t('Clean shaven', 'Rasé') : f === 'stubble' ? t('Stubble', 'Barbe naissante') : f === 'goatee' ? t('Goatee', 'Bouc') : t('Beard', 'Barbe')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="creator-section">
                <h3>{t('Body', 'Corpulence')}</h3>
                <div className="chip-row">
                  {(['slim', 'medium', 'tall'] as const).map((b) => (
                    <button key={b} className={appearance.bodyType === b ? 'selected' : ''} onClick={() => setAppearance({ ...appearance, bodyType: b })}>
                      {b === 'slim' ? t('Slim', 'Fin') : b === 'medium' ? t('Medium', 'Moyen') : t('Tall', 'Grand')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="creator-section">
                <h3>{t('Outfit', 'Tenue')}</h3>
                <div className="swatch-row">
                  {SHIRT_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${appearance.shirtColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      aria-label={t('Shirt colour', 'Couleur de chemise')}
                      onClick={() => setAppearance({ ...appearance, shirtColor: c })}
                    />
                  ))}
                </div>
                <div className="swatch-row">
                  {PANTS_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${appearance.pantsColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      aria-label={t('Trousers colour', 'Couleur de pantalon')}
                      onClick={() => setAppearance({ ...appearance, pantsColor: c })}
                    />
                  ))}
                </div>
                <div className="chip-row">
                  {(['none', 'weave', 'geo', 'stripe'] as const).map((p) => (
                    <button
                      key={p}
                      className={(appearance.pattern ?? 'none') === p ? 'selected' : ''}
                      onClick={() => setAppearance({ ...appearance, pattern: p })}
                    >
                      {p === 'none' ? t('Plain fabric', 'Tissu uni') : p === 'weave' ? t('Weave', 'Tissage') : p === 'geo' ? t('Geometry', 'Géométrie') : t('Stripes', 'Rayures')}
                    </button>
                  ))}
                </div>
                <div className="chip-row">
                  {(['pants', 'skirt'] as const).map((b) => (
                    <button
                      key={b}
                      className={(appearance.bottomStyle ?? 'pants') === b ? 'selected' : ''}
                      onClick={() => setAppearance({ ...appearance, bottomStyle: b })}
                    >
                      {b === 'pants' ? t('Trousers', 'Pantalon') : t('Skirt', 'Jupe')}
                    </button>
                  ))}
                  {(['none', 'headwrap'] as const).map((h) => (
                    <button
                      key={h}
                      className={(appearance.headwear ?? 'none') === h ? 'selected' : ''}
                      onClick={() => setAppearance({ ...appearance, headwear: h })}
                    >
                      {h === 'none' ? t('No headwear', 'Sans foulard') : t('Headwrap', 'Foulard')}
                    </button>
                  ))}
                  {appearance.overShirtColor ? (
                    <button className="selected" onClick={() => setAppearance({ ...appearance, overShirtColor: undefined })}>
                      {t('No overshirt', 'Sans surchemise')}
                    </button>
                  ) : (
                    <button onClick={() => setAppearance({ ...appearance, overShirtColor: '#e0532f' })}>
                      {t('Overshirt', 'Surchemise')}
                    </button>
                  )}
                </div>
                <div className="chip-row">
                  {(['none', 'crossbody', 'sling', 'tote'] as const).map((b) => (
                    <button
                      key={b}
                      className={(appearance.bag ?? 'none') === b ? 'selected' : ''}
                      onClick={() =>
                        setAppearance({
                          ...appearance,
                          bag: b,
                          bagColor: b === 'none' ? undefined : appearance.bagColor ?? '#6d4c41',
                        })
                      }
                    >
                      {b === 'none' ? t('No bag', 'Sans sac') : b === 'crossbody' ? t('Crossbody', 'Bandoulière') : b === 'sling' ? t('Sling', 'Sacoche') : t('Tote', 'Cabas')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="creator-step">
              <p className="creator-kicker">{t('Your first morning', 'Ton premier matin')}</p>
              <h2 className="creator-step-title">{t('Ready for Yaoundé,', 'Prêt pour Yaoundé,')} {name.trim() || t('friend', 'ami')}?</h2>
              <p className="creator-step-sub">
                {t(
                  'You will wake up in your quartier with a phone, a little money and a whole city to figure out. Rent, food, work, friends and the mayor are waiting.',
                  'Tu vas te réveiller dans ton quartier avec un téléphone, un peu d’argent et toute une ville à comprendre. Loyer, nourriture, travail, amis et le maire t’attendent.',
                )}
              </p>
              <div className="summary-grid">
                <div className="summary-row">
                  <span>{t('Name', 'Nom')}</span>
                  <strong>{name.trim() || '—'}</strong>
                </div>
                <div className="summary-row">
                  <span>{t('Starting story', 'Origine')}</span>
                  <strong>{fr ? bg.nameFr : bg.name}</strong>
                </div>
                <div className="summary-row">
                  <span>{t('Quartier', 'Quartier')}</span>
                  <strong>{district}</strong>
                </div>
                <div className="summary-row">
                  <span>{t('Money', 'Argent')}</span>
                  <strong>{startMoney.toLocaleString()} F</strong>
                </div>
                <div className="summary-row">
                  <span>{t('Debt', 'Dette')}</span>
                  <strong>{bg.debt > 0 ? `${bg.debt.toLocaleString()} F` : t('None', 'Aucune')}</strong>
                </div>
                <div className="summary-row">
                  <span>{t('Skills', 'Compétences')}</span>
                  <strong>{skills.map(([k, v]) => `${skillLabel(k)} ${v}`).join(', ') || '—'}</strong>
                </div>
              </div>
              <div className="bg-detail">
                <p className="muted small" style={{ margin: 0 }}>
                  {t(
                    'Tip: your first moves should be eating something, checking the Jobs app and talking to someone. The Journal keeps your first-day goals.',
                    'Astuce : tes premiers pas : manger, regarder l’app Emplois et parler à quelqu’un. Le Journal garde tes objectifs du premier jour.',
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="creator-actions">
          <button className="menu-btn" onClick={() => (step === 0 ? setScreen('menu') : setStep(step - 1))}>
            <Icon name="back" size={15} /> {step === 0 ? t('Back', 'Retour') : t('Back', 'Retour')}
          </button>
          {step < 3 ? (
            <button className="menu-btn menu-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              {t('Next', 'Suivant')} <Icon name="play" size={14} />
            </button>
          ) : (
            <button
              className="menu-btn menu-primary"
              disabled={!name.trim() || creating}
              onClick={async () => {
                setCreating(true);
                await newGame({ name: name.trim(), gender, background, appearance });
              }}
            >
              {creating ? t('Opening the city…', 'Ouverture de la ville…') : t('Arrive in Yaoundé', 'Arriver à Yaoundé')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
