# Documentation des Nouvelles Fonctionnalités

## Vue d'Ensemble

Les nouvelles fonctionnalités implémentées améliorent l'expérience utilisateur et offrent des capacités avancées aux administrateurs.

## 1. Traitement des Messages Vocaux (Background)

### Description
- Transcription automatique des messages vocaux avec Whisper API
- Traitement en arrière-plan sans notification à l'utilisateur
- Réponse intelligente basée sur le contenu transcrit

### Utilisation
1. L'utilisateur envoie un message vocal au bot
2. Le bot transcrit silencieusement le message
3. La réponse est générée et envoyée comme pour un message texte

### Configuration
```typescript
// src/config/interaction.config.ts
voiceProcessing: {
  enabled: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  whisperModel: 'whisper-1'
}
```

## 2. Système de Chunking des Messages

### Description
- Division automatique des réponses longues en chunks de 3-4 lignes
- Simulation de frappe humaine entre les messages
- Les admins reçoivent les messages en un seul bloc

### Fonctionnement
```typescript
// Exemple de réponse chunked
Chunk 1: "Voici la première partie de ma réponse.
Elle contient quelques lignes importantes.
Je vais continuer dans le message suivant."

[Délai de frappe 2-3 secondes]

Chunk 2: "Suite de ma réponse avec plus de détails.
Les informations sont organisées de manière claire.
Fin de ma réponse."
```

### Configuration
```typescript
// src/config/interaction.config.ts
messageChunking: {
  enabled: true,
  maxLinesPerChunk: 4,
  maxCharsPerChunk: 500
}
```

## 3. Messagerie Admin Avancée

### Modes d'Envoi

#### Mode Normal (avec badge)
```
/admin send 2250XXXXXXXXX [message]
```
Affichage: 👑 *[Message Admin]*

#### Mode IA (traitement intelligent)
```
/admin send-ai 2250XXXXXXXXX [message]
```
Le message est reformulé naturellement par l'IA

#### Mode Incognito (sans badge)
```
/admin send-raw 2250XXXXXXXXX [message]
```
Message envoyé sans indication admin

### Broadcast
```
/admin broadcast all [message]
```
Envoie à tous les utilisateurs actifs

### Messages Programmés
```
/admin schedule HH:MM 2250XXXXXXXXX [message]
/admin scheduled list
/admin scheduled cancel [id]
```

## 4. Système RAG pour Documents

### Upload de Documents
```
/doc upload
```
Puis envoyer le fichier (PDF, Word, Excel, TXT)

### Gestion des Documents
```
/doc list                    # Liste vos documents
/doc delete [id]            # Supprime un document
/doc info [id]              # Détails d'un document
```

### Questions sur Documents
```
/doc query [votre question]
```
L'IA répond en se basant sur vos documents

### Limites
- 10MB par fichier
- 10 documents maximum par utilisateur
- Formats: PDF, DOCX, XLSX, TXT, CSV

## 5. Architecture Technique

### Services Créés

1. **voice.service.ts**
   - Téléchargement des médias vocaux
   - Transcription avec Whisper
   - Traitement asynchrone

2. **message-formatter.service.ts**
   - Division intelligente des messages
   - Calcul des délais de frappe
   - Respect de la ponctuation

3. **admin-messaging.service.ts**
   - Gestion des modes d'envoi
   - Messages programmés
   - Audit et logging

4. **document.service.ts**
   - Stockage Appwrite
   - Gestion des quotas
   - Métadonnées

5. **document-parser.service.ts**
   - Extraction de texte multi-format
   - Chunking pour RAG
   - Extraction d'informations clés

## 6. Configuration Environnement

### Variables Requises (.env)
```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Appwrite
APPWRITE_ENDPOINT=https://...
APPWRITE_PROJECT_ID=...
APPWRITE_API_KEY=...

# WhatsApp
SESSION_NAME=jarvis-bot-nourx
```

## 7. Commandes de Maintenance

### Vérification Santé
```bash
./bot-manager.sh status      # État du bot
tail -f bot.log             # Logs en temps réel
npm run typecheck           # Vérification types
```

### Redémarrage Propre
```bash
./bot-manager.sh restart
```

### Nettoyage
```bash
./bot-manager.sh clean      # Nettoie les processus zombies
rm -rf .wwebjs_auth/*      # Reset session WhatsApp
```

## 8. Sécurité et Bonnes Pratiques

1. **Authentification Admin**
   - PIN requis: `/admin auth [PIN]`
   - Session expire après 15 minutes
   - Audit de toutes les actions

2. **Rate Limiting**
   - Délai entre messages broadcast
   - Protection contre spam vocal
   - Quotas documents par utilisateur

3. **Privacy**
   - Messages vocaux supprimés après traitement
   - Documents isolés par utilisateur
   - Logs anonymisés

## 9. Troubleshooting

### "wid error"
- Vérifier format numéro: 225XXXXXXXXXX
- Pas de @, +, ou espaces
- Contact doit exister sur WhatsApp

### Messages non chunked
- Vérifier que l'utilisateur n'est pas admin
- Vérifier configuration dans interaction.config.ts

### Voice non traité
- Vérifier taille < 10MB
- Vérifier clé OpenAI valide
- Consulter logs pour erreurs Whisper

### Documents non parsés
- Vérifier format supporté
- Vérifier espace Appwrite disponible
- Tester avec fichier simple d'abord