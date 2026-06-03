/* ===================================================================
   usher in making — site-wide interactions (all pages)
   - header transparent->solid on scroll
   - mobile nav
   - IntersectionObserver reveal
   - scroll-driven fallback (hero scale/fade, grow image, word lighting)
   - horizontal gallery (always JS translateX)
=================================================================== */
(function () {
  const supportsSDA = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const progress = (el, start = 0, end = 1) => {
    const r = el.getBoundingClientRect(); const vh = window.innerHeight;
    const p = (vh - r.top) / (r.height + vh);
    return clamp((p - start) / (end - start), 0, 1);
  };

  /* header */
  const header = document.querySelector('.site-header');
  const onScroll = () => { if (header) header.classList.toggle('scrolled', window.scrollY > 60); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* mobile nav */
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  /* reveal */
  const io = new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* dynamic targets */
  const heroPin = document.querySelector('.hero-pin');
  const heroMedia = document.querySelector('.hero-pin .hero-media');
  const heroCopy = document.querySelector('.hero-pin .hero-copy');
  const pinImage = document.querySelector('.pin-image');
  const growFrame = document.querySelector('.grow-frame');
  const hScroll = document.querySelector('.h-scroll');
  const hTrack = document.querySelector('.h-track');
  const litTargets = [...document.querySelectorAll('.big-statement .word')];

  /* cinematic statement (long text): parallax bg + line-by-line brighten */
  const cine = document.querySelector('.statement-cine');
  const scBg = cine && cine.querySelector('.sc-bg');
  const scLines = cine ? [...cine.querySelectorAll('.sc-text .line')] : [];

  function frame() {
    if (cine) {
      const r = cine.getBoundingClientRect();
      const scrollable = cine.offsetHeight - window.innerHeight;
      const p = clamp(-r.top / scrollable, 0, 1);
      if (scBg) scBg.style.transform = `scale(${1.15 - 0.15 * p})`;
      const n = scLines.length;
      scLines.forEach((ln, i) => {
        // each line lights as the section scroll passes its slot (front-loaded)
        const trigger = (i + 0.6) / (n + 1);
        ln.classList.toggle('lit', p >= trigger * 0.85);
      });
    }
    if (hScroll && hTrack) {
      const r = hScroll.getBoundingClientRect();
      const scrollable = hScroll.offsetHeight - window.innerHeight;
      const p = clamp(-r.top / scrollable, 0, 1);
      const max = hTrack.scrollWidth - window.innerWidth;
      hTrack.style.transform = `translateX(${-p * max}px)`;
    }
    if (!supportsSDA) {
      if (heroPin && heroMedia) {
        const p = progress(heroPin, 0, 0.5);
        heroMedia.style.transform = `scale(${1.15 - 0.15 * p})`;
        if (heroCopy) { heroCopy.style.opacity = String(1 - p * 1.4); heroCopy.style.transform = `translateY(${-40 * p}px)`; }
      }
      if (pinImage && growFrame) {
        const cs = getComputedStyle(document.documentElement);
        const sw = parseFloat(cs.getPropertyValue('--grow-start-w')) || 44;
        const sh = parseFloat(cs.getPropertyValue('--grow-start-h')) || 56;
        const p = progress(pinImage, 0.05, 0.55);
        growFrame.style.width = `${sw + (100 - sw) * p}vw`;
        growFrame.style.height = `${sh + (100 - sh) * p}vh`;
        growFrame.style.borderRadius = `${14 - 14 * p}px`;
        const cap = growFrame.querySelector('.grow-caption');
        if (cap) cap.style.opacity = String(clamp((p - 0.5) * 3, 0, 1));
      }
      litTargets.forEach(el => {
        const r = el.getBoundingClientRect();
        el.classList.toggle('lit', r.top < window.innerHeight * 0.75);
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
