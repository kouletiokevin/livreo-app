/* ═══════════════════════════════════════
   KOLISGO — Module Suivi colis
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Colis courant ────────────────────────
let _currentColis = null;

// ── Recherche suivi ──────────────────────
async function loadSuivi() {
  const svInput = document.getElementById('sv-input');
  if (!svInput) return;
  const val = svInput.value.trim().toUpperCase();
  if (!val) { t('Entrez votre numéro de suivi', 'e'); return; }

  const { data: colis, error } = await db.from('colis_public').select('*').eq('code_lvr', val).single();
  if (error || !colis) { t('Code LVR introuvable. Vérifiez le code reçu par SMS.', 'e'); return; }

  _currentColis = colis;
  qrLoaded = false;

  const svRef = document.getElementById('sv-ref');
  if (svRef) svRef.textContent = colis.code_lvr;

  const isExp = user && user.id === colis.expediteur_id;

  const svExp = document.getElementById('sv-exp');
  const svDest = document.getElementById('sv-dest');

  if (isExp) {
    if (svExp) svExp.style.display = 'block';
    if (svDest) svDest.style.display = 'none';

    // Proposer de noter le passeur si la livraison est confirmée
    const expEl = document.getElementById('sv-exp');
    const existingBtn = document.getElementById('sv-noter-btn');
    if (existingBtn) existingBtn.remove();
    if (colis.statut === 'livre' && colis.livreur_id && svExp) {
      const btn = document.createElement('button');
      btn.id = 'sv-noter-btn';
      btn.className = 'btn p full';
      btn.style.marginTop = '16px';
      btn.textContent = '⭐ Notez votre passeur';
      btn.onclick = () => ouvrirNotation(colis.id, colis.livreur_id, 'le passeur');
      svExp.appendChild(btn);
    }
  } else {
    if (svExp) svExp.style.display = 'none';
    if (svDest) svDest.style.display = 'block';
    loadQR(colis);
  }
  t('Colis trouvé ✅', 's');
  const contentEl = document.getElementById('content');
  if (contentEl) contentEl.scrollTop = 100;
}

// ── Génération QR Code ───────────────────
async function loadQR(colis) {
  if (qrLoaded) return;
  qrLoaded = true;
  const d = document.getElementById('qr-canvas');
  d.innerHTML = '';
  // qr_secret non exposé dans colis_public — récupéré via RPC serveur
  let secret = null;
  // 1) Secret transmis au destinataire via le lien SMS (?k=)
  try {
    const k = new URLSearchParams(window.location.search).get('k');
    if (k && k.length >= 16) secret = k;
  } catch (e) {}
  // 2) Sinon recuperation serveur (expediteur/passeur connecte)
  if (!secret) {
    try {
      const { data: s } = await db.rpc('get_qr_secret', { p_code_lvr: colis.code_lvr });
      if (s?.secret) secret = s.secret;
    } catch (e) { /* fallback ci-dessous */ }
  }
  if (!secret) secret = crypto.randomUUID();
  const qrText = `KOLISGO|${colis.code_lvr}|${secret}|${Date.now()}`;
  try {
    new QRCode(d, {
      text: qrText,
      width: 170, height: 170,
      colorDark: '#0e1a10', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    setTimeout(() => {
      const img = d.querySelector('img,canvas');
      if (img) { img.style.borderRadius = '4px'; img.style.display = 'block'; }
    }, 120);
  } catch (e) {
    d.innerHTML = `<div style="width:170px;height:170px;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--muted);text-align:center;padding:12px;background:var(--cream);border-radius:8px;">QR Code sécurisé<br>${escapeHtml(colis.code_lvr)}</div>`;
  }
}

// ── Bascule vue destinataire ─────────────
function switchToDestView() {
  if (!_currentColis) return;
  const svExp = document.getElementById('sv-exp');
  const svDest = document.getElementById('sv-dest');
  if (svExp) svExp.style.display = 'none';
  if (svDest) svDest.style.display = 'block';
  qrLoaded = false;
  loadQR(_currentColis);
  const contentEl2 = document.getElementById('content');
  if (contentEl2) contentEl2.scrollTop = 0;
}

// ── Liste de mes colis à suivre (onglet Suivi) ──
async function chargerMesSuivis() {
  const box = document.getElementById('sv-mescolis');
  if (!box) return;
  if (!user) { box.innerHTML = ''; return; }
  box.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:8px 0;">Chargement…</div>';
  try {
    const { data } = await db.from('colis_public')
      .select('code_lvr,gare_depart,gare_arrivee,statut,titre')
      .or(`expediteur_id.eq.${user.id},livreur_id.eq.${user.id}`)
      .in('statut', ['en_attente', 'livreur_accepte', 'en_transit'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (!data || !data.length) {
      box.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:8px 0 14px;">Aucun colis en cours à suivre. Entrez un code ci-dessous.</div>';
      return;
    }
    const lbl = { en_attente: 'En attente de passeur', livreur_accepte: 'Passeur trouvé', en_transit: 'En transit' };
    box.innerHTML = '<div style="font-size:.82rem;font-weight:800;margin:4px 0 8px;">📍 Mes colis en cours</div>' + data.map(c => {
      const code = String(c.code_lvr).replace(/[^A-Za-z0-9_-]/g, '');
      const st = lbl[c.statut] || c.statut;
      return `<div onclick="document.getElementById('sv-input').value='${code}';loadSuivi()" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;cursor:pointer;background:var(--white);">
        <div style="font-size:1.2rem;flex-shrink:0;">📦</div>
        <div style="flex:1;min-width:0;"><div style="font-weight:800;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.titre || 'Colis')} <span style="color:var(--muted);font-weight:600;">${code}</span></div>
        <div style="font-size:.72rem;color:var(--muted);">${escapeHtml((c.gare_depart || '—') + ' → ' + (c.gare_arrivee || '—'))}</div></div>
        <div style="font-size:.64rem;font-weight:800;color:var(--g600);flex-shrink:0;text-align:right;">${st}</div></div>`;
    }).join('');
  } catch (e) { box.innerHTML = ''; }
}
