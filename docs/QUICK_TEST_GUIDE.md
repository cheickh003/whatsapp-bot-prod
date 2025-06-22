# Guide de Test Rapide - Nouvelles Fonctionnalités

## 📄 Test Documents
1. Envoyez un fichier PDF au bot
2. Attendez la confirmation de téléchargement
3. Testez les commandes:
   - `/doc list` - Voir vos documents
   - `/doc query comment [sujet]` - Poser une question
   - `/doc info [id]` - Détails d'un document

## 🎤 Test Messages Vocaux
1. Enregistrez un message vocal
2. Envoyez-le au bot
3. Vérifiez qu'il n'y a PAS de message "traitement en cours"
4. Attendez la réponse basée sur votre message

## 💬 Test Chunking
1. Demandez une longue explication:
   ```
   explique moi en détail comment fonctionne internet
   ```
2. Vérifiez que la réponse arrive en plusieurs messages (3-4 lignes chacun)

## 👑 Test Admin (Authentifiez-vous d'abord: `/admin auth 1471`)
1. Message normal:
   ```
   /admin send 2250703079410 Test message admin
   ```
2. Message IA:
   ```
   /admin send-ai 2250703079410 rappelle lui notre réunion
   ```
3. Message incognito:
   ```
   /admin send-raw 2250703079410 Message sans badge
   ```

## ⚠️ Corrections Appliquées
- ✅ Format numéro WhatsApp corrigé (utilisez 2250XXXXXXXXX)
- ✅ Support documents PDF/Word/Excel ajouté
- ✅ Commandes /doc fonctionnelles
- ✅ Variable isAdmin déplacée avant utilisation

## 🔍 Vérification Rapide
```bash
# Vérifier les erreurs
tail -f bot.log | grep -i error

# Vérifier le statut
./bot-manager.sh status
```