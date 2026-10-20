import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAMED_NPCS } from '../src/data/npcs.ts';
import { CAST_LOOKS, CAST_REFERENCE_IMAGES } from '../src/data/castLooks.ts';
import { CHARACTER_PRESETS } from '../src/data/characterPresets.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = resolve(root, 'art/cultural_review_packet.md');

const swatch = (hex) => `\`${hex}\` <sub>(CSS)</sub>`;
const imageRef = (file) => `\`${file}\` (archived in git history)`;

const npcRows = NAMED_NPCS.map(
  (npc) =>
    `| ${npc.name} | ${npc.role} | ${npc.roleFr} | ${npc.id} |`,
).join('\n');

const presetRows = CHARACTER_PRESETS.map((preset) => {
  const a = preset.appearance;
  return `| ${preset.name} (${preset.nameFr}) | ${preset.subtitle} / ${preset.subtitleFr} | ${imageRef(preset.referenceImage)} | ${a.skinTone} | ${a.hair} | ${a.bodyType} | ${a.faceShape ?? 'oval'} | ${a.shirtColor} | ${a.pantsColor} | ${a.pattern ?? 'none'} | ${a.bag ?? 'none'} |`;
}).join('\n');

const castRows = Object.entries(CAST_LOOKS)
  .map(([id, look]) => {
    const img = CAST_REFERENCE_IMAGES[id];
    return `| ${id} | ${swatch(look.skin)} | ${swatch(look.hair)} | ${swatch(look.shirt)} | ${swatch(look.pants)} | ${look.headwear ? swatch(look.headwear) : '—'} | ${img ? imageRef(img) : '—'} |`;
  })
  .join('\n');

const checklist = [
  'Outfits and colors read as plausible for the character’s neighborhood, income and role (no costume-style exaggeration).',
  'Hair, headwear and fabric patterns (weave, geometry, stripes) match real everyday or ceremonial choices rather than generic “African print”.',
  'Names, roles and job titles are respectful and recognizable in the intended city context.',
  'Routine and economy (njangi, moto-taxi, cybercafé, market vending, concours) match lived experience.',
  'Dialogue tone in French and English/Camfranglais sounds natural and current, not imported from another country.',
  'No character or situation reinforces a harmful stereotype; characters keep agency and nuance.',
  'Anything to correct is listed below with a suggested replacement.',
];

const lines = [
  '# Yaoundé Life — Cultural Review Packet',
  '',
  'Status: **NOT YET REVIEWED**. This packet is reviewer material only; nothing here is an approval.',
  '',
  'Regenerate with `npm run review:packet` after any change to characters, presets, outfits or NPC seeds.',
  'Concept reference images were removed from the build to cut 32 MB; recover any of them from git history with `git show daefdae:public/assets/<file> > <file>`.',
  'Reviewers: please work through each section, tick what passes, and write corrections with suggested replacements.',
  '',
  '## 1. Named NPC roster',
  '',
  '| Name | Role (EN) | Rôle (FR) | Id |',
  '| --- | --- | --- | --- |',
  npcRows,
  '',
  '## 2. Playable presets',
  '',
  '| Name | Subtitle | Reference image | Skin tone | Hair | Body | Face | Shirt | Pants | Pattern | Bag |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  presetRows,
  '',
  '## 3. Cast outfit looks',
  '',
  '| Id | Skin | Hair | Shirt | Pants | Headwear | Reference image |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  castRows,
  '',
  '## 4. Review checklist',
  '',
  ...checklist.map((item) => `- [ ] ${item}`),
  '',
  '### Corrections and suggested replacements',
  '',
  '| Item | Problem | Suggested replacement |',
  '| --- | --- | --- |',
  '| | | |',
  '| | | |',
  '| | | |',
  '',
  '## 5. Sign-off',
  '',
  '- Reviewer name:',
  '- Reviewer background / neighborhood:',
  '- Date:',
  '- Scope covered (outfits / roles / dialogue / routines):',
  '- Verdict: [ ] approve  [ ] approve with corrections above  [ ] needs rework',
  '',
  '> Record the completed sign-off in `IMPLEMENTATION_CHECKLIST.md` (the cultural review line stays unchecked until a named reviewer signs here).',
  '',
];

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote cultural review packet (${NAMED_NPCS.length} NPCs, ${CHARACTER_PRESETS.length} presets, ${Object.keys(CAST_LOOKS).length} cast looks) -> art/cultural_review_packet.md`);
