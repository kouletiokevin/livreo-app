/* ═══════════════════════════════════════
   DINVMIC — Module Accueil / Dashboard
   Version 1.0 — Mai 2026
═══════════════════════════════════════ */

// ── Portefeuille ─────────────────────────
async function chargerPortefeuille(userId) {
  try {
    const { data, error } = await db.rpc('get_wallet_summary', { p_user_id: userId });
    if (error) throw new Error(error.message);

    const libere = parseFloat(data?.libere || 0);
    const escrow = parseFloat(data?.escrow || 0);

    const walletEl = document.getElementById('wallet-amount');
    const pendingEl = document.getElementById('wallet-pending');
    if (walletEl) walletEl.textContent = libere.toFixed(2).replace('.', ',') + '€';
    if (pendingEl) pendingEl.textContent = escrow > 0
      ? `Dont ${escrow.toFixed(2).replace('.', ',')}€ en attente de validation`
      : 'Aucun paiement en attente';
  } catch (e) { console.log('Portefeuille:', e.message); }
}

// ── Livraisons en cours ──────────────────
async function chargerLivraisonsEnCours(userId) {
  const container = document.getElementById('livraisons-list');
  if (!container) return;

  try {
    const { data } = await db.from('colis')
      .select('id, code_lvr, gare_depart, gare_arrivee, statut, prix, num_train, destinataire_nom, expediteur_id')
      .eq('livreur_id', userId)
      .in('statut', ['livreur_accepte', 'en_transit'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return;

    const empty = document.getElementById('livraisons-empty');
    if (empty) empty.remove();

    data.forEach(c => {
      const div = document.createElement('div');
      div.className = 'livr-item';
      div.onclick = () => openLivrFlow(
        c.code_lvr,
        `${c.gare_depart} → ${c.gare_arrivee}`,
        c.num_train || 'Train',
        c.destinataire_nom,
        c.prix,
        c.id,
        c.expediteur_id
      );
      div.innerHTML = `
        <div class="li-icon">📦</div>
        <div style="flex:1;">
          <div class="li-ref">${escapeHtml(c.code_lvr)}</div>
          <div class="li-detail">${escapeHtml(c.gare_depart)} → ${escapeHtml(c.gare_arrivee)} · ${escapeHtml(c.destinataire_nom)}</div>
          <div style="margin-top:3px;"><span class="prt">🚆 ${c.statut === 'en_transit' ? 'En transit' : 'En attente départ'}</span></div>
        </div>
        <div class="li-price">+${parseFloat(c.prix).toFixed(0)}€</div>
        <button onclick="event.stopPropagation();annulerPassageUI('${String(c.code_lvr).replace(/[^A-Za-z0-9_-]/g,'')}')" title="Annuler ce passage" style="background:none;border:none;color:var(--danger);font-size:.64rem;font-weight:800;cursor:pointer;padding:4px;flex-shrink:0;">Annuler</button>
        <div class="li-arrow">›</div>`;
      container.appendChild(div);
    });
  } catch (e) {
    console.error('Livraisons:', e.message);
    const empty = document.getElementById('livraisons-empty');
    if (empty) empty.textContent = 'Impossible de charger vos passages.';
  }
}

// ── Annulation par le passeur ────────────
async function annulerPassageUI(code) {
  if (!confirm('Annuler ce passage ?\nLe colis ' + code + ' redeviendra disponible pour un autre passeur.')) return;
  try {
    const { data, error } = await db.rpc('annuler_passage', { p_code_lvr: code });
    if (error || !data?.success) throw new Error(error?.message || data?.error || 'Echec');
    t('Passage annulé. Le colis est de nouveau disponible.', 's');
    const c = document.getElementById('livraisons-list');
    if (c) c.innerHTML = '<div id="livraisons-empty" style="text-align:center;padding:16px 0;font-size:.8rem;color:var(--muted);">Aucun passage en cours.</div>';
    if (user) chargerLivraisonsEnCours(user.id);
  } catch (e) { t('Erreur : ' + e.message, 'e'); }
}

// ── Annulation par l'expéditeur (grille de pénalité) ──
async function annulerColisUI(code) {
  if (!confirm('Annuler le colis ' + code + ' ?\nSelon l\'avancement, des frais peuvent être retenus (0% / 15% / 50%).')) return;
  try {
    const { data, error } = await db.rpc('annuler_colis', { p_code_lvr: code });
    if (error || !data?.success) throw new Error(error?.message || data?.error || 'Echec');
    t(data.message || 'Colis annulé', data.penalite > 0 ? '' : 's');
    if (typeof voirColisEnvoyes === 'function') voirColisEnvoyes();
  } catch (e) { t('Erreur : ' + e.message, 'e'); }
}

// ── Retrait de fonds ─────────────────────
function ouvrirRetrait() {
  openSheet(`
    <div style="text-align:center;padding:20px;">
      <div style="font-size:2.5rem;margin-bottom:12px;">💸</div>
      <div style="font-weight:900;font-size:1.1rem;margin-bottom:8px;">Retrait de fonds</div>
      <div style="font-size:.82rem;color:var(--muted);margin-bottom:20px;line-height:1.6;">
        Les virements automatiques vers votre compte bancaire seront disponibles prochainement via Stripe Connect.<br><br>
        Pour retirer vos fonds dès maintenant, contactez-nous :
      </div>
      <a href="mailto:support@dinvmic.fr" style="display:block;padding:12px;background:var(--g500);color:#fff;border-radius:50px;font-weight:700;font-size:.86rem;text-decoration:none;margin-bottom:8px;">
        📧 support@dinvmic.fr
      </a>
      <button onclick="closeSheet()" class="btn s full">Fermer</button>
    </div>
  `);
}

// ── Colis à récupérer près de vous ───────
async function chargerColisProches(userId, ville) {
  const box = document.getElementById('proches-list');
  if (!box) return;
  try {
    const { data } = await db.from('colis_public')
      .select('code_lvr, gare_depart, gare_arrivee, prix, remise_mode, expediteur_ville, created_at, expediteur_id')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
      .limit(20);
    let list = (data || []).filter(c => c.expediteur_id !== userId);
    const v = (ville || '').trim().toLowerCase();
    if (v) {
      const near = c => ((c.gare_depart||'').toLowerCase().includes(v) || (c.expediteur_ville||'').toLowerCase().includes(v));
      list.sort((a,b) => (near(b)?1:0) - (near(a)?1:0));
    }
    list = list.slice(0, 6);
    if (!list.length) {
      box.innerHTML = `<div style="text-align:center;padding:16px 0;font-size:.78rem;color:var(--muted);">Aucun colis disponible pour l'instant. Reviens bientôt !</div>`;
      return;
    }
    box.innerHTML = list.map(c => {
      const code = String(c.code_lvr).replace(/[^A-Za-z0-9_-]/g,'');
      const prix = parseFloat(c.prix||0).toFixed(2).replace('.',',');
      const gare = (c.gare_depart||'').split(' ')[0];
      const villeDep = (c.expediteur_ville || gare || '').trim();
      const rm = c.remise_mode || 'les_deux';
      const remiseTxt = rm === 'domicile' ? ('🏠 Chez l\'expéditeur'+( villeDep?' ('+escapeHtml( villeDep)+')':''))
        : rm === 'gare' ? ('🚉 En gare'+(gare?' ('+escapeHtml(gare)+')':''))
        : ('🏠 domicile ou 🚉 gare'+(gare?' ('+escapeHtml(gare)+')':''));
      return `<div onclick="openDetail('${code}')" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer;">
        <div style="font-size:1.4rem;flex-shrink:0;">📦</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.8rem;font-weight:800;">${_trajet(c.gare_depart, c.gare_arrivee)}</div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:3px;">${remiseTxt}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:.86rem;font-weight:900;color:var(--g500);">${prix}€</div>
          <div style="font-size:.6rem;color:var(--g600);font-weight:800;">Me proposer →</div>
        </div>
      </div>`;
    }).join('');
  } catch (e) { box.innerHTML = `<div style="text-align:center;padding:16px 0;font-size:.78rem;color:var(--muted);">Impossible de charger les colis proches.</div>`; }
}

// ── Helpers panels ───────────────────────
function _shHdr(titre) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
    <div style="font-size:1rem;font-weight:900;letter-spacing:-.3px;">${titre}</div>
    <button onclick="closeSheet()" style="width:28px;height:28px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
  </div>`;
}

function _statutLabel(s) {
  const m = {
    en_attente:      ['⏳','#fef3c7','#92400e','En attente'],
    livreur_accepte: ['✅','#dcfce7','#166534','Passeur trouvé'],
    en_transit:      ['🚆','#dbeafe','#1e40af','En transit'],
    livre:           ['📦','#f0fdf4','#15803d','Livré'],
    annule:          ['❌','#fee2e2','#991b1b','Annulé'],
    litige:          ['⚠️','#fff7ed','#c2410c','Litige'],
    escrow:          ['🔒','#f3f4f6','#374151','En attente'],
    libere:          ['💚','#dcfce7','#166534','Versé'],
    rembourse:       ['↩️','#fef3c7','#92400e','Remboursé'],
  };
  const [ico, bg, col, lbl] = m[s] || ['—','#f9fafb','#6b7280', s || '—'];
  return `<span style="font-size:.62rem;font-weight:800;padding:2px 7px;border-radius:50px;background:${bg};color:${col};white-space:nowrap;">${ico} ${lbl}</span>`;
}

function _dtFr(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function _trajet(dep, arr) {
  const short = s => (s || '').split(' ')[0];
  return `<span style="font-size:.78rem;font-weight:700;">${escapeHtml(short(dep))}</span>`
       + `<span style="color:var(--muted);margin:0 4px;">→</span>`
       + `<span style="font-size:.78rem;font-weight:700;">${escapeHtml(short(arr))}</span>`;
}

function _emptyMsg(msg) {
  return `<div style="text-align:center;padding:32px 16px;color:var(--muted);font-size:.84rem;">${msg}</div>`;
}

// ── Card "Colis envoyés" ─────────────────
async function voirColisEnvoyes() {
  if (!user) return;
  openSheet(_shHdr('📦 Colis envoyés') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('colis')
      .select('code_lvr, gare_depart, gare_arrivee, date_souhaitee, statut, prix, created_at')
      .eq('expediteur_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('📦 Colis envoyés');
    if (!data || !data.length) {
      html += _emptyMsg('Vous n\'avez encore rien envoyé');
    } else {
      html += data.map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="flex-shrink:0;">
            <div style="font-size:.7rem;font-weight:900;color:var(--g600);font-family:monospace;">${escapeHtml(c.code_lvr)}</div>
            <div style="margin-top:3px;">${_trajet(c.gare_depart, c.gare_arrivee)}</div>
          </div>
          <div style="flex:1;min-width:0;text-align:right;">
            <div style="font-size:.78rem;font-weight:800;color:var(--g500);">${parseFloat(c.prix).toFixed(2).replace('.',',')}€</div>
            <div style="font-size:.68rem;color:var(--muted);margin-bottom:3px;">${_dtFr(c.date_souhaitee || c.created_at)}</div>
            ${_statutLabel(c.statut)}
            ${c.statut==='en_attente' ? `<div style="margin-top:5px;"><button onclick="choisirPasseur('${String(c.code_lvr).replace(/[^A-Za-z0-9_-]/g,'')}')" style="background:var(--g500);border:none;color:#fff;font-size:.62rem;font-weight:800;cursor:pointer;padding:3px 10px;border-radius:50px;">👥 Choisir le passeur</button></div>` : ''}
            ${['en_attente','livreur_accepte','en_transit'].includes(c.statut) ? `<div style="margin-top:5px;"><button onclick="annulerColisUI('${String(c.code_lvr).replace(/[^A-Za-z0-9_-]/g,'')}')" style="background:none;border:1px solid var(--danger);color:var(--danger);font-size:.62rem;font-weight:800;cursor:pointer;padding:3px 10px;border-radius:50px;">Annuler</button></div>` : ''}
          </div>
        </div>`).join('');
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('📦 Colis envoyés') + _emptyMsg('Impossible de charger les données'));
  }
}

