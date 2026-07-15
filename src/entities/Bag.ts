import { SKINS } from '../types.ts';

export function getSkin(id: string) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function drawBag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
  colors: { main: string; shade: string; trim: string },
  wobble = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.sin(wobble) * 0.05);
  ctx.scale(scale, scale);

  ctx.fillStyle = colors.main;
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  ctx.lineTo(16, -18);
  ctx.lineTo(20, 20);
  ctx.lineTo(-20, 20);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.shade;
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  ctx.lineTo(16, -18);
  ctx.lineTo(17, -9);
  ctx.lineTo(-17, -9);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, -18);
  ctx.quadraticCurveTo(-7, -27, 0, -27 + Math.sin(wobble * 1.3) * 2);
  ctx.quadraticCurveTo(7, -27, 7, -18);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -9);
  ctx.lineTo(-8, 20);
  ctx.moveTo(6, -9);
  ctx.lineTo(8, 20);
  ctx.stroke();

  ctx.restore();
}
