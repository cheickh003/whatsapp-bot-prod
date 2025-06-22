export interface Project {
  $id: string;
  name: string;
  description: string;
  phoneNumber: string;
  userId?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  progress: number; // 0-100
  milestones: Milestone[];
  team: string[];
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  budget?: number;
  client?: string;
}

export interface Milestone {
  $id: string;
  projectId: string;
  name: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  completedAt?: string;
  assignedTo?: string[];
  dependencies?: string[];
}

export interface Task {
  $id: string;
  projectId: string;
  milestoneId?: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  createdAt: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
}