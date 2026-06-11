/* ═══════════════════════════════════════
   KOLISGO — Module Profil utilisateur
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Sauvegarder le profil ────────────────
async function saveProfil() {
  if (!user) { t('Non connecté', 'e'); return; }
  const pn = document.getElementById('m-pn')?.value.trim() || '';
  const nm = document.getElementById('m-nm')?.value.trim() || '';
  const ph = document.getElementById('m-ph')?.value.trim() || '';
  const adr = document.getElementById('m-adr')?.value.trim() || '';
  const cp = document.getElementById('m-cp')?.value.trim() || '';
  const vil = document.getElementById('m-vil')?.value.trim() || '';
  const dn = document.getElementById('m-dn')?.value || null;

  if (!pn) { t('Le prénom est obligatoire', 'e'); return; }

  const updates = { prenom: pn, nom: nm, telephone: ph };
  if (adr) updates.adresse = adr;
  if (cp) updates.code_postal = cp;
  if (vil) updates.ville = vil;
  if (dn) updates.date_naissance = dn;

  const { error } = await db.from('users').update(updates).eq('id', user.id);
  if (error) { t('Erreur : ' + error.message, 'e'); return; }

  const moiName = document.getElementById('moi-name');
  const moiAvTxt = document.getElementById('moi-av-txt');
  const dashH = document.getElementById('dash-h');
  if (moiName) moiName.textContent = pn + ' ' + nm;
  if (moiAvTxt) moiAvTxt.textContent = pn[0].toUpperCase();
  const navTxtSave = document.getElementById('nav-av-txt');
  if (navTxtSave) navTxtSave.textContent = pn[0].toUpperCase();
  if (dashH) dashH.innerHTML = `Bonjour <em>${escapeHtml(pn)}</em> 👋`;
  if (user) user.prenom = pn;
  t('Profil mis à jour ✅', 's');
}

// ── Changer la photo de profil ───────────
function changerPhoto() {
  const inp = document.getElementById('photo-input');
  if (inp) inp.click();
}

async function previewPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { t('Photo trop lourde (max 5MB)', 'e'); return; }
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED.includes(file.type)) { t('Format non autorisé (JPG, PNG, WebP uniquement)', 'e'); return; }
  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const isWebP = hex.startsWith('52494646') && hex.substring(16, 24) === '57455250';
  if (!hex.startsWith('ffd8ff') && !hex.startsWith('89504e47') && !isWebP) {
    t('Fichier invalide. Le contenu ne correspond pas au format déclaré.', 'e');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    // Aperçu immédiat — profil
    const img = document.getElementById('moi-av-img');
    const txt = document.getElementById('moi-av-txt');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
    if (txt) txt.style.display = 'none';

    // Aperçu immédiat — header nav
    const navImg = document.getElementById('nav-av-img');
    const navTxt = document.getElementById('nav-av-txt');
    if (navImg) { navImg.src = e.target.result; navImg.style.display = 'block'; }
    if (navTxt) navTxt.style.display = 'none';

    t('Upload en cours...', '');

    try {
      const ext = file.name.split('.').pop().toLowerCase().replace('jpg','jpeg');
      const path = `${user.id}/profil.${ext}`;
      const { data, error } = await db.storage
        .from('photos-profil')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) { t('Erreur upload : ' + error.message, 'e'); return; }

      const { data: urlData } = db.storage.from('photos-profil').getPublicUrl(path);
      const cleanUrl  = urlData.publicUrl;          // URL propre → stockée en base
      const freshUrl  = cleanUrl + '?t=' + Date.now(); // cache-buster → local uniquement

      await db.from('users').update({ photo_profil_url: cleanUrl }).eq('id', user.id);
      if (img) img.src = freshUrl;
      if (navImg) navImg.src = freshUrl;
      if (user) { user.photo_profil_url = cleanUrl; }
      const badgeFill = document.getElementById('badge-certif-fill');
      if (badgeFill) badgeFill.setAttribute('fill', user.is_certified ? '#1D9BF0' : '#cccccc');
      const badgeCertifie = document.getElementById('badge-certifie');
      if (badgeCertifie) badgeCertifie.style.display = 'inline';
      t('Photo de profil mise à jour ✅ · Badge certifié activé', 's');
    } catch (e) {
      t('Erreur : ' + e.message, 'e');
    }
  };
  reader.readAsDataURL(file);
}

// ── Suppression de compte (RGPD) ────────
async function supprimerMonCompte() {
  const confirm1 = confirm(
    'Êtes-vous sûr de vouloir supprimer votre compte ?\n' +
    'Cette action est irréversible.'
  );
  if (!confirm1) return;

  const confirm2 = confirm(
    'Dernière confirmation — toutes vos données ' +
    'personnelles seront effacées définitivement.'
  );
  if (!confirm2) return;

  try {
    const { data, error } = await db.rpc('delete_my_account');
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    await db.auth.signOut();
    t('Compte supprimé. À bientôt.', 's');
    goNav('home');
  } catch(e) {
    t('Erreur : ' + e.message, 'e');
  }
}

// ── Configuration MFA (TOTP) ────────────
let _mfaFactorId = null;

async function ouvrirSetupMFA() {
  try {
    const { data, error } = await db.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'KolisGo'
    });
    if (error) throw new Error(error.message);

    _mfaFactorId = data.id;
    const uri    = data.totp.uri;    // otpauth:// — utilisé pour générer le QR via qrcodejs
    const secret = data.totp.secret; // secret Base32 pour saisie manuelle

    openSheet(`
      <div class="sheet-title">🔐 Double authentification</div>
      <div class="sheet-sub">Obligatoire pour les comptes admin. Scannez le QR code avec Google Authenticator ou Authy.</div>

      <div id="mfa-qr-wrap" style="width:184px;height:184px;margin:20px auto;border-radius:8px;border:2px solid var(--border);overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center;"></div>

      <div style="background:var(--cream);border-radius:var(--r);padding:12px;margin-bottom:16px;font-size:.72rem;color:var(--muted);text-align:center;word-break:break-all;line-height:1.8;">
        Code manuel :<br>
        <strong style="color:var(--ink);letter-spacing:2px;font-size:.78rem;">${escapeHtml(secret)}</strong>
      </div>

      <div style="font-size:.76rem;font-weight:700;color:var(--ink);margin-bottom:6px;">Code à 6 chiffres affiché dans l'application :</div>
      <input type="text" id="mfa-code" inputmode="numeric" maxlength="6" placeholder="000000"
        style="width:100%;padding:14px;font-size:1.6rem;text-align:center;letter-spacing:8px;
               border:1.5px solid var(--border);border-radius:var(--r);
               font-family:monospace;box-sizing:border-box;margin-bottom:12px;">

      <button id="mfa-btn" class="btn p full" onclick="verifierCodeMFA()">Activer la double authentification</button>
      <div style="text-align:center;margin-top:12px;font-size:.7rem;color:var(--muted);line-height:1.7;">
        Applications recommandées :<br>
        <strong>Google Authenticator · Authy · 1Password</strong>
      </div>
    `);

    setTimeout(() => {
      // Générer le QR code avec qrcodejs (déjà chargé) à partir de l'URI otpauth://
      const wrap = document.getElementById('mfa-qr-wrap');
      if (wrap && typeof QRCode !== 'undefined') {
        new QRCode(wrap, {
          text: uri,
          width: 180,
          height: 180,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
      const inp = document.getElementById('mfa-code');
      if (inp) {
        inp.focus();
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') verifierCodeMFA(); });
      }
    }, 200);

  } catch(e) {
    t('Erreur MFA : ' + e.message, 'e');
  }
}

async function verifierCodeMFA() {
  if (!_mfaFactorId) { t('Session MFA expirée. Réessayez.', 'e'); return; }
  const code = (document.getElementById('mfa-code')?.value || '').replace(/\s/g, '');
  if (!code || code.length !== 6) { t('Code à 6 chiffres requis', 'e'); return; }

  const btn = document.getElementById('mfa-btn');
  if (btn) { btn.textContent = 'Vérification...'; btn.disabled = true; }

  try {
    const { error } = await db.auth.mfa.challengeAndVerify({ factorId: _mfaFactorId, code });
    if (error) throw new Error(error.message);
    _mfaFactorId = null;
    closeSheet();
    t('Double authentification activée ✅ Votre compte est sécurisé.', 's');
    goNav('home');
  } catch(e) {
    t('Code incorrect ou expiré. Réessayez.', 'e');
    if (btn) { btn.textContent = 'Activer la double authentification'; btn.disabled = false; }
  }
}

// ── Badges passeurs ──────────────────────
function badgeHTML(badge) {
  const map = {
    certifie:  { icon: '🔵', label: 'Passeur Certifié',     bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    prudent:   { icon: '🟠', label: 'Passeur Prudent',      bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    confiance: { icon: '🥇', label: 'Passeur de Confiance', bg: '#fef9c3', color: '#78350f', border: '#fde047' },
    suspendu:  { icon: '❌', label: 'Compte Suspendu',      bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
  };
  if (!badge || badge === 'aucun' || !map[badge]) return '';
  const b = map[badge];
  return `<span style="background:${b.bg};border:1px solid ${b.border};color:${b.color};font-size:.6rem;font-weight:800;padding:2px 8px;border-radius:50px;white-space:nowrap;">${b.icon} ${b.label}</span>`;
}

function afficherBadgeProfil(badge) {
  const el = document.getElementById('moi-badge');
  if (!el) return;
  if (badge === 'certifie') {
    el.innerHTML = badgeBleuSVG(20);
  } else {
    el.innerHTML = badgeHTML(badge || 'aucun');
  }
}

// ── Vérification d'identité ──────────────
let _verifPieceFile = null;
let _verifSelfieFile = null;

function ouvrirVerifIdentite() {
  _verifPieceFile = null;
  _verifSelfieFile = null;
  openSheet(`
    <div class="sheet-title">🪪 Vérification d'identité</div>
    <div class="sheet-sub">Obligatoire pour devenir passeur. Vos documents sont chiffrés et sécurisés.</div>

    <div style="background:var(--g50);border:1.5px solid var(--g100);border-radius:var(--r);padding:12px;margin-bottom:16px;font-size:.76rem;color:var(--g700);line-height:1.6;">
      🔒 <strong>Vos données sont protégées.</strong> Chiffrement SSL 256 bits. Documents jamais partagés avec des tiers.
    </div>

    <div style="margin-bottom:14px;">
      <div style="font-size:.72rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Étape 1 — Pièce d'identité <span style="color:var(--danger)">*</span></div>
      <div id="vi-piece-zone" class="upz" onclick="document.getElementById('vi-piece-input').click()" style="cursor:pointer;">
        <div class="upz-icon">🪪</div>
        <div class="upz-txt">CNI ou Passeport (recto-verso)</div>
        <div class="upz-sub">PDF, JPG, PNG · Max 10 Mo</div>
      </div>
      <div id="vi-piece-ok" style="display:none;background:var(--g50);border:1.5px solid var(--g100);border-radius:var(--r);padding:8px 12px;margin-top:6px;font-size:.78rem;font-weight:700;color:var(--g600);">
        🪪 <span id="vi-piece-name">Fichier prêt</span> ✓
      </div>
      <input type="file" id="vi-piece-input" accept="application/pdf,image/jpeg,image/png" style="display:none;" onchange="verifPiecePreview(this)">
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:.72rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Étape 2 — Selfie avec votre pièce <span style="color:var(--muted2);font-weight:400;">(optionnel)</span></div>
      <div id="vi-selfie-zone" class="upz" onclick="document.getElementById('vi-selfie-input').click()" style="cursor:pointer;">
        <div class="upz-icon">🤳</div>
        <div class="upz-txt">Photo de vous tenant votre CNI/Passeport</div>
        <div class="upz-sub">JPG, PNG · Max 10 Mo</div>
      </div>
      <div id="vi-selfie-ok" style="display:none;background:var(--g50);border:1.5px solid var(--g100);border-radius:var(--r);padding:8px 12px;margin-top:6px;font-size:.78rem;font-weight:700;color:var(--g600);">
        🤳 <span id="vi-selfie-name">Fichier prêt</span> ✓
      </div>
      <input type="file" id="vi-selfie-input" accept="image/jpeg,image/png" style="display:none;" onchange="verifSelfiePreview(this)">
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:var(--r);padding:10px 12px;font-size:.72rem;color:#92400e;margin-bottom:14px;line-height:1.6;">
      ⏱ Vérification sous 24-48h. Vous recevrez un SMS de confirmation.
    </div>

    <button id="verif-btn" class="btn p full" onclick="soumettreVerifIdentite()">📤 Envoyer mes documents</button>
    <button onclick="closeSheet()" class="btn s full" style="margin-top:8px;">Annuler</button>
  `);
}

function verifPiecePreview(input) {
  const file = input.files[0];
  if (!file) return;
  const ALLOWED = ['application/pdf','image/jpeg','image/png'];
  if (!ALLOWED.includes(file.type)) { t('Format non autorisé (PDF, JPG, PNG)', 'e'); input.value = ''; return; }
  if (file.size > 10 * 1024 * 1024) { t('Fichier trop lourd (max 10 Mo)', 'e'); input.value = ''; return; }
  _verifPieceFile = file;
  const zone = document.getElementById('vi-piece-zone');
  const ok   = document.getElementById('vi-piece-ok');
  const name = document.getElementById('vi-piece-name');
  if (zone) zone.style.display = 'none';
  if (ok)   ok.style.display   = 'block';
  if (name) name.textContent = file.name.length > 38 ? file.name.substring(0,35)+'...' : file.name;
}

function verifSelfiePreview(input) {
  const file = input.files[0];
  if (!file) return;
  if (!['image/jpeg','image/png'].includes(file.type)) { t('JPG ou PNG uniquement', 'e'); input.value = ''; return; }
  if (file.size > 10 * 1024 * 1024) { t('Fichier trop lourd (max 10 Mo)', 'e'); input.value = ''; return; }
  _verifSelfieFile = file;
  const zone = document.getElementById('vi-selfie-zone');
  const ok   = document.getElementById('vi-selfie-ok');
  const name = document.getElementById('vi-selfie-name');
  if (zone) zone.style.display = 'none';
  if (ok)   ok.style.display   = 'block';
  if (name) name.textContent = file.name.length > 38 ? file.name.substring(0,35)+'...' : file.name;
}

async function soumettreVerifIdentite() {
  if (!user) { t('Connectez-vous d\'abord', 'e'); return; }
  if (!_verifPieceFile) { t('La pièce d\'identité est obligatoire', 'e'); return; }
  const btn = document.getElementById('verif-btn');
  if (btn) { btn.textContent = 'Upload en cours...'; btn.disabled = true; }
  try {
    const extP = _verifPieceFile.name.split('.').pop().toLowerCase().replace('jpg','jpeg');
    const pathPiece = `${user.id}/piece_${Date.now()}.${extP}`;
    const { error: e1 } = await db.storage.from('documents-identite')
      .upload(pathPiece, _verifPieceFile, { upsert: true, contentType: _verifPieceFile.type });
    if (e1) throw new Error('Upload pièce : ' + e1.message);

    let pathSelfie = null;
    if (_verifSelfieFile) {
      if (btn) btn.textContent = 'Upload selfie...';
      const extS = _verifSelfieFile.name.split('.').pop().toLowerCase().replace('jpg','jpeg');
      pathSelfie = `${user.id}/selfie_${Date.now()}.${extS}`;
      const { error: e2 } = await db.storage.from('documents-identite')
        .upload(pathSelfie, _verifSelfieFile, { upsert: true, contentType: _verifSelfieFile.type });
      if (e2) throw new Error('Upload selfie : ' + e2.message);
    }

    if (btn) btn.textContent = 'Envoi de la demande...';
    const { error: rpcErr } = await db.rpc('soumettre_verif_identite_docs', {
      p_type: 'piece_identite',
      p_document_url: pathPiece,
      p_selfie_url: pathSelfie
    });
    if (rpcErr) throw new Error(rpcErr.message);

    _verifPieceFile = null; _verifSelfieFile = null;
    closeSheet();
    t('Documents envoyés ✅ Vérification sous 24-48h.', 's');
    await logSecurityEvent('verif_identite_docs_soumis', { user_id: user.id });
  } catch (e) {
    t('Erreur : ' + e.message, 'e');
    if (btn) { btn.textContent = '📤 Envoyer mes documents'; btn.disabled = false; }
  }
}

// ── Justificatif de domicile — upload réel ─
function ouvrirJustificatif() {
  if (!user) { t('Connectez-vous d\'abord', 'e'); return; }
  let inp = document.getElementById('_justif-input');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file';
    inp.id = '_justif-input';
    inp.accept = 'application/pdf,image/jpeg,image/png';
    inp.style.display = 'none';
    inp.addEventListener('change', _uploadJustificatif);
    document.body.appendChild(inp);
  }
  inp.value = '';
  inp.click();
}

async function _uploadJustificatif(e) {
  const file = e.target.files[0];
  if (!file) return;
  const ALLOWED = ['application/pdf','image/jpeg','image/png'];
  if (!ALLOWED.includes(file.type)) { t('Format non autorisé (PDF, JPG, PNG)', 'e'); return; }
  if (file.size > 10 * 1024 * 1024) { t('Fichier trop lourd (max 10 Mo)', 'e'); return; }
  t('Envoi en cours…', '');
  try {
    const ext = file.name.split('.').pop().toLowerCase().replace('jpg','jpeg');
    const path = `${user.id}/justificatif_${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage
      .from('documents-identite')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) throw new Error('Upload : ' + upErr.message);
    const { error: rpcErr } = await db.rpc('soumettre_justificatif_domicile', { p_document_url: path });
    if (rpcErr) throw new Error(rpcErr.message);
    t('Justificatif envoyé, en attente de validation ✅', 's');
    const btnEl = document.querySelector('[onclick="ouvrirJustificatif()"]');
    if (btnEl) btnEl.textContent = 'En attente';
  } catch (err) {
    t('Erreur : ' + err.message, 'e');
  }
}
