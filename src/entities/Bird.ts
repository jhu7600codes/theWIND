export function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, flapPhase: number, holdingBag: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle * 0.4);

  const flap = Math.sin(flapPhase) * 0.9;

  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(flap * 0.6);
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-22, -6 - flap * 10, -30, 2 - flap * 4);
  ctx.quadraticCurveTo(-16, 6, 0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.ellipse(9, -3, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e8a23a';
  ctx.beginPath();
  ctx.moveTo(15, -4);
  ctx.lineTo(23, -2);
  ctx.lineTo(15, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(11, -4, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (holdingBag) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.translate(x, y + 16);
    ctx.fillStyle = '#e8c78a';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
}
