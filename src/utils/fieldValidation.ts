import { FieldType, FieldMetadata, SelectOption } from '@/lib/types';
import {
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isValidNumber,
  isValidDecimal,
  isValidDate
} from './fieldTypeResolver';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate a field value based on its type and metadata
 */
export function validateFieldValue(
  field: FieldMetadata,
  value: any
): ValidationResult {
  // Check required fields
  if (field.required && (value === null || value === undefined || value === '')) {
    return {
      isValid: false,
      error: `${field.label} é obrigatório`
    };
  }

  // If value is empty and not required, it's valid
  if (value === null || value === undefined || value === '') {
    return { isValid: true };
  }

  // Type-specific validation
  switch (field.type) {
    case FieldType.EMAIL:
      return validateEmail(value);

    case FieldType.PHONE:
      return validatePhone(value);

    case FieldType.URL:
      return validateUrl(value);

    case FieldType.NUMBER:
      return validateNumber(value);

    case FieldType.DECIMAL:
    case FieldType.CURRENCY:
    case FieldType.PERCENT:
      return validateDecimal(value);

    case FieldType.DATE:
    case FieldType.DATETIME:
      return validateDate(value);

    case FieldType.SINGLE_SELECT:
      return validateSingleSelect(value, field.options || []);

    case FieldType.MULTI_SELECT:
      return validateMultiSelect(value, field.options || []);

    case FieldType.YEAR:
      return validateYear(value);

    case FieldType.RATING:
      return validateRating(value);

    case FieldType.JSON:
      return validateJson(value);

    default:
      return { isValid: true };
  }
}

/**
 * Validate email format
 */
export function validateEmail(value: string): ValidationResult {
  if (!isValidEmail(value)) {
    return {
      isValid: false,
      error: 'Email inválido. Use o formato: email@exemplo.com'
    };
  }
  return { isValid: true };
}

/**
 * Validate phone number format
 */
export function validatePhone(value: string): ValidationResult {
  if (!isValidPhone(value)) {
    return {
      isValid: false,
      error: 'Telefone inválido. Use o formato: (00) 00000-0000'
    };
  }
  return { isValid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(value: string): ValidationResult {
  if (!isValidUrl(value)) {
    return {
      isValid: false,
      error: 'URL inválida. Use o formato: https://exemplo.com'
    };
  }
  return { isValid: true };
}

/**
 * Validate number format
 */
export function validateNumber(value: any): ValidationResult {
  if (!isValidNumber(value)) {
    return {
      isValid: false,
      error: 'Valor numérico inválido'
    };
  }
  return { isValid: true };
}

/**
 * Validate decimal format
 */
export function validateDecimal(value: any): ValidationResult {
  if (!isValidDecimal(value)) {
    return {
      isValid: false,
      error: 'Valor decimal inválido'
    };
  }
  return { isValid: true };
}

/**
 * Validate date format
 */
export function validateDate(value: any): ValidationResult {
  if (!isValidDate(value)) {
    return {
      isValid: false,
      error: 'Data inválida'
    };
  }
  return { isValid: true };
}

/**
 * Validate single select value against available options
 */
export function validateSingleSelect(
  value: string,
  options: SelectOption[]
): ValidationResult {
  if (options.length === 0) {
    return { isValid: true }; // No options to validate against
  }

  const isValidOption = options.some(opt => opt.id === value || opt.title === value);
  
  if (!isValidOption) {
    return {
      isValid: false,
      error: 'Selecione uma opção válida da lista'
    };
  }

  return { isValid: true };
}

/**
 * Validate multi select values against available options
 */
export function validateMultiSelect(
  value: string[],
  options: SelectOption[]
): ValidationResult {
  if (!Array.isArray(value)) {
    return {
      isValid: false,
      error: 'Valor deve ser uma lista de opções'
    };
  }

  if (options.length === 0) {
    return { isValid: true }; // No options to validate against
  }

  const invalidValues = value.filter(
    val => !options.some(opt => opt.id === val || opt.title === val)
  );

  if (invalidValues.length > 0) {
    return {
      isValid: false,
      error: `Opções inválidas: ${invalidValues.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Validate year format (1900-2100)
 */
export function validateYear(value: any): ValidationResult {
  const year = Number(value);
  
  if (isNaN(year)) {
    return {
      isValid: false,
      error: 'Ano inválido'
    };
  }

  if (year < 1900 || year > 2100) {
    return {
      isValid: false,
      error: 'Ano deve estar entre 1900 e 2100'
    };
  }

  return { isValid: true };
}

/**
 * Validate rating value (0-5)
 */
export function validateRating(value: any): ValidationResult {
  const rating = Number(value);
  
  if (isNaN(rating)) {
    return {
      isValid: false,
      error: 'Avaliação inválida'
    };
  }

  if (rating < 0 || rating > 5) {
    return {
      isValid: false,
      error: 'Avaliação deve estar entre 0 e 5'
    };
  }

  return { isValid: true };
}

/**
 * Validate JSON format
 */
export function validateJson(value: any): ValidationResult {
  if (typeof value === 'object') {
    return { isValid: true }; // Already parsed
  }

  if (typeof value !== 'string') {
    return {
      isValid: false,
      error: 'JSON inválido'
    };
  }

  try {
    JSON.parse(value);
    return { isValid: true };
  } catch {
    return {
      isValid: false,
      error: 'JSON inválido. Verifique a sintaxe'
    };
  }
}

/**
 * Validate all fields in a record
 * Returns a map of field names to validation results
 */
export function validateAllFields(
  fields: FieldMetadata[],
  record: Record<string, any>
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};

  fields.forEach(field => {
    if (field.editable) {
      const value = record[field.columnName];
      results[field.columnName] = validateFieldValue(field, value);
    }
  });

  return results;
}

/**
 * Check if all validations passed
 */
export function hasValidationErrors(
  validations: Record<string, ValidationResult>
): boolean {
  return Object.values(validations).some(v => !v.isValid);
}

/**
 * Get list of fields with validation errors
 */
export function getInvalidFields(
  validations: Record<string, ValidationResult>
): string[] {
  return Object.entries(validations)
    .filter(([_, result]) => !result.isValid)
    .map(([fieldName]) => fieldName);
}

/**
 * Get validation error messages
 */
export function getValidationErrors(
  validations: Record<string, ValidationResult>,
  fields: FieldMetadata[]
): string[] {
  return Object.entries(validations)
    .filter(([_, result]) => !result.isValid)
    .map(([fieldName, result]) => {
      const field = fields.find(f => f.columnName === fieldName);
      const label = field?.label || fieldName;
      return `${label}: ${result.error}`;
    });
}
