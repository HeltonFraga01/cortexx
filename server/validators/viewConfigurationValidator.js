/**
 * View Configuration Validator
 * Validates view configuration structure for Calendar and Kanban views
 */

const { logger } = require('../utils/logger');

/**
 * Validate view configuration structure
 * @param {Object} viewConfig - View configuration object
 * @param {Array} columns - Available columns from the table (optional for basic validation)
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateViewConfiguration(viewConfig, columns = null) {
  const errors = [];
  
  // If viewConfig is null or undefined, it's valid (optional field)
  if (!viewConfig) {
    return { valid: true, errors: [] };
  }
  
  // Must be an object
  if (typeof viewConfig !== 'object' || Array.isArray(viewConfig)) {
    errors.push('view_configuration deve ser um objeto');
    return { valid: false, errors };
  }
  
  // Validate calendar configuration
  if (viewConfig.calendar) {
    const calendarErrors = validateCalendarConfig(viewConfig.calendar, columns);
    errors.push(...calendarErrors);
  }
  
  // Validate kanban configuration
  if (viewConfig.kanban) {
    const kanbanErrors = validateKanbanConfig(viewConfig.kanban, columns);
    errors.push(...kanbanErrors);
  }
  
  // Validate editTheme configuration
  if (viewConfig.editTheme) {
    const editThemeErrors = validateEditThemeConfig(viewConfig.editTheme);
    errors.push(...editThemeErrors);
  }
  
  // At least one view should be configured if viewConfig is provided
  if (!viewConfig.calendar && !viewConfig.kanban && !viewConfig.editTheme) {
    errors.push('view_configuration deve conter pelo menos uma configuração (calendar, kanban ou editTheme)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate calendar configuration
 * @param {Object} calendarConfig - Calendar configuration object
 * @param {Array} columns - Available columns from the table
 * @returns {Array} - Array of error messages
 */
