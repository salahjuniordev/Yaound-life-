import test from 'node:test';
import assert from 'node:assert/strict';
import { NAMED_NPCS } from '../src/data/npcs';
import { CAST_LOOKS, CAST_NPC_IDS, CAST_REFERENCE_IMAGES } from '../src/data/castLooks';
import { npcActivityText } from '../src/sim/npcsim';
import { NPC_PLACE_ALIASES, PLACE_POSITIONS } from '../src/data/places';
import type { NPCState } from '../src/sim/types';

test('the six cast NPCs exist with reference looks and images', () => {
  assert.deepEqual(CAST_NPC_IDS.slice().sort(), ['esther', 'jean_claude', 'michel', 'pauline', 'sandra', 'serge']);
  const ids = new Set(NAMED_NPCS.map((n) => n.id));
  for (const id of CAST_NPC_IDS) {
    assert.ok(ids.has(id), `missing cast NPC ${id}`);
    const image = CAST_REFERENCE_IMAGES[id];
    assert.match(image ?? '', /^[a-z_]+\.png$/, `reference image name for ${id}`);
    assert.match(CAST_LOOKS[id].shirt, /^#[0-9a-f]{6}$/i, `${id} shirt colour`);
    assert.match(CAST_LOOKS[id].pants, /^#[0-9a-f]{6}$/i, `${id} pants colour`);
    assert.match(CAST_LOOKS[id].skin, /^#[0-9a-f]{6}$/i, `${id} skin tone`);
  }
  const shirts = new Set(CAST_NPC_IDS.map((id) => CAST_LOOKS[id].shirt));
  assert.ok(shirts.size >= 5, 'cast shirts are visually distinct');
});

test('cast members carry roster roles in the NPC data', () => {
  const byId = Object.fromEntries(NAMED_NPCS.map((n) => [n.id, n]));
  assert.equal(byId.michel.role, 'Moto-taxi driver');
  assert.equal(byId.pauline.role, 'Nurse / health worker');
  assert.equal(byId.serge.role, 'Musician / producer');
  assert.equal(byId.esther.role, 'Community footballer');
  assert.equal(byId.jean_claude.role, 'Teacher / parent');
  assert.equal(byId.sandra.role, 'Graduate / job seeker');
  for (const id of CAST_NPC_IDS) {
    assert.ok(byId[id].dialogueFr, `${id} has French dialogue`);
    assert.ok(byId[id].schedule.length >= 3, `${id} has a daily routine`);
  }
});

test('all named NPC schedules resolve to real places and labelled activities', () => {
  for (const seed of NAMED_NPCS) {
    const npc: NPCState = { ...seed, district: seed.homeDistrict };
    assert.ok(seed.schedule.length >= 3, `${seed.id} schedule`);
    for (const slot of seed.schedule) {
      assert.ok(
        NPC_PLACE_ALIASES[slot.place] ?? PLACE_POSITIONS[slot.place],
        `${seed.id} unknown place ${slot.place}`,
      );
      const span = ((slot.to - slot.from) % 1440 + 1440) % 1440;
      const mid = (slot.from + Math.floor(span / 2)) % 1440;
      const label = npcActivityText(npc, mid, false);
      assert.notEqual(label, 'Busy', `${seed.id} unlabelled activity ${slot.activity}`);
    }
  }
});
