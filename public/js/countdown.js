// Compte à rebours jusqu'à la fin de la promo (5 août par défaut).
(function () {
  var el = {
    days: document.getElementById('cd-days'),
    hours: document.getElementById('cd-hours'),
    mins: document.getElementById('cd-mins'),
    secs: document.getElementById('cd-secs'),
  };
  if (!el.days) return;

  var deadline = new Date('2026-08-05T23:59:59');

  fetch('/api/config')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (cfg && cfg.promoDeadline) {
        var d = new Date(cfg.promoDeadline);
        if (!isNaN(d.getTime())) deadline = d;
      }
    })
    .catch(function () {});

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function tick() {
    var diff = deadline.getTime() - Date.now();
    if (diff <= 0) {
      el.days.textContent = el.hours.textContent = el.mins.textContent = el.secs.textContent = '00';
      return;
    }
    el.days.textContent = pad(Math.floor(diff / 86400000));
    el.hours.textContent = pad(Math.floor(diff / 3600000) % 24);
    el.mins.textContent = pad(Math.floor(diff / 60000) % 60);
    el.secs.textContent = pad(Math.floor(diff / 1000) % 60);
  }

  tick();
  setInterval(tick, 1000);
})();
