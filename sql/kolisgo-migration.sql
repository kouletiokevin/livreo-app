-- ═══════════════════════════════════════════════════════════════
-- DINVMIC — Migration complète
-- Supabase Dashboard → SQL Editor → Exécuter
-- ═══════════════════════════════════════════════════════════════


-- ── 1. COLONNE IS_CERTIFIED ──────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_certified BOOLEAN DEFAULT FALSE;


-- ── 2. RÔLE MODÉRATEUR ──────────────────────────────────────────
-- Modèle d'insertion : remplacer le WHERE false par la condition souhaitée
-- ou insérer manuellement pour un utilisateur donné :
-- INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'moderateur') ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role)
SELECT id, 'moderateur' FROM users WHERE false
ON CONFLICT DO NOTHING;


-- ── 3. RLS IS_CERTIFIED ──────────────────────────────────────────
CREATE POLICY "admin_moderateur_can_certify" ON users
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderateur')
  )
)
WITH CHECK (true);


-- ── 4. BUCKET BILLETS ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('billets', 'billets', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "passeur_upload_billet" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'billets' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "admin_read_billets" ON storage.objects
FOR SELECT USING (
  bucket_id = 'billets' AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);


-- ── 5. VUE ADMIN DASHBOARD ──────────────────────────────────────
CREATE OR REPLACE VIEW admin_dashboard AS
SELECT
  (SELECT COUNT(*)                        FROM users)                                   AS total_users,
  (SELECT COUNT(*)                        FROM colis)                                   AS total_colis,
  (SELECT COUNT(*)                        FROM colis WHERE statut = 'livre')            AS colis_livres,
  (SELECT COUNT(*)                        FROM colis WHERE statut = 'en_cours')         AS colis_en_cours,
  (SELECT COUNT(*)                        FROM transactions)                            AS total_transactions,
  (SELECT COALESCE(SUM(montant), 0)       FROM transactions)                            AS volume_total;


-- ── 6. VUE COLIS ACTIFS ─────────────────────────────────────────
CREATE OR REPLACE VIEW colis_actifs AS
SELECT c.*, u.prenom, u.nom, u.note_moyenne
FROM colis c
JOIN users u ON c.expediteur_id = u.id
WHERE c.statut IN ('en_attente', 'en_cours');


-- ── 7. VUE ROLES ────────────────────────────────────────────────
CREATE OR REPLACE VIEW vue_roles AS
SELECT u.id, u.prenom, u.nom, u.email, ur.role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id;
