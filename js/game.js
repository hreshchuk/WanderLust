/* =============================================
   WANDERLUST — game.js
   Аркадна гра: «Лови прапори» (Flag Catcher)
   Гравець керує літаком (←→) і ловить
   прапори країн, уникаючи туристичних чемоданів
   ============================================= */

'use strict';

(function () {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ===== CANVAS SIZE ===== */
  function resize() {
    const w = canvas.parentElement.clientWidth - 48;
    canvas.width = Math.min(w, 652);
    canvas.height = Math.floor(canvas.width * 0.55);
  }
  resize();
  window.addEventListener('resize', () => { resize(); if (!running) drawIdle(); });

  /* ===== STATE ===== */
  let running = false;
  let animId = null;

  const game = {
    score: 0,
    lives: 3,
    level: 1,
    speed: 2,
    catchCount: 0  // flags caught this level
  };

  /* ===== ITEMS ===== */
  const FLAGS = [
    { emoji: '🇫🇷', name: 'Франція', good: true },
    { emoji: '🇯🇵', name: 'Японія', good: true },
    { emoji: '🇮🇹', name: 'Італія', good: true },
    { emoji: '🇬🇷', name: 'Греція', good: true },
    { emoji: '🇺🇦', name: 'Україна', good: true },
    { emoji: '🇦🇺', name: 'Австралія', good: true },
    { emoji: '🇧🇷', name: 'Бразилія', good: true },
    { emoji: '🇲🇦', name: 'Марокко', good: true },
    { emoji: '🧳', name: 'Важкий багаж', good: false },
    { emoji: '⛔', name: 'Заборона', good: false },
    { emoji: '🚫', name: 'Відмова у в\'їзді', good: false }
  ];

  /* ===== OBJECTS ===== */
  let plane, items, particles, lastSpawn, popup;

  /* ===== PLANE ===== */
  function createPlane() {
    return {
      x: canvas.width / 2,
      y: canvas.height - 60,
      w: 60,
      h: 36,
      speed: 0,
      maxSpeed: 6,
      acc: 0.8,
      friction: 0.85
    };
  }

  /* ===== ITEMS ===== */
  function spawnItem() {
    const template = FLAGS[Math.floor(Math.random() * FLAGS.length)];
    const size = 36;
    items.push({
      ...template,
      x: size / 2 + Math.random() * (canvas.width - size),
      y: -size,
      vy: game.speed + Math.random() * 1.5,
      size,
      rotation: (Math.random() - 0.5) * 0.3,
      angle: 0
    });
  }

  /* ===== PARTICLES ===== */
  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color,
        r: 3 + Math.random() * 4
      });
    }
  }

  /* ===== INPUT ===== */
  const keys = {};
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  // Mobile touch
  let touchStartX = null;
  canvas.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (touchStartX === null || !running) return;
    const dx = e.touches[0].clientX - touchStartX;
    plane.x = Math.max(plane.w / 2, Math.min(canvas.width - plane.w / 2, plane.x + dx * 0.5));
    touchStartX = e.touches[0].clientX;
    e.preventDefault();
  }, { passive: false });

  /* ===== DRAW HELPERS ===== */
  function drawBg() {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#0a0a1e');
    sky.addColorStop(0.6, '#16213e');
    sky.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const seed = 42;
    for (let i = 0; i < 40; i++) {
      const sx = ((seed * (i + 1) * 937) % canvas.width);
      const sy = ((seed * (i + 1) * 433) % (canvas.height * 0.7));
      const r = 0.5 + (i % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    [[100, 40, 80, 20], [350, 70, 100, 25], [550, 30, 70, 18]].forEach(([x, y, w, h]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlane(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Engine glow
    const glow = ctx.createRadialGradient(-p.w / 2, 0, 2, -p.w / 2, 0, 20);
    glow.addColorStop(0, 'rgba(233,69,96,0.6)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(-p.w / 2 - 20, -20, 40, 40);

    // Body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(p.w / 2, 0);
    ctx.lineTo(-p.w / 2, -p.h / 4);
    ctx.lineTo(-p.w / 2, p.h / 4);
    ctx.closePath();
    ctx.fill();

    // Wing top
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.moveTo(0, -p.h / 4);
    ctx.lineTo(-p.w / 3, -p.h * 0.9);
    ctx.lineTo(-p.w * 0.6, -p.h / 4);
    ctx.closePath();
    ctx.fill();

    // Wing bottom
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.moveTo(0, p.h / 4);
    ctx.lineTo(-p.w / 3, p.h * 0.9);
    ctx.lineTo(-p.w * 0.6, p.h / 4);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#a8d8ff';
    ctx.beginPath();
    ctx.ellipse(p.w / 4, 0, p.h / 4, p.h / 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawItem(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);
    ctx.font = `${item.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.emoji, 0, 0);
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(canvas.width * 0.04)}px Nunito, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`⭐ ${game.score}`, 16, 30);

    // Level
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5a623';
    ctx.fillText(`Рівень ${game.level}`, canvas.width / 2, 30);

    // Lives
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e94560';
    ctx.fillText(`❤️ ${game.lives}`, canvas.width - 16, 30);
  }

  function drawPopup() {
    if (!popup || popup.alpha <= 0) return;
    ctx.globalAlpha = popup.alpha;
    ctx.font = `bold ${Math.floor(canvas.width * 0.055)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, canvas.width / 2, canvas.height * 0.38);
    ctx.globalAlpha = 1;
  }

  function showPopup(text, color) {
    popup = { text, color, alpha: 1 };
  }

  function drawIdle() {
    drawBg();
    if (!plane) plane = createPlane();
    drawPlane(plane);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.floor(canvas.width * 0.045)}px Playfair Display, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✈️ Лови Прапори!', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = `${Math.floor(canvas.width * 0.03)}px Nunito, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('Натисни «Старт» або ← → для керування', canvas.width / 2, canvas.height / 2 + 20);
  }

  /* ===== GAME LOOP ===== */
  function startGame() {
    cancelAnimationFrame(animId);
    Object.assign(game, { score: 0, lives: 3, level: 1, speed: 2, catchCount: 0 });
    plane = createPlane();
    items = [];
    particles = [];
    popup = null;
    lastSpawn = 0;
    running = true;
    updateScoreDisplay();
    loop(0);
  }

  function loop(ts) {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBg();

    // Spawn
    const spawnInterval = Math.max(600, 1200 - game.level * 80);
    if (ts - lastSpawn > spawnInterval) {
      spawnItem();
      lastSpawn = ts;
    }

    // Move plane
    if (keys['ArrowLeft']) plane.speed -= plane.acc;
    if (keys['ArrowRight']) plane.speed += plane.acc;
    plane.speed *= plane.friction;
    plane.speed = Math.max(-plane.maxSpeed, Math.min(plane.maxSpeed, plane.speed));
    plane.x += plane.speed;
    plane.x = Math.max(plane.w / 2, Math.min(canvas.width - plane.w / 2, plane.x));

    // Update items
    items = items.filter(item => {
      item.y += item.vy;
      item.angle += item.rotation;

      // Collision with plane (ellipse approx)
      const dx = Math.abs(item.x - plane.x);
      const dy = Math.abs(item.y - plane.y);
      const hit = dx < (plane.w / 2 + item.size / 2.5) && dy < (plane.h / 2 + item.size / 2.5);

      if (hit) {
        if (item.good) {
          game.score += 10 * game.level;
          game.catchCount++;
          burst(item.x, item.y, '#f5a623');
          showPopup(`+${10 * game.level} ${item.emoji}`, '#f5a623');
          if (game.catchCount >= 8) levelUp();
        } else {
          game.lives--;
          burst(item.x, item.y, '#e94560');
          showPopup('💥 Ой!', '#e94560');
          if (game.lives <= 0) { gameOver(); return false; }
        }
        updateScoreDisplay();
        return false;
      }

      // Missed flag
      if (item.y > canvas.height + item.size) {
        if (item.good) {
          game.lives--;
          showPopup('Упустив! ✈️→🌊', 'rgba(255,255,255,0.8)');
          if (game.lives <= 0) { gameOver(); return false; }
          updateScoreDisplay();
        }
        return false;
      }

      drawItem(item);
      return true;
    });

    // Particles
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.04;
      return p.alpha > 0;
    });
    drawParticles();

    // Popup fade
    if (popup) {
      popup.alpha -= 0.022;
      if (popup.alpha < 0) popup = null;
    }

    drawPlane(plane);
    drawHUD();
    drawPopup();

    animId = requestAnimationFrame(loop);
  }

  function levelUp() {
    game.level++;
    game.catchCount = 0;
    game.speed += 0.4;
    showPopup(`🎉 Рівень ${game.level}!`, '#a8ff78');
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(animId);

    // Draw final screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBg();

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, 'rgba(233,69,96,0.3)');
    grad.addColorStop(1, 'rgba(26,26,46,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.floor(canvas.width * 0.07)}px Playfair Display, serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('✈️ Гра завершена!', canvas.width / 2, canvas.height / 2 - 36);

    ctx.font = `bold ${Math.floor(canvas.width * 0.05)}px Nunito, sans-serif`;
    ctx.fillStyle = '#f5a623';
    ctx.fillText(`Рахунок: ${game.score}`, canvas.width / 2, canvas.height / 2 + 10);

    ctx.font = `${Math.floor(canvas.width * 0.032)}px Nunito, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`Рівень досягнуто: ${game.level}`, canvas.width / 2, canvas.height / 2 + 44);

    updateScoreDisplay();
    document.getElementById('game-start-btn').textContent = '▶ Грати ще раз';
  }

  function updateScoreDisplay() {
    const scoreEl = document.getElementById('game-score');
    const livesEl = document.getElementById('game-lives');
    const levelEl = document.getElementById('game-level');
    if (scoreEl) scoreEl.textContent = game.score;
    if (livesEl) livesEl.textContent = game.lives;
    if (levelEl) levelEl.textContent = game.level;
  }

  /* ===== CONTROLS ===== */
  const startBtn = document.getElementById('game-start-btn');
  const resetBtn = document.getElementById('game-reset-btn');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startBtn.textContent = '⏸ Пауза';
      if (running) {
        running = false;
        cancelAnimationFrame(animId);
        startBtn.textContent = '▶ Продовжити';
      } else {
        if (game.lives <= 0 || game.score === 0) {
          startGame();
          startBtn.textContent = '⏸ Пауза';
        } else {
          running = true;
          lastSpawn = performance.now();
          loop(performance.now());
          startBtn.textContent = '⏸ Пауза';
        }
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      running = false;
      cancelAnimationFrame(animId);
      game.score = 0; game.lives = 3; game.level = 1;
      updateScoreDisplay();
      plane = createPlane();
      items = []; particles = [];
      drawIdle();
      if (startBtn) startBtn.textContent = '▶ Старт';
    });
  }

  // Init idle screen
  drawIdle();
  updateScoreDisplay();
})();
