// ============================================================
//  FINAL FORM — Canvas Renderer
// ============================================================

const Renderer = (() => {
  // ---- Background ----
  function drawArena(ctx, W, H, t) {
    // Sky / void
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#070010');
    bgGrad.addColorStop(0.5, '#0d0020');
    bgGrad.addColorStop(1, '#15001a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stone floor with perspective
    const floorY = H * 0.62;
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, H);
    floorGrad.addColorStop(0, '#1a1528');
    floorGrad.addColorStop(1, '#0e0018');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, W, H - floorY);

    // Floor grid lines (perspective)
    ctx.strokeStyle = 'rgba(120,80,160,0.25)';
    ctx.lineWidth = 1;
    const vp = { x: W / 2, y: floorY };
    for (let i = 0; i <= 12; i++) {
      const x = (i / 12) * W;
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let row = 0; row <= 5; row++) {
      const t2 = row / 5;
      const y = floorY + (H - floorY) * t2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Stained glass window backdrop (center top)
    drawWindow(ctx, W / 2, H * 0.18, 120, t);

    // Torch floor glow (warm light pools on floor)
    const torchFlicker = 0.7 + 0.3 * Math.sin(t * 0.013);
    [60, W - 60].forEach(tx => {
      const floorGlow = ctx.createRadialGradient(tx, floorY, 5, tx, floorY, 160);
      floorGlow.addColorStop(0, `rgba(255,120,0,${0.12 * torchFlicker})`);
      floorGlow.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = floorGlow;
      ctx.fillRect(0, floorY, W, H - floorY);
    });

    // Torches
    drawTorch(ctx, 60, floorY - 10, t);
    drawTorch(ctx, W - 60, floorY - 10, t);

    // Audience silhouettes
    drawAudience(ctx, W, H, t);

    // Vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawWindow(ctx, cx, cy, size, t) {
    // Gothic rose window
    ctx.save();
    ctx.translate(cx, cy);
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.001);
    ctx.globalAlpha = 0.35 * pulse;
    // Outer ring
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = '#1a0030';
    ctx.fill();
    // Segments
    const colors = ['#660033', '#004466', '#2d0055', '#003322', '#440066'];
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, size * 0.9, a0, a1);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,160,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Inner circle
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#330044';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,160,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawTorch(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    const flicker = Math.sin(t * 0.012 + x * 0.01) * 0.4;
    const flicker2 = Math.sin(t * 0.019 + x * 0.007) * 0.25;

    // Large glow halo (wall sconce effect)
    ctx.globalAlpha = 0.18 + 0.08 * Math.abs(flicker);
    const bigGlow = ctx.createRadialGradient(0, -20, 5, 0, -20, 90);
    bigGlow.addColorStop(0, '#ff8800');
    bigGlow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = bigGlow;
    ctx.beginPath();
    ctx.arc(0, -20, 90, 0, Math.PI * 2);
    ctx.fill();

    // Torch bracket
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6a4800';
    ctx.fillRect(-4, 0, 8, 30);
    ctx.fillStyle = '#886030';
    ctx.fillRect(-7, -5, 14, 10);

    // Flame base (coal)
    ctx.fillStyle = '#771100';
    ctx.beginPath();
    ctx.ellipse(0, -5, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flame layers (innermost to outermost)
    const flames = [
      { size: 8, col: '#ffffaa', alpha: 0.9 },
      { size: 14, col: '#ffcc00', alpha: 0.8 },
      { size: 20, col: '#ff6a00', alpha: 0.65 },
      { size: 25, col: '#ff2200', alpha: 0.4 },
    ];
    flames.forEach(({ size, col, alpha }, i) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      const fx = flicker * size * 0.3 + flicker2 * size * 0.2;
      ctx.moveTo(-4, -5);
      ctx.quadraticCurveTo(size * 0.5 + fx, -5 - size * 0.5, fx * 0.5, -5 - size * (1 + 0.1 * i));
      ctx.quadraticCurveTo(-size * 0.5 + fx, -5 - size * 0.5, 4, -5);
      ctx.closePath();
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  const audienceReact = new Array(8).fill(0);

  function setAudienceReaction(val) {
    for (let i = 0; i < audienceReact.length; i++) {
      audienceReact[i] = val * (0.7 + Math.random() * 0.6);
    }
  }

  function drawAudience(ctx, W, H, t) {
    // Audience seating band at bottom
    const seatY = H - 20;
    ctx.fillStyle = 'rgba(5,0,12,0.85)';
    ctx.fillRect(0, seatY - 50, W, 70);

    // Seat row border
    ctx.strokeStyle = 'rgba(100,60,140,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, seatY - 50);
    ctx.lineTo(W, seatY - 50);
    ctx.stroke();

    const count = 12;
    for (let i = 0; i < count; i++) {
      const x = (W / (count + 1)) * (i + 1);
      const react = audienceReact[i % audienceReact.length];
      audienceReact[i % audienceReact.length] = Math.max(0, audienceReact[i % audienceReact.length] - 0.25);
      const bobY = react * (8 + 5 * Math.abs(Math.sin(t * 0.015 + i * 1.3)));
      const size = 18 + (i % 3) * 5;
      drawSilhouette(ctx, x, seatY - 8 - bobY, size, react > 0.4 || (i % 2 === 0 && react > 0.1));
    }
  }

  function drawSilhouette(ctx, x, y, size, raised) {
    // Soft rim light around silhouettes for visibility
    ctx.fillStyle = 'rgba(60,20,80,0.5)';
    ctx.beginPath();
    ctx.arc(x, y - size * 0.62, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.42, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main silhouette
    ctx.fillStyle = '#080010';
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.38, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - size * 0.62, size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    if (raised) {
      // Raised arm
      const armX = x + (Math.random() > 0.5 ? -1 : 1) * size * 0.25;
      ctx.beginPath();
      ctx.moveTo(armX, y - size * 0.3);
      ctx.lineTo(armX + (armX < x ? -1 : 1) * size * 0.35, y - size * 0.85);
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = '#080010';
      ctx.stroke();
      // Rim on arm
      ctx.lineWidth = size * 0.18;
      ctx.strokeStyle = 'rgba(60,20,80,0.4)';
      ctx.stroke();
    }
  }

  // ---- Boss ----
  function drawBoss(ctx, boss, t) {
    if (boss.state === 'dead' && boss.scale <= 0) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.rotation);
    ctx.scale(boss.scale, boss.scale);

    const pulse = 1 + 0.04 * Math.sin(t * 0.002 + boss.animFrame);
    const color = boss.color;
    const isHurt = boss.hurtFlash > 0;
    const isTelegraph = boss.state === 'telegraphing';

    // Glow aura
    const glowRadius = 90 * boss.scale + (isTelegraph ? 20 * Math.sin(t * 0.02) : 0);
    const glowAlpha = boss.phase === 2 ? 0.3 : 0.18;
    const grd = ctx.createRadialGradient(0, 0, 10, 0, 0, glowRadius);
    grd.addColorStop(0, color + '88');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Body — jagged angular shape
    const bodyColor = isHurt ? '#ffffff' : color;
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = isHurt ? '#ff4444' : darken(color, 0.5);
    ctx.lineWidth = 3;

    const pts = bossBodyPoints(boss.phase, t, boss.animFrame);
    ctx.beginPath();
    ctx.moveTo(pts[0].x * pulse, pts[0].y * pulse);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * pulse, pts[i].y * pulse);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Phase 2 wings
    if (boss.phase === 2) {
      drawWings(ctx, color, t, boss.animFrame);
    }

    // Horns
    drawHorns(ctx, color, boss.phase);

    // Eyes
    drawBossEyes(ctx, boss, t);

    // Weak point indicator (pulsing gem)
    const wpOff = boss.weakPointOffset;
    const wpPulse = 0.7 + 0.3 * Math.sin(t * 0.005);
    ctx.save();
    ctx.translate(wpOff.x, wpOff.y);
    const gemGrd = ctx.createRadialGradient(0, 0, 2, 0, 0, 14);
    gemGrd.addColorStop(0, '#ffffff');
    gemGrd.addColorStop(0.4, '#ffe000');
    gemGrd.addColorStop(1, 'rgba(255,200,0,0)');
    ctx.fillStyle = gemGrd;
    ctx.globalAlpha = wpPulse;
    ctx.beginPath();
    // Diamond shape
    ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffe000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.restore();
  }

  function bossBodyPoints(phase, t, frame) {
    const r = phase === 2 ? 55 : 45;
    const count = phase === 2 ? 9 : 7;
    const pts = [];
    const wobble = Math.sin(t * 0.003) * 4;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const outerR = r + (i % 2 === 0 ? 20 + wobble : -10);
      pts.push({
        x: Math.cos(angle) * outerR,
        y: Math.sin(angle) * outerR
      });
    }
    return pts;
  }

  function drawWings(ctx, color, t, frame) {
    const flap = Math.sin(t * 0.006) * 20;
    ctx.fillStyle = color + '66';
    ctx.strokeStyle = color + 'aa';
    ctx.lineWidth = 2;
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.bezierCurveTo(-110, -30 + flap, -130, 40 + flap, -80, 70);
    ctx.bezierCurveTo(-60, 60, -50, 40, -50, 0);
    ctx.fill(); ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(50, 0);
    ctx.bezierCurveTo(110, -30 + flap, 130, 40 + flap, 80, 70);
    ctx.bezierCurveTo(60, 60, 50, 40, 50, 0);
    ctx.fill(); ctx.stroke();
  }

  function drawHorns(ctx, color, phase) {
    ctx.fillStyle = darken(color, 0.7);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    const h = phase === 2 ? 40 : 28;
    // Left horn
    ctx.beginPath();
    ctx.moveTo(-20, -50); ctx.lineTo(-35, -50 - h); ctx.lineTo(-10, -48);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Right horn
    ctx.beginPath();
    ctx.moveTo(20, -50); ctx.lineTo(35, -50 - h); ctx.lineTo(10, -48);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (phase === 2) {
      // Extra small horns
      ctx.beginPath();
      ctx.moveTo(-5, -52); ctx.lineTo(-10, -72); ctx.lineTo(0, -50);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5, -52); ctx.lineTo(10, -72); ctx.lineTo(0, -50);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawBossEyes(ctx, boss, t) {
    const eyePulse = 0.7 + 0.3 * Math.sin(t * 0.008);
    const eyeColor = boss.phase === 2 ? '#ff0000' : '#ff6600';
    [-18, 18].forEach(ex => {
      ctx.save();
      ctx.translate(ex, -20);
      const eg = ctx.createRadialGradient(0, 0, 1, 0, 0, 10 * eyePulse);
      eg.addColorStop(0, '#ffffff');
      eg.addColorStop(0.3, eyeColor);
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = eg;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 * eyePulse, 7 * eyePulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    });
  }

  // ---- Hero ----
  function drawHero(ctx, hero, t) {
    if (hero.dead && hero.hp <= 0 && hero.stateTimer < -500) return;
    ctx.save();
    ctx.translate(hero.x, hero.y);

    const isHurt = hero.hurtFlash > 0;
    const color = isHurt ? '#ffffff' : '#99aaff';
    const armorColor = isHurt ? '#ffaaaa' : '#7088cc';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 30, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = hero.state === 'approach' ? Math.sin(t * 0.012) * 3 : 0;

    // Legs
    ctx.fillStyle = armorColor;
    ctx.fillRect(-10, 10 + bob, 8, 20);
    ctx.fillRect(3, 10 + bob, 8, 20);

    // Body
    ctx.fillStyle = armorColor;
    ctx.fillRect(-13, -15 + bob, 26, 28);

    // Shield (left arm)
    ctx.fillStyle = '#4466aa';
    ctx.strokeStyle = '#aaccff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-22, -10 + bob);
    ctx.lineTo(-30, -5 + bob);
    ctx.lineTo(-28, 12 + bob);
    ctx.lineTo(-20, 14 + bob);
    ctx.lineTo(-16, 2 + bob);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Sword arm (right)
    const swingAngle = hero.swordSwing > 0 ? -Math.PI * 0.4 * (hero.swordSwing / 300) : -Math.PI * 0.1;
    ctx.save();
    ctx.translate(15, -5 + bob);
    ctx.rotate(swingAngle);
    ctx.fillStyle = '#888888';
    ctx.fillRect(-3, -28, 6, 8); // guard
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(-2, -50, 4, 24); // blade
    ctx.fillStyle = armorColor;
    ctx.fillRect(-4, -20, 8, 16); // arm
    ctx.restore();

    // Head / Helmet
    ctx.fillStyle = armorColor;
    ctx.beginPath();
    ctx.arc(0, -28 + bob, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = darken(armorColor, 0.6);
    ctx.fillRect(-14, -38 + bob, 28, 10); // visor
    // Visor slit
    ctx.fillStyle = '#ffffaa';
    ctx.fillRect(-10, -36 + bob, 20, 3);

    // Plume
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -40 + bob);
    ctx.quadraticCurveTo(8, -52 + bob + Math.sin(t * 0.015) * 3, 2, -60 + bob);
    ctx.stroke();

    ctx.restore();
  }

  // ---- Attacks ----
  function drawAttacks(ctx, attacks, t) {
    attacks.forEach(atk => {
      if (!atk.active) return;
      if (atk.id === 'fireball') {
        drawFireball(ctx, atk, t);
      } else if (atk.id === 'lightning') {
        drawLightning(ctx, atk, t);
      } else if (atk.id === 'groundslam') {
        drawGroundSlam(ctx, atk, t);
      } else if (atk.id === 'minion') {
        drawMinion(ctx, atk, t);
      }
    });
  }

  function drawFireball(ctx, atk, t) {
    const r = atk.type.radius;
    const grd = ctx.createRadialGradient(atk.x, atk.y, 2, atk.x, atk.y, r * 2);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.3, '#ffcc00');
    grd.addColorStop(0.6, '#ff6a00');
    grd.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(atk.x, atk.y, r * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLightning(ctx, atk, t) {
    if (atk.age > atk.maxAge * 0.8) return;
    const alpha = 1 - atk.age / (atk.maxAge * 0.8);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffaa';
    ctx.shadowColor = '#8888ff';
    ctx.shadowBlur = 20;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(atk.startX, atk.startY);
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const px = atk.startX + (atk.targetX - atk.startX) * (i / steps);
      const py = atk.startY + (atk.targetY - atk.startY) * (i / steps);
      const jitter = i === steps ? 0 : (Math.random() - 0.5) * 30;
      ctx.lineTo(px + jitter, py + jitter);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGroundSlam(ctx, atk, t) {
    const progress = atk.age / atk.maxAge;
    const r = progress * atk.type.radius;
    const alpha = 1 - progress;
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 4 + (1 - progress) * 6;
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(atk.x, atk.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Second ring
    if (progress > 0.2) {
      ctx.strokeStyle = '#bb8800';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(atk.x, atk.y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMinion(ctx, atk, t) {
    ctx.save();
    ctx.translate(atk.x, atk.y);
    const bob = Math.sin(t * 0.015) * 3;
    ctx.fillStyle = '#9900cc';
    ctx.strokeStyle = '#dd00ff';
    ctx.lineWidth = 2;
    // Body blob
    ctx.beginPath();
    ctx.arc(0, bob, 16, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Eyes
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath(); ctx.arc(-5, bob - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, bob - 3, 3, 0, Math.PI * 2); ctx.fill();
    // Legs
    ctx.strokeStyle = '#9900cc';
    ctx.lineWidth = 3;
    [-8, 0, 8].forEach(lx => {
      ctx.beginPath();
      ctx.moveTo(lx, bob + 14);
      ctx.lineTo(lx + Math.sin(t * 0.02 + lx) * 4, bob + 24);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ---- Particles ----
  function drawParticles(ctx, particles) {
    particles.forEach(p => {
      if (!p.active) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ---- Float Texts ----
  function drawFloatTexts(ctx, texts) {
    texts.forEach(ft => {
      if (!ft.active) return;
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }

  // ---- HP Bars ----
  function drawHPBars(ctx, boss, hero, W) {
    const barW = 220, barH = 22, y = 18;

    // Boss HP (left)
    drawBar(ctx, 20, y, barW, barH, boss.hp / boss.maxHp, '#cc2200', '#ff4444', 'BOSS', boss.hp, boss.maxHp);

    // Hero HP (right)
    drawBar(ctx, W - 20 - barW, y, barW, barH, hero.hp / hero.maxHp, '#2244cc', '#4488ff', 'HERO', hero.hp, hero.maxHp, true);
  }

  function drawBar(ctx, x, y, w, h, fraction, darkColor, lightColor, label, cur, max, rightAlign = false) {
    fraction = Math.max(0, Math.min(1, fraction));
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 4);
    ctx.fill();
    // Fill
    if (fraction > 0) {
      ctx.fillStyle = darkColor;
      roundRect(ctx, x, y, w * fraction, h, 3);
      ctx.fill();
      // Shine
      ctx.fillStyle = lightColor;
      roundRect(ctx, x, y, w * fraction, h * 0.4, 3);
      ctx.fill();
    }
    // Border
    ctx.strokeStyle = 'rgba(255,220,150,0.5)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 3);
    ctx.stroke();
    // Text
    ctx.fillStyle = '#f5e6c8';
    ctx.font = 'bold 12px Georgia, serif';
    if (rightAlign) {
      ctx.textAlign = 'right';
      ctx.fillText(`${label}  ${cur}/${max}`, x + w, y + h + 14);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(`${label}  ${cur}/${max}`, x, y + h + 14);
    }
  }

  // ---- Audience Meter ----
  function drawAudienceMeter(ctx, W, score, maxScore) {
    const mw = 200, mh = 16, mx = (W - mw) / 2, my = 14;
    const frac = Math.min(1, score / maxScore);

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, mx - 2, my - 2, mw + 4, mh + 4, 4);
    ctx.fill();

    if (frac > 0) {
      const grad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
      grad.addColorStop(0, '#d4a017');
      grad.addColorStop(1, '#ffee88');
      ctx.fillStyle = grad;
      roundRect(ctx, mx, my, mw * frac, mh, 3);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,220,100,0.7)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, mx, my, mw, mh, 3);
    ctx.stroke();

    ctx.fillStyle = '#f5e6c8';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`AUDIENCE  ${Math.round(score)}`, W / 2, my + mh + 14);
  }

  // ---- Attack Announcement ----
  function drawAnnouncement(ctx, text, alpha, W, H) {
    if (!text || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fillText(text, W / 2, H / 2 - 60);
    ctx.restore();
  }

  // ---- Phase Shift Overlay ----
  function drawPhaseShiftOverlay(ctx, progress, boss, W, H) {
    // progress 0→1 over phase shift duration
    const flash = Math.sin(progress * Math.PI * 8) * 0.3;
    ctx.fillStyle = `rgba(${hexToRgb(boss.color)},${0.15 + flash})`;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = boss.color;
    ctx.font = 'bold 36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.8 + flash;
    ctx.fillText('SECOND FORM!', W / 2, H / 2);
    ctx.globalAlpha = 1;
  }

  // ---- Intro canvas BG ----
  function drawIntroBG(ctx, W, H, t) {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#070010');
    bgGrad.addColorStop(1, '#15001a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    // Drifting particles
    ctx.fillStyle = 'rgba(180,100,255,0.15)';
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(t * 0.0003 + i * 2.4) * 0.5 + 0.5) * W;
      const y = ((t * 0.00015 + i * 0.073) % 1) * H;
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + Math.sin(i) * 1, 0, Math.PI * 2);
      ctx.fill();
    }
    drawWindow(ctx, W / 2, H * 0.25, 160, t);
  }

  // ---- Utilities ----
  function darken(hex, amt) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = Math.max(0, parseInt(hex.slice(0, 2), 16) * amt) | 0;
    const g = Math.max(0, parseInt(hex.slice(2, 4), 16) * amt) | 0;
    const b = Math.max(0, parseInt(hex.slice(4, 6), 16) * amt) | 0;
    return `rgb(${r},${g},${b})`;
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r},${g},${b}`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Mini-boss preview (design screen) ----
  function drawBossPreview(ctx, config, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const bgGrd = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H / 1.2);
    bgGrd.addColorStop(0, '#1a0030');
    bgGrd.addColorStop(1, '#070010');
    ctx.fillStyle = bgGrd;
    ctx.fillRect(0, 0, W, H);

    // Fake boss for preview
    const fakeBoss = {
      x: W / 2, y: H / 2 + 10,
      hp: 100, maxHp: 100,
      phase: 1, config,
      color: '#cc2200',
      hurtFlash: 0,
      state: 'idle',
      animFrame: Math.floor(t / 200),
      scale: 0.75,
      rotation: 0,
      weakPointOffset: config.weakPoint === 'head' ? { x: 0, y: -70 } :
                       config.weakPoint === 'feet' ? { x: 0, y: 55 } : { x: 0, y: 0 }
    };
    drawBoss(ctx, fakeBoss, t);
  }

  return {
    drawArena, drawBoss, drawHero, drawAttacks,
    drawParticles, drawFloatTexts,
    drawHPBars, drawAudienceMeter, drawAnnouncement,
    drawPhaseShiftOverlay, drawIntroBG, drawBossPreview,
    setAudienceReaction
  };
})();
