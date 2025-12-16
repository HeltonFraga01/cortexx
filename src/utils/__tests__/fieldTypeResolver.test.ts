import { describe, it, expect } from 'vitest';
import {
  FieldTypeResolver,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidNumber,
  isValidDecimal,
  isValidDate,
  formatPhoneNumber,
  normalizeUrl
} from '../fieldTypeResolver';
import { FieldType } from '@/lib/types';

describe('FieldTypeResolver', () => {
  describe('resolveFieldType', () => {
    it('should map SingleLineText to TEXT', () => {
      expect(FieldTypeResolver.resolveFieldType('SingleLineText')).toBe(FieldType.TEXT);
    });

    it('should map LongText to LONG_TEXT', () => {
      expect(FieldTypeResolver.resolveFieldType('LongText')).toBe(FieldType.LONG_TEXT);
    });

    it('should map Number to NUMBER', () => {
      expect(FieldTypeResolver.resolveFieldType('Number')).toBe(FieldType.NUMBER);
    });

    it('should map Decimal to DECIMAL', () => {
      expect(FieldTypeResolver.resolveFieldType('Decimal')).toBe(FieldType.DECIMAL);
    });

    it('should map Currency to CURRENCY', () => {
      expect(FieldTypeResolver.resolveFieldType('Currency')).toBe(FieldType.CURRENCY);
    });

    it('should map Percent to PERCENT', () => {
      expect(FieldTypeResolver.resolveFieldType('Percent')).toBe(FieldType.PERCENT);
    });

    it('should map Date to DATE', () => {
      expect(FieldTypeResolver.resolveFieldType('Date')).toBe(FieldType.DATE);
    });

    it('should map DateTime to DATETIME', () => {
      expect(FieldTypeResolver.resolveFieldType('DateTime')).toBe(FieldType.DATETIME);
    });

    it('should map Time to TIME', () => {
      expect(FieldTypeResolver.resolveFieldType('Time')).toBe(FieldType.TIME);
    });

    it('should map SingleSelect to SINGLE_SELECT', () => {
      expect(FieldTypeResolver.resolveFieldType('SingleSelect')).toBe(FieldType.SINGLE_SELECT);
    });

    it('should map MultiSelect to MULTI_SELECT', () => {
      expect(FieldTypeResolver.resolveFieldType('MultiSelect')).toBe(FieldType.MULTI_SELECT);
    });

    it('should map Checkbox to CHECKBOX', () => {
      expect(FieldTypeResolver.resolveFieldType('Checkbox')).toBe(FieldType.CHECKBOX);
    });

    it('should map Email to EMAIL', () => {
      expect(FieldTypeResolver.resolveFieldType('Email')).toBe(FieldType.EMAIL);
    });

    it('should map PhoneNumber to PHONE', () => {
      expect(FieldTypeResolver.resolveFieldType('PhoneNumber')).toBe(FieldType.PHONE);
    });

    it('should map URL to URL', () => {
      expect(FieldTypeResolver.resolveFieldType('URL')).toBe(FieldType.URL);
    });

    it('should default to TEXT for unknown types', () => {
      expect(FieldTypeResolver.resolveFieldType('UnknownType')).toBe(FieldType.TEXT);
    });
  });

  describe('extractSelectOptions', () => {
    it('should extract options from column metadata', () => {
      const columnMeta = {
        colOptions: {
          options: [
            { id: '1', title: 'Option 1', color: 'red' },
            { id: '2', title: 'Option 2', color: 'blue' }
          ]
        }
      };

      const options = FieldTypeResolver.extractSelectOptions(columnMeta as any);
      
      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({ id: '1', title: 'Option 1', color: 'red' });
      expect(options[1]).toEqual({ id: '2', title: 'Option 2', color: 'blue' });
    });

    it('should use title as id if id is missing', () => {
      const columnMeta = {
        colOptions: {
          options: [
            { title: 'Option 1' }
          ]
        }
      };

      const options = FieldTypeResolver.extractSelectOptions(columnMeta as any);
      
      expect(options[0].id).toBe('Option 1');
    });

    it('should return empty array if no options', () => {
      const columnMeta = { colOptions: {} };
      const options = FieldTypeResolver.extractSelectOptions(columnMeta as any);
      expect(options).toEqual([]);
    });

    it('should return empty array if colOptions is undefined', () => {
      const columnMeta = {};
      const options = FieldTypeResolver.extractSelectOptions(columnMeta as any);
      expect(options).toEqual([]);
    });
  });

  describe('requiresValidation', () => {
    it('should return true for EMAIL', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.EMAIL)).toBe(true);
    });

    it('should return true for PHONE', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.PHONE)).toBe(true);
    });

    it('should return true for URL', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.URL)).toBe(true);
    });

    it('should return true for NUMBER', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.NUMBER)).toBe(true);
    });

    it('should return true for DECIMAL', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.DECIMAL)).toBe(true);
    });

    it('should return true for DATE', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.DATE)).toBe(true);
    });

    it('should return true for DATETIME', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.DATETIME)).toBe(true);
    });

    it('should return false for TEXT', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.TEXT)).toBe(false);
    });

    it('should return false for CHECKBOX', () => {
      expect(FieldTypeResolver.requiresValidation(FieldType.CHECKBOX)).toBe(false);
    });
  });

  describe('columnToFieldMetadata', () => {
    it('should convert NocoDB column to FieldMetadata', () => {
      const column = {
        column_name: 'email',
        title: 'Email Address',
        uidt: 'Email',
        rqd: true,
        pk: false,
        ai: false,
        cop: 1,
        meta: { some: 'data' }
      };

      const metadata = FieldTypeResolver.columnToFieldMetadata(column as any);
      
      expect(metadata.columnName).toBe('email');
      expect(metadata.label).toBe('Email Address');
      expect(metadata.type).toBe(FieldType.EMAIL);
      expect(metadata.uidt).toBe('Email');
      expect(metadata.required).toBe(true);
      expect(metadata.editable).toBe(true);
      expect(metadata.visible).toBe(true);
      expect(metadata.displayOrder).toBe(1);
    });

    it('should mark primary key as not editable', () => {
      const column = {
        column_name: 'id',
        title: 'ID',
        uidt: 'Number',
        pk: true,
        ai: false,
        rqd: false
      };

      const metadata = FieldTypeResolver.columnToFieldMetadata(column as any);
      expect(metadata.editable).toBe(false);
    });

    it('should mark auto-increment as not editable', () => {
      const column = {
        column_name: 'id',
        title: 'ID',
        uidt: 'Number',
        pk: false,
        ai: true,
        rqd: false
      };

      const metadata = FieldTypeResolver.columnToFieldMetadata(column as any);
      expect(metadata.editable).toBe(false);
    });
  });
});

