/* ═══════════════════════════════════════
   KOLISGO — Module Explorer
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Pagination & filtres actifs ──────────
let currentPage    = 0;
const PAGE_SIZE    = 20;
let currentFilter  = 'all';   // conservé pour compatibilité
let currentFilters = [];       // tableau de villes sélectionnées ([] = toutes)

// ── Chargement des colis ─────────────────
async function loadCards(reset = true) {
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
      .select('*')
      .eq('statut', 'en_attente')   // ne montrer que les colis encore disponibles (pas ceux déjà acceptés)
      // Boost d'abord : is_boosted DESC, puis date DESC
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (currentFilters.length === 1) {
      query = query.ilike('gare_arrivee', '%' + currentFilters[0] + '%');
    } else if (currentFilters.length > 1) {
      query = query.or(currentFilters.map(v => `gare_arrivee.ilike.%${v}%`).join(','));
    }

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
      const prenom   = escapeHtml(col.expediteur_prenom || 'Utilisateur');
      const prenomInit = (prenom && prenom.length > 0) ? prenom[0].toUpperCase() : '?';
      const note     = col.note_moyenne;
      const badge    = col.expediteur_badge;
      const userPhoto = col.expediteur_photo ? escapeHtml(col.expediteur_photo) : null;
      const isBoosted = col.is_boosted === true;
      const dep      = col.gare_depart ? escapeHtml(col.gare_depart.split(' ')[0]) : 'À définir';
      const arr      = escapeHtml((col.gare_arrivee || '').split(' ')[0]);
      const dt       = col.date_souhaitee
        ? new Date(col.date_souhaitee).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'})
        : '';
      const titre    = escapeHtml(col.titre || 'Colis');
      const poids    = escapeHtml(col.poids || '');
      const photoUrl = col.photo_emballee_url ? escapeHtml(col.photo_emballee_url) : null;
      const codeLvrJs = "'" + String(col.code_lvr).replace(/[^A-Za-z0-9_-]/g, '') + "'";

      g.insertAdjacentHTML('beforeend',
        '<div class="cc" onclick="openDetail(' + codeLvrJs + ')">'
        + '<div class="cc-img">'
        + (photoUrl
          ? '<img src="' + photoUrl + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy">'
          : '<span style="font-size:3rem;">' + em + '</span>')
        + (isBoosted
          ? '<div class="cc-bdg" style="background:linear-gradient(90deg,#f97316,#ef4444);color:#fff;">⚡ URGENT</div>'
          : '<div class="cc-bdg new">NOUVEAU</div>')
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
        + (userPhoto
          ? '<div class="cav" style="overflow:hidden;padding:0;"><img src="' + userPhoto + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy"></div>'
          : '<div class="cav">' + prenomInit + '</div>')
        + '<div class="pname">' + prenom + (badge === 'certifie' ? badgeBleuSVG(14) : '') + (note && note > 0 ? ' ⭐' + parseFloat(note).toFixed(1) : '') + '</div>'
        + '</div>'
        + '</div></div></div></div>'
      );
    });

    // Bouton "Voir plus" si la page est pleine
    if (data.length === PAGE_SIZE) {
      g.insertAdjacentHTML('afterend',
        '<div id="load-more-wrap" style="text-align:center;padding:16px 0 24px;">'
        + '<button id="load-more-btn" onclick="loadMore()" class="btn s" style="padding:10px 28px;">Voir plus de kolis</button>'
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
async function loadMore() {
  currentPage++;
  await loadCards(false);
}

// ── Filtre legacy (conservé pour compatibilité) ─
async function flt(dest, el) {
  currentFilters = dest === 'all' ? [] : [dest];
  currentFilter  = dest;
  if (typeof _updateFilterBtn === 'function') _updateFilterBtn();
  await loadCards();
}

// ── Détail colis ─────────────────────────
async function openDetail(id) {
  let col = null;
  try {
    const { data, error } = await db.from('colis_public')
      .select('*')
      .eq('code_lvr', id)
      .single();
    if (!error && data) col = data;
  } catch(e) { console.log('openDetail:', e.message); }

  if (!col) {
    t('Impossible de charger les détails. Vérifiez votre connexion.', 'e');
    return;
  }

  const logged     = user !== null;
  const prenom     = escapeHtml(col.expediteur_prenom || 'Expéditeur');
  const note       = col.note_moyenne;
  const badge      = col.expediteur_badge;
  const fmt        = escapeHtml(col.format || 'Colis');
  const poids      = escapeHtml(col.poids || '—');
  const titre      = escapeHtml(col.titre || 'Kolis');
  const dep        = col.gare_depart ? escapeHtml(col.gare_depart) : 'À définir';
  const arr        = escapeHtml(col.gare_arrivee || '');
  const prix       = parseFloat(col.prix) || 0;
  const dt         = col.date_souhaitee
    ? new Date(col.date_souhaitee).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'})
    : '—';
  const emojis     = { 'Lettre': '✉️', 'Pochette': '📬', 'Colis': '📦', 'Bagage': '🧳' };
  const em         = emojis[(col.format || '').split(' ')[0]] || '📦';
  const photoUrl   = col.photo_emballee_url ? escapeHtml(col.photo_emballee_url) : null;
  const codeLvrJs  = "'" + String(col.code_lvr).replace(/[^A-Za-z0-9_-]/g, '') + "'";

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
      <div style="background:var(--g50);border:1px solid var(--g100);border-radius:10px;padding:10px;"><div style="font-size:.6rem;font-weight:800;color:var(--g500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Rémunération</div><div style="font-weight:900;font-size:1.05rem;color:var(--g500);">${prix.toFixed(2).replace('.',',')}€</div><div style="font-size:.6rem;color:var(--muted);margin-top:3px;">Vous recevez ${(prix*0.85).toFixed(2).replace('.',',')} € net (après commission Transcolisgo 15 %)</div></div>
    </div>
    ${logged ? `
      <div style="background:var(--g50);border:1.5px solid var(--g100);border-radius:var(--r);padding:12px;margin-bottom:11px;">
        <div style="font-size:.66rem;font-weight:800;color:var(--g600);margin-bottom:6px;">👤 Expéditeur</div>
        <div style="font-size:.82rem;font-weight:700;">${prenom}${badge === 'certifie' ? badgeBleuSVG() : ''}${note && note > 0 ? ' ⭐' + parseFloat(note).toFixed(1) : ''}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:2px;">Contenu détaillé visible après acceptation · Messagerie intégrée</div>
      </div>
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
let _realtimeThrottle = null;

function initRealtimeExplorer() {
  db.channel('colis_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'colis' },
      () => {
        // Throttle : au plus 1 rechargement toutes les 2 secondes
        if (_realtimeThrottle) return;
        _realtimeThrottle = setTimeout(() => {
          _realtimeThrottle = null;
          loadCards(true);
        }, 2000);
      }
    )
    .subscribe();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRealtimeExplorer);
} else {
  initRealtimeExplorer();
}

// ── Accepter un kolis — formulaire billet ─
let _accBilletFile = null;

function accepterC(id) {
  if (!user) { t('Connectez-vous pour accepter', 'e'); return; }
  const today = new Date().toISOString().split('T')[0];
  openSheet(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <div style="font-size:1rem;font-weight:900;letter-spacing:-.3px;">🚆 Confirmer le passage</div>
      <button onclick="closeSheet()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--muted);padding:4px 8px;">✕</button>
    </div>

    <div style="font-size:.76rem;color:var(--muted);margin-bottom:18px;line-height:1.5;background:var(--cream);padding:10px 12px;border-radius:var(--r);">
      Confirmez votre passage. Les informations ci-dessous sont optionnelles — elles aident au suivi.
    </div>

    <div style="margin-bottom:14px;">
      <div style="font-size:.7rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Votre gare de départ <span style="color:var(--muted2);font-weight:400;">(optionnel)</span></div>
      <div class="tj-card" style="box-shadow:none;margin:0;">
        <div class="tj-row">
          <div class="tj-ico">🚉</div>
          <div class="tj-body">
            <div class="tj-sub">GARE DE DÉPART</div>
            <input type="text" id="acc-dep" class="tj-inp" placeholder="Ville ou gare" autocomplete="off"
              oninput="gareAC('acc-dep','acc-dep-dd');document.getElementById('err-acc-dep').style.display='none';"
              onkeydown="gareKey(event,'acc-dep','acc-dep-dd')">
          </div>
          <button type="button" class="tj-x" id="acc-dep-x" onclick="clearGare('acc-dep','acc-dep-dd','acc-dep-x')" style="display:none;">✕</button>
          <div id="acc-dep-dd" class="gare-popup"></div>
        </div>
      </div>
      <div id="err-acc-dep" style="display:none;font-size:.72rem;color:var(--danger);margin-top:4px;font-weight:700;">Ce champ est obligatoire</div>
    </div>

    <div style="margin-bottom:14px;">
      <div style="font-size:.7rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Date de départ <span style="color:var(--muted2);font-weight:400;">(optionnel)</span></div>
      <input type="date" id="acc-date" min="${today}"
        onchange="document.getElementById('err-acc-date').style.display='none';"
        style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:.88rem;font-weight:600;color:var(--ink);background:#fff;box-sizing:border-box;">
      <div id="err-acc-date" style="display:none;font-size:.72rem;color:var(--danger);margin-top:4px;font-weight:700;">Ce champ est obligatoire</div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:.7rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Billet de train <span style="color:var(--muted2);font-weight:400;">(optionnel)</span></div>
      <div id="acc-billet-zone" onclick="document.getElementById('acc-billet-input').click()"
        style="border:2px dashed var(--border);border-radius:var(--r);padding:18px;text-align:center;cursor:pointer;background:var(--cream);transition:border-color .15s;">
        <div style="font-size:1.6rem;margin-bottom:4px;">📄</div>
        <div style="font-size:.82rem;font-weight:700;color:var(--ink);">Appuyez pour uploader votre billet</div>
        <div style="font-size:.68rem;color:var(--muted);margin-top:3px;">PDF uniquement · Max 10 MB</div>
      </div>
      <input type="file" id="acc-billet-input" accept="application/pdf" style="display:none;" onchange="previewBillet(this)">
      <div id="acc-billet-ok" style="display:none;background:var(--g50);border:1.5px solid var(--g100);border-radius:var(--r);padding:10px 14px;margin-top:6px;font-size:.8rem;font-weight:700;color:var(--g600);">
        📄 <span id="acc-billet-name">Billet prêt à l'envoi</span> ✓
      </div>
      <div id="err-acc-billet" style="display:none;font-size:.72rem;color:var(--danger);margin-top:4px;font-weight:700;">Ce champ est obligatoire</div>
    </div>

    <button id="acc-confirm-btn" onclick="confirmerPassage('${String(id).replace(/[^A-Za-z0-9_-]/g, '')}')"
      class="btn p full" style="font-size:.88rem;font-weight:900;letter-spacing:.4px;">
      CONFIRMER LE PASSAGE →
    </button>
  `);
}

function previewBillet(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') { t('PDF uniquement accepté', 'e'); input.value = ''; return; }
  if (file.size > 10 * 1024 * 1024) { t('Fichier trop lourd (max 10 MB)', 'e'); input.value = ''; return; }
  _accBilletFile = file;
  const billetZone = document.getElementById('acc-billet-zone');
  const billetOk   = document.getElementById('acc-billet-ok');
  const billetErr  = document.getElementById('err-acc-billet');
  if (billetZone) billetZone.style.display = 'none';
  if (billetOk)   billetOk.style.display   = 'block';
  const nameEl = document.getElementById('acc-billet-name');
  if (nameEl) nameEl.textContent = file.name.length > 40 ? file.name.substring(0, 37) + '...' : file.name;
  if (billetErr) billetErr.style.display = 'none';
}

async function confirmerPassage(colisId) {
  const dep  = document.getElementById('acc-dep')?.value.trim();
  const date = document.getElementById('acc-date')?.value;
  // Mode test : aucun champ obligatoire. L'acceptation n'est plus bloquée par le billet.

  const btn = document.getElementById('acc-confirm-btn');
  if (btn) { btn.textContent = 'Confirmation en cours...'; btn.disabled = true; }

  try {
    // 1. Billet OPTIONNEL : uploadé + vérifié seulement s'il est fourni (jamais bloquant)
    let billetPath = null;
    if (_accBilletFile) {
      billetPath = `${user.id}/${colisId}/${Date.now()}.pdf`;
      const { error: uploadErr } = await db.storage
        .from('billets')
        .upload(billetPath, _accBilletFile, { contentType: 'application/pdf', upsert: false });
      if (uploadErr) throw new Error('Upload billet : ' + uploadErr.message);
      try {
        if (btn) btn.textContent = 'Vérification du billet...';
        const verifRes = await fetchWithTimeout(`${SUPA_URL}/functions/v1/verify-billet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (await db.auth.getSession()).data.session.access_token },
          body: JSON.stringify({ billet_path: billetPath, code_lvr: colisId, date_depart: date || new Date().toISOString().slice(0, 10), gare_depart: dep || '' })
        }, 20000);
        await verifRes.json();
      } catch (e) { console.log('verify-billet (non bloquant) :', e.message); }
      if (btn) btn.textContent = 'Confirmation en cours...';
    }

    // 2. Accepter le colis (edge function)
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error('Session expirée, reconnectez-vous');
    const res = await fetchWithTimeout(`${SUPA_URL}/functions/v1/accepter-colis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ code_lvr: colisId, livreur_id: user.id })
    }, 15000);
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Réessayez dans quelques instants');

    // 3. Enregistrer les infos fournies (toutes optionnelles)
    const upd = {};
    if (dep)        upd.gare_depart = dep;
    if (date)       upd.date_depart_passeur = date;
    if (billetPath) upd.billet_url = billetPath;
    if (Object.keys(upd).length) await db.from('colis').update(upd).eq('code_lvr', colisId);

    _accBilletFile = null;
    closeSheet();
    t('Passage confirmé ✅', 's');
    if (typeof celebrate === 'function') celebrate();
    setTimeout(() => goNav('dashboard'), 800);

  } catch (e) {
    t('Erreur : ' + e.message, 'e');
    if (btn) { btn.textContent = 'CONFIRMER LE PASSAGE →'; btn.disabled = false; }
  }
}
