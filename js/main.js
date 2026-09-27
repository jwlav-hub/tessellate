/* ===========================
   Tessellate Gaming – main.js
   =========================== */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Nav: scroll state, mobile menu, active section ── */
  const nav = document.getElementById('siteNav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    mobileNav.classList.toggle('open', open);
    mobileNav.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => sectionObserver.observe(s));

  /* ── Reveal on scroll ── */
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();


  /* ══════════════════════════════
     HERO — tessellated mesh
     A triangular lattice whose vertices drift around their home
     positions; tiles shimmer on a slow wave and "order-flow" pulses
     travel along the edges.
  ══════════════════════════════ */
  const canvas = document.getElementById('mesh-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, pts = [], tris = [], edges = [], pulses = [];
    let running = false, rafId = 0;

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const s = W < 720 ? 72 : 96;               // lattice spacing
      const h = s * Math.sqrt(3) / 2;
      cols = Math.ceil(W / s) + 3;
      rows = Math.ceil(H / h) + 3;
      pts = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const hx = (i - 1) * s + (j % 2 ? s / 2 : 0);
          const hy = (j - 1) * h;
          pts.push({
            hx, hy, x: hx, y: hy,
            ax: 4 + Math.random() * 10, ay: 4 + Math.random() * 10,
            ph: Math.random() * Math.PI * 2, sp: 0.00025 + Math.random() * 0.0003,
            glow: Math.random() < 0.05
          });
        }
      }
      const P = (i, j) => j * cols + i;
      tris = []; const edgeSet = new Set(); edges = [];
      const addEdge = (a, b) => {
        const k = a < b ? a + ':' + b : b + ':' + a;
        if (!edgeSet.has(k)) { edgeSet.add(k); edges.push([a, b]); }
      };
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          let t1, t2;
          if (j % 2 === 0) {
            t1 = [P(i, j), P(i + 1, j), P(i, j + 1)];
            t2 = [P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
          } else {
            t1 = [P(i, j), P(i + 1, j), P(i + 1, j + 1)];
            t2 = [P(i, j), P(i + 1, j + 1), P(i, j + 1)];
          }
          [t1, t2].forEach(t => {
            tris.push({ v: t, seed: Math.random() * 1000, hot: Math.random() < 0.06 });
            addEdge(t[0], t[1]); addEdge(t[1], t[2]); addEdge(t[2], t[0]);
          });
        }
      }
      // adjacency for pulse routing
      pts.forEach(p => { p.nb = []; });
      edges.forEach(([a, b]) => { pts[a].nb.push(b); pts[b].nb.push(a); });
      pulses = [];
      const n = W < 720 ? 4 : 8;
      for (let k = 0; k < n; k++) pulses.push(newPulse());
    };

    const newPulse = () => {
      const a = Math.floor(Math.random() * pts.length);
      const nb = pts[a].nb;
      return { a, b: nb[Math.floor(Math.random() * nb.length)], t: Math.random(), speed: 0.006 + Math.random() * 0.008, hops: 4 + Math.floor(Math.random() * 8) };
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, W, H);

      for (const p of pts) {
        p.x = p.hx + Math.cos(time * p.sp + p.ph) * p.ax;
        p.y = p.hy + Math.sin(time * p.sp * 1.3 + p.ph) * p.ay;
      }

      // tiles
      for (const t of tris) {
        const a = pts[t.v[0]], b = pts[t.v[1]], c = pts[t.v[2]];
        const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
        const wave = Math.sin(time * 0.00035 + cx * 0.0045 - cy * 0.003 + t.seed * 0.002);
        let alpha = Math.max(0, wave) * 0.045;
        if (t.hot) alpha += (Math.sin(time * 0.0012 + t.seed) * 0.5 + 0.5) * 0.07;
        if (alpha < 0.004) continue;
        ctx.fillStyle = t.hot ? `rgba(55,182,195,${alpha})` : `rgba(62,155,224,${alpha})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); ctx.fill();
      }

      // edges
      ctx.strokeStyle = 'rgba(159,176,199,0.075)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [ai, bi] of edges) { const a = pts[ai], b = pts[bi]; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();

      // vertices
      for (const p of pts) {
        if (p.glow) {
          const g = Math.sin(time * 0.0015 + p.ph) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(79,163,199,${0.35 + g * 0.55})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(79,163,199,${0.06 + g * 0.08})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(159,176,199,0.22)';
          ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
        }
      }

      // order-flow pulses
      for (let k = 0; k < pulses.length; k++) {
        const pl = pulses[k];
        const a = pts[pl.a], b = pts[pl.b];
        const x = a.x + (b.x - a.x) * pl.t, y = a.y + (b.y - a.y) * pl.t;
        const tx = a.x + (b.x - a.x) * Math.max(0, pl.t - 0.35), ty = a.y + (b.y - a.y) * Math.max(0, pl.t - 0.35);
        const grad = ctx.createLinearGradient(tx, ty, x, y);
        grad.addColorStop(0, 'rgba(62,155,224,0)');
        grad.addColorStop(1, 'rgba(140,203,240,0.75)');
        ctx.strokeStyle = grad; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = 'rgba(200,232,250,0.9)';
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();

        if (!reduceMotion) pl.t += pl.speed;
        if (pl.t >= 1) {
          pl.hops--;
          if (pl.hops <= 0) { pulses[k] = newPulse(); pulses[k].t = 0; continue; }
          const nb = pts[pl.b].nb.filter(n => n !== pl.a);
          pl.a = pl.b; pl.b = nb[Math.floor(Math.random() * nb.length)]; pl.t = 0;
        }
      }
    };

    const loop = (time) => {
      draw(time);
      if (running) rafId = requestAnimationFrame(loop);
    };
    const start = () => { if (!running && !reduceMotion) { running = true; rafId = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(rafId); };

    build();
    draw(0);
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { const w = canvas.clientWidth; if (Math.abs(w - W) > 1 || Math.abs(canvas.clientHeight - H) > 120) { build(); draw(performance.now()); } }, 150);
    });
  }


  /* ══════════════════════════════
     SOLUTION — illustrative console
  ══════════════════════════════ */
  const rowsEl = document.getElementById('consoleRows');
  if (rowsEl) {
    const markets = [
      { mkt: 'Football', sub: 'In-play · Q3 04:12', sel: 'Home −3.5', price: -108, exp: 0.22 },
      { mkt: 'Basketball', sub: 'In-play · 1H', sel: 'Total o221.5', price: -112, exp: -0.14 },
      { mkt: 'Same-game parlay', sub: '4 legs · correlated', sel: 'Home ML + 3 props', price: 412, exp: 0.36 },
      { mkt: 'Player prop', sub: 'Pre-match', sel: 'Points o27.5', price: -115, exp: 0.08 },
      { mkt: 'Soccer', sub: "In-play · 67'", sel: 'Draw', price: 245, exp: -0.27 }
    ];

    const fmt = p => (p > 0 ? '+' : '−') + Math.abs(p);
    rowsEl.innerHTML = markets.map((m, i) => `
      <tr>
        <td class="c-mkt">${m.mkt}<small>${m.sub}</small></td>
        <td>${m.sel}</td>
        <td class="c-price" data-i="${i}">${fmt(m.price)}</td>
        <td class="c-exp"><div class="exp-bar"><i data-i="${i}"></i></div></td>
      </tr>`).join('');

    const priceEls = rowsEl.querySelectorAll('.c-price');
    const barEls = rowsEl.querySelectorAll('.exp-bar i');
    const netEl = document.getElementById('netExposure');
    const logEl = document.getElementById('consoleLog');
    const mtmEl = document.getElementById('consoleMtm');
    const stressEl = document.getElementById('consoleStress');
    const budgetEl = document.getElementById('consoleBudget');
    const budgetBar = document.getElementById('consoleBudgetBar');
    const money = v => (v >= 0 ? '+' : '−') + '$' + Math.abs(v).toLocaleString('en-US');
    let mtm = 38400;

    const renderBars = () => {
      let net = 0;
      markets.forEach((m, i) => {
        const w = Math.min(Math.abs(m.exp), 0.5) * 100;
        barEls[i].style.width = w + '%';
        barEls[i].style.left = (m.exp >= 0 ? 50 : 50 - w) + '%';
        barEls[i].classList.toggle('neg', m.exp < 0);
        net += m.exp;
      });
      const val = Math.round(net * 184000);
      netEl.textContent = money(val);
      // Illustrative risk metrics: gross exposure drives stress loss and budget usage
      const gross = markets.reduce((a, m) => a + Math.abs(m.exp), 0);
      mtm += (Math.random() - 0.45) * 2600;
      mtmEl.textContent = money(Math.round(mtm));
      mtmEl.classList.toggle('neg', mtm < 0);
      const stress = Math.round(gross * 212000 + Math.abs(net) * 90000);
      stressEl.textContent = money(-stress);
      const used = Math.min(96, Math.round(gross * 58 + 12));
      budgetEl.textContent = used + '%';
      budgetBar.style.width = used + '%';
    };

    // Move American odds by a small step, keeping them in a valid band
    const step = (p) => {
      const d = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 5));
      if (p < 0) { let n = p + d; if (n > -101) n = -101; if (n < -140) n = -140; return n; }
      let n = p + d * (p > 200 ? 3 : 1); if (n < 101) n = 101; if (n > 520) n = 520; return n;
    };
    const implied = p => (p < 0 ? -p / (-p + 100) : 100 / (p + 100));

    const actions = [
      { k: 'accept', t: 'ACCEPT' },
      { k: 'accept', t: 'ACCEPT' },
      { k: 'reprice', t: 'REPRICE' },
      { k: 'reduce', t: 'REDUCE' },
      { k: 'hedge', t: 'NET' },
      { k: 'route', t: 'ROUTE' }
    ];
    const pad = n => String(n).padStart(2, '0');
    const addLog = () => {
      const now = new Date();
      const ts = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${String(now.getMilliseconds()).padStart(3, '0')}`;
      const m = markets[Math.floor(Math.random() * markets.length)];
      const a = actions[Math.floor(Math.random() * actions.length)];
      const id = Math.random().toString(16).slice(2, 6).toUpperCase();
      let detail;
      if (a.k === 'reprice') detail = `${fmt(m.price)} → ${fmt(step(m.price))}`;
      else if (a.k === 'reduce') detail = `stake ${(1 + Math.floor(Math.random() * 4)) * 500} → ${(1 + Math.floor(Math.random() * 3)) * 250}`;
      else if (a.k === 'hedge') detail = `offset ${20 + Math.floor(Math.random() * 45)}% in-book`;
      else if (a.k === 'route') detail = `residual ${10 + Math.floor(Math.random() * 25)}% → approved cpty · filled · reconciled`;
      else detail = `@ ${fmt(m.price)}`;
      const line = document.createElement('div');
      line.className = 'log-line';
      line.innerHTML = `${ts} · #${id} · ${m.mkt} · <b class="${a.k}">${a.t}</b> ${detail}`;
      logEl.appendChild(line);
      while (logEl.children.length > 7) logEl.removeChild(logEl.firstChild);
    };

    const tick = () => {
      const i = Math.floor(Math.random() * markets.length);
      const m = markets[i];
      const before = implied(m.price);
      m.price = step(m.price);
      const el = priceEls[i];
      el.textContent = fmt(m.price);
      el.classList.remove('up', 'down');
      void el.offsetWidth;
      el.classList.add(implied(m.price) > before ? 'up' : 'down');
      setTimeout(() => el.classList.remove('up', 'down'), 500);
      m.exp = Math.max(-0.48, Math.min(0.48, m.exp + (Math.random() - 0.5) * 0.12));
      renderBars();
      if (Math.random() < 0.7) addLog();
    };

    renderBars();
    for (let k = 0; k < 5; k++) addLog();

    let consoleTimer = null;
    const consoleEl = document.querySelector('.console');
    if (!reduceMotion) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !consoleTimer) consoleTimer = setInterval(tick, 1100);
        else if (!e.isIntersecting && consoleTimer) { clearInterval(consoleTimer); consoleTimer = null; }
      }).observe(consoleEl);
    }
  }


  /* ══════════════════════════════
     HOW IT WORKS — wager lifecycle stepper
  ══════════════════════════════ */
  const stages = [
    {
      op: 'The operator selects sports, bet types, limits, jurisdictions and display rules.',
      t: 'Ingests licensed data and approved reference feeds; maps events, outcomes and settlement rules.',
      out: ['event map', 'settlement rules', 'market config']
    },
    {
      op: 'Players see familiar moneyline, spread, total, live, prop and parlay markets.',
      t: 'Models generate prices, account for correlations and apply margin, latency and market controls.',
      out: ['price', 'margin', 'latency controls']
    },
    {
      op: 'The player chooses a stake and confirms the offered price.',
      t: 'Checks price freshness, player and market limits, liabilities and correlated exposure — then decides.',
      out: ['ACCEPT', 'REPRICE', 'REDUCE', 'REJECT']
    },
    {
      op: 'The operator confirms the wager and debits the player wallet.',
      t: 'Returns an auditable decision ID and books the resulting exposure into the portfolio ledger.',
      out: ['decision_id', 'ledger entry', 'timestamp']
    },
    {
      op: "The operator's trading desk sees exposures, alerts and recommended actions.",
      t: 'Updates prices and limits, nets offsetting flow and evaluates approved hedge and liquidity routes.',
      out: ['limit update', 'net flow', 'hedge proposal']
    },
    {
      op: 'The operator settles the wager and credits the wallet under its own rules.',
      t: 'Reconciles results, hedge P&L and fees; analyzes hold, model error and customer flow for recalibration.',
      out: ['reconciliation', 'hold analysis', 'recalibration']
    }
  ];

  const tabs = [...document.querySelectorAll('.flow-tabs [role="tab"]')];
  if (tabs.length) {
    const panel = document.getElementById('panel-flow');
    const opEl = document.getElementById('flowOperator');
    const tEl = document.getElementById('flowTessellate');
    const chipsEl = document.getElementById('flowChips');
    const progress = document.getElementById('flowProgress');
    const DURATION = 7000;
    let current = 0, autoplay = !reduceMotion, inView = false, startTime = 0, raf = 0;

    const select = (i, focus) => {
      current = i;
      tabs.forEach((tab, k) => {
        const on = k === i;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
      });
      if (focus) tabs[i].focus();
      panel.setAttribute('aria-labelledby', tabs[i].id);
      const s = stages[i];
      [opEl, tEl].forEach(el => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); });
      opEl.textContent = s.op;
      tEl.textContent = s.t;
      chipsEl.innerHTML = s.out.map(o => `<span class="chip">${o}</span>`).join('');
      startTime = performance.now();
    };

    const stopAuto = () => { autoplay = false; progress.style.width = '0'; };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => { stopAuto(); select(i); });
      tab.addEventListener('keydown', e => {
        const horizontal = window.innerWidth <= 960;
        const next = horizontal ? 'ArrowRight' : 'ArrowDown';
        const prev = horizontal ? 'ArrowLeft' : 'ArrowUp';
        let n = null;
        if (e.key === next) n = (i + 1) % tabs.length;
        else if (e.key === prev) n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); stopAuto(); select(n, true); }
      });
    });

    const frame = (now) => {
      if (autoplay && inView) {
        const p = (now - startTime) / DURATION;
        progress.style.width = Math.min(p, 1) * 100 + '%';
        if (p >= 1) select((current + 1) % tabs.length);
        raf = requestAnimationFrame(frame);
      }
    };

    new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView && autoplay) { startTime = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    }, { threshold: 0.35 }).observe(panel);

    select(0);
  }
})();
