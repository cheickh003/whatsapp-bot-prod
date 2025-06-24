import { adminService } from '../../src/services/admin.service';
import { appwriteService } from '../../src/services/appwrite.service';
import { BotMode } from '../../src/models/admin.model';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/services/appwrite.service');
jest.mock('../../src/utils/logger');

describe('AdminService', () => {
  const mockAdminPhone = '+22579999999';
  const mockUserId = 'user123';
  const mockAdminDoc = {
    $id: 'admin123',
    phoneNumber: mockAdminPhone,
    role: 'super_admin',
    createdAt: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adminService['adminCache'].clear();
    adminService['blacklistCache'].clear();
    adminService['userLimits'].clear();
    adminService['dailyUsage'].clear();
  });

  describe('initialize', () => {
    it('should initialize admin service and create default admin if none exists', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([]);
      (appwriteService.createDocument as jest.Mock).mockResolvedValueOnce(mockAdminDoc);

      await adminService.initialize();

      expect(appwriteService.listDocuments).toHaveBeenCalledWith(
        'jarvis_admin',
        'admins',
        ['equal("phoneNumber", "+22579999999")']
      );
      expect(appwriteService.createDocument).toHaveBeenCalledWith(
        'jarvis_admin',
        'admins',
        expect.objectContaining({
          phoneNumber: '+22579999999',
          role: 'super_admin'
        })
      );
    });

    it('should not create default admin if admins exist', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([mockAdminDoc]);

      await adminService.initialize();

      expect(appwriteService.createDocument).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      (appwriteService.listDocuments as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      await expect(adminService.initialize()).rejects.toThrow('DB Error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('isAdmin', () => {
    it('should return true for cached admin', async () => {
      adminService['adminCache'].add(mockAdminPhone);

      const result = await adminService.isAdmin(mockAdminPhone);

      expect(result).toBe(true);
      expect(appwriteService.listDocuments).not.toHaveBeenCalled();
    });

    it('should check database for non-cached phone number', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([mockAdminDoc]);

      const result = await adminService.isAdmin(mockAdminPhone);

      expect(result).toBe(true);
      expect(adminService['adminCache'].has(mockAdminPhone)).toBe(true);
    });

    it('should return false for non-admin', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([]);

      const result = await adminService.isAdmin('nonexistent');

      expect(result).toBe(false);
    });

    it('should handle database errors and return false', async () => {
      (appwriteService.listDocuments as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      const result = await adminService.isAdmin(mockAdminPhone);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('addAdmin', () => {
    it('should add new admin successfully', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([]);
      (appwriteService.createDocument as jest.Mock).mockResolvedValueOnce({
        ...mockAdminDoc,
        addedBy: 'superadmin'
      });

      const result = await adminService.addAdmin(mockAdminPhone, 'admin', 'superadmin');

      expect(result).toBe(true);
      expect(adminService['adminCache'].has(mockAdminPhone)).toBe(true);
    });

    it('should not add duplicate admin', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([mockAdminDoc]);

      const result = await adminService.addAdmin(mockAdminPhone, 'admin', 'superadmin');

      expect(result).toBe(false);
      expect(appwriteService.createDocument).not.toHaveBeenCalled();
    });

    it('should handle errors during admin creation', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([]);
      (appwriteService.createDocument as jest.Mock).mockRejectedValueOnce(new Error('Create Error'));

      const result = await adminService.addAdmin(mockAdminPhone, 'admin', 'superadmin');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('removeAdmin', () => {
    it('should remove admin successfully', async () => {
      adminService['adminCache'].add(mockAdminPhone);
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([mockAdminDoc]);
      (appwriteService.deleteDocument as jest.Mock).mockResolvedValueOnce({});

      const result = await adminService.removeAdmin(mockAdminPhone);

      expect(result).toBe(true);
      expect(adminService['adminCache'].has(mockAdminPhone)).toBe(false);
    });

    it('should return false if admin not found', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([]);

      const result = await adminService.removeAdmin(mockAdminPhone);

      expect(result).toBe(false);
      expect(appwriteService.deleteDocument).not.toHaveBeenCalled();
    });

    it('should not remove super admin', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([{
        ...mockAdminDoc,
        role: 'super_admin'
      }]);

      const result = await adminService.removeAdmin(mockAdminPhone);

      expect(result).toBe(false);
      expect(appwriteService.deleteDocument).not.toHaveBeenCalled();
    });
  });

  describe('blacklist management', () => {
    describe('addToBlacklist', () => {
      it('should add user to blacklist', async () => {
        (appwriteService.createDocument as jest.Mock).mockResolvedValueOnce({
          phoneNumber: mockUserId,
          reason: 'spam'
        });

        const result = await adminService.addToBlacklist(mockUserId, 'spam', mockAdminPhone);

        expect(result).toBe(true);
        expect(adminService['blacklistCache'].has(mockUserId)).toBe(true);
      });

      it('should handle blacklist errors', async () => {
        (appwriteService.createDocument as jest.Mock).mockRejectedValueOnce(new Error('Blacklist Error'));

        const result = await adminService.addToBlacklist(mockUserId, 'spam', mockAdminPhone);

        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalled();
      });
    });

    describe('removeFromBlacklist', () => {
      it('should remove user from blacklist', async () => {
        adminService['blacklistCache'].add(mockUserId);
        (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([{
          $id: 'blacklist123',
          phoneNumber: mockUserId
        }]);
        (appwriteService.deleteDocument as jest.Mock).mockResolvedValueOnce({});

        const result = await adminService.removeFromBlacklist(mockUserId);

        expect(result).toBe(true);
        expect(adminService['blacklistCache'].has(mockUserId)).toBe(false);
      });
    });

    describe('isBlacklisted', () => {
      it('should check blacklist cache first', async () => {
        adminService['blacklistCache'].add(mockUserId);

        const result = await adminService.isBlacklisted(mockUserId);

        expect(result).toBe(true);
        expect(appwriteService.listDocuments).not.toHaveBeenCalled();
      });

      it('should check database if not in cache', async () => {
        (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([{
          phoneNumber: mockUserId
        }]);

        const result = await adminService.isBlacklisted(mockUserId);

        expect(result).toBe(true);
        expect(adminService['blacklistCache'].has(mockUserId)).toBe(true);
      });
    });
  });

  describe('user limits', () => {
    describe('setUserLimit', () => {
      it('should set user limit', async () => {
        (appwriteService.createDocument as jest.Mock).mockResolvedValueOnce({
          phoneNumber: mockUserId,
          dailyLimit: 50
        });

        const result = await adminService.setUserLimit(mockUserId, 50);

        expect(result).toBe(true);
        expect(adminService['userLimits'].get(mockUserId)).toBe(50);
      });

      it('should update existing limit', async () => {
        (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([{
          $id: 'limit123',
          phoneNumber: mockUserId,
          dailyLimit: 10
        }]);
        (appwriteService.updateDocument as jest.Mock).mockResolvedValueOnce({});

        const result = await adminService.setUserLimit(mockUserId, 50);

        expect(result).toBe(true);
        expect(adminService['userLimits'].get(mockUserId)).toBe(50);
      });
    });

    describe('checkUserLimit', () => {
      it('should allow admin unlimited usage', async () => {
        adminService['adminCache'].add(mockUserId);

        const result = await adminService.checkUserLimit(mockUserId);

        expect(result).toBe(true);
      });

      it('should check daily usage against limit', async () => {
        adminService['userLimits'].set(mockUserId, 10);
        adminService['dailyUsage'].set(mockUserId, 5);

        const result = await adminService.checkUserLimit(mockUserId);

        expect(result).toBe(true);
      });

      it('should block when limit exceeded', async () => {
        adminService['userLimits'].set(mockUserId, 10);
        adminService['dailyUsage'].set(mockUserId, 10);

        const result = await adminService.checkUserLimit(mockUserId);

        expect(result).toBe(false);
      });

      it('should use global limit when no user limit set', async () => {
        adminService['globalSettings'] = { dailyMessageLimit: 20 };
        adminService['dailyUsage'].set(mockUserId, 15);

        const result = await adminService.checkUserLimit(mockUserId);

        expect(result).toBe(true);
      });
    });

    describe('incrementUserUsage', () => {
      it('should increment usage counter', async () => {
        await adminService.incrementUserUsage(mockUserId);

        expect(adminService['dailyUsage'].get(mockUserId)).toBe(1);
      });

      it('should increment existing usage', async () => {
        adminService['dailyUsage'].set(mockUserId, 5);

        await adminService.incrementUserUsage(mockUserId);

        expect(adminService['dailyUsage'].get(mockUserId)).toBe(6);
      });

      it('should save usage to database', async () => {
        (appwriteService.createDocument as jest.Mock).mockResolvedValueOnce({});

        await adminService.incrementUserUsage(mockUserId);

        expect(appwriteService.createDocument).toHaveBeenCalledWith(
          'jarvis_admin',
          'usage_logs',
          expect.objectContaining({
            phoneNumber: mockUserId,
            messageCount: 1
          })
        );
      });
    });
  });

  describe('bot mode management', () => {
    it('should get current bot mode', () => {
      adminService['botMode'] = BotMode.MAINTENANCE;

      const mode = adminService.getBotMode();

      expect(mode).toBe(BotMode.MAINTENANCE);
    });

    it('should set bot mode and log change', async () => {
      (appwriteService.createDocument as jest.Mock).mockResolvedValueOnce({});

      await adminService.setBotMode(BotMode.READONLY, mockAdminPhone);

      expect(adminService['botMode']).toBe(BotMode.READONLY);
      expect(appwriteService.createDocument).toHaveBeenCalledWith(
        'jarvis_admin',
        'system_logs',
        expect.objectContaining({
          action: 'bot_mode_change',
          newMode: BotMode.READONLY
        })
      );
    });
  });

  describe('global settings', () => {
    it('should update global settings', async () => {
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([]);
      (appwriteService.createDocument as jest.Mock).mockResolvedValueOnce({});

      const result = await adminService.updateGlobalSettings({ dailyMessageLimit: 100 });

      expect(result).toBe(true);
      expect(adminService['globalSettings'].dailyMessageLimit).toBe(100);
    });

    it('should merge settings on update', async () => {
      adminService['globalSettings'] = { 
        dailyMessageLimit: 50,
        welcomeMessage: 'Hello'
      };
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce([{
        $id: 'settings123'
      }]);
      (appwriteService.updateDocument as jest.Mock).mockResolvedValueOnce({});

      await adminService.updateGlobalSettings({ dailyMessageLimit: 100 });

      expect(adminService['globalSettings']).toEqual({
        dailyMessageLimit: 100,
        welcomeMessage: 'Hello'
      });
    });

    it('should get global settings', () => {
      adminService['globalSettings'] = { dailyMessageLimit: 75 };

      const settings = adminService.getGlobalSettings();

      expect(settings.dailyMessageLimit).toBe(75);
    });
  });

  describe('audit logging', () => {
    it('should log admin actions', async () => {
      (appwriteService.createDocument as jest.Mock).mockResolvedValueOnce({});

      await adminService.logAction(mockAdminPhone, 'user_banned', { target: mockUserId });

      expect(appwriteService.createDocument).toHaveBeenCalledWith(
        'jarvis_admin',
        'audit_logs',
        expect.objectContaining({
          adminPhone: mockAdminPhone,
          action: 'user_banned',
          details: { target: mockUserId }
        })
      );
    });

    it('should handle logging errors gracefully', async () => {
      (appwriteService.createDocument as jest.Mock).mockRejectedValueOnce(new Error('Log Error'));

      // Should not throw
      await adminService.logAction(mockAdminPhone, 'test_action', {});

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('usage statistics', () => {
    it('should get usage stats', async () => {
      const mockStats = [
        { phoneNumber: 'user1', messageCount: 10 },
        { phoneNumber: 'user2', messageCount: 20 }
      ];
      (appwriteService.listDocuments as jest.Mock).mockResolvedValueOnce(mockStats);

      const stats = await adminService.getUsageStats(7);

      expect(stats).toEqual(mockStats);
      expect(appwriteService.listDocuments).toHaveBeenCalledWith(
        'jarvis_admin',
        'usage_logs',
        expect.any(Array),
        100
      );
    });

    it('should handle stats errors', async () => {
      (appwriteService.listDocuments as jest.Mock).mockRejectedValueOnce(new Error('Stats Error'));

      const stats = await adminService.getUsageStats(7);

      expect(stats).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('resetDailyUsage', () => {
    it('should clear daily usage map', () => {
      adminService['dailyUsage'].set('user1', 10);
      adminService['dailyUsage'].set('user2', 20);

      adminService.resetDailyUsage();

      expect(adminService['dailyUsage'].size).toBe(0);
    });

    it('should be called by daily reset interval', () => {
      jest.useFakeTimers();
      const resetSpy = jest.spyOn(adminService, 'resetDailyUsage');

      adminService['startDailyReset']();

      // Fast forward 24 hours
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(resetSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});