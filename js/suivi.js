/* ═══════════════════════════════════════
   KOLISGO — Module Suivi colis
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Colis courant ────────────────────────
let _currentColis = null;

// ── Recherche suivi ──────────────────────
async function loadSuivi() {
  const val = document.getElementById('sv-input').value.trim().toUpperCase();
  if (!val) { t('Entrez votre numéro de suivi', 'e'); return; }

  const { data: colis, error } = await db.from('colis_public').select('*').eq('code_lvr', val).single();
  if (error || !colis) { t('Code LVR introuvable. Vérifiez le code reçu par SMS.', 'e'); return; }

  _currentColis = colis;
  qrLoaded = false;

  document.getElementById('sv-ref').textContent = colis.code_lvr;

  const isExp = user && user.id === colis.expediteur_id;

  if (isExp) {
    document.getElementById('sv-exp').style.display = 'block';
    document.getElementById('sv-dest').style.display = 'none';

    // Proposer de noter le passeur si la livraison est confirmée
    const expEl = document.getElementById('sv-exp');
    const existingBtn = document.getElementById('sv-noter-btn');
    if (existingBtn) existingBtn.remove();
    if (colis.statut === 'livre' && colis.livreur_id && expEl) {
      const btn = document.createElement('button');
      btn.id = 'sv-noter-btn';
      btn.className = 'btn p full';
      btn.style.marginTop = '16px';
      btn.textContent = '⭐ Notez votre passeur';
      btn.onclick = () => ouvrirNotation(colis.id, colis.livreur_id, 'le passeur');
      expEl.appendChild(btn);
    }
  } else {
    document.getElementById('sv-exp').style.display = 'none';
    document.getElementById('sv-dest').style.display = 'block';
    loadQR(colis);
  }
  t('Colis trouvé ✅', 's');
  document.getElementById('content').scrollTop = 100;
}

// ── Génération QR Code ───────────────────
async function loadQR(colis) {
  if (qrLoaded) return;
  qrLoaded = true;
  const d = document.getElementById('qr-canvas');
  d.innerHTML = '';
  // qr_secret non exposé dans colis_public — récupéré via RPC serveur
  let secret = crypto.randomUUID();
  try {
    const { data: s } = await db.rpc('get_qr_secret', { p_code_lvr: colis.code_lvr });
    if (s?.secret) secret = s.secret;
  } catch (e) { /* fallback UUID si RPC indisponible */ }
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
  document.getElementById('sv-exp').style.display = 'none';
  document.getElementById('sv-dest').style.display = 'block';
  qrLoaded = false;
  loadQR(_currentColis);
  document.getElementById('content').scrollTop = 0;
}
