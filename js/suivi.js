/* ═══════════════════════════════════════
   LIVREO — Module Suivi colis
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Recherche suivi ──────────────────────
async function loadSuivi() {
  const val = document.getElementById('sv-input').value.trim().toUpperCase();
  if (!val) { t('Entrez votre numéro de suivi', 'e'); return; }

  const { data: colis, error } = await db.from('colis').select('*').eq('code_lvr', val).single();
  if (error || !colis) { t('Code introuvable. Vérifiez le numéro.', 'e'); return; }

  document.getElementById('sv-ref').textContent = colis.code_lvr;

  const isExp = user && user.id === colis.expediteur_id;

  if (isExp) {
    document.getElementById('sv-exp').style.display = 'block';
    document.getElementById('sv-dest').style.display = 'none';
  } else {
    document.getElementById('sv-exp').style.display = 'none';
    document.getElementById('sv-dest').style.display = 'block';
    loadQR(colis.code_lvr);
  }
  t('Colis trouvé ✅', 's');
  document.getElementById('content').scrollTop = 100;
}

// ── Génération QR Code ───────────────────
function loadQR(ref) {
  if (qrLoaded) return;
  qrLoaded = true;
  const d = document.getElementById('qr-canvas');
  d.innerHTML = '';
  try {
    new QRCode(d, {
      text: `LIVREO|${ref}|DEST:MARIE-DUPONT|${Date.now()}`,
      width: 170, height: 170,
      colorDark: '#0e1a10', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
    setTimeout(() => {
      const img = d.querySelector('img,canvas');
      if (img) { img.style.borderRadius = '4px'; img.style.display = 'block'; }
    }, 120);
  } catch (e) {
    d.innerHTML = `<div style="width:170px;height:170px;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--muted);text-align:center;padding:12px;background:var(--cream);border-radius:8px;">QR Code sécurisé<br>${ref}</div>`;
  }
}

// ── Bascule vue destinataire ─────────────
function switchToDestView() {
  document.getElementById('sv-exp').style.display = 'none';
  document.getElementById('sv-dest').style.display = 'block';
  loadQR('LVR-48291');
  document.getElementById('content').scrollTop = 0;
}
