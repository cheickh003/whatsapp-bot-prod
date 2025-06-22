import { documentService } from './document.service';
import { logger } from '../utils/logger';
import { openAIConfig } from '../config/openai.config';
import { OpenAI } from 'openai';

export class SimpleDocumentQAService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: openAIConfig.apiKey
    });
  }

  async searchDocuments(userId: string, searchQuery: string): Promise<string> {
    try {
      const documents = await documentService.getUserDocuments(userId);
      
      if (documents.length === 0) {
        return "Vous n'avez aucun document. Envoyez-moi un PDF pour commencer!";
      }

      let allDocumentText = '';
      const documentMap: { [key: string]: string } = {};
      
      for (const doc of documents) {
        if (doc.extractedText) {
          documentMap[doc.fileName] = doc.extractedText;
          allDocumentText += `\n\n📄 Document: ${doc.fileName}\n${doc.extractedText}\n`;
        }
      }

      if (!allDocumentText) {
        return "Vos documents n'ont pas encore de texte extrait. Réessayez dans quelques secondes.";
      }

      const systemPrompt = `Tu es Jarvis, l'assistant de Nourx. Tu dois rechercher dans les documents fournis et trouver toutes les informations pertinentes concernant la requête de recherche. 
      
      Instructions:
      1. Recherche toutes les mentions et informations liées à la requête
      2. Cite le nom du document où l'information a été trouvée
      3. Présente les résultats de manière organisée
      4. Si aucune information n'est trouvée, dis-le clairement`;
      
      const userPrompt = `Voici le contenu des documents:

${allDocumentText}

Requête de recherche: ${searchQuery}

Trouve et présente toutes les informations pertinentes à cette recherche dans les documents.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 700
      });
      
      return completion.choices[0]?.message?.content || "Je n'ai pas pu effectuer la recherche.";
    } catch (error) {
      logger.error('Error searching documents:', error);
      return "Désolé, une erreur s'est produite lors de la recherche.";
    }
  }

  async summarizeAllDocuments(userId: string): Promise<string> {
    try {
      const documents = await documentService.getUserDocuments(userId);
      
      if (documents.length === 0) {
        return "Vous n'avez aucun document. Envoyez-moi un PDF pour commencer!";
      }

      let documentSummaries = '';
      
      for (const doc of documents) {
        if (doc.extractedText) {
          const preview = doc.extractedText.substring(0, 200);
          documentSummaries += `\n📄 **${doc.fileName}**\n   ${preview}...\n`;
        }
      }

      if (!documentSummaries) {
        return "Vos documents n'ont pas encore de texte extrait. Réessayez dans quelques secondes.";
      }

      const systemPrompt = `Tu es Jarvis, l'assistant de Nourx. Tu dois créer un résumé global de tous les documents disponibles. Sois concis mais informatif.`;
      
      const userPrompt = `Voici la liste des documents et leur contenu:

${documentSummaries}

Crée un résumé global qui présente:
1. Le nombre de documents
2. Les thèmes principaux abordés
3. Les points clés de chaque document
4. Comment ces documents sont liés entre eux (si applicable)`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 600
      });
      
      return completion.choices[0]?.message?.content || "Je n'ai pas pu créer le résumé.";
    } catch (error) {
      logger.error('Error summarizing documents:', error);
      return "Désolé, une erreur s'est produite lors de la création du résumé.";
    }
  }

  async answerQuestion(userId: string, question: string): Promise<string> {
    try {
      // Récupérer tous les documents de l'utilisateur
      const documents = await documentService.getUserDocuments(userId);
      
      if (documents.length === 0) {
        return "Vous n'avez aucun document. Envoyez-moi un PDF pour commencer!";
      }

      // Collecter tout le texte des documents
      let allDocumentText = '';
      for (const doc of documents) {
        if (doc.extractedText) {
          allDocumentText += `\n\n📄 Document: ${doc.fileName}\n${doc.extractedText}\n`;
        }
      }

      if (!allDocumentText) {
        return "Vos documents n'ont pas encore de texte extrait. Réessayez dans quelques secondes.";
      }

      // Créer un prompt simple pour l'IA
      const systemPrompt = `Tu es Jarvis, l'assistant de Nourx. Tu dois analyser les documents fournis et répondre aux questions en te basant UNIQUEMENT sur leur contenu. Réponds en français de manière claire et concise.`;
      
      const userPrompt = `Voici le contenu des documents:

${allDocumentText}

Question: ${question}

Réponds en te basant uniquement sur le contenu des documents ci-dessus.`;

      // Utiliser OpenAI directement
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      
      return completion.choices[0]?.message?.content || "Je n'ai pas pu analyser les documents.";
    } catch (error) {
      logger.error('Error answering document question:', error);
      return "Désolé, une erreur s'est produite lors de l'analyse des documents.";
    }
  }
}

export const simpleDocumentQAService = new SimpleDocumentQAService();