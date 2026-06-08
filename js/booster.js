/* ═══════════════════════════════════════════════════
   KOLISGO — Booster de visibilité
   Version 1.0 — Juin 2026

   Fonctionnement :
   1. Après publication d'un colis, afficherModalBoost() est appelé
   2. L'utilisateur choisit une durée (24h/48h/72h)
   3. Stripe Payment Intent est créé via Edge Function
   4. Après paiement, activer_boost() RPC Supabase est appelée
   5. La colonne boosted_until est mise à jour → le colis remonte en tête
════════════════════════════════════════════════════ */

const BOOST_PRICES = {
  24: { label: '24h', prix: 0.99, emoji: '⚡' },
  48: { label: '48h', prix: 1.79, emoji: '🔥' },
  72: { label: '72h', prix: 2.49, emoji: '🚀' }
};

let _boostStripe = null; // instance Stripe (lazy init)
let _boostElements = null;

// ─────────────────────────────────────────────
// Afficher la modale boost après publication
// ─────────────────────────────────────────────
function afficherModalBoost(colisId, codeRef) {
  // Supprimer toute modale déjà ouverte
  const existing = document.getElementById('boost-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'boost-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,.6);
    z-index: 9000; display: flex; align-items: flex-end;
    animation: fadeIn .2s ease;
  `;

  overlay.innerHTML = `
    <div id="boost-modal" style="
      background: #fff; width: 100%; border-radius: 20px 20px 0 0;
      padding: 24px 20px 40px; max-height: 90vh; overflow-y: auto;
      animation: slideUp .25s ease;
    ">
      <div style="text-align:center;margin-bottom:4px;font-size:1.4rem;">⚡</div>
      <h2 style="text-align:center;font-size:1.05rem;font-weight:900;color:#0e1a10;margin-bottom:6px;">
        Boostez votre kolis !
      </h2>
      <p style="text-align:center;font-size:.8rem;color:#6b7280;margin-bottom:20px;line-height:1.5;">
        Votre annonce <strong>${escapeHtml(codeRef)}</strong> sera mise en avant en tête de la liste,
        avec le badge <strong>⚡ URGENT</strong>. Option 100% volontaire.
      </p>

      <!-- Sélecteur de durée -->
      <div id="boost-options" style="display:flex;gap:10px;margin-bottom:20px;">
        ${Object.entries(BOOST_PRICES).map(([h, v]) => `
          <button
            data-hours="${h}"
            onclick="selectBoostOption(${h})"
            class="boost-opt-btn"
            style="
              flex:1; padding:12px 6px; border-radius:12px; border: 2px solid #e5e7eb;
              background:#fff; cursor:pointer; font-family:var(--sans);
              transition: all .15s;
            ">
            <div style="font-size:1.2rem;">${v.emoji}</div>
            <div style="font-weight:900;font-size:.95rem;color:#0e1a10;">${v.label}</div>
            <div style="font-size:.78rem;font-weight:700;color:#2ecc71;margin-top:2px;">${v.prix.toFixed(2).replace('.', ',')}€</div>
          </button>
        `).join('')}
      </div>

      <!-- Zone de paiement Stripe (injectée dynamiquement) -->
      <div id="boost-payment-zone" style="display:none;margin-bottom:16px;">
        <div id="boost-stripe-element" style="
          border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 12px 14px;
          min-height: 44px;
        "></div>
        <div id="boost-stripe-error" style="color:#ef4444;font-size:.78rem;margin-top:6px;"></div>
      </div>

      <!-- Bouton confirmer -->
      <button
        id="boost-confirm-btn"
        onclick="confirmerBoost('${colisId}')"
        style="
          display:none; width:100%; padding:14px; background:var(--g500);
          color:#fff; border:none; border-radius:50px; font-family:var(--sans);
          font-size:.9rem; font-weight:900; cursor:pointer;
        ">
        Booster mon kolis ⚡
      </button>

      <!-- Ignorer -->
      <button
        onclick="fermerModalBoost()"
        style="
          display:block; width:100%; padding:12px; background:transparent;
          color:#6b7280; border:none; font-family:var(--sans);
          font-size:.82rem; cursor:pointer; margin-top:8px;
        ">
        Non merci, continuer sans boost
      </button>
    </div>
  `;

  // Ajouter animations CSS si pas déjà présentes
  if (!document.getElementById('boost-anim-css')) {
    const style = document.createElement('style');
    style.id = 'boost-anim-css';
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .boost-opt-btn:hover { border-color: #2ecc71 !important; }
      .boost-opt-btn.selected {
        border-color: #2ecc71 !important;
        background: #f0fdf4 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Fermer en cliquant sur l'overlay
  overlay.addEventListener('click', e => {
    if (e.target === overlay) fermerModalBoost();
  });

  document.body.appendChild(overlay);
}

// ─────────────────────────────────────────────
// Sélectionner une option de durée
// ─────────────────────────────────────────────
let _selectedBoostHours = null;

function selectBoostOption(hours) {
  _selectedBoostHours = hours;

  // UI : highlight du bouton sélectionné
  document.querySelectorAll('.boost-opt-btn').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.hours) === hours);
  });

  // Afficher zone paiement et bouton
  const bpz = document.getElementById('boost-payment-zone');
  const bcb = document.getElementById('boost-confirm-btn');
  if (bpz) bpz.style.display = 'block';
  if (bcb) bcb.style.display = 'block';

  // Mettre à jour le texte du bouton
  const price = BOOST_PRICES[hours];
  const btn = document.getElementById('boost-confirm-btn');
  btn.textContent = `Booster ${price.label} pour ${price.prix.toFixed(2).replace('.', ',')}€ ${price.emoji}`;

  // Initialiser Stripe Elements si pas encore fait
  _initStripeBoostElement();
}

// ─────────────────────────────────────────────
// Initialiser Stripe Elements pour le boost
// ─────────────────────────────────────────────
async function _initStripeBoostElement() {
  if (_boostElements) return; // déjà initialisé

  try {
    // Stripe est chargé dans app.js via la clé publishable globale
    if (!window._stripeInstance) {
      if (typeof Stripe === 'undefined') {
        document.getElementById('boost-stripe-error').textContent =
          'Paiement indisponible. Réessayez dans quelques secondes.';
        return;
      }
      // Utiliser la même clé Stripe que app.js
      const pkKey = typeof STRIPE_PK !== 'undefined'
        ? STRIPE_PK
        : 'pk_live_51QLFSSFQ0erFJFSmQsXFjgC9CcH1CCKfyL0KueBKHZ9Dy34QD2zVjtWxiqngJDFaOBjzFfpklvE6PJCOXDb8bzpL00peOcylDb';
      window._stripeInstance = Stripe(pkKey);
    }
    _boostStripe = window._stripeInstance;

    _boostElements = _boostStripe.elements({
      appearance: {
        theme: 'stripe',
        variables: { colorPrimary: '#2ecc71', borderRadius: '10px' }
      }
    });

    const paymentElement = _boostElements.create('payment');
    paymentElement.mount('#boost-stripe-element');

  } catch (e) {
    console.error('Stripe Elements init:', e);
    document.getElementById('boost-stripe-error').textContent =
      'Erreur initialisation paiement : ' + e.message;
  }
}

// ─────────────────────────────────────────────
// Confirmer et payer le boost
// ─────────────────────────────────────────────
async function confirmerBoost(colisId) {
  if (!_selectedBoostHours) return;

  const btn = document.getElementById('boost-confirm-btn');
  const errEl = document.getElementById('boost-stripe-error');
  btn.textContent = 'Traitement...';
  btn.disabled = true;
  errEl.textContent = '';

  try {
    // 1. Créer le PaymentIntent via Edge Function
    const price = BOOST_PRICES[_selectedBoostHours];
    const piData = await callEdgeFunction('create-boost-payment', {
      colis_id: colisId,
      duration_hours: _selectedBoostHours,
      amount: Math.round(price.prix * 100)  // centimes
    });

    if (!piData || !piData.client_secret) {
      throw new Error('Impossible de créer le paiement. Réessayez.');
    }

    // 2. Confirmer le paiement côté Stripe
    const { error: stripeError } = await _boostStripe.confirmPayment({
      elements: _boostElements,
      clientSecret: piData.client_secret,
      confirmParams: {
        return_url: window.location.href + '?boost_success=1'
      },
      redirect: 'if_required'
    });

    if (stripeError) {
      errEl.textContent = stripeError.message;
      btn.textContent = 'Réessayer';
      btn.disabled = false;
      return;
    }

    // 3. Activer le boost en base via RPC Supabase
    const { data: rpcData, error: rpcErr } = await db.rpc('activer_boost', {
      p_colis_id: colisId,
      p_duree_heures: _selectedBoostHours,
      p_stripe_pi_id: piData.payment_intent_id || null
    });

    if (rpcErr) throw new Error(rpcErr.message);

    // 4. Succès
    fermerModalBoost();

    const until = rpcData?.boosted_until
      ? new Date(rpcData.boosted_until).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        })
      : '';

    // Afficher confirmation visuelle
    _afficherSuccessBoost(price, until);

    // Rafraîchir l'explorer si ouvert
    if (typeof loadCards === 'function') setTimeout(loadCards, 500);

  } catch (e) {
    errEl.textContent = e.message || 'Erreur paiement. Réessayez.';
    btn.textContent = 'Réessayer';
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
// Afficher le toast/confirmation de succès
// ─────────────────────────────────────────────
function _afficherSuccessBoost(price, until) {
  // Toast simple
  if (typeof t === 'function') {
    t(`⚡ Boost activé ${price.label} ! Votre kolis est maintenant mis en avant${until ? ' jusqu\'au ' + until : ''}.`, 's');
  }
}

// ─────────────────────────────────────────────
// Fermer la modale boost
// ─────────────────────────────────────────────
function fermerModalBoost() {
  const overlay = document.getElementById('boost-modal-overlay');
  if (overlay) overlay.remove();
  _boostElements = null;
  _selectedBoostHours = null;
}

// ─────────────────────────────────────────────
// Vérifier retour boost après redirect Stripe
// ─────────────────────────────────────────────
(function checkBoostReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('boost_success') === '1') {
    // Nettoyer l'URL
    const url = new URL(window.location.href);
    url.searchParams.delete('boost_success');
    history.replaceState({}, '', url.toString());
    // Notifier l'utilisateur
    setTimeout(() => {
      if (typeof t === 'function') {
        t('⚡ Boost activé avec succès ! Votre kolis est en tête de liste.', 's');
      }
    }, 800);
  }
})();
