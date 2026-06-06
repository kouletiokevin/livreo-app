/* ═══════════════════════════════════════
   KOLISGO — Module Explorer
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Pagination & filtre actif ─────────────
let currentPage = 0;
const PAGE_SIZE = 20;
let currentFilter = 'all';

// ── Chargement des colis ─────────────────
async function loadCards(dest = 'all', reset = true) {
  if (reset) currentPage = 0;

  const g = document.getElementById('cgrid');
  if (!g) return;

  // Retirer le bouton "Voir plus" précédent
  const oldWrap = document.getElementById('load-more-wrap');
  if (oldWrap) oldWrap.remove();

  if (reset) {
    g.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.84rem;">Chargement...</div>';
  }

  try {
    let query = db.from('colis_public')
      .select('*, users!colis_expediteur_id_fkey(prenom,note_moyenne,badge)')
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (dest !== 'all') query = query.ilike('gare_arrivee', '%' + dest + '%');

    const { data, error } = await query;

    if (error) {
      console.error('Explorer:', error.message);
      if (reset) g.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:2.5rem;margin-bottom:12px;">📭</div>
          <div style="font-weight:800;font-size:.95rem;margin-bottom:6px;">Impossible de charger les colis</div>
          <div style="font-size:.8rem;color:var(--muted);margin-bottom:16px;">Vérifiez votre connexion et réessayez.</div>
          <button onclick="loadCards()" style="padding:10px 24px;background:var(--g500);color:#fff;border:none;border-radius:50px;font-family:var(--sans);font-size:.84rem;font-weight:700;cursor:pointer;">Réessayer</button>
        </div>`;
      return;
    }

    if (!data || data.length === 0) {
      if (reset) g.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:2.5rem;">📭</div>
          <div style="font-weight:800;font-size:.95rem;margin-top:12px;">Aucun kolis disponible</div>
          <div style="color:var(--muted);font-size:.8rem;margin-top:6px;">Soyez le premier à poster un kolis !</div>
        </div>`;
      return;
    }

    if (reset) g.innerHTML = '';

    const emojis = { 'Lettre': '✉️', 'Pochette': '📬', 'Colis': '📦', 'Bagage': '🧳' };

    data.forEach(col => {
      const prix     = parseFloat(col.prix) || 7;
      const fmt      = escapeHtml(col.format || 'Colis');
      const em       = emojis[(col.format || '').split(' ')[0]] || '📦';
      const prenom   = escapeHtml(col.users?.prenom || 'Utilisateur');
      const note     = col.users?.note_moyenne;
      const badge    = col.users?.badge;
      const dep      = escapeHtml((col.gare_depart  || '').split(' ')[0]);
      const arr      = escapeHtml((col.gare_arrivee || '').split(' ')[0]);
      const dt       = col.date_souhaitee
        ? new Date(col.date_souhaitee).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : '';
      const titre    = escapeHtml(col.titre || 'Colis');
      const poids    = escapeHtml(col.poids || '');
      const photoUrl = col.photo_emballee_url ? escapeHtml(col.photo_emballee_url) : null;
      const codeLvrJs = JSON.stringify(col.code_lvr);

      g.insertAdjacentHTML('beforeend',
        '<div class="cc" onclick="openDetail(' + codeLvrJs + ')">'
        + '<div class="cc-img">'
        + (photoUrl
          ? '<img src="' + photoUrl + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy">'
          : '<span style="font-size:3rem;">' + em + '</span>')
        + '<div class="cc-bdg new">NOUVEAU</div>'
        + '</div>'
        + '<div class="cc-body">'
        + '<div class="cc-route"><div class="cc-city">' + dep + '</div><div class="cc-arr">→</div><div class="cc-city">' + arr + '</div></div>'
        + '<div class="cc-title">' + titre + '</div>'
        + '<div class="cc-meta"><div class="cc-tag">' + fmt + '</div>'
        + (poids ? '<div class="cc-tag">' + poids + '</div>' : '')
        + (dt ? '<div class="cc-tag">📅 ' + dt + '</div>' : '')
        + '</div>'
        + '<div class="cc-foot">'
        + '<div class="cc-price">' + prix.toFixed(2).replace('.', ',') + '€ <span>pour le passeur</span></div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">'
        + '<div style="display:flex;align-items:center;gap:4px;">'
        + '<div class="cav">' + prenom[0].toUpperCase() + '</div>'
        + '<div class="pname">' + prenom + (note && note > 0 ? ' ⭐' + parseFloat(note).toFixed(1) : '') + '</div>'
        + '</div>'
        + (badge && badge !== 'aucun' && typeof badgeHTML === 'function' ? badgeHTML(badge) : '')
        + '</div></div></div></div>'
      );
    });

    // Bouton "Voir plus" si la page est pleine
    if (data.length === PAGE_SIZE) {
      const destSafe = dest.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      g.insertAdjacentHTML('afterend',
        '<div id="load-more-wrap" style="text-align:center;padding:16px 0 24px;">'
        + '<button id="load-more-btn" onclick="loadMore(\'' + destSafe + '\')" class="btn s" style="padding:10px 28px;">Voir plus de kolis</button>'
        + '</div>'
      );
    }

  } catch (e) {
    console.error('Explorer:', e.message);
    if (reset) g.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:2.5rem;margin-bottom:12px;">📭</div>
        <div style="font-weight:800;font-size:.95rem;margin-bottom:6px;">Impossible de charger les colis</div>
        <div style="font-size:.8rem;color:var(--muted);margin-bottom:16px;">Vérifiez votre connexion et réessayez.</div>
        <button onclick="loadCards()" style="padding:10px 24px;background:var(--g500);color:#fff;border:none;border-radius:50px;font-family:var(--sans);font-size:.84rem;font-weight:700;cursor:pointer;">Réessayer</button>
      </div>`;
  }
}

// ── Page suivante ─────────────────────────
async function loadMore(dest) {
  currentPage++;
  await loadCards(dest, false);
}

// ── Filtre destination ───────────────────
async function flt(dest, el) {
  document.querySelectorAll('.ftag').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  currentFilter = dest;
  await loadCards(dest);
}

// ── Détail colis ─────────────────────────
async function openDetail(id) {
  let col = null;
  try {
    const { data, error } = await db.from('colis_public')
      .select('*, users!colis_expediteur_id_fkey(prenom,note_moyenne,badge)')
      .eq('code_lvr', id)
      .single();
    if (!error && data) col = data;
  } catch(e) { console.log('openDetail:', e.message); }

  if (!col) {
    t('Impossible de charger les détails. Vérifiez votre connexion.', 'e');
    return;
  }

  const logged     = user !== null;
  const prenom     = escapeHtml(col.users?.prenom || 'Expéditeur');
  const note       = col.users?.note_moyenne;
  const badge      = col.users?.badge;
  const fmt        = escapeHtml(col.format || 'Colis');
  const poids      = escapeHtml(col.poids || '—');
  const titre      = escapeHtml(col.titre || 'Kolis');
  const dep        = escapeHtml(col.gare_depart || '');
  const arr        = escapeHtml(col.gare_arrivee || '');
  const prix       = parseFloat(col.prix) || 0;
  const dt         = col.date_souhaitee
    ? new Date(col.date_souhaitee).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    : '—';
  const emojis     = { 'Lettre': '✉️', 'Pochette': '📬', 'Colis': '📦', 'Bagage': '🧳' };
  const em         = emojis[(col.format || '').split(' ')[0]] || '📦';
  const photoUrl   = col.photo_emballee_url ? escapeHtml(col.photo_emballee_url) : null;
  const codeLvrJs  = JSON.stringify(col.code_lvr);

  openSheet(`
    <div style="font-size:1.1rem;font-weight:900;letter-spacing:-.5px;margin-bottom:3px;">${titre}</div>
    <div style="font-size:.76rem;color:var(--muted);margin-bottom:12px;">${dep} → ${arr} · ${fmt}</div>
    <div style="background:var(--cream);border-radius:var(--r);padding:20px;text-align:center;margin-bottom:12px;">
      ${photoUrl
        ? `<img loading="lazy" src="${photoUrl}" style="width:120px;height:120px;object-fit:cover;border-radius:10px;">`
        : `<span style="font-size:3.5rem;">${em}</span>`}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px;">
      <div style="background:var(--cream);border-radius:10px;padding:10px;"><div style="font-size:.6rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Format</div><div style="font-weight:800;font-size:.84rem;">${fmt}</div></div>
      <div style="background:var(--cream);border-radius:10px;padding:10px;"><div style="font-size:.6rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Poids</div><div style="font-weight:800;font-size:.84rem;">${poids}</div></div>
      <div style="background:var(--cream);border-radius:10px;padding:10px;"><div style="font-size:.6rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Date</div><div style="font-weight:800;font-size:.84rem;">${dt}</div></div>
      <div style="background:var(--g50);border:1px solid var(--g100);border-radius:10px;padding:10px;"><div style="font-size:.6rem;font-weight:800;color:var(--g500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Rémunération</div><div style="font-weight:900;font-size:1.05rem;color:var(--g500);">${prix.toFixed(2).replace('.',',')}€</div></div>
    </div>
    ${logged ? `
      <div style="background:var(--g50);border:1.5px solid var(--g100);border-radius:var(--r);padding:12px;margin-bottom:11px;">
        <div style="font-size:.66rem;font-weight:800;color:var(--g600);margin-bottom:6px;">📸 Contenu du colis</div>
        <div style="font-size:.7rem;color:var(--muted);">Détails complets visibles après acceptation.</div>
      </div>
      <div style="background:var(--cream);border-radius:var(--r);padding:11px;margin-bottom:12px;">
        <div style="font-size:.64rem;font-weight:800;color:var(--muted);margin-bottom:3px;">📞 Contact expéditeur (après acceptation)</div>
        <div style="font-size:.82rem;font-weight:700;">${prenom}${note && note > 0 ? ' ⭐' + parseFloat(note).toFixed(1) : ''} · <span style="color:var(--g500);">06 ·· ·· ·· ··</span></div>
      </div>
      ${badge && badge !== 'aucun' && typeof badgeHTML === 'function' ? '<div style="margin-bottom:12px;">' + badgeHTML(badge) + '</div>' : ''}
      ${col.statut === 'en_attente'
        ? `<button class="btn p full" onclick="accepterC(${codeLvrJs})">🤝 Accepter de livrer ce kolis</button>`
        : `<div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:var(--r);padding:14px;text-align:center;font-size:.84rem;font-weight:700;color:#166534;">✅ Ce kolis a déjà un passeur assigné</div>`
      }
    ` : `
      <div style="background:var(--ink);border-radius:var(--r);padding:16px;text-align:center;margin-bottom:11px;">
        <div style="font-size:1.5rem;margin-bottom:6px;">🔒</div>
        <div style="color:#fff;font-size:.84rem;font-weight:700;margin-bottom:2px;">Connectez-vous pour voir les détails</div>
        <div style="color:rgba(255,255,255,.38);font-size:.68rem;">Coordonnées et contenu privés jusqu'à l'acceptation.</div>
      </div>
      <button class="btn p full" onclick="closeSheet();goNav('auth')">Se connecter →</button>
    `}
  `);
}

// ── Realtime — mise à jour automatique ───
db.channel('colis_realtime')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'colis' },
    () => { loadCards(currentFilter, true); }
  )
  .subscribe();

// ── Accepter un kolis ────────────────────
async function accepterC(id) {
  if (!user) { t('Connectez-vous pour accepter', 'e'); return; }
  closeSheet();
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { t('Session expirée, reconnectez-vous', 'e'); return; }
    const res = await fetchWithTimeout(`${SUPA_URL}/functions/v1/accepter-colis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ code_lvr: id, livreur_id: user.id })
    }, 15000);
    const data = await res.json();
    if (data.success) {
      t(`Colis ${id} accepté ! SMS envoyé au destinataire ✅`, 's');
      setTimeout(() => goNav('dashboard'), 800);
    } else {
      t('Erreur : ' + (data.error || 'Réessayez'), 'e');
    }
  } catch (e) {
    t('Erreur réseau. Réessayez dans quelques secondes.', 'e');
  }
}
