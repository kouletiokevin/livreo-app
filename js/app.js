/* ═══════════════════════════════════════
   KOLISGO — App Core
   Navigation, toast, sheet, PWA, Stripe
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── État global ─────────────────────────
let user = null;
let emUp = false, coUp = false, qrLoaded = false;
let livrPhoto = false, livrChecksOk = false;

// ── Splash ───────────────────────────────
function closeSplash() {
  const s = document.getElementById('splash');
  s.classList.add('hide');
  setTimeout(() => {
    s.style.display = 'none';
    if (!localStorage.getItem('kolisgo_onboarding_done')) showOnboarding();
  }, 650);
}

setTimeout(() => {
  const s = document.getElementById('splash');
  if (s && s.style.display !== 'none') closeSplash();
}, 4200);

// ── Permissions ──────────────────────────
async function askPerms() {
  await demanderCamera();
  await demanderLocalisation();
  await demanderNotifications();
  localStorage.setItem('kolisgo_perms_done', '1');
  const o = document.getElementById('perm-ov');
  o.style.opacity = '0';
  o.style.transition = 'opacity .4s';
  setTimeout(() => o.style.display = 'none', 420);
}

async function passerPerms() {
  localStorage.setItem('kolisgo_perms_skipped', '1');
  const o = document.getElementById('perm-ov');
  o.style.opacity = '0';
  o.style.transition = 'opacity .4s';
  setTimeout(() => o.style.display = 'none', 420);
}

async function demanderCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(tr => tr.stop());
    localStorage.setItem('kolisgo_perm_camera', '1');
    return true;
  } catch(e) {
    t('Autorisez la caméra pour scanner le QR Code', 'e');
    return false;
  }
}

async function demanderLocalisation() {
  return new Promise(res => {
    navigator.geolocation.getCurrentPosition(
      () => { localStorage.setItem('kolisgo_perm_loc', '1'); res(true); },
      () => { t('Activez la localisation pour trouver la gare la plus proche', ''); res(false); }
    );
  });
}

async function demanderNotifications() {
  const r = await Notification.requestPermission();
  if (r === 'granted') localStorage.setItem('kolisgo_perm_notif', '1');
  return r === 'granted';
}

// ── Onboarding ───────────────────────────
let _obIdx = 0;

function showOnboarding() {
  _obIdx = 0;
  const ov = document.getElementById('onboarding-ov');
  ov.style.display = 'flex';
  obGoTo(0);
  _obInitSwipe();
}

function obGoTo(n) {
  _obIdx = Math.max(0, Math.min(3, n));
  document.getElementById('ob-track').style.transform = `translateX(-${_obIdx * 25}%)`;
  document.querySelectorAll('.ob-dot').forEach((d, i) => d.classList.toggle('on', i === _obIdx));
  const skip = document.getElementById('ob-skip');
  if (skip) skip.style.display = _obIdx === 3 ? 'none' : 'block';
  // Rejouer l'animation des éléments du slide actif
  const slides = document.querySelectorAll('.ob-slide');
  ['.ob-em', '.ob-title', '.ob-sub', '.ob-cta'].forEach(sel => {
    const el = slides[_obIdx]?.querySelector(sel);
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'obFadeIn .45s ease both';
  });
}

function finishOnboarding(action) {
  localStorage.setItem('kolisgo_onboarding_done', '1');
  const ov = document.getElementById('onboarding-ov');
  if (ov) {
    ov.style.opacity = '0';
    ov.style.transition = 'opacity .4s';
    setTimeout(() => ov.style.display = 'none', 420);
  }
  if (action === 'register') {
    goNav('auth');
    setTimeout(() => authTab('register', document.querySelector('.atab:last-child')), 500);
  } else if (action === 'login') {
    goNav('auth');
    setTimeout(() => authTab('login', document.querySelector('.atab:first-child')), 500);
  }
}

function _obInitSwipe() {
  const ov = document.getElementById('onboarding-ov');
  if (!ov || ov._swipeInited) return;
  ov._swipeInited = true;
  let startX = 0, startY = 0;
  ov.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  ov.addEventListener('touchend', e => {
    const dx = startX - e.changedTouches[0].clientX;
    const dy = startY - e.changedTouches[0].clientY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx > 0 && _obIdx < 3) obGoTo(_obIdx + 1);
    else if (dx < 0 && _obIdx > 0) obGoTo(_obIdx - 1);
  }, { passive: true });
}

// ── Navigation ───────────────────────────
function goNav(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.bni').forEach(b => b.classList.remove('on'));
  document.getElementById('s-' + id)?.classList.add('on');
  document.getElementById('bn-' + id)?.classList.add('on');
  document.getElementById('content').scrollTop = 0;
}

function navDash() { user ? goNav('dashboard') : goNav('auth'); }
function goPost() {
  user ? goNav('poster') : (t('Connectez-vous pour poster 🔒', 'e'), goNav('auth'));
}

function refreshHome() {
  const landing = document.getElementById('home-landing');
  const dash = document.getElementById('home-dash');
  if (user) { landing.style.display = 'none'; dash.style.display = 'block'; }
  else { landing.style.display = 'block'; dash.style.display = 'none'; }
}

// ── Toast ────────────────────────────────
function t(msg, type = '') {
  const c = document.getElementById('toasts');
  const d = document.createElement('div');
  d.className = `toast ${type}`;
  d.textContent = msg;
  c.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; }, 2800);
  setTimeout(() => d.remove(), 3200);
}

// ── Sheet ────────────────────────────────
function openSheet(html) {
  document.getElementById('sh-content').innerHTML = `<div class="sh"></div>${html}`;
  document.getElementById('ov').classList.add('open');
}
function cov(e) { if (e.target === document.getElementById('ov')) closeSheet(); }
function closeSheet() {
  document.getElementById('ov').classList.remove('open');
  if (typeof stopCamera === 'function') stopCamera();
}

function toggle(id) {
  const el = document.getElementById(id);
  el.classList.toggle('on');
  t(el.classList.contains('on') ? 'Notification activée ✅' : 'Notification désactivée', '');
}

function rate(type, n) {
  document.querySelectorAll(`#st-${type} .star`).forEach((s, i) => s.classList.toggle('on', i < n));
}

function tt(el) { el.classList.toggle('on'); }

// ── Auth state change (OAuth redirect) ───
db.auth.onAuthStateChange(async (event, session) => {
  if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && !user) {
    const { data: profil } = await db.from('users').select('*').eq('email', session.user.email).single();
    if (profil) {
      await onLoginSuccess(profil);
      if (event === 'SIGNED_IN') t(`Bienvenue ${profil.prenom} ! 👋`, 's');
    } else if (event === 'SIGNED_IN') {
      const meta = session.user.user_metadata;
      const newUser = {
        id: session.user.id,
        email: session.user.email,
        prenom: meta.given_name || meta.name?.split(' ')[0] || 'Utilisateur',
        nom: meta.family_name || meta.name?.split(' ').slice(1).join(' ') || '',
        telephone: '',
        verifie: false,
        statut: 'actif'
      };
      await db.from('users').insert(newUser).onConflict('id').ignore();
      await onLoginSuccess(newUser);
      t(`Bienvenue ${newUser.prenom} ! 🎉`, 's');
    }
  }
  if (event === 'SIGNED_OUT') {
    user = null;
    refreshHome();
  }
});

// ── Init DOM ─────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Limiter la date du poster à demain minimum
  const dateInput = document.getElementById('pf-date');
  if (dateInput) dateInput.min = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Masquer sections suivi/poster par défaut
  ['sv-exp', 'sv-dest', 'poster-suc', 'dest-suc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  loadCards();
  refreshHome();

  // Vérifier session existante au démarrage
  const profil = await checkSession();
  if (profil) {
    await onLoginSuccess(profil);
  }
});

// ── PWA Install ──────────────────────────
function installPWA() {
  if (window._pwaPrompt) {
    window._pwaPrompt.prompt();
    window._pwaPrompt.userChoice.then(r => {
      if (r.outcome === 'accepted') t('KolisGo installé sur votre appareil ! 🎉', 's');
      window._pwaPrompt = null;
      const btn = document.getElementById('pwa-install-btn');
      if (btn) btn.remove();
    });
  }
}

// ── Stripe ───────────────────────────────
window.addEventListener('load', () => {
  if (typeof Stripe !== 'undefined') {
    window.stripeClient = Stripe('pk_live_51QLFSSFQ0erFJFSmQsXFjgC9CcH1CCKfyL0KueBKHZ9Dy34QD2zVjtWxiqngJDFaOBjzFfpklvE6PJCOXDb8bzpL00peOcylDb');
  }
});

// ── Cookies RGPD ─────────────────────────
function acceptCookies() {
  localStorage.setItem('cookie_consent', '1');
  const b = document.getElementById('cookie-banner');
  if (b) b.style.display = 'none';
}

if (!localStorage.getItem('cookie_consent')) {
  setTimeout(() => {
    const b = document.getElementById('cookie-banner');
    if (b) b.style.display = 'block';
  }, 2000);
}

// ── Service Worker PWA ───────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        window._pwaPrompt = e;
        const btn = document.createElement('div');
        btn.id = 'pwa-install-btn';
        btn.innerHTML = `<div style="position:fixed;bottom:calc(var(--bot) + 12px);right:14px;z-index:1000;background:var(--ink);color:#fff;padding:10px 16px;border-radius:50px;font-size:.76rem;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.3);display:flex;align-items:center;gap:7px;" onclick="installPWA()">📲 Installer KolisGo</div>`;
        document.body.appendChild(btn);
        setTimeout(() => { if (btn.parentNode) btn.parentNode.removeChild(btn); }, 8000);
      });
    } catch (e) { console.log('SW:', e.message); }
  });
}
