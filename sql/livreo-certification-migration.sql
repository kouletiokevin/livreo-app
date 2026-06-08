-- ═══════════════════════════════════════════════════════════════
-- KolisGo — Migration : badge de certification utilisateur
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Ajouter la colonne is_certified
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_certified BOOLEAN DEFAULT FALSE;

-- 2. S'assurer que le rôle "moderateur" est utilisable dans user_roles
--    (pas d'enum à créer si la colonne role est de type TEXT)
--    Pour vérifier : SELECT DISTINCT role FROM user_roles;
--    Pour attribuer le rôle à un utilisateur :
--    INSERT INTO user_roles (user_id, role)
--    VALUES ('<uuid-utilisateur>', 'moderateur')
--    ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- 3. Politique RLS : seuls admin et moderateur peuvent mettre
--    à jour is_certified (via une fonction sécurisée)
-- ───────────────────────────────────────────────────────────────

-- Fonction SECURITY DEFINER — appelée avec les droits du créateur,
-- pas de l'appelant. Vérifie le rôle avant d'appliquer le UPDATE.
CREATE OR REPLACE FUNCTION toggle_user_certification(
  target_user_id UUID,
  certify        BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderateur')
  ) THEN
    RAISE EXCEPTION 'Permission refusée : rôle admin ou moderateur requis';
  END IF;

  UPDATE users SET is_certified = certify WHERE id = target_user_id;
END;
$$;

-- Autoriser les utilisateurs authentifiés à appeler cette fonction
GRANT EXECUTE ON FUNCTION toggle_user_certification(UUID, BOOLEAN) TO authenticated;

-- ───────────────────────────────────────────────────────────────
-- 4. Politique RLS sur la table users pour les admins/modérateurs
--    (nécessaire si la politique UPDATE actuelle est trop restrictive)
-- ───────────────────────────────────────────────────────────────
CREATE POLICY "admin_moderateur_update_users"
ON users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'moderateur')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'moderateur')
  )
);
