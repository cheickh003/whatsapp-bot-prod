import { jarvisConfig } from '../config/jarvis.config';

/**
 * Utility functions for date handling with Abidjan timezone (GMT+0)
 */

/**
 * Get current date in Abidjan timezone
 */
export function getAbidjanDate(): Date {
  return new Date();
}

/**
 * Get current ISO string in Abidjan timezone
 */
export function getAbidjanISOString(): string {
  return new Date().toISOString();
}

/**
 * Format date for display in French
 */
export function formatDateFR(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: jarvisConfig.businessHours.timezone
  };
  
  return dateObj.toLocaleDateString('fr-CI', options);
}

/**
 * Format time for display
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleTimeString('fr-CI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: jarvisConfig.businessHours.timezone
  });
}

/**
 * Format date for short display (DD/MM/YYYY)
 */
export function formatDateShort(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('fr-CI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: jarvisConfig.businessHours.timezone
  });
}

/**
 * Get relative time (il y a X minutes/heures/jours)
 */
export function getRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'à l\'instant';
  if (diffMins < 60) return `il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 30) return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  
  return formatDateShort(dateObj);
}

/**
 * Check if date is within business hours
 */
export function isWithinBusinessHours(date: Date = new Date()): boolean {
  const day = date.getDay();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const time = hours * 100 + minutes;
  
  const { weekdays, weekends } = jarvisConfig.businessHours;
  
  // Monday to Friday
  if (day >= 1 && day <= 5) {
    const start = parseInt(weekdays.start.replace(':', ''));
    const end = parseInt(weekdays.end.replace(':', ''));
    return time >= start && time <= end;
  }
  
  // Saturday
  if (day === 6 && weekends.saturday) {
    const start = parseInt(weekends.saturday.start.replace(':', ''));
    const end = parseInt(weekends.saturday.end.replace(':', ''));
    return time >= start && time <= end;
  }
  
  // Sunday (closed)
  return false;
}

/**
 * Get next business day
 */
export function getNextBusinessDay(date: Date = new Date()): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  while (!isBusinessDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

/**
 * Check if date is a business day
 */
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 6; // Monday to Saturday
}

/**
 * Parse date string with multiple formats support
 */
export function parseDate(dateStr: string): Date | null {
  // Try different date formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[2]) {
        // YYYY-MM-DD format
        return new Date(`${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}`);
      } else {
        // DD/MM/YYYY or DD-MM-YYYY format
        return new Date(`${match[3]}-${match[2]?.padStart(2, '0')}-${match[1]?.padStart(2, '0')}`);
      }
    }
  }
  
  // Try native parsing as fallback
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Add business days to a date
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      addedDays++;
    }
  }
  
  return result;
}