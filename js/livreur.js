/* ═══════════════════════════════════════
   DINVMIC — Module Flow de livraison
   Version 2.0 — Mai 2026
═══════════════════════════════════════ */

let _currentLivraison    = null;
let _scanStream          = null;
let _scanRaf             = null;
let _remisePhotoUrl      = null;
let _lastScannedQrSecret = null;

// ── Ouvrir le flow de livraison ──────────
function openLivrFlow(ref, trajet, train, dest, prix, colisId = null, expediteurId = null) {
  stopCamera();
  _currentLivraison = { ref, dest, prix, colisId, expediteurId };
  _remisePhotoUrl   = null;
  livrPhoto         = false;
  livrChecksOk      = false;

  const eRef    = escapeHtml(ref);
  const eTrajet = escapeHtml(trajet);
  const eTrain  = escapeHtml(train);
  const eDest   = escapeHtml(dest);
  const ePrix   = escapeHtml(String(prix));
  const jRef  = "'" + String(ref).replace(/[^A-Za-z0-9_-]/g, '') + "'";
  const jDest = "'" + String(dest).replace(/[^A-Za-z0-9 _-]/g, '') + "'";
  const jPrix = "'" + String(prix).replace(/[^0-9.,]/g, '') + "'";

  openSheet(`
    <div style="font-size:1rem;font-weight:900;letter-spacing:-.4px;margin-bottom:2px;">Passage ${eRef}</div>
    <div style="font-size:.74rem;color:var(--muted);margin-bottom:16px;">${eTrajet} · ${eTrain} · ${eDest} · <span style="color:var(--g500);font-weight:800;">+${ePrix}€</span></div>
    <div class="livr-steps" id="ls-wrap">

      <div class="lstep active" id="ls1">
        <div class="lsh"><div class="ls-n">1</div><div class="ls-title">📸 Photographier la remise</div></div>
        <div class="ls-body">
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:9px;line-height:1.5;">Prenez une photo du colis <strong>en main du destinataire</strong>. C'est la preuve du passage.</div>
          <div class="photo-z" id="pz" onclick="initPhotoRemise()">
            <div class="pz-icon">📷</div>
            <div class="pz-txt">Prendre la photo</div>
            <div class="pz-sub">Colis en main de ${eDest}</div>
          </div>
          <div class="photo-ok" id="photo-ok" style="display:none;">
            <span style="color:var(--g500);font-weight:800;font-size:.8rem;">📸 Photo prise avec succès ✅</span>
          </div>
        </div>
      </div>

      <div class="lstep locked" id="ls2">
        <div class="lsh"><div class="ls-n">2</div><div class="ls-title">✅ Vérification avant scan</div></div>
        <div class="ls-body" id="ls2-body" style="display:none;">
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:9px;">Cochez chaque point avant de scanner le QR Code.</div>
          <div class="check-list">
            <div class="ci"><input type="checkbox" id="c1" onchange="checkAll()"><label for="c1">Le destinataire est bien ${eDest}</label></div>
            <div class="ci"><input type="checkbox" id="c2" onchange="checkAll()"><label for="c2">L'emballage est intact, aucun dommage visible</label></div>
            <div class="ci"><input type="checkbox" id="c3" onchange="checkAll()"><label for="c3">Le colis correspond bien à la référence ${eRef}</label></div>
          </div>
        </div>
      </div>

      <div class="lstep locked" id="ls3">
        <div class="lsh"><div class="ls-n">3</div><div class="ls-title">📱 Scanner le QR Code</div></div>
        <div class="ls-body" id="ls3-body" style="display:none;">
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:10px;line-height:1.5;">Demandez à ${eDest} d'afficher son QR Code dans l'onglet <strong>Suivi</strong>, puis scannez-le.</div>
          <div class="scan-vp" id="scan-vp" style="position:relative;overflow:hidden;">
            <div class="sc tl"></div><div class="sc tr"></div><div class="sc bl"></div><div class="sc br"></div>
            <div class="scan-line"></div>
            <div class="scan-ph"><div style="font-size:1.6rem;margin-bottom:5px;">📷</div>Activation caméra…</div>
          </div>
          <div class="div-or">ou entrer manuellement</div>
          <div class="man-scan">
            <input type="text" id="qr-man" placeholder="${eRef}">
            <button onclick="doScan(${jRef},${jDest},${jPrix})">Scanner ▶</button>
          </div>
        </div>
      </div>

    </div>
  `);
}

