/**
 * VisibilityEvaluator
 * 
 * Evaluates visibility conditions for blocks based on record data.
 * Supports various comparison operators for conditional display.
 */

import type { VisibilityCondition, ComparisonOperator } from '@/types/page-builder';

/**
 * Check if a value is considered empty
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Convert value to string for comparison
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Evaluate a single visibility condition against record data
 */
export function evaluateVisibility(
  condition: VisibilityCondition,
  record: Record<string, unknown>
): boolean {
  const { field, operator, value: conditionValue } = condition;
  const fieldValue = record[field];

  switch (operator) {
    case 'equals':
      return compareEquals(fieldValue, conditionValue);
    
    case 'not_equals':
      return !compareEquals(fieldValue, conditionValue);
    
    case 'contains':
      return compareContains(fieldValue, conditionValue);
    
    case 'is_empty':
      return isEmpty(fieldValue);
    
    case 'is_not_empty':
      return !isEmpty(fieldValue);
    
    default:
      // Unknown operator, default to visible
      return true;
  }
}

/**
 * Compare two values for equality
 */
function compareEquals(
  fieldValue: unknown,
  conditionValue: string | number | boolean | undefined
): boolean {
  // Handle null/undefined
  if (fieldValue === null || fieldValue === undefined) {
    return conditionValue === null || conditionValue === undefined || conditionValue === '';
  }

  // Type-aware comparison
  if (typeof fieldValue === 'boolean') {
    if (typeof conditionValue === 'boolean') return fieldValue === conditionValue;
    if (typeof conditionValue === 'string') {
      return fieldValue === (conditionValue.toLowerCase() === 'true');
    }
    return false;
  }

  if (typeof fieldValue === 'number') {
    if (typeof conditionValue === 'number') return fieldValue === conditionValue;
    if (typeof conditionValue === 'string') {
      const numValue = parseFloat(conditionValue);
      return !isNaN(numValue) && fieldValue === numValue;
    }
    return false;
  }

  // String comparison (case-insensitive)
  const fieldStr = toString(fieldValue).toLowerCase();
  const conditionStr = toString(conditionValue).toLowerCase();
  return fieldStr === conditionStr;
}

/**
 * Check if field value contains the condition value
 */
function compareContains(
  fieldValue: unknown,
  conditionValue: string | number | boolean | undefined
): boolean {
  if (fieldValue === null || fieldValue === undefined) return false;
  if (conditionValue === null || conditionValue === undefined) return false;

  const fieldStr = toString(fieldValue).toLowerCase();
  const conditionStr = toString(conditionValue).toLowerCase();
  
  return fieldStr.includes(conditionStr);
}

/**
 * Evaluate multiple conditions (all must be true - AND logic)
 */
export function evaluateAllConditions(
  conditions: VisibilityCondition[],
  record: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(condition => evaluateVisibility(condition, record));
}

/**
 * Evaluate multiple conditions (any must be true - OR logic)
 */
export function evaluateAnyCondition(
  conditions: VisibilityCondition[],
  record: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.some(condition => evaluateVisibility(condition, record));
}

/**
 * Get available operators with labels
 */
export function getOperatorOptions(): { value: ComparisonOperator; label: string }[] {
  return [
    { value: 'equals', label: 'Igual a' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'contains', label: 'Contém' },
    { value: 'is_empty', label: 'Está vazio' },
    { value: 'is_not_empty', label: 'Não está vazio' },
  ];
}

/**
 * Check if operator requires a value
 */
export function operatorRequiresValue(operator: ComparisonOperator): boolean {
  return !['is_empty', 'is_not_empty'].includes(operator);
}
