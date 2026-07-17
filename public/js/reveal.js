// Animations au scroll : apparition des éléments .reveal + compteurs animés.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Compteur animé (0 → valeur) ---
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    if (reduce) { el.textContent = target + '+'; return; }
    var start = null;
    var duration = 1400;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + (p === 1 ? '+' : '');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var revealEls = document.querySelectorAll('.reveal');
  var counters = document.querySelectorAll('[data-count]');

  if (!('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
    counters.forEach(animateCount);
    return;
  }

  var io = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      if (entry.target.hasAttribute('data-count')) animateCount(entry.target);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(function (el) { io.observe(el); });
  counters.forEach(function (el) { io.observe(el); });
})();
