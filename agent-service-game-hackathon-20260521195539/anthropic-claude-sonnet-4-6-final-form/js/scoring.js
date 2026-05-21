// ============================================================
//  FINAL FORM — Scoring Engine
// ============================================================

const Scoring = (() => {
  const MAX = {
    spectacle: 250,   // duration
    drama: 200,       // close calls
    transformation: 150, // phase shift
    voice: 100,       // monologue length
    variety: 150,     // unique attacks used
    combo: 150,       // both HP low simultaneously
  };
  const TOTAL_MAX = Object.values(MAX).reduce((a, b) => a + b, 0); // 1000

  function calculate(stats) {
    const scores = {};

    // Spectacle: 7pts/sec, capped at 250 (~36s)
    scores.spectacle = Math.min(MAX.spectacle, Math.round(stats.duration * 7));

    // Drama: 80pts per close call (HP < 12%), max 2
    scores.drama = Math.min(MAX.drama, stats.closeCallCount * 80);

    // Transformation: flat 150 if phase shift occurred
    scores.transformation = stats.phaseShifted ? MAX.transformation : 0;

    // Voice: 3pts per character of monologue
    scores.voice = Math.min(MAX.voice, Math.round((stats.monologueLength || 0) * 3));

    // Variety: 37.5 pts per unique attack type used (max 4 types)
    scores.variety = Math.min(MAX.variety, stats.uniqueAttacks.size * 37.5);

    // Combo: bonus if both fighters went below 20% HP in same run
    scores.combo = stats.comboDrama ? MAX.combo : 0;

    const total = Object.values(scores).reduce((a, b) => a + b, 0);

    return {
      breakdown: scores,
      total: Math.round(total),
      max: TOTAL_MAX,
      stars: starsFromScore(total),
    };
  }

  function starsFromScore(total) {
    if (total >= 650) return 5;
    if (total >= 500) return 4;
    if (total >= 330) return 3;
    if (total >= 180) return 2;
    return 1;
  }

  function flavorQuote(stars, heroWon) {
    if (stars >= 5) return heroWon
      ? '"STANDING OVATION! A defeat for the ages — they\'ll write songs of this battle!"'
      : '"LEGENDARY! A truly immortal performance! The crowd weeps with joy!"';
    if (stars >= 4) return heroWon
      ? '"Magnificent! A worthy final chapter — the hero earned this one."'
      : '"Spectacular! Even victory couldn\'t diminish the spectacle!"';
    if (stars >= 3) return '"Solid performance. The crowd is satisfied. More drama next time?"';
    if (stars >= 2) return '"Decent, but forgettable. The audience checked their watches."';
    return '"...Was that it? The crowd is filing out. Do better."';
  }

  function tips(stats, scores) {
    const t = [];
    if (scores.breakdown.spectacle < 130)
      t.push('⚔️ Fight ended too quickly — add more attack variety to extend the spectacle.');
    if (scores.breakdown.drama === 0)
      t.push('💀 No close calls — the fight needs more tension. Lower the Phase threshold!');
    if (scores.breakdown.transformation === 0)
      t.push('✨ No Phase 2 — set the threshold higher so the transition triggers mid-fight.');
    if (scores.breakdown.voice < 40)
      t.push('🎭 Write a longer monologue — the audience loves a dramatic speech!');
    if (scores.breakdown.variety < 100)
      t.push('🎯 Use more attack varieties — a diverse arsenal keeps the crowd guessing.');
    if (scores.breakdown.combo === 0)
      t.push('⚡ Mutual Peril: the boss AND hero must both go critical at some point in the battle!');
    return t.slice(0, 2); // show max 2 tips
  }

  return { calculate, starsFromScore, flavorQuote, tips, MAX, TOTAL_MAX };
})();
