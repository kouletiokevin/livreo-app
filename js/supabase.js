/* ═══════════════════════════════════════
   LIVREO — Configuration Supabase
   Sécurité et authentification
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Connexion Supabase ──────────────────
const SUPA_URL = 'https://wqhuaylfytdmhzjauvmv.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxaHVheWxmeXRkbWh6amF1dm12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODk5ODksImV4cCI6MjA5Mzk2NTk4OX0.rTo0Q7h3WnjL9LJ01RGQjq0blaxNtrq5JKvq6U0udLc';

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

// ── Validation des entrées ───────────────
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^(\+33|0033|0)[1-9](\d{2}){4}$/.test(phone.replace(/[\s\.\-]/g, ''));
}

function validatePassword(password) {
  return password && password.length >= 8;
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

// ── Vérification de session au démarrage ─
async function checkSession() {
  try {
    const { data: { session }, error } = await db.auth.getSession();
    if (error) throw error;
    if (!session) return null;

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
