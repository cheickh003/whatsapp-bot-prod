# Fix pour l'avertissement "Invalid Origin" d'Appwrite

## Problème
Vous voyez ce message dans les logs :
```
Invalid Origin. Register your new client (192.168.1.3) as a new Web platform on your project console dashboard
```

## Solution

### 1. Accédez à votre Console Appwrite
- Connectez-vous à votre instance Appwrite
- Allez dans votre projet

### 2. Ajoutez la nouvelle plateforme
1. Dans le menu latéral, cliquez sur **"Settings"** (Paramètres)
2. Puis cliquez sur **"Platforms"** (Plateformes)
3. Cliquez sur **"Add Platform"** (Ajouter une plateforme)
4. Sélectionnez **"Web App"**

### 3. Configurez la plateforme
- **Name**: Bot WhatsApp Local (ou un nom de votre choix)
- **Hostname**: `192.168.1.3`
- Cliquez sur **"Next"** puis **"Skip optional steps"**

### 4. Ajoutez d'autres IPs si nécessaire
Si vous accédez au bot depuis différentes machines/IPs, ajoutez-les aussi :
- `localhost`
- `127.0.0.1`
- Votre IP publique si vous utilisez le bot à distance
- Toute autre IP locale (ex: `192.168.1.x`)

### 5. Configuration alternative (Développement uniquement)
Si vous êtes en développement et voulez autoriser toutes les origines :
1. Dans Platforms, ajoutez `*` comme hostname
2. ⚠️ **ATTENTION**: Ne faites ceci qu'en développement local !

## Vérification
Après avoir ajouté la plateforme :
1. Redémarrez le bot : `./bot-manager.sh restart`
2. Vérifiez les logs : `./bot-manager.sh logs`
3. L'avertissement "Invalid Origin" ne devrait plus apparaître

## Notes importantes
- Ce n'est qu'un avertissement, le bot fonctionne quand même
- L'ajout de plateformes améliore la sécurité
- Chaque IP d'où vous accédez à Appwrite doit être enregistrée
- En production, n'utilisez jamais `*` comme hostname

## Pourquoi cela arrive ?
Appwrite vérifie l'origine des requêtes pour des raisons de sécurité (CORS). Quand vous faites des requêtes depuis une IP non enregistrée, Appwrite affiche cet avertissement mais traite quand même la requête.