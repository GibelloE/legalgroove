/* Legal Groove — la consola del inicio
   Las dos «O» de GROOVE son discos: giran, se frenan con la mano y se pueden
   arrastrar (scratch). Arriba del logo hay una pista por disco y sus vúmetros;
   abajo, transporte, volúmenes y crossfader. Al entrar al sitio, una bandeja
   de DJ se transforma en el logo.

   Cada disco toca el archivo que indica su pista en el HTML (data-audio). Si
   no hay archivo, la pista es generada: 123 BPM en 4/4, distinta en cada
   visita, y solo se ve. `deck.track` es la onda (una barra por semicorchea) y
   `deck.level`, lo que marcan los vúmetros. */
(() => {
  'use strict';

  const d = document;
  const root = d.documentElement;
  const hero = d.querySelector('[data-hero]');
  if (!hero) return;

  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches && !root.classList.contains('force-motion');
  const el = (name, attrs = {}) => {
    const node = d.createElementNS(NS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  };

  /* ---------- reloj ---------- */
  const BPM = 123;
  const STEP = 60 / BPM / 4;                 // una semicorchea, en segundos
  const SPIN = 200;                          // grados por segundo: 33⅓ RPM
  const STEPS_PER_DEG = 1 / (SPIN * STEP);   // cuánto avanza la pista por cada grado de giro
  const BARS = 32;
  const LEN = BARS * 16;

  /* ---------- pistas: una al azar por disco, siempre en 4/4 ---------- */
  const seeded = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  function makeTrack(rnd) {
    const amp = new Float32Array(LEN);
    // cuatro secciones de 8 compases con distinta energía (intro, tema, corte…)
    const forms = [[0.4, 0.75, 1, 0.55], [0.65, 1, 0.45, 1], [1, 0.42, 0.8, 1], [0.5, 1, 1, 0.38]];
    const form = forms[Math.floor(rnd() * forms.length)];
    const bass = Array.from({ length: 16 }, () => (rnd() < 0.45 ? 0.32 + rnd() * 0.3 : 0));
    const hats = Array.from({ length: 16 }, (_, i) => (i % 2 ? 0.14 + rnd() * 0.16 : 0));
    for (let i = 0; i < LEN; i++) {
      const bar = Math.floor(i / 16);
      const s = i % 16;
      const energy = form[Math.floor(bar / 8) % form.length];
      let a = 0.05 + rnd() * 0.05;
      if (s % 4 === 0 && energy > 0.45) a = Math.max(a, 0.84 + rnd() * 0.16); // bombo en cada negra
      if (s % 8 === 4) a = Math.max(a, 0.6 + rnd() * 0.12);                   // palmas en 2 y 4
      if (s % 4 === 2) a = Math.max(a, 0.36 + rnd() * 0.1);                   // contratiempo
      a = Math.max(a, bass[s], hats[s]);
      if (bar % 8 === 7 && s >= 8) a = Math.max(a, 0.3 + ((s - 8) / 8) * 0.6); // redoble antes del cambio
      amp[i] = Math.min(1, a * (0.45 + 0.55 * energy));
    }
    // cada disco arranca en su sección con más energía, para que el 4/4 se vea desde el primer compás
    amp.start = form.indexOf(Math.max(...form)) * 8 * 16;
    return amp;
  }

  const decks = ['a', 'b'].map((id, n) => {
    const track = makeTrack(seeded((Math.random() * 2 ** 32) | 0));
    const home = track.start / STEPS_PER_DEG;
    return {
      id,
      track,
      generated: track,         // se guarda: vuelve a usarse si el audio de este disco no carga
      rot: Math.random() * 360, // lo que se ve girar
      travel: home,             // lo que avanzó la pista, en grados de disco
      home,
      omega: 0,
      held: false,
      grip: null,               // por dónde lo tiene agarrado la mano
      finger: -1,               // y cuál de los punteros es esa mano
      push: 0,
      moved: 0,
      level: 0,
      out: 0,
      pos: 0,
      step: -1,
      vol: 0.8,
      rewind: false,
    };
  });
  let transport = 'pause';
  let xfade = 0.5;

  /* ==========================================================================
     Los discos: cada «O» del logo, descrita como distancias desde su centro.
     Así el mismo dibujo sirve para el plato redondo de la bienvenida, para la
     «O» final y para todo lo intermedio.
     ========================================================================== */
  const K = 144;
  const DIRS = Array.from({ length: K }, (_, i) => {
    const a = -Math.PI / 2 + (i / K) * Math.PI * 2; // desde arriba, en sentido horario
    return [Math.cos(a), Math.sin(a)];
  });
  // surcos: paralelos al borde exterior, a distancia fija (en fracciones del medio ancho de la «O»)
  const GROOVE_INSETS = [0.108, 0.216, 0.324];
  const GROOVE_ROUND = [0.86, 0.72, 0.58]; // radio de cada surco cuando el disco es un plato redondo

  function flatten(dAttr) {
    const toks = dAttr.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
    const subs = [];
    let cur = null, pos = null, cmd = '';
    for (let i = 0; i < toks.length;) {
      if (/[MLCZ]/i.test(toks[i])) { cmd = toks[i++].toUpperCase(); if (cmd === 'Z') continue; }
      if (cmd === 'M') { pos = [+toks[i], +toks[i + 1]]; i += 2; cur = [pos]; subs.push(cur); cmd = 'L'; }
      else if (cmd === 'L') { pos = [+toks[i], +toks[i + 1]]; i += 2; cur.push(pos); }
      else if (cmd === 'C') {
        const p0 = pos, c1 = [+toks[i], +toks[i + 1]], c2 = [+toks[i + 2], +toks[i + 3]], p3 = [+toks[i + 4], +toks[i + 5]];
        i += 6;
        for (let k = 1; k <= 10; k++) {
          const t = k / 10, u = 1 - t;
          cur.push([
            u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
          ]);
        }
        pos = p3;
      } else i++;
    }
    return subs;
  }
  // distancia del origen al contorno en cada una de las K direcciones
  function radial(poly) {
    return DIRS.map(([dx, dy]) => {
      let best = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = (a[0] * ey - a[1] * ex) / den;
        const u = (a[0] * dy - a[1] * dx) / den;
        if (t > best && u >= 0 && u <= 1) best = t;
      }
      return best;
    });
  }
  /* Cada «O» es un paralelogramo redondeado: inclinada, angosta y alta. Se la
     «endereza» a un cuadrado redondeado (quitando la inclinación y escalando) y
     ahí se la describe por radios. Para dibujarla se deshace esa transformación;
     con medio ancho = alto e inclinación 0, el mismo dibujo da un círculo. */
  const SLANT = Math.tan(14.47 * Math.PI / 180);
  const ringPath = (f, rho) => {
    let s = '';
    for (let i = 0; i < K; i++) {
      const u = DIRS[i][0] * rho[i], v = DIRS[i][1] * rho[i];
      s += (i ? 'L' : 'M') + (f.x + f.a * u - f.k * f.b * v).toFixed(1) + ' ' + (f.y + f.b * v).toFixed(1);
    }
    return s + 'Z';
  };

  const ringOf = (f, dirs, rho) => {
    let s = '';
    for (let i = 0; i < dirs.length; i++) {
      const u = dirs[i][0] * rho[i], v = dirs[i][1] * rho[i];
      s += (i ? 'L' : 'M') + (f.x + f.a * u - f.k * f.b * v).toFixed(1) + ' ' + (f.y + f.b * v).toFixed(1);
    }
    return s + 'Z';
  };
  // contorno cerrado → M puntos separados por la misma distancia
  function resample(poly, M) {
    const acc = [0];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      acc.push(acc[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = acc[poly.length], out = [];
    let seg = 0;
    for (let m = 0; m < M; m++) {
      const at = (m / M) * total;
      while (acc[seg + 1] < at) seg++;
      const a = poly[seg], b = poly[(seg + 1) % poly.length];
      const t = (at - acc[seg]) / Math.max(1e-9, acc[seg + 1] - acc[seg]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    return out;
  }
  // el mismo contorno, corrido hacia adentro una distancia fija
  function inset(poly, dist, centre) {
    return poly.map((p, i) => {
      const a = poly[(i - 1 + poly.length) % poly.length], b = poly[(i + 1) % poly.length];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      if (nx * (centre[0] - p[0]) + ny * (centre[1] - p[1]) < 0) { nx = -nx; ny = -ny; }
      return [p[0] + nx * dist, p[1] + ny * dist];
    });
  }

  /* El corazón de cada disco, dibujado para este sitio en una caja de 100 unidades:
     un aro rosa y, adentro, una figura sin simetría de giro para que se vea que
     da vueltas: a la izquierda un prisma (triángulo con el haz que se abre), a la
     derecha un casco de perfil: cúpula, visera en punta sobre un visor oscuro,
     auricular redondo y mentón recto. Va por detrás del disco: se asoma por el
     hueco de la «O» y sus extremos quedan tapados por los bordes. Lo marcado como
     vinyl__detail (pliegue, reflejo, rejilla) solo se dibuja cuando el disco es grande. */
  const RING = '<circle class="vinyl__ring" r="47"/>';
  const LABELS = [
    RING + '<g class="vinyl__icon"><path class="vinyl__mark" d="M0-30 26 15H-26Z"/><path class="vinyl__cut" d="M0-18 15.6 9H-15.6Z"/><path class="vinyl__mark" d="M-7.8-4.5 6.2-7.2 12.5 3.6Z"/></g>',
    RING + '<g class="vinyl__icon">' +
      // silueta: cúpula, visera en punta, marco del visor y mentón
      '<path class="vinyl__mark" d="M-26.3 1.3A20.5 20.5 0 0 1 10.5-15.9L28.6-11.8 29.4-9.7 25.9-8.8 27.6 2.1 27 5.6 22.4 6.5V15.2L18.7 19.9-8.4 21.7-13.5 9.1Z"/>' +
      // pliegue entre la cúpula y la visera, que nace en la punta trasera del visor
      '<path class="vinyl__cut vinyl__detail" d="M10.1-16.3-18.6-7.7-10.3-7.8 15.2-15.2Z"/>' +
      // visor: una hoja oscura que apunta hacia el auricular, con un reflejo
      '<path class="vinyl__cut" d="M-18.6-7.7 23.6-8.4 25 1.8-7.4 4.4Z"/>' +
      '<path class="vinyl__mark vinyl__detail" d="M6-8.1 9-8.2 4.4 3.4 1.4 3.6Z"/>' +
      // rejilla del mentón
      '<path class="vinyl__cut vinyl__detail" d="M11.7 11.1 19.1 10.5V12.9L11.7 13.4Z"/>' +
      // auricular: un disco que sobresale del casco
      '<circle class="vinyl__cut" cx="-22.4" cy="7.3" r="9.9"/><circle class="vinyl__mark" cx="-22.4" cy="7.3" r="7.5"/><circle class="vinyl__cut" cx="-22.4" cy="7.3" r="2.7"/></g>',
  ];
  const LABEL_RATIO = 0.22; // la etiqueta da una vuelta cada ~8 s cuando el disco va a 33⅓
  const glintRnd = seeded(7);
  let sheens = 0;
  const instances = $$('.wordmark svg', hero).map(svg => {
    const [, , W, H] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const paths = $$('path.lg-o', svg);
    if (paths.length < 2) return null;
    svg.classList.add('has-vinyl');
    const sheen = 'lg-sheen-' + (sheens++);
    const grad = el('linearGradient', { id: sheen, x1: 0, y1: 0, x2: 1, y2: 1 });
    [['0', '#2b2b2b'], ['0.42', '#0f0f0f'], ['0.62', '#0f0f0f'], ['1', '#232323']].forEach(([offset, colour]) => grad.appendChild(el('stop', { offset, 'stop-color': colour })));
    svg.insertBefore(grad, svg.firstChild);
    const stackedLogo = !!svg.closest('.wordmark--stacked');
    // la bandeja de la bienvenida: dos platos redondos centrados en el logo
    const cx = W / 2, cy = H / 2;
    const R = Math.min(H * 0.62, W * 0.155); // puede salirse del alto del logo: el SVG no recorta
    const sep = R * 1.62;
    const rig = buildRig(cx, cy, sep, R);
    svg.insertBefore(rig, svg.firstChild);

    const platters = paths.map((path, n) => {
      const exact = path.getAttribute('d');
      const cut = exact.indexOf('M', 1);
      const [outer, inner] = flatten(exact);
      // marco de la «O»: centro, medio ancho (a) y medio alto (b) una vez quitada la inclinación
      const ys = outer.map(p => p[1]);
      const oy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const b = (Math.max(...ys) - Math.min(...ys)) / 2;
      const us = outer.map(p => p[0] + SLANT * (p[1] - oy));
      const ox = (Math.min(...us) + Math.max(...us)) / 2;
      const a = (Math.max(...us) - Math.min(...us)) / 2;
      const straighten = poly => poly.map(p => [(p[0] - ox + SLANT * (p[1] - oy)) / a, (p[1] - oy) / b]);
      const g = el('g', { class: 'vinyl', 'data-vinyl': decks[n].id });
      const body = el('path', { class: 'vinyl__body', 'fill-rule': 'evenodd' });
      body.style.fill = `url(#${sheen})`;
      // surcos paralelos al borde: se calculan sobre la «O» real y se guardan como dirección + radio,
      // así acompañan la transformación desde el plato redondo
      const rim = resample(outer, 180);
      // hacia dónde está dibujado el contorno: los destellos tienen que avanzar en sentido horario,
      // igual que gira el disco (con la y hacia abajo, área positiva = horario)
      let area = 0;
      for (let i = 0; i < rim.length; i++) { const p0 = rim[i], p1 = rim[(i + 1) % rim.length]; area += p0[0] * p1[1] - p1[0] * p0[1]; }
      const turn = area > 0 ? 1 : -1;
      const grooveData = GROOVE_INSETS.map((frac, i) => {
        const pts = straighten(inset(rim, frac * a, [ox, oy]));
        const rho = pts.map(p => Math.hypot(p[0], p[1]));
        return { dirs: pts.map((p, m) => [p[0] / rho[m], p[1] / rho[m]]), rho, round: GROOVE_ROUND[i] };
      });
      const grooves = grooveData.map((_, i) => el('path', { class: 'vinyl__groove' + (i === 1 ? ' vinyl__groove--mid' : '') }));
      // un destello por surco, repartidos en la vuelta: al recorrerlos se ve el giro
      const glints = grooveData.map((_, i) => {
        const len = 120 + glintRnd() * 70;
        const node = el('path', { class: 'vinyl__glint' + (i === 1 ? ' vinyl__glint--mid' : ''), pathLength: 1000, 'stroke-dasharray': `${len.toFixed(0)} ${(1000 - len).toFixed(0)}` });
        return { node, phase: i * 333 + glintRnd() * 120, groove: i };
      });
      const edgeOut = el('path', { class: 'vinyl__edge' });
      const edgeIn = el('path', { class: 'vinyl__edge vinyl__edge--in' });
      const label = el('g', { class: 'vinyl__label' });
      label.innerHTML = LABELS[n];
      const labelScale = (a * (stackedLogo ? 0.63 : 0.5)) / 50; // el aro queda apenas más ancho que el hueco de la «O»; en el logo apilado, un poco más
      // en el logo apilado (celular) la figura va más grande dentro del mismo aro;
      // el casco, que es más ancho que alto, crece un poco menos para que no se pierda detrás de los bordes
      if (stackedLogo) label.querySelector('.vinyl__icon').setAttribute('transform', `scale(${n ? 1.15 : 1.28})`);
      const hit = el('path', { class: 'vinyl__hit' });
      g.append(label, body, ...grooves, ...glints.map(x => x.node), edgeOut, edgeIn, hit);
      path.replaceWith(g);
      return {
        deck: decks[n], g, body, grooves, grooveData, glints, turn, edgeOut, edgeIn, label, labelScale, cx: 0, cy: 0, hit, f: null, dOut: '',
        exact, exactOuter: exact.slice(0, cut), exactInner: exact.slice(cut),
        rhoO: radial(straighten(outer)), rhoI: radial(straighten(inner)),
        frame: { x: ox, y: oy, a, b, k: SLANT },
        start: { x: cx + (n ? sep : -sep), y: cy, a: R, b: R, k: 0 },
      };
    });
    return { svg, platters, W, scale: 0 };
  }).filter(Boolean);
  if (!instances.length) return;
  root.classList.add('has-console'); // desde acá la pantalla y los controles existen y se pueden medir

  function buildRig(cx, cy, sep, R) {
    const g = el('g', { class: 'rig' });
    const add = (name, attrs) => g.appendChild(el(name, attrs));
    const half = sep + R + R * 0.34;
    add('rect', { x: cx - half, y: cy - R * 1.2, width: half * 2, height: R * 2.4, rx: R * 0.16 });
    [-1, 1].forEach(side => {
      const px = cx + side * sep;
      add('circle', { cx: px, cy, r: R * 1.07 });
      // brazo
      add('circle', { cx: px + R * 0.86, cy: cy - R * 0.9, r: R * 0.07 });
      add('path', { d: `M${px + R * 0.86} ${cy - R * 0.9}L${px + R * 0.62} ${cy - R * 0.2}l${-R * 0.1} ${R * 0.12}` });
    });
    // mezclador entre los dos platos
    const m = Math.max(R * 0.12, sep - R * 1.2);
    add('path', { d: `M${cx - m * 0.5} ${cy - R * 0.62}V${cy + R * 0.3}M${cx + m * 0.5} ${cy - R * 0.62}V${cy + R * 0.3}M${cx - m} ${cy + R * 0.72}H${cx + m}` });
    add('rect', { x: cx - m * 0.5 - R * 0.07, y: cy - R * 0.3, width: R * 0.14, height: R * 0.1 });
    add('rect', { x: cx + m * 0.5 - R * 0.07, y: cy - R * 0.05, width: R * 0.14, height: R * 0.1 });
    add('rect', { x: cx - R * 0.05, y: cy + R * 0.65, width: R * 0.1, height: R * 0.14 });
    [-1, 0, 1].forEach(i => add('circle', { cx: cx + i * m * 0.8, cy: cy - R * 0.88, r: R * 0.06 }));
    return g;
  }

  // m = 0: platos redondos en la bandeja · m = 1: las «O» en su lugar
  let morph = 1;
  function shape(m) {
    morph = m;
    const e = m * m * (3 - 2 * m);
    instances.forEach(inst => inst.platters.forEach(p => {
      const s = p.start, t = p.frame;
      // el marco pasa de círculo (plato) a paralelogramo («O») y el contorno, de redondo a cuadrado redondeado
      const f = { x: s.x + (t.x - s.x) * e, y: s.y + (t.y - s.y) * e, a: s.a + (t.a - s.a) * e, b: s.b + (t.b - s.b) * e, k: t.k * e };
      const out = p.rhoO.map(v => 1 + (v - 1) * e);
      const inn = p.rhoI.map(v => 0.36 + (v - 0.36) * e);
      const settled = m >= 1;
      const dOut = settled ? p.exactOuter : ringPath(f, out);
      const dIn = settled ? p.exactInner : ringPath(f, inn);
      p.body.setAttribute('d', settled ? p.exact : dOut + dIn);
      p.edgeOut.setAttribute('d', dOut);
      p.edgeIn.setAttribute('d', dIn);
      p.f = f;
      p.dOut = dOut;
      const rings = p.grooveData.map(gr => ringOf(f, gr.dirs, gr.rho.map(v => gr.round + (v - gr.round) * e)));
      p.grooves.forEach((node, i) => node.setAttribute('d', rings[i]));
      p.glints.forEach(x => x.node.setAttribute('d', rings[x.groove]));
      p.cx = f.x;
      p.cy = f.y;
    }));
    zones();
  }

  /* ---------- dónde se agarra cada disco ----------
     Con mouse, el contorno exacto. En una pantalla táctil la «O» puede ser más
     angosta que la yema del dedo, así que alrededor se le suma un margen que
     no se ve: lo que le falte para ofrecer REACH.w × REACH.h a cada lado del
     centro. Entre los dos discos el espacio se reparte por la mitad, así cada
     toque va al disco que tiene más cerca. */
  const touchy = matchMedia('(any-pointer: coarse)');
  const REACH = { w: 52, h: 82, min: 6, maxW: 34, maxH: 26 }; // en píxeles de pantalla
  function zones() {
    instances.forEach(inst => {
      const s = inst.scale; // píxeles por unidad del dibujo; 0 con mouse o si este logo no se ve
      const [left, right] = inst.platters;
      inst.platters.forEach((p, n) => {
        const f = p.f;
        if (!f) return;
        if (!s) { p.hit.setAttribute('d', p.dOut); return; }
        const hw = f.a + clamp(REACH.w / s - f.a, REACH.min / s, REACH.maxW / s);
        const hh = f.b + clamp(REACH.h / s - f.b, REACH.min / s, REACH.maxH / s);
        const mid = (left.f.x + right.f.x) / 2 - f.x; // la mitad del camino hacia el otro disco
        const x0 = n ? Math.max(-hw, mid) : -hw, x1 = n ? hw : Math.min(hw, mid);
        // un rectángulo de puntas redondas, recortado en esa mitad e inclinado igual que la «O»
        const r = Math.min(hw, hh) * 0.6;
        let path = '';
        [[1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(([sx, sy], corner) => {
          for (let i = 0; i <= 6; i++) {
            const a = (corner * 90 - 90 + i * 15) * Math.PI / 180;
            const x = clamp(sx * (hw - r) + r * Math.cos(a), x0, x1), y = sy * (hh - r) + r * Math.sin(a);
            path += (path ? 'L' : 'M') + (f.x + x - f.k * y).toFixed(1) + ' ' + (f.y + y).toFixed(1);
          }
        });
        p.hit.setAttribute('d', path + 'Z');
      });
    });
  }
  // el margen se mide en píxeles: hay que rehacerlo cada vez que el logo cambia de tamaño (o se muestra el otro)
  const measure = () => {
    instances.forEach(inst => { inst.scale = touchy.matches ? inst.svg.getBoundingClientRect().width / inst.W : 0; });
    zones();
  };
  if ('ResizeObserver' in window) {
    const watcher = new ResizeObserver(measure);
    instances.forEach(inst => watcher.observe(inst.svg));
  } else addEventListener('resize', measure);
  if (touchy.addEventListener) touchy.addEventListener('change', measure);

  /* ---------- scratch: el disco sigue a la mano ----------
     Cómo se traduce el movimiento de la mano en giro está en site.js («La mano
     sobre un disco»). Con el dedo, y mientras la «O» sea angosta, se la lleva
     de la manija. */
  const hand = window.lgHand;
  const SMALL = 36; // medio ancho en píxeles: por debajo de esto, un dedo no distingue un lado del disco del otro
  instances.forEach(inst => inst.platters.forEach(p => {
    const k = p.deck;
    p.hit.addEventListener('pointerdown', e => {
      if (e.button) return;
      const m = inst.svg.getScreenCTM();
      if (!m) return;
      const handle = e.pointerType === 'touch' && p.frame.a * Math.hypot(m.a, m.b) < SMALL;
      k.grip = hand.grab(m.a * p.cx + m.c * p.cy + m.e, m.b * p.cx + m.d * p.cy + m.f, e.clientX, e.clientY, handle ? hand.LEVER : 0);
      k.finger = e.pointerId; // si se apoya otro dedo, el disco pasa a ese: el anterior deja de moverlo
      k.held = true;
      k.push = 0;
      k.moved = performance.now();
      p.g.classList.add('is-held');
      p.hit.setPointerCapture(e.pointerId);
    });
    p.hit.addEventListener('pointermove', e => {
      if (!k.held || e.pointerId !== k.finger) return;
      const delta = hand.move(k.grip, e.clientX, e.clientY);
      if (!delta) return;
      k.rot += delta;
      k.spin += delta;
      k.travel += delta;
      const now = performance.now();
      k.push = k.push * 0.6 + (delta / Math.max(8, now - k.moved) * 1000) * 0.4;
      k.moved = now;
    });
    const release = e => {
      if (!k.held || e.pointerId !== k.finger) return;
      k.held = false;
      k.omega = clamp(k.push, -1400, 1400);
      p.g.classList.remove('is-held');
    };
    p.hit.addEventListener('pointerup', release);
    p.hit.addEventListener('pointercancel', release);
    p.hit.addEventListener('lostpointercapture', release);
    // el dedo que arranca sobre un disco es del disco: la página no lo toma como desplazamiento
    // (lo pide también touch-action en el CSS; esto es para los navegadores que no lo aplican a un SVG)
    ['touchstart', 'touchmove'].forEach(type => p.hit.addEventListener(type, e => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
  }));

  /* ---------- pantalla: una pista y un vúmetro por disco ---------- */
  const LEDS = 12;
  const lanes = decks.map(k => {
    const lane = $(`[data-lane="${k.id}"]`, hero);
    if (!lane) return null;
    const canvas = $('canvas', lane);
    const leds = $('.leds', lane);
    for (let i = 0; i < LEDS; i++) leds.appendChild(d.createElement('i'));
    return { lane, canvas, ctx: canvas.getContext('2d'), leds: [...leds.children], lit: -1, w: 0, h: 0, dpr: 1 };
  });
  const fit = () => lanes.forEach(l => {
    if (!l) return;
    l.dpr = Math.min(2, window.devicePixelRatio || 1);
    l.w = Math.max(1, Math.round(l.canvas.clientWidth * l.dpr));
    l.h = Math.max(1, Math.round(l.canvas.clientHeight * l.dpr));
    l.canvas.width = l.w;
    l.canvas.height = l.h;
  });
  fit();
  addEventListener('resize', fit);
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(hero);

  /* ==========================================================================
     Audio
     Un disco suena de verdad si su pista del HTML trae data-audio="ruta" (y, si
     se conoce, data-bpm). El audio sigue al plato: toma velocidad con él, baja
     de tono cuando se frena y se pausa si se lo sostiene; al girarlo con la
     mano, la pista se mueve con él y sigue desde ahí. Mientras suena, es el
     audio quien lleva el tiempo, así la onda y el vúmetro van clavados.
     ========================================================================== */
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null; // salida general: sobre ella actúa el botón de silenciar
  let muted = false;

  function peaks(pcm, bin) { // un valor por barra de la onda, normalizado
    const n = Math.max(1, Math.floor(pcm.duration / bin));
    const out = new Float32Array(n);
    const chans = [];
    for (let c = 0; c < pcm.numberOfChannels; c++) chans.push(pcm.getChannelData(c));
    const size = pcm.sampleRate * bin;
    let top = 0;
    for (let i = 0; i < n; i++) {
      const to = Math.min(pcm.length, Math.floor((i + 1) * size));
      let peak = 0;
      for (let s = Math.floor(i * size); s < to; s += 6) {
        let v = 0;
        for (const data of chans) v += Math.abs(data[s]);
        if (v > peak) peak = v;
      }
      out[i] = peak;
      if (peak > top) top = peak;
    }
    if (top > 0) for (let i = 0; i < n; i++) out[i] = Math.pow(out[i] / top, 1.5);
    return out;
  }

  // tempo aproximado de una pista: se buscan los golpes graves (el bombo) y cada cuánto se repiten.
  // Un pulso verdadero se repite también cada 2 y cada 4 tiempos; eso descarta los ritmos intermedios.
  function tempo(pcm) {
    const sr = pcm.sampleRate, hopSec = 0.005, hop = Math.round(sr * hopSec);
    const data = pcm.getChannelData(0);
    const from = Math.floor(pcm.length * 0.2), to = Math.min(pcm.length, from + sr * 150);
    const n = Math.floor((to - from) / hop);
    if (n < 4000) return 0;
    const onset = new Float32Array(n);
    let low = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      let energy = 0;
      for (let s = 0; s < hop; s++) { low += 0.02 * (data[from + i * hop + s] - low); energy += low * low; }
      const level = Math.sqrt(energy / hop);
      onset[i] = Math.max(0, level - prev);
      prev = level;
    }
    const first = Math.round(60 / 150 / hopSec), lastLag = Math.round(60 / 95 / hopSec); // entre 150 y 95 BPM
    const ac = new Float32Array(lastLag * 4 + 4);
    for (let lag = first - 2; lag < ac.length; lag++) {
      let sum = 0;
      for (let i = 0; i + lag < n; i++) sum += onset[i] * onset[i + lag];
      ac[lag] = sum / (n - lag);
    }
    const near = at => { let best = at; for (let l = at - 2; l <= at + 2; l++) if (ac[l] > ac[best]) best = l; return best; };
    let bestLag = 0, bestScore = 0;
    for (let lag = first; lag <= lastLag; lag++) {
      const score = ac[lag] + 0.7 * ac[near(lag * 2)] + 0.5 * ac[near(lag * 4)];
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }
    if (!bestLag) return 0;
    // el período se afina sobre la repetición a 4 tiempos, que tiene cuatro veces más resolución
    const four = near(near(bestLag * 2) * 2);
    const a = ac[four - 1], b = ac[four], c = ac[four + 1];
    const fine = four + (a - c) / (2 * (a - 2 * b + c) || 1);
    return 60 / (fine / 4 * hopSec);
  }
  // el disco B se acomoda al tempo del A, como con el pitch de una bandeja, para que la mezcla no choque
  const matchTempo = () => {
    const a = decks[0].audio, b = decks[1].audio;
    if (!a || !b || !a.bpm || !b.bpm) return;
    const ratio = a.bpm / b.bpm;
    b.sync = ratio > 0.9 && ratio < 1.1 ? ratio : 1;
  };
  // el cartel de tempo de la consola muestra el del disco que más se escucha
  const clock = $('.console__clock', hero);
  const showTempo = () => {
    if (!clock) return;
    const live = decks.filter(k => k.audio && k.audio.bpm).sort((x, y) => y.mix - x.mix)[0];
    clock.textContent = `${Math.round(live ? live.audio.bpm * (live.audio.sync || 1) : BPM)} BPM · 4/4`;
  };

  decks.forEach((k, n) => {
    k.bin = STEP; // segundos por barra de la onda
    k.spin = n ? 0 : -12; // ángulo de la etiqueta del centro
    k.mix = 0.5;
    k.audio = null;
    const lane = lanes[n] && lanes[n].lane;
    const src = lane && lane.dataset.audio;
    if (!src) return;
    const node = new Audio();
    node.preload = 'metadata'; // el archivo completo se pide recién cuando el visitante entra
    node.loop = true;
    node.preservesPitch = false; // que el tono acompañe a la velocidad, como en un plato
    node.mozPreservesPitch = false;
    node.webkitPreservesPitch = false;
    node.src = src;
    const audio = k.audio = { node, gain: null, analyser: null, buf: null, forced: 0, starting: false, live: false, retry: 0, bpm: parseFloat(lane.dataset.bpm) || 0, load: null };
    k.bin = 60 / (audio.bpm || BPM) / 4;
    k.home = 0;
    k.travel = 0;
    k.track = new Float32Array(64); // plana hasta tener la onda
    // si el archivo no está o el navegador no lo puede leer, este disco deja de contar como música
    node.addEventListener('error', () => {
      if (k.audio !== audio) return;
      k.audio = null;
      delete lane.dataset.tempo;
      lane.dataset.wave = 'none';
      settle();
    });
    const show = (bpm, bin, track, from) => {
      if (k.audio !== audio) return;
      audio.bpm = bpm;
      k.bin = bin;
      k.track = track;
      lane.dataset.tempo = bpm.toFixed(1); // quedan a la vista en el HTML, por si hace falta revisarlos
      lane.dataset.wave = from;
      matchTempo();
      showTempo();
    };
    /* La onda de la pantalla y el tempo. Primero se busca el análisis ya hecho: un .json liviano
       junto al audio, con el mismo nombre ({ bpm, bin, peaks: [0–255…] }). Así un celular no tiene
       que bajar y decodificar la canción entera solo para dibujarla. Si ese archivo no está, se
       calcula acá leyendo el audio completo, recién cuando el visitante entra. */
    const ready = !window.fetch ? Promise.resolve(false) : fetch(src.replace(/\.\w+$/, '.json'))
      .then(r => { if (!r.ok) throw new Error('sin análisis'); return r.json(); })
      .then(data => {
        if (!(data.bpm > 0) || !(data.bin > 0) || !Array.isArray(data.peaks) || !data.peaks.length) throw new Error('análisis inválido');
        show(audio.bpm || data.bpm, data.bin, Float32Array.from(data.peaks, v => v / 255), 'json');
        return true;
      })
      .catch(() => false);
    const decode = () => {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Offline || !window.fetch) return;
      fetch(src)
        .then(r => { if (!r.ok) throw new Error('audio ' + r.status); return r.arrayBuffer(); })
        .then(buf => new Promise((ok, fail) => {
          const pending = new Offline(1, 2, 44100).decodeAudioData(buf, ok, fail);
          if (pending && pending.catch) pending.catch(() => { /* ya lo atiende fail */ });
        }))
        .then(pcm => {
          const bpm = audio.bpm || tempo(pcm) || BPM;
          show(bpm, 60 / bpm / 4, peaks(pcm, 60 / bpm / 4), 'audio');
        })
        .catch(() => { /* sin onda: la pista suena igual y su pantalla queda plana */ });
    };
    audio.load = () => {
      audio.load = null;
      ready.then(done => { if (!done) decode(); });
    };
  });
  /* Qué muestra un disco sin audio: si el otro tiene música, queda en silencio también en pantalla;
     si no la tiene ninguno, vuelven las pistas generadas y la consola sigue viva, sin sonido. */
  function settle() {
    const some = decks.some(k => k.audio);
    root.classList.toggle('no-audio', !some);
    decks.forEach(k => {
      if (k.audio) return;
      k.bin = STEP;
      if (some) k.track = new Float32Array(64);
      else if (k.track !== k.generated) {
        k.track = k.generated;
        k.home = k.generated.start / STEPS_PER_DEG;
        k.travel = k.home;
      }
    });
    showTempo();
  }
  settle();

  // el grafo de audio se arma dentro de un gesto del usuario (lo piden los navegadores)
  const wire = () => {
    if (!AudioCtx) return;
    if (!ctx) {
      try { ctx = new AudioCtx(); } catch (_) { return; }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      decks.forEach(k => {
        const a = k.audio;
        if (!a) return;
        const source = ctx.createMediaElementSource(a.node);
        a.gain = ctx.createGain();
        a.analyser = ctx.createAnalyser();
        a.analyser.fftSize = 512;
        a.buf = new Uint8Array(a.analyser.fftSize);
        source.connect(a.gain);
        a.gain.connect(a.analyser);
        a.analyser.connect(master); // el vúmetro mide antes del silenciador: sigue marcando aunque no se oiga
        a.node.volume = 1; // desde acá el volumen lo maneja la ganancia; el del reproductor queda al máximo
        a.node.muted = false;
      });
    }
    awake();
  };
  // el navegador puede dormir la salida de audio (pestaña en segundo plano, llamada entrante…)
  const awake = () => {
    if (!ctx || ctx.state === 'running') return;
    try { const p = ctx.resume(); if (p && p.catch) p.catch(() => { /* lo reintenta el próximo toque */ }); } catch (_) { /* ídem */ }
  };

  /* ---------- silenciar ----------
     Corta la salida general. Los discos, la onda y los vúmetros siguen andando:
     la música no se detiene, solo deja de oírse. */
  const muteButton = $('[data-mute]');
  const setMuted = next => {
    muted = next;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.012); // rampa corta, sin chasquido
    decks.forEach(k => { if (k.audio && !k.audio.gain) k.audio.node.muted = muted; });
    root.classList.toggle('is-muted', muted);
    if (muteButton) muteButton.setAttribute('aria-pressed', String(muted));
  };
  if (muteButton) muteButton.addEventListener('click', () => setMuted(!muted));

  /* Lleva el audio al punto de la pista que marca el plato. Si el archivo no deja saltar ahí
     (todavía no cargó, o el servidor no entrega tramos sueltos), sigue desde donde estaba en
     vez de volver al principio. */
  const cue = (a, seconds) => {
    const node = a.node, dur = node.duration;
    const t = dur > 0 && isFinite(dur) ? ((seconds % dur) + dur) % dur : Math.max(0, seconds);
    if (Math.abs(t - node.currentTime) < 0.1) return; // apoyar la mano y soltar no mueve la pista: retoma tal cual
    const ok = node.seekable;
    for (let i = 0; i < ok.length; i++) {
      if (t >= ok.start(i) - 0.01 && t <= ok.end(i) + 0.01) {
        try { node.currentTime = t; } catch (_) { /* todavía sin datos */ }
        return;
      }
    }
  };
  const meter = a => {
    if (!a.analyser) return 0.6; // sin Web Audio no se puede medir: nivel fijo mientras suena
    a.analyser.getByteTimeDomainData(a.buf);
    let peak = 0;
    for (let i = 0; i < a.buf.length; i++) {
      const v = Math.abs(a.buf[i] - 128);
      if (v > peak) peak = v;
    }
    return peak / 128;
  };
  // devuelve true mientras el disco está sonando
  function syncAudio(k, now) {
    const a = k.audio;
    if (!a) return false;
    if (a.gain) a.gain.gain.value = k.mix; else a.node.volume = clamp(k.mix, 0, 1);
    const rate = k.omega / SPIN;
    /* Suena cuando el plato ya tomó algo de velocidad (o recién se le dio play), nadie lo sostiene
       y está en la mezcla. Un disco que no se oye (crossfader del otro lado, volumen en cero) gira
       igual, pero no reproduce: no gasta datos y, al subirlo, entra en el punto que marca su plato. */
    const want = !k.held && k.mix > 0.004 && (rate > 0.25 || (transport === 'play' && now - a.forced < 450));
    if (!want) {
      if (!a.node.paused) a.node.pause();
      return false;
    }
    a.node.playbackRate = clamp(rate * (a.sync || 1), 0.25, 4);
    if (a.node.paused) {
      if (!a.starting && now >= a.retry) {
        cue(a, k.travel / SPIN);
        a.starting = true;
        const p = a.node.play();
        const ok = () => { a.starting = false; a.live = true; };
        const blocked = () => { a.starting = false; a.retry = performance.now() + 800; };
        if (p && p.then) p.then(ok, blocked); else ok();
      }
      return false;
    }
    k.travel = a.node.currentTime * SPIN; // mientras suena, el audio lleva el tiempo
    return true;
  }
  /* Llamado desde un clic o un toque: habilita el audio y arranca en el acto los discos que deban
     sonar. Con `only`, se limita a los discos que cumplan esa condición. */
  const prime = only => {
    wire();
    const now = performance.now();
    decks.forEach(k => {
      const a = k.audio;
      if (!a) return;
      if (a.load) a.load();
      if (k.held || (only && !only(k))) return;
      a.forced = now;
      a.retry = 0;
      syncAudio(k, now);
    });
  };

  function drawLane(l, k) {
    const { ctx, w, h, dpr } = l;
    ctx.clearRect(0, 0, w, h);
    const px = 5 * dpr, bar = 3 * dpr, mid = w / 2;
    const from = Math.floor(k.pos - mid / px) - 1, to = Math.ceil(k.pos + mid / px) + 1;
    const len = k.track.length;
    for (let i = from; i <= to; i++) {
      const a = k.track[((i % len) + len) % len];
      const bh = Math.max(dpr, a * h);
      ctx.fillStyle = i < k.pos ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)';
      ctx.fillRect(Math.round(mid + (i - k.pos) * px), Math.round((h - bh) / 2), bar, Math.round(bh));
    }
    ctx.fillStyle = '#ff4d97'; // la púa
    ctx.fillRect(Math.round(mid - dpr), 0, Math.max(1, Math.round(dpr)), h);
  }

  /* ---------- un cuadro ---------- */
  const beatDot = $('.top .beat');
  let heroVisible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  // la bienvenida avanza cuadro a cuadro: si la pestaña está en segundo plano, espera
  const intro = { t: 0, from: -1, done: true };
  let last = performance.now();
  const frame = now => {
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    if (!intro.done) {
      intro.t += dt;
      if (intro.from < 0 && intro.t > 1.1) { intro.from = intro.t; root.classList.add('is-forming'); }
      if (intro.from >= 0) {
        const m = clamp((intro.t - intro.from) / 1.9, 0, 1);
        shape(m);
        if (m >= 1) { intro.done = true; root.classList.add('is-ready'); }
      }
    }
    const gains = [Math.cos(xfade * Math.PI / 2), Math.sin(xfade * Math.PI / 2)];
    let pulse = 0;
    decks.forEach((k, n) => {
      const target = !k.held && transport === 'play' ? SPIN : 0;
      // con la mano encima se clava; al dar play toma velocidad; stop lo deja caer como un plato que se apaga
      const tau = k.held ? 0.05 : transport === 'play' ? 0.35 : transport === 'pause' ? 0.16 : 0.75;
      k.omega += (target - k.omega) * (1 - Math.exp(-dt / tau));
      k.rot += k.omega * dt;
      k.spin += k.omega * dt * LABEL_RATIO;
      k.travel += k.omega * dt;
      // en pausa derivan apenas hacia la derecha: se ve, pero la pista no avanza
      if (transport === 'pause' && !k.held && !reduce) { k.rot += 10 * dt; k.spin += 6 * dt; }
      if (k.held && now - k.moved > 90) k.push = 0;
      if (k.rewind && !k.held && Math.abs(k.omega) < 1.5) { k.travel = k.home; k.rewind = false; }
      k.mix = k.vol * gains[n];
      const sounding = syncAudio(k, now);
      k.pos = k.travel / SPIN / k.bin;
      k.level *= Math.exp(-dt / 0.17);
      if (k.audio) {
        // con audio real, el vúmetro lee lo que está sonando (ya con volumen y crossfader)
        if (sounding) k.level = Math.max(k.level, meter(k.audio));
        k.out = k.level * 1.3; // con el volumen al máximo, los picos llegan al rojo
      } else {
        const step = Math.floor(k.pos);
        if (step !== k.step) {
          k.step = step;
          const len = k.track.length;
          const speed = Math.abs(k.held ? k.push : k.omega) / SPIN;
          k.level = Math.max(k.level, k.track[((step % len) + len) % len] * clamp(speed, 0, 1.25));
        }
        k.out = k.level * k.mix * 1.35; // con el volumen arriba, el bombo llega al rojo
      }
      pulse = Math.max(pulse, k.out);
    });

    if (heroVisible) {
      instances.forEach(inst => {
        if (!inst.svg.getClientRects().length) return;
        inst.platters.forEach(p => {
          const frac = (((p.deck.rot / 360) % 1) + 1) % 1;
          p.glints.forEach(x => x.node.setAttribute('stroke-dashoffset', (-(x.phase + p.turn * frac * 1000)).toFixed(1)));
          p.label.setAttribute('transform', `translate(${p.cx.toFixed(1)} ${p.cy.toFixed(1)}) rotate(${(p.deck.spin % 360).toFixed(1)}) scale(${p.labelScale.toFixed(3)})`);
        });
      });
      lanes.forEach((l, n) => {
        if (!l) return;
        const k = decks[n];
        drawLane(l, k);
        const lit = Math.round(clamp(k.out, 0, 1) * LEDS);
        if (lit !== l.lit) {
          l.lit = lit;
          l.leds.forEach((node, i) => node.classList.toggle('is-on', i < lit));
        }
        l.lane.style.opacity = (0.4 + 0.6 * clamp(gains[n] * 1.25, 0, 1)).toFixed(2);
      });
    }
    // el punto de la cabecera late con la mezcla: si se detiene la consola, el sitio deja de latir
    if (beatDot) {
      const v = clamp(pulse, 0, 1);
      beatDot.style.transform = `scale(${(0.7 + 0.6 * v).toFixed(3)})`;
      beatDot.style.opacity = (0.4 + 0.6 * v).toFixed(3);
    }
    requestAnimationFrame(frame);
  };

  /* ---------- controles ---------- */
  const buttons = $$('[data-act]', hero);
  const setTransport = next => {
    transport = next;
    if (next === 'stop') decks.forEach(k => { k.rewind = true; });
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.act === next)));
  };
  buttons.forEach(b => b.addEventListener('click', () => {
    setTransport(b.dataset.act);
    if (b.dataset.act === 'play') prime();
  }));
  $$('[data-vol]', hero).forEach(input => {
    const k = decks.find(x => x.id === input.dataset.vol);
    const read = () => { k.vol = input.value / 100; };
    input.addEventListener('input', read);
    read();
  });
  const cross = $('[data-xfade]', hero);
  if (cross) {
    const read = () => { xfade = cross.value / 100; showTempo(); };
    cross.addEventListener('input', read);
    read();
  }

  /* ==========================================================================
     Bienvenida: la bandeja se transforma en el logo y queda en pausa hasta que
     se entra al sitio con el botón de play.
     ========================================================================== */
  const welcome = root.classList.contains('is-welcome');
  const gated = [$('.top'), $('.hero__row', hero), $('[data-console]', hero), ...$$('main > :not([data-hero])'), $('.foot')].filter(Boolean);
  let entered = !welcome;

  const enter = () => {
    if (entered) return;
    entered = true;
    intro.done = true;
    shape(1);
    root.classList.add('is-forming', 'is-ready');
    root.classList.remove('is-welcome');
    root.classList.add('is-live');
    gated.forEach(node => { node.inert = false; });
    setTransport(reduce ? 'pause' : 'play'); // al entrar, los discos arrancan
    prime();
  };
  /* Los navegadores solo dejan arrancar un audio dentro de un gesto del visitante. Si alguno quedó
     sin arrancar (se entró con scroll, o el disco B se sumó a la mezcla más tarde), el próximo
     clic, toque o tecla lo destraba. Los que ya sonaron no se tocan. */
  const unlock = () => {
    awake();
    if (entered && transport === 'play') prime(k => !k.audio.live);
  };
  ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(type => addEventListener(type, unlock, { passive: true }));

  if (!welcome) {
    shape(1);
    root.classList.add('is-live');
    setTransport(reduce ? 'pause' : 'play');
  } else {
    gated.forEach(node => { node.inert = true; });
    setTransport('pause');
    if (reduce) {
      shape(1);
      root.classList.add('is-forming', 'is-ready');
    } else {
      shape(0);
      intro.done = false; // sigue en frame()
    }
    const button = $('[data-enter]', hero);
    if (button) button.addEventListener('click', enter);
    // nadie queda trabado en la bienvenida: scroll, flechas o Escape también entran
    addEventListener('wheel', e => { if (e.deltaY > 0) enter(); }, { passive: true });
    addEventListener('touchmove', enter, { passive: true });
    addEventListener('keydown', e => {
      if (entered) return;
      if (['ArrowDown', 'PageDown', 'End', 'Escape'].includes(e.key)) enter();
    });
  }

  // para revisar el estado de los discos desde la consola del navegador: agregar ?debug a la dirección
  if (/[?&]debug/.test(location.search)) {
    window.lgDecks = decks;
    window.lgAudio = () => ({ muted, gain: master ? master.gain.value : null, state: ctx ? ctx.state : null });
  }

  requestAnimationFrame(frame);
})();
