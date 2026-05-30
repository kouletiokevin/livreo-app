/* ═══════════════════════════════════════
   LIVREO — Configuration Supabase
   Sécurité et authentification
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Connexion Supabase ──────────────────
const SUPA_URL = 'https://wqhuaylfytdmhzjauvmv.supabase.co';
const SUPA_KEY = 'sb_publishable_pq9e6TM3kHwpZhoI8Fsq8Q_iIoKBPQ4';

const db = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
  global: {
    headers: {
      'X-App-Name': 'Livreo',
      'X-App-Version': '1.0.0',
    }
  }
});

// ── Rôles utilisateur ───────────────────
const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  LIVREUR_VERIFIE: 'livreur_verifie',
};

// ── Vérification des rôles ──────────────
async function getUserRole(userId) {
  try {
    const { data } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    return data?.role || ROLES.USER;
  } catch (e) {
    return ROLES.USER;
  }
}

async function isAdmin(userId) {
  const role = await getUserRole(userId);
  return role === ROLES.ADMIN;
}

// ── Protection XSS ──────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

// Échappement HTML pour affichage (gère null/undefined/nombres)
function escapeHtml(val) {
  if (val == null) return '';
  return sanitize(String(val));
}

// ── Validation des entrées ───────────────
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^(\+33|0033|0)[1-9](\d{2}){4}$/.test(phone.replace(/[\s\.\-]/g, ''));
}

function validatePassword(pw) {
  if (!pw || pw.length < 8) return false;
  if (!/[A-Z]/.test(pw)) return false;
  if (!/[a-z]/.test(pw)) return false;
  if (!/[0-9]/.test(pw)) return false;
  if (!/[^A-Za-z0-9]/.test(pw)) return false;
  return true;
}

function pwError(pw) {
  const e = [];
  if (!pw || pw.length < 8) e.push('8 caractères min');
  if (!/[A-Z]/.test(pw)) e.push('1 majuscule');
  if (!/[a-z]/.test(pw)) e.push('1 minuscule');
  if (!/[0-9]/.test(pw)) e.push('1 chiffre');
  if (!/[^A-Za-z0-9]/.test(pw)) e.push('1 symbole (!@#$%...)');
  return e.length ? 'Requis : ' + e.join(', ') : null;
}

// ── Protection CSRF ──────────────────────
function generateCSRFToken() {
  return crypto.randomUUID();
}

const csrfToken = generateCSRFToken();

// ── Rate limiting côté client ────────────
const rateLimits = {};
function rateLimit(action, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  if (!rateLimits[action]) rateLimits[action] = [];
  rateLimits[action] = rateLimits[action].filter(ts => now - ts < windowMs);
  if (rateLimits[action].length >= maxAttempts) {
    throw new Error(`Trop de tentatives. Réessayez dans ${Math.ceil(windowMs / 60000)} minute(s).`);
  }
  rateLimits[action].push(now);
}

// ── Appel sécurisé aux Edge Functions ────
async function callEdgeFunction(name, body) {
  const { data: { session } } = await db.auth.getSession();
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${SUPA_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(err.error || 'Erreur serveur');
  }
  return res.json();
}

// ── Validation UUID ──────────────────────
function isValidUUID(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

// ── Vérification de session au démarrage ─
async function checkSession() {
  try {
    const { data: { session }, error } = await db.auth.getSession();
    if (error) throw error;
    if (!session) return null;

    if (!isValidUUID(session.user.id)) {
      await db.auth.signOut();
      return null;
    }

    const expiresAt = session.expires_at * 1000;
    if (Date.now() > expiresAt) {
      await db.auth.signOut();
      return null;
    }

    const { data: profil, error: profilErr } = await db
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profilErr || !profil) return null;

    const role = await getUserRole(session.user.id);

    return { ...profil, auth_id: session.user.id, role, session };
  } catch (e) {
    console.error('checkSession:', e.message);
    return null;
  }
}

// ── Envoi SMS sécurisé ───────────────────
async function envoyerSMS(telephone, message) {
  try {
    if (!validatePhone(telephone)) {
      console.warn('Numéro de téléphone invalide:', telephone);
      return;
    }
    await callEdgeFunction('send-sms', { telephone, message });
  } catch (e) {
    console.log('SMS non envoyé:', e.message);
  }
}

// ── Log de sécurité ──────────────────────
async function logSecurityEvent(type, details = {}) {
  try {
    await db.from('security_logs').insert({
      type,
      details,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    }).single();
  } catch (e) {
    // Silencieux — ne pas bloquer l'app
  }
}