// ── Étape 1 : photo réelle avec la caméra ─
function initPhotoRemise() {
  const inp = document.createElement('input');
  inp.type    = 'file';
  inp.accept  = 'image/*';
  inp.capture = 'environment';

  inp.onchange = async function () {
    const file = inp.files[0];
    if (!file) return;

    // Prévisualisation immédiate
    const reader = new FileReader();
    reader.onload = e => {
      const pz = document.getElementById('pz');
      if (pz) pz.innerHTML =
        `<img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid var(--g200);">`;
    };
    reader.readAsDataURL(file);

    // Upload vers photos-colis (bucket privé)
    if (user) {
      try {
        const ext  = file.name.split('.').pop().toLowerCase();
        const ref  = _currentLivraison?.ref || 'livr';
        const path = `${user.id}/remise_${ref}_${Date.now()}.${ext}`;
        const { error } = await db.storage
          .from('photos-colis')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (!error) {
          const { data: signedData, error: signErr } = await db.storage
            .from('photos-colis')
            .createSignedUrl(path, 3600);
          if (signErr) {
            console.error('URL signée impossible:', signErr);
          } else {
            _remisePhotoUrl = signedData.signedUrl;
          }
        }
      } catch (e) { console.log('Upload photo remise:', e.message); }
    }
    doPhoto();
  };
  inp.click();
}

function doPhoto() {
  livrPhoto = true;
  const pz      = document.getElementById('pz');
  const photoOk = document.getElementById('photo-ok');
  const ls2body = document.getElementById('ls2-body');
  if (pz)      pz.style.display      = 'none';
  if (photoOk) photoOk.style.display = 'block';
  const ls1 = document.getElementById('ls1');
  const ls2 = document.getElementById('ls2');
  if (ls1) { ls1.classList.remove('active'); ls1.classList.add('done'); }
  if (ls2) { ls2.classList.remove('locked'); ls2.classList.add('active'); }
  if (ls2body) ls2body.style.display = 'block';
  t('📸 Photo prise ! Cochez les cases.', 's');
}

// ── Étape 2 : checklist ──────────────────
async function checkAll() {
  const cs = document.querySelectorAll('#ls-wrap .check-list input[type=checkbox]');
  let ok = true;
  cs.forEach(c => { if (!c.checked) ok = false; });
  if (ok) {
    livrChecksOk = true;
    const ls2c = document.getElementById('ls2');
    const ls3c = document.getElementById('ls3');
    const ls3body = document.getElementById('ls3-body');
    if (ls2c) { ls2c.classList.remove('active'); ls2c.classList.add('done'); }
    if (ls3c) { ls3c.classList.remove('locked'); ls3c.classList.add('active'); }
    if (ls3body) ls3body.style.display = 'block';
    t('Checklist complète ✅ Activation caméra…', 's');
    const camOk = await demanderCamera();
    if (!camOk) return;
    startCameraScanner();
  }
}

