import { describe, it, expect } from 'vitest';
import {
  validateFieldValue,
  validateEmail,
  validatePhone,
  validateUrl,
  validateNumber,
  validateDecimal,
  validateDate,
  validateSingleSelect,
  validateMultiSelect,
  validateYear,
  validateRating,
  validateJson,
  validateAllFields,
  hasValidationErrors,
  getInvalidFields,
  getValidationErrors
} from '../fieldValidation';
import { FieldType, FieldMetadata } from '@/lib/types';

describe('validateFieldValue', () => {
  it('should validate required fields', () => {
    const field: FieldMetadata = {
      columnName: 'name',
      label: 'Name',
      type: FieldType.TEXT,
      uidt: 'SingleLineText',
      required: true,
      editable: true,
      visible: true
    };

    expect(validateFieldValue(field, '')).toEqual({
      isValid: false,
      error: 'Name é obrigatório'
    });

    expect(validateFieldValue(field, null)).toEqual({
      isValid: false,
      error: 'Name é obrigatório'
    });

    expect(validateFieldValue(field, 'John')).toEqual({
      isValid: true
    });
  });

  it('should allow empty values for non-required fields', () => {
    const field: FieldMetadata = {
      columnName: 'email',
      label: 'Email',
      type: FieldType.EMAIL,
      uidt: 'Email',
      required: false,
      editable: true,
      visible: true
    };

    expect(validateFieldValue(field, '')).toEqual({
      isValid: true
    });
  });

  it('should validate email fields', () => {
    const field: FieldMetadata = {
      columnName: 'email',
      label: 'Email',
      type: FieldType.EMAIL,
      uidt: 'Email',
      required: false,
      editable: true,
      visible: true
    };

    expect(validateFieldValue(field, 'test@example.com')).toEqual({
      isValid: true
    });

    expect(validateFieldValue(field, 'invalid')).toEqual({
      isValid: false,
      error: 'Email inválido. Use o formato: email@exemplo.com'
    });
  });

  it('should validate phone fields', () => {
    const field: FieldMetadata = {
      columnName: 'phone',
      label: 'Phone',
      type: FieldType.PHONE,
      uidt: 'PhoneNumber',
      required: false,
      editable: true,
      visible: true
    };

    expect(validateFieldValue(field, '(11) 98765-4321')).toEqual({
      isValid: true
    });

    expect(validateFieldValue(field, '123')).toEqual({
      isValid: false,
      error: 'Telefone inválido. Use o formato: (00) 00000-0000'
    });
  });

  it('should validate URL fields', () => {
    const field: FieldMetadata = {
      columnName: 'website',
      label: 'Website',
      type: FieldType.URL,
      uidt: 'URL',
      required: false,
      editable: true,
      visible: true
    };

    expect(validateFieldValue(field, 'https://example.com')).toEqual({
      isValid: true
    });

    expect(validateFieldValue(field, 'not a url')).toEqual({
      isValid: false,
      error: 'URL inválida. Use o formato: https://exemplo.com'
    });
  });

  it('should validate number fields', () => {
    const field: FieldMetadata = {
      columnName: 'age',
      label: 'Age',
      type: FieldType.NUMBER,
      uidt: 'Number',
      required: false,
      editable: true,
      visible: true
    };

    expect(validateFieldValue(field, 25)).toEqual({
      isValid: true
    });

    expect(validateFieldValue(field, 'abc')).toEqual({
      isValid: false,
      error: 'Valor numérico inválido'
    });
  });

  it('should validate single select fields', () => {
    const field: FieldMetadata = {
      columnName: 'status',
      label: 'Status',
      type: FieldType.SINGLE_SELECT,
      uidt: 'SingleSelect',
      required: false,
      editable: true,
      visible: true,
      options: [
        { id: '1', title: 'Active' },
        { id: '2', title: 'Inactive' }
      ]
    };

    expect(validateFieldValue(field, '1')).toEqual({
      isValid: true
    });

    expect(validateFieldValue(field, '3')).toEqual({
      isValid: false,
      error: 'Selecione uma opção válida da lista'
    });
  });

  it('should validate multi select fields', () => {
    const field: FieldMetadata = {
      columnName: 'tags',
      label: 'Tags',
      type: FieldType.MULTI_SELECT,
      uidt: 'MultiSelect',
      required: false,
      editable: true,
      visible: true,
      options: [
        { id: '1', title: 'Tag1' },
        { id: '2', title: 'Tag2' }
      ]
    };

    expect(validateFieldValue(field, ['1', '2'])).toEqual({
      isValid: true
    });

    expect(validateFieldValue(field, ['1', '3'])).toEqual({
      isValid: false,
      error: 'Opções inválidas: 3'
    });
  });
});

