// Page de confirmation : vérifie le statut du paiement auprès du serveur
// (qui interroge PayDunya), affiche la facture unique et le bouton de contact.
(function () {
  var loading = document.getElementById('state-loading');
  var success = document.getElementById('state-success');
  var pending = document.getElementById('state-pending');

  function show(el) {
    [loading, success, pending].forEach(function (s) { s.classList.add('hidden'); });
    el.classList.remove('hidden');
  }

  function txt(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  var cfg = {};

  function formatDate(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // Récupère la config (numéro WhatsApp du formateur, lien du site).
  var configLoaded = fetch('/api/config')
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (c) { cfg = c || {}; })
    .catch(function () { cfg = {}; });

  function setupSuccess(data) {
    var cust = data.customer || {};
    txt('client-prenom', cust.prenom || '');
    txt('f-num', data.facture || '—');
    txt('f-date', formatDate(data.date));
    txt('f-client', [cust.prenom, cust.nom].filter(Boolean).join(' ') || '—');
    txt('f-email', cust.email || '—');
    txt('f-whatsapp', cust.whatsapp || '—');
    txt('f-montant', data.montantFormate || '100.000');

    // Lien du site
    var siteLink = document.getElementById('site-link');
    if (siteLink && cfg.siteUrl) {
      siteLink.href = cfg.siteUrl;
      siteLink.textContent = cfg.siteUrl.replace(/^https?:\/\//, '');
    }

    // Bouton "Contacter le formateur" : WhatsApp avec la facture pré-remplie
    var contactBtn = document.getElementById('contact-btn');
    var num = (cfg.supportWhatsapp || '').replace(/[^0-9]/g, '');
    if (contactBtn && num) {
      var msg =
        'Bonjour, je viens de payer la formation Ecom Booster ✅\n' +
        'Facture n° ' + (data.facture || '') + '\n' +
        'Nom : ' + [cust.prenom, cust.nom].filter(Boolean).join(' ') + '\n' +
        'Email : ' + (cust.email || '') + '\n' +
        'Merci de m\'envoyer mes accès à la formation.';
      contactBtn.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
    } else if (contactBtn) {
      contactBtn.classList.add('hidden');
    }

    show(success);
  }

  var token = new URLSearchParams(window.location.search).get('token');
  if (!token) {
    configLoaded.then(function () { show(pending); });
    return;
  }

  Promise.all([
    configLoaded,
    fetch('/api/verify/' + encodeURIComponent(token)).then(function (r) { return r.json(); }),
  ])
    .then(function (results) {
      var data = results[1];
      if (data && data.status === 'completed') {
        setupSuccess(data);
      } else {
        show(pending);
      }
    })
    .catch(function () { show(pending); });
})();
