export function drawHuman(ctx: CanvasRenderingContext2D, x: number, y: number, aimAngle: number, walkPhase: number): void {
  ctx.save();
  ctx.translate(x, y);

  const step = Math.sin(walkPhase) * 6;
  ctx.strokeStyle = '#26314a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 8);
  ctx.lineTo(-4 + step, 26);
  ctx.moveTo(4, 8);
  ctx.lineTo(4 - step, 26);
  ctx.stroke();

  ctx.fillStyle = '#3a4a6b';
  ctx.beginPath();
  ctx.roundRect(-9, -18, 18, 28, 6);
  ctx.fill();

  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -26, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(aimAngle);
  ctx.fillStyle = '#1c2233';
  ctx.beginPath();
  ctx.roundRect(4, -18, 26, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#7fc7e8';
  ctx.beginPath();
  ctx.arc(30, -11, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
