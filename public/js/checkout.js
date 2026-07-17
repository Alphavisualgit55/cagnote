// Soumission du formulaire de commande → création de la facture PayDunya
// puis redirection vers la page de paiement sécurisée.
(function () {
  var form = document.getElementById('checkout-form');
  if (!form) return;

  var btn = document.getElementById('pay-btn');
  var errorBox = document.getElementById('form-error');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('visible');
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('visible');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var data = {
      prenom: form.prenom.value.trim(),
      nom: form.nom.value.trim(),
      email: form.email.value.trim(),
      whatsapp: form.whatsapp.value.trim(),
    };

    if (!data.prenom || !data.nom) {
      return showError('Merci de renseigner ton nom et ton prénom.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return showError('Merci de renseigner une adresse email valide.');
    }
    if (!/^\+?[0-9\s-]{8,16}$/.test(data.whatsapp)) {
      return showError('Merci de renseigner un numéro WhatsApp valide avec l\'indicatif pays (ex : +221771234567).');
    }

    btn.disabled = true;
    btn.textContent = '⏳ Création de ton paiement sécurisé…';

    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (r) {
        return r.json().then(function (body) { return { ok: r.ok, body: body }; });
      })
      .then(function (res) {
        if (res.ok && res.body.url) {
          window.location.href = res.body.url;
        } else {
          showError(res.body.error || 'Une erreur est survenue. Merci de réessayer.');
          btn.disabled = false;
          btn.textContent = '🔒 Payer 100.000 FCFA avec PayDunya';
        }
      })
      .catch(function () {
        showError('Connexion impossible. Vérifie ta connexion internet puis réessaie.');
        btn.disabled = false;
        btn.textContent = '🔒 Payer 100.000 FCFA avec PayDunya';
      });
  });
})();
