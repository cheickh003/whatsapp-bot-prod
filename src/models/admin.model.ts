export interface Admin {
  $id?: string;
  phoneNumber: string;
  pin: string; // Hashed
  name: string;
  createdAt: string;
  lastAuth?: string;
  sessionExpiry?: string;
}

export interface AdminSession {
  phoneNumber: string;
  authenticated: boolean;
  expiresAt: Date;
}

export interface BlacklistEntry {
  $id?: string;
  phoneNumber: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
}

export interface UserLimit {
  $id?: string;
  phoneNumber: string;
  dailyLimit: number;
  messagesUsed: number;
  resetAt: string;
}

export interface BotConfig {
  $id?: string;
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string;
}

export enum BotMode {
  NORMAL = 'normal',
  MAINTENANCE = 'maintenance',
  READONLY = 'readonly'
}

export interface SystemStatus {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  activeUsers: number;
  messagesLast24h: number;
  connections: {
    appwrite: { status: boolean; latency: number };
    openai: { status: boolean; latency: number };
    whatsapp: { status: boolean };
  };
  mode: BotMode;
}

export interface UserStats {
  phoneNumber: string;
  name?: string;
  totalMessages: number;
  lastActivity: string;
  tokensUsed: number;
  estimatedCost: number;
}

export interface BackupData {
  conversations: any[];
  messages: any[];
  admins: any[];
  blacklist: any[];
  config: any[];
  timestamp: string;
}

export interface AdminAuditLog {
  $id?: string;
  adminPhone: string;
  command: string;
  parameters: string;
  timestamp: string;
  success: boolean;
  error?: string;
}