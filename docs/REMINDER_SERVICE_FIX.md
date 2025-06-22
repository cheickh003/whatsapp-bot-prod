# Reminder Service Temporary Fix

## Issue
The reminder service was causing recurring Appwrite 500 errors every minute when trying to query the reminders collection. This was flooding the logs and potentially affecting performance.

## Root Cause
The Appwrite query in `checkAndSendReminders()` method appears to be failing, possibly due to:
1. Missing or incorrect indexes on the `reminders` collection
2. Query syntax issues with the filter `status="active"`
3. Appwrite service configuration issues

## Temporary Solution Applied
1. **Disabled the reminder checker** - Commented out the `startReminderChecker()` call in the initialization
2. **Preserved the code** - All reminder-related methods are preserved in comments for easy re-enablement
3. **Service still initializes** - The reminder service still creates the collection and attributes, allowing reminders to be created but not automatically triggered

## Files Modified
- `src/services/reminder.service.ts` - Disabled automatic reminder checking
- `src/config/features.config.ts` - Added feature flag configuration (for future use)

## To Re-enable Reminders
1. Fix the Appwrite query issue:
   - Check if the `reminders` collection exists in Appwrite
   - Verify all attributes are properly created
   - Add proper indexes for the query fields (status, nextTrigger)
   
2. Uncomment the disabled code in `reminder.service.ts`:
   - Remove comment blocks around `startReminderChecker()`, `checkAndSendReminders()`, `sendReminder()`, and `calculateNextTrigger()` methods
   - Uncomment the `whatsappService` import
   - Uncomment the `startReminderChecker()` call in `initialize()`

3. Test thoroughly before deploying

## Alternative Solutions
1. Use a different query approach (e.g., fetch all reminders and filter in memory)
2. Implement a separate cron job service for reminders
3. Use Appwrite Functions instead of polling

## Current Status
- ✅ Bot runs without errors
- ✅ All other features work normally
- ⚠️ Reminders can be created but won't trigger automatically
- ⚠️ Users need to be informed that reminders are temporarily unavailable