# Yaoundé Life — Character Creation System Draft

**Status:** Draft for review  
**Design basis:** Yaoundé Life PRD v1.1 and the Amina (student), Brice (creative hustler), and Marie (market trader) visual concepts.

## 1. Design goals

The character creator should let players make a recognizable, expressive person who belongs in contemporary Yaoundé—not just select a preset “class.” It should:

- Make identity and style choices feel welcoming, flexible, and easy on mobile.
- Support a wide range of dark and light skin tones, facial features, hair textures and styles, body shapes, ages, and gender expression.
- Keep face, hair, body, and clothing modular so the roster and wardrobe can expand over time.
- Make starting backgrounds meaningful through contacts, skills, obligations, and resources, but never lock a player into a career or lifestyle.
- Stay visually readable at the game’s camera distance and technically light enough for low- and mid-range phones.
- Treat the three concept designs as **starting presets and style references**, not fixed identities the player must copy.

## 2. Core creation flow

A short, guided flow should take roughly **2–4 minutes** on a phone. Players can accept a preset and start quickly, or open detailed appearance controls.

1. **Choose a starting background** — select a life situation and review its starting resources and obligations.
2. **Set identity** — enter a display name; choose voice/personality presentation only if voice is used in the MVP; choose English or French and Camfranglais flavor (off/light/heavy).
3. **Choose a look** — start from a character preset, then customize skin tone, face, hair, body proportions, and optional details.
4. **Choose an outfit** — select a complete outfit preset or mix clothing pieces; see the character from front and three-quarter angles.
5. **Review the starting situation** — confirm cash, skills, contacts, debts, and first objective. Explain that these are starting conditions, not permanent restrictions.
6. **Begin** — place the character in their starter home/quartier. Allow appearance changes later through a wardrobe or mirror.

The player should be able to go Back without losing choices. Offer **Randomize** and **Reset this section** controls. Skip deep customization with **Use this look**.

## 3. Appearance customization

### 3.1 Presets

Presets provide a coherent starting point across complexion, face, hair, body, outfit, and accessories. Every preset remains editable.

| Preset | Starting presentation | Signature elements | Suggested use |
|---|---|---|---|
| **Amina — Student** | Young adult woman | Natural twists, mustard blouse, teal trousers, practical crossbody bag, sneakers | Student or first-time city arrival |
| **Brice — Creative Hustler** | Young adult man | Short fade, orange overshirt, cream tee, dark jeans, sling bag/camera | Freelancer, hustler, or entry-level employee |
| **Marie — Market Trader** | Adult woman | Patterned headwrap, coral blouse, navy wrap skirt, tote, practical sandals | Trader’s child, entrepreneur, or established citizen |

Presets are optional appearance templates. They do **not** determine background, skill, starting money, personality, or future eligibility.

### 3.2 Customization categories

**Skin and complexion**
- A curated, continuous range of natural skin tones with warm, neutral, and cool undertones.
- Show choices on the actual character under the same neutral preview lighting used for all options.
- Avoid assigning personality, status, or gameplay bonuses to complexion.

**Face**
- Face shape presets with gentle controls for jaw, cheeks, brow, and nose within authored ranges.
- Eye shape and brow options; eye color range appropriate to the art style.
- Optional facial hair presets and subtle face details (for example, freckles or a small beauty mark), all optional.
- Keep expressions readable at gameplay scale; default face is friendly/neutral rather than exaggerated.

**Hair and headwear**
- Hair families including natural curls, short natural cuts, fades, braids, twists, locs, protective styles, wigs, and simple tied-back styles.
- Length, silhouette, and color variants where technically affordable; prioritize recognizable shape over many tiny variants.
- Optional headwraps and hair accessories, including patterns inspired by the concept art.
- Hair and headwear must be compatible with hats/hoods where possible; show a clear preview when an item hides or replaces another.

**Body**
- A small set of readable body-shape presets (for example, lean, average, broad, and curvy) rather than a complex sculpting interface.
- Adjustable height within a narrow gameplay-safe range, or a few height presets if animation compatibility requires it.
- Body choices are cosmetic only in the initial release. Do not attach stamina, strength, attractiveness, or career advantages to body shape.
- Keep hands, feet, joints, and clothing deformation animation-friendly.

**Optional details**
- Glasses, earrings, watches, simple necklaces, bags, and other low-cost accessories.
- Keep accessories independently togglable. Avoid requiring a culturally specific item as part of a character’s identity.

## 4. Clothing and color system

Clothing should be built as mix-and-match slots while retaining complete outfit presets for fast selection.

### 4.1 Clothing slots

- **Top:** T-shirts, blouses, shirts, overshirts, sweaters, work or school tops.
- **Bottom:** trousers, jeans, skirts, shorts, and other everyday options appropriate to context.
- **One-piece / wrap:** dresses and authored wrap or coordinated looks where compatible with the rig.
- **Shoes:** sneakers, flats, sandals, and work-appropriate footwear.
- **Outer layer:** light jacket or overshirt; initially limited to avoid clipping and extra asset load.
- **Headwear:** headwrap, cap, or other compatible options.
- **Accessories:** bag, watch, earrings, simple jewelry.

### 4.2 Color and pattern

- Use a warm, saturated core palette with clear color contrast, inspired by the concepts: mustard, teal, coral, cobalt, navy, orange, cream, and earthy neutrals.
- Provide a small, curated color-picker set per clothing item in the MVP. Avoid unrestricted RGB sliders until garment materials and contrast have been tested.
- Patterns should be authored as garment variants, not generated from stereotypes. Use culturally informed review for specifically regional motifs.
- Keep fictional branding on clothing and props; do not place real telco, bank, or product logos without permission.

