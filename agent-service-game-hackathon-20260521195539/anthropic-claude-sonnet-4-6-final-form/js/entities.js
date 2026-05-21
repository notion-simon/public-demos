// ============================================================
//  FINAL FORM — Entity Definitions
// ============================================================

// ---- Attack types catalog ----
const ATTACKS = {
  fireball: {
    id: 'fireball', name: 'Fireball',
    damage: 12, telegraph: 1200, speed: 3, radius: 16,
    color: '#ff6a00', glowColor: '#ff4500',
    dodgeDifficulty: 0.3,  // low = easy to dodge
    icon: '🔥', label: 'FIREBALL',
  },
  lightning: {
    id: 'lightning', name: 'Lightning Strike',
    damage: 9, telegraph: 400, speed: Infinity, radius: 30,
    color: '#ffffaa', glowColor: '#8888ff',
    dodgeDifficulty: 0.75,
    icon: '⚡', label: 'LIGHTNING',
  },
  groundslam: {
    id: 'groundslam', name: 'Ground Slam',
    damage: 14, telegraph: 900, speed: 0, radius: 160,
    color: '#bb8800', glowColor: '#ffcc00',
    dodgeDifficulty: 0.5,
    icon: '💥', label: 'GROUND SLAM',
  },
  minion: {
    id: 'minion', name: 'Minion Summon',
    damage: 6, telegraph: 600, speed: 1.5, radius: 18,
    color: '#9900cc', glowColor: '#dd00ff',
    dodgeDifficulty: 0.4,
    icon: '👾', label: 'MINION SUMMON',
  },
};

const ATTACK_IDS = Object.keys(ATTACKS);

// ---- Projectile / Attack instance ----
class AttackInstance {
  constructor(type, bossX, bossY, targetX, targetY) {
    this.type = ATTACKS[type];
    this.id = type;
    this.x = bossX;
    this.y = bossY;
    this.startX = bossX;
    this.startY = bossY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.active = true;
    this.age = 0;
    this.maxAge = type === 'lightning' ? 200 : 2000;
    this.hit = false;

    // velocity for projectile types
    if (type === 'fireball') {
      const dx = targetX - bossX, dy = targetY - bossY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.vx = (dx / dist) * this.type.speed;
      this.vy = (dy / dist) * this.type.speed;
    } else if (type === 'minion') {
      this.vx = 0;
      this.vy = 0;
      this.minionHP = 30;
    }
    this.particles = [];
  }

  update(dt) {
    this.age += dt;
    if (this.age > this.maxAge) this.active = false;

    if (this.id === 'fireball') {
      this.x += this.vx * (dt / 16);
      this.y += this.vy * (dt / 16);
    } else if (this.id === 'minion') {
      // Minion slowly walks toward hero (set externally)
      if (this.targetX !== undefined) {
        const dx = this.targetX - this.x;
        this.vx = dx > 0 ? this.type.speed : -this.type.speed;
        this.x += this.vx * (dt / 16);
      }
    }
  }
}

// ---- Particle ----
class Particle {
  constructor(x, y, vx, vy, color, life, size = 3) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.active = true;
  }
  update(dt) {
    this.x += this.vx * (dt / 16);
    this.y += this.vy * (dt / 16);
    this.vy += 0.15 * (dt / 16); // gravity
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
  get alpha() { return Math.max(0, this.life / this.maxLife); }
}

// ---- Floating Damage Number ----
class FloatText {
  constructor(x, y, text, color) {
    this.x = x; this.y = y;
    this.text = text; this.color = color;
    this.vy = -1.5;
    this.life = 900;
    this.maxLife = 900;
    this.active = true;
  }
  update(dt) {
    this.y += this.vy * (dt / 16);
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
  get alpha() { return Math.max(0, this.life / this.maxLife); }
}

// ---- Boss ----
class Boss {
  constructor(config) {
    this.x = 540;
    this.y = 210;
    this.maxHp = 260;
    this.hp = this.maxHp;
    this.phase = 1;
    this.config = config; // player-defined
    this.attackIndex = 0;
    this.state = 'idle'; // idle | telegraphing | attacking | phaseShift | hurt | dead
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.phaseShifted = false;
    this.scale = 1.0;
    this.rotation = 0;
    this.hurtFlash = 0;
    this.currentAttack = null;
    this.idleTimer = 600 + Math.random() * 400; // initial delay before first attack
  }

  get color() {
    if (this.phase === 2) {
      const c2 = {
        crimson: '#ff1a1a', purple: '#9900ff',
        green: '#00ff44', ice: '#00ccff'
      };
      return c2[this.config.phase2Color] || '#ff1a1a';
    }
    return '#cc2200';
  }

  get weakPointOffset() {
    const loc = this.config.weakPoint;
    if (loc === 'head') return { x: 0, y: -70 };
    if (loc === 'feet') return { x: 0, y: 55 };
    return { x: 0, y: 0 }; // chest
  }

  get weakPointHitbox() {
    const off = this.weakPointOffset;
    return {
      x: this.x + off.x - 18,
      y: this.y + off.y - 18,
      w: 36, h: 36
    };
  }

