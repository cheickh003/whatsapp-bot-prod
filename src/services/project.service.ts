import { appwriteService } from './appwrite.service';
import { logger } from '../utils/logger';
import { ID } from 'node-appwrite';

interface Project {
  id: string;
  phoneNumber: string;
  name: string;
  description: string;
  status: 'planning' | 'in_progress' | 'testing' | 'completed' | 'on_hold';
  startDate: string;
  endDate?: string;
  progress: number; // 0-100
  createdAt: string;
  updatedAt: string;
}

interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  completedAt?: string;
  createdAt: string;
}


export class ProjectService {
  private readonly PROJECTS_COLLECTION_ID = 'projects';
  private readonly MILESTONES_COLLECTION_ID = 'milestones';
  private readonly TASKS_COLLECTION_ID = 'tasks';

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing project service...');
      
      // Create projects collection
      await appwriteService.createCollection(this.PROJECTS_COLLECTION_ID, 'Projects');
      await appwriteService.createStringAttribute(this.PROJECTS_COLLECTION_ID, 'phoneNumber', 50, true);
      await appwriteService.createStringAttribute(this.PROJECTS_COLLECTION_ID, 'name', 200, true);
      await appwriteService.createStringAttribute(this.PROJECTS_COLLECTION_ID, 'description', 2000, true);
      await appwriteService.createStringAttribute(this.PROJECTS_COLLECTION_ID, 'status', 20, true);
      await appwriteService.createDatetimeAttribute(this.PROJECTS_COLLECTION_ID, 'startDate', true);
      await appwriteService.createDatetimeAttribute(this.PROJECTS_COLLECTION_ID, 'endDate', false);
      await appwriteService.createIntegerAttribute(this.PROJECTS_COLLECTION_ID, 'progress', true, 0, 100);
      await appwriteService.createDatetimeAttribute(this.PROJECTS_COLLECTION_ID, 'createdAt', true);
      await appwriteService.createDatetimeAttribute(this.PROJECTS_COLLECTION_ID, 'updatedAt', true);

      // Create milestones collection
      await appwriteService.createCollection(this.MILESTONES_COLLECTION_ID, 'Milestones');
      await appwriteService.createStringAttribute(this.MILESTONES_COLLECTION_ID, 'projectId', 50, true);
      await appwriteService.createStringAttribute(this.MILESTONES_COLLECTION_ID, 'name', 200, true);
      await appwriteService.createStringAttribute(this.MILESTONES_COLLECTION_ID, 'description', 1000, true);
      await appwriteService.createDatetimeAttribute(this.MILESTONES_COLLECTION_ID, 'dueDate', true);
      await appwriteService.createStringAttribute(this.MILESTONES_COLLECTION_ID, 'status', 20, true);
      await appwriteService.createDatetimeAttribute(this.MILESTONES_COLLECTION_ID, 'completedAt', false);
      await appwriteService.createDatetimeAttribute(this.MILESTONES_COLLECTION_ID, 'createdAt', true);

      // Create tasks collection
      await appwriteService.createCollection(this.TASKS_COLLECTION_ID, 'Tasks');
      await appwriteService.createStringAttribute(this.TASKS_COLLECTION_ID, 'milestoneId', 50, true);
      await appwriteService.createStringAttribute(this.TASKS_COLLECTION_ID, 'projectId', 50, true);
      await appwriteService.createStringAttribute(this.TASKS_COLLECTION_ID, 'name', 200, true);
      await appwriteService.createStringAttribute(this.TASKS_COLLECTION_ID, 'status', 20, true);
      await appwriteService.createStringAttribute(this.TASKS_COLLECTION_ID, 'assignedTo', 100, false);
      await appwriteService.createDatetimeAttribute(this.TASKS_COLLECTION_ID, 'createdAt', true);
      await appwriteService.createDatetimeAttribute(this.TASKS_COLLECTION_ID, 'completedAt', false);

