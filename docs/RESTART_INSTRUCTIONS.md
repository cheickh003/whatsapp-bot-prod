# Instructions de redémarrage du bot

## Première fois après cette mise à jour

Vous devez scanner le QR code une dernière fois car l'ancienne session a été supprimée. 

```bash
# Voir le QR code dans les logs
./bot-manager.sh logs --qr
```

## Pour les prochains redémarrages

La session sera automatiquement préservée ! Utilisez simplement :

```bash
# Redémarrer le bot (session préservée)
./bot-manager.sh restart

# Arrêter le bot (session préservée)
./bot-manager.sh stop

# Démarrer le bot (reconnexion automatique)
./bot-manager.sh start
```

## Si vous voulez réinitialiser la session

Utilisez la commande `clean` qui demandera confirmation :

```bash
./bot-manager.sh clean
# Répondez 'y' pour supprimer la session
# Répondez 'n' pour la conserver
```

## Vérifier l'état de la session

```bash
# Vérifier si le dossier de session existe
ls -la .wwebjs_auth/

# Si vous voyez un dossier "session-jarvis-bot-nourx", la session est sauvegardée
```

## Résolution de problèmes

Si vous devez toujours scanner le QR code après un redémarrage :

1. **Vérifiez les permissions** :
   ```bash
   ./fix-session-permissions.sh
   ```

2. **Vérifiez les logs pour des erreurs** :
   ```bash
   ./bot-manager.sh logs | grep -i "auth"
   ```

3. **En dernier recours, réinitialisez** :
   ```bash
   ./bot-manager.sh clean
   # Répondez 'y' pour supprimer l'ancienne session
   ./bot-manager.sh start
   # Scannez le nouveau QR code
   ```