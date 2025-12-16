import { FieldType, FieldMetadata } from '@/lib/types';

/**
 * Format field value for API submission
 * Converts values to the format expected by NocoDB/backend
 */
export function formatValueForSubmission(
  field: FieldMetadata,
  value: any
): any {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  switch (field.type) {
    case FieldType.DATE:
      return formatDateForSubmission(value);

    case FieldType.DATETIME:
      return formatDateTimeForSubmission(value);

    case FieldType.TIME:
      return formatTimeForSubmission(value);

    case FieldType.NUMBER:
    case FieldType.DECIMAL:
    case FieldType.CURRENCY:
    case FieldType.PERCENT:
      return formatNumberForSubmission(value);

    case FieldType.MULTI_SELECT:
      return formatMultiSelectForSubmission(value);

    case FieldType.CHECKBOX:
      return Boolean(value);

    case FieldType.JSON:
      return formatJsonForSubmission(value);

    case FieldType.TEXT:
    case FieldType.LONG_TEXT:
    case FieldType.EMAIL:
    case FieldType.PHONE:
    case FieldType.URL:
      return sanitizeTextForSubmission(value);

    default:
      return value;
  }
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function formatDateForSubmission(value: any): string | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  
  if (isNaN(date.getTime())) {
    return null;
  }

  // Return ISO date string (YYYY-MM-DD)
  return date.toISOString().split('T')[0];
}

/**
 * Format datetime to ISO string
 */
function formatDateTimeForSubmission(value: any): string | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  
  if (isNaN(date.getTime())) {
    return null;
  }

  // Return full ISO string
  return date.toISOString();
}

/**
 * Format time to HH:mm or HH:mm:ss
 */
function formatTimeForSubmission(value: any): string | null {
  if (!value) return null;

  // If already a string in correct format, return as is
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return value;
  }

  return String(value);
}

/**
 * Format number with proper precision
 */
function formatNumberForSubmission(value: any): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const num = Number(value);
  
  if (isNaN(num)) {
    return null;
  }

  return num;
}

/**
 * Ensure multi-select values are arrays
 */
function formatMultiSelectForSubmission(value: any): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    // Split comma-separated values
    return value.split(',').map(v => v.trim()).filter(v => v);
  }

  return [];
}

/**
 * Format JSON for submission
 */
function formatJsonForSubmission(value: any): any {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

/**
 * Sanitize text input (trim whitespace, remove null bytes)
 */
function sanitizeTextForSubmission(value: any): string {
  if (typeof value !== 'string') {
    return String(value || '');
  }

  // Trim whitespace and remove null bytes
  return value.trim().replace(/\0/g, '');
}

/**
 * Format all fields in a record for submission
 */
export function formatRecordForSubmission(
  fields: FieldMetadata[],
  record: Record<string, any>
): Record<string, any> {
  const formatted: Record<string, any> = {};

  fields.forEach(field => {
    if (field.editable && field.columnName in record) {
      formatted[field.columnName] = formatValueForSubmission(
        field,
        record[field.columnName]
      );
    }
  });

  return formatted;
}

/**
 * Format only changed fields for submission
 */
export function formatChangedFieldsForSubmission(
  fields: FieldMetadata[],
  currentRecord: Record<string, any>,
  originalRecord: Record<string, any>
): Record<string, any> {
  const formatted: Record<string, any> = {};

  fields.forEach(field => {
    if (field.editable && field.columnName in currentRecord) {
      const currentValue = currentRecord[field.columnName];
      const originalValue = originalRecord[field.columnName];

      // Only include changed fields
      if (currentValue !== originalValue) {
        formatted[field.columnName] = formatValueForSubmission(field, currentValue);
      }
    }
  });

  return formatted;
}