// ── Choisir le passeur (expéditeur) ──────
async function choisirPasseur(codeLvr){
  if(!user) return;
  openSheet(_shHdr('👥 Choisir le passeur') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try{
    const { data, error } = await db.rpc('lister_candidatures', { p_code_lvr: codeLvr });
    if(error || !data || data.error) throw new Error((data&&data.error)||'indisponible');
    const list = data.candidats || [];
    let html = _shHdr('👥 Choisir le passeur');
    if(!list.length){
      html += _emptyMsg('Aucun passeur ne s\'est encore proposé. Reviens un peu plus tard !');
    } else {
      html += `<div style="font-size:.74rem;color:var(--muted);margin-bottom:10px;">${list.length} passeur(s) intéressé(s) · choisis-en un seul.</div>`;
      html += list.map(c=>{
        const note = c.note_moyenne>0 ? '⭐'+parseFloat(c.note_moyenne).toFixed(1) : 'Nouveau';
        const certif = c.is_certified ? badgeBleuSVG(15) : '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border);">
          <div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,var(--g300),var(--g500));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;flex-shrink:0;">${escapeHtml((c.prenom||'?')[0].toUpperCase())}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:.84rem;font-weight:800;">${escapeHtml(c.prenom||'Passeur')} ${certif}</div>
            <div style="font-size:.7rem;color:var(--muted);">${c.ville?escapeHtml(c.ville)+' · ':''}${c.nb_livraisons||0} livraison(s) · ${note}</div>
          </div>
          <button onclick="validerPasseur('${codeLvr}','${String(c.passeur_id)}')" class="btn p" style="padding:6px 14px;font-size:.74rem;flex-shrink:0;">Choisir</button>
        </div>`;
      }).join('');
    }
    openSheet(html);
  }catch(e){ openSheet(_shHdr('👥 Choisir le passeur') + _emptyMsg('Impossible de charger les passeurs')); }
}
async function validerPasseur(codeLvr, passeurId){
  if(!confirm('Choisir ce passeur pour livrer le colis ?\nLes autres passeurs seront informés que le colis est attribué.')) return;
  try{
    const { data:{session} } = await db.auth.getSession();
    if(!session) throw new Error('Session expirée, reconnectez-vous');
    const res = await fetchWithTimeout(`${SUPA_URL}/functions/v1/accepter-colis`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+session.access_token },
      body: JSON.stringify({ code_lvr: codeLvr, livreur_id: passeurId })
    }, 15000);
    const r = await res.json();
    if(!r.success) throw new Error(r.error||'Réessayez dans un instant');
    closeSheet();
    t('Passeur choisi ✅ — il a été notifié','s');
    if(typeof celebrate==='function') celebrate();
    if(typeof voirColisEnvoyes==='function') voirColisEnvoyes();
  }catch(e){ t('Erreur : '+e.message,'e'); }
}

// ── Card "Passages" ──────────────────────
async function voirPassages() {
  if (!user) return;
  openSheet(_shHdr('🚆 Mes passages') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('colis')
      .select('code_lvr, gare_depart, gare_arrivee, date_souhaitee, statut, prix, created_at')
      .eq('livreur_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('🚆 Mes passages');
    if (!data || !data.length) {
      html += _emptyMsg('Vous n\'avez encore effectué aucun passage');
    } else {
      html += data.map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="flex-shrink:0;">
            <div style="font-size:.7rem;font-weight:900;color:var(--g600);font-family:monospace;">${escapeHtml(c.code_lvr)}</div>
            <div style="margin-top:3px;">${_trajet(c.gare_depart, c.gare_arrivee)}</div>
          </div>
          <div style="flex:1;min-width:0;text-align:right;">
            <div style="font-size:.78rem;font-weight:800;color:var(--g500);">+${parseFloat(c.prix).toFixed(2).replace('.',',')}€</div>
            <div style="font-size:.68rem;color:var(--muted);margin-bottom:3px;">${_dtFr(c.date_souhaitee || c.created_at)}</div>
            ${_statutLabel(c.statut)}
          </div>
        </div>`).join('');
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('🚆 Mes passages') + _emptyMsg('Impossible de charger les données'));
  }
}

// ── Card "Gains totaux" ──────────────────
async function voirGains() {
  if (!user) return;
  openSheet(_shHdr('💰 Gains totaux') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('transactions')
      .select('montant, statut, created_at, colis(code_lvr, gare_depart, gare_arrivee)')
      .eq('livreur_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('💰 Gains totaux');
    if (!data || !data.length) {
      html += _emptyMsg('Aucun gain pour le moment');
    } else {
      const total = data.reduce((s, tx) => s + parseFloat(tx.montant || 0), 0);
      html += data.map(tx => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="flex:1;min-width:0;">
            <div style="font-size:.7rem;font-weight:900;color:var(--g600);font-family:monospace;">${escapeHtml(tx.colis?.code_lvr || '—')}</div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:2px;">${_dtFr(tx.created_at)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:.88rem;font-weight:900;color:var(--g500);">+${parseFloat(tx.montant || 0).toFixed(2).replace('.',',')}€</div>
            <div style="margin-top:3px;">${_statutLabel(tx.statut)}</div>
          </div>
        </div>`).join('');
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0 4px;margin-top:4px;border-top:2px solid var(--ink);">
        <span style="font-size:.84rem;font-weight:900;">Total</span>
        <span style="font-size:1.1rem;font-weight:900;color:var(--g500);">${total.toFixed(2).replace('.',',')}€</span>
      </div>`;
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('💰 Gains totaux') + _emptyMsg('Impossible de charger les données'));
  }
}

// ── Card "Ma note" ───────────────────────
async function voirAvis() {
  if (!user) return;
  openSheet(_shHdr('⭐ Mes avis reçus') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('avis')
      .select('note, commentaire, created_at, users!avis_auteur_id_fkey(prenom)')
      .eq('cible_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('⭐ Mes avis reçus');
    if (!data || !data.length) {
      html += _emptyMsg('Aucun avis pour le moment');
    } else {
      html += data.map(a => {
        const etoiles = '⭐'.repeat(a.note) + '☆'.repeat(5 - a.note);
        const prenom = escapeHtml(a.users?.prenom || 'Anonyme');
        return `
          <div style="padding:12px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:.95rem;letter-spacing:1px;">${etoiles}</span>
              <span style="font-size:.7rem;color:var(--muted);">${_dtFr(a.created_at)}</span>
            </div>
            ${a.commentaire ? `<div style="font-size:.8rem;color:var(--ink);line-height:1.5;margin-bottom:4px;">"${escapeHtml(a.commentaire)}"</div>` : ''}
            <div style="font-size:.7rem;font-weight:700;color:var(--g600);">— ${prenom}</div>
          </div>`;
      }).join('');
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('⭐ Mes avis reçus') + _emptyMsg('Impossible de charger les avis'));
  }
}

// ── KPIs dashboard ───────────────────────
async function chargerKPIs(userId, profil) {
  const nbEnvoyes   = profil?.nb_colis_envoyes || 0;
  const nbLivraisons = profil?.nb_livraisons   || 0;
  const note        = profil?.note_moyenne     || 0;

  const { data: gainsData } = await db.rpc('get_kpi_gains', { p_user_id: userId });
  const gains = parseFloat(gainsData || 0);

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('kpi-envoyes',    nbEnvoyes);
  set('kpi-livraisons', nbLivraisons);
  set('kpi-gains',      gains.toFixed(0) + '€');
  set('kpi-note',       note > 0 ? note.toFixed(1) + '⭐' : 'Pas encore de note ⭐');

  try {
    const { data: depData } = await db.from('transactions').select('montant').eq('expediteur_id', userId).in('statut', ['escrow', 'libere']);
    const depense = (depData || []).reduce((sum, tx) => sum + parseFloat(tx.montant || 0), 0);
    set('kpi-depense', depense.toFixed(0) + '€');
  } catch (_e) { set('kpi-depense', '0€'); }

  // ── Impact : économies vs La Poste + CO₂ évité (estimations) ──
  const nEnv = nbEnvoyes || 0;
  const euros = Math.round(nEnv * 4.5);
  const co2 = nEnv * 0.5;
  set('impact-savings', euros + ' €');
  set('impact-co2', (co2 % 1 === 0 ? String(co2) : co2.toFixed(1).replace('.', ',')) + ' kg');
  const noteEl = document.getElementById('impact-note');
  if (noteEl) noteEl.textContent = nEnv > 0
    ? `Sur ${nEnv} envoi${nEnv > 1 ? 's' : ''} — merci de rendre la livraison plus verte 🌱`
    : `Envoie ton 1er colis : moins cher que La Poste et plus écolo 🌱`;
}

// ── Reçus de paiement ─────────────────────
async function chargerRecus(userId) {
  const container = document.getElementById('recus-list');
  if (!container) return;
  try {
    const { data } = await db.from('transactions')
      .select('id, montant, statut, created_at, type, colis(code_lvr, gare_depart, gare_arrivee)')
      .or(`expediteur_id.eq.${userId},livreur_id.eq.${userId}`)
      .in('statut', ['libere', 'escrow', 'rembourse'])
      .order('created_at', { ascending: false })
      .limit(3);

    if (!data || !data.length) {
      container.innerHTML = `<div style="text-align:center;padding:16px 0;font-size:.78rem;color:var(--muted);">Aucun reçu disponible pour le moment.</div>`;
      return;
    }

    container.innerHTML = data.map(tx => {
      const dt = new Date(tx.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
      const ref = tx.colis?.code_lvr || '—';
      const trajet = tx.colis ? `${(tx.colis.gare_depart||'').split(' ')[0]} → ${(tx.colis.gare_arrivee||'').split(' ')[0]}` : '—';
      const montant = parseFloat(tx.montant || 0).toFixed(2).replace('.', ',');
      const statutCol = tx.statut === 'libere' ? '#16a34a' : tx.statut === 'rembourse' ? '#dc2626' : '#92400e';
      const statutLbl = tx.statut === 'libere' ? 'Versé' : tx.statut === 'rembourse' ? 'Remboursé' : 'En attente';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--cream);border-radius:10px;border:1px solid var(--border);">
        <div style="font-size:1.3rem;">🧾</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.78rem;font-weight:800;color:var(--ink);">${escapeHtml(ref)} · ${escapeHtml(trajet)}</div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:1px;">${dt} · <span style="color:${statutCol};font-weight:700;">${statutLbl}</span></div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:.9rem;font-weight:900;color:var(--g600);">${montant}€</div>
          <button onclick="telechargerRecu('${tx.id}')" style="font-size:.62rem;font-weight:700;color:var(--g500);background:none;border:none;cursor:pointer;padding:2px 0;white-space:nowrap;">⬇ Reçu</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    if (container) container.innerHTML = `<div style="text-align:center;padding:16px 0;font-size:.78rem;color:var(--muted);">Impossible de charger les reçus.</div>`;
  }
}

async function voirTousRecus() {
  if (!user) return;
  openSheet(_shHdr('🧾 Mes reçus DINVMIC') + `<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>`);
  try {
    const { data } = await db.from('transactions')
      .select('id, montant, statut, created_at, type, colis(code_lvr, gare_depart, gare_arrivee)')
      .or(`expediteur_id.eq.${user.id},livreur_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    let html = _shHdr('🧾 Mes reçus DINVMIC');
    if (!data || !data.length) {
      html += _emptyMsg('Aucune transaction pour le moment');
    } else {
      html += data.map(tx => {
        const dt = new Date(tx.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        const ref = tx.colis?.code_lvr || '—';
        const trajet = tx.colis ? `${tx.colis.gare_depart || 'À définir'} → ${tx.colis.gare_arrivee || 'À définir'}` : '—';
        const montant = parseFloat(tx.montant || 0).toFixed(2).replace('.', ',');
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:1.4rem;">🧾</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:.82rem;font-weight:800;">${escapeHtml(ref)}</div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:1px;">${escapeHtml(trajet)}</div>
            <div style="font-size:.68rem;color:var(--muted2);margin-top:1px;">${dt}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:1rem;font-weight:900;color:var(--g600);">${montant}€</div>
            ${_statutLabel(tx.statut)}
            <div style="margin-top:4px;"><button onclick="telechargerRecu('${tx.id}')" style="font-size:.68rem;font-weight:700;color:var(--g500);background:var(--g50);border:1px solid var(--g100);border-radius:6px;cursor:pointer;padding:3px 8px;">⬇ Reçu PDF</button></div>
          </div>
        </div>`;
      }).join('');
    }
    openSheet(html);
  } catch(e) {
    openSheet(_shHdr('🧾 Mes reçus DINVMIC') + _emptyMsg('Impossible de charger'));
  }
}

function telechargerRecu(txId) {
  if (!user || !txId) return;
  // Génère un reçu HTML simplifié et l'ouvre dans un nouvel onglet
  const win = window.open('', '_blank');
  if (!win) { t('Autorisez les popups pour télécharger le reçu', 'e'); return; }

  db.from('transactions')
    .select('id, montant, statut, created_at, type, colis(code_lvr, gare_depart, gare_arrivee, prix)')
    .eq('id', txId)
    .single()
    .then(({ data: tx }) => {
      const dt = new Date(tx?.created_at || Date.now()).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      const ref = tx?.colis?.code_lvr || '—';
      const montant = parseFloat(tx?.montant || 0).toFixed(2);
      const trajet = tx?.colis ? `${escapeHtml(tx.colis.gare_depart || 'À définir')} → ${escapeHtml(tx.colis.gare_arrivee || 'À définir')}` : '—';
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reçu DINVMIC — ${ref}</title>
      <style>body{font-family:Georgia,serif;max-width:600px;margin:40px auto;padding:0 20px;color:#111;}
      h1{font-size:1.4rem;color:#1a3320;}.lbl{font-size:.8rem;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-top:16px;}
      .val{font-size:1rem;font-weight:700;margin-top:2px;}.total{font-size:1.6rem;font-weight:900;color:#1a8044;margin-top:8px;}
      .footer{margin-top:40px;font-size:.72rem;color:#999;border-top:1px solid #eee;padding-top:12px;}
      @media print{button{display:none!important;}}</style></head>
      <body>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div style="width:40px;height:40px;background:#0e1a10;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:#2ecc71;">K</div>
        <div><div style="font-size:1.1rem;font-weight:900;">DINVMIC</div><div style="font-size:.72rem;color:#666;">Reçu de transaction</div></div>
        <button onclick="window.print()" style="margin-left:auto;padding:8px 16px;background:#1a8044;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.82rem;">🖨 Imprimer</button>
      </div>
      <div style="background:#f7faf7;border:1.5px solid #d1fae5;border-radius:12px;padding:20px;margin-bottom:20px;">
        <div class="lbl">Référence</div><div class="val">${ref}</div>
        <div class="lbl">Trajet</div><div class="val">${trajet}</div>
        <div class="lbl">Date</div><div class="val">${dt}</div>
        <div class="lbl">Montant total</div><div class="total">${montant}€</div>
      </div>
      <div style="font-size:.78rem;color:#555;line-height:1.6;">
        Ce reçu atteste d'une transaction réalisée sur la plateforme DINVMIC.<br>
        DINVMIC — SASU en cours d'immatriculation · 12 Rue de la Paix, 75002 Paris<br>
        contact@dinvmic.fr
      </div>
      <div class="footer">Document généré le ${new Date().toLocaleDateString('fr-FR')} · DINVMIC v1.0</div>
      </body></html>`);
      win.document.close();
    }).catch(() => {
      win.close();
      t('Impossible de générer le reçu', 'e');
    });
}
