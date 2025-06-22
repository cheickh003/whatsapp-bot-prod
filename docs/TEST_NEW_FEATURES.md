# Guide de Test des Nouvelles Fonctionnalités

## 1. Messages Admin (Envoi Direct)

### Test 1: Message Normal avec Badge Admin
```
/admin send 2250XXXXXXXXX Bonjour, ceci est un test admin
```
**Résultat attendu:** Le destinataire reçoit:
```
👑 *[Message Admin]*
━━━━━━━━━━━━━━
Bonjour, ceci est un test admin
```

### Test 2: Message Traité par IA
```
/admin send-ai 2250XXXXXXXXX rappelle lui son rendez-vous demain
```
**Résultat attendu:** Message reformulé naturellement par Jarvis sans mention admin

### Test 3: Message Incognito (Sans Badge)
```
/admin send-raw 2250XXXXXXXXX Test message incognito
```
**Résultat attendu:** Le destinataire reçoit uniquement "Test message incognito"

### Test 4: Broadcast à Tous
```
/admin broadcast all Maintenance prévue ce soir à 22h
```
**Résultat attendu:** Tous les utilisateurs reçoivent le message avec badge admin

## 2. Messages Vocaux

### Test 1: Envoyer un Message Vocal
1. Enregistrer un message vocal sur WhatsApp
2. L'envoyer au bot
**Résultat attendu:** 
- Aucun message "traitement en cours"
- Réponse de Jarvis basée sur la transcription

### Test 2: Message Vocal Long
- Envoyer un message vocal de 30+ secondes
**Résultat attendu:** Transcription complète et réponse appropriée

## 3. Chunking des Messages

### Test 1: Message Long (Utilisateur Normal)
Envoyer au bot:
```
raconte moi une histoire longue avec beaucoup de détails
```
**Résultat attendu:** 
- Réponse divisée en chunks de 3-4 lignes max
- Indicateur de frappe entre chaque chunk
- Délai naturel entre les messages

### Test 2: Message Long (Admin)
En tant qu'admin authentifié:
```
explique moi le système solaire en détail
```
**Résultat attendu:** Réponse envoyée en UN SEUL message (pas de chunking)

## 4. Documents RAG (Base)

### Test 1: Upload de Document
```
/doc upload
```
Puis envoyer un PDF
**Résultat attendu:** Document sauvegardé, texte extrait

### Test 2: Liste des Documents
```
/doc list
```
**Résultat attendu:** Liste des documents uploadés

### Test 3: Question sur Document
```
/doc query qu'est-ce que dit le document sur [sujet]
```
**Résultat attendu:** Réponse basée sur le contenu du document

## 5. Messages Programmés (Admin)

### Test 1: Programmer un Message
```
/admin schedule 17:00 2250XXXXXXXXX Rappel: réunion dans 30 minutes
```
**Résultat attendu:** Confirmation de programmation

### Test 2: Lister Messages Programmés
```
/admin scheduled list
```
**Résultat attendu:** Liste des messages en attente

### Test 3: Annuler un Message
```
/admin scheduled cancel [id]
```
**Résultat attendu:** Message annulé

## Commandes de Diagnostic

### Vérifier les Logs
```bash
tail -f bot.log | grep -E "(error|Error|ERROR)"
```

### Vérifier l'État du Service
```bash
./bot-manager.sh status
```

### Vérifier les Processus
```bash
ps aux | grep -E "(node|chrome)" | grep -v grep
```

## Notes Importantes

1. **Format des Numéros:** Toujours utiliser le format 2250XXXXXXXXX (sans +)
2. **Authentification Admin:** D'abord `/admin auth 1471` avant les commandes admin
3. **Délais:** Attendre ~2 secondes entre les tests pour éviter le rate limiting
4. **Voice:** Les fichiers audio doivent être < 10MB

## Erreurs Courantes et Solutions

### "wid error: invalid wid"
- Vérifier le format du numéro (pas de @, pas de caractères spéciaux)
- Format correct: 2250703079410 ou +2250703079410

### "Evaluation failed"
- Le numéro n'existe pas sur WhatsApp
- Vérifier que le contact est bien enregistré

### Messages non reçus
- Vérifier que le bot est bien connecté (QR code scanné)
- Vérifier les logs pour des erreurs de connexion

## Script de Test Automatique

```bash
#!/bin/bash
# test-features.sh

echo "🧪 Test des nouvelles fonctionnalités..."

# Test 1: Message Admin Normal
echo "Test 1: Message admin normal"
echo "/admin send 2250XXXXXXXXX Test admin normal" | pbcopy
echo "Copiez et envoyez la commande dans WhatsApp"
read -p "Appuyez sur Enter après avoir testé..."

# Test 2: Message Vocal
echo "Test 2: Envoyez un message vocal au bot"
read -p "Appuyez sur Enter après avoir testé..."

# Test 3: Message Long
echo "Test 3: Message long pour chunking"
echo "raconte moi l'histoire de l'informatique en Côte d'Ivoire avec beaucoup de détails" | pbcopy
echo "Copiez et envoyez au bot"
read -p "Appuyez sur Enter après avoir testé..."

echo "✅ Tests terminés! Vérifiez les logs pour les erreurs."
```