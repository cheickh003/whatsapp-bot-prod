# Bot WhatsApp Jarvis

Bot WhatsApp intelligent utilisant Claude 3.5 Sonnet et Appwrite Cloud pour la persistance des données.

## 🚀 Fonctionnalités

- 💬 Conversations naturelles avec Claude 3.5 Sonnet
- 📚 Mémoire contextuelle des conversations
- 📄 Analyse de documents (PDF, images, etc.)
- 📊 Génération de rapports et documents
- 🔐 Système d'administration sécurisé
- 📝 Gestion de projets et tâches
- ⏰ Système de rappels
- 🎫 Support technique avec tickets

## 📁 Structure du projet

```
bot-whatsapp/
├── src/                   # Code source du bot
│   ├── handlers/         # Gestionnaires de messages
│   ├── services/         # Services (AI, Appwrite, etc.)
│   ├── models/           # Modèles de données
│   ├── utils/            # Utilitaires
│   └── config/           # Configuration
├── dist/                  # Code compilé
├── scripts/              # Scripts utilitaires
│   ├── maintenance/      # Scripts de gestion du bot
│   ├── utilities/        # Scripts utilitaires
│   └── debug/            # Scripts de débogage
├── logs/                 # Fichiers de logs
├── config/               # Fichiers de configuration
├── docs/                 # Documentation
├── exports/              # Exports de données
└── backups/              # Sauvegardes

```

## 🛠️ Installation

1. **Prérequis**
   - Node.js 18+
   - npm ou yarn
   - Compte Appwrite Cloud
   - Clé API Claude (Anthropic)

2. **Installation**
   ```bash
   npm install
   ```

3. **Configuration**
   - Copier `config/.env.example` vers `config/.env`
   - Configurer les variables d'environnement

## ⚙️ Configuration

Variables d'environnement requises dans `config/.env`:

```env
# Appwrite
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
DATABASE_ID=whatsapp_chatbot_db

# Claude AI
CLAUDE_API_KEY=your_claude_api_key

# Admin
ADMIN_NUMBER=your_phone_number
```

## 🚀 Démarrage

### Utiliser le gestionnaire de bot (recommandé)

```bash
# Démarrer le bot
./scripts/maintenance/bot-manager.sh start

# Arrêter le bot
./scripts/maintenance/bot-manager.sh stop

# Redémarrer le bot
./scripts/maintenance/bot-manager.sh restart

# Voir le statut
./scripts/maintenance/bot-manager.sh status

# Voir les logs en temps réel
./scripts/maintenance/bot-manager.sh logs
```

### Démarrage manuel

```bash
# Compilation
npm run build

# Démarrage
npm start
```

## 📱 Utilisation

### Commandes principales

- `/help` - Afficher l'aide
- `/project` - Gérer les projets
- `/reminder` - Créer des rappels
- `/clear` - Effacer l'historique
- `/export` - Exporter la conversation

### Administration

Les administrateurs peuvent utiliser des commandes supplémentaires :
- Gestion des utilisateurs
- Configuration du bot
- Accès aux statistiques

## 🔧 Scripts utilitaires

### Maintenance
- `bot-manager.sh` - Gestionnaire principal du bot
- `start.sh` - Démarrer le bot
- `stop.sh` - Arrêter le bot
- `status.sh` - Vérifier le statut

### Debug
- `monitor-logs.sh` - Surveiller les logs
- `debug-logs.sh` - Analyser les erreurs

### Utilitaires
- `clean-db.sh` - Nettoyer la base de données
- `check-all-conversations.js` - Vérifier les conversations

## 📊 Monitoring

Les logs sont stockés dans le dossier `logs/`:
- `bot.log` - Log principal
- `error.log` - Erreurs uniquement
- `combined.log` - Tous les logs

## 🔒 Sécurité

- Authentification admin par numéro de téléphone
- Sessions sécurisées avec expiration
- Audit de toutes les actions admin
- Chiffrement des données sensibles

## 🐛 Dépannage

1. **Le bot ne démarre pas**
   - Vérifier les logs: `./scripts/maintenance/bot-manager.sh logs`
   - Vérifier la configuration dans `config/.env`

2. **Erreurs de connexion WhatsApp**
   - Supprimer `.wwebjs_auth` et rescanner le QR code
   - Vérifier la connexion internet

3. **Erreurs Appwrite**
   - Vérifier les clés API
   - Vérifier les permissions des collections

## 📝 Licence

Ce projet est privé et propriétaire.

## 👥 Support

Pour toute question ou problème, consultez les logs ou contactez l'administrateur.