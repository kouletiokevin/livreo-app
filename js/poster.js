/* ═══════════════════════════════════════
   LIVREO — Module Poster un colis
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Calcul prix dynamique ────────────────
function calcP() {
  const poids = parseFloat(document.getElementById('pf-poids')?.value || '0');
  const taille = document.getElementById('pf-taille')?.value || '';
  if (!poids || !taille) {
    document.getElementById('pf-price').textContent = '—';
    document.getElementById('fmt-result').style.display = 'none';
    document.getElementById('prix-slider-wrap').style.display = 'none';
    return;
  }

  let prix = 0, prixMin = 0, prixMax = 0;
  let formatNom = '', formatDesc = '';

  if (taille === 'xs') {
    if      (poids <= 0.25) { prix = 2.50; prixMin = 2;  prixMax = 8;  formatNom = 'Lettre S';    formatDesc = 'Lettre ou document léger'; }
    else if (poids <= 0.5)  { prix = 3.50; prixMin = 2;  prixMax = 8;  formatNom = 'Lettre M';    formatDesc = 'Lettre épaisse / petits docs'; }
    else                    { prix = 5.00; prixMin = 3;  prixMax = 12; formatNom = 'Lettre L';    formatDesc = 'Pochette documents'; }
  } else if (taille === 's') {
    if      (poids <= 0.25) { prix = 3.50; prixMin = 2;  prixMax = 8;  formatNom = 'Pochette XS'; formatDesc = 'Petite pochette légère'; }
    else if (poids <= 0.5)  { prix = 4.00; prixMin = 2;  prixMax = 8;  formatNom = 'Pochette S';  formatDesc = 'Pochette standard ≤500g'; }
    else if (poids <= 1)    { prix = 5.00; prixMin = 3;  prixMax = 12; formatNom = 'Pochette M';  formatDesc = 'Pochette jusqu\'à 1kg'; }
    else                    { prix = 7.00; prixMin = 5;  prixMax = 18; formatNom = 'Pochette L';  formatDesc = 'Grande pochette jusqu\'à 2kg'; }
  } else if (taille === 'm') {
    if      (poids <= 0.5)  { prix = 5.00;  prixMin = 3;  prixMax = 12; formatNom = 'Colis XS';   formatDesc = 'Petit colis léger'; }
    else if (poids <= 1)    { prix = 6.00;  prixMin = 4;  prixMax = 15; formatNom = 'Colis XS+';  formatDesc = 'Petit colis jusqu\'à 1kg'; }
    else if (poids <= 2)    { prix = 7.00;  prixMin = 5;  prixMax = 18; formatNom = 'Colis S';    formatDesc = 'Colis standard jusqu\'à 2kg'; }
    else if (poids <= 3)    { prix = 9.00;  prixMin = 6;  prixMax = 22; formatNom = 'Colis S+';   formatDesc = 'Colis jusqu\'à 3kg'; }
    else if (poids <= 5)    { prix = 11.00; prixMin = 7;  prixMax = 25; formatNom = 'Colis M';    formatDesc = 'Colis 3 à 5kg'; }
    else                    { prix = 14.00; prixMin = 9;  prixMax = 32; formatNom = 'Colis M+';   formatDesc = 'Colis jusqu\'à 10kg'; }
  } else if (taille === 'l') {
    if      (poids <= 1)    { prix = 7.00;  prixMin = 5;  prixMax = 18; formatNom = 'Colis S';    formatDesc = 'Colis moyen léger'; }
    else if (poids <= 2)    { prix = 9.00;  prixMin = 6;  prixMax = 22; formatNom = 'Colis M-';   formatDesc = 'Colis moyen jusqu\'à 2kg'; }
    else if (poids <= 4)    { prix = 12.00; prixMin = 8;  prixMax = 28; formatNom = 'Colis M';    formatDesc = 'Colis moyen 2 à 4kg'; }
    else if (poids <= 5)    { prix = 13.00; prixMin = 9;  prixMax = 30; formatNom = 'Colis M+';   formatDesc = 'Colis moyen 4 à 5kg'; }
    else if (poids <= 7)    { prix = 16.00; prixMin = 10; prixMax = 40; formatNom = 'Colis L';    formatDesc = 'Grand colis 5 à 7kg'; }
    else                    { prix = 19.00; prixMin = 12; prixMax = 45; formatNom = 'Colis L+';   formatDesc = 'Grand colis jusqu\'à 10kg'; }
  } else if (taille === 'xl') {
    if      (poids <= 3)    { prix = 13.00; prixMin = 9;  prixMax = 30; formatNom = 'Colis XL-';  formatDesc = 'Grand colis léger'; }
    else if (poids <= 5)    { prix = 16.00; prixMin = 10; prixMax = 40; formatNom = 'Colis XL';   formatDesc = 'Grand colis 3 à 5kg'; }
    else if (poids <= 7)    { prix = 19.00; prixMin = 12; prixMax = 45; formatNom = 'Colis XL+';  formatDesc = 'Grand colis 5 à 7kg'; }
    else if (poids <= 10)   { prix = 22.00; prixMin = 15; prixMax = 55; formatNom = 'Colis XXL';  formatDesc = 'Très grand colis 7 à 10kg'; }
    else                    { prix = 28.00; prixMin = 18; prixMax = 65; formatNom = 'Colis XXL+'; formatDesc = 'Bagage / équipement 10 à 20kg'; }
  }

  document.getElementById('pf-fmt').value = formatNom;
  document.getElementById('fmt-label').textContent = formatNom;
  document.getElementById('fmt-desc').textContent = formatDesc;
  document.getElementById('fmt-result').style.display = 'block';

  const slider = document.getElementById('prix-range');
  slider.min = prixMin;
  slider.max = prixMax;
  slider.value = prix;
  slider.step = 0.5;
  document.getElementById('prix-min-lbl').textContent = `Min : ${prixMin}€`;
  document.getElementById('prix-max-lbl').textContent = `Max : ${prixMax}€`;
  document.getElementById('prix-suggest-lbl').textContent = `${prix}€`;
  document.getElementById('prix-slider-wrap').style.display = 'block';

  updateSlider(prix);
}

// ── Mise à jour slider prix ──────────────
function updateSlider(val) {
  val = parseFloat(val);
  document.getElementById('pf-price').textContent = val.toFixed(2).replace('.', ',') + ' €';

  const min = parseFloat(document.getElementById('prix-range').min);
  const max = parseFloat(document.getElementById('prix-range').max);
  const pct = (val - min) / (max - min);

  let icon, title, sub, bg;
  if (pct >= 0.7) {
    icon = '🚀'; title = 'Acceptation très rapide !';
    sub = 'Un livreur acceptera probablement dans l\'heure';
    bg = 'var(--g50)';
  } else if (pct >= 0.4) {
    icon = '⚡'; title = 'Offre compétitive';
    sub = 'Un livreur acceptera probablement dans la journée';
    bg = 'var(--cream)';
  } else {
    icon = '🕐'; title = 'Offre économique';
    sub = 'Peut prendre 1-2 jours selon les livreurs disponibles';
    bg = '#fffbeb';
  }

  document.getElementById('speed-icon').textContent = icon;
  document.getElementById('speed-title').textContent = title;
  document.getElementById('speed-sub').textContent = sub;
  document.getElementById('speed-indicator').style.background = bg;
}

// ── Upload photo colis ───────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_IMAGE_EXTS  = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

async function uploadPhotoColis(file, type, colisId) {
  if (!file || !user) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    t('Type de fichier non autorisé (JPG, PNG, WebP uniquement)', 'e');
    return null;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
    t('Extension de fichier non autorisée', 'e');
    return null;
  }
  try {
    const safePath = `${user.id}/${colisId || 'new'}/${type}_${Date.now()}.${ext}`;
    const { data, error } = await db.storage
      .from('photos-colis')
      .upload(safePath, file, { upsert: false, contentType: file.type });
    if (error) { console.error('Upload error:', error); return null; }
    const { data: urlData } = db.storage.from('photos-colis').getPublicUrl(safePath);
    return urlData.publicUrl;
  } catch (e) { console.error(e); return null; }
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
  const fmt = document.getElementById('pf-fmt').value || 'Colis S';
  const poids = document.getElementById('pf-poids')?.value || '';
  const dated = document.getElementById('pf-date').value;
  const rnom = document.getElementById('pf-rname').value.trim();
  const rtel = document.getElementById('pf-rphone').value.trim();
  const prixTxt = (document.getElementById('pf-price').textContent || '7').replace('€', '').replace(',', '.').trim();
  const prix = parseFloat(prixTxt) || 7;

  if (!dep || !arr) { t('Choisissez les gares', 'e'); return; }
  if (!titre) { t('Ajoutez un titre', 'e'); return; }
  if (!poids) { t('Indiquez poids et taille', 'e'); return; }
  if (!rnom || !rtel) { t('Renseignez le destinataire', 'e'); return; }
  if (!emUp) { t('Ajoutez la photo du colis emballé 📷', 'e'); return; }

  const btn = document.querySelector('#poster-form .btn.p.full');
  if (btn) { btn.textContent = 'Publication...'; btn.disabled = true; }

  try {
    const { data, error } = await db.from('colis').insert({
      titre, description: desc,
      gare_depart: dep, gare_arrivee: arr,
      format: fmt, poids: poids + 'kg', prix,
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

    if (window._photoEmballee) {
      const url = await uploadPhotoColis(window._photoEmballee, 'emballee', data.id);
      if (url) await db.from('colis').update({ photo_emballee_url: url }).eq('id', data.id);
    }
    if (window._photosContenu && window._photosContenu.length) {
      const urls = [];
      for (const f of window._photosContenu) {
        const u = await uploadPhotoColis(f, 'contenu', data.id);
        if (u) urls.push(u);
      }
      if (urls.length) await db.from('colis').update({ photos_contenu_urls: urls }).eq('id', data.id);
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
