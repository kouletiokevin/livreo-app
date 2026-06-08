-- ═══════════════════════════════════════════════════════════════
-- KolisGo — Migration : billet passeur
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Rendre gare_depart nullable (le passeur la renseigne à l'acceptation)
ALTER TABLE colis ALTER COLUMN gare_depart DROP NOT NULL;

-- 2. Colonnes supplémentaires pour le passeur
ALTER TABLE colis ADD COLUMN IF NOT EXISTS date_depart_passeur DATE;
ALTER TABLE colis ADD COLUMN IF NOT EXISTS billet_url          TEXT;

-- ───────────────────────────────────────────────────────────────
-- 3. Bucket "billets" — privé, PDF uniquement, max 10 MB
-- ───────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'billets',
  'billets',
  false,
  10485760,            -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- 4. RLS sur storage.objects pour le bucket "billets"
-- ───────────────────────────────────────────────────────────────

-- Le passeur peut uploader uniquement dans son propre dossier
-- Chemin attendu : {user_id}/{code_lvr}/{timestamp}.pdf
CREATE POLICY "Passeur peut uploader son billet"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'billets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Seul l'admin peut lire les billets
CREATE POLICY "Admin peut lire les billets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'billets'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);

-- Le passeur peut lire/supprimer uniquement ses propres billets
CREATE POLICY "Passeur peut gérer ses propres billets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'billets'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'billets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
