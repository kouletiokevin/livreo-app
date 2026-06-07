/* ═══════════════════════════════════════
   KOLISGO — Module Admin (intégré)
   Stats rapides pour le dashboard Moi
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Stats rapides admin (section Moi) ────
async function chargerAdminStats() {
  const section = document.getElementById('admin-stats-section');
  if (!section || !user || user.role !== ROLES.ADMIN) return;

  try {
    const [usersRes, colisRes, verifRes] = await Promise.all([
      db.from('users').select('id', { count: 'exact', head: true }),
      db.from('colis_public').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
      db.from('verifications_identite').select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    ]);

    const uEl = document.getElementById('admin-stat-users');
    const cEl = document.getElementById('admin-stat-colis');
    const vEl = document.getElementById('admin-stat-verif');
    if (uEl) uEl.textContent = usersRes.count ?? '—';
    if (cEl) cEl.textContent = colisRes.count ?? '—';
    if (vEl) vEl.textContent = verifRes.count ?? '—';
  } catch (e) {
    console.log('Admin stats:', e.message);
  }
}
