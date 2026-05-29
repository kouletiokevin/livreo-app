# LIVREO — Documentation complète pour Claude Code

> **Mission :** Finir et solidifier l'application Livreo — livraison de colis entre particuliers par train.
> **Slogan :** *"Quelqu'un prend le train. Votre colis aussi."*
> **URL en ligne 7 :** https://livreo-app.netlify.app
> **Stack actuelle :** HTML/CSS/JS mono-fichier → à migrer vers une structure propre

---

## 1. CONCEPT MÉTIER

Livreo met en relation :
- **L'expéditeur** — a un colis à envoyer d'une gare A à une gare B
- **Le livreur** — un voyageur qui prend le train et transporte le colis
- **Le destinataire** — reçoit le colis, confirme par QR Code unique

**Modèle économique :** Gratuit pendant la phase de lancement. Commission 5-10% prévue en année 2.

**Avantage concurrentiel :** 45% moins cher que La Poste, livraison le jour même possible, 80+ gares couvertes en France.

---

## 2. STACK TECHNIQUE ACTUELLE

| Couche | Technologie | Détails |
|---|---|---|
| Frontend | HTML/CSS/JS pur | Mono-fichier index.html — **à séparer** |
| Hébergement | Netlify | livreo-app.netlify.app — Site ID: `77ed7afd-afba-4963-9d0d-19336ba46d77` |
| Base de données | Supabase (PostgreSQL) | Project ID: `wqhuaylfytdmhzjauvmv` |
| Auth | Supabase Auth | Email + Google OAuth |
| Paiements | Stripe LIVE | Account: `acct_1QLFSSFQ0erFJFSm` |
| SMS | Twilio + Brevo (fallback) | Twilio SID: `ACd847d9617a93d9d2a5ee4bc4ef2ecbc4` |
| Serverless | Supabase Edge Functions (Deno) | 6 fonctions actives |
| Storage | Supabase Storage | 3 buckets configurés |

### Variables d'environnement nécessaires
```
SUPABASE_URL=https://wqhuaylfytdmhzjauvmv.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
STRIPE_PK_LIVE=pk_live_51QLFSSFQ0erFJFSm...
TWILIO_SID=ACd847d9617a93d9d2a5ee4bc4ef2ecbc4
TWILIO_TOKEN=ac52f2987e535ffb500a079abf8d7498
TWILIO_FROM=+15717254654
BREVO_API_KEY=(à configurer)
```

---

## 3. STRUCTURE DE FICHIERS CIBLE (à créer)

```
livreo/
├── index.html                  # Point d'entrée SPA
├── netlify.toml                # Headers sécurité + redirections
├── robots.txt
├── sitemap.xml
├── css/
│   └── style.css               # Tous les styles (déjà extrait)
├── js/
│   ├── supabase.js             # Config + sécurité (déjà extrait)
│   ├── auth.js                 # Login/register/logout (déjà extrait)
│   ├── app.js                  # Navigation + utils + toast
│   ├── home.js                 # Page accueil + dashboard utilisateur
│   ├── explorer.js             # Marketplace des colis
│   ├── poster.js               # Formulaire poster un colis
│   ├── suivi.js                # Suivi colis + QR Code
│   ├── profil.js               # Profil + paramètres
│   ├── livreur.js              # Flux de livraison (3 étapes)
│   └── admin.js                # Espace admin intégré
├── pages/
│   └── (fragments HTML par écran)
└── admin/
    ├── index.html              # Dashboard admin complet (déjà créé)
    └── security-setup.sql      # Script SQL sécurité
```

---

## 4. BASE DE DONNÉES — 14 TABLES

