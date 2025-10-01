# 🚀 DÉPLOIEMENT RAPIDE - CASHOO sur Vercel

## ✅ ÉTAPES RAPIDES (5 minutes)

### 1️⃣ Télécharger le Projet

Téléchargez le fichier ZIP complet : **cashoo-fixed.zip**

### 2️⃣ Préparer GitHub

```bash
# Extraire le ZIP
unzip cashoo-fixed.zip
cd cashoo-fixed

# Initialiser Git
git init
git add .
git commit -m "Initial commit - CASHOO Banking Dashboard"

# Créer un repo sur GitHub et pusher
git remote add origin https://github.com/VOTRE_USERNAME/cashoo-app.git
git branch -M main
git push -u origin main
```

### 3️⃣ Déployer sur Vercel

1. Allez sur [vercel.com](https://vercel.com)
2. Cliquez sur **"New Project"**
3. Importez depuis GitHub
4. Sélectionnez **cashoo-app**
5. **IMPORTANT** : Ajoutez ces variables d'environnement :

```env
SUPABASE_URL=https://tvfqfjfkmccyrpfkkfva.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk
JWT_SECRET=cashoo-secret-key-change-this-in-production-minimum-32-chars
```

6. Cliquez sur **"Deploy"**
7. ✨ C'est fait !

### 4️⃣ Tester l'Application

Une fois déployée, visitez :

- **Login** : `https://votre-app.vercel.app/login.html`
- **Register** : `https://votre-app.vercel.app/register.html`
- **Dashboard** : `https://votre-app.vercel.app/dashboard.html`

## 📝 Compte de Test

Pour tester rapidement :

**Email** : `demo@cashoo.ai`
**Password** : `DemoPassword123!`

## 🔧 Configuration Flinks (Optionnel)

Si vous avez des clés Flinks :

```env
FLINKS_API_URL=https://sandboxapi.flinks.io
FLINKS_API_KEY=votre-cle-api
FLINKS_CUSTOMER_ID=votre-customer-id
```

## 🆘 Problèmes Courants

### "Method not allowed"
→ Vérifiez que les variables d'environnement sont bien configurées dans Vercel

### "Invalid token"
→ Assurez-vous que `JWT_SECRET` est identique partout

### Page blanche
→ Vérifiez la console du navigateur (F12) pour les erreurs

## 📧 Support

- **Email** : support@cashoo.ai
- **GitHub Issues** : Créez une issue sur votre repo

---

**🎉 Félicitations !** Votre application CASHOO est maintenant en ligne !
