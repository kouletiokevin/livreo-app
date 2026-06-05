/* ═══════════════════════════════════════
   KOLISGO — Module Authentification
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

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
    t(`Bienvenue ${profil.prenom} ! 👋`, 's');
    goNav('home');

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

    const { data, error } = await db.auth.signUp({ email: em, password: pw });
    if (error) { t('Erreur : ' + error.message, 'e'); return; }

    const { error: profilErr } = await db.from('users').insert({
      id: data.user?.id,
      email: em,
      prenom: pn,
      nom: nm,
      telephone: ph,
    });
    if (profilErr) { t('Erreur création profil : ' + profilErr.message, 'e'); return; }

    await db.from('user_roles').insert({
      user_id: data.user?.id,
      role: ROLES.USER,
    });

    t('✉️ Vérifiez votre email avant de vous connecter. Un lien de confirmation vous a été envoyé.', 's');
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
      options: { redirectTo: window.location.origin }
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
      options: { redirectTo: window.location.origin }
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
  const adminLink = document.getElementById('admin-link');
  if (adminLink) adminLink.style.display = 'none';
  document.getElementById('nav-login').style.display = 'block';
  document.getElementById('nav-av').style.display = 'none';
  document.getElementById('nav-post').style.display = 'none';
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
  user = profil;
  const role = await getUserRole(profil.id || profil.auth_id);
  user.role = role;

  // Nav
  document.getElementById('nav-login').style.display = 'none';
  document.getElementById('nav-av').style.display = 'flex';
  document.getElementById('nav-post').style.display = 'block';
  document.getElementById('nav-av').textContent = profil.prenom[0].toUpperCase();

  // Profil UI
  const fields = {
    'moi-av-txt': profil.prenom[0].toUpperCase(),
    'moi-name': (profil.prenom || '') + ' ' + (profil.nom || ''),
    'moi-email': profil.email || '',
    'dash-h': `Bonjour <em>${escapeHtml(profil.prenom)}</em> 👋`,
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) { id === 'dash-h' ? el.innerHTML = val : el.textContent = val; }
  });

  // Photo de profil
  if (profil.photo_profil_url) {
    const img = document.getElementById('moi-av-img');
    const txt = document.getElementById('moi-av-txt');
    if (img) { img.src = profil.photo_profil_url; img.style.display = 'block'; }
    if (txt) txt.style.display = 'none';
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
  }

  if (typeof afficherBadgeProfil === 'function') afficherBadgeProfil(profil.badge);

  refreshHome();
  chargerPortefeuille(profil.id);
  chargerLivraisonsEnCours(profil.id);
  chargerKPIs(profil.id, profil);
  chargerActiviteRecente(profil.id);
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