### Table `users` (25 colonnes)
```sql
id UUID PK, email TEXT UNIQUE, prenom TEXT, nom TEXT, telephone TEXT,
photo_profil_url TEXT, adresse TEXT, ville TEXT, code_postal TEXT,
date_naissance DATE, note_moyenne NUMERIC(2,1) DEFAULT 0,
nb_livraisons INTEGER DEFAULT 0, nb_colis_envoyes INTEGER DEFAULT 0,
niveau_verification INTEGER DEFAULT 1,  -- 1=email, 2=tel, 3=CNI, 4=domicile
statut TEXT DEFAULT 'actif',  -- actif | suspendu | bloqué
verifie BOOLEAN DEFAULT FALSE,
reset_token TEXT, reset_token_expires TIMESTAMPTZ,
stripe_customer_id TEXT, stripe_account_id TEXT,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

### Table `user_roles` (5 colonnes)
```sql
id UUID PK, user_id UUID FK users UNIQUE,
role TEXT -- user | admin | livreur_verifie | support | moderateur
granted_by UUID, granted_at TIMESTAMPTZ
```
> ⚠️ **Admin actuel :** `kouletiokevinfr@gmail.com` (ID: `9551f95c-49e3-4db9-bd8d-bd6ec29036be`)

### Table `colis` (24 colonnes)
```sql
id UUID PK, code_lvr TEXT UNIQUE,  -- généré auto par trigger: LVR-XXXX
titre TEXT, description TEXT,
gare_depart TEXT, gare_arrivee TEXT,
format TEXT,  -- Pochette S/M | Colis S/M/L/XL
poids TEXT, prix NUMERIC(6,2),
prix_type TEXT DEFAULT 'libre',  -- fixe | libre | negociable
date_souhaitee DATE,
photo_emballee_url TEXT, photos_contenu_urls TEXT[],
expediteur_id UUID FK users, livreur_id UUID FK users,
destinataire_nom TEXT, destinataire_tel TEXT,
num_train TEXT, qr_secret TEXT,
statut TEXT DEFAULT 'en_attente',
-- en_attente | livreur_accepte | en_transit | livre | annule | litige
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

