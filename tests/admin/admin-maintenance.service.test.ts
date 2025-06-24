import { adminMaintenanceService } from '../../src/services/admin-maintenance.service';
import { adminService } from '../../src/services/admin.service';
import { appwriteService } from '../../src/services/appwrite.service';
import { logger } from '../../src/utils/logger';
import { BotMode } from '../../src/models/admin.model';

jest.mock('../../src/services/admin.service');
jest.mock('../../src/services/appwrite.service');
jest.mock('../../src/utils/logger');

describe('AdminMaintenanceService', () => {
  const mockAdminPhone = '+22579999999';
  const mockStartTime = new Date('2023-01-01T00:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    adminMaintenanceService.setStartTime(mockStartTime);
  });

  describe('System Status', () => {
    describe('getSystemStatus', () => {
      it('should return complete system status', async () => {
        (adminService.getGlobalSettings as jest.Mock).mockReturnValue({
          dailyMessageLimit: 100
        });
        (adminService.getBotMode as jest.Mock).mockReturnValue(BotMode.NORMAL);

        const status = await adminMaintenanceService.getSystemStatus();

        expect(status).toMatchObject({
          uptime: expect.any(String),
          mode: BotMode.NORMAL,
          memory: expect.objectContaining({
            used: expect.any(String),
            total: expect.any(String),
            percentage: expect.any(Number)
          }),
          settings: { dailyMessageLimit: 100 },
          timestamp: expect.any(String)
        });
      });

      it('should calculate correct uptime', async () => {
        const now = new Date('2023-01-01T12:30:45Z');
        jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

        const status = await adminMaintenanceService.getSystemStatus();

        expect(status.uptime).toBe('12 hours, 30 minutes, 45 seconds');
      });

      it('should format memory usage correctly', async () => {
        const status = await adminMaintenanceService.getSystemStatus();

        expect(status.memory.used).toMatch(/^\d+(\.\d+)? [KMGT]B$/);
        expect(status.memory.total).toMatch(/^\d+(\.\d+)? [KMGT]B$/);
        expect(status.memory.percentage).toBeGreaterThanOrEqual(0);
        expect(status.memory.percentage).toBeLessThanOrEqual(100);
      });
    });

    describe('getHealthCheck', () => {
      it('should return healthy status when all services are up', async () => {
        (appwriteService.testConnection as jest.Mock).mockResolvedValue(true);

        const health = await adminMaintenanceService.getHealthCheck();

        expect(health).toMatchObject({
          status: 'healthy',
          services: {
            whatsapp: { status: 'unknown', message: 'Not checked' },
            database: { status: 'healthy', responseTime: expect.any(Number) },
            memory: { status: 'healthy', usage: expect.any(Number) }
          }
        });
      });

      it('should return unhealthy when database is down', async () => {
        (appwriteService.testConnection as jest.Mock).mockRejectedValue(
          new Error('Connection failed')
        );

        const health = await adminMaintenanceService.getHealthCheck();

        expect(health.status).toBe('unhealthy');
        expect(health.services.database.status).toBe('unhealthy');
        expect(health.services.database.error).toBe('Connection failed');
      });

      it('should warn on high memory usage', async () => {
        // Mock high memory usage
        const memUsage = process.memoryUsage();
        jest.spyOn(process, 'memoryUsage').mockReturnValue({
          ...memUsage,
          heapUsed: memUsage.heapTotal * 0.85 // 85% usage
        });

        const health = await adminMaintenanceService.getHealthCheck();

        expect(health.services.memory.status).toBe('warning');
        expect(health.services.memory.usage).toBeGreaterThan(80);
      });
    });
  });

  describe('Maintenance Operations', () => {
    describe('performBackup', () => {
      it('should backup all collections', async () => {
        const mockData = {
          conversations: [{ id: '1', data: 'test' }],
          messages: [{ id: '2', data: 'test' }],
          admins: [{ id: '3', data: 'test' }]
        };

        (appwriteService.listDocuments as jest.Mock)
          .mockResolvedValueOnce(mockData.conversations)
          .mockResolvedValueOnce(mockData.messages)
          .mockResolvedValueOnce(mockData.admins);

        const result = await adminMaintenanceService.performBackup(mockAdminPhone);

        expect(result.success).toBe(true);
        expect(result.collections).toEqual(['conversations', 'messages', 'admins']);
        expect(result.documentCount).toBe(3);
        expect(result.backupPath).toMatch(/backup_\d{8}_\d{6}\.json$/);
      });

      it('should handle backup errors', async () => {
        (appwriteService.listDocuments as jest.Mock).mockRejectedValue(
          new Error('Database error')
        );

        const result = await adminMaintenanceService.performBackup(mockAdminPhone);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Database error');
        expect(logger.error).toHaveBeenCalled();
      });

      it('should log backup action', async () => {
        (appwriteService.listDocuments as jest.Mock).mockResolvedValue([]);
        (adminService.logAction as jest.Mock).mockResolvedValue(undefined);

        await adminMaintenanceService.performBackup(mockAdminPhone);

        expect(adminService.logAction).toHaveBeenCalledWith(
          mockAdminPhone,
          'backup_created',
          expect.objectContaining({
            collections: expect.any(Array),
            documentCount: expect.any(Number)
          })
        );
      });
    });

    describe('cleanupOldData', () => {
      it('should clean up old messages and logs', async () => {
        const oldMessages = [
          { $id: 'msg1', timestamp: Date.now() - 35 * 24 * 60 * 60 * 1000 },
          { $id: 'msg2', timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000 }
        ];

        (appwriteService.listDocuments as jest.Mock)
          .mockResolvedValueOnce(oldMessages) // messages
          .mockResolvedValueOnce([]) // usage_logs
          .mockResolvedValueOnce([]); // audit_logs

        (appwriteService.deleteDocument as jest.Mock).mockResolvedValue({});

        const result = await adminMaintenanceService.cleanupOldData(10, mockAdminPhone);

        expect(result.success).toBe(true);
        expect(result.deletedCounts.messages).toBe(2);
        expect(appwriteService.deleteDocument).toHaveBeenCalledTimes(2);
      });

      it('should respect retention days parameter', async () => {
        const messages = [
          { $id: 'msg1', timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000 }, // 5 days old
          { $id: 'msg2', timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000 } // 15 days old
        ];

        (appwriteService.listDocuments as jest.Mock)
          .mockResolvedValueOnce(messages)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        (appwriteService.deleteDocument as jest.Mock).mockResolvedValue({});

        const result = await adminMaintenanceService.cleanupOldData(10, mockAdminPhone);

        expect(result.deletedCounts.messages).toBe(1); // Only the 15-day old message
        expect(appwriteService.deleteDocument).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          'msg2'
        );
      });

      it('should handle cleanup errors gracefully', async () => {
        (appwriteService.listDocuments as jest.Mock).mockRejectedValue(
          new Error('Cleanup failed')
        );

        const result = await adminMaintenanceService.cleanupOldData(30, mockAdminPhone);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cleanup failed');
      });
    });

    describe('resetUserLimits', () => {
      it('should reset all user limits', async () => {
        (adminService.resetDailyUsage as jest.Mock).mockReturnValue(undefined);

        const result = await adminMaintenanceService.resetUserLimits(mockAdminPhone);

        expect(result.success).toBe(true);
        expect(adminService.resetDailyUsage).toHaveBeenCalled();
        expect(adminService.logAction).toHaveBeenCalledWith(
          mockAdminPhone,
          'user_limits_reset',
          {}
        );
      });

      it('should handle reset errors', async () => {
        (adminService.resetDailyUsage as jest.Mock).mockImplementation(() => {
          throw new Error('Reset failed');
        });

        const result = await adminMaintenanceService.resetUserLimits(mockAdminPhone);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Reset failed');
      });
    });
  });

  describe('Cache Management', () => {
    describe('clearCaches', () => {
      it('should clear all service caches', async () => {
        const result = await adminMaintenanceService.clearCaches(mockAdminPhone);

        expect(result.success).toBe(true);
        expect(result.clearedCaches).toContain('admin');
        expect(adminService.logAction).toHaveBeenCalledWith(
          mockAdminPhone,
          'caches_cleared',
          { caches: expect.any(Array) }
        );
      });
    });

    describe('getMemoryUsage', () => {
      it('should return detailed memory usage', () => {
        const usage = adminMaintenanceService.getMemoryUsage();

        expect(usage).toMatchObject({
          rss: expect.objectContaining({
            bytes: expect.any(Number),
            formatted: expect.any(String)
          }),
          heapTotal: expect.objectContaining({
            bytes: expect.any(Number),
            formatted: expect.any(String)
          }),
          heapUsed: expect.objectContaining({
            bytes: expect.any(Number),
            formatted: expect.any(String)
          }),
          external: expect.objectContaining({
            bytes: expect.any(Number),
            formatted: expect.any(String)
          }),
          arrayBuffers: expect.objectContaining({
            bytes: expect.any(Number),
            formatted: expect.any(String)
          })
        });
      });
    });
  });

  describe('Database Maintenance', () => {
    describe('optimizeDatabase', () => {
      it('should optimize database collections', async () => {
        // Mock the optimization process
        (appwriteService.listDocuments as jest.Mock).mockResolvedValue([]);

        const result = await adminMaintenanceService.optimizeDatabase(mockAdminPhone);

        expect(result.success).toBe(true);
        expect(result.optimizedCollections).toBeGreaterThan(0);
      });
    });

    describe('getDatabaseStats', () => {
      it('should return database statistics', async () => {
        const mockCounts = {
          conversations: 150,
          messages: 5000,
          admins: 5,
          blacklist: 10
        };

        let callCount = 0;
        (appwriteService.listDocuments as jest.Mock).mockImplementation(() => {
          const counts = Object.values(mockCounts);
          return Promise.resolve(new Array(counts[callCount++ % counts.length]));
        });

        const stats = await adminMaintenanceService.getDatabaseStats();

        expect(stats).toMatchObject({
          collections: expect.objectContaining({
            conversations: { count: expect.any(Number) },
            messages: { count: expect.any(Number) },
            admins: { count: expect.any(Number) }
          }),
          totalDocuments: expect.any(Number),
          lastUpdated: expect.any(String)
        });
      });
    });
  });

  describe('System Maintenance Mode', () => {
    describe('enterMaintenanceMode', () => {
      it('should enter maintenance mode', async () => {
        (adminService.setBotMode as jest.Mock).mockResolvedValue(true);

        const result = await adminMaintenanceService.enterMaintenanceMode(
          mockAdminPhone,
          'System upgrade'
        );

        expect(result.success).toBe(true);
        expect(adminService.setBotMode).toHaveBeenCalledWith(
          BotMode.MAINTENANCE,
          mockAdminPhone
        );
      });
    });

    describe('exitMaintenanceMode', () => {
      it('should exit maintenance mode', async () => {
        (adminService.setBotMode as jest.Mock).mockResolvedValue(true);

        const result = await adminMaintenanceService.exitMaintenanceMode(mockAdminPhone);

        expect(result.success).toBe(true);
        expect(adminService.setBotMode).toHaveBeenCalledWith(
          BotMode.NORMAL,
          mockAdminPhone
        );
      });
    });
  });

  describe('Error Logs', () => {
    describe('getErrorLogs', () => {
      it('should retrieve recent error logs', async () => {
        const mockLogs = [
          {
            timestamp: Date.now() - 3600000,
            level: 'error',
            message: 'Test error',
            details: { code: 'ERR001' }
          }
        ];

        (appwriteService.listDocuments as jest.Mock).mockResolvedValue(mockLogs);

        const logs = await adminMaintenanceService.getErrorLogs(24, 50);

        expect(logs).toHaveLength(1);
        expect(appwriteService.listDocuments).toHaveBeenCalledWith(
          expect.any(String),
          'system_logs',
          expect.arrayContaining([
            expect.stringContaining('level.equal("error")')
          ]),
          50
        );
      });
    });

    describe('clearErrorLogs', () => {
      it('should clear old error logs', async () => {
        const oldLogs = [
          { $id: 'log1', timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000 }
        ];

        (appwriteService.listDocuments as jest.Mock).mockResolvedValue(oldLogs);
        (appwriteService.deleteDocument as jest.Mock).mockResolvedValue({});

        const result = await adminMaintenanceService.clearErrorLogs(7, mockAdminPhone);

        expect(result.success).toBe(true);
        expect(result.deletedCount).toBe(1);
      });
    });
  });

  describe('Scheduled Maintenance', () => {
    it('should schedule maintenance tasks', async () => {
      const task = {
        type: 'backup',
        scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
        recurringInterval: 'daily'
      };

      const result = await adminMaintenanceService.scheduleMaintenanceTask(
        task,
        mockAdminPhone
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    it('should execute scheduled maintenance tasks', async () => {
      jest.useFakeTimers();

      // Schedule a task
      const task = {
        type: 'cleanup',
        scheduledFor: new Date(Date.now() + 1000),
        parameters: { retentionDays: 30 }
      };

      await adminMaintenanceService.scheduleMaintenanceTask(task, mockAdminPhone);

      // Mock the cleanup method
      jest.spyOn(adminMaintenanceService, 'cleanupOldData').mockResolvedValue({
        success: true,
        deletedCounts: { messages: 10, usage_logs: 5, audit_logs: 3 }
      });

      // Fast forward time
      jest.advanceTimersByTime(2000);

      // Verify task was executed
      expect(adminMaintenanceService.cleanupOldData).toHaveBeenCalledWith(
        30,
        'SYSTEM'
      );

      jest.useRealTimers();
    });
  });
});