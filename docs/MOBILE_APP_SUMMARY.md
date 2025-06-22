# Application Mobile Admin - WhatsApp Bot

## Vue d'ensemble

Une application Android native pour administrer le bot WhatsApp Jarvis à distance, développée avec Kotlin et Jetpack Compose, intégrée avec Appwrite comme backend.

## Architecture

### Backend (Node.js/TypeScript)
- **Service Mobile Admin** : Gère les sessions mobiles, logs d'actions et tokens push
- **Collections Appwrite** :
  - `mobile_sessions` : Sessions actives des admins
  - `admin_actions_log` : Historique des actions admin
  - `push_tokens` : Tokens pour notifications push

### Frontend (Android/Kotlin)
- **Architecture MVVM** avec Hilt pour l'injection de dépendances
- **Jetpack Compose** pour l'UI moderne et réactive
- **Appwrite SDK** pour la communication avec le backend
- **Material Design 3** avec thème personnalisé WhatsApp

## Fonctionnalités principales

### 1. Authentification
- Login avec numéro de téléphone et PIN
- Support biométrique (empreinte digitale)
- Sessions avec expiration (15 minutes)
- Multi-device support

### 2. Dashboard
- Statistiques en temps réel
  - Utilisateurs totaux et actifs
  - Messages du jour
  - Temps de réponse moyen
  - Disponibilité du bot
- État du bot (en ligne/hors ligne)
- Redémarrage à distance
- Actions rapides

### 3. Gestion des utilisateurs
- Liste des utilisateurs actifs
- Blocage/déblocage rapide
- Accès aux conversations
- Recherche et filtres

### 4. Messagerie admin
- Envoi de messages comme admin
- Options : badge admin, traitement IA, incognito
- Messages programmés
- Historique des messages

### 5. Monitoring
- Logs en temps réel
- Alertes d'erreur
- Métriques système
- Export des logs

### 6. Gestion des documents
- Visualisation des documents uploadés
- Suppression à distance
- Statistiques d'utilisation

## Sécurité

### Authentification
- PIN haché côté serveur
- Sessions JWT avec expiration
- Authentification biométrique locale

### Communications
- HTTPS/TLS pour toutes les connexions
- Certificate pinning (optionnel)
- Validation des entrées

### Stockage local
- Android Keystore pour données sensibles
- Chiffrement des préférences
- Pas de cache des données sensibles

## Installation

### Prérequis
1. Android Studio Arctic Fox+
2. SDK Android 24+ (Android 7.0)
3. Serveur Appwrite configuré

### Configuration
1. Mettre à jour `AppwriteConfig.kt` :
   ```kotlin
   const val ENDPOINT = "http://VOTRE_IP:80/v1"
   const val PROJECT_ID = "votre-project-id"
   ```

2. Build debug :
   ```bash
   ./gradlew assembleDebug
   ```

3. Installation :
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

## Utilisation

### Premier lancement
1. Entrez votre numéro admin (format : 225XXXXXXXXXX)
2. Entrez votre PIN admin
3. Activez la biométrie si souhaité

### Navigation
- **Dashboard** : Vue d'ensemble et actions rapides
- **Utilisateurs** : Gestion des utilisateurs du bot
- **Messages** : Envoi de messages admin
- **Logs** : Monitoring en temps réel
- **Documents** : Gestion des fichiers
- **Paramètres** : Configuration de l'app

## Développement futur

### Phase 2
- Notifications push via Firebase
- Mode hors ligne avec synchronisation
- Graphiques et analytics avancés
- Export de rapports

### Phase 3
- Widgets Android pour stats rapides
- Support iOS (Swift/SwiftUI)
- Interface web admin
- API publique pour intégrations

## Structure du projet

```
mobile-admin-app/
├── app/src/main/java/com/nourx/botadmin/
│   ├── data/              # Modèles et repositories
│   │   ├── models/        # Classes de données
│   │   ├── remote/        # Client Appwrite
│   │   └── repositories/  # Logique d'accès aux données
│   ├── presentation/      # UI et ViewModels
│   │   ├── screens/       # Écrans Compose
│   │   ├── navigation/    # Navigation
│   │   └── theme/         # Thème Material 3
│   ├── di/                # Modules Hilt
│   └── core/              # Utils et config
├── build.gradle.kts       # Configuration Gradle
└── DEPLOYMENT_GUIDE.md    # Guide de déploiement

backend/
└── src/services/mobile-admin.service.ts  # Service backend
```

## Support et maintenance

- Logs backend : `./bot-manager.sh logs`
- Logs Android : `adb logcat | grep BotAdmin`
- Console Appwrite : http://VOTRE_IP/console

## License

Propriétaire - Nourx Digital Services