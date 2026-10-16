/**
 * Lightweight micro-confetti burst inspired by 21st.dev
 * Spawns a cluster of colorful celebratory particles originating from an element or mouse position.
 */
export function fireConfetti(originX?: number, originY?: number) {
  if (typeof window === 'undefined') return;

  const count = 28;
  const colors = ['#4361EE', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
  const startX = originX ?? window.innerWidth / 2;
  const startY = originY ?? window.innerHeight / 2;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '99999';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 6 + 5;
    const isRound = Math.random() > 0.4;

    p.style.position = 'absolute';
    p.style.left = `${startX}px`;
    p.style.top = `${startY}px`;
    p.style.width = `${size}px`;
    p.style.height = `${isRound ? size : size * 1.6}px`;
    p.style.backgroundColor = color;
    p.style.borderRadius = isRound ? '50%' : '2px';
    p.style.pointerEvents = 'none';
    p.style.willChange = 'transform, opacity';

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const velocity = Math.random() * 85 + 65;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 35; // Slight upward bias
    const rot = Math.random() * 720 - 360;

    p.animate(
      [
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(${vx}px, ${vy + 120}px) scale(0.6) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: Math.random() * 300 + 650,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards',
      },
    );

    container.appendChild(p);
  }

  setTimeout(() => {
    container.remove();
  }, 1000);
}
