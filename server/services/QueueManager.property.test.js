/**
 * Property-Based Tests for QueueManager Service
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * that should hold across all valid inputs.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const QueueManager = require('./QueueManager');

describe('QueueManager Property-Based Tests', () => {
  /**
   * Feature: disparador-review-cleanup, Property 4: Sending Window Enforcement
   * Validates: Requirements 1.4
   * 
   * For any campaign with a sending window, messages SHALL only be sent 
   * during the configured time window and allowed days.
   */
  describe('Property 4: Sending Window Enforcement', () => {
    // Helper to create a Date from hours and minutes
    const createTime = (hours, minutes, dayOfWeek = 1) => {
      // Create a date for a specific day of week (0=Sunday, 1=Monday, etc.)
      const date = new Date(2025, 0, 5 + dayOfWeek); // Jan 5, 2025 is a Sunday
      date.setHours(hours, minutes, 0, 0);
      return date;
    };

    // Arbitrary for valid time in HH:mm format
    const timeArb = fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

    // Arbitrary for day of week (0-6)
    const dayArb = fc.integer({ min: 0, max: 6 });

    // Arbitrary for array of allowed days
    const daysArrayArb = fc.array(dayArb, { minLength: 0, maxLength: 7 })
      .map(days => [...new Set(days)]); // Remove duplicates

    it('time within window returns true', () => {
      fc.assert(
        fc.property(
          // Generate start hour (0-22 to leave room for end)
          fc.integer({ min: 0, max: 22 }),
          // Generate window duration in hours (1-23)
          fc.integer({ min: 1, max: 23 }),
          // Generate offset within window (0-99 percent)
          fc.integer({ min: 0, max: 99 }),
          (startHour, duration, offsetPercent) => {
            // Calculate end hour (wrap around if needed, but keep valid)
            const endHour = Math.min(startHour + duration, 23);
            if (endHour <= startHour) return true; // Skip invalid windows

            const startTime = `${startHour.toString().padStart(2, '0')}:00`;
            const endTime = `${endHour.toString().padStart(2, '0')}:00`;

            // Calculate a time within the window
            const windowDurationMinutes = (endHour - startHour) * 60;
            const offsetMinutes = Math.floor(windowDurationMinutes * (offsetPercent / 100));
            const testHour = startHour + Math.floor(offsetMinutes / 60);
            const testMinute = offsetMinutes % 60;

            const sendingWindow = { startTime, endTime };
            const testTime = createTime(testHour, testMinute);

            const result = QueueManager.isWithinSendingWindow(sendingWindow, testTime);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('time before window returns false', () => {
      fc.assert(
        fc.property(
          // Generate start hour (1-23 to have room before)
          fc.integer({ min: 1, max: 23 }),
          // Generate end hour (must be > start)
          fc.integer({ min: 2, max: 23 }),
          // Generate minutes before start (1-60)
          fc.integer({ min: 1, max: 60 }),
          (startHour, endHourOffset, minutesBefore) => {
            const endHour = Math.min(startHour + 1, 23);
            if (endHour <= startHour) return true; // Skip invalid

            const startTime = `${startHour.toString().padStart(2, '0')}:00`;
            const endTime = `${endHour.toString().padStart(2, '0')}:00`;

            // Calculate time before window
            const testMinutes = startHour * 60 - minutesBefore;
            if (testMinutes < 0) return true; // Skip if would be negative

            const testHour = Math.floor(testMinutes / 60);
            const testMinute = testMinutes % 60;

            const sendingWindow = { startTime, endTime };
            const testTime = createTime(testHour, testMinute);

            const result = QueueManager.isWithinSendingWindow(sendingWindow, testTime);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('time at or after window end returns false', () => {
      fc.assert(
        fc.property(
          // Generate start hour (0-21)
          fc.integer({ min: 0, max: 21 }),
          // Generate window duration (1-2 hours)
          fc.integer({ min: 1, max: 2 }),
          // Generate minutes after end (0-60)
          fc.integer({ min: 0, max: 60 }),
          (startHour, duration, minutesAfter) => {
            const endHour = Math.min(startHour + duration, 23);
            if (endHour <= startHour) return true; // Skip invalid

            const startTime = `${startHour.toString().padStart(2, '0')}:00`;
            const endTime = `${endHour.toString().padStart(2, '0')}:00`;

            // Calculate time at or after window end
            const testMinutes = endHour * 60 + minutesAfter;
            if (testMinutes >= 24 * 60) return true; // Skip if past midnight

            const testHour = Math.floor(testMinutes / 60);
            const testMinute = testMinutes % 60;

            const sendingWindow = { startTime, endTime };
            const testTime = createTime(testHour, testMinute);

            const result = QueueManager.isWithinSendingWindow(sendingWindow, testTime);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('day not in allowed days returns false', () => {
      fc.assert(
        fc.property(
          // Generate a non-empty array of allowed days
          fc.array(dayArb, { minLength: 1, maxLength: 6 })
            .map(days => [...new Set(days)]),
          // Generate a day to test
          dayArb,
          (allowedDays, testDay) => {
            // Only test when testDay is NOT in allowedDays
            if (allowedDays.includes(testDay)) return true;

            const sendingWindow = {
              startTime: '09:00',
              endTime: '18:00',
              days: allowedDays
            };

            // Create a time within the time window but on wrong day
            const testTime = createTime(12, 0, testDay);

            const result = QueueManager.isWithinSendingWindow(sendingWindow, testTime);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('day in allowed days with valid time returns true', () => {
      fc.assert(
        fc.property(
          // Generate a non-empty array of allowed days
          fc.array(dayArb, { minLength: 1, maxLength: 7 })
            .map(days => [...new Set(days)]),
          (allowedDays) => {
            if (allowedDays.length === 0) return true;

            // Pick a day from allowed days
            const testDay = allowedDays[0];

            const sendingWindow = {
              startTime: '09:00',
              endTime: '18:00',
              days: allowedDays
            };

            // Create a time within the time window on allowed day
            const testTime = createTime(12, 0, testDay);

            const result = QueueManager.isWithinSendingWindow(sendingWindow, testTime);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty or undefined days array allows all days', () => {
      fc.assert(
        fc.property(
          dayArb,
          fc.boolean(),
          (testDay, useEmptyArray) => {
            const sendingWindow = {
              startTime: '09:00',
              endTime: '18:00',
              days: useEmptyArray ? [] : undefined
            };

            // Create a time within the time window
            const testTime = createTime(12, 0, testDay);

            const result = QueueManager.isWithinSendingWindow(sendingWindow, testTime);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('null or undefined sending window allows all times', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          dayArb,
          fc.boolean(),
          (hour, minute, day, useNull) => {
            const sendingWindow = useNull ? null : undefined;
            const testTime = createTime(hour, minute, day);

            const result = QueueManager.isWithinSendingWindow(sendingWindow, testTime);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('missing startTime or endTime allows all times', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          fc.constantFrom('startTime', 'endTime', 'both'),
          (hour, minute, missingField) => {
            let sendingWindow;
            if (missingField === 'startTime') {
              sendingWindow = { endTime: '18:00' };
            } else if (missingField === 'endTime') {
              sendingWindow = { startTime: '09:00' };
            } else {
              sendingWindow = {};
            }

            const testTime = createTime(hour, minute);

            const result = QueueManager.isWithinSendingWindow(sendingWindow, testTime);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