describe('validateEmail', () => {
  it('should validate correct emails', () => {
    expect(validateEmail('test@example.com')).toEqual({ isValid: true });
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('invalid')).toEqual({
      isValid: false,
      error: 'Email inválido. Use o formato: email@exemplo.com'
    });
  });
});

describe('validatePhone', () => {
  it('should validate correct phones', () => {
    expect(validatePhone('(11) 98765-4321')).toEqual({ isValid: true });
  });

  it('should reject invalid phones', () => {
    expect(validatePhone('123')).toEqual({
      isValid: false,
      error: 'Telefone inválido. Use o formato: (00) 00000-0000'
    });
  });
});

describe('validateUrl', () => {
  it('should validate correct URLs', () => {
    expect(validateUrl('https://example.com')).toEqual({ isValid: true });
  });

  it('should reject invalid URLs', () => {
    expect(validateUrl('not a url')).toEqual({
      isValid: false,
      error: 'URL inválida. Use o formato: https://exemplo.com'
    });
  });
});

describe('validateNumber', () => {
  it('should validate numbers', () => {
    expect(validateNumber(123)).toEqual({ isValid: true });
  });

  it('should reject non-numbers', () => {
    expect(validateNumber('abc')).toEqual({
      isValid: false,
      error: 'Valor numérico inválido'
    });
  });
});

describe('validateDecimal', () => {
  it('should validate decimals', () => {
    expect(validateDecimal(123.45)).toEqual({ isValid: true });
  });

  it('should reject invalid decimals', () => {
    expect(validateDecimal('abc')).toEqual({
      isValid: false,
      error: 'Valor decimal inválido'
    });
  });
});

describe('validateDate', () => {
  it('should validate dates', () => {
    expect(validateDate(new Date())).toEqual({ isValid: true });
  });

  it('should reject invalid dates', () => {
    expect(validateDate('invalid')).toEqual({
      isValid: false,
      error: 'Data inválida'
    });
  });
});

describe('validateSingleSelect', () => {
  const options = [
    { id: '1', title: 'Option 1' },
    { id: '2', title: 'Option 2' }
  ];

  it('should validate valid option by id', () => {
    expect(validateSingleSelect('1', options)).toEqual({ isValid: true });
  });

  it('should validate valid option by title', () => {
    expect(validateSingleSelect('Option 1', options)).toEqual({ isValid: true });
  });

  it('should reject invalid option', () => {
    expect(validateSingleSelect('3', options)).toEqual({
      isValid: false,
      error: 'Selecione uma opção válida da lista'
    });
  });

  it('should allow any value if no options', () => {
    expect(validateSingleSelect('anything', [])).toEqual({ isValid: true });
  });
});

describe('validateMultiSelect', () => {
  const options = [
    { id: '1', title: 'Option 1' },
    { id: '2', title: 'Option 2' }
  ];

  it('should validate valid options', () => {
    expect(validateMultiSelect(['1', '2'], options)).toEqual({ isValid: true });
  });

  it('should reject invalid options', () => {
    expect(validateMultiSelect(['1', '3'], options)).toEqual({
      isValid: false,
      error: 'Opções inválidas: 3'
    });
  });

  it('should reject non-array values', () => {
    expect(validateMultiSelect('not an array' as any, options)).toEqual({
      isValid: false,
      error: 'Valor deve ser uma lista de opções'
    });
  });

  it('should allow any value if no options', () => {
    expect(validateMultiSelect(['anything'], [])).toEqual({ isValid: true });
  });
});

describe('validateYear', () => {
  it('should validate valid years', () => {
    expect(validateYear(2024)).toEqual({ isValid: true });
    expect(validateYear(1900)).toEqual({ isValid: true });
    expect(validateYear(2100)).toEqual({ isValid: true });
  });

  it('should reject years out of range', () => {
    expect(validateYear(1899)).toEqual({
      isValid: false,
      error: 'Ano deve estar entre 1900 e 2100'
    });

    expect(validateYear(2101)).toEqual({
      isValid: false,
      error: 'Ano deve estar entre 1900 e 2100'
    });
  });

  it('should reject non-numeric years', () => {
    expect(validateYear('abc')).toEqual({
      isValid: false,
      error: 'Ano inválido'
    });
  });
});