      logger.info('Project service initialized successfully');
    } catch (error) {
      logger.error('Error initializing project service:', error);
      throw error;
    }
  }

  async createProject(
    phoneNumber: string,
    name: string,
    description: string,
    startDate: Date = new Date()
  ): Promise<Project> {
    try {
      const now = new Date().toISOString();
      
      const project = await appwriteService.createDocument(this.PROJECTS_COLLECTION_ID, ID.unique(), {
        phoneNumber,
        name,
        description,
        status: 'planning',
        startDate: startDate.toISOString(),
        progress: 0,
        createdAt: now,
        updatedAt: now
      });

      logger.info(`Project created: ${project.$id} for ${phoneNumber}`);
      return this.mapToProject(project);
    } catch (error) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  async getUserProjects(phoneNumber: string, activeOnly: boolean = true): Promise<Project[]> {
    try {
      const queries = [`phoneNumber="${phoneNumber}"`];
      if (activeOnly) {
        queries.push(`status!="completed"`);
      }
      
      const documents = await appwriteService.listDocuments(
        this.PROJECTS_COLLECTION_ID,
        queries,
        25,
        0,
        ['createdAt'],
        ['DESC']
      );

      return documents.documents.map((doc: any) => this.mapToProject(doc));
    } catch (error) {
      logger.error('Error getting user projects:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      const document = await appwriteService.getDocument(this.PROJECTS_COLLECTION_ID, projectId);
      return document ? this.mapToProject(document) : null;
    } catch (error) {
      logger.error('Error getting project:', error);
      return null;
    }
  }

  async updateProjectStatus(
    projectId: string, 
    status: 'planning' | 'in_progress' | 'testing' | 'completed' | 'on_hold'
  ): Promise<Project | null> {
    try {
      const updates: any = {
        status,
        updatedAt: new Date().toISOString()
      };

      if (status === 'completed') {
        updates.endDate = new Date().toISOString();
        updates.progress = 100;
      }

      const updated = await appwriteService.updateDocument(this.PROJECTS_COLLECTION_ID, projectId, updates);
      logger.info(`Project ${projectId} status updated to ${status}`);
      return this.mapToProject(updated);
    } catch (error) {
      logger.error('Error updating project status:', error);
      return null;
    }
  }

  async updateProjectProgress(projectId: string, progress: number): Promise<Project | null> {
    try {
      const updated = await appwriteService.updateDocument(this.PROJECTS_COLLECTION_ID, projectId, {
        progress: Math.min(100, Math.max(0, progress)),
        updatedAt: new Date().toISOString()
      });

      logger.info(`Project ${projectId} progress updated to ${progress}%`);
      return this.mapToProject(updated);
    } catch (error) {
      logger.error('Error updating project progress:', error);
      return null;
    }
  }

  async createMilestone(
    projectId: string,
    name: string,
    description: string,
    dueDate: Date
  ): Promise<Milestone> {
    try {
      const milestone = await appwriteService.createDocument(this.MILESTONES_COLLECTION_ID, ID.unique(), {
        projectId,
        name,
        description,
        dueDate: dueDate.toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      logger.info(`Milestone created: ${milestone.$id} for project ${projectId}`);
      return this.mapToMilestone(milestone);
    } catch (error) {
      logger.error('Error creating milestone:', error);
      throw error;
    }
  }

  async getProjectMilestones(projectId: string): Promise<Milestone[]> {
    try {
      const documents = await appwriteService.listDocuments(
        this.MILESTONES_COLLECTION_ID,
        [`projectId="${projectId}"`],
        25,
        0,
        ['dueDate'],
        ['ASC']
      );

      return documents.documents.map((doc: any) => this.mapToMilestone(doc));
    } catch (error) {
      logger.error('Error getting project milestones:', error);
      return [];
    }
  }

  async updateMilestoneStatus(
    milestoneId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'delayed'
  ): Promise<Milestone | null> {
    try {
      const updates: any = { status };
      if (status === 'completed') {
        updates.completedAt = new Date().toISOString();
      }

      const updated = await appwriteService.updateDocument(this.MILESTONES_COLLECTION_ID, milestoneId, updates);
      logger.info(`Milestone ${milestoneId} status updated to ${status}`);
      
      // Update project progress based on completed milestones
      await this.recalculateProjectProgress(updated.projectId);
      
      return this.mapToMilestone(updated);
    } catch (error) {
      logger.error('Error updating milestone status:', error);
      return null;
    }
  }

  private async recalculateProjectProgress(projectId: string): Promise<void> {
    try {
      const milestones = await this.getProjectMilestones(projectId);
      if (milestones.length === 0) return;

      const completedCount = milestones.filter(m => m.status === 'completed').length;
      const progress = Math.round((completedCount / milestones.length) * 100);

      await this.updateProjectProgress(projectId, progress);
    } catch (error) {
      logger.error('Error recalculating project progress:', error);
    }
  }

  async generateProjectSummary(project: Project): Promise<string> {
    const milestones = await this.getProjectMilestones(project.id);
    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    const delayedMilestones = milestones.filter(m => m.status === 'delayed').length;
    
    const progressBar = this.generateProgressBar(project.progress);
    
    return `📊 *Projet: ${project.name}*\n` +
           `━━━━━━━━━━━━━━\n` +
           `📈 Progression: ${progressBar} ${project.progress}%\n` +
           `🚦 Statut: ${this.translateProjectStatus(project.status)}\n` +
           `📅 Démarré: ${new Date(project.startDate).toLocaleDateString('fr-FR')}\n` +
           `${project.endDate ? `✅ Terminé: ${new Date(project.endDate).toLocaleDateString('fr-FR')}\n` : ''}\n` +
           `*Jalons:*\n` +
           `✅ Complétés: ${completedMilestones}/${milestones.length}\n` +
           `${delayedMilestones > 0 ? `⚠️ En retard: ${delayedMilestones}\n` : ''}\n` +
           `📝 *Description:*\n${project.description}`;
  }

  private generateProgressBar(progress: number): string {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private translateProjectStatus(status: string): string {
    const translations: Record<string, string> = {
      'planning': '📋 Planification',
      'in_progress': '🚀 En cours',
      'testing': '🧪 En test',
      'completed': '✅ Terminé',
      'on_hold': '⏸️ En pause'
    };
    return translations[status] || status;
  }

  formatMilestoneForWhatsApp(milestone: Milestone): string {
    const statusEmoji = {
      'pending': '⏳',
      'in_progress': '🔄',
      'completed': '✅',
      'delayed': '⚠️'
    };

    return `${statusEmoji[milestone.status]} *${milestone.name}*\n` +
           `📅 Échéance: ${new Date(milestone.dueDate).toLocaleDateString('fr-FR')}\n` +
           `${milestone.completedAt ? `✓ Complété: ${new Date(milestone.completedAt).toLocaleDateString('fr-FR')}\n` : ''}` +
           `📝 ${milestone.description}`;
  }

  private mapToProject(document: any): Project {
    return {
      id: document.$id,
      phoneNumber: document.phoneNumber,
      name: document.name,
      description: document.description,
      status: document.status,
      startDate: document.startDate,
      endDate: document.endDate,
      progress: document.progress,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }

  private mapToMilestone(document: any): Milestone {
    return {
      id: document.$id,
      projectId: document.projectId,
      name: document.name,
      description: document.description,
      dueDate: document.dueDate,
      status: document.status,
      completedAt: document.completedAt,
      createdAt: document.createdAt
    };
  }
}

export const projectService = new ProjectService();