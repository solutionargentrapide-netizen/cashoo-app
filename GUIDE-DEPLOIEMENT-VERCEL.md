# 🚀 GUIDE DE DÉPLOIEMENT CASHOO SUR VERCEL

## ÉTAPE 1: PRÉPARER LES FICHIERS

### Structure requise sur GitHub:
```
cashoo-vercel/
├── api/
│   ├── auth/
│   │   ├── login.js
│   │   └── verify.js
│   └── flinks/
│       ├── connect.js
│       ├── sync.js
│       └── accounts.js
├── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── vercel.json
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

### Renommage des fichiers téléchargés:
- `api-auth-login.js` → `api/auth/login.js`
- `api-auth-verify.js` → `api/auth/verify.js`
- `api-flinks-connect.js` → `api/flinks/connect.js`
- `api-flinks-sync.js` → `api/flinks/sync.js`
- `api-flinks-accounts.js` → `api/flinks/accounts.js`
- `public-index.html` → `public/index.html`
- `public-css-style.css` → `public/css/style.css`
- `public-js-app.js` → `public/js/app.js`
- `README-VERCEL.md` → `README.md`

---

## ÉTAPE 2: CRÉER LE REPOSITORY GITHUB

1. **Aller sur GitHub.com**
2. **Cliquer sur "New repository"**
3. **Configurer:**
   - Repository name: `cashoo-vercel`
   - Description: `CASHOO Banking Dashboard`
   - Private repository: ✓
   - Initialize with README: ❌ (on va ajouter le nôtre)

4. **Créer le repository**

---

## ÉTAPE 3: UPLOADER LES FICHIERS SUR GITHUB

### Option A: Via l'interface web GitHub

1. **Pour chaque fichier:**
   - Cliquer sur "Create new file"
   - Taper le chemin complet (ex: `api/auth/login.js`)
   - Coller le contenu du fichier
   - Commit

### Option B: Via Git (si installé)

```bash
git clone https://github.com/[TON-USERNAME]/cashoo-vercel.git
cd cashoo-vercel

# Créer la structure
mkdir -p api/auth api/flinks public/css public/js

# Copier les fichiers (adapter les chemins)
cp ~/Downloads/api-auth-login.js api/auth/login.js
cp ~/Downloads/api-auth-verify.js api/auth/verify.js
# ... etc pour tous les fichiers

# Commit et push
git add .
git commit -m "Initial commit - CASHOO Vercel"
git push
```

---

## ÉTAPE 4: DÉPLOYER SUR VERCEL

1. **Aller sur [vercel.com](https://vercel.com)**
2. **Se connecter avec GitHub**
3. **Cliquer sur "Import Project"**
4. **Sélectionner le repo `cashoo-vercel`**
5. **Configurer le projet:**
   - Framework Preset: `Other`
   - Root Directory: `./`
   - Build Command: (laisser vide)
   - Output Directory: `public`

---

## ÉTAPE 5: CONFIGURER LES VARIABLES D'ENVIRONNEMENT

### Dans Vercel Dashboard:

1. **Aller dans:** Project Settings → Environment Variables
2. **Ajouter chaque variable:**

```
Nom: SUPABASE_URL
Valeur: https://tvfqfjfkmccyrpfkkfva.supabase.co
✓ Production ✓ Preview ✓ Development

Nom: SUPABASE_SERVICE_KEY
Valeur: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk
✓ Production ✓ Preview ✓ Development

Nom: FLINKS_CUSTOMER_ID
Valeur: aeca04b8-0164-453f-88f7-07252d7042bd
✓ Production ✓ Preview ✓ Development

Nom: FLINKS_API_DOMAIN
Valeur: https://solutionargentrapide-api.private.fin.ag
✓ Production ✓ Preview ✓ Development

Nom: FLINKS_CONNECT_DOMAIN
Valeur: https://solutionargentrapide-iframe.private.fin.ag/v2/
✓ Production ✓ Preview ✓ Development

Nom: FLINKS_X_API_KEY
Valeur: ca640342-86cc-45e4-b3f9-75dbda05b0ae
✓ Production ✓ Preview ✓ Development

Nom: JWT_SECRET
Valeur: cashoo-jwt-secret-change-this-in-production-minimum-32-characters-long
✓ Production ✓ Preview ✓ Development

Nom: APP_URL
Valeur: https://cashoo-vercel.vercel.app
✓ Production ✓ Preview ✓ Development
```

3. **Cliquer sur "Save"**

---

## ÉTAPE 6: REDÉPLOYER

Après avoir ajouté les variables:
1. **Aller dans:** Deployments
2. **Cliquer sur les 3 points** à côté du dernier déploiement
3. **Sélectionner "Redeploy"**
4. **Attendre que le déploiement soit terminé**

---

## ÉTAPE 7: CRÉER LES TABLES SUPABASE

1. **Aller sur [supabase.com](https://supabase.com)**
2. **Ouvrir votre projet**
3. **Aller dans SQL Editor**
4. **Coller et exécuter ce script:**

```sql
-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flinks data table
CREATE TABLE IF NOT EXISTS flinks_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    login_id TEXT NOT NULL,
    request_id TEXT,
    accounts_data JSONB DEFAULT '[]'::jsonb,
    transactions_data JSONB DEFAULT '[]'::jsonb,
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_flinks_user_id ON flinks_data(user_id);
```

---

## ÉTAPE 8: TESTER L'APPLICATION

1. **Ouvrir:** `https://cashoo-vercel.vercel.app`
2. **Tester la connexion:**
   - Email: `test@cashoo.ai`
   - Devrait créer un compte et se connecter

3. **Tester Flinks:**
   - Cliquer sur "Connect Bank Account"
   - Utiliser les credentials de test:
     - Institution: `Flinks Capital`
     - Username: `jane_doe_capital`
     - Password: `Everyday`

---

## 🔍 VÉRIFICATION

### ✅ Checklist finale:
- [ ] Site accessible sur `https://cashoo-vercel.vercel.app`
- [ ] Login fonctionne avec n'importe quel email
- [ ] Dashboard s'affiche après login
- [ ] "Connect Bank Account" ouvre l'iframe Flinks
- [ ] Variables d'environnement configurées dans Vercel
- [ ] Tables créées dans Supabase
- [ ] Pas de fichier .env sur GitHub

---

## 🛠️ DÉPANNAGE

### Erreur "404 Not Found"
- Vérifier la structure des dossiers
- S'assurer que `vercel.json` est à la racine

### Erreur "Authentication failed"
- Vérifier les variables d'environnement
- Redéployer après avoir ajouté les variables

### Erreur "Supabase connection failed"
- Vérifier que les tables sont créées
- Vérifier la clé `SUPABASE_SERVICE_KEY`

### L'iframe Flinks ne s'ouvre pas
- Vérifier `FLINKS_CUSTOMER_ID`
- Vérifier `FLINKS_X_API_KEY`

---

## 📞 SUPPORT

Si tu rencontres des problèmes:
1. Vérifie les logs dans Vercel Dashboard → Functions
2. Vérifie la console du navigateur (F12)
3. Teste les API directement avec curl

---

**🎉 FÉLICITATIONS! CASHOO est maintenant en ligne sur Vercel!**
