# CASHOO Banking Dashboard - Version Corrigée

## 🚀 Projet Complètement Refait et Fonctionnel

Cette version corrige tous les problèmes du projet original CASHOO et ajoute une structure propre pour Vercel.

## ✅ Fonctionnalités Implémentées

### 🔐 Authentification Complète
- **Login** (`/api/auth/login.js`) - Connexion avec JWT
- **Register** (`/api/auth/register.js`) - Inscription avec hash bcrypt
- **Forgot Password** (`/api/auth/forgot.js`) - Récupération par email

### 🏦 Intégration Flinks
- **Get JSON** (`/api/flinks/getJson.js`) - Récupère les données bancaires via Request ID
- Support complet des comptes et transactions
- Formatage automatique des données

### 🎨 Frontend Moderne
- Pages HTML responsive et élégantes
- Dashboard interactif avec statistiques
- Gestion des sessions (localStorage/sessionStorage)
- États de chargement et messages d'erreur

## 📁 Structure du Projet

```
cashoo-fixed/
├── api/
│   ├── auth/
│   │   ├── login.js         # Endpoint de connexion
│   │   ├── register.js      # Endpoint d'inscription
│   │   └── forgot.js        # Récupération mot de passe
│   └── flinks/
│       └── getJson.js       # Récupération données Flinks
├── public/
│   ├── login.html           # Page de connexion
│   ├── register.html        # Page d'inscription
│   ├── forgot.html          # Page mot de passe oublié
│   └── dashboard.html       # Dashboard principal
├── vercel.json              # Configuration Vercel
├── package.json             # Dépendances
└── README.md               # Documentation
```

## 🛠 Installation et Déploiement

### 1. Cloner le Projet

```bash
git clone https://github.com/yourusername/cashoo-fixed.git
cd cashoo-fixed
```

### 2. Installer les Dépendances

```bash
npm install
```

### 3. Configuration des Variables d'Environnement

Créez un fichier `.env` à la racine :

```env
# Supabase
SUPABASE_URL=https://tvfqfjfkmccyrpfkkfva.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here

# JWT
JWT_SECRET=your-secret-key-minimum-32-characters

# Flinks
FLINKS_API_URL=https://sandboxapi.flinks.io
FLINKS_API_KEY=your_flinks_api_key
FLINKS_CUSTOMER_ID=your_customer_id

# Email (optionnel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@cashoo.ai

# App
APP_URL=https://cashoo.ai
NODE_ENV=production
```

### 4. Déployer sur Vercel

#### Option A : Via CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel --prod
```

#### Option B : Via GitHub

1. Push le code sur GitHub
2. Connectez-vous à [vercel.com](https://vercel.com)
3. Importez le projet depuis GitHub
4. Ajoutez les variables d'environnement
5. Déployez !

## 🔑 Variables d'Environnement Vercel

Dans le dashboard Vercel, ajoutez ces variables :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `SUPABASE_URL` | URL de votre projet Supabase | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Clé service Supabase | `eyJhbGc...` |
| `JWT_SECRET` | Secret pour JWT (32+ caractères) | `your-very-long-secret-key-here` |
| `FLINKS_API_KEY` | Clé API Flinks | `your-flinks-key` |
| `FLINKS_CUSTOMER_ID` | ID client Flinks | `aeca04b8-0164...` |

## 🧪 Test Local

```bash
# Lancer en développement
npm run dev

# Ouvrir dans le navigateur
http://localhost:3000
```

## 📝 Utilisation

### 1. Inscription
- Allez sur `/register.html`
- Créez un compte avec email/mot de passe
- Validation automatique du mot de passe fort

### 2. Connexion
- Allez sur `/login.html`
- Connectez-vous avec vos identifiants
- Token JWT stocké automatiquement

### 3. Dashboard
- Accès automatique après connexion
- Cliquez sur "Connect Bank"
- Entrez un Request ID Flinks
- Visualisez vos données bancaires

### 4. Récupération Mot de Passe
- Cliquez sur "Forgot password?"
- Entrez votre email
- Recevez un lien de réinitialisation

## 🔒 Sécurité

- ✅ Mots de passe hashés avec bcrypt
- ✅ Tokens JWT sécurisés
- ✅ Protection CORS configurée
- ✅ Validation des entrées
- ✅ HTTPS obligatoire en production
- ✅ Variables sensibles dans .env

## 🐛 Dépannage

### Erreur "Method not allowed"
- Vérifiez que les endpoints utilisent POST
- Vérifiez les headers CORS

### Token invalide
- Vérifiez le JWT_SECRET
- Assurez-vous qu'il est identique partout

### Flinks ne fonctionne pas
- Vérifiez les clés API Flinks
- Utilisez le sandbox pour tester

### Supabase erreurs
- Vérifiez les credentials Supabase
- Assurez-vous que les tables existent

## 📊 Structure Base de Données (Supabase)

### Table `users`
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    failed_login_attempts INT DEFAULT 0
);
```

### Table `sessions`
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id),
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Table `password_resets`
```sql
CREATE TABLE password_resets (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    reset_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Table `auth_logs`
```sql
CREATE TABLE auth_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Améliorations Futures

- [ ] OAuth (Google, Apple, Facebook)
- [ ] 2FA Authentication
- [ ] WebAuthn/Biométrie
- [ ] Graphiques et visualisations
- [ ] Export PDF/CSV
- [ ] Notifications push
- [ ] Mode sombre
- [ ] Multi-langue

## 📧 Support

Pour toute question ou problème :
- Email : support@cashoo.ai
- GitHub Issues : [github.com/cashoo/issues](https://github.com/cashoo/issues)

## 📄 License

MIT License - Voir [LICENSE](LICENSE)

---

**CASHOO Banking Dashboard** - Gérez vos finances intelligemment 💰

Built with ❤️ using Next.js, Vercel, Supabase & Flinks
