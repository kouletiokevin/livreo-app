/* ═══════════════════════════════════════
   DINVMIC — Module Suivi colis
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Colis courant ────────────────────────
let _currentColis = null;

// ── Recherche suivi ──────────────────────
async function loadSuivi() {
  const svInput = document.getElementById('sv-input');
  const box = document.getElementById('sv-detail');
  if (!svInput || !box) return;
  const val = svInput.value.trim().toUpperCase();
  if (!val) { t('Entrez votre numéro de suivi', 'e'); return; }
  box.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.84rem;">Chargement…</div>';
  const { data: colis, error } = await db.from('colis_public').select('*').eq('code_lvr', val).single();
  if (error || !colis) { box.innerHTML = ''; t('Code introuvable. Vérifiez le code reçu par SMS.', 'e'); return; }
  _currentColis = colis;
  renderSuivi(colis);
  const c = document.getElementById('content'); if (c) c.scrollTop = 140;
}

function _svTime(x) {
  return x ? new Date(x).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
}

function renderSuivi(colis) {
  const box = document.getElementById('sv-detail'); if (!box) return;
  const isExp = !!(user && user.id === colis.expediteur_id);
  const isPasseur = !!(user && colis.livreur_id && user.id === colis.livreur_id);
  const st = colis.statut;
  const steps = [
    { ic: '📦', lbl: 'Colis publié', at: colis.created_at, done: true },
    { ic: '🤝', lbl: 'Passeur choisi', at: colis.accepted_at, done: !!colis.accepted_at || ['livreur_accepte', 'en_transit', 'livre'].includes(st) },
    { ic: '📥', lbl: 'Colis récupéré par le passeur', at: colis.collected_at, done: !!colis.collected_at },
    { ic: '🚆', lbl: 'En route — train parti', at: colis.departed_at, done: !!colis.departed_at },
    { ic: '🚉', lbl: 'Arrivé en gare de destination', at: colis.arrived_at, done: !!colis.arrived_at },
    { ic: '✅', lbl: 'Colis remis & paiement libéré', at: colis.delivered_at, done: st === 'livre' || !!colis.delivered_at },
  ];
  const activeIdx = steps.findIndex(s => !s.done);
  const tl = steps.map((s, i) => {
    const cls = s.done ? 'done' : (i === activeIdx ? 'active' : '');
    const time = s.at ? _svTime(s.at) : (i === activeIdx ? 'En cours' : '—');
    const faded = (s.done || i === activeIdx) ? '' : ' faded';
    return `<div class="tli"><div class="tld ${cls}"></div><div class="tl-time">${time}</div><div class="tl-txt${faded}">${s.ic} ${s.lbl}</div></div>`;
  }).join('');
  const pill = st === 'livre' ? '<span class="tpill pill-ok">✅ Livré</span>'
    : st === 'en_transit' ? '<span class="tpill pill-tr">🚆 En transit</span>'
    : st === 'livreur_accepte' ? '<span class="tpill pill-tr">🤝 Passeur trouvé</span>'
    : '<span class="tpill">⏳ En attente</span>';
  let html = `<div class="tcard">
    <div class="thead"><div><div class="tref">${escapeHtml(colis.code_lvr)}</div><div class="troute">${escapeHtml((colis.gare_depart || '—') + ' → ' + (colis.gare_arrivee || '—'))}</div></div>${pill}</div>
    <div class="tl-wrap"><div class="timeline">${tl}</div></div>
  </div>`;

  if (st !== 'livre' && isPasseur) {
    html += `<div class="tcard" style="margin-top:10px;"><div style="font-size:.82rem;font-weight:900;margin-bottom:8px;">🚆 Vous transportez ce colis</div>${_passeurActions(colis)}</div>`;
  } else if (st !== 'livre' && !isExp) {
    html += `<div class="tcard" style="margin-top:10px;text-align:center;">
      <div style="font-size:.82rem;font-weight:900;margin-bottom:4px;">Votre QR Code de réception</div>
      <div style="font-size:.7rem;color:var(--muted);margin-bottom:12px;">À présenter au passeur lors de la remise. Ne le partagez avec personne.</div>
      <div id="qr-canvas" style="display:inline-block;"></div>
      <div style="font-size:.68rem;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;margin-top:12px;line-height:1.5;">⚠️ Vérifiez le colis (emballage + contenu) AVANT de montrer ce code : une fois scanné, le passage est confirmé et le paiement libéré.</div>
    </div>`;
  } else if (st !== 'livre' && isExp) {
    html += `<div class="tcard" style="margin-top:10px;"><div style="font-size:.76rem;color:var(--muted);line-height:1.5;">📬 Le destinataire a reçu son code par SMS. Il affichera son QR Code au passeur à la remise pour confirmer la livraison.</div></div>`;
  }

  if (st === 'livre') {
    html += `<div class="tcard" style="margin-top:10px;text-align:center;">
      <div style="font-size:1.8rem;">✅</div>
      <div style="font-weight:900;margin:4px 0;">Colis livré</div>
      <div style="font-size:.76rem;color:var(--muted);">Remis le ${_svTime(colis.delivered_at) || '—'} · paiement libéré.</div>`;
    if (isExp && colis.livreur_id) html += `<button class="btn p full" style="margin-top:12px;" onclick="ouvrirNotation('${colis.id}','${colis.livreur_id}','le passeur')">⭐ Noter votre passeur</button>`;
    html += `</div>`;
  }

  html += '<div id="sv-contacts"></div>';
  html += `<div style="text-align:center;margin-top:12px;"><button type="button" onclick="signalerProbleme('${String(colis.code_lvr).replace(/[^A-Za-z0-9_-]/g,'')}')" style="background:none;border:none;color:var(--muted);font-size:.74rem;text-decoration:underline;cursor:pointer;font-family:var(--sans);">⚠️ Signaler un problème</button></div>`;
  box.innerHTML = html;
  if (colis.livreur_id && st !== 'livre') loadContacts(colis);
  if (st !== 'livre' && !isExp && !isPasseur) { qrLoaded = false; loadQR(colis); }
  t('Colis trouvé ✅', 's');
}

function _passeurActions(colis) {
  const code = String(colis.code_lvr).replace(/[^A-Za-z0-9_-]/g, '');
  if (!colis.collected_at) return `<button class="btn p full" onclick="majEtapeSuivi('${code}','collected')">📥 J'ai récupéré le colis</button>`;
  if (!colis.departed_at)  return `<button class="btn p full" onclick="majEtapeSuivi('${code}','departed')">🚆 Le train est parti</button>`;
  if (!colis.arrived_at)   return `<button class="btn p full" onclick="majEtapeSuivi('${code}','arrived')">🚉 Je suis arrivé en gare</button>`;
  const route = escapeHtml((colis.gare_depart || '') + ' → ' + (colis.gare_arrivee || ''));
  const train = escapeHtml(colis.num_train || 'Train');
  return `<div style="font-size:.76rem;color:var(--muted);margin-bottom:8px;line-height:1.5;">Demandez au destinataire d'afficher son QR Code, puis scannez-le pour clôturer la livraison et libérer le paiement.</div>
    <button class="btn p full" onclick="openLivrFlow('${code}','${route}','${train}','le destinataire','${colis.prix}','${colis.id}','${colis.expediteur_id}')">📷 Scanner le QR & confirmer la remise</button>`;
}

async function majEtapeSuivi(code, etape) {
  try {
    const { data, error } = await db.rpc('passeur_maj_etape', { p_code_lvr: code, p_etape: etape });
    if (error) throw new Error(error.message);
    if (data && data.success === false) throw new Error(data.error || 'Impossible');
    t('Étape mise à jour ✅', 's');
    if (typeof celebrate === 'function') celebrate();
    const { data: colis } = await db.from('colis_public').select('*').eq('code_lvr', code).single();
    if (colis) { _currentColis = colis; renderSuivi(colis); }
  } catch (e) { t('Erreur : ' + e.message, 'e'); }
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

// ── Signaler un problème (litige) ─────────
function signalerProbleme(code) {
  fermerLitige();
  const ov = document.createElement('div');
  ov.id = 'litige-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(14,26,16,.55);display:flex;align-items:flex-end;justify-content:center;';
  ov.onclick = function (e) { if (e.target === ov) fermerLitige(); };
  ov.innerHTML = '<div style="background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -8px 40px rgba(0,0,0,.25);">'
    + '<div style="width:38px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 14px;"></div>'
    + '<div style="font-size:1.02rem;font-weight:900;margin-bottom:2px;">⚠️ Signaler un problème</div>'
    + '<div style="font-size:.74rem;color:var(--muted);margin-bottom:14px;">Colis ' + escapeHtml(code) + '. Notre équipe examine chaque signalement.</div>'
    + '<label style="font-size:.7rem;font-weight:800;color:var(--g600);text-transform:uppercase;letter-spacing:.4px;">Motif</label>'
    + '<select id="lit-motif" style="width:100%;margin:6px 0 12px;padding:11px;border:1.5px solid var(--border);border-radius:12px;font-family:var(--sans);font-size:.85rem;background:#fff;">'
    + '<option value="Colis non reçu">Colis non reçu</option>'
    + '<option value="Colis endommagé">Colis endommagé / cassé</option>'
    + '<option value="Contenu non conforme">Contenu non conforme</option>'
    + '<option value="Colis manquant ou volé">Colis manquant ou volé</option>'
    + '<option value="Retard important">Retard important</option>'
    + '<option value="Comportement d\'un utilisateur">Comportement d\'un utilisateur</option>'
    + '<option value="Autre">Autre</option>'
    + '</select>'
    + '<label style="font-size:.7rem;font-weight:800;color:var(--g600);text-transform:uppercase;letter-spacing:.4px;">Détails</label>'
    + '<textarea id="lit-desc" rows="4" placeholder="Décrivez ce qu\'il s\'est passé…" style="width:100%;margin:6px 0 14px;padding:11px;border:1.5px solid var(--border);border-radius:12px;font-family:var(--sans);font-size:.85rem;resize:vertical;box-sizing:border-box;"></textarea>'
    + '<div style="display:flex;gap:8px;">'
    + '<button type="button" onclick="fermerLitige()" class="btn s" style="flex:1;">Annuler</button>'
    + '<button type="button" id="lit-send" onclick="envoyerLitige(\'' + code + '\')" class="btn p" style="flex:2;">Envoyer</button>'
    + '</div></div>';
  document.body.appendChild(ov);
}

function fermerLitige() {
  const o = document.getElementById('litige-overlay');
  if (o) o.remove();
}

async function envoyerLitige(code) {
  const motif = (document.getElementById('lit-motif') || {}).value || 'Autre';
  const descEl = document.getElementById('lit-desc');
  const desc = descEl ? descEl.value.trim() : '';
  if (!desc) { t('Décrivez le problème', 'e'); if (descEl) descEl.focus(); return; }
  const btn = document.getElementById('lit-send');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  try {
    const { data, error } = await db.rpc('signaler_litige', {
      p_code_lvr: code,
      p_motif: motif,
      p_description: (typeof sanitize === 'function' ? sanitize(desc) : desc),
    });
    if (error) throw new Error(error.message);
    if (data && data.success === false) throw new Error(data.error || 'Impossible');
    fermerLitige();
    t('Signalement envoyé ✅ Nous revenons vers vous rapidement.', 's');
  } catch (e) {
    t('Erreur : ' + e.message, 'e');
    if (btn) { btn.disabled = false; btn.textContent = 'Envoyer'; }
  }
}

// ── Contacts du colis (numéros révélés aux seules parties concernées) ──
async function loadContacts(colis) {
  const box = document.getElementById('sv-contacts');
  if (!box) return;
  let secret = null;
  try { const k = new URLSearchParams(window.location.search).get('k'); if (k && k.length >= 16) secret = k; } catch (e) {}
  let data = null;
  try {
    const r = await db.rpc('get_colis_contacts', { p_code_lvr: colis.code_lvr, p_qr_secret: secret });
    data = r.data;
  } catch (e) { return; }
  if (!data || data.error) { box.innerHTML = ''; return; }

  const ligne = (titre, c) => {
    if (!c || !c.telephone) return '';
    const tel = String(c.telephone).replace(/[^0-9+]/g, '');
    const nom = escapeHtml(c.prenom || c.nom || '');
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid var(--border);">
      <div style="min-width:0;"><div style="font-size:.7rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.3px;">${titre}</div><div style="font-weight:800;font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nom}</div></div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <a href="tel:${tel}" style="text-decoration:none;background:var(--g50);border:1px solid var(--g100);color:var(--g500);font-size:.74rem;font-weight:800;padding:7px 11px;border-radius:50px;">📞 Appeler</a>
        <a href="sms:${tel}" style="text-decoration:none;background:var(--white);border:1px solid var(--border);color:var(--ink);font-size:.74rem;font-weight:800;padding:7px 11px;border-radius:50px;">💬 SMS</a>
      </div>
    </div>`;
  };

  let inner = '';
  if (data.role === 'passeur') {
    inner += ligne('Expéditeur', data.expediteur);
    inner += ligne('Destinataire', data.destinataire);
  } else {
    inner += ligne('Votre passeur', data.passeur);
  }
  box.innerHTML = inner
    ? `<div class="tcard" style="margin-top:10px;"><div style="font-size:.82rem;font-weight:900;margin-bottom:2px;">📇 Contacts</div><div style="font-size:.7rem;color:var(--muted);margin-bottom:4px;">Pour vous coordonner pendant la livraison.</div>${inner}</div>`
    : '';
}
