/* ═══════════════════════════════════════
   LIVREO — Module Poster un colis
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Prix conseillé par défaut ─────────────
const PRIX_CONSEILLE_DEFAULT = 7;

// ── Indicateur vitesse BlaBlaCar ──────────
function onPrixInput(val, conseille) {
  val = parseFloat(val) || 0;
  if (conseille === undefined) conseille = PRIX_CONSEILLE_DEFAULT;

  const inp = document.getElementById('pf-price-input');
  if (inp) inp.dataset.edited = (val !== conseille) ? '1' : '';

  let icon, title, sub, bg;
  if (val < conseille) {
    icon = '🐢'; title = 'Lent';
    sub  = `En dessous du prix conseillé (${conseille}€) — acceptation plus longue`;
    bg   = '#fffbeb';
  } else if (val === conseille) {
    icon = '🚶'; title = 'Moyen';
    sub  = `Au prix conseillé — bonne visibilité`;
    bg   = 'var(--cream)';
  } else {
    icon = '⚡'; title = 'Rapide';
    sub  = `Au-dessus du prix conseillé — passeur trouvé plus vite !`;
    bg   = 'var(--g50)';
  }

  document.getElementById('speed-icon').textContent  = icon;
  document.getElementById('speed-title').textContent = title;
  document.getElementById('speed-sub').textContent   = sub;
  document.getElementById('speed-indicator').style.background = bg;
}

// ── Upload photo colis ───────────────────
async function uploadPhotoColis(file, userId, colisId) {
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_SIZE = 10 * 1024 * 1024;
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Format non autorisé. Utilisez JPG, PNG ou WebP.');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Fichier trop lourd. Maximum 10MB.');
  }
  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
  const MAGIC = { 'ffd8ff': 'jpeg', '89504e47': 'png', '52494646': 'webp' };
  const isValid = Object.keys(MAGIC).some(magic => hex.startsWith(magic));
  if (!isValid) {
    throw new Error('Fichier invalide. Contenu ne correspond pas au format.');
  }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${userId}/${colisId}/${Date.now()}.${ext}`;
  const { data, error } = await db.storage
    .from('photos-colis')
    .upload(filename, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return db.storage.from('photos-colis').getPublicUrl(data.path).data.publicUrl;
}

// ── Sélection photos ─────────────────────
function fakeUp(type) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.multiple = (type === 'co');
  inp.onchange = async function () {
    const files = Array.from(inp.files);
    if (!files.length) return;
    if (type === 'em') {
      const reader = new FileReader();
      reader.onload = e => {
        document.getElementById('prev-em').innerHTML =
          `<img src="${e.target.result}" style="width:56px;height:56px;border-radius:9px;object-fit:cover;border:2px solid var(--g200);">`;
      };
      reader.readAsDataURL(files[0]);
      window._photoEmballee = files[0];
      emUp = true;
      t('Photo emballée ajoutée ✅', 's');
    } else {
      let html = '';
      for (const f of files.slice(0, 4)) {
        const url = URL.createObjectURL(f);
        html += `<div class="prev-locked" style="position:relative;overflow:hidden;">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover;opacity:.5;border-radius:7px;">
          <div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:.4rem;font-weight:900;color:#fff;letter-spacing:.3px;">PRIVÉ</div>
        </div>`;
      }
      document.getElementById('prev-co').innerHTML = html;
      window._photosContenu = files;
      coUp = true;
      t(files.length + ' photo(s) contenu ajoutée(s) 🔒', 's');
    }
  };
  inp.click();
}

// ── Reset formulaire poster ──────────────
function resetPoster() {
  document.getElementById('poster-form').style.display = 'block';
  document.getElementById('poster-suc').style.display = 'none';
  emUp = false;
  coUp = false;
  document.getElementById('prev-em').innerHTML = '';
  document.getElementById('prev-co').innerHTML = '';
}

// ── Publication colis ────────────────────
async function publishColis() {
  if (!user) { t('Connectez-vous d\'abord', 'e'); goNav('auth'); return; }

  const dep = document.getElementById('pf-dep').value;
  const arr = document.getElementById('pf-arr').value;
  const titre = sanitize(document.getElementById('pf-title').value.trim());
  const desc = sanitize(document.getElementById('pf-desc').value.trim());
  const dated = document.getElementById('pf-date').value;
  const rnom = document.getElementById('pf-rname').value.trim();
  const rtel = document.getElementById('pf-rphone').value.trim();
  const prix = parseFloat(document.getElementById('pf-price-input')?.value || '0') || 0;

  if (!dep || !arr) { t('Choisissez les gares', 'e'); return; }
  if (!titre) { t('Décrivez ce que c\'est', 'e'); return; }
  if (prix <= 0) { t('Entrez un prix valide', 'e'); return; }
  if (!rnom || !rtel) { t('Renseignez le destinataire', 'e'); return; }
  if (!coUp) { t('Ajoutez la photo publique du colis 📸', 'e'); return; }

  const btn = document.querySelector('#poster-form .btn.p.full');
  if (btn) { btn.textContent = 'Publication...'; btn.disabled = true; }

  try {
    const { data, error } = await db.from('colis').insert({
      titre, description: desc,
      gare_depart: dep, gare_arrivee: arr,
      prix,
      date_souhaitee: dated || null,
      destinataire_nom: rnom, destinataire_tel: rtel,
      expediteur_id: user.id,
      statut: 'en_attente'
    }).select().single();

    if (error) { t('Erreur : ' + error.message, 'e'); return; }

    const ref = data.code_lvr;
    document.getElementById('suc-ref').textContent = ref;
    document.getElementById('poster-form').style.display = 'none';
    document.getElementById('poster-suc').style.display = 'block';
    document.getElementById('content').scrollTop = 0;
    t(`Colis publié ! Code : ${ref} 🚀`, 's');

    // Photo publique (champ co) → photo_emballee_url (visible marketplace)
    if (window._photosContenu && window._photosContenu.length) {
      try {
        const url = await uploadPhotoColis(window._photosContenu[0], user.id, data.id);
        if (url) await db.from('colis').update({ photo_emballee_url: url }).eq('id', data.id);
      } catch (e) { t('Photo publique : ' + e.message, 'e'); }
    }
    // Photo privée (champ em) → photos_contenu_urls (visible après acceptation)
    if (window._photoEmballee) {
      try {
        const url = await uploadPhotoColis(window._photoEmballee, user.id, data.id);
        if (url) await db.from('colis').update({ photos_contenu_urls: [url] }).eq('id', data.id);
      } catch (e) { t('Photo privée : ' + e.message, 'e'); }
    }
    window._photoEmballee = null;
    window._photosContenu = null;

    envoyerSMS(rtel,
      `Bonjour ${rnom} ! Un colis vous est envoyé via Livreo. ` +
      `Votre code : ${ref}. Ouvrez Livreo → Suivi → entrez ce code pour votre QR Code. 🚆`
    );
  } catch (e) {
    t('Erreur : ' + e.message, 'e');
  } finally {
    if (btn) { btn.textContent = '🚀 Publier l\'annonce'; btn.disabled = false; }
  }
}
