export const WORLD_GLYPHS = [
  'pin',
  'food',
  'market',
  'box',
  'laptop',
  'shop',
  'health',
  'gym',
  'drink',
  'ball',
  'book',
  'bank',
  'phone',
  'scissors',
  'people',
  'tool',
  'mic',
  'museum',
  'church',
  'mosque',
  'photo',
  'bus',
  'home',
  'tree',
] as const;

export type WorldGlyph = (typeof WORLD_GLYPHS)[number];

const GLYPH_SET = new Set<string>(WORLD_GLYPHS);

export function worldGlyphFor(icon: string): WorldGlyph {
  return GLYPH_SET.has(icon) ? (icon as WorldGlyph) : 'pin';
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const GLYPHS: Record<WorldGlyph, (ctx: CanvasRenderingContext2D) => void> = {
  pin: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-5, 4, -7, 1, -7, -2);
    ctx.arc(0, -2, 7, Math.PI, 0);
    ctx.bezierCurveTo(7, 1, 5, 4, 0, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -2, 2.4, 0, Math.PI * 2);
    ctx.stroke();
  },
  food: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-8, 1);
    ctx.lineTo(8, 1);
    ctx.arc(0, 1, 8, 0, Math.PI);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.quadraticCurveTo(-2.5, -6, -4, -3);
    ctx.moveTo(0, -9);
    ctx.quadraticCurveTo(1.5, -6.5, 0, -3.5);
    ctx.moveTo(4, -8);
    ctx.quadraticCurveTo(5.5, -6, 4, -3);
    ctx.stroke();
  },
  market: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-9, -2);
    ctx.lineTo(-7, 9);
    ctx.lineTo(7, 9);
    ctx.lineTo(9, -2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -2);
    ctx.lineTo(-5, 9);
    ctx.moveTo(0, -2);
    ctx.lineTo(0, 9);
    ctx.moveTo(5, -2);
    ctx.lineTo(5, 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -2, 6, Math.PI, 0);
    ctx.stroke();
  },
  box: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(0, -9);
    ctx.lineTo(8, -4);
    ctx.lineTo(8, 6);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(0, 1);
    ctx.lineTo(8, -4);
    ctx.moveTo(0, 1);
    ctx.lineTo(0, 11);
    ctx.stroke();
  },
  laptop: (ctx) => {
    ctx.beginPath();
    rrect(ctx, -7, -9, 14, 11, 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, 7);
    ctx.lineTo(10, 7);
    ctx.moveTo(-7, 4);
    ctx.lineTo(-7, 2);
    ctx.moveTo(7, 4);
    ctx.lineTo(7, 2);
    ctx.stroke();
  },
  shop: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-9, -1);
    ctx.lineTo(-9, 8);
    ctx.lineTo(9, 8);
    ctx.lineTo(9, -1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(10, -6);
    ctx.lineTo(9, -1);
    ctx.lineTo(-9, -1);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.quadraticCurveTo(-7.5, -9, -5, -6);
    ctx.quadraticCurveTo(-2.5, -9, 0, -6);
    ctx.quadraticCurveTo(2.5, -9, 5, -6);
    ctx.quadraticCurveTo(7.5, -9, 10, -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, 8);
    ctx.lineTo(-2, 3);
    ctx.quadraticCurveTo(0, 1, 2, 3);
    ctx.lineTo(2, 8);
    ctx.stroke();
  },
  health: (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(0, 4.5);
    ctx.moveTo(-4.5, 0);
    ctx.lineTo(4.5, 0);
    ctx.stroke();
  },
  gym: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.moveTo(6, -6);
    ctx.lineTo(6, 6);
    ctx.moveTo(-3, -8.5);
    ctx.lineTo(-3, 8.5);
    ctx.moveTo(3, -8.5);
    ctx.lineTo(3, 8.5);
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.stroke();
  },
  drink: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.lineTo(-3.5, 9);
    ctx.lineTo(3.5, 9);
    ctx.lineTo(5, -7);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1, -7);
    ctx.lineTo(3, -11);
    ctx.moveTo(-4, -1);
    ctx.lineTo(4, -1);
    ctx.stroke();
  },
  ball: (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -4.4);
    ctx.lineTo(3.4, -1.9);
    ctx.lineTo(2.1, 2.1);
    ctx.lineTo(-2.1, 2.1);
    ctx.lineTo(-3.4, -1.9);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -4.4);
    ctx.lineTo(0, -9);
    ctx.moveTo(3.4, -1.9);
    ctx.lineTo(7.8, -3.4);
    ctx.moveTo(2.1, 2.1);
    ctx.lineTo(4.9, 6);
    ctx.moveTo(-2.1, 2.1);
    ctx.lineTo(-4.9, 6);
    ctx.moveTo(-3.4, -1.9);
    ctx.lineTo(-7.8, -3.4);
    ctx.stroke();
  },
  book: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.quadraticCurveTo(-5, -9.5, 0, -6);
    ctx.quadraticCurveTo(5, -9.5, 10, -6);
    ctx.lineTo(10, 7);
    ctx.quadraticCurveTo(5, 4.5, 0, 7);
    ctx.quadraticCurveTo(-5, 4.5, -10, 7);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 7);
    ctx.stroke();
  },
  bank: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-10, -5.5);
    ctx.lineTo(0, -11);
    ctx.lineTo(10, -5.5);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, -5.5);
    ctx.lineTo(-7, 5);
    ctx.moveTo(-2.4, -5.5);
    ctx.lineTo(-2.4, 5);
    ctx.moveTo(2.4, -5.5);
    ctx.lineTo(2.4, 5);
    ctx.moveTo(7, -5.5);
    ctx.lineTo(7, 5);
    ctx.moveTo(-9.5, 5);
    ctx.lineTo(9.5, 5);
    ctx.moveTo(-10.5, 8);
    ctx.lineTo(10.5, 8);
    ctx.stroke();
  },
  phone: (ctx) => {
    ctx.beginPath();
    rrect(ctx, -5.5, -10, 11, 20, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1.8, 7);
    ctx.lineTo(1.8, 7);
    ctx.stroke();
  },
  scissors: (ctx) => {
    ctx.beginPath();
    ctx.arc(-3.4, 6, 2.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3.4, 6, 2.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1.6, 4.1);
    ctx.lineTo(7.5, -9);
    ctx.moveTo(1.6, 4.1);
    ctx.lineTo(-7.5, -9);
    ctx.stroke();
  },
  people: (ctx) => {
    ctx.beginPath();
    ctx.arc(-3.8, -4.5, 3.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9.5, 8);
    ctx.quadraticCurveTo(-3.8, 0.5, 1.9, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5, -2.5, 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1.5, 8);
    ctx.quadraticCurveTo(5.5, 2, 10.5, 8);
    ctx.stroke();
  },
  tool: (ctx) => {
    ctx.beginPath();
    ctx.arc(-4.6, -4.6, 3.9, 0.5, Math.PI * 1.85, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(7.5, 7.5);
    ctx.stroke();
  },
  mic: (ctx) => {
    ctx.beginPath();
    rrect(ctx, -3, -10, 6, 10.5, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.arc(0, 0, 5, Math.PI, 0);
    ctx.moveTo(0, 5);
    ctx.lineTo(0, 9);
    ctx.moveTo(-4, 9);
    ctx.lineTo(4, 9);
    ctx.stroke();
  },
  museum: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-10, -7);
    ctx.lineTo(-10, -5.5);
    ctx.lineTo(10, -5.5);
    ctx.lineTo(10, -7);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, -5.5);
    ctx.lineTo(-8, 6);
    ctx.moveTo(-3, -5.5);
    ctx.lineTo(-3, 6);
    ctx.moveTo(3, -5.5);
    ctx.lineTo(3, 6);
    ctx.moveTo(8, -5.5);
    ctx.lineTo(8, 6);
    ctx.moveTo(-11, 6);
    ctx.lineTo(11, 6);
    ctx.moveTo(-12, 9);
    ctx.lineTo(12, 9);
    ctx.stroke();
  },
  church: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-7, 8);
    ctx.lineTo(-7, -1);
    ctx.lineTo(0, -8);
    ctx.lineTo(7, -1);
    ctx.lineTo(7, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, -11.5);
    ctx.moveTo(-2, -9.5);
    ctx.lineTo(2, -9.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, 8);
    ctx.lineTo(-2, 3.5);
    ctx.quadraticCurveTo(0, 1.5, 2, 3.5);
    ctx.lineTo(2, 8);
    ctx.stroke();
  },
  mosque: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-7, 8);
    ctx.lineTo(-7, 3);
    ctx.moveTo(7, 8);
    ctx.lineTo(7, 3);
    ctx.beginPath();
    ctx.moveTo(-6, 3);
    ctx.arc(0, 3, 6, Math.PI, 0);
    ctx.lineTo(6, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(0, -7);
    ctx.arc(1.3, -8.3, 1.8, Math.PI * 0.6, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10.5, 8);
    ctx.lineTo(-10.5, -1);
    ctx.arc(-10.5, -2.5, 1.5, Math.PI, 0);
    ctx.moveTo(-9, 8);
    ctx.lineTo(-9, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-11.5, 8);
    ctx.lineTo(7.5, 8);
    ctx.stroke();
  },
  photo: (ctx) => {
    ctx.beginPath();
    rrect(ctx, -9, -5, 18, 12.5, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 1.4, 3.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3.4, -5);
    ctx.lineTo(-2, -8);
    ctx.lineTo(2, -8);
    ctx.lineTo(3.4, -5);
    ctx.stroke();
  },
  bus: (ctx) => {
    ctx.beginPath();
    rrect(ctx, -9, -6.5, 18, 13, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, -1.5);
    ctx.lineTo(9, -1.5);
    ctx.moveTo(-3.5, -6.5);
    ctx.lineTo(-3.5, -1.5);
    ctx.moveTo(0, 3);
    ctx.lineTo(0, 6.5);
    ctx.moveTo(-9, 3);
    ctx.lineTo(9, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-5.5, 8, 1.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5.5, 8, 1.9, 0, Math.PI * 2);
    ctx.stroke();
  },
  home: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(0, -9);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, -1);
    ctx.lineTo(-7, 9);
    ctx.lineTo(7, 9);
    ctx.lineTo(7, -1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, 9);
    ctx.lineTo(-2, 4);
    ctx.quadraticCurveTo(0, 2, 2, 4);
    ctx.lineTo(2, 9);
    ctx.stroke();
  },
  tree: (ctx) => {
    ctx.beginPath();
    ctx.arc(0, -2.5, 6.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, 9.5);
    ctx.moveTo(-2.5, 5.5);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(2.5, 5.5);
    ctx.stroke();
  },
};

export function drawWorldGlyph(ctx: CanvasRenderingContext2D, glyph: WorldGlyph, cx: number, cy: number, size: number) {
  const draw = GLYPHS[glyph] ?? GLYPHS.pin;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  ctx.restore();
}