### Table `transactions` (13 colonnes)
```sql
id UUID PK, colis_id UUID FK, expediteur_id UUID FK, livreur_id UUID FK,
montant NUMERIC(6,2), stripe_payment_intent TEXT, stripe_transfer_id TEXT,
statut TEXT,  -- en_attente | escrow | libere | rembourse | litige
photo_remise_url TEXT, qr_scanne_at TIMESTAMPTZ,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

### Table `stripe_config` (8 colonnes)
```sql
id SERIAL PK, format TEXT UNIQUE, prix_euros NUMERIC,
prix_min NUMERIC, prix_max NUMERIC,
stripe_product_id TEXT, stripe_price_id TEXT, actif BOOLEAN
```
**Produits Stripe LIVE configurés :**
| Format | Prix suggéré | Min | Max | Product ID |
|---|---|---|---|---|
| Pochette S | 3,50€ | 2€ | 8€ | prod_UUxhZlokTZ6MbY |
| Pochette M | 5,00€ | 3€ | 12€ | prod_UUxhHkHJYhoMMI |
| Colis S | 7,00€ | 5€ | 18€ | prod_UUxhUTAEC8D2IW |
| Colis M | 11,00€ | 7€ | 25€ | prod_UUxhEc8gbrPJWJ |
| Colis L | 16,00€ | 10€ | 40€ | prod_UUxhCe1XSaEawY |
| Colis XL | 24,00€ | 15€ | 60€ | prod_UUxh36FCAjxmq6 |

### Autres tables
- `avis` — notes 1-5 entre utilisateurs après livraison
- `notifications` — alertes push/SMS par utilisateur
- `litiges` — conflits expéditeur/livreur, gérés par admin
- `verifications_identite` — KYC livreurs (CNI + selfie)
- `app_config` — configuration globale clé/valeur
- `security_logs` — logs de sécurité (connexions, tentatives)
- `code_attempts` — anti-bruteforce codes LVR (max 10/heure)
- `verification_codes` — codes OTP SMS reset password
- `sessions_log` — historique sessions

### Vues
- `admin_dashboard` — KPIs temps réel pour le dashboard admin
- `colis_actifs` — colis en cours avec noms expéditeur/livreur
- `colis_marketplace` — colis disponibles pour la marketplace

### Triggers actifs
- `trigger_set_code_lvr` — génère LVR-XXXX automatiquement à l'insertion
- `trigger_init_user` — met les compteurs à 0 à chaque inscription
- `trigger_user_stats` — incrémente nb_livraisons/nb_colis_envoyes à la livraison
- `trigger_note_moyenne` — recalcule la moyenne après chaque avis
- `trigger_users_updated_at` — met à jour updated_at
- `trigger_colis_updated_at`
- `trigger_transactions_updated_at`

### Fonctions SQL (SECURITY DEFINER)
- `assign_role(email, role, admin_id)` → attribue un rôle
- `revoke_role(email, admin_id)` → révoque un rôle
- `verify_code_lvr(code, user_id, tel)` → vérifie un code LVR
- `check_code_attempts(user_id)` → anti-bruteforce
- `cleanup_expired_codes()` → nettoyage codes expirés

---

## 5. EDGE FUNCTIONS SUPABASE (Deno)

| Fonction | Version | Rôle |
|---|---|---|
| `send-sms` | v5 | SMS via Twilio + Brevo (multi-provider, fallback auto) |
| `confirm-livraison` | v4 | QR scanné → statut "livré" → paiement libéré → SMS aux 2 parties |
| `accepter-colis` | v3 | Livreur accepte → SMS expéditeur + destinataire |
| `reset-password` | v3 | Mot de passe oublié → code OTP 6 chiffres par SMS |
| `verify-reset-code` | v2 | Vérification OTP + mise à jour password |
| `create-payment` | v2 | Création PaymentIntent Stripe en mode escrow |

**Pattern d'appel :**
```javascript
const res = await fetch(`${SUPABASE_URL}/functions/v1/nom-fonction`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ param1, param2 })
});
```

---

## 6. SUPABASE STORAGE — 3 BUCKETS

| Bucket | Public | Taille max | Types acceptés |
|---|---|---|---|
| `photos-profil` | ✅ Oui | 5 MB | JPEG, PNG, WebP |
| `photos-colis` | ❌ Non | 10 MB | JPEG, PNG, WebP |
| `documents-identite` | ❌ Non | 15 MB | JPEG, PNG, PDF |

> ⚠️ **TODO :** L'upload réel vers ces buckets n'est pas encore implémenté dans le frontend. Les photos sont actuellement gérées en base64 local uniquement.

---

## 7. APPLICATION PUBLIQUE — 5 ÉCRANS

### Écran 1 : Accueil (`home`)
**Non connecté :**
- Hero avec slogan animé
- Boutons "Envoyer un colis" et "Devenir livreur"
- Section avantages + témoignages

**Connecté — utilisateur standard :**
- Message de bienvenue personnalisé
- Boutons rapides : Poster un colis / Explorer
- Portefeuille (solde réel depuis `transactions`)
- Mes livraisons en cours (depuis `colis` avec `livreur_id = user.id`)
- KPIs : colis envoyés, livraisons, gains, note

**Connecté — admin uniquement :**
- Bannière 👑 "Espace Administrateur" → `/admin`
- Dashboard admin intégré dans l'onglet "Moi" avec KPIs temps réel
- Actions rapides : Utilisateurs, Colis, Vérifications, Rôles, Litiges, Config

### Écran 2 : Explorer (`explorer`)
- Marketplace des colis disponibles (statut `en_attente`)
- Filtres par gare de destination (tags cliquables)
- Carte colis : photo emballée, trajet, format, prix, expéditeur + note
- Chargement depuis Supabase (fallback données démo si vide)
- Clic → Sheet avec détail + bouton "Accepter de livrer"

**Flux acceptation livreur :**
1. Clic "Je prends ce colis" → modal confirmation
2. Appel Edge Function `accepter-colis`
3. SMS envoyé à l'expéditeur ET au destinataire
4. Colis passe de `en_attente` → `livreur_accepte`
5. Coordonnées expéditeur débloquées pour le livreur

### Écran 3 : Poster (`poster`)
**Formulaire en plusieurs étapes :**
1. **Photos** — photo emballée obligatoire (📷 caméra ou 🖼️ galerie)
2. **Trajet** — gare départ + gare arrivée (80+ gares françaises dans la liste)
3. **Colis** — titre, description, date souhaitée
4. **Format & Poids** — sélecteur taille (XS/S/M/L/XL) + saisie poids
5. **Prix** — slider dynamique avec fourchette min/max/suggéré selon format+poids
   - Indicateur "vitesse d'acceptation" selon position du slider
   - Min : 45% du prix suggéré / Max : 250% du prix suggéré
6. **Destinataire** — nom + téléphone (reçoit SMS avec code LVR)

**À la publication :**
- `INSERT INTO colis` → trigger génère `code_lvr` auto
- SMS envoyé au destinataire avec code LVR
- Redirection vers écran de succès avec code LVR affiché

### Écran 4 : Suivi (`suivi`)
**Vue expéditeur** (si `expediteur_id = user.id`) :
- Timeline des étapes : Publié → Livreur assigné → En transit → Livré
- Statut badge coloré en temps réel
- Informations livreur (nom, note) une fois assigné

**Vue destinataire** (si `destinataire_tel` correspond) :
- Saisie du code LVR reçu par SMS
- Génération QR Code unique et sécurisé
- Instructions "Montrez ce QR Code au livreur à la remise"
- Le QR Code contient le `qr_secret` encodé — impossible à forger

### Écran 5 : Moi (`profil`)
- Photo de profil cliquable (📷 changement direct)
- Informations personnelles : prénom, nom (verrouillé), email, téléphone, adresse, date de naissance
- ⚠️ Modification du nom uniquement via justificatif → `verification@livreo.fr`
- Vérification identité 4 niveaux (badges visuels)
- Changement de mot de passe
- Déconnexion
- **Si admin :** Dashboard admin intégré (voir section Admin)

---

## 8. FLUX MÉTIER COMPLET — Cycle de vie d'un colis

```
[EXPÉDITEUR]                    [SYSTÈME]                    [LIVREUR]
     │                              │                              │
     ▼                              │                              │
