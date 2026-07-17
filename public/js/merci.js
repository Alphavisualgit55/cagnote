// Page de confirmation : vérifie le statut du paiement auprès du serveur
// (qui interroge PayDunya) puis affiche l'état correspondant.
(function () {
  var loading = document.getElementById('state-loading');
  var success = document.getElementById('state-success');
  var pending = document.getElementById('state-pending');

  function show(el) {
    [loading, success, pending].forEach(function (s) { s.classList.add('hidden'); });
    el.classList.remove('hidden');
  }

  // Liens WhatsApp (groupe + support) fournis par le serveur.
  fetch('/api/config')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg) return;
      var waBtn = document.getElementById('wa-group-btn');
      if (cfg.whatsappGroupUrl) {
        waBtn.href = cfg.whatsappGroupUrl;
        waBtn.classList.remove('hidden');
      }
      var support = document.getElementById('support-link');
      if (cfg.supportWhatsapp) {
        support.href = 'https://wa.me/' + cfg.supportWhatsapp.replace(/[^0-9]/g, '');
      } else {
        support.parentElement.classList.add('hidden');
      }
    })
    .catch(function () {});

  var token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    // Arrivée sans token (accès direct) : on affiche l'état "en attente".
    show(pending);
    return;
  }

  fetch('/api/verify/' + encodeURIComponent(token))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.status === 'completed') {
        if (data.customer && data.customer.prenom) {
          document.getElementById('client-prenom').textContent = data.customer.prenom;
        }
        show(success);
      } else {
        show(pending);
      }
    })
    .catch(function () { show(pending); });
})();
