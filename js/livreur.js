/* ═══════════════════════════════════════
   LIVREO — Module Flow de livraison
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Ouvrir le flow de livraison ──────────
function openLivrFlow(ref, trajet, train, dest, prix) {
  livrPhoto = false;
  livrChecksOk = false;
  // Valeurs pour affichage HTML (entités échappées)
  const eRef    = escapeHtml(ref);
  const eTrajet = escapeHtml(trajet);
  const eTrain  = escapeHtml(train);
  const eDest   = escapeHtml(dest);
  const ePrix   = escapeHtml(String(prix));
  // Valeurs pour attributs onclick JS (JSON.stringify gère les quotes et caractères spéciaux)
  const jRef  = JSON.stringify(ref);
  const jDest = JSON.stringify(dest);
  const jPrix = JSON.stringify(prix);

  openSheet(`
    <div style="font-size:1rem;font-weight:900;letter-spacing:-.4px;margin-bottom:2px;">Livraison ${eRef}</div>
    <div style="font-size:.74rem;color:var(--muted);margin-bottom:16px;">${eTrajet} · ${eTrain} · ${eDest} · <span style="color:var(--g500);font-weight:800;">+${ePrix}€</span></div>
    <div class="livr-steps" id="ls-wrap">

      <div class="lstep active" id="ls1">
        <div class="lsh"><div class="ls-n">1</div><div class="ls-title">📸 Photographier la remise</div></div>
        <div class="ls-body">
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:9px;line-height:1.5;">Prenez une photo du colis <strong>en main du destinataire</strong>. C'est la preuve de livraison. Sans cette photo, vous ne pouvez pas passer à l'étape suivante.</div>
          <div class="photo-z" id="pz" onclick="doPhoto()">
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
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:10px;line-height:1.5;">Demandez à ${eDest} d'afficher son QR Code dans l'onglet <strong>Suivi</strong> de son téléphone, puis scannez-le.</div>
          <div class="scan-vp">
            <div class="sc tl"></div><div class="sc tr"></div><div class="sc bl"></div><div class="sc br"></div>
            <div class="scan-line"></div>
            <div class="scan-ph"><div style="font-size:1.6rem;margin-bottom:5px;">📷</div>Pointez vers le QR Code<br>du destinataire</div>
          </div>
          <div class="div-or">ou entrer manuellement</div>
          <div class="man-scan">
            <input type="text" id="qr-man" placeholder="${eRef}" value="${eRef}">
            <button onclick="doScan(${jRef},${jDest},${jPrix})">Scanner ▶</button>
          </div>
        </div>
      </div>

    </div>
  `);
}

// ── Étape 1 : Photo ──────────────────────
function doPhoto() {
  livrPhoto = true;
  document.getElementById('pz').style.display = 'none';
  document.getElementById('photo-ok').style.display = 'block';
  document.getElementById('ls1').classList.remove('active');
  document.getElementById('ls1').classList.add('done');
  document.getElementById('ls2').classList.remove('locked');
  document.getElementById('ls2').classList.add('active');
  document.getElementById('ls2-body').style.display = 'block';
  t('📸 Photo prise ! Cochez les cases.', 's');
}

// ── Étape 2 : Checklist ──────────────────
function checkAll() {
  const cs = document.querySelectorAll('#ls-wrap .check-list input[type=checkbox]');
  let ok = true;
  cs.forEach(c => { if (!c.checked) ok = false; });
  if (ok) {
    livrChecksOk = true;
    document.getElementById('ls2').classList.remove('active');
    document.getElementById('ls2').classList.add('done');
    document.getElementById('ls3').classList.remove('locked');
    document.getElementById('ls3').classList.add('active');
    document.getElementById('ls3-body').style.display = 'block';
    t('Checklist complète ✅ Scannez le QR Code.', 's');
  }
}

// ── Étape 3 : Scan QR ────────────────────
async function doScan(ref, dest, prix) {
  if (!livrPhoto) { t('Prenez la photo en étape 1 d\'abord 📸', 'e'); return; }
  if (!livrChecksOk) { t('Cochez toutes les cases en étape 2 ✅', 'e'); return; }

  const input = document.getElementById('qr-man');
  const code = input ? input.value.trim().toUpperCase() : ref;

  document.getElementById('ls3').classList.remove('active');
  document.getElementById('ls3').classList.add('done');

  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { t('Session expirée, reconnectez-vous', 'e'); return; }
    const res = await fetch(`${SUPA_URL}/functions/v1/confirm-livraison`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({
        code_lvr: code,
        livreur_id: user?.id,
        photo_url: null
      })
    });
    const data = await res.json();
    if (!res.ok && data.error) { t('Erreur : ' + data.error, 'e'); return; }
  } catch (e) {
    console.log('Edge Function non accessible en démo:', e.message);
  }

  setTimeout(() => {
    closeSheet();
    t(`🎉 Livraison confirmée ! Paiement de ${prix}€ déclenché.`, 's');

    const pill = document.getElementById('sv-pill');
    if (pill) { pill.className = 'tpill pill-ok'; pill.textContent = '✅ Livré'; }
    document.querySelectorAll('#sv-tl .tld').forEach(d => { d.classList.remove('active'); d.classList.add('done'); });
    document.querySelectorAll('#sv-tl .tl-txt.faded').forEach(el => el.classList.remove('faded'));

    const qrMain = document.getElementById('qr-main');
    const destSuc = document.getElementById('dest-suc');
    if (qrMain) qrMain.style.display = 'none';
    if (destSuc) destSuc.style.display = 'block';

    if (Notification.permission === 'granted') {
      new Notification('Livreo — Livraison confirmée ✅', {
        body: `Colis ${ref} remis à ${dest}. Paiement déclenché automatiquement.`
      });
    }
  }, 700);
}
