import { useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';

// Three depth layers: gives a subtle parallax sense of depth
const LAYERS = [
  { count: 120, rMin: 0.2, rMax: 0.6,  speedMin: 0.015, speedMax: 0.04,  opacityMin: 0.15, opacityMax: 0.45 }, // distant
  { count: 60,  rMin: 0.6, rMax: 1.1,  speedMin: 0.04,  speedMax: 0.08,  opacityMin: 0.35, opacityMax: 0.65 }, // mid
  { count: 20,  rMin: 1.1, rMax: 1.8,  speedMin: 0.08,  speedMax: 0.14,  opacityMin: 0.55, opacityMax: 0.85 }, // close
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// ── Shooting stars ────────────────────────────────────────────────────────────
const SHOOTING_POOL_SIZE = 6;
const SHOOTING_MEAN_INTERVAL = 240; // frames @ ~60fps ≈ 4s
const SHOOTING_SPREAD = 60;

function buildShootingStarPool() {
  return Array.from({ length: SHOOTING_POOL_SIZE }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0,
    trailLength: 0, life: 0, maxLife: 0,
  }));
}

function spawnShootingStar(star, w, h) {
  const edge = Math.random();
  if (edge < 0.7) {
    star.x = rand(w * 0.1, w * 0.9);
    star.y = rand(-20, h * 0.3);
  } else {
    star.x = rand(w * 0.5, w);
    star.y = rand(-20, h * 0.4);
  }
  const angleDeg = rand(20, 50);
  const speed = rand(6, 14);
  const rad = (angleDeg * Math.PI) / 180;
  star.vx = Math.cos(rad) * speed;
  star.vy = Math.sin(rad) * speed;
  star.trailLength = rand(80, 180);
  star.maxLife = Math.ceil(star.trailLength / speed) + 20;
  star.life = 0;
  star.active = true;
}

function drawShootingStar(ctx, star) {
  const progress = star.life / star.maxLife;
  let alpha;
  if (progress < 0.10) alpha = progress / 0.10;
  else if (progress > 0.75) alpha = 1 - (progress - 0.75) / 0.25;
  else alpha = 1.0;
  alpha = Math.max(0, Math.min(1, alpha)) * 0.9;

  const tailLen = Math.min(star.life * Math.hypot(star.vx, star.vy), star.trailLength);
  const angle = Math.atan2(star.vy, star.vx);
  const tailX = star.x - Math.cos(angle) * tailLen;
  const tailY = star.y - Math.sin(angle) * tailLen;

  const grad = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
  grad.addColorStop(0, `rgba(255,255,255,0)`);
  grad.addColorStop(0.6, `rgba(200,220,255,${alpha * 0.5})`);
  grad.addColorStop(1, `rgba(255,255,255,${alpha})`);

  const perp = angle + Math.PI / 2;
  const hw = 1.5;
  ctx.beginPath();
  ctx.moveTo(star.x + Math.cos(perp) * hw, star.y + Math.sin(perp) * hw);
  ctx.lineTo(star.x - Math.cos(perp) * hw, star.y - Math.sin(perp) * hw);
  ctx.lineTo(tailX, tailY);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

function buildStars(w, h) {
  const stars = [];
  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(layer.rMin, layer.rMax),
        speed: rand(layer.speedMin, layer.speedMax),
        baseOpacity: rand(layer.opacityMin, layer.opacityMax),
        twinkleSpeed: rand(0.004, 0.012),
        twinklePhase: rand(0, Math.PI * 2),
        // Occasional blue tint for variety
        hue: Math.random() < 0.15 ? `200, 220, 255` : `255, 255, 255`,
      });
    }
  }
  return stars;
}

export default function StarField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    let stars = [];
    const shootingStars = buildShootingStarPool();
    let nextSpawn = SHOOTING_MEAN_INTERVAL + rand(-SHOOTING_SPREAD, SHOOTING_SPREAD);
    let frame = 0;
    let animId;

    // Reduced-motion alternative: a still star field, painted once. Same depth
    // and density, no drift, twinkle, or shooting stars.
    const drawStatic = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.hue}, ${star.baseOpacity})`;
        ctx.fill();
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = buildStars(canvas.width, canvas.height);
      if (prefersReducedMotion) drawStatic();
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      // Shooting stars
      nextSpawn--;
      if (nextSpawn <= 0) {
        const slot = shootingStars.find(s => !s.active);
        if (slot) spawnShootingStar(slot, canvas.width, canvas.height);
        nextSpawn = SHOOTING_MEAN_INTERVAL + rand(-SHOOTING_SPREAD, SHOOTING_SPREAD);
      }
      for (const s of shootingStars) {
        if (!s.active) continue;
        drawShootingStar(ctx, s);
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        if (s.life >= s.maxLife || s.x > canvas.width + 50 || s.y > canvas.height + 50)
          s.active = false;
      }

      for (const star of stars) {
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinklePhase) * 0.18;
        const alpha = Math.max(0, Math.min(1, star.baseOpacity + twinkle));

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.hue}, ${alpha})`;
        ctx.fill();

        star.y += star.speed;
        if (star.y > canvas.height + 2) {
          star.y = -2;
          star.x = rand(0, canvas.width);
        }
      }

      animId = requestAnimationFrame(draw);
    };

    if (prefersReducedMotion) {
      drawStatic();
    } else {
      draw();
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <Box
      as="canvas"
      ref={canvasRef}
      position="fixed"
      top={0}
      left={0}
      w="100vw"
      h="100vh"
      zIndex={0}
      pointerEvents="none"
    />
  );
}
