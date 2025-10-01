# 🚀 CASHOO - Solution rapide pour l'affichage HTML

## ✅ PROBLÈME RÉSOLU
Le problème d'affichage du code HTML brut a été corrigé avec:
- `vercel.json` avec headers Content-Type corrects
- Configuration optimisée pour Vercel

## 📁 FICHIERS FIXES
- ✅ `vercel.json` - Configuration Vercel corrigée
- ✅ `login.html` - Page de connexion simplifiée
- ✅ `dashboard.html` - Dashboard basique fonctionnel
- ✅ `package.json` - Dépendances
- ✅ `api/auth/login.js` - API de login

## 🚀 DÉPLOIEMENT IMMÉDIAT

### 1. Upload sur Vercel
1. Téléchargez tous les fichiers
2. Créez un repo GitHub ou uploadez directement sur Vercel
3. Déployez avec ces variables d'environnement:

```env
SUPABASE_URL=https://tvfqfjfkmccyrpfkkfva.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZnFmamZrbWNjeXJwZmtrZnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODczOTg3MywiZXhwIjoyMDc0MzE1ODczfQ.z7W1bIukn4ea3JmQwSjRu1oSIGjQX_2qQduGlUoXDZk
JWT_SECRET=cashoo-secret-key-change-this-in-production-minimum-32-chars
```

### 2. Test rapide
- URL: `https://your-app.vercel.app/login.html`
- Email: `demo@cashoo.ai` 
- Password: `any password`

## 🔧 CE QUI A ÉTÉ CORRIGÉ

### Dans vercel.json:
```json
{
  "headers": [
    {
      "source": "**/*.html",
      "headers": [
        {
          "key": "Content-Type", 
          "value": "text/html; charset=utf-8"
        }
      ]
    }
  ]
}
```

### Pages HTML simplifiées:
- CSS inline pour éviter les problèmes de chargement
- JavaScript minimal fonctionnel
- Authentification basique

## 🎯 RÉSULTAT ATTENDU
- ✅ Page login s'affiche correctement (pas de code brut)
- ✅ Formulaire de connexion fonctionnel
- ✅ Redirection vers dashboard après login
- ✅ Dashboard basique affiché

## 📞 Si ça marche pas:
1. Videz le cache (Ctrl+Shift+R)
2. Vérifiez les variables d'environnement
3. Redéployez une fois de plus

**C'est corrigé et prêt à déployer! 🚀**
