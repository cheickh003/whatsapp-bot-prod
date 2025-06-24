import { adminSecurityService } from '../../src/services/admin-security.service';
import { adminService } from '../../src/services/admin.service';
import { logger } from '../../src/utils/logger';
import crypto from 'crypto';

jest.mock('../../src/services/admin.service');
jest.mock('../../src/utils/logger');

describe('AdminSecurityService', () => {
  const mockAdminPhone = '+22579999999';
  const mockPin = '1234';
  const mockHashedPin = crypto.createHash('sha256').update(mockPin).digest('hex');

  beforeEach(() => {
    jest.clearAllMocks();
    adminSecurityService['loginAttempts'].clear();
    adminSecurityService['authenticatedAdmins'].clear();
    adminSecurityService['adminPins'].clear();
    adminSecurityService['mfaCodes'].clear();
    adminSecurityService['debugEnabledUsers'].clear();
  });

  describe('PIN Management', () => {
    describe('setAdminPin', () => {
      it('should set admin PIN with proper hashing', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);

        const result = await adminSecurityService.setAdminPin(mockAdminPhone, mockPin);

        expect(result).toBe(true);
        expect(adminSecurityService['adminPins'].get(mockAdminPhone)).toBe(mockHashedPin);
      });

      it('should reject PIN for non-admin', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(false);

        const result = await adminSecurityService.setAdminPin(mockAdminPhone, mockPin);

        expect(result).toBe(false);
        expect(adminSecurityService['adminPins'].has(mockAdminPhone)).toBe(false);
      });

      it('should validate PIN length', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);

        const result = await adminSecurityService.setAdminPin(mockAdminPhone, '12'); // Too short

        expect(result).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid PIN'));
      });
    });

    describe('verifyPin', () => {
      beforeEach(() => {
        adminSecurityService['adminPins'].set(mockAdminPhone, mockHashedPin);
      });

      it('should verify correct PIN', () => {
        const result = adminSecurityService.verifyPin(mockAdminPhone, mockPin);

        expect(result).toBe(true);
        expect(adminSecurityService['authenticatedAdmins'].has(mockAdminPhone)).toBe(true);
        expect(adminSecurityService['loginAttempts'].get(mockAdminPhone)).toBe(0);
      });

      it('should reject incorrect PIN', () => {
        const result = adminSecurityService.verifyPin(mockAdminPhone, 'wrong');

        expect(result).toBe(false);
        expect(adminSecurityService['loginAttempts'].get(mockAdminPhone)).toBe(1);
      });

      it('should lock after max attempts', () => {
        adminSecurityService['loginAttempts'].set(mockAdminPhone, 4);

        const result = adminSecurityService.verifyPin(mockAdminPhone, 'wrong');

        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('locked'));
      });

      it('should return false if no PIN set', () => {
        const result = adminSecurityService.verifyPin('unknown', mockPin);

        expect(result).toBe(false);
      });
    });
  });

  describe('Authentication', () => {
    describe('isAuthenticated', () => {
      it('should return true for authenticated admin', () => {
        adminSecurityService['authenticatedAdmins'].add(mockAdminPhone);

        const result = adminSecurityService.isAuthenticated(mockAdminPhone);

        expect(result).toBe(true);
      });

      it('should return false for non-authenticated user', () => {
        const result = adminSecurityService.isAuthenticated(mockAdminPhone);

        expect(result).toBe(false);
      });
    });

    describe('logout', () => {
      it('should remove admin from authenticated set', () => {
        adminSecurityService['authenticatedAdmins'].add(mockAdminPhone);

        adminSecurityService.logout(mockAdminPhone);

        expect(adminSecurityService['authenticatedAdmins'].has(mockAdminPhone)).toBe(false);
      });
    });

    describe('requiresAuth', () => {
      it('should return true for admin commands', () => {
        expect(adminSecurityService.requiresAuth('/admin add')).toBe(true);
        expect(adminSecurityService.requiresAuth('/blacklist add')).toBe(true);
        expect(adminSecurityService.requiresAuth('/mode')).toBe(true);
      });

      it('should return false for non-admin commands', () => {
        expect(adminSecurityService.requiresAuth('/help')).toBe(false);
        expect(adminSecurityService.requiresAuth('regular message')).toBe(false);
      });
    });
  });

  describe('MFA (Multi-Factor Authentication)', () => {
    describe('generateMFACode', () => {
      it('should generate 6-digit MFA code', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);

        const result = await adminSecurityService.generateMFACode(mockAdminPhone);

        expect(result).toBe(true);
        const code = adminSecurityService['mfaCodes'].get(mockAdminPhone);
        expect(code).toBeDefined();
        expect(code?.code).toMatch(/^\d{6}$/);
      });

      it('should not generate MFA for non-admin', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(false);

        const result = await adminSecurityService.generateMFACode(mockAdminPhone);

        expect(result).toBe(false);
        expect(adminSecurityService['mfaCodes'].has(mockAdminPhone)).toBe(false);
      });

      it('should set expiration time for MFA code', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);

        await adminSecurityService.generateMFACode(mockAdminPhone);

        const mfaData = adminSecurityService['mfaCodes'].get(mockAdminPhone);
        expect(mfaData?.expiresAt).toBeGreaterThan(Date.now());
        expect(mfaData?.expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
      });
    });

    describe('verifyMFACode', () => {
      const mockMFACode = '123456';

      beforeEach(() => {
        adminSecurityService['mfaCodes'].set(mockAdminPhone, {
          code: mockMFACode,
          expiresAt: Date.now() + 5 * 60 * 1000,
          attempts: 0
        });
      });

      it('should verify correct MFA code', () => {
        const result = adminSecurityService.verifyMFACode(mockAdminPhone, mockMFACode);

        expect(result).toBe(true);
        expect(adminSecurityService['mfaCodes'].has(mockAdminPhone)).toBe(false);
      });

      it('should reject incorrect MFA code', () => {
        const result = adminSecurityService.verifyMFACode(mockAdminPhone, '999999');

        expect(result).toBe(false);
        expect(adminSecurityService['mfaCodes'].get(mockAdminPhone)?.attempts).toBe(1);
      });

      it('should reject expired MFA code', () => {
        adminSecurityService['mfaCodes'].set(mockAdminPhone, {
          code: mockMFACode,
          expiresAt: Date.now() - 1000, // Expired
          attempts: 0
        });

        const result = adminSecurityService.verifyMFACode(mockAdminPhone, mockMFACode);

        expect(result).toBe(false);
        expect(adminSecurityService['mfaCodes'].has(mockAdminPhone)).toBe(false);
      });

      it('should lock after max MFA attempts', () => {
        adminSecurityService['mfaCodes'].set(mockAdminPhone, {
          code: mockMFACode,
          expiresAt: Date.now() + 60000,
          attempts: 2
        });

        const result = adminSecurityService.verifyMFACode(mockAdminPhone, '999999');

        expect(result).toBe(false);
        expect(adminSecurityService['mfaCodes'].has(mockAdminPhone)).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Max MFA attempts'));
      });
    });
  });

  describe('Security Validations', () => {
    describe('validateCommandAccess', () => {
      it('should validate admin access for protected commands', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);
        adminSecurityService['authenticatedAdmins'].add(mockAdminPhone);

        const result = await adminSecurityService.validateCommandAccess(
          mockAdminPhone,
          '/admin add +22570000000'
        );

        expect(result.allowed).toBe(true);
      });

      it('should deny access for non-admin', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(false);

        const result = await adminSecurityService.validateCommandAccess(
          mockAdminPhone,
          '/admin add +22570000000'
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not an admin');
      });

      it('should require authentication for admin commands', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);
        // Not authenticated

        const result = await adminSecurityService.validateCommandAccess(
          mockAdminPhone,
          '/blacklist add user123'
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('authenticate');
      });

      it('should allow non-admin commands without auth', async () => {
        const result = await adminSecurityService.validateCommandAccess(
          'anyuser',
          '/help'
        );

        expect(result.allowed).toBe(true);
      });
    });

    describe('validatePhoneNumber', () => {
      it('should validate correct phone format', () => {
        expect(adminSecurityService.validatePhoneNumber('+22579999999')).toBe(true);
        expect(adminSecurityService.validatePhoneNumber('+1234567890')).toBe(true);
      });

      it('should reject invalid phone format', () => {
        expect(adminSecurityService.validatePhoneNumber('22579999999')).toBe(false); // Missing +
        expect(adminSecurityService.validatePhoneNumber('+225')).toBe(false); // Too short
        expect(adminSecurityService.validatePhoneNumber('notaphone')).toBe(false);
      });
    });

    describe('sanitizeInput', () => {
      it('should sanitize dangerous input', () => {
        const dangerous = '<script>alert("xss")</script>';
        const sanitized = adminSecurityService.sanitizeInput(dangerous);

        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      });

      it('should handle SQL injection attempts', () => {
        const sqlInjection = "'; DROP TABLE users; --";
        const sanitized = adminSecurityService.sanitizeInput(sqlInjection);

        expect(sanitized).toBe('&#x27;; DROP TABLE users; --');
      });
    });
  });

  describe('Debug Mode', () => {
    describe('enableDebugMode', () => {
      it('should enable debug for admin', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);

        const result = await adminSecurityService.enableDebugMode(mockAdminPhone);

        expect(result).toBe(true);
        expect(adminSecurityService.isDebugEnabled(mockAdminPhone)).toBe(true);
      });

      it('should auto-disable debug after timeout', async () => {
        jest.useFakeTimers();
        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);

        await adminSecurityService.enableDebugMode(mockAdminPhone);
        
        expect(adminSecurityService.isDebugEnabled(mockAdminPhone)).toBe(true);

        // Fast forward 30 minutes
        jest.advanceTimersByTime(30 * 60 * 1000);

        expect(adminSecurityService.isDebugEnabled(mockAdminPhone)).toBe(false);

        jest.useRealTimers();
      });

      it('should not enable debug for non-admin', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(false);

        const result = await adminSecurityService.enableDebugMode('regular-user');

        expect(result).toBe(false);
      });
    });

    describe('disableDebugMode', () => {
      it('should disable debug mode', () => {
        adminSecurityService['debugEnabledUsers'].set(mockAdminPhone, {
          enabled: true,
          enabledAt: Date.now()
        });

        adminSecurityService.disableDebugMode(mockAdminPhone);

        expect(adminSecurityService.isDebugEnabled(mockAdminPhone)).toBe(false);
      });
    });
  });

  describe('Security Audit', () => {
    describe('getSecurityEvents', () => {
      it('should track security events', () => {
        // Simulate some security events
        adminSecurityService.verifyPin(mockAdminPhone, 'wrong');
        adminSecurityService.verifyPin('attacker', 'hack');

        const events = adminSecurityService.getSecurityEvents();

        expect(events.failedLogins).toBeGreaterThan(0);
        expect(events.lastFailedAttempts).toHaveLength(Math.min(events.failedLogins, 10));
      });
    });

    describe('clearSecurityData', () => {
      it('should clear all security data for admin', async () => {
        // Set up some data
        adminSecurityService['authenticatedAdmins'].add(mockAdminPhone);
        adminSecurityService['mfaCodes'].set(mockAdminPhone, {
          code: '123456',
          expiresAt: Date.now() + 60000,
          attempts: 0
        });
        adminSecurityService['loginAttempts'].set(mockAdminPhone, 2);

        (adminService.isAdmin as jest.Mock).mockResolvedValue(true);

        const result = await adminSecurityService.clearSecurityData(mockAdminPhone);

        expect(result).toBe(true);
        expect(adminSecurityService['authenticatedAdmins'].has(mockAdminPhone)).toBe(false);
        expect(adminSecurityService['mfaCodes'].has(mockAdminPhone)).toBe(false);
        expect(adminSecurityService['loginAttempts'].get(mockAdminPhone)).toBe(0);
      });

      it('should not clear data for non-admin', async () => {
        (adminService.isAdmin as jest.Mock).mockResolvedValue(false);

        const result = await adminSecurityService.clearSecurityData('regular-user');

        expect(result).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should track and limit login attempts', () => {
      // First 5 attempts should work
      for (let i = 0; i < 5; i++) {
        adminSecurityService.verifyPin(mockAdminPhone, 'wrong');
      }

      expect(adminSecurityService['loginAttempts'].get(mockAdminPhone)).toBe(5);
      
      // Should be locked now
      const result = adminSecurityService.verifyPin(mockAdminPhone, mockPin);
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('locked'));
    });

    it('should reset attempts on successful login', () => {
      adminSecurityService['adminPins'].set(mockAdminPhone, mockHashedPin);
      adminSecurityService['loginAttempts'].set(mockAdminPhone, 3);

      adminSecurityService.verifyPin(mockAdminPhone, mockPin);

      expect(adminSecurityService['loginAttempts'].get(mockAdminPhone)).toBe(0);
    });
  });
});