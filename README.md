# WhatsApp Bot Jarvis 🤖

Bot WhatsApp intelligent utilisant Claude AI pour Nourx - Société ivoirienne de services numériques et d'intelligence artificielle.

## 🌟 Fonctionnalités

### 💬 Conversations Intelligentes
- Intégration avec Claude 3.5 Sonnet
- Mémoire contextuelle des conversations
- Support multilingue (Français/Anglais)
- Réponses personnalisées selon l'heure et le contexte

### 📊 Administration Avancée
- Système d'authentification sécurisé par PIN
- Dashboard avec statistiques en temps réel
- Rapports quotidiens automatiques (18h00 GMT)
- Gestion des utilisateurs et permissions
- Audit complet des actions

### 🎯 Gestion de Projets
- Création et suivi de projets
- Jalons et tâches
- Suivi de progression
- Rappels automatiques

### 🎫 Système de Tickets
- Support technique intégré
- Priorités et escalade automatique
- Historique des conversations
- Résolution collaborative

### 📄 Analyse de Documents
- Support PDF, images, Word, Excel
- Extraction de texte intelligent
- Résumés automatiques
- Q&A sur documents

### ⏰ Rappels et Notifications
- Rappels ponctuels et récurrents
- Notifications programmées
- Messages admin planifiés
- Fuseau horaire Abidjan (GMT+0)

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm ou yarn
- Compte Appwrite Cloud
- Clé API Claude (Anthropic)
- Numéro WhatsApp Business

### Configuration

1. **Cloner le repository**
```bash
git clone https://github.com/cheickh003/whatsapp-bot-prod.git
cd whatsapp-bot-prod
npm install
```

2. **Configuration des variables d'environnement**
```bash
cp config/.env.example config/.env
# Éditer config/.env avec vos clés API
```

3. **Compilation**
```bash
npm run build
```

## 🎮 Utilisation

### Démarrage du bot
```bash
./scripts/bot start    # Démarrer le bot
./scripts/bot status   # Vérifier le statut
./scripts/bot logs     # Voir les logs
./scripts/bot stop     # Arrêter le bot
```

### Commandes principales
- `/help` - Afficher l'aide
- `/ticket [description]` - Créer un ticket
- `/project [nom]` - Créer un projet
- `/remind [temps] [message]` - Créer un rappel
- `/doc` - Gérer les documents

### Commandes admin
- `/admin auth [PIN]` - S'authentifier
- `/admin help` - Voir toutes les commandes admin
- `/admin report` - Générer un rapport instantané
- `/admin stats` - Voir les statistiques

## 🏗️ Architecture

```
├── src/               # Code source TypeScript
│   ├── config/       # Configuration
│   ├── handlers/     # Gestionnaires de messages
│   ├── services/     # Services métier
│   ├── models/       # Modèles de données
│   └── utils/        # Utilitaires
├── scripts/          # Scripts de gestion
├── docs/             # Documentation
└── config/           # Fichiers de configuration
```

## 🔧 Technologies

- **Backend**: Node.js, TypeScript
- **AI**: Claude 3.5 Sonnet (Anthropic)
- **Database**: Appwrite Cloud
- **WhatsApp**: whatsapp-web.js
- **Logging**: Winston
- **Date/Time**: date-fns avec support GMT+0

## 📈 Monitoring

Le bot génère automatiquement des rapports quotidiens incluant :
- Nombre de messages traités
- Utilisateurs actifs
- Tickets résolus
- Projets en cours
- Performance du système

## 🔒 Sécurité

- Authentification par PIN hashé
- Sessions avec expiration
- Audit de toutes les actions admin
- Chiffrement des données sensibles
- Rate limiting

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez :
1. Fork le projet
2. Créer une branche feature
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 👥 Support

Pour toute question ou problème :
- Email: support@nourx.com
- WhatsApp: +225 07 03 07 94 10

---

Développé avec ❤️ par [Nourx](https://nourx.com) - Abidjan, Côte d'Ivoire