### 4.3 Outfit presets

Initial outfit presets could include **Campus Day**, **Creative Errands**, **Market Workday**, **Casual Weekend**, **Interview / Office**, and **Celebration**. Presets should be available regardless of starting background wherever the clothing is owned/unlocked. Starter clothing should not imply a permanent job or social rank.

## 5. Background selection and starting mechanics

A background is a **starting narrative package**, not a class. It sets initial circumstances and a first story lead; players can change careers and goals later.

Each background record should define:

- Starting cash (FCFA), debt or recurring obligations if any, and starter possessions.
- A small set of skills, contacts, and familiarity bonuses.
- One or two early opportunities and a manageable first-week obligation.
- A short, non-judgmental description of the trade-offs.
- A clear preview before selection, including any debt or obligation.

### Example packages based on the concepts

- **Student / Amina:** modest cash, study-related contact, basic academic skill, phone and books; first lead is a class or part-time opportunity. Trade-off: timetable pressure and limited funds.
- **Freelancer / Creative Hustler / Brice:** modest cash, a creative skill, smartphone or compact creative tool, one potential client contact; first lead is a small paid gig. Trade-off: uncertain income and time spent finding clients.
- **Trader’s Child / Marie:** practical trading familiarity, a family or market contact, modest inventory or stall access; first lead is helping at a stall or sourcing stock. Trade-off: family expectations and inventory risk.

The exact balances must be tuned separately in game data. The creator should display values and obligations clearly; do not hide difficult starts behind flavor text.

### Fairness and flexibility rules

- No background permanently blocks a job, business, relationship, district, or activity.
- Avoid presenting poverty, informal work, or rural-to-city migration as a joke or deficit of character.
- Give every background at least one viable early action that does not require spending money.
- Do not punish players for choosing the more challenging background; include recovery paths and understandable consequences.
- Avoid gender-based starting bonuses or restrictions.

## 6. Preview, controls, and accessibility

- Use a lightweight 3D preview with rotate, zoom, and reset-camera controls. On small screens, use large touch targets and keep the character visible while scrolling options.
- Provide front and three-quarter preview angles; a back view can be added if hair/outfit details warrant it.
- Show the complete body, including shoes, in the main preview. Keep lighting neutral and skin-tone rendering consistent.
- Use labeled swatches and icons plus text labels; do not communicate selection by color alone.
- Support keyboard navigation and screen-reader labels where the browser UI permits.
- Include **Reduce motion** and avoid auto-rotating the character unless the user opts in.
- Keep language choice separate from appearance. Support English and French labels, with Camfranglais flavor as a separate dialogue preference.

## 7. Modular asset and performance guidance

- Build the character from reusable body, head, hair, and outfit modules, as set out in the PRD.
- Keep hair and clothing silhouettes simple enough to read at mobile camera distance; use texture detail sparingly.
- Use a shared skeleton and animation set across compatible body variants. Validate outfit clipping on idle, walk, sit, and phone-use animations.
- Bundle the starter presets and common assets with the initial character-creator experience; load optional cosmetics only when needed.
- Provide Low/Mid/High visual tiers without changing the character’s identity or removing core customization choices.
- Keep the PRD’s target character asset budget (about **300 KB**) in view; treat it as a target for a playable assembled character, not a promise that every optional cosmetic is included in that same bundle.
- Use two levels of detail and distant crowd impostors as specified in the PRD.

## 8. MVP scope and later additions

**MVP**
- Three editable presets matching Amina, Brice, and Marie.
- Name, background, complexion, a selection of face shapes, hair styles/colors, body-shape presets, starter outfit mix-and-match, and a few accessories.
- English/French language preference and Camfranglais flavor setting.
- Transparent background-package comparison and a starting-situation review screen.
- In-game wardrobe/mirror entry point to change owned appearance items.

**Later**
- More hair and clothing modules developed with local cultural input.
- More ages and family/NPC relationship presets, wider body and accessibility options, more work uniforms and celebration outfits.
- Additional outfit colorways and cosmetics, all optional and not required for gameplay.
- Saveable outfit presets and quick-change outfit sets.

## 9. Acceptance criteria

1. A player can create a named character from any of the three editable visual presets and enter the game.
2. Skin tone, hair, face, body preset, and outfit can each be changed independently without silently resetting other choices.
3. All three starter backgrounds display their starting cash, skills, contacts, possessions, and obligations before confirmation.
4. Choosing a background does not lock the player out of other careers or major life paths.
5. The complete character remains visible and legible in the preview on a narrow mobile viewport.
6. Appearance choices have no hidden gameplay effects unless explicitly disclosed and approved as a game-design decision.
7. The character creator works with reduced motion and does not rely on color alone to communicate selection.
8. Compatible outfits pass basic clipping checks for idle, walking, sitting, and phone-use animations.
9. The assembled character and loaded customization assets are measured against the PRD’s low-end-device performance targets.
10. Character and cultural design choices are reviewed with Cameroonian players or cultural consultants before broad release.

## 10. Decisions to confirm during implementation

- Whether the MVP allows full height adjustment or uses a few compatible height presets.
- Which face parameters should be sliders versus authored presets, given mobile UI and rigging limits.
- Whether clothes are immediately available, earned through play, or both; starting options should still allow a satisfying look without purchases.
- Exact background starting balances and obligations, tuned through playtesting rather than fixed by this art/design draft.
- Local review process for fabrics, headwear, patterns, and dialogue around each background.