  getNextAttack() {
    const seq = this.config.attacks.filter(a => a && a !== 'empty');
    if (seq.length === 0) return 'fireball';
    const atk = seq[this.attackIndex % seq.length];
    this.attackIndex++;
    return atk;
  }

  update(dt, hero, particles, floatTexts, activeAttacks, eventBus) {
    this.animTimer += dt;
    if (this.animTimer > 200) { this.animFrame++; this.animTimer = 0; }
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    // Phase 2 transition
    if (!this.phaseShifted && this.hp <= this.maxHp * (this.config.phaseThreshold / 100)) {
      this.state = 'phaseShift';
      this.stateTimer = 1800;
      this.phase = 2;
      this.phaseShifted = true;
      eventBus.emit('phaseShift');
      return;
    }

    if (this.state === 'dead') return;

    if (this.state === 'phaseShift') {
      this.stateTimer -= dt;
      this.rotation += 0.08 * (dt / 16);
      this.scale = 1.0 + 0.3 * Math.sin(this.stateTimer * 0.01);
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.scale = 1.2; // stays bigger in phase 2
        this.rotation = 0;
        this.idleTimer = 400;
      }
      return;
    }

    if (this.state === 'hurt') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.state = 'idle';
      return;
    }

    if (this.state === 'idle') {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        // Start next attack
        const atkId = this.getNextAttack();
        this.currentAttack = atkId;
        this.state = 'telegraphing';
        this.stateTimer = ATTACKS[atkId].telegraph;
        eventBus.emit('telegraphing', atkId);
      }
      return;
    }

    if (this.state === 'telegraphing') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.fireAttack(hero, activeAttacks, particles, eventBus);
        this.state = 'idle';
        const speedMult = this.phase === 2 ? 0.7 : 1.0;
        this.idleTimer = (600 + Math.random() * 400) * speedMult;
      }
    }
  }

  fireAttack(hero, activeAttacks, particles, eventBus) {
    const atkId = this.currentAttack;
    eventBus.emit('attack', atkId);

    if (atkId === 'fireball') {
      const inst = new AttackInstance('fireball', this.x, this.y, hero.x, hero.y);
      activeAttacks.push(inst);
      // Particles
      for (let i = 0; i < 12; i++) {
        particles.push(new Particle(
          this.x, this.y,
          (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6,
          '#ff6a00', 400 + Math.random() * 200, 4
        ));
      }
    } else if (atkId === 'lightning') {
      // Instant hit check
      const inst = new AttackInstance('lightning', this.x, this.y, hero.x, hero.y);
      inst.maxAge = 300;
      activeAttacks.push(inst);
    } else if (atkId === 'groundslam') {
      const inst = new AttackInstance('groundslam', this.x, this.y + 60, this.x, this.y + 60);
      inst.maxAge = 600;
      activeAttacks.push(inst);
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push(new Particle(
          this.x, this.y + 60,
          Math.cos(angle) * (4 + Math.random() * 4),
          Math.sin(angle) * (2 + Math.random() * 2) - 3,
          '#bb8800', 600 + Math.random() * 300, 5
        ));
      }
    } else if (atkId === 'minion') {
      const inst = new AttackInstance('minion', this.x - 40, this.y + 40, hero.x, hero.y);
      activeAttacks.push(inst);
    }
  }

  takeDamage(amount, isWeakPoint, particles, floatTexts) {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 150;
    this.state = 'hurt';
    this.stateTimer = 120;
    const color = isWeakPoint ? '#ffe000' : '#ff4444';
    const label = isWeakPoint ? `★${amount}` : `-${amount}`;
    floatTexts.push(new FloatText(this.x + (Math.random() - 0.5) * 40, this.y - 60, label, color));
    for (let i = 0; i < (isWeakPoint ? 10 : 5); i++) {
      particles.push(new Particle(
        this.x, this.y - 20,
        (Math.random() - 0.5) * 5, -3 - Math.random() * 3,
        isWeakPoint ? '#ffe000' : '#ff4444', 300, 3
      ));
    }
    if (this.hp <= 0) {
      this.state = 'dead';
      // Death explosion
      for (let i = 0; i < 40; i++) {
        particles.push(new Particle(
          this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 10, -4 - Math.random() * 8,
          ['#ff4400', '#ff6a00', '#ffcc00', '#ff1a1a'][Math.floor(Math.random() * 4)],
          800 + Math.random() * 600, 6
        ));
      }
    }
  }
}

// ---- Hero ----
class Hero {
  constructor(memory) {
    this.x = 80;
    this.y = 270;
    this.maxHp = 160;
    this.hp = this.maxHp;
    this.memory = memory || {
      dodgeChances: {}, // atkId -> 0..1
      weakPointKnown: false,
      aggression: 0,
    };
    this.state = 'approach'; // approach | attack | dodge | stagger | dead
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.targetX = 350;
    this.speed = 90;
    this.hurtFlash = 0;
    this.inRange = false;
    this.dodging = false;
    this.dodgeDir = 0;
    this.seekingWeak = false;
    this.swordSwing = 0;
    this.dead = false;
  }