function validateCalendarConfig(calendarConfig, columns) {
  const errors = [];
  
  // Must be an object
  if (typeof calendarConfig !== 'object' || Array.isArray(calendarConfig)) {
    errors.push('calendar deve ser um objeto');
    return errors;
  }
  
  // Validate enabled field
  if (calendarConfig.enabled === undefined) {
    errors.push('calendar.enabled é obrigatório');
  } else if (typeof calendarConfig.enabled !== 'boolean') {
    errors.push('calendar.enabled deve ser um booleano');
  }
  
  // If calendar is enabled, dateField is required
  if (calendarConfig.enabled) {
    if (!calendarConfig.dateField) {
      errors.push('calendar.dateField é obrigatório quando calendar está habilitado');
    } else if (typeof calendarConfig.dateField !== 'string') {
      errors.push('calendar.dateField deve ser uma string');
    } else if (calendarConfig.dateField.trim() === '') {
      errors.push('calendar.dateField não pode ser vazio');
    }
    
    // If columns are provided, validate that dateField exists
    if (columns && calendarConfig.dateField) {
      const dateColumn = columns.find(col => 
        col.column_name === calendarConfig.dateField || 
        col.title === calendarConfig.dateField
      );
      
      if (!dateColumn) {
        errors.push(`Campo de data '${calendarConfig.dateField}' não encontrado na tabela`);
      } else {
        // Validate that the column is a date/datetime type
        const validDateTypes = ['Date', 'DateTime', 'CreatedTime', 'LastModifiedTime'];
        if (dateColumn.uidt && !validDateTypes.includes(dateColumn.uidt)) {
          errors.push(`Campo '${calendarConfig.dateField}' não é do tipo Date/DateTime (tipo atual: ${dateColumn.uidt})`);
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validate kanban configuration
 * @param {Object} kanbanConfig - Kanban configuration object
 * @param {Array} columns - Available columns from the table
 * @returns {Array} - Array of error messages
 */
function validateKanbanConfig(kanbanConfig, columns) {
  const errors = [];
  
  // Must be an object
  if (typeof kanbanConfig !== 'object' || Array.isArray(kanbanConfig)) {
    errors.push('kanban deve ser um objeto');
    return errors;
  }
  
  // Validate enabled field
  if (kanbanConfig.enabled === undefined) {
    errors.push('kanban.enabled é obrigatório');
  } else if (typeof kanbanConfig.enabled !== 'boolean') {
    errors.push('kanban.enabled deve ser um booleano');
  }
  
  // If kanban is enabled, statusField is required
  if (kanbanConfig.enabled) {
    if (!kanbanConfig.statusField) {
      errors.push('kanban.statusField é obrigatório quando kanban está habilitado');
    } else if (typeof kanbanConfig.statusField !== 'string') {
      errors.push('kanban.statusField deve ser uma string');
    } else if (kanbanConfig.statusField.trim() === '') {
      errors.push('kanban.statusField não pode ser vazio');
    }
    
    // If columns are provided, validate that statusField exists
    if (columns && kanbanConfig.statusField) {
      const statusColumn = columns.find(col => 
        col.column_name === kanbanConfig.statusField || 
        col.title === kanbanConfig.statusField
      );
      
      if (!statusColumn) {
        errors.push(`Campo de status '${kanbanConfig.statusField}' não encontrado na tabela`);
      } else {
        // Validate that the column is a groupable type
        const validGroupableTypes = ['SingleLineText', 'LongText', 'SingleSelect', 'MultiSelect'];
        if (statusColumn.uidt && !validGroupableTypes.includes(statusColumn.uidt)) {
          logger.warn(`Campo '${kanbanConfig.statusField}' pode não ser ideal para agrupamento (tipo: ${statusColumn.uidt})`);
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validate edit theme configuration
 * @param {Object} editThemeConfig - Edit theme configuration object
 * @returns {Array} - Array of error messages
 */
function validateEditThemeConfig(editThemeConfig) {
  const errors = [];
  
  // Must be an object
  if (typeof editThemeConfig !== 'object' || Array.isArray(editThemeConfig)) {
    errors.push('editTheme deve ser um objeto');
    return errors;
  }
  
  // Validate enabled field
  if (editThemeConfig.enabled === undefined) {
    errors.push('editTheme.enabled é obrigatório');
  } else if (typeof editThemeConfig.enabled !== 'boolean') {
    errors.push('editTheme.enabled deve ser um booleano');
  }
  
  // If editTheme is enabled, themeId is required
  if (editThemeConfig.enabled) {
    if (!editThemeConfig.themeId) {
      errors.push('editTheme.themeId é obrigatório quando editTheme está habilitado');
    } else if (typeof editThemeConfig.themeId !== 'string') {
      errors.push('editTheme.themeId deve ser uma string');
    } else if (editThemeConfig.themeId.trim() === '') {
      errors.push('editTheme.themeId não pode ser vazio');
    }
    
    // Validate themeId format (kebab-case)
    if (editThemeConfig.themeId && typeof editThemeConfig.themeId === 'string') {
      const kebabCaseRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      if (!kebabCaseRegex.test(editThemeConfig.themeId)) {
        errors.push('editTheme.themeId deve estar em formato kebab-case (ex: profile-card)');
      }
    }
  }
  
  // Validate options if provided
  if (editThemeConfig.options !== undefined) {
    if (typeof editThemeConfig.options !== 'object' || Array.isArray(editThemeConfig.options)) {
      errors.push('editTheme.options deve ser um objeto');
    }
  }
  
  return errors;
}

/**
 * Validate field mappings with helper text
 * @param {Array} fieldMappings - Array of field mapping objects
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateFieldMappings(fieldMappings) {
  const errors = [];
  
  // If fieldMappings is null or undefined, it's valid (optional field)
  if (!fieldMappings) {
    return { valid: true, errors: [] };
  }
  
  // Must be an array
  if (!Array.isArray(fieldMappings)) {
    errors.push('field_mappings deve ser um array');
    return { valid: false, errors };
  }
  
  // Validate each mapping
  fieldMappings.forEach((mapping, index) => {
    if (!mapping || typeof mapping !== 'object') {
      errors.push(`field_mappings[${index}] deve ser um objeto`);
      return;
    }
    
    // Validate required fields
    if (!mapping.columnName) {
      errors.push(`field_mappings[${index}].columnName é obrigatório`);
    }
    
    if (!mapping.label) {
      errors.push(`field_mappings[${index}].label é obrigatório`);
    }
    
    // Validate helper text length if provided
    if (mapping.helperText) {
      if (typeof mapping.helperText !== 'string') {
        errors.push(`field_mappings[${index}].helperText deve ser uma string`);
      } else if (mapping.helperText.length > 500) {
        errors.push(`field_mappings[${index}].helperText não pode exceder 500 caracteres (atual: ${mapping.helperText.length})`);
      }
    }
    
    // Validate boolean fields
    if (mapping.visible !== undefined && typeof mapping.visible !== 'boolean') {
      errors.push(`field_mappings[${index}].visible deve ser um booleano`);
    }
    
    if (mapping.editable !== undefined && typeof mapping.editable !== 'boolean') {
      errors.push(`field_mappings[${index}].editable deve ser um booleano`);
    }
    
    if (mapping.showInCard !== undefined && typeof mapping.showInCard !== 'boolean') {
      errors.push(`field_mappings[${index}].showInCard deve ser um booleano`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateViewConfiguration,
  validateCalendarConfig,
  validateKanbanConfig,
  validateEditThemeConfig,
  validateFieldMappings
};
