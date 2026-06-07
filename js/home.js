/* ═══════════════════════════════════════
   KOLISGO — Module Accueil / Dashboard
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Portefeuille ─────────────────────────
async function chargerPortefeuille(userId) {
  try {
    const { data, error } = await db.rpc('get_wallet_summary', { p_user_id: userId });
    if (error) throw new Error(error.message);

    const libere = parseFloat(data?.libere || 0);
    const escrow = parseFloat(data?.escrow || 0);

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
    const { data } = await db.from('colis_public')
      .select('id, code_lvr, gare_depart, gare_arrivee, statut, prix, num_train, destinataire_nom, expediteur_id')
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
        c.prix,
        c.id,
        c.expediteur_id
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
  if (!isValidUUID(userId)) return;
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

// ── Helpers panels ───────────────────────
function _shHdr(titre) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
    <div style="font-size:1rem;font-weight:900;letter-spacing:-.3px;">${titre}</div>
    <button onclick="closeSheet()" style="width:28px;height:28px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
  </div>`;
}

function _statutLabel(s) {
  const m = {
    en_attente:      ['⏳','#fef3c7','#92400e','En attente'],
    livreur_accepte: ['✅','#dcfce7','#166534','Passeur trouvé'],
    en_transit:      ['🚆','#dbeafe','#1e40af','En transit'],
    livre:           ['📦','#f0fdf4','#15803d','Livré'],
    annule:          ['❌','#fee2e2','#991b1b','Annulé'],
    litige:          ['⚠️','#fff7ed','#c2410c','Litige'],
    escrow:          ['🔒','#f3f4f6','#374151','En attente'],
    libere:          ['💚','#dcfce7','#166534','Versé'],
    rembourse:       ['↩️','#fef3c7','#92400e','Remboursé'],
  };
  const [ico, bg, col, lbl] = m[s] || ['—','#f9fafb','#6b7280', s || '—'];
  return `<span style="font-size:.62rem;font-weight:800;padding:2px 7px;border-radius:50px;background:${bg};color:${col};white-space:nowrap;">${ico} ${lbl}</span>`;
}

function _dtFr(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function _trajet(dep, arr) {
  const short = s => (s || '').split(' ')[0];
  return `<span style="font-size:.78rem;font-weight:700;">${escapeHtml(short(dep))}</span>`
       + `<span style="color:var(--muted);margin:0 4px;">→</span>`
       + `<span style="font-size:.78rem;font-weight:700;">${escapeHtml(short(arr))}</span>`;
}

function _emptyMsg(msg) {
  return `<div style="text-align:center;padding:32px 16px;color:var(--muted);font-size:.84rem;">${msg}</div>`;
}

// ── Card "Kolis envoyés" ─────────────────
async function voirKolisEnvoyes() {
  if (!user) return;
  openSheet(_shHdr('📦 Kolis envoyés') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('colis')
      .select('code_lvr, gare_depart, gare_arrivee, date_souhaitee, statut, prix, created_at')
      .eq('expediteur_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('📦 Kolis envoyés');
    if (!data || !data.length) {
      html += _emptyMsg('Vous n\'avez encore rien envoyé');
    } else {
      html += data.map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="flex-shrink:0;">
            <div style="font-size:.7rem;font-weight:900;color:var(--g600);font-family:monospace;">${escapeHtml(c.code_lvr)}</div>
            <div style="margin-top:3px;">${_trajet(c.gare_depart, c.gare_arrivee)}</div>
          </div>
          <div style="flex:1;min-width:0;text-align:right;">
            <div style="font-size:.78rem;font-weight:800;color:var(--g500);">${parseFloat(c.prix).toFixed(2).replace('.',',')}€</div>
            <div style="font-size:.68rem;color:var(--muted);margin-bottom:3px;">${_dtFr(c.date_souhaitee || c.created_at)}</div>
            ${_statutLabel(c.statut)}
          </div>
        </div>`).join('');
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('📦 Kolis envoyés') + _emptyMsg('Impossible de charger les données'));
  }
}

// ── Card "Passages" ──────────────────────
async function voirPassages() {
  if (!user) return;
  openSheet(_shHdr('🚆 Mes passages') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('colis')
      .select('code_lvr, gare_depart, gare_arrivee, date_souhaitee, statut, prix, created_at')
      .eq('livreur_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('🚆 Mes passages');
    if (!data || !data.length) {
      html += _emptyMsg('Vous n\'avez encore effectué aucun passage');
    } else {
      html += data.map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="flex-shrink:0;">
            <div style="font-size:.7rem;font-weight:900;color:var(--g600);font-family:monospace;">${escapeHtml(c.code_lvr)}</div>
            <div style="margin-top:3px;">${_trajet(c.gare_depart, c.gare_arrivee)}</div>
          </div>
          <div style="flex:1;min-width:0;text-align:right;">
            <div style="font-size:.78rem;font-weight:800;color:var(--g500);">+${parseFloat(c.prix).toFixed(2).replace('.',',')}€</div>
            <div style="font-size:.68rem;color:var(--muted);margin-bottom:3px;">${_dtFr(c.date_souhaitee || c.created_at)}</div>
            ${_statutLabel(c.statut)}
          </div>
        </div>`).join('');
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('🚆 Mes passages') + _emptyMsg('Impossible de charger les données'));
  }
}

// ── Card "Gains totaux" ──────────────────
async function voirGains() {
  if (!user) return;
  openSheet(_shHdr('💰 Gains totaux') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('transactions')
      .select('montant, statut, created_at, colis(code_lvr, gare_depart, gare_arrivee)')
      .eq('livreur_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('💰 Gains totaux');
    if (!data || !data.length) {
      html += _emptyMsg('Aucun gain pour le moment');
    } else {
      const total = data.reduce((s, tx) => s + parseFloat(tx.montant || 0), 0);
      html += data.map(tx => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.7rem;font-weight:900;color:var(--g600);font-family:monospace;">${escapeHtml(tx.colis?.code_lvr || '—')}</div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:2px;">${_dtFr(tx.created_at)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:.88rem;font-weight:900;color:var(--g500);">+${parseFloat(tx.montant || 0).toFixed(2).replace('.',',')}€</div>
            <div style="margin-top:3px;">${_statutLabel(tx.statut)}</div>
          </div>
        </div>`).join('');
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0 4px;margin-top:4px;border-top:2px solid var(--ink);">
        <span style="font-size:.84rem;font-weight:900;">Total</span>
        <span style="font-size:1.1rem;font-weight:900;color:var(--g500);">${total.toFixed(2).replace('.',',')}€</span>
      </div>`;
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('💰 Gains totaux') + _emptyMsg('Impossible de charger les données'));
  }
}

// ── Card "Ma note" ───────────────────────
async function voirAvis() {
  if (!user) return;
  openSheet(_shHdr('⭐ Mes avis reçus') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('avis')
      .select('note, commentaire, created_at, users!avis_auteur_id_fkey(prenom)')
      .eq('cible_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('⭐ Mes avis reçus');
    if (!data || !data.length) {
      html += _emptyMsg('Aucun avis pour le moment');
    } else {
      html += data.map(a => {
        const etoiles = '⭐'.repeat(a.note) + '☆'.repeat(5 - a.note);
        const prenom = escapeHtml(a.users?.prenom || 'Anonyme');
        return `
          <div style="padding:12px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:.95rem;letter-spacing:1px;">${etoiles}</span>
              <span style="font-size:.7rem;color:var(--muted);">${_dtFr(a.created_at)}</span>
            </div>
            ${a.commentaire ? `<div style="font-size:.8rem;color:var(--ink);line-height:1.5;margin-bottom:4px;">"${escapeHtml(a.commentaire)}"</div>` : ''}
            <div style="font-size:.7rem;font-weight:700;color:var(--g600);">— ${prenom}</div>
          </div>`;
      }).join('');
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('⭐ Mes avis reçus') + _emptyMsg('Impossible de charger les avis'));
  }
}

// ── KPIs dashboard ───────────────────────
async function chargerKPIs(userId, profil) {
  const nbEnvoyes   = profil?.nb_colis_envoyes || 0;
  const nbLivraisons = profil?.nb_livraisons   || 0;
  const note        = profil?.note_moyenne     || 0;

  const { data: gainsData } = await db.rpc('get_kpi_gains', { p_user_id: userId });
  const gains = parseFloat(gainsData || 0);

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('kpi-envoyes',    nbEnvoyes);
  set('kpi-livraisons', nbLivraisons);
  set('kpi-gains',      gains.toFixed(0) + '€');
  set('kpi-note',       note > 0 ? note.toFixed(1) + '⭐' : '—');
}