describe('isValidEmail', () => {
  it('should validate correct email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('should handle empty and null values', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
  });

  it('should trim whitespace', () => {
    expect(isValidEmail('  test@example.com  ')).toBe(true);
  });
});

describe('isValidPhone', () => {
  it('should validate Brazilian phone numbers', () => {
    expect(isValidPhone('(11) 98765-4321')).toBe(true);
    expect(isValidPhone('(11) 8765-4321')).toBe(true);
    expect(isValidPhone('11987654321')).toBe(true);
    expect(isValidPhone('+55 11 98765-4321')).toBe(true);
  });

  it('should validate international phone numbers', () => {
    expect(isValidPhone('+1234567890')).toBe(true);
    expect(isValidPhone('+12345678901234')).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('12345678901234567890')).toBe(false);
  });

  it('should handle empty and null values', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone(null as any)).toBe(false);
    expect(isValidPhone(undefined as any)).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('should validate URLs with protocol', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('https://sub.example.com/path')).toBe(true);
  });

  it('should validate URLs without protocol', () => {
    expect(isValidUrl('example.com')).toBe(true);
    expect(isValidUrl('www.example.com')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  it('should handle empty and null values', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl(null as any)).toBe(false);
    expect(isValidUrl(undefined as any)).toBe(false);
  });

  it('should trim whitespace', () => {
    expect(isValidUrl('  https://example.com  ')).toBe(true);
  });
});

describe('isValidNumber', () => {
  it('should validate numbers', () => {
    expect(isValidNumber(123)).toBe(true);
    expect(isValidNumber('123')).toBe(true);
    expect(isValidNumber(123.45)).toBe(true);
    expect(isValidNumber('123.45')).toBe(true);
    expect(isValidNumber(-123)).toBe(true);
    expect(isValidNumber(0)).toBe(true);
  });

  it('should reject invalid numbers', () => {
    expect(isValidNumber('abc')).toBe(false);
    expect(isValidNumber('12abc')).toBe(false);
    expect(isValidNumber(NaN)).toBe(false);
    expect(isValidNumber(Infinity)).toBe(false);
  });

  it('should handle empty and null values', () => {
    expect(isValidNumber('')).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber(undefined)).toBe(false);
  });
});

describe('isValidDecimal', () => {
  it('should validate decimal numbers', () => {
    expect(isValidDecimal(123.45)).toBe(true);
    expect(isValidDecimal('123.45')).toBe(true);
    expect(isValidDecimal(123)).toBe(true);
  });

  it('should validate precision', () => {
    expect(isValidDecimal(123.45, 2)).toBe(true);
    expect(isValidDecimal(123.456, 2)).toBe(false);
    expect(isValidDecimal(123.4, 2)).toBe(true);
  });

  it('should reject invalid decimals', () => {
    expect(isValidDecimal('abc')).toBe(false);
    expect(isValidDecimal(NaN)).toBe(false);
  });
});

describe('isValidDate', () => {
  it('should validate Date objects', () => {
    expect(isValidDate(new Date())).toBe(true);
    expect(isValidDate(new Date('2024-01-01'))).toBe(true);
  });

  it('should validate ISO date strings', () => {
    expect(isValidDate('2024-01-01')).toBe(true);
    expect(isValidDate('2024-01-01T12:00:00Z')).toBe(true);
  });

  it('should reject invalid dates', () => {
    expect(isValidDate('invalid')).toBe(false);
    expect(isValidDate('2024-13-01')).toBe(false);
  });

  it('should handle empty and null values', () => {
    expect(isValidDate('')).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe('formatPhoneNumber', () => {
  it('should format 11-digit Brazilian phone', () => {
    expect(formatPhoneNumber('11987654321')).toBe('(11) 98765-4321');
  });

  it('should format 10-digit Brazilian phone', () => {
    expect(formatPhoneNumber('1187654321')).toBe('(11) 8765-4321');
  });

  it('should return original for other formats', () => {
    // formatPhoneNumber only formats 10 or 11 digit numbers
    // Numbers with different lengths are returned as-is
    expect(formatPhoneNumber('123456789')).toBe('123456789');
  });

  it('should handle empty values', () => {
    expect(formatPhoneNumber('')).toBe('');
  });
});

describe('normalizeUrl', () => {
  it('should add https:// to URLs without protocol', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
  });

  it('should not modify URLs with protocol', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('should handle empty values', () => {
    expect(normalizeUrl('')).toBe('');
  });

  it('should trim whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
  });
});
