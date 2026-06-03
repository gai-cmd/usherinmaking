// usher in making — base interactions
(function () {
  const header = document.getElementById('header');
  const onScroll = () => {
    if (window.scrollY > 60) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // mobile menu
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  if (toggle) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.section .section-head, .about-grid, .split, .gallery-item, .dress-item, .plan-card')
    .forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = (i % 3 * 0.08) + 's'; io.observe(el); });
})();
