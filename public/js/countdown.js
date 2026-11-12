// Compte à rebours jusqu'à la fin de la promo (5 août par défaut).
// Met à jour TOUS les éléments [data-cd="days|hours|mins|secs"] (plusieurs
// compteurs possibles : hero, offre, barre collante…).
(function () {
  var days = document.querySelectorAll('[data-cd="days"]');
  var hours = document.querySelectorAll('[data-cd="hours"]');
  var mins = document.querySelectorAll('[data-cd="mins"]');
  var secs = document.querySelectorAll('[data-cd="secs"]');
  if (!days.length) return;

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
  function setAll(list, val) { for (var i = 0; i < list.length; i++) list[i].textContent = val; }

  function tick() {
    var diff = deadline.getTime() - Date.now();
    if (diff <= 0) {
      setAll(days, '00'); setAll(hours, '00'); setAll(mins, '00'); setAll(secs, '00');
      return;
    }
    setAll(days, pad(Math.floor(diff / 86400000)));
    setAll(hours, pad(Math.floor(diff / 3600000) % 24));
    setAll(mins, pad(Math.floor(diff / 60000) % 60));
    setAll(secs, pad(Math.floor(diff / 1000) % 60));
  }

  tick();
  setInterval(tick, 1000);
})();
