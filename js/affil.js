/* ═══════════════════════════════════════
   DINVMIC — Module Affiliation
   Version 1.0 — Juin 2026
═══════════════════════════════════════ */

async function loadAffiliateCard() {
  if (!user) return;
  const card = document.getElementById('affil-card');
  if (!card) return;

  const { data: aff, error } = await db.from('affiliates')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !aff) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const content = document.getElementById('affil-content');
  if (!content) return;

  if (aff.statut === 'pending') {
    content.innerHTML = `
      <div style="text-align:center;padding:18px;background:rgba(245,158,11,.06);border-radius:12px;border:1px dashed rgba(245,158,11,.3);">
        <div style="font-size:1.5rem;margin-bottom:8px;">⏳</div>
        <div style="font-size:.82rem;font-weight:800;color:#d97706;margin-bottom:4px;">Demande en cours de validation</div>
        <div style="font-size:.72rem;color:var(--muted);">Votre accès au programme d'affiliation est en attente d'approbation par l'équipe DINVMIC.</div>
      </div>`;
    return;
  }

  if (aff.statut === 'suspendu') {
    content.innerHTML = `
      <div style="text-align:center;padding:18px;background:rgba(239,68,68,.06);border-radius:12px;border:1px dashed rgba(239,68,68,.3);">
        <div style="font-size:1.5rem;margin-bottom:8px;">🚫</div>
        <div style="font-size:.82rem;font-weight:800;color:#dc2626;margin-bottom:4px;">Programme suspendu</div>
        <div style="font-size:.72rem;color:var(--muted);">Votre accès au programme d'affiliation a été suspendu. Contactez <a href="mailto:support@dinvmic.fr" style="color:var(--g500);">support@dinvmic.fr</a>.</div>
      </div>`;
    return;
  }

  // ── Affilié actif : charger les stats ──────────────────
  const baseUrl = window.location.origin;
  const refLink = `${baseUrl}/?ref=${aff.code}`;

  const [refRes, commRes] = await Promise.all([
    db.from('affiliate_referrals').select('id, created_at').eq('affiliate_id', aff.id),
    db.from('affiliate_commissions').select('commission, statut, mois').eq('affiliate_id', aff.id)
  ]);

  const refs   = refRes.data  || [];
  const comms  = commRes.data || [];
  const total  = comms.reduce((s, c) => s + Number(c.commission || 0), 0);
  const paid   = comms.filter(c => c.statut === 'paye').reduce((s, c) => s + Number(c.commission || 0), 0);
  const pending = total - paid;
  const thisMois = new Date().toISOString().slice(0, 7);
  const thisMonth = comms.filter(c => c.mois === thisMois).reduce((s, c) => s + Number(c.commission || 0), 0);

  content.innerHTML = `
    <div style="background:var(--g50);border-radius:12px;padding:14px;margin-bottom:12px;border:1px solid var(--g100);">
      <div style="font-size:.75rem;font-weight:800;color:var(--g700);margin-bottom:8px;">🔗 Votre lien d'affiliation</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;background:#fff;border-radius:8px;padding:9px 12px;font-size:.7rem;color:var(--g600);font-weight:600;font-family:monospace;border:1px solid var(--g200);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${refLink}</div>
        <button onclick="copierLienAffil('${refLink}')" class="btn p" style="padding:8px 14px;font-size:.72rem;flex-shrink:0;">📋 Copier</button>
      </div>
      <div style="margin-top:6px;font-size:.68rem;color:var(--muted);">Code : <strong>${aff.code}</strong> · Partagez ce lien pour gagner <strong>10%</strong> pendant <strong>6 mois</strong> par inscrit</div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input id="affil-code-new" style="flex:1;font-size:.78rem;padding:9px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--cream);font-family:monospace;" value="${aff.code}" placeholder="votre-code">
      <button onclick="saveAffilCode('${aff.id}')" class="btn s" style="flex-shrink:0;padding:9px 14px;font-size:.72rem;">Changer le code</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
      <div style="background:var(--cream);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border);">
        <div style="font-size:1.4rem;font-weight:900;color:var(--g600);">${refs.length}</div>
        <div style="font-size:.64rem;color:var(--muted);margin-top:2px;">Inscrits</div>
      </div>
      <div style="background:var(--cream);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border);">
        <div style="font-size:1.4rem;font-weight:900;color:var(--g600);">${pending.toFixed(2)}€</div>
        <div style="font-size:.64rem;color:var(--muted);margin-top:2px;">À recevoir</div>
      </div>
      <div style="background:var(--cream);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border);">
        <div style="font-size:1.4rem;font-weight:900;color:var(--g600);">${paid.toFixed(2)}€</div>
        <div style="font-size:.64rem;color:var(--muted);margin-top:2px;">Reçu</div>
      </div>
    </div>

    <div style="font-size:.7rem;color:var(--muted);text-align:center;padding:9px;background:var(--cream);border-radius:8px;border:1px solid var(--border);">
      💰 Ce mois-ci : <strong style="color:var(--g600);">${thisMonth.toFixed(2)}€</strong> · Virements automatiques en fin de mois
    </div>

    ${aff.payout_info ? `<div style="margin-top:10px;font-size:.7rem;color:var(--muted);padding:8px 12px;background:var(--g50);border-radius:8px;">💳 Paiement vers : <strong>${aff.payout_info}</strong> <button onclick="document.getElementById('affil-payout-wrap').style.display='block'" style="font-size:.65rem;color:var(--g500);background:none;border:none;cursor:pointer;text-decoration:underline;">Modifier</button></div>` : ''}
    <div id="affil-payout-wrap" style="margin-top:10px;${aff.payout_info ? 'display:none;' : ''}padding:10px;background:rgba(245,158,11,.07);border-radius:8px;border:1px dashed rgba(245,158,11,.3);">
      ${!aff.payout_info ? '<div style="font-size:.72rem;font-weight:700;color:#d97706;margin-bottom:6px;">⚠️ Ajoutez vos coordonnées pour recevoir vos commissions</div>' : ''}
      <input id="affil-payout" style="width:100%;font-size:.75rem;padding:8px 12px;border-radius:8px;border:1.5px solid rgba(245,158,11,.3);background:#fff;margin-bottom:8px;" placeholder="IBAN, email PayPal ou numéro de compte" value="${aff.payout_info || ''}">
      <button onclick="saveAffilPayout('${aff.id}')" class="btn p" style="width:100%;font-size:.75rem;padding:9px;">💾 Sauvegarder</button>
    </div>
  `;
}

