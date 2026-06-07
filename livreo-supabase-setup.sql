-- ============================================================
--  LIVREO — Setup complet base de données Supabase
--  Colle tout ce code dans SQL Editor > Run
-- ============================================================

-- ── 1. USERS (membres de la plateforme) ──────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  prenom        TEXT NOT NULL,
  nom           TEXT NOT NULL,
  telephone     TEXT NOT NULL,
  mot_de_passe  TEXT,                          -- géré par Supabase Auth
  iban          TEXT,
  carte_stripe  TEXT,
  note_moyenne  NUMERIC(2,1) DEFAULT 0,
  nb_livraisons INTEGER DEFAULT 0,
  nb_colis_envoyes INTEGER DEFAULT 0,
  statut        TEXT DEFAULT 'actif'           -- actif | suspendu | bloqué
    CHECK (statut IN ('actif','suspendu','bloqué')),
  verifie       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 2. COLIS (annonces postées) ──────────────────────────────
CREATE TABLE IF NOT EXISTS colis (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_lvr            TEXT UNIQUE NOT NULL,    -- ex: LVR-452 (généré auto)
  titre               TEXT NOT NULL,
  description         TEXT,                    -- privée, vue livreur seulement
  gare_depart         TEXT NOT NULL,
  gare_arrivee        TEXT NOT NULL,
  format              TEXT NOT NULL
    CHECK (format IN ('Pochette S','Pochette M','Colis S','Colis M','Colis L','Colis XL')),
  poids               TEXT,
  prix                NUMERIC(6,2) NOT NULL,
  date_souhaitee      DATE,
  photo_emballee_url  TEXT,                    -- URL photo publique
  photos_contenu_urls TEXT[],                  -- URLs photos privées
  expediteur_id       UUID REFERENCES users(id),
  livreur_id          UUID REFERENCES users(id),
  destinataire_nom    TEXT NOT NULL,
  destinataire_tel    TEXT NOT NULL,
  num_train           TEXT,                    -- TGV INOUI 6605
  statut              TEXT DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','livreur_accepte','en_transit','livre','annule','litige')),
  qr_secret           TEXT,                   -- hash sécurisé pour le QR code
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ── 3. TRANSACTIONS (paiements) ──────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colis_id        UUID REFERENCES colis(id),
  expediteur_id   UUID REFERENCES users(id),
  livreur_id      UUID REFERENCES users(id),
  montant         NUMERIC(6,2) NOT NULL,
  stripe_intent   TEXT,                       -- ID Stripe PaymentIntent
  statut          TEXT DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','escrow','libere','rembourse','litige')),
  photo_remise_url TEXT,                      -- Photo prise par le livreur
  qr_scanne_at    TIMESTAMPTZ,               -- Timestamp du scan QR
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 4. AVIS (notations) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS avis (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colis_id      UUID REFERENCES colis(id),
  auteur_id     UUID REFERENCES users(id),
  cible_id      UUID REFERENCES users(id),    -- utilisateur noté
  note          INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire   TEXT,
  tags          TEXT[],                        -- ['Ponctuel','Colis intact',...]
  type_avis     TEXT CHECK (type_avis IN ('livreur','expediteur','application')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 5. NOTIFICATIONS (historique SMS + push) ─────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  type          TEXT,                          -- 'sms' | 'push' | 'email'
  titre         TEXT,
  message       TEXT,
  lu            BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 6. LITIGES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS litiges (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colis_id      UUID REFERENCES colis(id),
  plaignant_id  UUID REFERENCES users(id),
  motif         TEXT NOT NULL,
  description   TEXT,
  decision      TEXT,                          -- 'remboursement' | 'livreur' | 'partage'
  statut        TEXT DEFAULT 'ouvert'
    CHECK (statut IN ('ouvert','en_cours','resolu','ferme')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── FONCTION : générer code LVR unique ───────────────────────
CREATE OR REPLACE FUNCTION generate_code_lvr()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_code := 'LVR-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM colis WHERE code_lvr = new_code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ── TRIGGER : auto-génère le code LVR à la création d'un colis
CREATE OR REPLACE FUNCTION set_code_lvr()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code_lvr IS NULL OR NEW.code_lvr = '' THEN
    NEW.code_lvr := generate_code_lvr();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_code_lvr ON colis;
CREATE TRIGGER trigger_set_code_lvr
  BEFORE INSERT ON colis
  FOR EACH ROW EXECUTE FUNCTION set_code_lvr();

-- ── TRIGGER : updated_at automatique ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_colis_updated_at
  BEFORE UPDATE ON colis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── SÉCURITÉ : Row Level Security (RLS) ──────────────────────
-- Chaque utilisateur ne voit que ses propres données

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE colis ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE avis ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE litiges ENABLE ROW LEVEL SECURITY;

-- Users : chacun voit et modifie seulement son profil
CREATE POLICY "users_own" ON users
  USING (id = auth.uid());

-- Colis : tout le monde peut LIRE les annonces (marketplace)
CREATE POLICY "colis_public_read" ON colis
  FOR SELECT USING (true);

-- Colis : seul l'expéditeur peut créer/modifier le sien
CREATE POLICY "colis_own_write" ON colis
  FOR INSERT WITH CHECK (expediteur_id = auth.uid());

CREATE POLICY "colis_own_update" ON colis
  FOR UPDATE USING (
    expediteur_id = auth.uid() OR livreur_id = auth.uid()
  );

-- Transactions : visibles par les parties concernées seulement
CREATE POLICY "transactions_parties" ON transactions
  USING (
    expediteur_id = auth.uid() OR livreur_id = auth.uid()
  );

-- Avis : tout le monde peut lire
CREATE POLICY "avis_public_read" ON avis
  FOR SELECT USING (true);

CREATE POLICY "avis_own_write" ON avis
  FOR INSERT WITH CHECK (auteur_id = auth.uid());

-- Notifications : chacun voit les siennes
CREATE POLICY "notifs_own" ON notifications
  USING (user_id = auth.uid());

-- Litiges : admin seulement (via service_role key)
CREATE POLICY "litiges_admin" ON litiges
  USING (auth.role() = 'service_role');

-- ── DONNÉES DE TEST (optionnel — supprimer en production) ────
INSERT INTO users (email, prenom, nom, telephone, note_moyenne, nb_livraisons, verifie)
VALUES
  ('kevin@livreo.fr', 'Kevin', 'Admin', '0612345678', 4.9, 38, true),
  ('marie@test.fr',   'Marie', 'Dupont', '0698765432', 4.7, 12, true),
  ('thomas@test.fr',  'Thomas','Laurent', '0677889900', 4.8, 24, true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- ✅ Setup terminé ! Toutes les tables sont créées.
-- ============================================================
