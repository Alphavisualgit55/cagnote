// Effets visuels 3D + contenus dynamiques (images admin, vidéo, Instagram)
// + comptage des visiteurs.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Barre de progression du scroll ---
  var progress = document.getElementById('scroll-progress');
  if (progress) {
    var onScrollP = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScrollP, { passive: true });
    onScrollP();
  }

  // --- Tilt 3D au survol des cartes .tilt ---
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.tilt').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(700px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 8) + 'deg) translateY(-4px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    });

    // --- Parallaxe des halos du hero avec la souris ---
    var parallaxEls = document.querySelectorAll('[data-parallax]');
    if (parallaxEls.length) {
      window.addEventListener('mousemove', function (e) {
        var cx = e.clientX / window.innerWidth - 0.5;
        var cy = e.clientY / window.innerHeight - 0.5;
        parallaxEls.forEach(function (el) {
          var depth = parseFloat(el.getAttribute('data-parallax')) || 20;
          el.style.transform = 'translate(' + (cx * depth) + 'px,' + (cy * depth) + 'px)';
        });
      }, { passive: true });
    }
  }

  // --- Contenus dynamiques : images uploadées via l'admin + réglages ---
  fetch('/api/assets')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      var assets = data.assets || {};
      var settings = data.settings || {};

      // Photos & captures de résultats
      Object.keys(assets).forEach(function (slot) {
        var box = document.querySelector('[data-asset="' + slot + '"]');
        if (!box) return;
        var img = document.createElement('img');
        img.src = assets[slot];
        img.alt = '';
        img.loading = 'lazy';
        box.appendChild(img);
        box.classList.add('has-img');
      });

      // Vidéo de présentation (YouTube ou fichier .mp4)
      var videoUrl = settings.video_url || '';
      var box = document.getElementById('video-box');
      if (box && videoUrl) {
        var yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
        box.innerHTML = '';
        box.style.cursor = 'default';
        if (yt) {
          var iframe = document.createElement('iframe');
          iframe.src = 'https://www.youtube.com/embed/' + yt[1];
          iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
          iframe.allowFullscreen = true;
          box.appendChild(iframe);
        } else {
          var video = document.createElement('video');
          video.src = videoUrl;
          video.controls = true;
          video.playsInline = true;
          box.appendChild(video);
        }
      }

      // Liens Instagram
      if (settings.instagram_url) {
        document.querySelectorAll('[data-ig]').forEach(function (a) { a.href = settings.instagram_url; });
      }
    })
    .catch(function () {});

  // --- Comptage des visiteurs (1 fois par session) ---
  try {
    if (!sessionStorage.getItem('eb_tracked')) {
      sessionStorage.setItem('eb_tracked', '1');
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname, ref: document.referrer || '' }),
      }).catch(function () {});
    }
  } catch (e) { /* sessionStorage indisponible */ }
})();
