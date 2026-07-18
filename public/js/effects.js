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

// ============================================================
// V6 — FX dynamiques : particules, parallaxe scroll, glare,
// boutons magnétiques, titre animé, timeline lumineuse, curseur
// ============================================================
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  // --- Titre du hero animé mot par mot ---
  var h1 = document.querySelector('.hero h1');
  if (h1 && !reduce) {
    var idx = 0;
    Array.prototype.slice.call(h1.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement('span');
          w.className = 'w';
          w.style.setProperty('--i', idx++);
          w.textContent = part;
          frag.appendChild(w);
        });
        h1.replaceChild(frag, node);
      } else if (node.nodeType === 1) {
        node.classList.add('w');
        node.style.setProperty('--i', idx++);
      }
    });
  }

  // --- Particules connectées dans le hero ---
  var hero = document.querySelector('.hero');
  if (hero && !reduce) {
    var canvas = document.createElement('canvas');
    canvas.id = 'hero-particles';
    hero.insertBefore(canvas, hero.firstChild);
    var ctx = canvas.getContext('2d');
    var dots = [];
    var running = true;

    function resize() {
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    var COUNT = Math.min(70, Math.floor(window.innerWidth / 22));
    for (var i = 0; i < COUNT; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.6,
      });
    }

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(76, 201, 255, 0.5)';
        ctx.fill();
        for (var j = i + 1; j < dots.length; j++) {
          var e = dots[j];
          var dx = d.x - e.x, dy = d.y - e.y;
          var dist = dx * dx + dy * dy;
          if (dist < 110 * 110) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(e.x, e.y);
            ctx.strokeStyle = 'rgba(47, 107, 255,' + (0.16 * (1 - dist / (110 * 110))) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }
    frame();
    // Pause quand le hero sort de l'écran
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !running) { running = true; frame(); }
        else if (!vis) { running = false; }
      }).observe(hero);
    }
  }

  // --- Parallaxe scroll multi-couches (via la propriété `translate`) ---
  if (!reduce) {
    // Tag automatique des éléments avec leur vitesse
    document.querySelectorAll('.shead .snum').forEach(function (el) { el.setAttribute('data-pscroll', '0.16'); });
    document.querySelectorAll('.module .ghost').forEach(function (el) { el.setAttribute('data-pscroll', '0.1'); });
    var polas = document.querySelectorAll('.story-photos .polaroid');
    var polaSpeeds = ['0.05', '-0.06', '0.08'];
    polas.forEach(function (el, i) { el.setAttribute('data-pscroll', polaSpeeds[i % 3]); });
    document.querySelectorAll('.orb').forEach(function (el, i) { el.setAttribute('data-pscroll', i % 2 ? '-0.1' : '0.14'); });

    var pEls = Array.prototype.slice.call(document.querySelectorAll('[data-pscroll]')).map(function (el) {
      return { el: el, f: parseFloat(el.getAttribute('data-pscroll')) || 0.1, mx: 0, my: 0 };
    });
    // Souris ([data-parallax] déjà présents dans le HTML)
    var mEls = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));

    var ticking = false;
    function apply() {
      ticking = false;
      var vh = window.innerHeight;
      pEls.forEach(function (p) {
        var r = p.el.getBoundingClientRect();
        var center = r.top + r.height / 2 - vh / 2;
        var y = -center * p.f;
        p.el.style.translate = p.mx + 'px ' + (p.my + y).toFixed(1) + 'px';
      });
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    apply();

    if (finePointer) {
      window.addEventListener('mousemove', function (e) {
        var cx = e.clientX / window.innerWidth - 0.5;
        var cy = e.clientY / window.innerHeight - 0.5;
        mEls.forEach(function (el) {
          var depth = parseFloat(el.getAttribute('data-parallax')) || 20;
          var entry = null;
          for (var i = 0; i < pEls.length; i++) if (pEls[i].el === el) { entry = pEls[i]; break; }
          if (entry) { entry.mx = cx * depth; entry.my = cy * depth; }
          else { el.style.translate = (cx * depth) + 'px ' + (cy * depth) + 'px'; }
        });
        onScroll();
      }, { passive: true });
    }
  }

  // --- Reflet lumineux (glare) sur les cartes ---
  if (finePointer && !reduce) {
    document.querySelectorAll('.tilt, .module, .bonus, .format-card, .stat, .letter').forEach(function (card) {
      card.classList.add('glare-host');
      var glare = document.createElement('div');
      glare.className = 'glare';
      card.appendChild(glare);
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  // --- Boutons magnétiques ---
  if (finePointer && !reduce) {
    document.querySelectorAll('.btn-primary').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        var y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        btn.style.translate = (x * 5).toFixed(1) + 'px ' + (y * 4).toFixed(1) + 'px';
      });
      btn.addEventListener('mouseleave', function () { btn.style.translate = '0px 0px'; });
    });
  }

  // --- Timeline : points qui s'allument au passage ---
  if ('IntersectionObserver' in window) {
    var tlIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('lit', en.isIntersecting); });
    }, { threshold: 0.6 });
    document.querySelectorAll('.tl-item').forEach(function (el) { tlIO.observe(el); });
  }

  // --- Halo de curseur (desktop) ---
  if (finePointer && !reduce) {
    var glow = document.createElement('div');
    glow.id = 'cursor-glow';
    glow.style.opacity = '0';
    document.body.appendChild(glow);
    var gx = 0, gy = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      glow.style.opacity = '1';
    }, { passive: true });
    (function loop() {
      gx += (tx - gx) * 0.08;
      gy += (ty - gy) * 0.08;
      glow.style.left = gx + 'px';
      glow.style.top = gy + 'px';
      requestAnimationFrame(loop);
    })();
  }
})();
