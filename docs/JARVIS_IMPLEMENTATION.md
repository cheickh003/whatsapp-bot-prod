# Jarvis - Assistant Intelligent Nourx

## Vue d'ensemble

Jarvis est l'assistant de projet intelligent de Nourx, intégré dans WhatsApp pour offrir un support 24h/24 aux clients. Il combine des capacités d'IA conversationnelle avec des fonctionnalités de gestion de projet, de ticketing et de rappels.

## Contexte et Personnalité

### Identité
- **Nom**: Jarvis
- **Rôle**: Assistant de projet intelligent
- **Entreprise**: Nourx - Société ivoirienne de services numériques et d'IA
- **Langues**: Français (principal) et Anglais
- **Disponibilité**: 24h/24, 7j/7

### Traits de personnalité
- Amical et professionnel
- Concis (réponses ≤ 150 mots)
- Transparent (annonce qu'il est une IA)
- Proactif et fiable
- Ton empathique mais neutre

### Capacités principales
1. **Suivi de projet**: Gestion des jalons, livrables et risques
2. **Tickets support**: Création et suivi des demandes d'assistance
3. **Rappels**: Programmation de notifications et relances
4. **Escalade humaine**: Transfert vers un agent si nécessaire

## Architecture technique

### Services implémentés

#### 1. Service de Tickets (`ticket.service.ts`)
- Création de tickets avec numérotation automatique
- Suivi par statut et priorité
- Système de commentaires
- Escalade automatique pour urgences
- Collections Appwrite: `tickets`, `ticket_comments`

#### 2. Service de Projets (`project.service.ts`)
- Gestion complète du cycle de vie des projets
- Jalons (milestones) avec dates d'échéance
- Calcul automatique de progression
- Génération de résumés de projet
- Collections: `projects`, `milestones`, `tasks`

#### 3. Service de Rappels (`reminder.service.ts`)
- Rappels ponctuels ou récurrents
- Parser intelligent pour les dates relatives
- Notifications WhatsApp automatiques
- Vérification toutes les minutes
- Collection: `reminders`

### Commandes disponibles

```
/help - Afficher l'aide
/ticket [description] - Créer un ticket support
/tickets - Voir vos tickets
/project [nom] - Créer un projet
/projects - Voir vos projets
/remind [temps] [message] - Créer un rappel
/reminders - Voir vos rappels
/human - Demander assistance humaine
/clear - Effacer l'historique
/info - Informations conversation
```

### Configuration (`jarvis.config.ts`)

```typescript
export const jarvisConfig = {
  company: {
    name: 'Nourx',
    location: 'Abidjan, Côte d\'Ivoire'
  },
  personality: {
    name: 'Jarvis',
    languages: ['fr', 'en'],
    defaultLanguage: 'fr'
  },
  response: {
    maxLength: 150
  },
  businessHours: {
    weekdays: '08:00-18:00',
    saturday: '09:00-13:00'
  },
  rateLimits: {
    messagesPerDay: 100,
    ticketsPerDay: 5
  }
}
```

## Intégration dans le bot existant

### 1. Mise à jour du prompt système
Le prompt dans `ai.service.ts` a été enrichi avec :
- Contexte complet de Nourx
- Capacités spécifiques de Jarvis
- Directives de style et limites
- Expertise de Nourx en IA, automatisation, cloud

### 2. Commandes Jarvis
Le `command.handler.ts` intègre toutes les nouvelles commandes avec :
- Messages bilingues FR/EN
- Formatage professionnel
- Gestion d'erreurs gracieuse
- Intégration avec les services

### 3. Initialisation des services
Dans `index.ts`, les services Jarvis sont initialisés après l'admin :
```typescript
await ticketService.initialize();
await projectService.initialize();
await reminderService.initialize();
```

## Exemples d'utilisation

### Création de ticket
```
User: /ticket Mon chatbot ne répond plus depuis ce matin
Jarvis: *Ticket #24120847 - Support Request*
━━━━━━━━━━━━━━
🟡 Statut: Ouvert
➡️ Priorité: Moyenne
📅 Créé le: 22/06/2025

📝 Description:
Mon chatbot ne répond plus depuis ce matin

✅ Votre demande a été enregistrée.
📱 Un membre de l'équipe vous contactera bientôt.
```

### Création de projet
```
User: /project Refonte site web e-commerce
Jarvis: ✅ *Projet créé avec succès!*
━━━━━━━━━━━━━━
📁 Nom: Refonte site web e-commerce
🆔 ID: proj_xyz123
🚦 Statut: Planification

Je peux vous aider à définir les jalons de ce projet.
```

### Programmation de rappel
```
User: /remind 2h Appeler le client Amadou
Jarvis: ✅ *Rappel*
━━━━━━━━━━━━━━
📝 Appeler le client Amadou
⏰ Prévu: 22/06/2025 14:30

✅ Je vous enverrai un rappel sur WhatsApp!
```

## Sécurité et conformité

### Protection des données
- Chiffrement TLS 1.3 pour toutes les communications
- Hébergement dans infrastructure certifiée ISO 27001
- Respect du RGPD (bien que pas encore implémenté complètement)
- Politique de rétention des données

### Limites et comportement
- Refuse les conseils juridiques/médicaux/financiers
- Redirige les demandes hors périmètre
- Base ses réponses uniquement sur données validées
- Escalade automatique pour mots-clés urgents

## Maintenance et évolution

### Pour ajouter une nouvelle fonctionnalité
1. Créer un nouveau service dans `src/services/`
2. Ajouter l'initialisation dans `index.ts`
3. Créer les commandes dans `command.handler.ts`
4. Mettre à jour le prompt système si nécessaire
5. Documenter dans ce fichier

### Collections Appwrite créées
- `tickets` - Gestion des tickets support
- `ticket_comments` - Commentaires sur tickets
- `projects` - Projets clients
- `milestones` - Jalons de projets
- `tasks` - Tâches de projets
- `reminders` - Rappels programmés

### Variables d'environnement optionnelles
```
TICKETING_WEBHOOK=https://api.nourx.com/webhooks/tickets
CRM_WEBHOOK=https://api.nourx.com/webhooks/crm
ANALYTICS_WEBHOOK=https://api.nourx.com/webhooks/analytics
```

## Feuille de route

### Court terme
- [ ] Intégration avec système de ticketing externe
- [ ] Rapports hebdomadaires automatiques
- [ ] Support vocal pour rappels
- [ ] Templates de projets

### Moyen terme
- [ ] Intelligence prédictive pour projets
- [ ] Intégration CRM complète
- [ ] Tableau de bord web
- [ ] API REST pour intégrations

### Long terme
- [ ] IA conversationnelle avancée
- [ ] Automatisation complète des workflows
- [ ] Multi-canal (Telegram, Teams)
- [ ] Analytics avancés

## Support et contact

Pour toute question sur l'implémentation de Jarvis :
- Email: tech@nourx.com
- Documentation: https://docs.nourx.com/jarvis
- Support: /human dans WhatsApp