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

  // --- Visionneuse plein écran (lightbox) pour les images ---
  var lightbox = null;
  function openLightbox(src) {
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'lightbox';
      lightbox.innerHTML = '<button class="close" aria-label="Fermer">✕</button><img src="" alt="" />';
      document.body.appendChild(lightbox);
      lightbox.addEventListener('click', function () { lightbox.classList.remove('open'); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') lightbox.classList.remove('open');
      });
    }
    lightbox.querySelector('img').src = src;
    requestAnimationFrame(function () { lightbox.classList.add('open'); });
  }

  // --- Contenus dynamiques : images uploadées via l'admin + réglages ---
  fetch('/api/assets')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      var assets = data.assets || {};
      var settings = data.settings || {};

      // Photos & captures de résultats (cliquables pour agrandir)
      Object.keys(assets).forEach(function (slot) {
        var box = document.querySelector('[data-asset="' + slot + '"]');
        if (!box) return;
        var img = document.createElement('img');
        img.src = assets[slot];
        img.alt = '';
        img.loading = 'lazy';
        img.addEventListener('click', function (e) {
          e.stopPropagation();
          openLightbox(assets[slot]);
        });
        box.appendChild(img);
        box.classList.add('has-img');
      });

      // Vidéo de présentation (YouTube, Google Drive ou fichier .mp4)
      var videoUrl = settings.video_url || '';
      var box = document.getElementById('video-box');
      if (box && videoUrl) {
        var yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
        var drive = videoUrl.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
        var insta = videoUrl.match(/instagram\.com\/(?:reel|p)\/([\w-]+)/);
        box.innerHTML = '';
        box.style.cursor = 'default';
        if (insta) {
          // Reel Instagram : format vertical
          box.classList.add('vertical');
          var ig = document.createElement('iframe');
          ig.src = 'https://www.instagram.com/reel/' + insta[1] + '/embed/';
          ig.allow = 'encrypted-media; picture-in-picture';
          ig.allowFullscreen = true;
          ig.setAttribute('scrolling', 'no');
          box.appendChild(ig);
        } else if (yt || drive) {
          var iframe = document.createElement('iframe');
          iframe.src = yt
            ? 'https://www.youtube.com/embed/' + yt[1]
            : 'https://drive.google.com/file/d/' + drive[1] + '/preview';
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
