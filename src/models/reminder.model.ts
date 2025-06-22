export interface Reminder {
  $id: string;
  phoneNumber: string;
  userId?: string;
  title: string;
  description?: string;
  reminderDate: string;
  reminderTime: string;
  timezone: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customFrequency?: {
    interval: number;
    unit: 'hours' | 'days' | 'weeks' | 'months';
  };
  isActive: boolean;
  lastTriggered?: string;
  nextTrigger: string;
  createdAt: string;
  updatedAt: string;
  notificationChannels: ('whatsapp' | 'email' | 'sms')[];
  metadata?: Record<string, any>;
}

export interface ReminderNotification {
  $id: string;
  reminderId: string;
  sentAt: string;
  channel: 'whatsapp' | 'email' | 'sms';
  status: 'pending' | 'sent' | 'failed';
  errorMessage?: string;
  retryCount: number;
}