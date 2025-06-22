import { ChatOpenAI } from '@langchain/openai';
import { openAIConfig } from '../config/openai.config';
import { logger } from '../utils/logger';
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';

export class AIService {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: openAIConfig.apiKey,
      modelName: openAIConfig.modelName,
      temperature: openAIConfig.temperature,
      maxTokens: openAIConfig.maxTokens,
    });
  }


  async processMessage(_conversationId: string, _message: string, history?: BaseMessage[]): Promise<string> {
    try {
      const messages: BaseMessage[] = [];
      
      // Add system message for context
      messages.push(new SystemMessage(
        "Tu es Jarvis, l'assistant de projet intelligent de Nourx, société ivoirienne de services numériques et d'intelligence artificielle basée à Abidjan. " +
        "IDENTITÉ : Tu es amical, professionnel, concis et disponible 24h/24. Tu parles français et anglais selon la langue de ton interlocuteur. " +
        "Tu annonces que tu es une IA dès la première interaction pour respecter la transparence. " +
        "\n\nCAPACITÉS : 1) Suivi de projet (jalons, livrables, risques), 2) Création et suivi de tickets support, " +
        "3) Programmation de rappels et relances, 4) Escalade vers un humain si nécessaire. " +
        "\n\nCONTEXTE NOURX : Expertise en chatbots IA multicanaux, automatisation des processus métier (n8n, Odoo), " +
        "développement web/mobile (Next.js, Laravel, Flutter), cloud computing souverain, signature électronique conforme UEMOA. " +
        "Mission : démocratiser l'IA en Afrique de l'Ouest. Vision : devenir le partenaire de référence pour la transformation numérique. " +
        "\n\nSTYLE : Messages ≤ 150 mots sauf si détails demandés. Structure : salutation personnalisée, réponse concise, prochaine étape, clôture. " +
        "Langage clair sans jargon superflu. Ton empathique mais neutre. " +
        "\n\nLIMITES : Refuse poliment conseils juridiques/médicaux/financiers. Pour demandes hors périmètre, propose de créer un ticket ou contacter l'équipe concernée. " +
        "Base-toi uniquement sur les données validées, jamais d'invention."
      ));
      
      // Add conversation history
      if (history && history.length > 0) {
        messages.push(...history);
      }
      
      logger.info(`AI Service: Processing with ${messages.length} messages total (${history?.length || 0} from history)`);
      
      if (history && history.length > 0) {
        logger.info('Last 3 messages from history:');
        history.slice(-3).forEach((msg) => {
          const role = msg instanceof HumanMessage ? 'Human' : 'AI';
          logger.info(`  [${role}]: ${msg.content.toString().substring(0, 50)}...`);
        });
      }
      
      const response = await this.model.invoke(messages);
      
      return response.content.toString();
    } catch (error) {
      logger.error('Error processing message with AI:', error);
      throw error;
    }
  }

  convertHistoryToMessages(history: Array<{ role: string; content: string }>): BaseMessage[] {
    return history.map((msg) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });
  }

  clearConversation(conversationId: string): void {
    // No longer needed as we don't store conversations
    logger.info(`Conversation ${conversationId} cleared`);
  }

  clearAllConversations(): void {
    // No longer needed as we don't store conversations
    logger.info('All conversations cleared');
  }
}

export const aiService = new AIService();