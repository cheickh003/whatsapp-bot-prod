# Persistance de Session WhatsApp

## Configuration

Le bot Jarvis est configuré pour sauvegarder automatiquement la session WhatsApp après la première connexion. Vous ne devriez scanner le QR code qu'une seule fois.

### Fonctionnement

1. **Première connexion** : Scannez le QR code qui s'affiche
2. **Sessions suivantes** : Le bot se reconnecte automatiquement sans QR code

### Emplacement de la session

La session est stockée dans : `.wwebjs_auth/session-jarvis-bot-nourx/`

### En cas de problème

Si vous devez scanner le QR code à chaque redémarrage :

#### 1. Vérifiez les permissions
```bash
./fix-session-permissions.sh
```

#### 2. Si le problème persiste, réinitialisez la session
```bash
# Arrêtez le bot
npm stop

# Supprimez l'ancienne session
rm -rf .wwebjs_auth

# Redémarrez le bot
npm start
```

#### 3. Pour Docker
Si vous utilisez Docker, assurez-vous de monter le volume :
```yaml
volumes:
  - ./wwebjs_auth:/app/.wwebjs_auth
```

### Configuration avancée

Le bot utilise les paramètres suivants pour la persistance :
- **clientId** : `jarvis-bot-nourx` (identifiant unique de session)
- **dataPath** : `./.wwebjs_auth/` (dossier de stockage)
- **webVersionCache** : Version fixe de WhatsApp Web pour éviter les incompatibilités

### Sécurité

⚠️ **Important** : Le dossier `.wwebjs_auth` contient vos données de session WhatsApp. 
- Ne le partagez jamais
- Ne le commitez pas dans git (déjà dans .gitignore)
- Sauvegardez-le régulièrement si vous voulez éviter de rescanner le QR code

### Logs utiles

Lors du démarrage, vous verrez :
- ✅ `Session authenticated from saved data - no QR scan needed` : Session restaurée avec succès
- 📱 `QR Code received, scan it with your phone` : Nouvelle session requise