// ── Caméra jsQR ──────────────────────────
function startCameraScanner() {
  const vp = document.getElementById('scan-vp');
  if (!vp) return;

  if (typeof jsQR === 'undefined') {
    t('Scanner caméra indisponible — entrez le code manuellement', '');
    return;
  }

  vp.innerHTML = `
    <video id="scan-video" playsinline autoplay muted
      style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:8px;"></video>
    <canvas id="scan-canvas" style="display:none;"></canvas>
    <div class="sc tl"></div><div class="sc tr"></div><div class="sc bl"></div><div class="sc br"></div>
    <div class="scan-line"></div>
    <div style="position:absolute;bottom:8px;left:0;right:0;text-align:center;
      font-size:.68rem;color:rgba(255,255,255,.9);font-weight:700;
      text-shadow:0 1px 4px rgba(0,0,0,.6);">Pointez vers le QR Code</div>
  `;

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
  })
  .then(stream => {
    _scanStream = stream;
    const video = document.getElementById('scan-video');
    if (!video) { stopCamera(); return; }
    video.srcObject = stream;
    video.play().catch(() => {});
    video.addEventListener('loadedmetadata', () => {
      const { ref, dest, prix } = _currentLivraison || {};
      _scanRaf = requestAnimationFrame(() => scanFrame(ref, dest, prix));
    });
  })
  .catch(err => {
    console.log('Caméra indisponible:', err.message);
    t('Caméra indisponible — entrez le code manuellement', '');
  });
}

function scanFrame(ref, dest, prix) {
  const video  = document.getElementById('scan-video');
  const canvas = document.getElementById('scan-canvas');
  if (!video || !canvas || !_scanStream) return;

  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    _scanRaf = requestAnimationFrame(() => scanFrame(ref, dest, prix));
    return;
  }

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });

  if (code) {
    stopCamera();
    // Format QR DINVMIC : "KOLISGO|LVR-XXXX|secret|timestamp"
    const parts        = code.data.split('|');
    const detectedCode = (parts[1] || code.data).trim().toUpperCase();
    _lastScannedQrSecret = parts[2] || null;
    const qrInput      = document.getElementById('qr-man');
    if (qrInput) qrInput.value = detectedCode;
    t('QR Code détecté ✅', 's');
    doScan(ref, dest, prix);
    return;
  }

  _scanRaf = requestAnimationFrame(() => scanFrame(ref, dest, prix));
}

function stopCamera() {
  if (_scanRaf)    { cancelAnimationFrame(_scanRaf); _scanRaf = null; }
  if (_scanStream) { _scanStream.getTracks().forEach(tr => tr.stop()); _scanStream = null; }
}

