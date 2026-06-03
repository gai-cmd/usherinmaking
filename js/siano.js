/* ===================================================================
   SIANO interactions
   - Detects scroll-driven CSS support; if missing, drives the same
     effects via requestAnimationFrame so every browser sees motion.
   - Horizontal gallery is always JS-driven (translateX from scroll).
=================================================================== */
(function () {
  const supportsSDA = CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const progress = (el, start = 0, end = 1) => {
    // 0 when element top hits viewport bottom, 1 when bottom hits viewport top
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = r.height + vh;
    const p = (vh - r.top) / total;
    return clamp((p - start) / (end - start), 0, 1);
  };

  /* ---- horizontal gallery (always JS) ---- */
  const hScroll = document.querySelector('.h-scroll');
  const hTrack = document.getElementById('hTrack');

  /* ---- JS fallback for hero + grow + word lighting ---- */
  const heroPin   = document.querySelector('.hero-pin');
  const heroMedia = document.getElementById('heroMedia');
  const heroCopy  = document.getElementById('heroCopy');
  const growFrame = document.getElementById('growFrame');
  const pinImage  = document.querySelector('.pin-image');

  const litTargets = [
    ...document.querySelectorAll('.big-statement .word'),
    ...document.querySelectorAll('.words-text span'),
  ];

  function frame() {
    /* horizontal */
    if (hScroll && hTrack) {
      const r = hScroll.getBoundingClientRect();
      const scrollable = hScroll.offsetHeight - window.innerHeight;
      const p = clamp(-r.top / scrollable, 0, 1);
      const max = hTrack.scrollWidth - window.innerWidth;
      hTrack.style.transform = `translateX(${-p * max}px)`;
    }

    if (!supportsSDA) {
      /* hero */
      if (heroPin) {
        const p = progress(heroPin, 0, 0.5);
        heroMedia.style.transform = `scale(${1.15 - 0.15 * p})`;
        heroCopy.style.opacity = String(1 - p * 1.4);
        heroCopy.style.transform = `translateY(${-40 * p}px)`;
      }
      /* grow frame */
      if (pinImage && growFrame) {
        const cs = getComputedStyle(document.documentElement);
        const sw = parseFloat(cs.getPropertyValue('--grow-start-w')) || 42;
        const sh = parseFloat(cs.getPropertyValue('--grow-start-h')) || 55;
        const p = progress(pinImage, 0.05, 0.55);
        growFrame.style.width  = `${sw + (100 - sw) * p}vw`;
        growFrame.style.height = `${sh + (100 - sh) * p}vh`;
        growFrame.style.borderRadius = `${14 - 14 * p}px`;
        const cap = growFrame.querySelector('.grow-caption');
        if (cap) cap.style.opacity = String(clamp((p - 0.5) * 3, 0, 1));
      }
      /* word lighting */
      litTargets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.75) el.classList.add('lit');
        else el.classList.remove('lit');
      });
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* header blend tweak + reveal-up */
  const io = new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.2 });
  document.querySelectorAll('.reveal-up').forEach(el => io.observe(el));
})();
