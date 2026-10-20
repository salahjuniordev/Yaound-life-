import * as THREE from 'three';
import { drawWorldGlyph, type WorldGlyph } from './worldIcons';

export const npcRuntime: Record<string, { x: number; z: number }> = {};

export function labelSprite(text: string, opts: { bg?: string; fg?: string; size?: number } = {}): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = 512;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = opts.bg ?? 'rgba(20,20,26,0.72)';
  const pad = 8;
  ctx.font = 'bold 40px system-ui, sans-serif';
  const width = Math.min(500, ctx.measureText(text).width + pad * 2);
  roundRect(ctx, (512 - width) / 2, 6, width, size - 12, 16);
  ctx.fill();
  ctx.fillStyle = opts.fg ?? '#f5efe0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, size / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 0.4, 1);
  return sprite;
}

export function iconSprite(glyph: WorldGlyph, ring: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16,16,22,0.66)';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.strokeStyle = '#f5efe0';
  drawWorldGlyph(ctx, glyph, 64, 64, 58);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.5, 1.5, 1);
  return sprite;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