// ── Étape 3 : confirmation livraison ─────
async function doScan(ref, dest, prix) {
  if (!livrPhoto)    { t('Prenez la photo en étape 1 d\'abord 📸', 'e'); return; }
  if (!livrChecksOk) { t('Cochez toutes les cases en étape 2 ✅', 'e'); return; }

  stopCamera();

  const input = document.getElementById('qr-man');
  const code  = input ? input.value.trim().toUpperCase() : ref;
  const scannedSecret = _lastScannedQrSecret;

  // Vérification serveur du secret QR (si scan caméra)
  if (_lastScannedQrSecret) {
    try {
      const { data: check } = await db.rpc('verify_qr_secret', {
        p_code_lvr:  code,
        p_qr_secret: _lastScannedQrSecret
      });
      if (!check?.valid) {
        t('QR Code invalide ❌', 'e');
        _lastScannedQrSecret = null;
        return;
      }
    } catch (e) {
      console.log('verify_qr_secret:', e.message);
    }
    _lastScannedQrSecret = null;
  }

  const ls3el = document.getElementById('ls3');
  if (ls3el) { ls3el.classList.remove('active'); ls3el.classList.add('done'); }

  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { t('Session expirée, reconnectez-vous', 'e'); return; }
    const res = await fetchWithTimeout(`${SUPA_URL}/functions/v1/confirm-livraison`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({
        code_lvr:   code,
        livreur_id: user?.id,
        photo_url:  _remisePhotoUrl,
        qr_secret:  scannedSecret
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) { t('Erreur : ' + (data.error || 'Réessayez'), 'e'); return; }
  } catch (e) {
    t('Erreur réseau. Vérifiez votre connexion et réessayez.', 'e');
    return;
  }

  setTimeout(() => {
    closeSheet();
    t(`🎉 Passage confirmé ! Paiement de ${prix}€ déclenché.`, 's');
    if (typeof celebrate === 'function') celebrate();

    const pill = document.getElementById('sv-pill');
    if (pill) { pill.className = 'tpill pill-ok'; pill.textContent = '✅ Livré'; }
    document.querySelectorAll('#sv-tl .tld').forEach(d => { d.classList.remove('active'); d.classList.add('done'); });
    document.querySelectorAll('#sv-tl .tl-txt.faded').forEach(el => el.classList.remove('faded'));

    const qrMain  = document.getElementById('qr-main');
    const destSuc = document.getElementById('dest-suc');
    if (qrMain)  qrMain.style.display  = 'none';
    if (destSuc) destSuc.style.display = 'block';

    if (Notification.permission === 'granted') {
      new Notification('DINVMIC — Passage confirmé ✅', {
        body: `Colis ${ref} remis à ${dest}. Paiement déclenché automatiquement.`
      });
    }

    // Proposer de noter l'expéditeur
    if (_currentLivraison?.colisId && _currentLivraison?.expediteurId) {
      setTimeout(() => ouvrirNotation(
        _currentLivraison.colisId,
        _currentLivraison.expediteurId,
        'l\'expéditeur'
      ), 1400);
    }
  }, 700);
}

// ── Système de notation ──────────────────
let _selectedNote = 0;

function ouvrirNotation(colisId, cibleId, cibleRole) {
  const eRole = escapeHtml(cibleRole);
  openSheet(`
    <div style="text-align:center;padding:8px 0 4px;">
      <div style="font-size:2rem;margin-bottom:8px;">⭐</div>
      <div style="font-weight:900;font-size:1rem;margin-bottom:4px;">Notez ${eRole}</div>
      <div style="font-size:.78rem;color:var(--muted);margin-bottom:20px;">Comment s'est déroulé ce passage ?</div>
    </div>
    <div id="star-wrap" style="display:flex;justify-content:center;gap:14px;margin-bottom:24px;">
      ${[1, 2, 3, 4, 5].map(n =>
        `<span id="star-${n}" onclick="selectStar(${n})"
          style="font-size:2.4rem;cursor:pointer;opacity:.25;transition:opacity .15s;">⭐</span>`
      ).join('')}
    </div>
    <button id="noter-btn" class="btn p full" onclick="soumettreNote('${escapeHtml(colisId)}','${escapeHtml(cibleId)}')" disabled>
      Valider la note
    </button>
    <button onclick="closeSheet()" class="btn s full" style="margin-top:8px;">Plus tard</button>
  `);
  _selectedNote = 0;
}

function selectStar(n) {
  _selectedNote = n;
  for (let i = 1; i <= 5; i++) {
    const s = document.getElementById('star-' + i);
    if (s) s.style.opacity = i <= n ? '1' : '.25';
  }
  const btn = document.getElementById('noter-btn');
  if (btn) btn.disabled = false;
}

async function soumettreNote(colisId, cibleId) {
  if (!_selectedNote || !user) return;
  const btn = document.getElementById('noter-btn');
  if (btn) { btn.textContent = 'Envoi...'; btn.disabled = true; }
  try {
    const { data, error } = await db.rpc('noter_utilisateur', {
      p_auteur_id: user.id,
      p_cible_id:  cibleId,
      p_colis_id:  colisId,
      p_note:      _selectedNote
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    closeSheet();
    t('Note envoyée ✅ Merci !', 's');
    _selectedNote = 0;
  } catch (e) {
    t('Erreur : ' + e.message, 'e');
    if (btn) { btn.textContent = 'Valider la note'; btn.disabled = false; }
  }
}
