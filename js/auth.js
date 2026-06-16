/* ═══════════════════════════════════════
   KOLISGO — Module Authentification
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Valide une URL image (https uniquement) ──────────────
function _safeImgUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try { const u = new URL(url); return u.protocol === 'https:' ? url : null; }
  catch(e) { return null; }
}

// ── Connexion email ──────────────────────
async function doLogin() {
  const email = document.getElementById('l-em')?.value.trim().toLowerCase();
  const mdp = document.getElementById('l-pw')?.value;

  if (!email || !mdp) { t('Renseignez email et mot de passe', 'e'); return; }
  if (!validateEmail(email)) { t('Email invalide', 'e'); return; }

  const btn = document.getElementById('login-btn');
  if (btn) { btn.textContent = 'Connexion...'; btn.disabled = true; }

  try {
    rateLimit('login', 5, 300000);

    const { data, error } = await db.auth.signInWithPassword({ email, password: mdp });
    if (error) {
      await logSecurityEvent('login_failed', { email });
      t('Email ou mot de passe incorrect ❌', 'e');
      return;
    }

    const profil = await chargerProfil(data.user.id);
    if (!profil) { t('Profil introuvable. Contactez le support.', 'e'); return; }

    await onLoginSuccess(profil);
    localStorage.setItem('kolisgo_logged_in', '1');
    t(`Bienvenue ${profil.prenom} ! 👋`, 's');
    goNav('home');
    // Force affichage dashboard — direct, sans passer par refreshHome
    const _l = document.getElementById('home-landing');
    const _d = document.getElementById('home-dash');
    if (_l) _l.style.display = 'none';
    if (_d) _d.style.display = 'block';

  } catch (e) {
    t(e.message || 'Erreur de connexion', 'e');
  } finally {
    if (btn) { btn.textContent = 'Se connecter'; btn.disabled = false; }
  }
}

// ── Inscription ──────────────────────────
async function doReg() {
  const cgu = document.getElementById('accept-cgu')?.checked;
  if (!cgu) { t('Vous devez accepter les CGU pour créer un compte', 'e'); return; }

  const pn = sanitize(document.getElementById('r-pn')?.value.trim());
  const nm = sanitize(document.getElementById('r-nm')?.value.trim());
  const em = document.getElementById('r-em')?.value.trim().toLowerCase();
  const ph = document.getElementById('r-ph')?.value.trim();
  const pw = document.getElementById('r-pw')?.value;

  if (!pn || !nm || !em || !ph || !pw) { t('Remplissez tous les champs', 'e'); return; }
  if (!validateEmail(em)) { t('Email invalide', 'e'); return; }
  if (!validatePhone(ph)) { t('Numéro de téléphone invalide', 'e'); return; }
  if (!validatePassword(pw)) { t(pwError(pw) || 'Mot de passe invalide', 'e'); return; }

  const btn = document.getElementById('reg-btn');
  if (btn) { btn.textContent = 'Création...'; btn.disabled = true; }

  try {
    rateLimit('register', 3, 600000);
    const refCode = localStorage.getItem('_ref_code') || null;

    // Le profil (table users) + le rôle sont créés automatiquement côté serveur par un trigger.
    const { data, error } = await db.auth.signUp({
      email: em,
      password: pw,
      options: { data: {
        prenom: pn, nom: nm, telephone: ph,
        utm_source:   localStorage.getItem('_utm_source')   || null,
        utm_medium:   localStorage.getItem('_utm_medium')   || null,
        utm_campaign: localStorage.getItem('_utm_campaign') || null,
        utm_content:  localStorage.getItem('_utm_content')  || null,
        referred_by_code: refCode
      } }
    });
    if (error) { t('Erreur : ' + error.message, 'e'); return; }
    if (refCode) localStorage.removeItem('_ref_code');

    // Session ouverte directement (confirmation email désactivée) -> connexion immédiate
    if (data.session && data.user) {
      const profil = await chargerProfil(data.user.id);
      if (profil) {
        await onLoginSuccess(profil);
        localStorage.setItem('kolisgo_logged_in', '1');
        t(`Bienvenue ${pn} ! 🎉`, 's');
        goNav('home');
        const _l = document.getElementById('home-landing');
        const _d = document.getElementById('home-dash');
        if (_l) _l.style.display = 'none';
        if (_d) _d.style.display = 'block';
        if (typeof celebrate === 'function') celebrate();
        return;
      }
    }

    // Sinon : confirmation par email requise
    t('✉️ Compte créé ! Vérifiez votre email pour le confirmer, puis connectez-vous.', 's');
    goNav('auth');
    authTab('login', document.querySelector('.atab:first-child'));

  } catch (e) {
    t(e.message || 'Erreur lors de l\'inscription', 'e');
  } finally {
    if (btn) { btn.textContent = 'Créer mon compte gratuitement'; btn.disabled = false; }
  }
}

// ── Google OAuth ─────────────────────────
async function loginGoogle() {
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) t('Erreur Google : ' + error.message, 'e');
  } catch (e) {
    t('Erreur : ' + e.message, 'e');
  }
}

// ── Apple OAuth ──────────────────────────
async function loginApple() {
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) t('Erreur Apple : ' + error.message, 'e');
  } catch (e) {
    t('Erreur : ' + e.message, 'e');
  }
}

// ── Déconnexion ──────────────────────────
async function doLogout() {
  await db.auth.signOut();
  user = null;
  window._notifRealtimeStarted = false;
  localStorage.removeItem('kolisgo_logged_in');
  const adminLink = document.getElementById('admin-link');
  if (adminLink) adminLink.style.display = 'none';
  const navLogin2 = document.getElementById('nav-login');
  if (navLogin2) navLogin2.style.display = 'block';
  const navAv2 = document.getElementById('nav-av-wrap');
  if (navAv2) navAv2.style.display = 'none';
  const navNotif2 = document.getElementById('nav-notif');
  if (navNotif2) navNotif2.style.display = 'none';
  const notifBadge2 = document.getElementById('notif-badge');
  if (notifBadge2) { notifBadge2.textContent = ''; notifBadge2.style.display = 'none'; }
  const navImg2 = document.getElementById('nav-av-img');
  const navTxt2 = document.getElementById('nav-av-txt');
  if (navImg2) { navImg2.src = ''; navImg2.style.display = 'none'; }
  if (navTxt2) navTxt2.style.display = '';
  // Réinitialiser les champs profil (évite d'afficher les données de l'ancien compte)
  const moiName = document.getElementById('moi-name');
  const moiEmail = document.getElementById('moi-email');
  if (moiName) moiName.textContent = '';
  if (moiEmail) moiEmail.textContent = '';
  ['m-pn','m-nm','m-em','m-ph','m-adr','m-cp','m-vil','m-dn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  refreshHome();
  goNav('home');
  t('Vous êtes déconnecté · À bientôt !', '');
}

// ── Mot de passe oublié ──────────────────
async function sendResetCode() {
  const email = document.getElementById('forgot-em')?.value.trim().toLowerCase();
  if (!email) { t('Entrez votre email', 'e'); return; }
  if (!validateEmail(email)) { t('Email invalide', 'e'); return; }

  const btn = document.getElementById('forgot-btn');
  if (btn) { btn.textContent = 'Envoi...'; btn.disabled = true; }

  try {
    rateLimit('reset_password', 3, 600000);
    await callEdgeFunction('reset-password', { email });
    sessionStorage.setItem('_resetEmail', email);
    authTab('verify-code', null);
    t('Code envoyé par SMS ✅', 's');
  } catch (e) {
    t(e.message || 'Erreur lors de l\'envoi', 'e');
  } finally {
    if (btn) { btn.textContent = 'Envoyer le code par SMS'; btn.disabled = false; }
  }
}

// ── Vérifier code reset ──────────────────
async function verifyResetCode() {
  const code = document.getElementById('reset-code')?.value.trim();
  const pw = document.getElementById('reset-pw')?.value;
  const pw2 = document.getElementById('reset-pw2')?.value;
  const email = sessionStorage.getItem('_resetEmail');

  if (!code || code.length !== 6) { t('Code à 6 chiffres requis', 'e'); return; }
  if (!validatePassword(pw)) { t(pwError(pw) || 'Mot de passe invalide', 'e'); return; }
  if (pw !== pw2) { t('Les mots de passe ne correspondent pas', 'e'); return; }
  if (!email) { t('Session expirée, recommencez', 'e'); authTab('forgot', null); return; }

  try {
    await callEdgeFunction('verify-reset-code', { email, code, nouveau_mdp: pw });
    t('Mot de passe réinitialisé ! 🎉', 's');
    sessionStorage.removeItem('_resetEmail');
    authTab('login', null);
  } catch (e) {
    t(e.message || 'Code incorrect ou expiré', 'e');
  }
}

// ── Charger profil ───────────────────────
async function chargerProfil(userId) {
  const { data } = await db.from('users').select('*').eq('id', userId).single();
  return data;
}

// ── Après connexion réussie ──────────────
async function onLoginSuccess(profil) {
  if (window._loginInProgress) return;
  window._loginInProgress = true;
  try {
  user = profil;
  const role = await getUserRole(profil.id || profil.auth_id);
  user.role = role;

  // Nav
  const navLoginEl = document.getElementById('nav-login');
  if (navLoginEl) navLoginEl.style.display = 'none';
  const navAvEl = document.getElementById('nav-av-wrap');
  if (navAvEl) navAvEl.style.display = 'block';
  const navAvBadge = document.getElementById('nav-av-badge-fill');
  if (navAvBadge) navAvBadge.setAttribute('fill', profil.is_certified ? '#1D9BF0' : '#cccccc');
  const navNotifEl = document.getElementById('nav-notif');
  if (navNotifEl) navNotifEl.style.display = 'block';
  const navTxt = document.getElementById('nav-av-txt');
  if (navTxt) navTxt.textContent = (profil.prenom?.[0] || '?').toUpperCase();
  const _safePhotoUrl = _safeImgUrl(profil.photo_profil_url);
  if (_safePhotoUrl) {
    const navImg = document.getElementById('nav-av-img');
    if (navImg) { navImg.src = _safePhotoUrl; navImg.style.display = 'block'; }
    if (navTxt) navTxt.style.display = 'none';
  }

  // Profil UI
  const fields = {
    'moi-av-txt': (profil.prenom?.[0] || '?').toUpperCase(),
    'moi-name': (profil.prenom || '') + ' ' + (profil.nom || ''),
    'moi-email': profil.email || '',
    'dash-h': `Bonjour <em>${escapeHtml(profil.prenom)}</em> 👋`,
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) { id === 'dash-h' ? el.innerHTML = val : el.textContent = val; }
  });

  // Photo de profil
  if (_safePhotoUrl) {
    const img = document.getElementById('moi-av-img');
    const txt = document.getElementById('moi-av-txt');
    if (img) { img.src = _safePhotoUrl; img.style.display = 'block'; }
    if (txt) txt.style.display = 'none';
  }

  // Fallback email depuis la session auth si absent dans la table users
  if (!profil.email) {
    const { data: authData } = await db.auth.getSession();
    if (authData?.session?.user?.email) profil.email = authData.session.user.email;
  }

  // Remplir les champs du formulaire profil
  const inputs = {
    'm-pn': profil.prenom, 'm-nm': profil.nom, 'm-em': profil.email,
    'm-ph': profil.telephone, 'm-adr': profil.adresse,
    'm-cp': profil.code_postal, 'm-vil': profil.ville
  };
  Object.entries(inputs).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });

  // Afficher le lien admin si rôle admin
  if (role === ROLES.ADMIN) {
    const adminLink = document.getElementById('admin-link');
    if (adminLink) adminLink.style.display = 'flex';
    if (typeof chargerAdminStats === 'function') chargerAdminStats();
  }

  // Badge certifié (texte)
  const badgeCertifie = document.getElementById('badge-certifie');
  if (badgeCertifie) badgeCertifie.style.display = profil.is_certified ? 'inline' : 'none';

  // Badge certifié (SVG sur photo) — bleu si certifié, gris sinon
  const badgeFill = document.getElementById('badge-certif-fill');
  if (badgeFill) badgeFill.setAttribute('fill', profil.is_certified ? '#1D9BF0' : '#cccccc');

  // Badge note + passages
  const badgeLivr = document.getElementById('badge-livr');
  if (badgeLivr) {
    const note = profil.note_moyenne > 0 ? '⭐' + parseFloat(profil.note_moyenne).toFixed(1) : '⭐ —';
    const nb = profil.nb_livraisons || 0;
    badgeLivr.textContent = `${note} · ${nb} passage${nb !== 1 ? 's' : ''}`;
  }

  if (typeof afficherBadgeProfil === 'function') afficherBadgeProfil(profil.badge);

  refreshHome();
  chargerPortefeuille(profil.id);
  chargerLivraisonsEnCours(profil.id);
  chargerKPIs(profil.id, profil);
  chargerActiviteRecente(profil.id);
  if (typeof chargerNotifsCount === 'function') chargerNotifsCount();
  if (!window._notifRealtimeStarted && typeof initNotifRealtime === 'function') {
    initNotifRealtime();
    window._notifRealtimeStarted = true;
  }
  if (typeof chargerRecus === 'function') chargerRecus(profil.id);
  if (typeof loadAffiliateCard === 'function') loadAffiliateCard();
  if (typeof majBadgeMessages === 'function') majBadgeMessages();
  if (typeof initMessagesRealtime === 'function') initMessagesRealtime();

  // App tour — première connexion uniquement
  const tourKey = 'kolisgo_app_tour_' + profil.id;
  if (!localStorage.getItem(tourKey) && typeof showAppTour === 'function') {
    setTimeout(() => showAppTour(profil.id), 900);
  }
  } finally {
    window._loginInProgress = false;
  }
}

// ── Tabs auth ────────────────────────────
function authTab(tab, el) {
  ['at-login', 'at-register', 'at-forgot', 'at-verify-code'].forEach(id => {
    const e2 = document.getElementById(id);
    if (e2) e2.style.display = 'none';
  });
  document.querySelectorAll('.atab').forEach(a => a.classList.remove('on'));
  const target = document.getElementById('at-' + tab);
  if (target) target.style.display = 'block';
  if (el) el.classList.add('on');
  if (tab === 'login') document.querySelector('.atab:first-child')?.classList.add('on');
  if (tab === 'register') document.querySelector('.atab:last-child')?.classList.add('on');
}

function atab(tab, el) { authTab(tab === 'l' ? 'login' : 'register', el); }

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}
