import { FieldType, FieldMetadata, SelectOption, NocoDBColumnMetadata } from '@/lib/types';

/**
 * Utility class for resolving field types from NocoDB metadata
 * and providing validation helpers for different field types
 */
export class FieldTypeResolver {
  /**
   * Maps NocoDB uidt (UI Data Type) to our internal FieldType enum
   * @param uidt - NocoDB UI Data Type string
   * @returns Corresponding FieldType enum value
   */
  static resolveFieldType(uidt: string): FieldType {
    const typeMap: Record<string, FieldType> = {
      'SingleLineText': FieldType.TEXT,
      'LongText': FieldType.LONG_TEXT,
      'Number': FieldType.NUMBER,
      'Decimal': FieldType.DECIMAL,
      'Currency': FieldType.CURRENCY,
      'Percent': FieldType.PERCENT,
      'Date': FieldType.DATE,
      'DateTime': FieldType.DATETIME,
      'Time': FieldType.TIME,
      'Year': FieldType.YEAR,
      'SingleSelect': FieldType.SINGLE_SELECT,
      'MultiSelect': FieldType.MULTI_SELECT,
      'Checkbox': FieldType.CHECKBOX,
      'Email': FieldType.EMAIL,
      'PhoneNumber': FieldType.PHONE,
      'URL': FieldType.URL,
      'Rating': FieldType.RATING,
      'Duration': FieldType.DURATION,
      'Attachment': FieldType.ATTACHMENT,
      'User': FieldType.USER,
      'JSON': FieldType.JSON
    };
    
    return typeMap[uidt] || FieldType.TEXT;
  }
  
  /**
   * Extracts select options from NocoDB column metadata
   * @param columnMeta - NocoDB column metadata object
   * @returns Array of SelectOption objects
   */
  static extractSelectOptions(columnMeta: NocoDBColumnMetadata): SelectOption[] {
    if (!columnMeta.colOptions?.options) {
      return [];
    }
    
    return columnMeta.colOptions.options.map((opt) => ({
      id: opt.id || opt.title,
      title: opt.title,
      color: opt.color
    }));
  }
  
  /**
   * Determines if a field type requires special validation
   * @param type - FieldType enum value
   * @returns True if the field type requires validation
   */
  static requiresValidation(type: FieldType): boolean {
    return [
      FieldType.EMAIL,
      FieldType.PHONE,
      FieldType.URL,
      FieldType.NUMBER,
      FieldType.DECIMAL,
      FieldType.DATE,
      FieldType.DATETIME
    ].includes(type);
  }
  
  /**
   * Converts NocoDB column metadata to our FieldMetadata format
   * @param column - NocoDB column metadata
   * @returns FieldMetadata object
   */
  static columnToFieldMetadata(column: NocoDBColumnMetadata): FieldMetadata {
    const fieldType = this.resolveFieldType(column.uidt);
    
    return {
      columnName: column.column_name,
      label: column.title,
      type: fieldType,
      uidt: column.uidt,
      required: column.rqd || false,
      editable: !column.pk && !column.ai, // Not editable if primary key or auto-increment
      visible: true,
      options: this.extractSelectOptions(column),
      meta: column.meta,
      displayOrder: column.cop
    };
  }
}

/**
 * Validates email format
 * @param email - Email string to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates phone number format (Brazilian format with international support)
 * @param phone - Phone number string to validate
 * @returns True if valid phone format
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Brazilian phone: 10-11 digits (with area code)
  // International: 10-15 digits
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return false;
  }
  
  // Brazilian format validation (optional)
  // Format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  const brazilianRegex = /^(\+?55\s?)?(\(?\d{2}\)?\s?)?(9?\d{4})-?(\d{4})$/;
  
  // International format validation
  const internationalRegex = /^\+?\d{10,15}$/;
  
  return brazilianRegex.test(phone) || internationalRegex.test(digitsOnly);
}

/**
 * Validates URL format
 * @param url - URL string to validate
 * @returns True if valid URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    // Try to construct a URL object
    const urlObj = new URL(url.trim());
    
    // Check if protocol is http or https
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    // If URL constructor fails, try with https:// prefix
    try {
      const urlWithProtocol = url.trim().startsWith('http') 
        ? url.trim() 
        : `https://${url.trim()}`;
      const urlObj = new URL(urlWithProtocol);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

/**
 * Validates number format
 * @param value - Value to validate as number
 * @returns True if valid number
 */
export function isValidNumber(value: any): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

/**
 * Validates decimal format with optional precision
 * @param value - Value to validate as decimal
 * @param precision - Optional decimal precision (number of decimal places)
 * @returns True if valid decimal
 */
export function isValidDecimal(value: any, precision?: number): boolean {
  if (!isValidNumber(value)) {
    return false;
  }
  
  if (precision !== undefined) {
    const decimalPart = String(value).split('.')[1];
    if (decimalPart && decimalPart.length > precision) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validates date format (ISO 8601 or Date object)
 * @param date - Date string or Date object to validate
 * @returns True if valid date
 */
export function isValidDate(date: any): boolean {
  if (!date) {
    return false;
  }
  
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj.getTime());
}

/**
 * Formats a phone number to Brazilian format
 * @param phone - Phone number string
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Brazilian format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  if (digitsOnly.length === 11) {
    return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`;
  } else if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 2)}) ${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
  }
  
  return phone;
}

/**
 * Normalizes a URL by adding protocol if missing
 * @param url - URL string
 * @returns Normalized URL with protocol
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  
  const trimmed = url.trim();
  
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  return `https://${trimmed}`;
}
