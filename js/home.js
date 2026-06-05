/* ═══════════════════════════════════════
   KOLISGO — Module Accueil / Dashboard
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Portefeuille ─────────────────────────
async function chargerPortefeuille(userId) {
  try {
    const { data } = await db.from('transactions')
      .select('montant, statut')
      .eq('livreur_id', userId);

    if (!data) return;

    const libere = data.filter(t => t.statut === 'libere').reduce((s, t) => s + parseFloat(t.montant || 0), 0);
    const escrow = data.filter(t => t.statut === 'escrow').reduce((s, t) => s + parseFloat(t.montant || 0), 0);

    const walletEl = document.getElementById('wallet-amount');
    const pendingEl = document.getElementById('wallet-pending');
    if (walletEl) walletEl.textContent = libere.toFixed(2).replace('.', ',') + '€';
    if (pendingEl) pendingEl.textContent = escrow > 0
      ? `Dont ${escrow.toFixed(2).replace('.', ',')}€ en attente de validation`
      : 'Aucun paiement en attente';
  } catch (e) { console.log('Portefeuille:', e.message); }
}

// ── Livraisons en cours ──────────────────
async function chargerLivraisonsEnCours(userId) {
  const container = document.getElementById('livraisons-list');
  if (!container) return;

  try {
    const { data } = await db.from('colis')
      .select('*')
      .eq('livreur_id', userId)
      .in('statut', ['livreur_accepte', 'en_transit'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return;

    const empty = document.getElementById('livraisons-empty');
    if (empty) empty.remove();

    data.forEach(c => {
      const div = document.createElement('div');
      div.className = 'livr-item';
      div.onclick = () => openLivrFlow(
        c.code_lvr,
        `${c.gare_depart} → ${c.gare_arrivee}`,
        c.num_train || 'Train',
        c.destinataire_nom,
        c.prix
      );
      div.innerHTML = `
        <div class="li-icon">📦</div>
        <div style="flex:1;">
          <div class="li-ref">${escapeHtml(c.code_lvr)}</div>
          <div class="li-detail">${escapeHtml(c.gare_depart)} → ${escapeHtml(c.gare_arrivee)} · ${escapeHtml(c.destinataire_nom)}</div>
          <div style="margin-top:3px;"><span class="prt">🚆 ${c.statut === 'en_transit' ? 'En transit' : 'En attente départ'}</span></div>
        </div>
        <div class="li-price">+${parseFloat(c.prix).toFixed(0)}€</div>
        <div class="li-arrow">›</div>`;
      container.appendChild(div);
    });
  } catch (e) {
    console.error('Livraisons:', e.message);
    const empty = document.getElementById('livraisons-empty');
    if (empty) empty.textContent = 'Impossible de charger vos passages.';
  }
}

// ── Retrait de fonds ─────────────────────
function ouvrirRetrait() {
  openSheet(`
    <div style="text-align:center;padding:20px;">
      <div style="font-size:2.5rem;margin-bottom:12px;">💸</div>
      <div style="font-weight:900;font-size:1.1rem;margin-bottom:8px;">Retrait de fonds</div>
      <div style="font-size:.82rem;color:var(--muted);margin-bottom:20px;line-height:1.6;">
        Les virements automatiques vers votre compte bancaire seront disponibles prochainement via Stripe Connect.<br><br>
        Pour retirer vos fonds dès maintenant, contactez-nous :
      </div>
      <a href="mailto:support@kolisgo.fr" style="display:block;padding:12px;background:var(--g500);color:#fff;border-radius:50px;font-weight:700;font-size:.86rem;text-decoration:none;margin-bottom:8px;">
        📧 support@kolisgo.fr
      </a>
      <button onclick="closeSheet()" class="btn s full">Fermer</button>
    </div>
  `);
}

// ── Activité récente ─────────────────────
async function chargerActiviteRecente(userId) {
  try {
    const { data } = await db
      .from('transactions')
      .select('montant, statut, created_at, colis(code_lvr, gare_depart, gare_arrivee)')
      .or(`expediteur_id.eq.${userId},livreur_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(5);

    const tbody = document.getElementById('activity-tbody');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted);">Aucune activité pour le moment</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(tx => `
      <tr>
        <td><strong>${escapeHtml(tx.colis?.code_lvr || '—')}</strong></td>
        <td style="font-size:.76rem;">${escapeHtml(tx.colis?.gare_depart || '?')} → ${escapeHtml(tx.colis?.gare_arrivee || '?')}</td>
        <td style="color:var(--g500);font-weight:800;">${parseFloat(tx.montant || 0).toFixed(2)}€</td>
        <td>${escapeHtml(tx.statut || '—')}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.log('Activité:', e.message);
  }
}

// ── KPIs dashboard ───────────────────────
async function chargerKPIs(userId, profil) {
  const nbEnvoyes   = profil?.nb_colis_envoyes || 0;
  const nbLivraisons = profil?.nb_livraisons   || 0;
  const note        = profil?.note_moyenne     || 0;

  const { data } = await db.from('transactions')
    .select('montant')
    .eq('livreur_id', userId)
    .eq('statut', 'libere');

  const gains = (data || []).reduce((s, t) => s + parseFloat(t.montant || 0), 0);

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('kpi-envoyes',    nbEnvoyes);
  set('kpi-livraisons', nbLivraisons);
  set('kpi-gains',      gains.toFixed(0) + '€');
  set('kpi-note',       note > 0 ? note.toFixed(1) + '⭐' : '—');
}