function copierLienAffil(link) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(link).then(() => t('Lien copié ! 📋', 's')).catch(() => _fallbackCopy(link));
  } else { _fallbackCopy(link); }
}

function _fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); t('Lien copié ! 📋', 's'); } catch(e) {}
  document.body.removeChild(ta);
}

async function saveAffilCode(affilId) {
  const raw = document.getElementById('affil-code-new')?.value.trim();
  const newCode = raw.toLowerCase().replace(/[^a-z0-9\-_]/g, '').slice(0, 30);
  if (!newCode || newCode.length < 3) { t('Code invalide (min. 3 caractères a-z, 0-9, tiret)', 'e'); return; }
  const { error } = await db.from('affiliates').update({ code: newCode }).eq('id', affilId).eq('user_id', user.id);
  if (error) {
    t(error.code === '23505' ? 'Ce code est déjà pris — essayez-en un autre 😕' : 'Erreur : ' + error.message, 'e');
    return;
  }
  t('Code mis à jour ! ✅', 's');
  loadAffiliateCard();
}

async function saveAffilPayout(affilId) {
  const info = document.getElementById('affil-payout')?.value.trim();
  if (!info) { t('Saisissez vos coordonnées de paiement', 'e'); return; }
  const { error } = await db.from('affiliates').update({ payout_info: info }).eq('id', affilId).eq('user_id', user.id);
  if (error) { t('Erreur : ' + error.message, 'e'); return; }
  t('Coordonnées sauvegardées ✅', 's');
  loadAffiliateCard();
}

// ── Bannière partenaires sur la landing ─────────────────
function _safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? url : null;
  } catch(e) { return null; }
}

function _safeAttrUrl(url) {
  const safe = _safeUrl(url);
  if (!safe) return null;
  return safe.replace(/"/g, '%22').replace(/'/g, '%27');
}

async function loadPartnersBanner() {
  const sticky = document.getElementById('partners-sticky');
  try {
    const { data: partners } = await db.from('partners').select('*').eq('actif', true).order('ordre');
    if (!partners || partners.length === 0) {
      if (sticky) sticky.style.display = 'none';
      return;
    }
    const html = [...partners, ...partners, ...partners].map(p => {
      const safeUrl  = _safeAttrUrl(p.site_url);
      const safeLogo = _safeAttrUrl(p.logo_url);
      const safeName = escapeHtml(p.nom || '');
      return `<a ${safeUrl ? `href="${safeUrl}" target="_blank" rel="noopener noreferrer"` : ''} class="partner-logo-wrap" title="${safeName}" style="display:flex;align-items:center;justify-content:center;min-width:100px;height:36px;padding:0 12px;background:var(--white);border-radius:8px;border:1.5px solid var(--border);text-decoration:none;flex-shrink:0;transition:.15s;gap:6px;">
            ${safeLogo ? `<img src="${safeLogo}" alt="${safeName}" style="max-height:24px;max-width:70px;object-fit:contain;">` : `<span style="font-size:.72rem;font-weight:800;color:var(--ink);">${safeName}</span>`}
          </a>`;
    }).join('');

    if (sticky) {
      const stickyTrack = sticky.querySelector('.partners-sticky-track');
      if (stickyTrack) { stickyTrack.innerHTML = html; sticky.style.display = 'flex'; }
    }
  } catch(e) {
    if (sticky) sticky.style.display = 'none';
  }
}
