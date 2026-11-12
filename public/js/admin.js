// Panneau admin : connexion, KPIs, commandes, import d'images, réglages.
(function () {
  var SLOTS = [
    { id: 'photo-hero', label: 'Photo Dubaï / lifestyle' },
    { id: 'photo-portrait', label: 'Portrait de toi' },
    { id: 'photo-travail', label: 'Toi au travail' },
    { id: 'result-1', label: 'Résultat élève 1' },
    { id: 'result-2', label: 'Résultat élève 2' },
    { id: 'result-3', label: 'Résultat élève 3' },
    { id: 'result-4', label: 'Résultat élève 4' },
    { id: 'result-5', label: 'Résultat élève 5' },
    { id: 'result-6', label: 'Résultat élève 6' },
    { id: 'result-7', label: 'Résultat élève 7' },
    { id: 'result-8', label: 'Résultat élève 8' },
  ];

  var loginView = document.getElementById('login-view');
  var dashView = document.getElementById('dash-view');
  var msgBox = document.getElementById('admin-msg');
  var logoutBtn = document.getElementById('logout-btn');

  function key() { return sessionStorage.getItem('eb_admin_key') || ''; }

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ 'Content-Type': 'application/json', 'x-admin-key': key() }, options.headers || {});
    return fetch(path, options).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok) throw new Error(body.error || ('Erreur ' + r.status));
        return body;
      });
    });
  }

  function flash(text, ok) {
    msgBox.textContent = text;
    msgBox.className = 'admin-msg ' + (ok ? 'ok' : 'err');
    setTimeout(function () { msgBox.className = 'admin-msg'; }, 5000);
  }

  function fmtMoney(n) { return Number(n || 0).toLocaleString('fr-FR'); }
  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // ---------- Tableau de bord ----------
  function loadStats() {
    return api('/api/admin/stats').then(function (data) {
      document.getElementById('k-revenue').textContent = fmtMoney(data.sales.revenue);
      document.getElementById('k-paid').textContent = data.sales.paidCount;
      document.getElementById('k-pending').textContent = data.sales.pendingCount;
      document.getElementById('k-vtoday').textContent = data.visitors.today;
      document.getElementById('k-v7').textContent = data.visitors.last7days;
      document.getElementById('k-vtotal').textContent = data.visitors.total;

      var rows = (data.orders || []).map(function (o) {
        var paid = (o.statut || '').indexOf('paye') === 0;
        return '<tr>' +
          '<td>' + fmtDate(o.created_at || o.date) + '</td>' +
          '<td>' + (o.facture || '—') + '</td>' +
          '<td>' + [(o.prenom || ''), (o.nom || '')].join(' ').trim() + '</td>' +
          '<td>' + (o.email || '—') + '</td>' +
          '<td>' + (o.whatsapp || '—') + '</td>' +
          '<td>' + fmtMoney(o.montant) + ' F</td>' +
          '<td class="' + (paid ? 'pill-ok' : 'pill-wait') + '">' + (paid ? '✅ Payé' : '⏳ En attente') + '</td>' +
        '</tr>';
      });
      document.getElementById('orders-body').innerHTML =
        rows.length ? rows.join('') : '<tr><td colspan="7" style="color:var(--muted);">Aucune commande pour le moment.</td></tr>';
    });
  }

  // ---------- Images ----------
  function loadSlots() {
    return fetch('/api/assets').then(function (r) { return r.json(); }).then(function (data) {
      var assets = (data && data.assets) || {};
      var settings = (data && data.settings) || {};
      document.getElementById('set-video').value = settings.video_url || '';
      document.getElementById('set-instagram').value = settings.instagram_url || '';

      var grid = document.getElementById('slots-grid');
      grid.innerHTML = '';
      SLOTS.forEach(function (slot) {
        var url = assets[slot.id];
        var div = document.createElement('div');
        div.className = 'slot';
        div.innerHTML =
          '<div class="preview">' + (url ? '<img src="' + url + '" alt="">' : 'Aucune image') + '</div>' +
          '<div class="name">' + slot.label + '</div>' +
          '<div class="actions">' +
            '<label class="mini-btn">📤 Importer<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-slot="' + slot.id + '"></label>' +
            (url ? '<button class="mini-btn danger" data-del="' + slot.id + '">🗑️</button>' : '') +
          '</div>';
        grid.appendChild(div);
      });
    });
  }

  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!input.matches('input[type=file][data-slot]')) return;
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return flash('Image trop lourde (max 4 Mo).', false);

    var reader = new FileReader();
    reader.onload = function () {
      var base64 = String(reader.result).split(',')[1];
      flash('Import en cours…', true);
      api('/api/admin/upload', {
        method: 'POST',
        body: JSON.stringify({ slot: input.getAttribute('data-slot'), data: base64, contentType: file.type }),
      })
        .then(function () { flash('✅ Image importée ! Elle est en ligne.', true); return loadSlots(); })
        .catch(function (err) { flash(err.message, false); });
    };
    reader.readAsDataURL(file);
  });

  document.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del]');
    if (del) {
      api('/api/admin/delete-asset', { method: 'POST', body: JSON.stringify({ slot: del.getAttribute('data-del') }) })
        .then(function () { flash('Image supprimée.', true); return loadSlots(); })
        .catch(function (err) { flash(err.message, false); });
    }
    var save = e.target.closest('[data-save]');
    if (save) {
      var name = save.getAttribute('data-save');
      var value = document.getElementById(name === 'video_url' ? 'set-video' : 'set-instagram').value.trim();
      api('/api/admin/setting', { method: 'POST', body: JSON.stringify({ name: name, value: value }) })
        .then(function () { flash('✅ Réglage enregistré.', true); })
        .catch(function (err) { flash(err.message, false); });
    }
  });

  // ---------- Connexion ----------
  function showDash() {
    loginView.classList.add('hidden');
    dashView.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loadStats().catch(function (err) { flash(err.message, false); });
    loadSlots().catch(function () {});
  }

  function tryLogin(pass) {
    sessionStorage.setItem('eb_admin_key', pass);
    return api('/api/admin/stats').then(showDash);
  }

  document.getElementById('login-btn').addEventListener('click', function () {
    var pass = document.getElementById('admin-pass').value;
    var errBox = document.getElementById('login-error');
    errBox.classList.remove('visible');
    tryLogin(pass).catch(function (err) {
      sessionStorage.removeItem('eb_admin_key');
      errBox.textContent = err.message;
      errBox.classList.add('visible');
    });
  });
  document.getElementById('admin-pass').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  document.getElementById('refresh-btn').addEventListener('click', function () {
    loadStats().then(function () { flash('Données actualisées.', true); }).catch(function (err) { flash(err.message, false); });
  });

  logoutBtn.addEventListener('click', function () {
    sessionStorage.removeItem('eb_admin_key');
    location.reload();
  });

  // Reconnexion automatique si la clé est encore en session
  if (key()) {
    tryLogin(key()).catch(function () { sessionStorage.removeItem('eb_admin_key'); });
  }
})();
