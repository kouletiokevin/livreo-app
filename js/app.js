/* ═══════════════════════════════════════
   LIVREO — App Core
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
  setTimeout(() => { s.style.display = 'none'; }, 650);
  if (!localStorage.getItem('livreo_perms_done')) {
    setTimeout(() => {
      document.getElementById('perm-ov').style.display = 'flex';
    }, 700);
  }
}

setTimeout(() => {
  const s = document.getElementById('splash');
  if (s && s.style.display !== 'none') closeSplash();
}, 4200);

// ── Permissions ──────────────────────────
async function askPerms() {
  async function trySet(id, fn) {
    try {
      const r = await fn();
      const el = document.getElementById(id);
      el.textContent = r ? '✅ Accordé' : 'Refusé';
      if (r) el.style.color = 'var(--g500)';
    } catch (e) {
      document.getElementById(id).textContent = 'Refusé';
    }
  }
  await trySet('ps-cam', async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    s.getTracks().forEach(t => t.stop()); return true;
  });
  await trySet('ps-mic', async () => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(t => t.stop()); return true;
  });
  await trySet('ps-loc', async () =>
    new Promise(res => navigator.geolocation.getCurrentPosition(() => res(true), () => res(false)))
  );
  await trySet('ps-notif', async () => {
    const r = await Notification.requestPermission();
    return r === 'granted';
  });
  localStorage.setItem('livreo_perms_done', '1');
  setTimeout(() => {
    const o = document.getElementById('perm-ov');
    o.style.opacity = '0';
    o.style.transition = 'opacity .4s';
    setTimeout(() => o.style.display = 'none', 420);
  }, 1000);
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

// ── Utilitaires ──────────────────────────
function fmtCard(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
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
      if (r.outcome === 'accepted') t('Livreo installé sur votre appareil ! 🎉', 's');
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
        btn.innerHTML = `<div style="position:fixed;bottom:calc(var(--bot) + 12px);right:14px;z-index:1000;background:var(--ink);color:#fff;padding:10px 16px;border-radius:50px;font-size:.76rem;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.3);display:flex;align-items:center;gap:7px;" onclick="installPWA()">📲 Installer Livreo</div>`;
        document.body.appendChild(btn);
        setTimeout(() => { if (btn.parentNode) btn.parentNode.removeChild(btn); }, 8000);
      });
    } catch (e) { console.log('SW:', e.message); }
  });
}
