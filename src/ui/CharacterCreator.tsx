import { useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { BACKGROUNDS } from '../data/backgrounds';
import { HAIR_STYLES, SHIRT_COLORS, SKIN_TONES, PANTS_COLORS } from '../data/backgrounds';
import { CHARACTER_PRESETS } from '../data/characterPresets';
import { animateCharacter, buildCharacter } from '../render/characters';
import { useGame } from '../state/store';
import { Icon } from './icons';
import type { Appearance, BackgroundId, NeedsState, SkillKey } from '../sim/types';

const SKILL_LABELS: Record<string, string> = {
  academics: 'Academics', tech: 'Tech', sales: 'Sales', negotiation: 'Negotiation', music: 'Music',
  fitness: 'Fitness', cooking: 'Cooking', driving: 'Driving', charisma: 'Charisma', crafts: 'Crafts',
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
        <meshBasicMaterial color="#22262c" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export function CharacterCreator() {
  const newGame = useGame((s) => s.newGame);
  const setScreen = useGame((s) => s.setScreen);
  const fr = (typeof localStorage !== 'undefined' ? localStorage.getItem('yaounde-lang') : null) === 'fr';
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

  return (
    <div className="creator-screen">
      <div className="creator-preview-col">
        <Canvas camera={{ position: [1.6, 1.4, 2.6], fov: 40 }} dpr={1.2}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 4, 3]} intensity={1.1} />
          <PreviewCharacter appearance={appearance} />
        </Canvas>
        <div className="creator-name-row">
          <input
            value={name}
            maxLength={18}
            onChange={(e) => setName(e.target.value)}
            placeholder={fr ? 'Ton nom…' : 'Your name…'}
          />
        </div>
        <div className="creator-gender">
          {(['m', 'f', 'x'] as const).map((g) => (
            <button key={g} className={gender === g ? 'selected' : ''} onClick={() => setGender(g)}>
              {g === 'm' ? (fr ? 'Homme' : 'Man') : g === 'f' ? (fr ? 'Femme' : 'Woman') : fr ? 'Autre' : 'Other'}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-options">
        <h2>{fr ? 'Qui es-tu à Yaoundé ?' : 'Who are you in Yaounde?'}</h2>

        <h3>{fr ? 'Origine' : 'Background'}</h3>
        <div className="bg-list">
          {BACKGROUNDS.map((b) => (
            <button key={b.id} className={`bg-card ${background === b.id ? 'selected' : ''}`} onClick={() => setBackground(b.id)}>
              <span className="bg-name">{fr ? b.nameFr : b.name}</span>
              <span className="muted small">{fr ? b.blurbFr : b.blurb}</span>
            </button>
          ))}
        </div>

        <div className="bg-detail">
          <div className="muted small">
            <Icon name="cash" size={13} /> {(bg.cash + bg.momo + bg.bank).toLocaleString()} F ·{' '}
            <Icon name="location" size={13} /> {bg.district.replace('_', ' ')}
            {bg.debt > 0 ? (
              <>
                {' '}
                · <Icon name="debt" size={13} /> {fr ? 'dette' : 'debt'} {bg.debt.toLocaleString()} F
              </>
            ) : (
              ''
            )}
          </div>
          <div className="muted small">
            {skills.map(([k, v]) => `${SKILL_LABELS[k] ?? k} ${v}`).join(' · ')}
          </div>
          <div className="muted small">
            {needs.map(([k, v]) => `${k} ${v}`).join(' · ')}
          </div>
          <p className="muted small">{bg.storyStart}</p>
        </div>

        <h3>{fr ? 'Apparence' : 'Appearance'}</h3>
        <div className="chip-row">
          {CHARACTER_PRESETS.map((p) => (
            <button
              key={p.id}
              title={fr ? p.subtitleFr : p.subtitle}
              className={JSON.stringify(p.appearance) === JSON.stringify(appearance) ? 'selected' : ''}
              onClick={() => setAppearance({ ...p.appearance })}
            >
              {fr ? p.nameFr : p.name} — {fr ? p.subtitleFr : p.subtitle}
            </button>
          ))}
        </div>
        <div className="swatch-row">
          {SKIN_TONES.map((tone, i) => (
            <button
              key={tone}
              className={`swatch ${appearance.skinTone === i ? 'selected' : ''}`}
              style={{ background: tone }}
              onClick={() => setAppearance({ ...appearance, skinTone: i })}
            />
          ))}
        </div>
        <div className="chip-row">
          {HAIR_STYLES.map((h) => (
            <button key={h} className={appearance.hair === h ? 'selected' : ''} onClick={() => setAppearance({ ...appearance, hair: h })}>
              {h}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {(['oval', 'round', 'square'] as const).map((f) => (
            <button
              key={f}
              className={(appearance.faceShape ?? 'oval') === f ? 'selected' : ''}
              onClick={() => setAppearance({ ...appearance, faceShape: f })}
            >
              {f === 'oval' ? (fr ? 'Visage ovale' : 'Oval face') : f === 'round' ? (fr ? 'Visage rond' : 'Round face') : fr ? 'Visage carré' : 'Square face'}
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
              {f === 'none'
                ? fr ? 'Rasé' : 'Clean shaven'
                : f === 'stubble'
                  ? fr ? 'Barbe naissante' : 'Stubble'
                  : f === 'goatee'
                    ? fr ? 'Bouc' : 'Goatee'
                    : fr ? 'Barbe' : 'Beard'}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {(['slim', 'medium', 'tall'] as const).map((b) => (
            <button key={b} className={appearance.bodyType === b ? 'selected' : ''} onClick={() => setAppearance({ ...appearance, bodyType: b })}>
              {b}
            </button>
          ))}
        </div>
        <div className="swatch-row">
          {SHIRT_COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${appearance.shirtColor === c ? 'selected' : ''}`}
              style={{ background: c }}
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
              {p === 'none'
                ? fr ? 'Tissu uni' : 'Plain fabric'
                : p === 'weave'
                  ? fr ? 'Tissage' : 'Weave'
                  : p === 'geo'
                    ? fr ? 'Géométrie' : 'Geometry'
                    : fr ? 'Rayures' : 'Stripes'}
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
              {b === 'pants' ? (fr ? 'Pantalon' : 'Trousers') : fr ? 'Jupe' : 'Skirt'}
            </button>
          ))}
          {(['none', 'headwrap'] as const).map((h) => (
            <button
              key={h}
              className={(appearance.headwear ?? 'none') === h ? 'selected' : ''}
              onClick={() => setAppearance({ ...appearance, headwear: h })}
            >
              {h === 'none' ? (fr ? 'Sans foulard' : 'No headwear') : fr ? 'Foulard' : 'Headwrap'}
            </button>
          ))}
          {appearance.overShirtColor ? (
            <button className="selected" onClick={() => setAppearance({ ...appearance, overShirtColor: undefined })}>
              {fr ? 'Sans surchemise' : 'No overshirt'}
            </button>
          ) : (
            <button onClick={() => setAppearance({ ...appearance, overShirtColor: '#e0532f' })}>
              {fr ? 'Surchemise' : 'Overshirt'}
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
                  bagColor: b === 'none' ? undefined : (appearance.bagColor ?? '#6d4c41'),
                })
              }
            >
              {b === 'none'
                ? fr ? 'Sans sac' : 'No bag'
                : b === 'crossbody'
                  ? fr ? 'Bandoulière' : 'Crossbody'
                  : b === 'sling'
                    ? fr ? 'Sacoche' : 'Sling'
                    : fr ? 'Cabas' : 'Tote'}
            </button>
          ))}
        </div>

        <div className="creator-actions">
          <button className="menu-btn" onClick={() => setScreen('menu')}>
            <Icon name="back" size={15} /> {fr ? 'Retour' : 'Back'}
          </button>
          <button
            className="menu-btn menu-primary"
            disabled={!name.trim() || creating}
            onClick={async () => {
              setCreating(true);
              await newGame({ name: name.trim(), gender, background, appearance });
            }}
          >
            {creating ? '…' : fr ? 'Arriver à Yaoundé' : 'Arrive in Yaounde'}
          </button>
        </div>
      </div>
    </div>
  );
}