describe('validateRating', () => {
  it('should validate valid ratings', () => {
    expect(validateRating(0)).toEqual({ isValid: true });
    expect(validateRating(3)).toEqual({ isValid: true });
    expect(validateRating(5)).toEqual({ isValid: true });
  });

  it('should reject ratings out of range', () => {
    expect(validateRating(-1)).toEqual({
      isValid: false,
      error: 'Avaliação deve estar entre 0 e 5'
    });

    expect(validateRating(6)).toEqual({
      isValid: false,
      error: 'Avaliação deve estar entre 0 e 5'
    });
  });

  it('should reject non-numeric ratings', () => {
    expect(validateRating('abc')).toEqual({
      isValid: false,
      error: 'Avaliação inválida'
    });
  });
});

describe('validateJson', () => {
  it('should validate valid JSON objects', () => {
    expect(validateJson({ key: 'value' })).toEqual({ isValid: true });
  });

  it('should validate valid JSON strings', () => {
    expect(validateJson('{"key":"value"}')).toEqual({ isValid: true });
  });

  it('should reject invalid JSON strings', () => {
    expect(validateJson('{invalid}')).toEqual({
      isValid: false,
      error: 'JSON inválido. Verifique a sintaxe'
    });
  });

  it('should reject non-string, non-object values', () => {
    expect(validateJson(123)).toEqual({
      isValid: false,
      error: 'JSON inválido'
    });
  });
});

describe('validateAllFields', () => {
  const fields: FieldMetadata[] = [
    {
      columnName: 'name',
      label: 'Name',
      type: FieldType.TEXT,
      uidt: 'SingleLineText',
      required: true,
      editable: true,
      visible: true
    },
    {
      columnName: 'email',
      label: 'Email',
      type: FieldType.EMAIL,
      uidt: 'Email',
      required: false,
      editable: true,
      visible: true
    },
    {
      columnName: 'id',
      label: 'ID',
      type: FieldType.NUMBER,
      uidt: 'Number',
      required: false,
      editable: false,
      visible: true
    }
  ];

  it('should validate all editable fields', () => {
    const record = {
      name: 'John',
      email: 'john@example.com',
      id: 1
    };

    const results = validateAllFields(fields, record);

    expect(results.name.isValid).toBe(true);
    expect(results.email.isValid).toBe(true);
    expect(results.id).toBeUndefined(); // Not editable, so not validated
  });

  it('should return errors for invalid fields', () => {
    const record = {
      name: '',
      email: 'invalid',
      id: 1
    };

    const results = validateAllFields(fields, record);

    expect(results.name.isValid).toBe(false);
    expect(results.email.isValid).toBe(false);
  });
});

describe('hasValidationErrors', () => {
  it('should return true if any validation failed', () => {
    const validations = {
      field1: { isValid: true },
      field2: { isValid: false, error: 'Error' }
    };

    expect(hasValidationErrors(validations)).toBe(true);
  });

  it('should return false if all validations passed', () => {
    const validations = {
      field1: { isValid: true },
      field2: { isValid: true }
    };

    expect(hasValidationErrors(validations)).toBe(false);
  });
});

describe('getInvalidFields', () => {
  it('should return list of invalid field names', () => {
    const validations = {
      field1: { isValid: true },
      field2: { isValid: false, error: 'Error' },
      field3: { isValid: false, error: 'Error' }
    };

    const invalidFields = getInvalidFields(validations);

    expect(invalidFields).toEqual(['field2', 'field3']);
  });

  it('should return empty array if all valid', () => {
    const validations = {
      field1: { isValid: true },
      field2: { isValid: true }
    };

    expect(getInvalidFields(validations)).toEqual([]);
  });
});

describe('getValidationErrors', () => {
  const fields: FieldMetadata[] = [
    {
      columnName: 'name',
      label: 'Name',
      type: FieldType.TEXT,
      uidt: 'SingleLineText',
      required: true,
      editable: true,
      visible: true
    },
    {
      columnName: 'email',
      label: 'Email',
      type: FieldType.EMAIL,
      uidt: 'Email',
      required: false,
      editable: true,
      visible: true
    }
  ];

  it('should return formatted error messages', () => {
    const validations = {
      name: { isValid: false, error: 'Required' },
      email: { isValid: false, error: 'Invalid format' }
    };

    const errors = getValidationErrors(validations, fields);

    expect(errors).toEqual([
      'Name: Required',
      'Email: Invalid format'
    ]);
  });

  it('should return empty array if all valid', () => {
    const validations = {
      name: { isValid: true },
      email: { isValid: true }
    };

    expect(getValidationErrors(validations, fields)).toEqual([]);
  });
});
