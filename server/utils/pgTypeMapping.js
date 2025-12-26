/**
 * PostgreSQL Type Mapping Utilities
 * Maps PostgreSQL data types to UI input types
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

/**
 * PostgreSQL to UI type mapping
 */
const PG_TYPE_MAP = {
  // Text types -> text input
  'text': 'text',
  'varchar': 'text',
  'character varying': 'text',
  'char': 'text',
  'character': 'text',
  'name': 'text',
  'citext': 'text',
  'bpchar': 'text',
  
  // Numeric types -> number input
  'integer': 'number',
  'int': 'number',
  'int4': 'number',
  'bigint': 'number',
  'int8': 'number',
  'smallint': 'number',
  'int2': 'number',
  'numeric': 'number',
  'decimal': 'number',
  'real': 'number',
  'float4': 'number',
  'double precision': 'number',
  'float8': 'number',
  'serial': 'number',
  'bigserial': 'number',
  'smallserial': 'number',
  'money': 'number',
  
  // Boolean -> checkbox input
  'boolean': 'checkbox',
  'bool': 'checkbox',
  
  // Date types -> date picker
  'date': 'date',
  
  // Timestamp types -> datetime picker
  'timestamp': 'datetime',
  'timestamp without time zone': 'datetime',
  'timestamptz': 'datetime',
  'timestamp with time zone': 'datetime',
  
  // Time types -> time picker
  'time': 'time',
  'time without time zone': 'time',
  'timetz': 'time',
  'time with time zone': 'time',
  
  // JSON types -> JSON editor
  'json': 'json',
  'jsonb': 'json',
  
  // UUID -> read-only uuid display
  'uuid': 'uuid',
  
  // Array types -> array editor
  'ARRAY': 'array',
  '_text': 'array',
  '_int4': 'array',
  '_int8': 'array',
  '_uuid': 'array',
  '_varchar': 'array',
  '_bool': 'array',
  '_float4': 'array',
  '_float8': 'array',
  '_numeric': 'array',
  
  // Binary types -> file upload (or text for base64)
  'bytea': 'text',
  
  // Network types -> text
  'inet': 'text',
  'cidr': 'text',
  'macaddr': 'text',
  'macaddr8': 'text',
  
  // Geometric types -> text
  'point': 'text',
  'line': 'text',
  'lseg': 'text',
  'box': 'text',
  'path': 'text',
  'polygon': 'text',
  'circle': 'text',
  
  // Range types -> text
  'int4range': 'text',
  'int8range': 'text',
  'numrange': 'text',
  'tsrange': 'text',
  'tstzrange': 'text',
  'daterange': 'text',
  
  // Other types -> text
  'interval': 'text',
  'bit': 'text',
  'bit varying': 'text',
  'varbit': 'text',
  'tsvector': 'text',
  'tsquery': 'text',
  'xml': 'text',
  'oid': 'number',
};

/**
 * Maps a PostgreSQL data type to a UI input type
 * @param {string} pgType - PostgreSQL data type string
 * @returns {string} UI input type
 */
function mapPgTypeToUIType(pgType) {
  if (!pgType) return 'text';
  
  const normalizedType = pgType.toLowerCase().trim();
  
  // Check for array types (start with underscore or contain [])
  if (normalizedType.startsWith('_') || normalizedType.includes('[]')) {
    return 'array';
  }
  
  // Direct mapping
  if (PG_TYPE_MAP[normalizedType]) {
    return PG_TYPE_MAP[normalizedType];
  }
  
  // Check for partial matches (e.g., "character varying(255)")
  for (const [key, value] of Object.entries(PG_TYPE_MAP)) {
    if (normalizedType.startsWith(key)) {
      return value;
    }
  }
  
  // Check for enum types (user-defined)
  if (normalizedType.includes('enum') || normalizedType === 'user-defined') {
    return 'select';
  }
  
  // Default to text for unknown types
  return 'text';
}

/**
 * Get all supported PostgreSQL types
 * @returns {string[]} Array of supported type names
 */
function getSupportedTypes() {
  return Object.keys(PG_TYPE_MAP);
}

/**
 * Get all UI input types
 * @returns {string[]} Array of UI input type names
 */
function getUIInputTypes() {
  return [...new Set(Object.values(PG_TYPE_MAP))];
}