Poster un colis ──────────────► Code LVR auto                     │
     │                         SMS destinataire                    │
     │                              │                              │
     │                         Marketplace ◄───────── Explore colis
     │                              │                              │
     │                         SMS expéditeur ◄──── Accepter colis
     │                         SMS destinataire                    │
     │                              │                              │
     │                              │                    Étape 1: Photo remise
     │                              │                    Étape 2: Checklist
     │                              │                    Étape 3: Scan QR Code
     │                              │                              │
     │                    Statut → "livré" ◄──────────────────────┘
     │                    Paiement libéré
     │                    SMS confirmations
     ▼                              │
[DESTINATAIRE]                      │
Reçoit SMS ──────► Code LVR ──► QR Code unique
                                    │
                              Montré au livreur → Scan → Livraison confirmée
```

---

## 9. FLUX DE LIVRAISON LIVREUR — 3 ÉTAPES OBLIGATOIRES

Le livreur **doit** compléter ces 3 étapes dans l'ordre avant que le paiement soit libéré :

**Étape 1 — Photo de remise (obligatoire)**
- Prend une photo en temps réel avec la caméra
- Preuve visuelle de la remise en main propre
- Upload vers `photos-colis` bucket

**Étape 2 — Checklist de vérification (obligatoire)**
- ☑ J'ai bien remis le colis en main propre
- ☑ Le destinataire a vérifié le contenu
- ☑ Aucun dommage apparent

**Étape 3 — Scan QR Code (obligatoire)**
- Scanner le QR Code affiché par le destinataire
- Ou saisie manuelle du code si scan impossible
- Appel Edge Function `confirm-livraison`
- → Paiement libéré automatiquement
- → SMS de confirmation aux deux parties

---

## 10. AUTHENTIFICATION

### Méthodes supportées
- Email + mot de passe
- Google OAuth (configuré dans Supabase)

### Sécurité
- Rate limiting côté client : 5 tentatives login / 5 min, 3 inscriptions / 10 min
- Validation email et téléphone côté client ET côté serveur
- Sanitisation XSS sur toutes les entrées utilisateur
- CSRF token généré par session
- Logs de sécurité dans `security_logs` à chaque événement

### Reset password
1. Utilisateur entre son email
2. Appel Edge Function `reset-password` → code OTP 6 chiffres par SMS
3. Utilisateur entre le code + nouveau mot de passe
4. Appel Edge Function `verify-reset-code` → vérification + mise à jour

---

## 11. ESPACE ADMINISTRATEUR

### Accès
- **URL :** `/admin` (fichier `admin/index.html`)
- **Accès intégré** dans l'onglet "Moi" si rôle `admin`
- **Compte admin :** `kouletiokevinfr@gmail.com` (Kevin KOULETIO)
- Vérification du rôle à la connexion — accès refusé si non-admin

### Sections du dashboard admin
1. **Vue d'ensemble** — KPIs temps réel depuis `admin_dashboard`
   - Total users, colis actifs, revenus, paiements
   - Activité récente (10 derniers colis)
   - Alertes : vérifications en attente, litiges ouverts

2. **Utilisateurs** — liste complète avec recherche/filtre
   - Voir : email, téléphone, nb livraisons, note, statut
   - Actions : Suspendre, Bloquer

3. **Colis** — tous les colis avec filtres par statut
   - Actions : Annuler un colis

4. **Transactions** — historique des paiements Stripe

5. **Vérifications d'identité** — traiter les demandes KYC
   - Actions : Approuver ✅ / Refuser ❌ avec motif

6. **Litiges** — résolution des conflits
   - Actions : Résoudre avec décision (remboursement / livreur / partage)

7. **Notifications** — envoyer des notifications aux utilisateurs

8. **Configuration** — modifier `app_config` en live
   - sms_provider, app_url, maintenance_mode, etc.

9. **Sécurité** — logs de sécurité temps réel

10. **Gestion des rôles** — attribuer/révoquer des rôles
    - Formulaire : email + rôle → appel fonction SQL `assign_role`
    - Vue tableau de tous les rôles actuels
    - Révocation possible (sauf pour soi-même)

### Rôles disponibles
| Rôle | Permissions |
|---|---|
| `user` | Standard — envoyer/recevoir des colis |
| `livreur_verifie` | Badge vérifié, peut livrer |
| `support` | Voir litiges et vérifications |
| `moderateur` | Suspendre users, annuler colis |
| `admin` | Accès total — attribuer/révoquer tous les rôles |

---

## 12. SEO & PWA

### SEO implémenté
- Title optimisé avec mots-clés
- Meta description, keywords, robots
- Open Graph (Facebook, WhatsApp, LinkedIn)
- Twitter Card
- Schema.org JSON-LD : WebApplication, Organization, Service, FAQPage
- Canonical URL
- sitemap.xml + robots.txt

### PWA
- Manifest (installable sur Android et iOS)
- Service Worker (fonctionne partiellement hors ligne)
- Bouton "Installer Livreo" (beforeinstallprompt)
- Favicon SVG

---

## 13. CE QUI EST FAIT ✅

- [x] Splash screen animé (train TGV + colis + logo)
- [x] Navigation 5 onglets (Accueil, Explorer, Poster, Suivi, Moi)
- [x] Auth email + Google OAuth
- [x] Reset password par SMS
- [x] Inscription avec compteurs à 0 (triggers SQL)
- [x] Marketplace colis avec chargement Supabase
- [x] Formulaire poster un colis complet
- [x] Slider de prix dynamique (poids × taille)
- [x] Flux livreur 3 étapes obligatoires
- [x] QR Code unique pour destinataire
- [x] Suivi timeline expéditeur
- [x] Profil utilisateur avec photo
- [x] Vérification identité 4 niveaux (UI)
- [x] Espace admin intégré dans l'app
- [x] Dashboard admin complet (/admin)
- [x] Gestion des rôles via SQL sécurisé
- [x] 7 failles de sécurité corrigées (RLS Supabase)
- [x] 6 Edge Functions SMS/paiement actives
- [x] 6 produits Stripe LIVE configurés
- [x] 3 buckets Storage Supabase
- [x] SEO complet + Schema.org
- [x] PWA installable
- [x] Logo L sur rails + slogan
- [x] Permissions demandées une seule fois

---

## 14. CE QUI RESTE À FAIRE ⚠️

### Fonctionnel (code)
- [ ] **Upload réel photos** vers Supabase Storage (actuellement base64 local)
- [ ] **Paiement Stripe** — créer le PaymentIntent au moment de poster (escrow)
- [ ] **Stripe Connect** — virements automatiques aux livreurs
- [ ] **Notifications push** — abonnement ServiceWorker + envoi serveur
- [ ] **Géolocalisation** — détecter la gare la plus proche
- [ ] **Fil d'activité** — notifications in-app en temps réel (Supabase realtime)
- [ ] **Scan QR Code** — implémentation caméra réelle (jsQR ou ZXing)
- [ ] **Génération QR Code** — remplacer l'API tierce par génération locale
- [ ] **Avis/notation** — formulaire post-livraison
- [ ] **Recherche gares** — autocomplétion SNCF API ou liste statique

### Infrastructure
- [ ] **Stripe KYC** — compléter sur dashboard.stripe.com (activer les paiements)
- [ ] **Domaine livreo.fr** — OVH (~10€/an) + DNS Netlify
- [ ] **Email verification@livreo.fr** — redirection OVH
- [ ] **Numéro Twilio FR** (+33) — remplacer numéro US
- [ ] **Brevo API Key** — configurer pour SMS moins chers
- [ ] **Google Play Store** — 25$ frais uniques, générer APK avec Capacitor

### Migration stack (quand > 500 users)
- [ ] **Next.js 14** — App Router, SSR, meilleur SEO
- [ ] **Vercel** — déploiement auto depuis GitHub
- [ ] **TypeScript** — typage strict
- [ ] **Tailwind CSS** — remplacer le CSS custom
- [ ] **React Native / Expo** — app mobile native

### Monitoring
- [ ] **PostHog** — analytics utilisateurs
- [ ] **Sentry** — monitoring erreurs
- [ ] **Crisp** — support client live

---

## 15. IDENTIFIANTS ET ACCÈS

> ⚠️ **Ces informations sont confidentielles — ne pas partager publiquement**

| Service | Identifiant | Accès |
|---|---|---|
| Netlify | Site ID: `77ed7afd-afba-4963-9d0d-19336ba46d77` | app.netlify.com |
| Supabase | Project ID: `wqhuaylfytdmhzjauvmv` | supabase.com |
| Stripe | Account: `acct_1QLFSSFQ0erFJFSm` | dashboard.stripe.com |
| Twilio | SID: `ACd847d9617a93d9d2a5ee4bc4ef2ecbc4` | console.twilio.com |
| Admin app | `kouletiokevinfr@gmail.com` | livreo-app.netlify.app |
| GitHub | `kouletiokevin/livreo-app` | github.com |

---

## 16. INSTRUCTIONS POUR CLAUDE CODE

### Priorité 1 — Séparer le code
Le fichier `index.html` fait ~2800 lignes. Il faut le séparer en modules :
```bash
# Structure cible déjà partiellement créée dans livreo-code-structure.zip :
# - css/style.css ✅
# - js/supabase.js ✅ 
# - js/auth.js ✅
# - admin/index.html ✅
# Reste à créer : js/app.js, js/home.js, js/explorer.js, etc.
```

### Priorité 2 — Implémenter l'upload photos
```javascript
// Pattern Supabase Storage
const { data, error } = await db.storage
  .from('photos-colis')
  .upload(`${userId}/${Date.now()}.jpg`, file, {
    contentType: 'image/jpeg',
    upsert: false
  });
