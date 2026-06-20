/* ═══════════════════════════════════════
   DINVMIC — Module Messagerie
   Version 1.0 — Juin 2026
═══════════════════════════════════════ */

let _msgColisActif  = null;
let _msgReceiverId  = null;
let _msgRealtimeCh  = null;

// ── Naviguer vers l'onglet messages ──────
function goMessages() {
  if (!user) { t('Connectez-vous pour accéder aux messages 🔒', 'e'); goNav('auth'); return; }
  goNav('messages');
  loadConversations();
}

// ── Liste des conversations ───────────────
async function loadConversations() {
  const list   = document.getElementById('msg-list');
  const thread = document.getElementById('msg-thread');
  if (!list || !user) return;
  if (thread) thread.style.display = 'none';
  list.style.display = 'block';
  list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.84rem;">Chargement…</div>';

  try {
    const { data: colisList, error } = await db.from('colis_public')
      .select('*')
      .or(`expediteur_id.eq.${user.id},livreur_id.eq.${user.id}`)
      .not('livreur_id', 'is', null)
      .in('statut', ['livreur_accepte', 'en_transit', 'livre'])
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    if (!colisList || colisList.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:48px 24px;">
          <div style="font-size:3rem;margin-bottom:14px;">💬</div>
          <div style="font-weight:800;font-size:.95rem;margin-bottom:6px;">Aucune conversation</div>
          <div style="color:var(--muted);font-size:.8rem;line-height:1.6;">Vos conversations avec les passeurs apparaîtront ici dès qu'un colis est accepté.</div>
        </div>`;
      return;
    }

    const convs = await Promise.all(colisList.map(async col => {
      const [lastMsgRes, unreadRes] = await Promise.all([
        db.from('messages')
          .select('contenu, created_at, sender_id')
          .eq('colis_id', col.id)
          .order('created_at', { ascending: false })
          .limit(1),
        db.from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('colis_id', col.id)
          .eq('receiver_id', user.id)
          .eq('lu', false)
      ]);
      return { colis: col, lastMsg: lastMsgRes.data?.[0] || null, unread: unreadRes.count || 0 };
    }));

    list.innerHTML = convs.map(({ colis: col, lastMsg, unread }) => {
      const isExp         = col.expediteur_id === user.id;
      const interlocPrenom = isExp ? escapeHtml(col.livreur_prenom || 'Passeur') : escapeHtml(col.expediteur_prenom || 'Expéditeur');
      const interlocPhoto  = isExp ? col.livreur_photo : col.expediteur_photo;
      const initiale       = (interlocPrenom[0] || '?').toUpperCase();
      const avatarHtml     = interlocPhoto
        ? `<div class="msg-av" style="background-image:url(${escapeHtml(interlocPhoto)});background-size:cover;"></div>`
        : `<div class="msg-av">${initiale}</div>`;
      const lastTxt  = lastMsg
        ? escapeHtml(lastMsg.contenu).substring(0, 50) + (lastMsg.contenu.length > 50 ? '…' : '')
        : 'Démarrez la conversation';
      const lastTime = lastMsg
        ? new Date(lastMsg.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : '';
      const badgeHtml = unread > 0 ? `<div class="msg-badge">${unread}</div>` : '';
      const colJson   = JSON.stringify(col).replace(/"/g, '&quot;');
      return `<div class="msg-conv-item" onclick='openConversation(JSON.parse(this.dataset.col))' data-col="${colJson}">
        ${avatarHtml}
        <div class="msg-conv-body">
          <div class="msg-conv-top">
            <div class="msg-conv-name">${interlocPrenom}</div>
            <div class="msg-conv-time">${lastTime}</div>
          </div>
          <div class="msg-conv-ref">${escapeHtml(col.code_lvr)} · ${escapeHtml((col.gare_depart || '?').split(' ')[0])} → ${escapeHtml((col.gare_arrivee || '?').split(' ')[0])}</div>
          <div class="msg-conv-last${unread > 0 ? ' msg-unread-txt' : ''}">${lastTxt}</div>
        </div>
        ${badgeHtml}
      </div>`;
    }).join('');

  } catch (e) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:.84rem;">Impossible de charger les conversations.</div>';
    console.error('Messages:', e.message);
  }
}

// ── Ouvrir un fil de discussion ───────────
async function openConversation(col) {
  if (!user) return;
  _msgColisActif = col;
  const isExp      = col.expediteur_id === user.id;
  _msgReceiverId   = isExp ? col.livreur_id : col.expediteur_id;

  const interlocPrenom = isExp ? escapeHtml(col.livreur_prenom || 'Passeur') : escapeHtml(col.expediteur_prenom || 'Expéditeur');
  const interlocPhoto  = isExp ? col.livreur_photo : col.expediteur_photo;

  const list   = document.getElementById('msg-list');
  const thread = document.getElementById('msg-thread');
  if (list)   list.style.display   = 'none';
  if (thread) thread.style.display = 'flex';

  const hdrName = document.getElementById('msg-hdr-name');
  const hdrRef  = document.getElementById('msg-hdr-ref');
  const hdrAv   = document.getElementById('msg-hdr-av');
  if (hdrName) hdrName.textContent = interlocPrenom;
  if (hdrRef)  hdrRef.textContent  = col.code_lvr;
  if (hdrAv) {
    if (interlocPhoto) {
      hdrAv.style.backgroundImage = `url(${escapeHtml(interlocPhoto)})`;
      hdrAv.style.backgroundSize  = 'cover';
      hdrAv.textContent = '';
    } else {
      hdrAv.style.backgroundImage = '';
      hdrAv.textContent = (interlocPrenom[0] || '?').toUpperCase();
    }
  }

  await _chargerBulles(col.id);

  await db.from('messages')
    .update({ lu: true })
    .eq('colis_id', col.id)
    .eq('receiver_id', user.id)
    .eq('lu', false);

  majBadgeMessages();

  const inp = document.getElementById('msg-input');
  if (inp) setTimeout(() => inp.focus(), 100);
}

// ── Charger les bulles ────────────────────
async function _chargerBulles(colisId) {
  const bubbles = document.getElementById('msg-bubbles');
  if (!bubbles) return;
  bubbles.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem;">Chargement…</div>';

  const { data, error } = await db.from('messages')
    .select('*')
    .eq('colis_id', colisId)
    .order('created_at', { ascending: true });

  if (error) {
    bubbles.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);">Impossible de charger les messages.</div>';
    return;
  }

  if (!data || data.length === 0) {
    bubbles.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--muted);font-size:.78rem;">Aucun message pour l\'instant.<br>Lancez la conversation 👋</div>';
    return;
  }

  bubbles.innerHTML = data.map(msg => _bulleHtml(msg)).join('');
  bubbles.scrollTop = bubbles.scrollHeight;
}

function _bulleHtml(msg) {
  const isMine = msg.sender_id === user.id;
  const dt = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `<div class="msg-bulle-wrap ${isMine ? 'mine' : 'theirs'}">
    <div class="msg-bulle ${isMine ? 'mine' : 'theirs'}">${escapeHtml(msg.contenu)}<span class="msg-time">${dt}</span></div>
  </div>`;
}

// ── Envoyer un message ────────────────────
async function envoyerMessage() {
  if (!user || !_msgColisActif || !_msgReceiverId) return;
  const inp    = document.getElementById('msg-input');
  const contenu = inp?.value.trim();
  if (!contenu) return;
  inp.value = '';

  const { data, error } = await db.from('messages').insert({
    colis_id:    _msgColisActif.id,
    sender_id:   user.id,
    receiver_id: _msgReceiverId,
    contenu,
    lu: false
  }).select().single();

  if (error) { t('Erreur d\'envoi : ' + error.message, 'e'); inp.value = contenu; return; }

  const bubbles = document.getElementById('msg-bubbles');
  if (bubbles) {
    const emptyEl = bubbles.querySelector('[style*="Aucun message"]');
    if (emptyEl) emptyEl.remove();
    bubbles.insertAdjacentHTML('beforeend', _bulleHtml(data));
    bubbles.scrollTop = bubbles.scrollHeight;
  }
}

// ── Retour à la liste ─────────────────────
function msgBack() {
  _msgColisActif = null;
  _msgReceiverId = null;
  const list   = document.getElementById('msg-list');
  const thread = document.getElementById('msg-thread');
  if (list)   list.style.display   = 'block';
  if (thread) thread.style.display = 'none';
  loadConversations();
}

// ── Badge non-lus (pip nav) ───────────────
async function majBadgeMessages() {
  if (!user) return;
  const { count } = await db.from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('lu', false);

  const pip = document.getElementById('msg-pip');
  if (!pip) return;
  if (count && count > 0) {
    pip.textContent   = count > 9 ? '9+' : String(count);
    pip.style.display = 'flex';
  } else {
    pip.style.display = 'none';
  }
}

// ── Realtime ──────────────────────────────
function initMessagesRealtime() {
  if (!user) return;
  if (_msgRealtimeCh) { try { db.removeChannel(_msgRealtimeCh); } catch(e) {} }

  _msgRealtimeCh = db.channel('msg-notif')
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'messages',
      filter: `receiver_id=eq.${user.id}`
    }, payload => {
      const msg = payload.new;
      if (_msgColisActif && msg.colis_id === _msgColisActif.id) {
        const bubbles = document.getElementById('msg-bubbles');
        if (bubbles) {
          bubbles.insertAdjacentHTML('beforeend', _bulleHtml(msg));
          bubbles.scrollTop = bubbles.scrollHeight;
        }
        db.from('messages').update({ lu: true }).eq('id', msg.id)
          .then(() => majBadgeMessages());
      } else {
        t('💬 Nouveau message', 's');
        majBadgeMessages();
      }
    })
    .subscribe();
}
