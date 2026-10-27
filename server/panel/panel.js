// Erdens Kebab – éttermi rendelésfogadó panel (tableten vagy böngészőben fut).
(() => {
  const $ = (id) => document.getElementById(id);
  const PAYMENT = { cash: 'Készpénz', card: 'Bankkártya', szep: 'SZÉP-kártya' };
  const NEXT = {
    accepted: { status: 'preparing', label: 'Készítés indítása' },
    preparing: {
      delivery: { status: 'on_the_way', label: 'Futárnak átadva' },
      pickup: { status: 'ready', label: 'Átvehető' },
    },
    on_the_way: { status: 'completed', label: 'Kiszállítva' },
    ready: { status: 'completed', label: 'Átvéve' },
  };
  const ACCEPT_MINUTES = [15, 25, 35, 45, 60];
  const VIEWS = ['orders', 'menu', 'stats'];
  // Ennyi perc várakozás után pirosan jelöljük a még el nem fogadott rendelést.
  const PENDING_WARN_MIN = 3;

  let session = load();
  let orders = new Map();
  let menu = [];
  let soldOut = new Set();
  let view = VIEWS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'orders';
  let events = null;
  let soundOn = localStorageGet('ek-sound') !== 'off';
  let audio = null;

  // --- segédek ------------------------------------------------------------------------------
  function localStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function localStorageSet(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  }
  function load() {
    try {
      return JSON.parse(localStorageGet('ek-session') || 'null');
    } catch {
      return null;
    }
  }
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (n) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ft`;
  const time = (ts) => new Date(ts).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  const dayTime = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const same = d.toDateString() === today.toDateString();
    return same ? `ma ${time(ts)}` : `${d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })} ${time(ts)}`;
  };
  const ago = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    return m < 1 ? 'most' : m < 60 ? `${m} perce` : `${Math.floor(m / 60)} órája`;
  };
  const isFinal = (s) => s === 'completed' || s === 'rejected';
  const minutesSince = (ts) => Math.floor((Date.now() - ts) / 60000);
  // A konyhán vagy a futárnál késik-e (az átvételre váró rendelésnél a vendégen múlik).
  const isLate = (o) =>
    ['accepted', 'preparing', 'on_the_way'].includes(o.status) && Date.now() > o.etaAt;

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (el.hidden = true), 3500);
  }

  async function api(path, body) {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        ...(session ? { authorization: `Bearer ${session.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && session) {
      logout(false);
      throw new Error('Lejárt a belépés');
    }
    if (!res.ok) throw new Error(json.error || 'Hiba történt');
    return json;
  }

  // --- hang: ismétlődő csengő, amíg van elfogadásra váró rendelés ---------------------------
  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audio = new Ctx();
    }
    if (audio && audio.state === 'suspended') audio.resume();
  }
  function chime() {
    if (!soundOn || !audio || audio.state !== 'running') return;
    const now = audio.currentTime;
    [880, 1175, 880].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.17);
    });
  }
  setInterval(() => {
    if ([...orders.values()].some((o) => o.status === 'pending')) chime();
  }, 6000);
  document.addEventListener('pointerdown', ensureAudio);

  function updateSoundButton() {
    const blocked = soundOn && (!audio || audio.state !== 'running');
    $('sound-btn').textContent = !soundOn ? '🔕 Hang ki' : blocked ? '🔔 Koppints a hanghoz' : '🔔 Hang be';
  }

  // --- megjelenítés -------------------------------------------------------------------------
  function actionsFor(o) {
    if (o.status === 'pending') {
      return `
        <div class="actions">
          <div class="label">${o.mode === 'delivery' ? 'Érkezés a vendéghez' : 'Átvehető'} kb. ennyi perc múlva:</div>
          <div class="minutes">${ACCEPT_MINUTES.map(
            (m) => `<button class="btn primary" data-accept="${m}" data-id="${o.id}">${m}'</button>`,
          ).join('')}</div>
          <div class="row"><span></span><button class="btn link" data-reject="${o.id}">Elutasítás</button></div>
        </div>`;
    }
    const step = NEXT[o.status];
    if (!step) return '';
    const next = step.status ? step : step[o.mode];
    return `
      <div class="actions">
        <div class="row">
          <button class="btn dark" style="flex:1" data-status="${next.status}" data-id="${o.id}">${next.label}</button>
          ${o.status === 'accepted' || o.status === 'preparing' ? `<button class="btn link" data-reject="${o.id}">Lemondás</button>` : ''}
        </div>
      </div>`;
  }

  function etaLine(o) {
    if (o.status === 'pending') return '';
    const label = o.mode === 'delivery' ? 'Érkezés' : 'Átvehető';
    if (isLate(o)) {
      return `<div class="eta late">⚠️ Késésben ${minutesSince(o.etaAt) || 1} perce · ${label}: ${dayTime(o.etaAt)}</div>`;
    }
    return `<div class="eta">⏱ ${label}: ${dayTime(o.etaAt)}</div>`;
  }

  function card(o) {
    const tel = o.contact.phone.replace(/[^\d+]/g, '');
    const a = o.address;
    const waitWarn = o.status === 'pending' && minutesSince(o.createdAt) >= PENDING_WARN_MIN;
    return `
      <article class="card ${o.status}${isLate(o) ? ' late' : ''}">
        <div class="card-head">
          <span class="num">${esc(o.number)}</span>
          <span class="badge ${o.mode}">${o.mode === 'delivery' ? '🛵 Kiszállítás' : '🛍️ Elvitel'}</span>
          ${o.scheduledFor ? `<span class="badge sched">🗓️ ${dayTime(o.scheduledFor)}</span>` : ''}
          <span class="head-right">
            <span class="age${waitWarn ? ' warn' : ''}">${time(o.createdAt)} · ${waitWarn ? `${ago(o.createdAt)} vár!` : ago(o.createdAt)}</span>
            <button class="icon-btn" type="button" data-print="${o.id}" title="Konyhai blokk nyomtatása" aria-label="${esc(o.number)} blokk nyomtatása">🖨</button>
          </span>
        </div>
        <ul class="lines">
          ${o.lines
            .map(
              (l) => `<li><b>${l.qty}×</b> ${esc(l.name)}
                ${l.summary ? `<div class="sub">${esc(l.summary)}</div>` : ''}
                ${l.note ? `<div class="note">„${esc(l.note)}”</div>` : ''}</li>`,
            )
            .join('')}
        </ul>
        <div class="customer">
          <div><strong>${esc(o.contact.name)}</strong> · <a href="tel:${esc(tel)}">${esc(o.contact.phone)}</a></div>
          ${a ? `<div>📍 ${esc(a.town)}, ${esc(a.street)}${a.details ? ` · ${esc(a.details)}` : ''}</div>` : ''}
          ${a && a.courierNote ? `<div class="note">Futárnak: ${esc(a.courierNote)}</div>` : ''}
          <div>${PAYMENT[o.payment] || ''}${o.cutlery ? ' · 🍴 kér evőeszközt' : ''}</div>
        </div>
        <div class="money">
          <span>${money(o.total)}</span>
          <small>${[
            o.packagingFee ? `csomagolás ${money(o.packagingFee)}` : '',
            o.deliveryFee ? `szállítás ${money(o.deliveryFee)}` : '',
            o.tip ? `borravaló ${money(o.tip)}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}</small>
        </div>
        ${etaLine(o)}
        ${actionsFor(o)}
      </article>`;
  }

  function render() {
    const list = [...orders.values()].sort((a, b) => a.createdAt - b.createdAt);
    const groups = {
      new: list.filter((o) => o.status === 'pending'),
      prep: list.filter((o) => o.status === 'accepted' || o.status === 'preparing'),
      out: list.filter((o) => o.status === 'on_the_way' || o.status === 'ready'),
      done: list.filter((o) => isFinal(o.status)).reverse(),
    };
    const empty = { new: 'Nincs új rendelés', prep: 'Nincs készülő rendelés', out: 'Nincs kiadott rendelés' };
    for (const key of ['new', 'prep', 'out']) {
      $(`col-${key}`).innerHTML = groups[key].length
        ? groups[key].map(card).join('')
        : `<div class="empty">${empty[key]}</div>`;
      $(`count-${key}`).textContent = groups[key].length || '';
    }
    $('count-done').textContent = groups.done.length ? `(${groups.done.length})` : '';
    $('col-done').innerHTML = groups.done
      .map(
        (o) => `<div class="history-item">
          <strong>${esc(o.number)}</strong>
          <span>${time(o.createdAt)}</span>
          <span>${esc(o.contact.name)} · ${o.lines.reduce((n, l) => n + l.qty, 0)} tétel</span>
          <span>${money(o.total)}</span>
          ${o.status === 'completed'
            ? `<span class="status-done">${o.mode === 'delivery' ? 'Kiszállítva' : 'Átvéve'}</span>`
            : `<span class="status-rejected" title="${esc(o.rejectReason)}">Elutasítva</span>`}
        </div>`,
      )
      .join('');
    document.title = groups.new.length
      ? `(${groups.new.length}) Új rendelés! · Erdens Kebab`
      : 'Erdens Kebab · Rendelésfogadó';
    $('tab-new').textContent = groups.new.length || '';
    if (view === 'stats') scheduleStats();
    updateSoundButton();
  }

  // --- nézetek: rendelések / étlap / mai nap --------------------------------------------------
  function showView(next) {
    view = next;
    for (const key of VIEWS) $(`view-${key}`).hidden = key !== view;
    document.querySelectorAll('.tabs [data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === view);
      b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
    });
    history.replaceState(null, '', `#${view}`);
    if (view === 'stats') loadStats().catch((err) => toast(err.message));
    window.scrollTo(0, 0);
  }

  function renderMenu() {
    $('menu-list').innerHTML = menu
      .map(
        (c) => `<section class="menu-cat">
          <h3>${esc(c.name)}</h3>
          ${c.items
            .map((i) => {
              const out = soldOut.has(i.id);
              return `<label class="menu-row${out ? ' out' : ''}">
                <span class="name">${esc(i.name)}</span>
                <span class="price">${money(i.price)}</span>
                <span class="state">${out ? 'Elfogyott' : 'Kapható'}</span>
                <span class="switch">
                  <input type="checkbox" data-item="${esc(i.id)}" ${out ? '' : 'checked'} />
                  <span class="track"><span class="thumb"></span></span>
                </span>
              </label>`;
            })
            .join('')}
        </section>`,
      )
      .join('');
    const n = soldOut.size;
    $('tab-soldout').textContent = n || '';
    $('clear-soldout').hidden = !n;
    $('soldout-summary').textContent = n
      ? `${n} termék elfogyottnak jelölve – az appban most nem rendelhető.`
      : 'Minden termék kapható. Ha valami elfogy, kapcsold ki: az appban azonnal nem lesz rendelhető.';
  }

  // --- kimutatás ------------------------------------------------------------------------------
  const PERIODS = ['today', '7d', '30d'];
  let period = PERIODS.includes(localStorageGet('ek-period')) ? localStorageGet('ek-period') : 'today';
  let statsTimer = null;

  // Új rendelésnél / státuszváltáskor kicsit késleltetve frissít (egy hullámban egyszer).
  function scheduleStats() {
    clearTimeout(statsTimer);
    statsTimer = setTimeout(() => loadStats().catch(() => {}), 800);
  }

  async function loadStats() {
    document.querySelectorAll('#period [data-period]').forEach((b) => {
      b.classList.toggle('active', b.dataset.period === period);
      b.setAttribute('aria-pressed', String(b.dataset.period === period));
    });
    renderStats(await api(`/api/panel/stats?period=${period}`));
  }

  const fmtWait = (ms) =>
    ms < 60_000 ? `${Math.round(ms / 1000)} mp` : `${Math.floor(ms / 60_000)} p ${Math.round((ms % 60_000) / 1000)} mp`;
  const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');
  const dateOf = (iso) => new Date(`${iso}T12:00:00`);

  /** Oszlopdiagram: csak a legnagyobb értéket írjuk ki, a többit a buborék (hover) mutatja. */
  function columns(points) {
    const peak = Math.max(0, ...points.map((p) => p.value));
    return points
      .map((p) => {
        const isPeak = peak > 0 && p.value === peak;
        return `<div class="c${p.value ? '' : ' zero'}" data-tip="${esc(p.tip)}" aria-label="${esc(p.tip)}">
          <span class="n">${isPeak ? p.value : ''}</span>
          <span class="col"><span class="b" style="height:${peak ? (p.value / peak) * 100 : 0}%"></span></span>
          <span class="t">${esc(p.label)}</span>
        </div>`;
      })
      .join('');
  }

  /** Vízszintes sávok felirattal (a szöveg azonosít, nem a szín). */
  function bars(rows, empty) {
    if (!rows.length) return `<li class="muted">${empty}</li>`;
    const max = Math.max(1, ...rows.map((r) => r.value));
    return rows
      .map(
        (r) => `<li${r.split ? ' class="split"' : ''}>
          <span>${esc(r.label)}</span>
          <span class="qty">${r.detail}</span>
          <span class="bar${r.value ? '' : ' zero'}"><span style="width:${(r.value / max) * 100}%"></span></span>
        </li>`,
      )
      .join('');
  }

  function renderStats(s) {
    const fmtDate = (ts) =>
      new Date(ts).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
    $('stats-range').textContent =
      s.period === 'today'
        ? `Ma, ${fmtDate(s.to)} · frissítve ${time(Date.now())}`
        : `${fmtDate(s.from)} – ${fmtDate(s.to)} · frissítve ${time(Date.now())}`;

    const kpi = (label, value, sub, hero = false) =>
      `<div class="kpi${hero ? ' hero' : ''}"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
    $('kpis').innerHTML = [
      kpi('Forgalom', money(s.revenue), `átlagos kosár ${s.orders ? money(s.avgBasket) : '–'}`, true),
      kpi('Rendelés az appból', s.orders, s.rejected ? `+ ${s.rejected} elutasítva` : `${s.completed} teljesítve`),
      kpi('Vendég', s.customers, 'különböző telefonszám'),
      kpi('Visszatérő vendég', s.returning, s.customers ? `a vendégek ${pct(s.returning, s.customers)}-a` : ''),
      kpi('Átlagos elfogadás', s.avgAcceptMs === null ? '–' : fmtWait(s.avgAcceptMs), 'beérkezéstől'),
    ].join('');

    const multiDay = s.perDay.length > 1;
    $('daily-card').hidden = !multiDay;
    if (multiDay) {
      $('daily').innerHTML = columns(
        s.perDay.map((d) => {
          const date = dateOf(d.date);
          const long = date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' });
          return {
            value: d.orders,
            label: s.perDay.length > 10 ? String(date.getDate()) : date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }),
            tip: `${long} · ${d.orders} rendelés · ${money(d.revenue)}`,
          };
        }),
      );
    }

    $('hourly-title').textContent = multiDay ? 'Csúcsidő – rendelések óránként (összesen)' : 'Rendelések óránként';
    const used = s.perHour.map((n, h) => (n ? h : null)).filter((h) => h !== null);
    const from = Math.min(10, ...used);
    const to = Math.max(22, ...used);
    $('hourly').innerHTML = columns(
      s.perHour.slice(from, to + 1).map((n, i) => ({
        value: n,
        label: String(from + i),
        tip: `${from + i}:00–${from + i + 1}:00 · ${n} rendelés`,
      })),
    );

    $('top-items').innerHTML = bars(
      s.topItems.map((r) => ({ label: r.name, value: r.qty, detail: `${r.qty} db · ${money(r.revenue)}` })),
      'Ebben az időszakban még nem érkezett rendelés.',
    );
    $('mix').innerHTML = s.orders
      ? bars(
          [
            { label: '🛵 Kiszállítás', value: s.delivery, detail: `${s.delivery} · ${pct(s.delivery, s.orders)}` },
            { label: '🛍️ Elvitel', value: s.pickup, detail: `${s.pickup} · ${pct(s.pickup, s.orders)}` },
            ...Object.entries(PAYMENT).map(([key, label], i) => ({
              label,
              split: i === 0,
              value: s.payments[key] ?? 0,
              detail: `${s.payments[key] ?? 0} · ${pct(s.payments[key] ?? 0, s.orders)}`,
            })),
          ],
          '',
        )
      : bars([], 'Ebben az időszakban még nem érkezett rendelés.');
  }

  async function exportCsv() {
    const res = await fetch(`/api/panel/export?period=${period}`, {
      headers: { authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) throw new Error('Nem sikerült a letöltés');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `erdens-rendelesek-${new Date().toISOString().slice(0, 10)}-${period}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // --- konyhai blokk (80 mm-es hőpapírra, de A4-en is olvasható) -----------------------------
  function printTicket(o) {
    const a = o.address;
    const row = (left, right = '') => `<div class="t-row"><span>${left}</span><span>${right}</span></div>`;
    $('print-area').innerHTML = `
      <div class="t-center t-brand">ERDEN'S KEBAB</div>
      <div class="t-center">${esc($('location-name').textContent)}</div>
      <div class="t-sep"></div>
      ${row(`<b class="t-big">${esc(o.number)}</b>`, `<b>${o.mode === 'delivery' ? 'KISZÁLLÍTÁS' : 'ELVITEL'}</b>`)}
      ${row('Rendelve:', dayTime(o.createdAt))}
      ${o.status !== 'pending' ? row(o.mode === 'delivery' ? 'Érkezés:' : 'Átvehető:', `<b>${dayTime(o.etaAt)}</b>`) : ''}
      ${o.scheduledFor ? row('Előrendelés:', `<b>${dayTime(o.scheduledFor)}</b>`) : ''}
      <div class="t-sep"></div>
      ${o.lines
        .map(
          (l) => `<div class="t-line">
            ${row(`<b>${l.qty}× ${esc(l.name)}</b>`, money(l.qty * l.unitPrice))}
            ${l.summary ? `<div class="t-sub">${esc(l.summary)}</div>` : ''}
            ${l.note ? `<div class="t-sub"><b>„${esc(l.note)}”</b></div>` : ''}
          </div>`,
        )
        .join('')}
      <div class="t-sep"></div>
      <div><b>${esc(o.contact.name)}</b> · ${esc(o.contact.phone)}</div>
      ${a ? `<div>${esc(a.town)}, ${esc(a.street)}${a.details ? ` · ${esc(a.details)}` : ''}</div>` : ''}
      ${a && a.courierNote ? `<div>Futárnak: ${esc(a.courierNote)}</div>` : ''}
      ${o.cutlery ? '<div>Evőeszközt kér</div>' : ''}
      <div class="t-sep"></div>
      ${row('Részösszeg', money(o.subtotal))}
      ${o.packagingFee ? row('Csomagolás', money(o.packagingFee)) : ''}
      ${o.deliveryFee ? row('Szállítás', money(o.deliveryFee)) : ''}
      ${o.tip ? row('Borravaló', money(o.tip)) : ''}
      ${row('<b>FIZETENDŐ</b>', `<b class="t-big">${money(o.total)}</b>`)}
      ${row('Fizetés:', `<b>${PAYMENT[o.payment] || ''}</b>`)}
      <div class="t-sep"></div>
      <div class="t-center">Nyomtatva: ${dayTime(Date.now())}</div>`;
    window.print();
  }

  function setSettings({ paused, open, soldOut: ids }) {
    if (paused !== undefined) {
      $('accepting').checked = !paused;
      $('paused-banner').hidden = !paused;
    }
    if (open !== undefined) $('closed-banner').hidden = open;
    if (ids !== undefined) {
      soldOut = new Set(ids);
      renderMenu();
    }
  }

  // --- adatok -------------------------------------------------------------------------------
  async function refresh() {
    const data = await api('/api/panel/orders');
    $('location-name').textContent = data.location.name;
    menu = data.menu ?? [];
    orders = new Map(data.orders.map((o) => [o.id, o]));
    setSettings(data);
    render();
  }

  function connect() {
    if (events) events.close();
    events = new EventSource(`/api/panel/events?token=${encodeURIComponent(session.token)}`);
    events.onopen = () => {
      $('conn').textContent = 'Élő';
      $('conn').classList.add('live');
      refresh().catch(() => {});
    };
    events.onerror = () => {
      $('conn').textContent = 'Újracsatlakozás…';
      $('conn').classList.remove('live');
    };
    events.addEventListener('order', (e) => {
      const order = JSON.parse(e.data);
      const isNew = !orders.has(order.id);
      orders.set(order.id, order);
      render();
      if (isNew && order.status === 'pending') {
        toast(`Új rendelés: ${order.number} – ${money(order.total)}`);
        chime();
      }
    });
    events.addEventListener('settings', (e) => setSettings(JSON.parse(e.data)));
  }

  function showApp() {
    $('login').hidden = true;
    $('app').hidden = false;
    showView(view);
    refresh().catch((err) => toast(err.message));
    connect();
  }

  function logout(callServer = true) {
    if (callServer && session) api('/api/panel/logout', {}).catch(() => {});
    session = null;
    localStorageSet('ek-session', null);
    if (events) events.close();
    $('app').hidden = true;
    $('login').hidden = false;
  }

  // --- események ----------------------------------------------------------------------------
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    ensureAudio();
    const form = new FormData(e.target);
    $('login-error').hidden = true;
    try {
      const res = await api('/api/panel/login', {
        locationId: form.get('locationId'),
        pin: form.get('pin'),
      });
      session = { token: res.token, locationId: res.locationId };
      localStorageSet('ek-session', JSON.stringify(session));
      e.target.reset();
      showApp();
    } catch (err) {
      $('login-error').textContent = err.message;
      $('login-error').hidden = false;
    }
  });

  $('logout-btn').addEventListener('click', () => logout());

  $('sound-btn').addEventListener('click', () => {
    ensureAudio();
    const blocked = soundOn && audio && audio.state !== 'running';
    if (!blocked) soundOn = !soundOn;
    localStorageSet('ek-sound', soundOn ? 'on' : 'off');
    setTimeout(updateSoundButton, 50);
    if (soundOn) chime();
  });

  $('accepting').addEventListener('change', async (e) => {
    const paused = !e.target.checked;
    try {
      setSettings(await api('/api/panel/pause', { paused }));
      toast(paused ? 'Rendelésfogadás szüneteltetve' : 'Rendelésfogadás bekapcsolva');
    } catch (err) {
      e.target.checked = !e.target.checked;
      toast(err.message);
    }
  });

  document.querySelector('.tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (btn) showView(btn.dataset.view);
  });

  $('menu-list').addEventListener('change', async (e) => {
    const input = e.target.closest('input[data-item]');
    if (!input) return;
    const out = !input.checked;
    const name = input.closest('.menu-row').querySelector('.name').textContent;
    input.disabled = true;
    try {
      setSettings(await api('/api/panel/sold-out', { itemId: input.dataset.item, soldOut: out }));
      toast(out ? `${name}: elfogyott – az appban nem rendelhető` : `${name}: újra kapható`);
    } catch (err) {
      input.checked = !input.checked;
      input.disabled = false;
      toast(err.message);
    }
  });

  $('period').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    period = btn.dataset.period;
    localStorageSet('ek-period', period);
    loadStats().catch((err) => toast(err.message));
  });

  $('export-btn').addEventListener('click', () => exportCsv().catch((err) => toast(err.message)));

  $('clear-soldout').addEventListener('click', async () => {
    try {
      setSettings(await api('/api/panel/sold-out', { clear: true }));
      toast('Minden termék újra kapható');
    } catch (err) {
      toast(err.message);
    }
  });

  document.querySelector('.board').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.print) return printTicket(orders.get(btn.dataset.print));
    if (btn.dataset.reject) return openReject(btn.dataset.reject);
    const id = btn.dataset.id;
    btn.disabled = true;
    try {
      const res = btn.dataset.accept
        ? await api(`/api/panel/orders/${id}/accept`, { minutes: Number(btn.dataset.accept) })
        : await api(`/api/panel/orders/${id}/status`, { status: btn.dataset.status });
      orders.set(res.order.id, res.order);
      render();
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });

  let rejecting = null;
  function openReject(id) {
    rejecting = id;
    $('reject-number').textContent = orders.get(id)?.number ?? '';
    $('reject-form').reset();
    $('reject-dialog').showModal();
  }
  $('reject-dialog').addEventListener('close', async () => {
    if ($('reject-dialog').returnValue !== 'confirm' || !rejecting) return;
    const form = new FormData($('reject-form'));
    const reason = form.get('reason') === 'other' ? String(form.get('other') || '').trim() : form.get('reason');
    if (!reason) return toast('Add meg az elutasítás okát');
    try {
      const res = await api(`/api/panel/orders/${rejecting}/reject`, { reason });
      orders.set(res.order.id, res.order);
      render();
      toast(`${res.order.number} elutasítva`);
    } catch (err) {
      toast(err.message);
    }
  });

  // Ha más nézetben ér be új rendelés, a felugró értesítésre koppintva oda lehet ugrani.
  $('toast').addEventListener('click', () => showView('orders'));

  // "x perce" feliratok frissítése
  setInterval(() => session && render(), 30_000);

  // Ingyenes tárhelyen a szerver 15 perc forgalom nélkül elalszik – a nyitott panel ébren tartja
  // (és közben újra is szinkronizálja a rendeléseket).
  setInterval(() => session && refresh().catch(() => {}), 4 * 60_000);

  if (session) showApp();
  else $('login').hidden = false;
})();
