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

  let session = load();
  let orders = new Map();
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

  function card(o) {
    const tel = o.contact.phone.replace(/[^\d+]/g, '');
    const a = o.address;
    return `
      <article class="card ${o.status}">
        <div class="card-head">
          <span class="num">${esc(o.number)}</span>
          <span class="badge ${o.mode}">${o.mode === 'delivery' ? '🛵 Kiszállítás' : '🛍️ Elvitel'}</span>
          ${o.scheduledFor ? `<span class="badge sched">🗓️ ${dayTime(o.scheduledFor)}</span>` : ''}
          <span class="age">${time(o.createdAt)} · ${ago(o.createdAt)}</span>
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
          <small>${o.deliveryFee ? `szállítás ${money(o.deliveryFee)}` : ''}${o.tip ? ` · borravaló ${money(o.tip)}` : ''}</small>
        </div>
        ${o.status !== 'pending' ? `<div class="eta">⏱ ${o.mode === 'delivery' ? 'Érkezés' : 'Átvehető'}: ${dayTime(o.etaAt)}</div>` : ''}
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
    updateSoundButton();
  }

  function setSettings({ paused, open }) {
    if (paused !== undefined) {
      $('accepting').checked = !paused;
      $('paused-banner').hidden = !paused;
    }
    if (open !== undefined) $('closed-banner').hidden = open;
  }

  // --- adatok -------------------------------------------------------------------------------
  async function refresh() {
    const data = await api('/api/panel/orders');
    $('location-name').textContent = data.location.name;
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

  document.querySelector('.board').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
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

  // "x perce" feliratok frissítése
  setInterval(() => session && render(), 30_000);

  // Ingyenes tárhelyen a szerver 15 perc forgalom nélkül elalszik – a nyitott panel ébren tartja
  // (és közben újra is szinkronizálja a rendeléseket).
  setInterval(() => session && refresh().catch(() => {}), 4 * 60_000);

  if (session) showApp();
  else $('login').hidden = false;
})();