const url = db.storage.from('photos-colis').getPublicUrl(data.path).data.publicUrl;
```

### Priorité 3 — Implémenter le paiement
```javascript
// Créer PaymentIntent à la publication du colis
const { client_secret } = await callEdgeFunction('create-payment', {
  amount: prix * 100,  // en centimes
  colis_id: colisId,
  expediteur_id: user.id
});
// Confirmer avec Stripe.js
const stripe = Stripe('pk_live_51QLFSSFQ0erFJFSm...');
const { error } = await stripe.confirmPayment({
  clientSecret: client_secret,
  confirmParams: { return_url: window.location.href }
});
```

### Priorité 4 — Scan QR Code réel
```javascript
// Utiliser jsQR (npm install jsqr) ou @zxing/library
import jsQR from 'jsqr';
// Accéder à la caméra, dessiner sur canvas, analyser chaque frame
const code = jsQR(imageData.data, imageData.width, imageData.height);
if (code) doScan(code.data);
```

### Pattern général du code existant
```javascript
// Toutes les fonctions asynchrones suivent ce pattern :
async function nomFonction() {
  const btn = document.getElementById('btn-id');
  if (btn) { btn.textContent = 'Chargement...'; btn.disabled = true; }
  try {
    rateLimit('action', 5, 300000);  // anti-abus
    const { data, error } = await db.from('table').select('*');
    if (error) throw new Error(error.message);
    // traiter data
    t('Succès ✅', 's');  // toast
  } catch (e) {
    t(e.message || 'Erreur', 'e');
  } finally {
    if (btn) { btn.textContent = 'Texte original'; btn.disabled = false; }
  }
}
```

---

*Document généré le 27 mai 2026 — Version 1.0*
*Fondateur : Kevin KOULETIO — kouletiokevinfr@gmail.com*
