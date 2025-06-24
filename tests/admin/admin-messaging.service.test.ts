import { adminMessagingService } from '../../src/services/admin-messaging.service';
import { adminService } from '../../src/services/admin.service';
import { whatsappService } from '../../src/services/whatsapp.service';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/services/admin.service');
jest.mock('../../src/services/whatsapp.service');
jest.mock('../../src/utils/logger');

describe('AdminMessagingService', () => {
  const mockAdminPhone = '+22579999999';
  const mockUserPhone = '+22570000000';
  const mockMessage = 'Test broadcast message';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize service successfully', async () => {
      await adminMessagingService.initialize();

      expect(logger.info).toHaveBeenCalledWith('Admin messaging service initialized');
    });
  });

  describe('broadcastToAdmins', () => {
    it('should send message to all admins', async () => {
      const mockAdmins = [
        { phoneNumber: '+22579999999', role: 'super_admin' },
        { phoneNumber: '+22570000001', role: 'admin' },
        { phoneNumber: '+22570000002', role: 'moderator' }
      ];

      (adminService.listAdmins as jest.Mock).mockResolvedValue(mockAdmins);
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await adminMessagingService.broadcastToAdmins(
        mockMessage,
        mockAdminPhone
      );

      expect(result.success).toBe(true);
      expect(result.delivered).toBe(3);
      expect(result.failed).toBe(0);
      expect(whatsappService.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('should handle partial delivery failures', async () => {
      const mockAdmins = [
        { phoneNumber: '+22579999999', role: 'admin' },
        { phoneNumber: '+22570000001', role: 'admin' }
      ];

      (adminService.listAdmins as jest.Mock).mockResolvedValue(mockAdmins);
      (whatsappService.sendMessage as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Send failed'));

      const result = await adminMessagingService.broadcastToAdmins(
        mockMessage,
        mockAdminPhone
      );

      expect(result.success).toBe(true);
      expect(result.delivered).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should filter by role if specified', async () => {
      const mockAdmins = [
        { phoneNumber: '+22579999999', role: 'super_admin' },
        { phoneNumber: '+22570000001', role: 'admin' },
        { phoneNumber: '+22570000002', role: 'moderator' }
      ];

      (adminService.listAdmins as jest.Mock).mockResolvedValue(mockAdmins);
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      await adminMessagingService.broadcastToAdmins(
        mockMessage,
        mockAdminPhone,
        'admin'
      );

      expect(whatsappService.sendMessage).toHaveBeenCalledTimes(2); // super_admin + admin
    });

    it('should not send to sender', async () => {
      const mockAdmins = [
        { phoneNumber: mockAdminPhone, role: 'super_admin' },
        { phoneNumber: '+22570000001', role: 'admin' }
      ];

      (adminService.listAdmins as jest.Mock).mockResolvedValue(mockAdmins);
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      await adminMessagingService.broadcastToAdmins(
        mockMessage,
        mockAdminPhone
      );

      expect(whatsappService.sendMessage).toHaveBeenCalledTimes(1);
      expect(whatsappService.sendMessage).not.toHaveBeenCalledWith(
        mockAdminPhone,
        expect.any(String)
      );
    });

    it('should handle empty admin list', async () => {
      (adminService.listAdmins as jest.Mock).mockResolvedValue([]);

      const result = await adminMessagingService.broadcastToAdmins(
        mockMessage,
        mockAdminPhone
      );

      expect(result.success).toBe(true);
      expect(result.delivered).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('sendMessageToUser', () => {
    it('should send message to specific user', async () => {
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await adminMessagingService.sendMessageToUser(
        mockUserPhone,
        mockMessage,
        mockAdminPhone
      );

      expect(result.success).toBe(true);
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        mockUserPhone,
        expect.stringContaining(mockMessage)
      );
    });

    it('should include admin signature', async () => {
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      await adminMessagingService.sendMessageToUser(
        mockUserPhone,
        mockMessage,
        mockAdminPhone
      );

      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        mockUserPhone,
        expect.stringContaining('Message from admin')
      );
    });

    it('should handle send failure', async () => {
      (whatsappService.sendMessage as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await adminMessagingService.sendMessageToUser(
        mockUserPhone,
        mockMessage,
        mockAdminPhone
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should validate phone number format', async () => {
      const result = await adminMessagingService.sendMessageToUser(
        'invalid-phone',
        mockMessage,
        mockAdminPhone
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('should prevent empty messages', async () => {
      const result = await adminMessagingService.sendMessageToUser(
        mockUserPhone,
        '',
        mockAdminPhone
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Message cannot be empty');
      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('notifyAdminsOfCriticalEvent', () => {
    it('should notify all super admins of critical events', async () => {
      const mockAdmins = [
        { phoneNumber: '+22579999999', role: 'super_admin' },
        { phoneNumber: '+22570000001', role: 'admin' },
        { phoneNumber: '+22570000002', role: 'super_admin' }
      ];

      (adminService.listAdmins as jest.Mock).mockResolvedValue(mockAdmins);
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      await adminMessagingService.notifyAdminsOfCriticalEvent(
        'System overload detected',
        { cpu: '95%', memory: '87%' }
      );

      expect(whatsappService.sendMessage).toHaveBeenCalledTimes(2); // Only super_admins
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('🚨 CRITICAL EVENT')
      );
    });

    it('should include event details in notification', async () => {
      const mockAdmins = [{ phoneNumber: '+22579999999', role: 'super_admin' }];
      const eventDetails = { error: 'Database connection lost', attempts: 3 };

      (adminService.listAdmins as jest.Mock).mockResolvedValue(mockAdmins);
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      await adminMessagingService.notifyAdminsOfCriticalEvent(
        'Database failure',
        eventDetails
      );

      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(JSON.stringify(eventDetails, null, 2))
      );
    });

    it('should log if notification fails', async () => {
      const mockAdmins = [{ phoneNumber: '+22579999999', role: 'super_admin' }];

      (adminService.listAdmins as jest.Mock).mockResolvedValue(mockAdmins);
      (whatsappService.sendMessage as jest.Mock).mockRejectedValue(
        new Error('Send failed')
      );

      await adminMessagingService.notifyAdminsOfCriticalEvent('Test event', {});

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to notify admin'),
        expect.any(Error)
      );
    });
  });

  describe('Message Templates', () => {
    it('should format welcome message for new admins', () => {
      const message = adminMessagingService.formatAdminWelcomeMessage('moderator');

      expect(message).toContain('Welcome to the admin team');
      expect(message).toContain('moderator');
      expect(message).toContain('/admin help');
    });

    it('should format user notification message', () => {
      const message = adminMessagingService.formatUserNotification(
        'System maintenance',
        'The bot will be offline for 30 minutes'
      );

      expect(message).toContain('📢 System maintenance');
      expect(message).toContain('The bot will be offline for 30 minutes');
    });

    it('should format blacklist notification', () => {
      const message = adminMessagingService.formatBlacklistNotification(
        mockUserPhone,
        'Spam behavior',
        true
      );

      expect(message).toContain('User blacklisted');
      expect(message).toContain(mockUserPhone);
      expect(message).toContain('Spam behavior');
    });
  });

  describe('Bulk Operations', () => {
    it('should send messages to multiple users', async () => {
      const users = ['+22570000001', '+22570000002', '+22570000003'];
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await adminMessagingService.bulkSendToUsers(
        users,
        mockMessage,
        mockAdminPhone
      );

      expect(result.total).toBe(3);
      expect(result.delivered).toBe(3);
      expect(result.failed).toBe(0);
      expect(whatsappService.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('should handle bulk send with failures', async () => {
      const users = ['+22570000001', '+22570000002'];
      (whatsappService.sendMessage as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await adminMessagingService.bulkSendToUsers(
        users,
        mockMessage,
        mockAdminPhone
      );

      expect(result.delivered).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should respect rate limiting in bulk operations', async () => {
      const users = Array(10).fill(null).map((_, i) => `+2257000000${i}`);
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);

      const startTime = Date.now();
      await adminMessagingService.bulkSendToUsers(
        users,
        mockMessage,
        mockAdminPhone
      );
      const endTime = Date.now();

      // Should have delays between messages
      expect(endTime - startTime).toBeGreaterThan(900); // At least 100ms * 9 delays
    });
  });

  describe('Error Handling', () => {
    it('should handle WhatsApp service not ready', async () => {
      (whatsappService.sendMessage as jest.Mock).mockRejectedValue(
        new Error('WhatsApp client is not ready')
      );

      const result = await adminMessagingService.sendMessageToUser(
        mockUserPhone,
        mockMessage,
        mockAdminPhone
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('WhatsApp client is not ready');
    });

    it('should handle network timeouts', async () => {
      (whatsappService.sendMessage as jest.Mock).mockRejectedValue(
        new Error('ETIMEDOUT')
      );

      const result = await adminMessagingService.sendMessageToUser(
        mockUserPhone,
        mockMessage,
        mockAdminPhone
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('ETIMEDOUT');
    });
  });

  describe('Message Logging', () => {
    it('should log all admin messages', async () => {
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);
      (adminService.logAction as jest.Mock).mockResolvedValue(undefined);

      await adminMessagingService.sendMessageToUser(
        mockUserPhone,
        mockMessage,
        mockAdminPhone
      );

      expect(adminService.logAction).toHaveBeenCalledWith(
        mockAdminPhone,
        'admin_message_sent',
        expect.objectContaining({
          to: mockUserPhone,
          message: mockMessage
        })
      );
    });

    it('should log broadcast operations', async () => {
      (adminService.listAdmins as jest.Mock).mockResolvedValue([
        { phoneNumber: '+22570000001', role: 'admin' }
      ]);
      (whatsappService.sendMessage as jest.Mock).mockResolvedValue(undefined);
      (adminService.logAction as jest.Mock).mockResolvedValue(undefined);

      await adminMessagingService.broadcastToAdmins(
        mockMessage,
        mockAdminPhone
      );

      expect(adminService.logAction).toHaveBeenCalledWith(
        mockAdminPhone,
        'admin_broadcast',
        expect.objectContaining({
          message: mockMessage,
          delivered: 1,
          failed: 0
        })
      );
    });
  });
});