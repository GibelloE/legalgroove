/* Legal Groove — comportamiento del sitio */
(() => {
  'use strict';

  const d = document;
  const root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // se respeta "menos movimiento" del sistema, salvo que se haya pedido verlas (?motion=on)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches && !root.classList.contains('force-motion');

  // Datos de contacto. Número: +54 9 11 2554-3087 (así, sin signos, lo pide wa.me).
  const CONTACT = { whatsapp: '5491125543087', mail: 'contacto@legalgroove.com.ar' };

  /* ==========================================================================
     Idiomas
     El español es el texto del HTML (se captura al cargar); el inglés vive acá.
     Las claves son las de data-i18n / data-i18n-attr.
     ========================================================================== */
  const STRINGS = {
    es: {
      // textos que no están en el HTML
      'form.sent.wa': 'Abrimos WhatsApp con tu consulta lista para enviar.',
      'form.sent.mail': 'Abrimos tu correo con la consulta lista para enviar.',
      'msg.subject': 'Consulta',
      'msg.name': 'Nombre',
      'msg.project': 'Proyecto',
      'msg.need': 'Necesito',
      'msg.stage': 'Etapa',
    },
    en: {
      'doc.title': 'Legal Groove | Law for artists and creative projects',
      'doc.description': 'Legal advice for artists, DJs, producers, labels and creative projects in Argentina. Trademarks, copyright, contracts and intellectual property.',
      'skip': 'Skip to content',
      'meta': 'Law · Music · Community',
      'brand.home': 'Legal Groove — home',
      'nav.label': 'Main',
      'nav.services': 'Services',
      'nav.faq': 'FAQ',
      'nav.contact': 'Contact',
      'deck.label': 'Language',
      'mute': 'Mute',

      'hero.mark': 'Legal Groove, registered trademark',
      'enter.label': 'Play: enter the site',
      'enter.quiet': 'Enter without music',
      'con.label': 'Console',
      'con.play': 'Play',
      'con.pause': 'Pause',
      'con.stop': 'Stop',
      'con.vola': 'Deck A volume',
      'con.volb': 'Deck B volume',
      'con.cross': 'Crossfader between the two decks',
      'hero.title': 'Law for your creative project.',
      'hero.copy': 'Protect your music, your name and the deals behind what you’re creating.',
      'hero.cta': 'Tell me about your project',
      'hero.services': 'See services',

      'ticker.sr': 'The law firm that protects your music, your brand and your contracts.',
      'ticker.1': 'The law firm that protects your music',
      'ticker.2': 'your brand',
      'ticker.3': 'and your contracts',

      'svc.idx': '01 — Services',
      'svc.title': 'Trademarks, music and contracts.',
      'svc.copy': 'Advice built on how the creative industry really works, with clear explanations and documented decisions.',
      'svc.ask': 'Ask',
      'svc.tm': 'Trademarks',
      'svc.tm.1': 'Artist name',
      'svc.tm.2': 'Labels and production companies',
      'svc.tm.3': 'Parties and event series',
      'svc.tm.4': 'Clearance searches',
      'svc.tm.5': 'Registration with INPI',
      'svc.tm.6': 'Oppositions',
      'svc.tm.ask': ' about trademarks',
      'svc.mu': 'Music',
      'svc.mu.3': 'Musical works',
      'svc.mu.4': 'Sound recordings',
      'svc.mu.8': 'Licenses',
      'svc.mu.ask': ' about music and copyright',
      'svc.ct': 'Contracts',
      'svc.ct.1': 'Music production',
      'svc.ct.5': 'Creative services',
      'svc.ct.6': 'Assignment and licensing',
      'svc.ct.ask': ' about contracts',

      'faq.idx': '02 — Frequently asked questions',
      'faq.title': 'Understanding is protecting too.',
      'faq.q1': 'Do I have to register a song with DNDA or with SADAIC?',
      'faq.a1': 'They are different bodies and can complement each other. DNDA registers the work and puts authorship on record; SADAIC manages authors’ rights in musical works within its scope. The right strategy depends on the work, its stage and how it will be exploited.',
      'faq.q2': 'Can I register my artist name as a trademark?',
      'faq.a2': 'Yes, as long as it meets the registrability requirements and there is no earlier mark that prevents or complicates it. Before filing, it is worth running a clearance search and choosing the right classes.',
      'faq.q3': 'Can I use a sample from another song?',
      'faq.a3': 'Using it may involve rights in the composition and in the sound recording. A fragment being short or altered does not automatically remove the need for permission.',
      'faq.q4': 'What is the difference between the composition and the master?',
      'faq.a4': 'The composition is the musical work. The master is a specific recording of that work. They can belong to different people and give rise to different rights.',
      'faq.q5': 'What is a split sheet?',
      'faq.a5': 'It is a document that records the contributions and percentages agreed between everyone who took part in the composition. It is best signed before registration and release.',

      'ct.idx': '03 — Contact',
      'ct.title': 'Protect what you’re creating.',
      'ct.copy': 'Tell me briefly what it’s about. The form organizes the information so the consultation starts with a clear summary.',
      'ct.human': 'No bots, no automated replies — human after all.',
      'f.name': 'Name',
      'f.name.ph': 'Your name',
      'f.project': 'Project',
      'f.project.ph': 'Artist, label, production company, brand…',
      'f.need': 'What do you need?',
      'need.none': 'Choose an option',
      'need.marca': 'Trademark registration',
      'need.musica': 'Copyright / music',
      'need.contrato': 'Contract',
      'need.general': 'General advice',
      'f.stage': 'Project stage',
      'stage.inicio': 'I’m just getting started',
      'stage.activo': 'It’s already up and running',
      'stage.lanzamiento': 'I’m about to release or sign',
      'stage.conflicto': 'There’s already a dispute',
      'f.more': 'Tell me a bit more',
      'f.more.ph': 'What happened, what you want to do, and any key date',
      'f.wa': 'Send via WhatsApp',
      'f.mail': 'Send by email',
      'f.note': 'Sending opens WhatsApp or your email app with the summary ready. This site does not store your data.',
      'form.sent.wa': 'WhatsApp is open with your inquiry ready to send.',
      'form.sent.mail': 'Your email app is open with your inquiry ready to send.',
      'msg.subject': 'Inquiry',
      'msg.name': 'Name',
      'msg.project': 'Project',
      'msg.need': 'I need',
      'msg.stage': 'Stage',

      'foot.legal': 'For information only. Every situation requires its own legal analysis.',
      'foot.role': 'Attorney and Industrial Property Agent',
      'foot.sides': 'Side A / Side B',
      'foot.made': 'Made in Buenos Aires',
      'foot.music': 'Music',
      'foot.edited': 'converted to AAC',
    },
  };

  const textNodes = $$('[data-i18n]');
  const attrNodes = $$('[data-i18n-attr]').map(el => ({
    el,
    pairs: el.dataset.i18nAttr.split(';').map(pair => pair.trim().split(':')),
  }));
  const metaDescription = $('meta[name="description"]');
  textNodes.forEach(n => { STRINGS.es[n.dataset.i18n] = n.textContent; });
  attrNodes.forEach(({ el, pairs }) => pairs.forEach(([attr, key]) => { STRINGS.es[key] = el.getAttribute(attr); }));
  STRINGS.es['doc.title'] = d.title;
  STRINGS.es['doc.description'] = metaDescription ? metaDescription.content : '';

  let lang = 'es';
  const t = key => (STRINGS[lang][key] != null ? STRINGS[lang][key] : STRINGS.es[key]);
  const applyLang = next => {
    lang = next === 'en' ? 'en' : 'es';
    textNodes.forEach(n => { const v = t(n.dataset.i18n); if (v != null) n.textContent = v; });
    attrNodes.forEach(({ el, pairs }) => pairs.forEach(([attr, key]) => { const v = t(key); if (v != null) el.setAttribute(attr, v); }));
    root.lang = lang === 'en' ? 'en' : 'es-AR';
    d.title = t('doc.title');
    if (metaDescription) metaDescription.content = t('doc.description');
    try { localStorage.setItem('lg-lang', lang); } catch (_) { /* sin storage */ }
  };

  // idioma inicial: ?lang=en|es, o el último elegido
  let initial = 'es';
  try {
    const asked = new URLSearchParams(location.search).get('lang');
    initial = asked === 'en' || asked === 'es' ? asked : (localStorage.getItem('lg-lang') || 'es');
  } catch (_) { /* sin storage */ }
  if (initial === 'en') applyLang('en');

  /* ---------- año ---------- */
  $$('[data-year]').forEach(n => { n.textContent = new Date().getFullYear(); });

  /* ---------- aparición al hacer scroll ---------- */
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    revealEls.forEach(n => io.observe(n));
  } else {
    revealEls.forEach(n => n.classList.add('is-in'));
  }

  /* ---------- cabecera ---------- */
  const top = $('[data-top]');
  const heroMark = $('[data-hero-mark]');
  if (top) {
    const onScroll = () => top.classList.toggle('is-scrolled', window.scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    // la marca chica aparece cuando el logo grande sale de pantalla
    if (heroMark && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => top.classList.toggle('is-past', !e.isIntersecting), { rootMargin: '-72px 0px 0px 0px' }).observe(heroMark);
    } else {
      top.classList.add('is-past');
    }
  }

  /* ---------- un servicio preselecciona la necesidad en el formulario ---------- */
  $$('[data-need]').forEach(a => a.addEventListener('click', () => {
    const select = $('#necesidad');
    if (select) select.value = a.dataset.need;
  }));

  /* ---------- formulario: arma el resumen y abre WhatsApp o el correo ---------- */
  const form = $('[data-form]');
  if (form) {
    const status = $('[data-status]', form);
    const again = $('[data-again]', form);
    const value = (data, key) => (data.get(key) || '').toString().trim();
    // de los desplegables va el texto visible (en el idioma actual), no la clave interna
    const chosen = id => {
      const select = $('#' + id, form);
      return select && select.value ? select.options[select.selectedIndex].textContent.trim() : '';
    };

    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const via = (event.submitter && event.submitter.dataset.via) || 'whatsapp';
      const lines = [
        `${t('msg.name')}: ${value(data, 'nombre')}`,
        `${t('msg.project')}: ${value(data, 'proyecto')}`,
        `${t('msg.need')}: ${chosen('necesidad')}`,
        `${t('msg.stage')}: ${chosen('etapa')}`,
        '',
        value(data, 'mensaje'),
      ];
      if (via === 'mail') {
        const subject = `${t('msg.subject')} — ${value(data, 'proyecto') || value(data, 'nombre')}`;
        location.href = `mailto:${CONTACT.mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
        if (status) status.textContent = t('form.sent.mail');
      } else {
        const text = [`*${t('msg.subject')} — Legal Groove*`, '', ...lines].join('\n');
        window.open(`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        if (status) status.textContent = t('form.sent.wa');
      }
      if (again) again.hidden = false;
    });

    form.addEventListener('reset', () => {
      if (status) status.textContent = '';
      if (again) again.hidden = true;
    });
  }

  /* ==========================================================================
     La mano sobre un disco
     Con el mouse, o con el dedo sobre un disco grande, la mano lleva el punto
     que toca: el disco gira lo que ese punto gira alrededor del centro. Con el
     dedo sobre un disco chico eso no sirve: la yema tapa el centro y un par de
     píxeles deciden para qué lado gira. Ahí la mano empuja una manija
     imaginaria, a distancia fija del centro y a un costado del primer trazo:
     hacia abajo o hacia la derecha el disco avanza, hacia arriba o hacia la
     izquierda retrocede, y si la mano da vueltas el disco da vueltas con ella.
     La usan esta bandeja y los discos del inicio (console.js).
     ========================================================================== */
  const hand = {
    // Largo de la manija, en píxeles. Un círculo más chico que la manija no llega a darle la vuelta, y
    // cuanto más larga, menos gira el disco con cada trazo: 30 es lo que dibuja un dedo sin esfuerzo.
    LEVER: 30,
    // cx, cy: el centro del disco · x, y: dónde apoya la mano · lever: largo de la manija (0: la mano lleva el punto que toca)
    grab: (cx, cy, x, y, lever = 0) => ({ x, y, lever, hx: x - cx, hy: y - cy, set: !lever }),
    // la mano pasó a (x, y): devuelve cuántos grados giró el disco
    move(g, x, y) {
      const dx = x - g.x, dy = y - g.y;
      const len = Math.hypot(dx, dy);
      if (!g.set) {
        if (len < 4) return 0; // un dedo apoyado tiembla: hasta que no se mueve de verdad, el disco queda quieto
        const side = (dy + 0.5 * dx > 0 ? g.lever : -g.lever) / len;
        g.hx = dy * side;
        g.hy = -dx * side;
        g.set = true;
      }
      g.x = x;
      g.y = y;
      let turn;
      if (g.lever) {
        // La manija gira con el disco, sin cambiar de largo, hasta quedar detrás del movimiento. Para un
        // tramo recto eso tiene solución exacta: el giro no depende de cada cuánto avisa la pantalla, y
        // volver por el mismo camino deja el disco donde estaba.
        const a = Math.atan2(dx * g.hy - dy * g.hx, dx * g.hx + dy * g.hy); // ángulo entre el movimiento y la manija
        turn = 2 * Math.atan(Math.tan(a / 2) * Math.exp(-len / g.lever)) - a;
        const c = Math.cos(turn), s = Math.sin(turn);
        [g.hx, g.hy] = [g.hx * c - g.hy * s, g.hx * s + g.hy * c];
      } else {
        const nx = g.hx + dx, ny = g.hy + dy;
        turn = Math.atan2(g.hx * ny - g.hy * nx, g.hx * nx + g.hy * ny);
        g.hx = nx;
        g.hy = ny;
      }
      return turn * 180 / Math.PI;
    },
  };
  window.lgHand = hand;

  /* ==========================================================================
     Bandeja de idiomas
     Dos vinilos (español / inglés) y un crossfader entre ambos. La perilla se
     puede mover de a poco; el idioma cambia recién al soltarla. Apretar un disco
     lo frena, arrastrarlo lo hace girar con la mano y al soltarlo retoma.
     ========================================================================== */
  const deck = $('[data-deck]');
  if (deck) {
    const fader = $('[data-fader]', deck);
    const knob = $('.deck__knob', deck);
    const SPIN = 200; // grados por segundo: 33⅓ RPM

    /* --- los discos: cada uno con su ángulo y su velocidad --- */
    const platters = $$('[data-platter]', deck).map(el => ({
      el,
      vinyl: $('.deck__vinyl', el),
      angle: Math.random() * 360,
      omega: reduce ? 0 : SPIN,
      held: false,
      grip: null,   // por dónde lo tiene agarrado la mano
      finger: -1,   // y cuál de los punteros es esa mano
      push: 0,      // velocidad que trae la mano, para el envión al soltar
      moved: 0,     // cuándo fue el último movimiento
    }));

    let last = 0;
    let running = false;
    const frame = now => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      let alive = false;
      platters.forEach(p => {
        const target = p.held || reduce ? 0 : SPIN;
        // con el dedo encima se clava casi al instante; al soltar retoma con inercia
        const tau = p.held ? 0.05 : 0.32;
        p.omega += (target - p.omega) * (1 - Math.exp(-dt / tau));
        p.angle += p.omega * dt;
        if (p.held && now - p.moved > 90) p.push = 0;
        p.vinyl.style.transform = `rotate(${p.angle.toFixed(2)}deg)`;
        if (p.held || Math.abs(p.omega) > 0.5 || Math.abs(target - p.omega) > 0.5) alive = true;
      });
      if (alive) requestAnimationFrame(frame); else running = false;
    };
    const run = () => {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    };
    run();

    platters.forEach(p => {
      p.el.addEventListener('pointerdown', e => {
        if (e.button) return;
        const r = p.el.getBoundingClientRect();
        // estos discos son más chicos que la yema de un dedo: con el dedo se llevan de la manija,
        // apenas más larga que su radio para que un círculo alrededor del disco le dé la vuelta
        p.grip = hand.grab(r.left + r.width / 2, r.top + r.height / 2, e.clientX, e.clientY, e.pointerType === 'touch' ? Math.min(hand.LEVER, r.width * 0.55) : 0);
        p.finger = e.pointerId; // si se apoya otro dedo, el disco pasa a ese: el anterior deja de moverlo
        p.held = true;
        p.push = 0;
        p.moved = performance.now();
        p.el.classList.add('is-held');
        p.el.setPointerCapture(e.pointerId);
        run();
      });
      p.el.addEventListener('pointermove', e => {
        if (!p.held || e.pointerId !== p.finger) return;
        const delta = hand.move(p.grip, e.clientX, e.clientY);
        if (!delta) return;
        p.angle += delta; // el disco sigue a la mano
        const now = performance.now();
        const ms = Math.max(8, now - p.moved);
        p.push = p.push * 0.6 + (delta / ms * 1000) * 0.4;
        p.moved = now;
      });
      const release = e => {
        if (!p.held || e.pointerId !== p.finger) return;
        p.held = false;
        p.omega = clamp(p.push, -1400, 1400);
        p.el.classList.remove('is-held');
        run();
      };
      p.el.addEventListener('pointerup', release);
      p.el.addEventListener('pointercancel', release);
      p.el.addEventListener('lostpointercapture', release);
    });

    /* --- el crossfader: 0 = español, 1 = inglés --- */
    let mix = lang === 'en' ? 1 : 0;
    let committed = mix;
    let drag = null;
    let settleTimer = 0;
    let swapTimer = 0;

    const setMix = v => {
      mix = clamp(v, 0, 1);
      deck.style.setProperty('--mix', mix.toFixed(3));
      // mientras se mezcla, la página baja de volumen: se va el idioma actual
      if (!reduce) root.style.setProperty('--lang-fade', (1 - 0.5 * Math.abs(mix - committed)).toFixed(3));
    };
    const announce = () => {
      fader.setAttribute('aria-valuenow', String(committed));
      fader.setAttribute('aria-valuetext', committed ? 'English' : 'Español');
    };
    // la perilla termina sola el recorrido hasta el extremo y recién ahí cambia el idioma
    const settle = side => {
      const changed = side !== committed;
      const wasDimmed = Math.abs(mix - committed) > 0.2;
      clearTimeout(settleTimer);
      clearTimeout(swapTimer);
      deck.classList.add('is-snapping');
      root.classList.add('is-settling');
      committed = side;
      mix = side;
      deck.style.setProperty('--mix', String(side));
      announce();
      const next = side ? 'en' : 'es';
      if (!changed || reduce || wasDimmed) {
        if (changed) applyLang(next);
        root.style.setProperty('--lang-fade', '1');
      } else {
        // cambio de un toque (clic o teclado): baja, cambia el texto y vuelve
        root.style.setProperty('--lang-fade', '0.45');
        swapTimer = setTimeout(() => {
          applyLang(next);
          root.style.setProperty('--lang-fade', '1');
        }, 150);
      }
      settleTimer = setTimeout(() => {
        deck.classList.remove('is-snapping');
        root.classList.remove('is-settling');
      }, 520);
    };

    deck.style.setProperty('--mix', String(mix));
    announce();

    fader.addEventListener('pointerdown', e => {
      if (e.button) return;
      const r = fader.getBoundingClientRect();
      const kw = knob.offsetWidth;
      const travel = r.width - kw;
      const knobLeft = r.left + mix * travel;
      const onKnob = e.clientX >= knobLeft - 5 && e.clientX <= knobLeft + kw + 5;
      drag = {
        id: e.pointerId,
        left: r.left,
        travel,
        kw,
        offset: onKnob ? e.clientX - (knobLeft + kw / 2) : 0,
        startX: e.clientX,
        moved: false,
        onKnob,
      };
      clearTimeout(settleTimer);
      clearTimeout(swapTimer);
      deck.classList.remove('is-snapping');
      root.classList.remove('is-settling');
      fader.setPointerCapture(e.pointerId);
      if (!onKnob) setMix((e.clientX - r.left - kw / 2) / travel);
    });
    fader.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (Math.abs(e.clientX - drag.startX) > 3) drag.moved = true;
      setMix((e.clientX - drag.offset - drag.left - drag.kw / 2) / drag.travel);
    });
    fader.addEventListener('pointerup', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const tap = !drag.moved && drag.onKnob;
      drag = null;
      settle(tap ? (committed ? 0 : 1) : (mix >= 0.5 ? 1 : 0));
    });
    fader.addEventListener('pointercancel', e => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      settle(committed);
    });
    fader.addEventListener('keydown', e => {
      let side = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'Home') side = 0;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'End') side = 1;
      else if (e.key === 'Enter' || e.key === ' ') side = committed ? 0 : 1;
      if (side === null) return;
      e.preventDefault();
      settle(side);
    });
  }

  /* ---------- disco de contacto: dibuja los surcos y lo hace girar con el scroll ---------- */
  const records = $$('[data-record]');
  if (records.length) {
    const NS = 'http://www.w3.org/2000/svg';
    // pseudoaleatorio con semilla: el disco sale igual en cada carga
    let seed = 123;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ring = (r, opacity) => {
      const c = d.createElementNS(NS, 'circle');
      c.setAttribute('r', r);
      c.setAttribute('stroke-opacity', opacity.toFixed(3));
      return c;
    };

    records.forEach(svg => {
      const disc = $('.record__disc', svg);
      if (!disc) return;
      const frag = d.createDocumentFragment();
      // surcos, con dos bandas lisas que separan las «pistas» como en un vinilo
      for (let r = 46; r <= 500; r += 5) {
        const gap = (r > 196 && r < 212) || (r > 352 && r < 368);
        if (!gap) frag.appendChild(ring(r, 0.07 + rnd() * 0.11));
      }
      // brillos: arcos cortos que dejan ver el giro
      for (let i = 0; i < 22; i++) {
        const r = 46 + Math.floor(rnd() * 90) * 5;
        const len = 2 * Math.PI * r;
        const arc = len * (0.015 + rnd() * 0.06);
        const c = ring(r, 0.3 + rnd() * 0.35);
        c.setAttribute('stroke-dasharray', `${arc.toFixed(1)} ${(len - arc).toFixed(1)}`);
        c.setAttribute('transform', `rotate(${(rnd() * 360).toFixed(1)})`);
        frag.appendChild(c);
      }
      disc.appendChild(frag);
    });

    if (!reduce) {
      // el scroll hace girar el disco, como al mover un vinilo con la mano
      let ticking = false;
      const spin = () => {
        const rot = (window.scrollY * 0.05).toFixed(2) + 'deg';
        records.forEach(svg => svg.style.setProperty('--rot', rot));
        ticking = false;
      };
      addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(spin);
      }, { passive: true });
      spin();
    }
  }
})();
