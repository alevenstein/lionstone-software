// -----------------------------------------------------------------------------
// Projectile sprites — bullet (with optional tracer line), shell, and missile
// (whose hull color depends on the powerup roll: red > silver > blue).
// -----------------------------------------------------------------------------

export function drawProjectile(ctx, proj) {
  ctx.save();
  switch (proj.kind) {
    case 'bullet':  drawBullet(ctx, proj); break;
    case 'shell':   drawShell(ctx, proj); break;
    case 'missile': drawMissile(ctx, proj); break;
  }
  ctx.restore();
}

function drawBullet(ctx, proj) {
  if (proj.tracer) {
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.strokeStyle = 'rgba(255, 240, 160, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(proj.x - Math.cos(angle) * 10, proj.y - Math.sin(angle) * 10);
    ctx.lineTo(proj.x, proj.y);
    ctx.stroke();
  }
  ctx.fillStyle = proj.color;
  ctx.beginPath(); ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2); ctx.fill();
}

function drawShell(ctx, proj) {
  ctx.fillStyle = proj.color;
  ctx.beginPath(); ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2); ctx.fill();
  // Specular highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.arc(proj.x - 1, proj.y - 1, proj.size * 0.5, 0, Math.PI * 2); ctx.fill();
}

function drawMissile(ctx, proj) {
  const angle = Math.atan2(proj.vy, proj.vx);
  ctx.translate(proj.x, proj.y);
  ctx.rotate(angle);
  // Color priority: red (rate-maxed 1/20) > silver (dmg-maxed 1/20) > blue (default)
  const body  = proj.red ? '#e83838' : (proj.silver ? '#d8d8e0' : '#4068b0');
  const shade = proj.red ? '#982020' : (proj.silver ? '#9898a8' : '#28407a');
  ctx.fillStyle = body;  ctx.fillRect(-6, -2, 12, 4);
  ctx.fillStyle = shade; ctx.fillRect(-6, -2, 12, 1.5);
  ctx.fillStyle = '#a83030'; ctx.fillRect(4, -2, 3, 4);    // nose cone
  ctx.fillStyle = '#ffaa44'; ctx.fillRect(-8, -1, 2, 2);   // exhaust flame
}
