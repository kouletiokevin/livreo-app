/* ═══════════════════════════════════════
   LIVREO — Module Profil utilisateur
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

  const updates = { prenom: pn, telephone: ph };
  if (adr) updates.adresse = adr;
  if (cp) updates.code_postal = cp;
  if (vil) updates.ville = vil;
  if (dn) updates.date_naissance = dn;

  const { error } = await db.from('users').update(updates).eq('id', user.id);
  if (error) { t('Erreur : ' + error.message, 'e'); return; }

  document.getElementById('moi-name').textContent = pn + ' ' + nm;
  document.getElementById('moi-av-txt').textContent = pn[0].toUpperCase();
  document.getElementById('nav-av').textContent = pn[0].toUpperCase();
  document.getElementById('dash-h').innerHTML = `Bonjour <em>${pn}</em> 👋`;
  if (user) user.prenom = pn;
  t('Profil mis à jour ✅', 's');
}

// ── Changer la photo de profil ───────────
function changerPhoto() {
  document.getElementById('photo-input').click();
}

async function previewPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { t('Photo trop lourde (max 5MB)', 'e'); return; }
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  if (!ALLOWED.includes(file.type)) { t('Format non autorisé (JPG, PNG, WebP uniquement)', 'e'); return; }

  const reader = new FileReader();
  reader.onload = async function (e) {
    const img = document.getElementById('moi-av-img');
    const txt = document.getElementById('moi-av-txt');
    img.src = e.target.result;
    img.style.display = 'block';
    txt.style.display = 'none';
    t('Upload en cours...', '');

    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/profil.${ext}`;
      const { data, error } = await db.storage
        .from('photos-profil')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) { t('Erreur upload : ' + error.message, 'e'); return; }

      const { data: urlData } = db.storage.from('photos-profil').getPublicUrl(path);
      const url = urlData.publicUrl;

      await db.from('users').update({ photo_profil_url: url }).eq('id', user.id);
      img.src = url + '?t=' + Date.now();
      t('Photo de profil mise à jour ✅', 's');
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

// ── Vérification d'identité ──────────────
function ouvrirVerifIdentite() {
  openSheet(`
    <div class="sheet-title">🪪 Vérification d'identité</div>
    <div class="sheet-sub">Obligatoire pour devenir livreur. Vos documents sont chiffrés et sécurisés.</div>

    <div style="background:var(--g50);border:1.5px solid var(--g100);border-radius:var(--r);padding:12px;margin-bottom:16px;font-size:.76rem;color:var(--g700);line-height:1.6;">
      🔒 <strong>Vos données sont protégées.</strong> Nous utilisons un chiffrement SSL 256 bits. Vos documents ne sont jamais partagés avec des tiers.
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
      <div style="font-size:.76rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Étape 1 — Pièce d'identité</div>
      <div class="upz" onclick="t('Fonctionnalité disponible sur l\\'app mobile 📱','')">
        <div class="upz-icon">🪪</div>
        <div class="upz-txt">CNI ou Passeport (recto-verso)</div>
        <div class="upz-sub">JPG, PNG, PDF — max 10MB</div>
      </div>

      <div style="font-size:.76rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:8px;margin-bottom:4px;">Étape 2 — Selfie avec votre pièce d'identité</div>
      <div class="upz" onclick="t('Fonctionnalité disponible sur l\\'app mobile 📱','')">
        <div class="upz-icon">🤳</div>
        <div class="upz-txt">Photo de vous tenant votre CNI/Passeport</div>
        <div class="upz-sub">Visage et document clairement visibles</div>
      </div>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:var(--r);padding:10px 12px;font-size:.72rem;color:#92400e;margin-bottom:14px;line-height:1.6;">
      ⏱ Vérification sous 24-48h après réception des documents. Vous recevrez un SMS de confirmation.
    </div>

    <button class="btn p full" onclick="t('Documents envoyés ! Vérification sous 48h 📋','s');closeSheet()">Envoyer pour vérification</button>
    <div style="text-align:center;margin-top:10px;font-size:.72rem;color:var(--muted);">
      Ou envoyez vos documents par email à <strong>verification@livreo.fr</strong>
    </div>
  `);
}