  get attackRange() { return 130 + this.memory.aggression * 5; }

  update(dt, boss, activeAttacks, particles, floatTexts, eventBus) {
    if (this.dead) return;
    this.animTimer += dt;
    if (this.animTimer > 150) { this.animFrame++; this.animTimer = 0; }
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.swordSwing > 0) this.swordSwing -= dt;
    if (this._dodgeCooldown > 0) this._dodgeCooldown -= dt;

    // Activate seeking weak point
    if ((boss.phase === 2 || boss.hp < boss.maxHp * 0.4) && this.memory.weakPointKnown) {
      this.seekingWeak = true;
    }

    if (this.state === 'stagger') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.state = 'approach';
      return;
    }
    if (this.state === 'dodge') {
      this.stateTimer -= dt;
      this.x += this.dodgeDir * 3 * (dt / 16);
      this.x = Math.max(30, Math.min(370, this.x));
      if (this.stateTimer <= 0) {
        this.state = 'approach';
        this._dodgeCooldown = 800; // cooldown before dodging again
      }
      return;
    }

    // Check for incoming attacks to dodge — ONE roll per attack instance
    if (this.state !== 'stagger' && (!this._dodgeCooldown || this._dodgeCooldown <= 0)) {
      for (const atk of activeAttacks) {
        if (!atk.active || atk.hit || atk._dodgeRolled) continue;
        const dodgeChance = this.memory.dodgeChances[atk.id] || 0.15;
        let threateningNow = false;
        if (atk.id === 'fireball') {
          const dx = atk.x - this.x;
          if (dx > -5 && dx < 120) threateningNow = true; // fireball approaching
        } else if (atk.id === 'lightning' && atk.age < 60) {
          threateningNow = true;
        } else if (atk.id === 'groundslam' && atk.age > 80 && atk.age < 200) {
          const ddx = Math.abs(this.x - atk.x);
          if (ddx < 180) threateningNow = true;
        }
        if (threateningNow) {
          atk._dodgeRolled = true; // only roll ONCE per attack instance
          if (Math.random() < dodgeChance) {
            this.state = 'dodge';
            this.stateTimer = 250;
            this.dodgeDir = -1; // backward from boss
            this._dodgeCooldown = 900;
            return;
          }
        }
      }
    }

    // Approach / attack
    const bossX = boss.x;
    const dist = Math.abs(this.x - bossX);
    this.inRange = dist < this.attackRange;

    if (!this.inRange) {
      // Walk toward boss
      const dir = bossX > this.x ? 1 : -1;
      this.x += dir * this.speed * (dt / 1000);
    } else {
      // Attack!
      if (this.attackCooldown <= 0 && boss.state !== 'phaseShift') {
        this.performAttack(boss, particles, floatTexts, eventBus);
      }
    }
  }

  performAttack(boss, particles, floatTexts, eventBus) {
    this.attackCooldown = 1400 - this.memory.aggression * 30;
    this.swordSwing = 300;

    // Determine hit target
    const wpHit = this.seekingWeak && this.memory.weakPointKnown;
    let dmg = 12 + Math.floor(Math.random() * 8) + this.memory.aggression * 2;
    const isWeak = wpHit && boss.state !== 'dead';
    if (isWeak) dmg = Math.floor(dmg * 2.0);

    eventBus.emit('heroAttack', { damage: dmg, weakPoint: isWeak });
    boss.takeDamage(dmg, isWeak, particles, floatTexts);

    // Swing particles
    for (let i = 0; i < 5; i++) {
      particles.push(new Particle(
        boss.x - 50 + (Math.random() - 0.5) * 30,
        boss.y + (Math.random() - 0.5) * 30,
        2 + Math.random() * 3, -1 - Math.random() * 2,
        '#aaccff', 200, 2
      ));
    }
  }

  takeDamage(amount, particles, floatTexts) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 200;
    this.state = 'stagger';
    this.stateTimer = 400;
    floatTexts.push(new FloatText(this.x + (Math.random() - 0.5) * 20, this.y - 40, `-${amount}`, '#ff8888'));
    for (let i = 0; i < 6; i++) {
      particles.push(new Particle(
        this.x, this.y - 20,
        (Math.random() - 0.5) * 4, -2 - Math.random() * 3,
        '#ff8888', 300, 3
      ));
    }
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(
          this.x + (Math.random() - 0.5) * 40, this.y + (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 7, -3 - Math.random() * 5,
          ['#aaccff', '#ffffff', '#8888ff'][Math.floor(Math.random() * 3)],
          600, 4
        ));
      }
    }
  }

  // Call after each run to update memory
  learnFromRun(attacksUsed, bossConfig) {
    attacksUsed.forEach(atkId => {
      if (!this.memory.dodgeChances[atkId]) this.memory.dodgeChances[atkId] = 0.1;
      this.memory.dodgeChances[atkId] = Math.min(0.85, this.memory.dodgeChances[atkId] + 0.18);
    });
    this.memory.weakPointKnown = true;
    this.memory.aggression = Math.min(8, (this.memory.aggression || 0) + 1);
  }
}