/**
 * Check if a PostgreSQL type is supported
 * @param {string} pgType - PostgreSQL data type
 * @returns {boolean}
 */
function isTypeSupported(pgType) {
  if (!pgType) return false;
  const normalized = pgType.toLowerCase().trim();
  return PG_TYPE_MAP.hasOwnProperty(normalized) || 
         normalized.startsWith('_') || 
         normalized.includes('[]');
}

/**
 * Get input configuration for a UI type
 * @param {string} uiType - UI input type
 * @returns {Object} Input configuration
 */
function getInputConfig(uiType) {
  const configs = {
    text: {
      component: 'Input',
      type: 'text',
      maxLength: 65535
    },
    number: {
      component: 'Input',
      type: 'number',
      step: 'any'
    },
    checkbox: {
      component: 'Checkbox',
      type: 'checkbox'
    },
    date: {
      component: 'DatePicker',
      type: 'date',
      format: 'YYYY-MM-DD'
    },
    datetime: {
      component: 'DateTimePicker',
      type: 'datetime-local',
      format: 'YYYY-MM-DDTHH:mm:ss'
    },
    time: {
      component: 'TimePicker',
      type: 'time',
      format: 'HH:mm:ss'
    },
    json: {
      component: 'JsonEditor',
      type: 'json',
      mode: 'code'
    },
    uuid: {
      component: 'Input',
      type: 'text',
      readOnly: true,
      placeholder: 'Auto-generated'
    },
    array: {
      component: 'ArrayInput',
      type: 'array'
    },
    select: {
      component: 'Select',
      type: 'select'
    }
  };
  
  return configs[uiType] || configs.text;
}

/**
 * Format a value for display based on its type
 * @param {any} value - The value to format
 * @param {string} uiType - UI input type
 * @returns {string} Formatted value
 */
function formatValueForDisplay(value, uiType) {
  if (value === null || value === undefined) return '';
  
  switch (uiType) {
    case 'checkbox':
      return value ? 'Sim' : 'Não';
    
    case 'date':
      if (value instanceof Date) {
        return value.toISOString().split('T')[0];
      }
      return String(value).split('T')[0];
    
    case 'datetime':
      if (value instanceof Date) {
        return value.toISOString().replace('T', ' ').substring(0, 19);
      }
      return String(value).replace('T', ' ').substring(0, 19);
    
    case 'json':
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    
    case 'array':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    
    case 'number':
      if (typeof value === 'number') {
        return value.toLocaleString('pt-BR');
      }
      return String(value);
    
    default:
      return String(value);
  }
}

/**
 * Parse a value from input based on its type
 * @param {string} inputValue - The input value
 * @param {string} uiType - UI input type
 * @param {string} pgType - Original PostgreSQL type
 * @returns {any} Parsed value
 */
function parseInputValue(inputValue, uiType, pgType) {
  if (inputValue === '' || inputValue === null || inputValue === undefined) {
    return null;
  }
  
  switch (uiType) {
    case 'checkbox':
      return inputValue === true || inputValue === 'true' || inputValue === '1';
    
    case 'number':
      const num = parseFloat(inputValue);
      if (isNaN(num)) return null;
      // Return integer for integer types
      if (['integer', 'int', 'int4', 'bigint', 'int8', 'smallint', 'int2', 'serial', 'bigserial'].includes(pgType?.toLowerCase())) {
        return Math.round(num);
      }
      return num;
    
    case 'json':
      if (typeof inputValue === 'string') {
        try {
          return JSON.parse(inputValue);
        } catch {
          return inputValue;
        }
      }
      return inputValue;
    
    case 'array':
      if (typeof inputValue === 'string') {
        return inputValue.split(',').map(s => s.trim()).filter(s => s);
      }
      return inputValue;
    
    case 'date':
    case 'datetime':
      // Return ISO string for dates
      if (inputValue instanceof Date) {
        return inputValue.toISOString();
      }
      return inputValue;
    
    default:
      return inputValue;
  }
}

module.exports = {
  PG_TYPE_MAP,
  mapPgTypeToUIType,
  getSupportedTypes,
  getUIInputTypes,
  isTypeSupported,
  getInputConfig,
  formatValueForDisplay,
  parseInputValue
};
