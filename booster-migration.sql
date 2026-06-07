-- ═══════════════════════════════════════════════
-- KolisGo — Migration Booster de visibilité
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════

-- 1. Ajouter colonne boosted_until à la table colis
ALTER TABLE public.colis
  ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS boost_amount  NUMERIC(10,2) DEFAULT NULL;

-- 2. Créer la table des transactions de boost (audit trail)
CREATE TABLE IF NOT EXISTS public.colis_boosts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colis_id      UUID NOT NULL REFERENCES public.colis(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id),
  duration_hours INTEGER NOT NULL CHECK (duration_hours IN (24, 48, 72)),
  amount_eur    NUMERIC(10,2) NOT NULL,
  stripe_pi_id  TEXT,  -- Stripe PaymentIntent ID (pour réconciliation)
  boosted_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  boosted_until TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index sur boosted_until pour le tri performant
CREATE INDEX IF NOT EXISTS idx_colis_boosted_until
  ON public.colis(boosted_until DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_colis_boosts_colis
  ON public.colis_boosts(colis_id);

-- 4. RLS sur colis_boosts
ALTER TABLE public.colis_boosts ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs voient uniquement leurs propres boosts
CREATE POLICY "user_see_own_boosts"
  ON public.colis_boosts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Seuls les admins peuvent insérer via RPC sécurisée
CREATE POLICY "admin_insert_boost"
  ON public.colis_boosts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5. Fonction RPC sécurisée pour activer un boost
-- (Appelée depuis JS après paiement Stripe confirmé)
CREATE OR REPLACE FUNCTION public.activer_boost(
  p_colis_id     UUID,
  p_duree_heures INTEGER,  -- 24, 48 ou 72
  p_stripe_pi_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_colis        RECORD;
  v_montant      NUMERIC;
  v_until        TIMESTAMPTZ;
BEGIN
  -- Vérification durée valide
  IF p_duree_heures NOT IN (24, 48, 72) THEN
    RETURN json_build_object('success', false, 'error', 'Durée invalide');
  END IF;

  -- Tarifs
  v_montant := CASE p_duree_heures
    WHEN 24 THEN 0.99
    WHEN 48 THEN 1.79
    WHEN 72 THEN 2.49
  END;

  -- Vérifier que le colis appartient à l'utilisateur
  SELECT * INTO v_colis FROM public.colis
  WHERE id = p_colis_id AND expediteur_id = v_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Colis introuvable ou accès refusé');
  END IF;

  -- Si déjà boosté, prolonger à partir de l'expiration actuelle
  v_until := CASE
    WHEN v_colis.boosted_until IS NOT NULL AND v_colis.boosted_until > NOW()
      THEN v_colis.boosted_until + (p_duree_heures || ' hours')::INTERVAL
    ELSE NOW() + (p_duree_heures || ' hours')::INTERVAL
  END;

  -- Mettre à jour colis
  UPDATE public.colis
  SET boosted_until = v_until,
      boost_amount  = COALESCE(boost_amount, 0) + v_montant
  WHERE id = p_colis_id;

  -- Enregistrer la transaction boost
  INSERT INTO public.colis_boosts
    (colis_id, user_id, duration_hours, amount_eur, stripe_pi_id, boosted_until)
  VALUES
    (p_colis_id, v_user_id, p_duree_heures, v_montant, p_stripe_pi_id, v_until);

  RETURN json_build_object(
    'success', true,
    'boosted_until', v_until,
    'montant', v_montant
  );
END;
$$;

-- 6. Mettre à jour la vue colis_public pour inclure boosted_until
-- et trier les boosts en premier
-- (Si la vue colis_public existe déjà, on la remplace)
DROP VIEW IF EXISTS public.colis_public;

CREATE VIEW public.colis_public AS
SELECT
  c.id,
  c.code_lvr,
  c.titre,
  c.description,
  c.format,
  c.poids,
  c.gare_depart,
  c.gare_arrivee,
  c.prix,
  c.date_souhaitee,
  c.statut,
  c.photo_emballee_url,
  c.expediteur_id,
  c.created_at,
  -- Boost : true si annonce encore boostée
  (c.boosted_until IS NOT NULL AND c.boosted_until > NOW()) AS is_boosted,
  c.boosted_until
FROM public.colis c
WHERE c.statut IN ('en_attente', 'accepte')
ORDER BY
  -- Annonces boostées en premier
  CASE WHEN c.boosted_until IS NOT NULL AND c.boosted_until > NOW()
       THEN 0 ELSE 1 END ASC,
  -- Puis par date de création
  c.created_at DESC;

-- Commenter ce qui précède si la vue a une structure différente
-- et adapter selon votre schéma réel.
