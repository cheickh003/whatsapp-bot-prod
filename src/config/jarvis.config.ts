export const jarvisConfig = {
  // Company information
  company: {
    name: 'Nourx',
    tagline: 'Société ivoirienne de services numériques et d\'intelligence artificielle',
    location: 'Abidjan, Côte d\'Ivoire',
    website: 'https://nourx.com',
    email: 'contact@nourx.com',
    phone: '+225 07 00 00 00 00'
  },

  // Bot personality
  personality: {
    name: 'Jarvis',
    role: 'Assistant de projet intelligent',
    traits: [
      'Amical',
      'Professionnel', 
      'Concis',
      'Disponible 24h/24',
      'Transparent',
      'Proactif',
      'Fiable'
    ],
    languages: ['fr', 'en'],
    defaultLanguage: 'fr'
  },

  // Response configuration
  response: {
    maxLength: 150, // words
    structure: {
      greeting: true,
      conciseAnswer: true,
      nextStep: true,
      closing: true
    },
    tone: 'empathique mais neutre',
    style: 'clair sans jargon technique superflu'
  },

  // Business hours (GMT)
  businessHours: {
    timezone: 'Africa/Abidjan',
    weekdays: {
      start: '08:00',
      end: '18:00'
    },
    weekends: {
      saturday: {
        start: '09:00',
        end: '13:00'
      },
      sunday: null // Closed
    }
  },

  // Feature flags
  features: {
    ticketing: true,
    projects: true,
    reminders: true,
    humanEscalation: true,
    gdprCompliance: true,
    multiLanguage: true
  },

  // Rate limiting
  rateLimits: {
    messagesPerDay: 100,
    ticketsPerDay: 5,
    remindersPerDay: 10,
    projectsPerMonth: 20
  },

  // Escalation settings
  escalation: {
    keywords: [
      'urgence',
      'urgent',
      'problème grave',
      'erreur critique',
      'ne fonctionne plus',
      'bloqué',
      'help',
      'aide urgente'
    ],
    autoEscalateAfterMinutes: 30
  },

  // Integration endpoints
  integrations: {
    ticketing: process.env.TICKETING_WEBHOOK || null,
    crm: process.env.CRM_WEBHOOK || null,
    analytics: process.env.ANALYTICS_WEBHOOK || null
  }
};