import { adminService } from '../../src/services/admin.service';
import { adminSecurityService } from '../../src/services/admin-security.service';
import { adminMessagingService } from '../../src/services/admin-messaging.service';
import { messageHandler } from '../../src/handlers/message.handler';
import { createMockPrivateMessage, MockMessage } from '../mocks/whatsapp.mock';
import { delay } from '../utils/test-helpers';

// This is an integration test - mocking only external services
jest.mock('../../src/services/appwrite.service');
jest.mock('../../src/services/whatsapp.service');
jest.mock('../../src/utils/logger');

describe('Admin Flow Integration Tests', () => {
  const superAdminPhone = '+22579999999';
  const newAdminPhone = '+22570000001';
  const regularUserPhone = '+22570000002';
  const adminPin = '1234';

  beforeAll(async () => {
    // Initialize services
    await adminService.initialize();
    await adminMessagingService.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Admin Authentication Flow', () => {
    it('should handle full admin authentication process', async () => {
      // Step 1: Admin sets PIN
      const pinSet = await adminSecurityService.setAdminPin(superAdminPhone, adminPin);
      expect(pinSet).toBe(true);

      // Step 2: Admin tries protected command without auth
      const accessBeforeAuth = await adminSecurityService.validateCommandAccess(
        superAdminPhone,
        '/admin list'
      );
      expect(accessBeforeAuth.allowed).toBe(false);
      expect(accessBeforeAuth.reason).toContain('authenticate');

      // Step 3: Admin authenticates with PIN
      const authenticated = adminSecurityService.verifyPin(superAdminPhone, adminPin);
      expect(authenticated).toBe(true);

      // Step 4: Admin can now access protected commands
      const accessAfterAuth = await adminSecurityService.validateCommandAccess(
        superAdminPhone,
        '/admin list'
      );
      expect(accessAfterAuth.allowed).toBe(true);

      // Step 5: Admin logs out
      adminSecurityService.logout(superAdminPhone);
      
      // Step 6: Access denied again
      const accessAfterLogout = await adminSecurityService.validateCommandAccess(
        superAdminPhone,
        '/admin list'
      );
      expect(accessAfterLogout.allowed).toBe(false);
    });

    it('should handle failed authentication attempts', async () => {
      await adminSecurityService.setAdminPin(superAdminPhone, adminPin);

      // Multiple wrong attempts
      for (let i = 0; i < 4; i++) {
        const result = adminSecurityService.verifyPin(superAdminPhone, 'wrong');
        expect(result).toBe(false);
      }

      // Account should be locked after 5 attempts
      const lockedResult = adminSecurityService.verifyPin(superAdminPhone, 'wrong');
      expect(lockedResult).toBe(false);

      // Even correct PIN should fail when locked
      const correctPinResult = adminSecurityService.verifyPin(superAdminPhone, adminPin);
      expect(correctPinResult).toBe(false);
    });
  });

  describe('Admin Management Flow', () => {
    it('should handle complete admin lifecycle', async () => {
      // Step 1: Add new admin
      const added = await adminService.addAdmin(
        newAdminPhone,
        'moderator',
        superAdminPhone
      );
      expect(added).toBe(true);

      // Step 2: Verify new admin has access
      const isAdmin = await adminService.isAdmin(newAdminPhone);
      expect(isAdmin).toBe(true);

      // Step 3: New admin sets their PIN
      const pinSet = await adminSecurityService.setAdminPin(newAdminPhone, '5678');
      expect(pinSet).toBe(true);

      // Step 4: List all admins
      const admins = await adminService.listAdmins();
      expect(admins).toHaveLength(2); // Super admin + new admin

      // Step 5: Remove admin
      const removed = await adminService.removeAdmin(newAdminPhone);
      expect(removed).toBe(true);

      // Step 6: Verify removed admin no longer has access
      const stillAdmin = await adminService.isAdmin(newAdminPhone);
      expect(stillAdmin).toBe(false);
    });

    it('should prevent removing super admin', async () => {
      const removed = await adminService.removeAdmin(superAdminPhone);
      expect(removed).toBe(false);

      // Super admin should still exist
      const stillAdmin = await adminService.isAdmin(superAdminPhone);
      expect(stillAdmin).toBe(true);
    });
  });

  describe('Blacklist Management Flow', () => {
    it('should handle blacklist operations', async () => {
      // Step 1: Add user to blacklist
      const blacklisted = await adminService.addToBlacklist(
        regularUserPhone,
        'Spam behavior',
        superAdminPhone
      );
      expect(blacklisted).toBe(true);

      // Step 2: Check if user is blacklisted
      const isBlacklisted = await adminService.isBlacklisted(regularUserPhone);
      expect(isBlacklisted).toBe(true);

      // Step 3: Blacklisted user tries to send message
      const message = createMockPrivateMessage({
        from: regularUserPhone,
        body: 'Hello bot'
      });

      // Mock message handler should reject
      await messageHandler.handleMessage(message as any);
      // Message should be silently ignored (no response sent)

      // Step 4: Remove from blacklist
      const removed = await adminService.removeFromBlacklist(regularUserPhone);
      expect(removed).toBe(true);

      // Step 5: User can now send messages
      const stillBlacklisted = await adminService.isBlacklisted(regularUserPhone);
      expect(stillBlacklisted).toBe(false);
    });
  });

  describe('User Limit Management Flow', () => {
    it('should enforce user message limits', async () => {
      // Step 1: Set custom limit for user
      const limitSet = await adminService.setUserLimit(regularUserPhone, 5);
      expect(limitSet).toBe(true);

      // Step 2: User sends messages up to limit
      for (let i = 0; i < 5; i++) {
        const canSend = await adminService.checkUserLimit(regularUserPhone);
        expect(canSend).toBe(true);
        await adminService.incrementUserUsage(regularUserPhone);
      }

      // Step 3: User exceeds limit
      const canSendMore = await adminService.checkUserLimit(regularUserPhone);
      expect(canSendMore).toBe(false);

      // Step 4: Admin resets limits
      adminService.resetDailyUsage();

      // Step 5: User can send again
      const canSendAfterReset = await adminService.checkUserLimit(regularUserPhone);
      expect(canSendAfterReset).toBe(true);
    });

    it('should not limit admin users', async () => {
      // Set a limit
      await adminService.setUserLimit(superAdminPhone, 1);

      // Admin can send unlimited messages
      for (let i = 0; i < 10; i++) {
        const canSend = await adminService.checkUserLimit(superAdminPhone);
        expect(canSend).toBe(true);
        await adminService.incrementUserUsage(superAdminPhone);
      }
    });
  });

  describe('Broadcast Messaging Flow', () => {
    it('should broadcast messages to admins', async () => {
      // Add some admins
      await adminService.addAdmin(newAdminPhone, 'admin', superAdminPhone);
      await adminService.addAdmin('+22570000003', 'moderator', superAdminPhone);

      // Broadcast message
      const result = await adminMessagingService.broadcastToAdmins(
        '🚨 System maintenance in 1 hour',
        superAdminPhone
      );

      expect(result.success).toBe(true);
      expect(result.delivered).toBe(2); // Should not send to sender
      expect(result.failed).toBe(0);
    });

    it('should broadcast to specific roles', async () => {
      // Add admins with different roles
      await adminService.addAdmin('+22570000004', 'admin', superAdminPhone);
      await adminService.addAdmin('+22570000005', 'moderator', superAdminPhone);

      // Broadcast only to admins (including super_admin)
      const result = await adminMessagingService.broadcastToAdmins(
        'Admin-only message',
        superAdminPhone,
        'admin'
      );

      // Should send to admin role only (not moderator)
      expect(result.delivered).toBe(1);
    });
  });

  describe('Bot Mode Management Flow', () => {
    it('should handle bot mode changes', async () => {
      // Step 1: Set maintenance mode
      await adminService.setBotMode('maintenance', superAdminPhone);
      expect(adminService.getBotMode()).toBe('maintenance');

      // Step 2: Regular user tries to message in maintenance mode
      const message = createMockPrivateMessage({
        from: regularUserPhone,
        body: 'Hello'
      });

      // Should receive maintenance message
      await messageHandler.handleMessage(message as any);

      // Step 3: Admin can still use bot in maintenance
      const adminMessage = createMockPrivateMessage({
        from: superAdminPhone,
        body: '/help'
      });

      await messageHandler.handleMessage(adminMessage as any);
      // Admin should get normal response

      // Step 4: Return to normal mode
      await adminService.setBotMode('normal', superAdminPhone);
      expect(adminService.getBotMode()).toBe('normal');
    });

    it('should handle readonly mode', async () => {
      await adminService.setBotMode('readonly', superAdminPhone);

      // Messages should be processed but not saved
      const message = createMockPrivateMessage({
        from: regularUserPhone,
        body: 'Test message'
      });

      await messageHandler.handleMessage(message as any);
      // Should receive readonly notification

      await adminService.setBotMode('normal', superAdminPhone);
    });
  });

  describe('Security Event Tracking', () => {
    it('should track security events', async () => {
      // Generate some security events
      adminSecurityService.verifyPin('attacker1', 'wrong');
      adminSecurityService.verifyPin('attacker2', 'hack');
      
      await delay(10);

      const events = adminSecurityService.getSecurityEvents();

      expect(events.failedLogins).toBeGreaterThanOrEqual(2);
      expect(events.lastFailedAttempts).toHaveLength(
        Math.min(events.failedLogins, 10)
      );
    });
  });

  describe('Global Settings Management', () => {
    it('should update and apply global settings', async () => {
      // Update settings
      const updated = await adminService.updateGlobalSettings({
        dailyMessageLimit: 100,
        welcomeMessage: 'Welcome to our bot!',
        maintenanceMessage: 'Bot under maintenance'
      });

      expect(updated).toBe(true);

      // Get current settings
      const settings = adminService.getGlobalSettings();
      expect(settings.dailyMessageLimit).toBe(100);
      expect(settings.welcomeMessage).toBe('Welcome to our bot!');

      // Settings should be applied to new users
      const canSend = await adminService.checkUserLimit('newuser@test.com');
      expect(canSend).toBe(true);
    });
  });

  describe('Audit Trail', () => {
    it('should maintain complete audit trail', async () => {
      // Perform various admin actions
      await adminService.addAdmin('+22570000006', 'moderator', superAdminPhone);
      await adminService.addToBlacklist('+22570000007', 'Test', superAdminPhone);
      await adminService.setBotMode('maintenance', superAdminPhone);

      // Each action should be logged
      // In real implementation, would query audit logs
      expect(adminService.logAction).toHaveBeenCalledTimes(3);
    });
  });
});