/* ═══════════════════════════════════════
   DINVMIC — Module Poster un kolis
   Version 2.0 — Juin 2026
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

  const si = document.getElementById('speed-indicator');
  const sIco = document.getElementById('speed-icon');
  const sTit = document.getElementById('speed-title');
  const sSub = document.getElementById('speed-sub');
  if (sIco) sIco.textContent  = icon;
  if (sTit) sTit.textContent = title;
  if (sSub) sSub.textContent   = sub;
  if (si) si.style.background = bg;
}

// ── Upload photo colis ───────────────────
async function uploadPhotoColis(file, userId, colisId, isPrivate) {
  if (isPrivate === undefined) isPrivate = false;
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_SIZE = 10 * 1024 * 1024;
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Format non autorisé. Utilisez JPG, PNG ou WebP.');
  if (file.size > MAX_SIZE) throw new Error('Fichier trop lourd. Maximum 10MB.');

  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const isWebP = hex.startsWith('52494646');
  const isValid = hex.startsWith('ffd8ff') || hex.startsWith('89504e47') || isWebP;
  if (!isValid) throw new Error('Fichier invalide.');

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  // Photo "contenu" (privee) -> bucket prive photos-colis (URL signee, expirante)
  // Photo "emballee" (vitrine publique affichee dans la marketplace) -> bucket public photos-colis-public
  const bucket = isPrivate ? 'photos-colis' : 'photos-colis-public';
  const filename = `${userId}/${colisId}/${Date.now()}.${ext}`;
  const { data, error } = await db.storage
    .from(bucket)
    .upload(filename, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);

  if (isPrivate) {
    const { data: s, error: sErr } = await db.storage.from(bucket).createSignedUrl(data.path, 3600);
    if (sErr) throw new Error(sErr.message);
    return s.signedUrl;
  }
  return db.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
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
        const prevEm = document.getElementById('prev-em');
        if (prevEm) prevEm.innerHTML =
          `<div style="position:relative;display:inline-block;">
            <img src="${e.target.result}" style="width:56px;height:56px;border-radius:9px;object-fit:cover;border:2px solid var(--g200);">
            <button onclick="supprimerPhotoEm()" type="button" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--danger);color:#fff;border:none;cursor:pointer;font-size:.65rem;line-height:1;display:flex;align-items:center;justify-content:center;font-weight:900;">✕</button>
          </div>`;
      };
      reader.readAsDataURL(files[0]);
      window._photoEmballee = files[0];
      emUp = true;
      t('Photo emballée ajoutée ✅', 's');
    } else {
      let html = '';
      const selectedFiles = files.slice(0, 5);
      window._photosContenu = Array.from(selectedFiles);
      selectedFiles.forEach((f, idx) => {
        const url = URL.createObjectURL(f);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        html += `<div class="prev-locked" style="position:relative;overflow:visible;">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover;opacity:.5;border-radius:7px;">
          <div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:.4rem;font-weight:900;color:#fff;letter-spacing:.3px;">PRIVÉ</div>
          <button onclick="supprimerPhotoCo(${idx})" type="button" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--danger);color:#fff;border:none;cursor:pointer;font-size:.65rem;line-height:1;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:2;">✕</button>
        </div>`;
      });
      const prevCo = document.getElementById('prev-co');
      if (prevCo) prevCo.innerHTML = html;
      coUp = window._photosContenu.length > 0;
      t(selectedFiles.length + ' photo(s) contenu ajoutée(s) 🔒', 's');
    }
  };
  inp.click();
}

// ── Suppression photos ───────────────────
function supprimerPhotoEm() {
  const el = document.getElementById('prev-em');
  if (el) el.innerHTML = '';
  window._photoEmballee = null;
  emUp = false;
  t('Photo supprimée', '');
}

function supprimerPhotoCo(idx) {
  if (!window._photosContenu) return;
  window._photosContenu.splice(idx, 1);
  const prevCo = document.getElementById('prev-co');
  if (window._photosContenu.length === 0) {
    if (prevCo) prevCo.innerHTML = '';
    coUp = false;
    t('Photos supprimées', '');
    return;
  }
  let html = '';
  window._photosContenu.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    html += `<div class="prev-locked" style="position:relative;overflow:visible;">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;opacity:.5;border-radius:7px;">
      <div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:.4rem;font-weight:900;color:#fff;letter-spacing:.3px;">PRIVÉ</div>
      <button onclick="supprimerPhotoCo(${i})" type="button" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--danger);color:#fff;border:none;cursor:pointer;font-size:.65rem;line-height:1;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:2;">✕</button>
    </div>`;
  });
  if (prevCo) prevCo.innerHTML = html;
  coUp = window._photosContenu.length > 0;
  t('Photo supprimée', '');
}

// ── Reset formulaire poster ──────────────
function resetPoster() {
  const pf = document.getElementById('poster-form');
  const ps = document.getElementById('poster-suc');
  const pe = document.getElementById('prev-em');
  const pc = document.getElementById('prev-co');
  if (pf) pf.style.display = 'block';
  if (ps) ps.style.display = 'none';
  if (pe) pe.innerHTML = '';
  if (pc) pc.innerHTML = '';
  emUp = false;
  coUp = false;
  window._photoEmballee = null;
  window._photosContenu = [];
}

// ── Toggle info crypto ───────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[name="payment"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const cryptoInfo = document.getElementById('crypto-info');
      if (cryptoInfo) cryptoInfo.style.display = (radio.value === 'crypto' && radio.checked) ? 'block' : 'none';
    });
  });
});

// ── Publication colis ────────────────────
async function publishColis() {
  if (!user) { t('Connectez-vous d\'abord', 'e'); goNav('auth'); return; }

  // Lire les champs
  const arr = (document.getElementById('pf-arr') || {}).value || '';
  const titreRaw = (document.getElementById('pf-title') || {}).value || '';
  const descRaw  = (document.getElementById('pf-desc')  || {}).value || '';
  const dateRaw  = (document.getElementById('pf-date')  || {}).value || '';
  const rnom     = ((document.getElementById('pf-rname') || {}).value || '').trim();
  const rtel     = ((document.getElementById('pf-rphone') || {}).value || '').trim();
  const priceEl  = document.getElementById('pf-price-input');
  const payEl    = document.querySelector('input[name="payment"]:checked');

  const titre         = typeof sanitize === 'function' ? sanitize(titreRaw.trim()) : titreRaw.trim();
  const desc          = typeof sanitize === 'function' ? sanitize(descRaw.trim())  : descRaw.trim();
  const dated         = dateRaw.length === 10 ? dateRaw.split('/').reverse().join('-') : null;
  let prix            = parseFloat(priceEl ? priceEl.value : '0') || 0;
  const moyen_paiement = payEl ? payEl.value : null;

  // Validations
  if (!arr)             { t('Choisissez la gare de destination', 'e'); return; }
  if (!titre)           { t('Décrivez ce que c\'est', 'e'); return; }
  if (titre.length > 100)  { t('Titre trop long (100 caractères max)', 'e'); return; }
  if (!moyen_paiement)  { t('Choisissez un moyen de paiement', 'e'); return; }
  if (prix <= 0) prix = 7;
  if (!rnom)            { t('Renseignez le nom du destinataire', 'e'); return; }

  if (!rtel || (typeof validatePhone === 'function' && !validatePhone(rtel))) {
    t('Numéro du destinataire invalide (ex: 06XXXXXXXX)', 'e');
    const telEl = document.getElementById('pf-rphone');
    if (telEl) {
      telEl.style.borderColor = 'var(--danger)';
      telEl.style.boxShadow = '0 0 0 3px rgba(220,38,38,.15)';
      telEl.focus();
      telEl.addEventListener('input', () => {
        telEl.style.borderColor = '';
        telEl.style.boxShadow = '';
      }, { once: true });
    }
    return;
  }

  const btn = document.getElementById('publish-btn') || document.querySelector('#poster-form .btn');
  if (btn) { btn.textContent = 'Publication en cours…'; btn.disabled = true; }

  try {
    // 0. Géolocalisation de la ville de départ (best-effort, 5 s)
    let villeDepart = null;
    try {
      const pos = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 5000);
        navigator.geolocation.getCurrentPosition(
          p => { clearTimeout(timer); resolve(p); },
          e => { clearTimeout(timer); reject(e); },
          { enableHighAccuracy: false, timeout: 5000 }
        );
      });
      const { latitude: lat, longitude: lon } = pos.coords;
      const geoRes  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const geoData = await geoRes.json();
      villeDepart = geoData.address?.city || geoData.address?.town || geoData.address?.village || null;
    } catch(e) { /* refus ou timeout — on publie quand même */ }

    // 1. Insérer le kolis en base
    const colisData = {
      expediteur_id:    user.id,
      gare_arrivee:     arr,
      gare_depart:      villeDepart,
      titre:            titre,
      description:      desc || null,
      date_souhaitee:   dated || null,
      prix:             prix,
      destinataire_nom: rnom,
      destinataire_tel: rtel,
      statut:           'en_attente',
    };

    const { data: colis, error: colisErr } = await db
      .from('colis')
      .insert(colisData)
      .select()
      .single();

    if (colisErr) throw new Error(colisErr.message);

    // 2. Upload photo emballée (publique)
    if (window._photoEmballee) {
      try {
        const url = await uploadPhotoColis(window._photoEmballee, user.id, colis.id, false);
        await db.from('colis').update({ photo_emballee_url: url }).eq('id', colis.id);
      } catch (e) { console.warn('Photo emballée:', e.message); }
    }

    // 3. Upload photos contenu (privées)
    if (window._photosContenu && window._photosContenu.length) {
      const urls = [];
      for (const f of window._photosContenu) {
        try {
          const url = await uploadPhotoColis(f, user.id, colis.id, true);
          urls.push(url);
        } catch (e) { console.warn('Photo contenu:', e.message); }
      }
      if (urls.length) await db.from('colis').update({ photos_contenu_urls: urls }).eq('id', colis.id);
    }

    // 4. Paiement selon le moyen choisi
    if (moyen_paiement === 'carte') {
      const result = await callEdgeFunction('create-payment', {
        colis_id: colis.id,
        montant:  Math.round(prix * 100),
        user_id:  user.id,
      });
      if (result && result.url) { window.location.href = result.url; return; }
      throw new Error('Impossible de créer le lien de paiement Stripe. Réessayez.');
    }

    if (moyen_paiement === 'crypto') {
      t('Kolis publié ✅ — Envoyez le paiement crypto. Votre kolis sera activé dès réception.', 's');
    }

    // 5. Reset état
    window._photoEmballee = null;
    window._photosContenu = [];
    emUp = false;
    coUp = false;

    // 6. Afficher écran succès
    const codeLvr = colis.code_lvr || colis.id.substring(0, 8).toUpperCase();
    const sucEl   = document.getElementById('poster-suc');
    const codeEl  = document.getElementById('suc-code');
    const refEl   = document.getElementById('suc-ref');
    const formEl  = document.getElementById('poster-form');

    if (codeEl) codeEl.textContent = codeLvr;
    if (refEl)  refEl.textContent  = codeLvr;
    if (formEl) formEl.style.display = 'none';
    if (sucEl)  sucEl.style.display  = 'block';

    const cont = document.getElementById('content');
    if (cont) cont.scrollTop = 0;

    t('Kolis publié ! Code : ' + codeLvr + ' 🎉', 's');
    if (typeof celebrate === 'function') celebrate();

    // 7. Proposer boost après 1.5s
    setTimeout(() => {
      if (typeof afficherModalBoost === 'function') afficherModalBoost(colis.id, codeLvr);
    }, 1500);

    // 8. SMS destinataire
    if (typeof envoyerSMS === 'function') {
      envoyerSMS(rtel,
        'Bonjour ' + rnom + ' ! Un kolis vous est envoyé via DINVMIC. Votre code : ' + codeLvr + '. Suivez-le ici : https://kouletiokevin.github.io/livreo-app/?suivi=' + codeLvr + (colis.qr_secret ? '&k=' + encodeURIComponent(colis.qr_secret) : '')
      );
    }

  } catch (e) {
    t('Erreur : ' + (e.message || 'Erreur inconnue'), 'e');
    console.error('publishColis:', e);
  } finally {
    if (btn) { btn.textContent = 'Publier le kolis'; btn.disabled = false; }
  }
}
