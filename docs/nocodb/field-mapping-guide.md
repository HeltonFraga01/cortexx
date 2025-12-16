# Guia de Mapeamento de Campos - NocoDB

Documentação completa para configuração e uso de mapeamento de campos na integração NocoDB.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Estrutura de Mapeamento](#estrutura-de-mapeamento)
- [Configuração de Campos](#configuração-de-campos)
- [Tipos de Campo Suportados](#tipos-de-campo-suportados)
- [Validações de Campo](#validações-de-campo)
- [Mapeamento Automático](#mapeamento-automático)
- [Mapeamento Personalizado](#mapeamento-personalizado)
- [Interface de Usuário](#interface-de-usuário)
- [Casos de Uso](#casos-de-uso)
- [Troubleshooting](#troubleshooting)

## Visão Geral

### O que é Mapeamento de Campos?
O mapeamento de campos permite configurar como os dados da tabela NocoDB são exibidos e editados na interface do WUZAPI Manager, definindo:

- **Labels amigáveis** para colunas técnicas
- **Visibilidade** de campos na interface
- **Editabilidade** de campos pelos usuários
- **Validações** específicas por campo
- **Formatação** de dados para exibição

### Arquitetura do Mapeamento
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   NocoDB        │    │   Field         │    │   Frontend      │
│   Table         │    │   Mapping       │    │   Interface     │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ column_name │◄┼────┼►│ columnName  │◄┼────┼►│ Table Header│ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │    title    │◄┼────┼►│    label    │◄┼────┼►│ Field Label │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │    uidt     │◄┼────┼►│   visible   │◄┼────┼►│ Show/Hide   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│                 │    │ │  editable   │◄┼────┼►│ Input/Text  │ │
│                 │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Estrutura de Mapeamento

### Interface FieldMapping
```typescript
interface FieldMapping {
  columnName: string;    // Nome da coluna no NocoDB
  label: string;         // Label amigável para exibição
  visible: boolean;      // Se deve ser exibido na interface
  editable: boolean;     // Se pode ser editado pelo usuário
  type?: string;         // Tipo do campo (text, email, phone, etc.)
  required?: boolean;    // Se é obrigatório
  validation?: FieldValidation; // Regras de validação
  format?: FieldFormat;  // Formatação para exibição
}

interface FieldValidation {
  pattern?: string;      // Regex para validação
  minLength?: number;    // Comprimento mínimo
  maxLength?: number;    // Comprimento máximo
  min?: number;          // Valor mínimo (números)
  max?: number;          // Valor máximo (números)
  options?: string[];    // Opções válidas (select)
}

interface FieldFormat {
  dateFormat?: string;   // Formato de data
  numberFormat?: string; // Formato de número
  currency?: string;     // Moeda para valores monetários
  mask?: string;         // Máscara de entrada
}
```

### Armazenamento no Banco
```sql
-- Tabela database_connections
CREATE TABLE database_connections (
  -- ... outros campos
  field_mappings TEXT DEFAULT '[]', -- JSON array de FieldMapping
  -- ... outros campos
);
```

### Exemplo de Mapeamento Completo
```json
[
  {
    "columnName": "Id",
    "label": "ID",
    "visible": false,
    "editable": false,
    "type": "number"
  },
  {
    "columnName": "nome",
    "label": "Nome Completo",
    "visible": true,
    "editable": true,
    "type": "text",
    "required": true,
    "validation": {
      "minLength": 2,
      "maxLength": 100
    }
  },
  {
    "columnName": "email",
    "label": "E-mail",
    "visible": true,
    "editable": true,
    "type": "email",
    "required": false,
    "validation": {
      "pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
    }
  },
  {
    "columnName": "telefone",
    "label": "Telefone",
    "visible": true,
    "editable": true,
    "type": "phone",
    "format": {
      "mask": "(99) 99999-9999"
    }
  },
  {
    "columnName": "status",
    "label": "Status do Lead",
    "visible": true,
    "editable": true,
    "type": "select",
    "validation": {
      "options": ["novo", "contatado", "qualificado", "convertido", "perdido"]
    }
  },
  {
    "columnName": "valor_estimado",
    "label": "Valor Estimado",
    "visible": true,
    "editable": true,
    "type": "currency",
    "format": {
      "currency": "BRL"
    }
  },
  {
    "columnName": "created_at",
    "label": "Data de Criação",
    "visible": true,
    "editable": false,
    "type": "datetime",
    "format": {
      "dateFormat": "DD/MM/YYYY HH:mm"
    }
  },
  {
    "columnName": "wasendToken",
    "label": "Token",
    "visible": false,
    "editable": false,
    "type": "text"
  }
]
```

## Configuração de Campos

### Backend - Parsing e Validação
```javascript
// Método para parsing seguro de field_mappings
parseFieldMappings(jsonString) {
  const mappings = this.parseJSON(jsonString, []);
  
  if (!Array.isArray(mappings)) {
    logger.warn('⚠️ field_mappings não é um array, convertendo:', mappings);
    return [];
  }
  
  // Validar estrutura dos mappings
  return mappings.filter(mapping => 
    mapping && 
    typeof mapping === 'object' &&
    mapping.columnName && 
    mapping.label
  ).map(mapping => ({
    columnName: mapping.columnName || mapping.field || '',
    label: mapping.label || mapping.mapping || mapping.columnName || '',
    visible: mapping.visible !== undefined ? Boolean(mapping.visible) : true,
    editable: mapping.editable !== undefined ? Boolean(mapping.editable) : true,
    type: mapping.type || 'text',
    required: Boolean(mapping.required),
    validation: mapping.validation || {},
    format: mapping.format || {},
    ...mapping // Preservar outros campos
  }));
}

// Validar mapeamento de campo
validateFieldMapping(mapping) {
  const errors = [];
  
  if (!mapping.columnName || typeof mapping.columnName !== 'string') {
    errors.push('columnName é obrigatório e deve ser string');
  }
  
  if (!mapping.label || typeof mapping.label !== 'string') {
    errors.push('label é obrigatório e deve ser string');
  }
  
  if (typeof mapping.visible !== 'boolean') {
    errors.push('visible deve ser boolean');
  }
  
  if (typeof mapping.editable !== 'boolean') {
    errors.push('editable deve ser boolean');
  }
  
  // Validar tipo de campo
  const validTypes = ['text', 'email', 'phone', 'number', 'currency', 'date', 'datetime', 'select', 'textarea', 'checkbox'];
  if (mapping.type && !validTypes.includes(mapping.type)) {
    errors.push(`Tipo de campo inválido: ${mapping.type}`);
  }
  
  return errors;
}
```

### Frontend - Service para Mapeamento
```typescript
class FieldMappingService {
  
  // Gerar mapeamento automático baseado na estrutura da tabela
  async generateAutoMapping(connection: DatabaseConnection): Promise<FieldMapping[]> {
    try {
      const columns = await databaseConnectionsService.getNocoDBColumns(
        connection.host,
        connection.nocodb_token,
        connection.nocodb_table_id
      );

      return columns.map(column => this.createMappingFromColumn(column));
      
    } catch (error) {
      console.error('Erro ao gerar mapeamento automático:', error);
      return [];
    }
  }
  
  // Criar mapeamento a partir de coluna NocoDB
  private createMappingFromColumn(column: any): FieldMapping {
    const mapping: FieldMapping = {
      columnName: column.column_name,
      label: this.generateFriendlyLabel(column.title || column.column_name),
      visible: this.shouldBeVisible(column),
      editable: this.shouldBeEditable(column),
      type: this.mapNocoDBTypeToFieldType(column.uidt),
      required: Boolean(column.rqd)
    };
    
    // Adicionar validações baseadas no tipo NocoDB
    mapping.validation = this.generateValidationFromColumn(column);
    
    // Adicionar formatação baseada no tipo
    mapping.format = this.generateFormatFromColumn(column);
    
    return mapping;
  }
  
  // Gerar label amigável
  private generateFriendlyLabel(columnName: string): string {
    const labelMap: Record<string, string> = {
      'id': 'ID',
      'nome': 'Nome',
      'email': 'E-mail',
      'telefone': 'Telefone',
      'created_at': 'Data de Criação',
      'updated_at': 'Última Atualização',
      'wasendToken': 'Token do Usuário',
      'status': 'Status',
      'observacoes': 'Observações',
      'valor': 'Valor',
      'data_nascimento': 'Data de Nascimento',
      'endereco': 'Endereço',
      'empresa': 'Empresa',
      'cargo': 'Cargo'
    };
    
    const lowerName = columnName.toLowerCase();
    
    if (labelMap[lowerName]) {
      return labelMap[lowerName];
    }
    
    // Converter snake_case para Title Case
    return columnName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  
  // Determinar se campo deve ser visível
  private shouldBeVisible(column: any): boolean {
    const hiddenFields = ['id', 'wasendtoken', 'created_at', 'updated_at'];
    return !hiddenFields.includes(column.column_name.toLowerCase());
  }
  
  // Determinar se campo deve ser editável
  private shouldBeEditable(column: any): boolean {
    const readOnlyFields = ['id', 'wasendtoken', 'created_at', 'updated_at'];
    return !readOnlyFields.includes(column.column_name.toLowerCase()) && !column.pk;
  }
  
  // Mapear tipo NocoDB para tipo de campo
  private mapNocoDBTypeToFieldType(uidt: string): string {
    const typeMap: Record<string, string> = {
      'ID': 'number',
      'SingleLineText': 'text',
      'LongText': 'textarea',
      'Email': 'email',
      'PhoneNumber': 'phone',
      'Number': 'number',
      'Decimal': 'number',
      'Currency': 'currency',
      'Percent': 'number',
      'Date': 'date',
      'DateTime': 'datetime',
      'Time': 'time',
      'SingleSelect': 'select',
      'MultiSelect': 'multiselect',
      'Checkbox': 'checkbox',
      'URL': 'url',
      'Attachment': 'file',
      'Rating': 'rating',
      'Formula': 'text',
      'Rollup': 'text',
      'Lookup': 'text',
      'Count': 'number'
    };
    
    return typeMap[uidt] || 'text';
  }
  
  // Gerar validações baseadas na coluna
  private generateValidationFromColumn(column: any): FieldValidation {
    const validation: FieldValidation = {};
    
    // Validações baseadas no tipo
    switch (column.uidt) {
      case 'Email':
        validation.pattern = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';
        break;
        
      case 'PhoneNumber':
        validation.pattern = '^\\+?[\\d\\s\\-\\(\\)]{10,}$';
        break;
        
      case 'SingleLineText':
        if (column.dtxp) {
          validation.maxLength = parseInt(column.dtxp);
        }
        break;
        
      case 'Number':
      case 'Decimal':
        if (column.dtxp) {
          const [precision, scale] = column.dtxp.split(',').map(Number);
          validation.max = Math.pow(10, precision - (scale || 0)) - 1;
        }
        break;
        
      case 'SingleSelect':
        if (column.colOptions?.options) {
          validation.options = column.colOptions.options.map((opt: any) => opt.title);
        }
        break;
    }
    
    return validation;
  }
  
  // Gerar formatação baseada na coluna
  private generateFormatFromColumn(column: any): FieldFormat {
    const format: FieldFormat = {};
    
    switch (column.uidt) {
      case 'Date':
        format.dateFormat = 'DD/MM/YYYY';
        break;
        
      case 'DateTime':
        format.dateFormat = 'DD/MM/YYYY HH:mm';
        break;
        
      case 'Currency':
        format.currency = 'BRL';
        format.numberFormat = '0,0.00';
        break;
        
      case 'Percent':
        format.numberFormat = '0.00%';
        break;
        
      case 'PhoneNumber':
        format.mask = '(99) 99999-9999';
        break;
    }
    
    return format;
  }
  
  // Aplicar mapeamento aos dados
  applyMappingToData(data: any[], mappings: FieldMapping[]): any[] {
    return data.map(row => {
      const mappedRow: any = {};
      
      mappings.forEach(mapping => {
        if (mapping.visible) {
          const value = row[mapping.columnName];
          mappedRow[mapping.columnName] = this.formatValue(value, mapping);
        }
      });
      
      return mappedRow;
    });
  }
  
  // Formatar valor baseado no mapeamento
  private formatValue(value: any, mapping: FieldMapping): any {
    if (value === null || value === undefined) {
      return '';
    }
    
    switch (mapping.type) {
      case 'date':
      case 'datetime':
        if (mapping.format?.dateFormat) {
          return this.formatDate(value, mapping.format.dateFormat);
        }
        break;
        
      case 'currency':
        if (mapping.format?.currency) {
          return this.formatCurrency(value, mapping.format.currency);
        }
        break;
        
      case 'number':
        if (mapping.format?.numberFormat) {
          return this.formatNumber(value, mapping.format.numberFormat);
        }
        break;
        
      case 'phone':
        if (mapping.format?.mask) {
          return this.applyMask(value, mapping.format.mask);
        }
        break;
    }
    
    return value;
  }
  
  // Métodos auxiliares de formatação
  private formatDate(value: string, format: string): string {
    try {
      const date = new Date(value);
      // Implementar formatação de data baseada no formato
      return date.toLocaleDateString('pt-BR');
    } catch {
      return value;
    }
  }
  
  private formatCurrency(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency
      }).format(value);
    } catch {
      return value.toString();
    }
  }
  
  private formatNumber(value: number, format: string): string {
    try {
      if (format.includes('%')) {
        return (value * 100).toFixed(2) + '%';
      }
      return value.toLocaleString('pt-BR');
    } catch {
      return value.toString();
    }
  }
  
  private applyMask(value: string, mask: string): string {
    if (!value) return '';
    
    const cleanValue = value.replace(/\D/g, '');
    let maskedValue = '';
    let valueIndex = 0;
    
    for (let i = 0; i < mask.length && valueIndex < cleanValue.length; i++) {
      if (mask[i] === '9') {
        maskedValue += cleanValue[valueIndex];
        valueIndex++;
      } else {
        maskedValue += mask[i];
      }
    }
    
    return maskedValue;
  }
}
```

## Tipos de Campo Suportados

### Tipos Básicos
```typescript
enum FieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  EMAIL = 'email',
  PHONE = 'phone',
  NUMBER = 'number',
  CURRENCY = 'currency',
  DATE = 'date',
  DATETIME = 'datetime',
  TIME = 'time',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  CHECKBOX = 'checkbox',
  URL = 'url',
  FILE = 'file',
  RATING = 'rating'
}
```

### Configurações por Tipo

#### Texto (text)
```json
{
  "columnName": "nome",
  "label": "Nome Completo",
  "type": "text",
  "validation": {
    "minLength": 2,
    "maxLength": 100,
    "pattern": "^[a-zA-ZÀ-ÿ\\s]+$"
  }
}
```

#### E-mail (email)
```json
{
  "columnName": "email",
  "label": "E-mail",
  "type": "email",
  "validation": {
    "pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
  }
}
```

#### Telefone (phone)
```json
{
  "columnName": "telefone",
  "label": "Telefone",
  "type": "phone",
  "validation": {
    "pattern": "^\\+?[\\d\\s\\-\\(\\)]{10,}$"
  },
  "format": {
    "mask": "(99) 99999-9999"
  }
}
```

#### Número (number)
```json
{
  "columnName": "idade",
  "label": "Idade",
  "type": "number",
  "validation": {
    "min": 0,
    "max": 120
  }
}
```

#### Moeda (currency)
```json
{
  "columnName": "valor",
  "label": "Valor",
  "type": "currency",
  "format": {
    "currency": "BRL",
    "numberFormat": "0,0.00"
  }
}
```

#### Data (date/datetime)
```json
{
  "columnName": "data_nascimento",
  "label": "Data de Nascimento",
  "type": "date",
  "format": {
    "dateFormat": "DD/MM/YYYY"
  }
}
```

#### Seleção (select)
```json
{
  "columnName": "status",
  "label": "Status",
  "type": "select",
  "validation": {
    "options": ["novo", "contatado", "qualificado", "convertido", "perdido"]
  }
}
```

#### Checkbox (checkbox)
```json
{
  "columnName": "ativo",
  "label": "Ativo",
  "type": "checkbox"
}
```

## Validações de Campo

### Sistema de Validação
```typescript
class FieldValidator {
  
  // Validar valor baseado no mapeamento
  validateField(value: any, mapping: FieldMapping): ValidationResult {
    const errors: string[] = [];
    
    // Verificar campo obrigatório
    if (mapping.required && this.isEmpty(value)) {
      errors.push(`${mapping.label} é obrigatório`);
      return { valid: false, errors };
    }
    
    // Se valor está vazio e não é obrigatório, é válido
    if (this.isEmpty(value)) {
      return { valid: true, errors: [] };
    }
    
    // Validações por tipo
    switch (mapping.type) {
      case 'email':
        if (!this.validateEmail(value)) {
          errors.push(`${mapping.label} deve ser um e-mail válido`);
        }
        break;
        
      case 'phone':
        if (!this.validatePhone(value)) {
          errors.push(`${mapping.label} deve ser um telefone válido`);
        }
        break;
        
      case 'number':
      case 'currency':
        if (!this.validateNumber(value, mapping.validation)) {
          errors.push(`${mapping.label} deve ser um número válido`);
        }
        break;
        
      case 'date':
      case 'datetime':
        if (!this.validateDate(value)) {
          errors.push(`${mapping.label} deve ser uma data válida`);
        }
        break;
        
      case 'select':
        if (!this.validateSelect(value, mapping.validation?.options)) {
          errors.push(`${mapping.label} deve ser uma das opções válidas`);
        }
        break;
        
      case 'url':
        if (!this.validateURL(value)) {
          errors.push(`${mapping.label} deve ser uma URL válida`);
        }
        break;
    }
    
    // Validações gerais
    if (mapping.validation) {
      const validationErrors = this.validateGeneral(value, mapping.validation, mapping.label);
      errors.push(...validationErrors);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // Validações específicas por tipo
  private validateEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }
  
  private validatePhone(value: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(value);
  }
  
  private validateNumber(value: any, validation?: FieldValidation): boolean {
    const num = Number(value);
    if (isNaN(num)) return false;
    
    if (validation?.min !== undefined && num < validation.min) return false;
    if (validation?.max !== undefined && num > validation.max) return false;
    
    return true;
  }
  
  private validateDate(value: string): boolean {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  
  private validateSelect(value: string, options?: string[]): boolean {
    if (!options) return true;
    return options.includes(value);
  }
  
  private validateURL(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
  
  // Validações gerais
  private validateGeneral(value: any, validation: FieldValidation, fieldLabel: string): string[] {
    const errors: string[] = [];
    
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(String(value))) {
        errors.push(`${fieldLabel} não atende ao padrão exigido`);
      }
    }
    
    if (validation.minLength && String(value).length < validation.minLength) {
      errors.push(`${fieldLabel} deve ter pelo menos ${validation.minLength} caracteres`);
    }
    
    if (validation.maxLength && String(value).length > validation.maxLength) {
      errors.push(`${fieldLabel} deve ter no máximo ${validation.maxLength} caracteres`);
    }
    
    return errors;
  }
  
  private isEmpty(value: any): boolean {
    return value === null || value === undefined || value === '';
  }
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

## Mapeamento Automático

### Geração Automática de Mapeamento
```typescript
// Componente para geração automática
const AutoMappingGenerator = ({ connection, onMappingGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([]);
  
  const generateMapping = async () => {
    setLoading(true);
    try {
      // Buscar colunas da tabela NocoDB
      const tableColumns = await databaseConnectionsService.getNocoDBColumns(
        connection.host,
        connection.nocodb_token,
        connection.nocodb_table_id
      );
      
      setColumns(tableColumns);
      
      // Gerar mapeamento automático
      const fieldMappingService = new FieldMappingService();
      const autoMapping = await fieldMappingService.generateAutoMapping(connection);
      
      onMappingGenerated(autoMapping);
      
    } catch (error) {
      toast.error('Erro ao gerar mapeamento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="auto-mapping-generator">
      <h3>Geração Automática de Mapeamento</h3>
      
      <div className="info">
        <p>
          O mapeamento automático irá analisar a estrutura da tabela NocoDB 
          e criar configurações padrão para todos os campos.
        </p>
      </div>
      
      <button 
        onClick={generateMapping} 
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? 'Gerando...' : 'Gerar Mapeamento Automático'}
      </button>
      
      {columns.length > 0 && (
        <div className="columns-preview">
          <h4>Colunas Encontradas ({columns.length})</h4>
          <ul>
            {columns.map(column => (
              <li key={column.id}>
                <strong>{column.title || column.column_name}</strong>
                <span className="type">({column.uidt})</span>
                {column.rqd && <span className="required">*</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

### Regras de Mapeamento Automático
```typescript
const AUTO_MAPPING_RULES = {
  // Campos que devem ser ocultos por padrão
  hiddenFields: [
    'id', 'Id', 'ID',
    'wasendToken', 'wasend_token',
    'created_at', 'createdAt',
    'updated_at', 'updatedAt'
  ],
  
  // Campos que devem ser somente leitura
  readOnlyFields: [
    'id', 'Id', 'ID',
    'wasendToken', 'wasend_token',
    'created_at', 'createdAt',
    'updated_at', 'updatedAt'
  ],
  
  // Mapeamento de tipos NocoDB para tipos de campo
  typeMapping: {
    'ID': 'number',
    'SingleLineText': 'text',
    'LongText': 'textarea',
    'Email': 'email',
    'PhoneNumber': 'phone',
    'Number': 'number',
    'Decimal': 'number',
    'Currency': 'currency',
    'Date': 'date',
    'DateTime': 'datetime',
    'SingleSelect': 'select',
    'Checkbox': 'checkbox',
    'URL': 'url'
  },
  
  // Labels amigáveis para campos comuns
  labelMapping: {
    'nome': 'Nome',
    'name': 'Nome',
    'email': 'E-mail',
    'telefone': 'Telefone',
    'phone': 'Telefone',
    'endereco': 'Endereço',
    'address': 'Endereço',
    'empresa': 'Empresa',
    'company': 'Empresa',
    'status': 'Status',
    'observacoes': 'Observações',
    'notes': 'Observações',
    'valor': 'Valor',
    'value': 'Valor',
    'preco': 'Preço',
    'price': 'Preço',
    'data_nascimento': 'Data de Nascimento',
    'birth_date': 'Data de Nascimento',
    'created_at': 'Data de Criação',
    'updated_at': 'Última Atualização'
  }
};
```

## Mapeamento Personalizado

### Editor de Mapeamento
```typescript
const FieldMappingEditor = ({ mappings, onMappingsChange, connection }) => {
  const [editingMappings, setEditingMappings] = useState(mappings);
  const [availableColumns, setAvailableColumns] = useState([]);
  
  useEffect(() => {
    loadAvailableColumns();
  }, [connection]);
  
  const loadAvailableColumns = async () => {
    try {
      const columns = await databaseConnectionsService.getNocoDBColumns(
        connection.host,
        connection.nocodb_token,
        connection.nocodb_table_id
      );
      setAvailableColumns(columns);
    } catch (error) {
      console.error('Erro ao carregar colunas:', error);
    }
  };
  
  const addMapping = () => {
    const newMapping: FieldMapping = {
      columnName: '',
      label: '',
      visible: true,
      editable: true,
      type: 'text'
    };
    
    setEditingMappings([...editingMappings, newMapping]);
  };
  
  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const updated = [...editingMappings];
    updated[index] = { ...updated[index], ...updates };
    setEditingMappings(updated);
  };
  
  const removeMapping = (index: number) => {
    const updated = editingMappings.filter((_, i) => i !== index);
    setEditingMappings(updated);
  };
  
  const saveMappings = () => {
    // Validar mapeamentos
    const validator = new FieldValidator();
    const errors = [];
    
    editingMappings.forEach((mapping, index) => {
      if (!mapping.columnName) {
        errors.push(`Mapeamento ${index + 1}: Nome da coluna é obrigatório`);
      }
      if (!mapping.label) {
        errors.push(`Mapeamento ${index + 1}: Label é obrigatório`);
      }
    });
    
    if (errors.length > 0) {
      toast.error('Erros de validação:\n' + errors.join('\n'));
      return;
    }
    
    onMappingsChange(editingMappings);
    toast.success('Mapeamentos salvos com sucesso!');
  };
  
  return (
    <div className="field-mapping-editor">
      <div className="header">
        <h3>Editor de Mapeamento de Campos</h3>
        <button onClick={addMapping} className="btn btn-secondary">
          Adicionar Campo
        </button>
      </div>
      
      <div className="mappings-list">
        {editingMappings.map((mapping, index) => (
          <FieldMappingRow
            key={index}
            mapping={mapping}
            availableColumns={availableColumns}
            onUpdate={(updates) => updateMapping(index, updates)}
            onRemove={() => removeMapping(index)}
          />
        ))}
      </div>
      
      <div className="actions">
        <button onClick={saveMappings} className="btn btn-primary">
          Salvar Mapeamentos
        </button>
      </div>
    </div>
  );
};

const FieldMappingRow = ({ mapping, availableColumns, onUpdate, onRemove }) => {
  return (
    <div className="mapping-row">
      <div className="field-group">
        <label>Coluna NocoDB</label>
        <select
          value={mapping.columnName}
          onChange={(e) => onUpdate({ columnName: e.target.value })}
        >
          <option value="">Selecione uma coluna</option>
          {availableColumns.map(column => (
            <option key={column.id} value={column.column_name}>
              {column.title || column.column_name} ({column.uidt})
            </option>
          ))}
        </select>
      </div>
      
      <div className="field-group">
        <label>Label</label>
        <input
          type="text"
          value={mapping.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Nome amigável"
        />
      </div>
      
      <div className="field-group">
        <label>Tipo</label>
        <select
          value={mapping.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
        >
          <option value="text">Texto</option>
          <option value="email">E-mail</option>
          <option value="phone">Telefone</option>
          <option value="number">Número</option>
          <option value="currency">Moeda</option>
          <option value="date">Data</option>
          <option value="datetime">Data/Hora</option>
          <option value="select">Seleção</option>
          <option value="textarea">Texto Longo</option>
          <option value="checkbox">Checkbox</option>
        </select>
      </div>
      
      <div className="field-group checkboxes">
        <label>
          <input
            type="checkbox"
            checked={mapping.visible}
            onChange={(e) => onUpdate({ visible: e.target.checked })}
          />
          Visível
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={mapping.editable}
            onChange={(e) => onUpdate({ editable: e.target.checked })}
          />
          Editável
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={mapping.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
          />
          Obrigatório
        </label>
      </div>
      
      <div className="actions">
        <button onClick={onRemove} className="btn btn-danger btn-sm">
          Remover
        </button>
      </div>
    </div>
  );
};
```

## Interface de Usuário

### Componente de Tabela com Mapeamento
```typescript
const MappedDataTable = ({ connectionId, fieldMappings }) => {
  const { data, loading, error, updateRecord } = useNocoDBCRUD(connectionId);
  const [editingRow, setEditingRow] = useState(null);
  
  const visibleMappings = fieldMappings.filter(mapping => mapping.visible);
  
  const handleCellEdit = async (rowId: string, columnName: string, newValue: any) => {
    try {
      await updateRecord(rowId, { [columnName]: newValue });
      toast.success('Campo atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar campo: ' + error.message);
    }
  };
  
  if (loading) return <div>Carregando dados...</div>;
  if (error) return <div>Erro: {error}</div>;
  
  return (
    <div className="mapped-data-table">
      <table>
        <thead>
          <tr>
            {visibleMappings.map(mapping => (
              <th key={mapping.columnName}>
                {mapping.label}
                {mapping.required && <span className="required">*</span>}
              </th>
            ))}
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.Id}>
              {visibleMappings.map(mapping => (
                <td key={mapping.columnName}>
                  <MappedCell
                    value={row[mapping.columnName]}
                    mapping={mapping}
                    isEditing={editingRow === row.Id}
                    onSave={(newValue) => handleCellEdit(row.Id, mapping.columnName, newValue)}
                  />
                </td>
              ))}
              <td>
                <button
                  onClick={() => setEditingRow(editingRow === row.Id ? null : row.Id)}
                  className="btn btn-sm"
                >
                  {editingRow === row.Id ? 'Salvar' : 'Editar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MappedCell = ({ value, mapping, isEditing, onSave }) => {
  const [editValue, setEditValue] = useState(value);
  const fieldMappingService = new FieldMappingService();
  
  useEffect(() => {
    setEditValue(value);
  }, [value]);
  
  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
  };
  
  if (!isEditing || !mapping.editable) {
    const formattedValue = fieldMappingService.formatValue(value, mapping);
    return <span>{formattedValue}</span>;
  }
  
  // Renderizar campo de edição baseado no tipo
  switch (mapping.type) {
    case 'textarea':
      return (
        <textarea
          value={editValue || ''}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          rows={3}
        />
      );
      
    case 'select':
      return (
        <select
          value={editValue || ''}
          onChange={(e) => {
            setEditValue(e.target.value);
            onSave(e.target.value);
          }}
        >
          <option value="">Selecione...</option>
          {mapping.validation?.options?.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
      
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={Boolean(editValue)}
          onChange={(e) => {
            const newValue = e.target.checked;
            setEditValue(newValue);
            onSave(newValue);
          }}
        />
      );
      
    case 'date':
      return (
        <input
          type="date"
          value={editValue || ''}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
        />
      );
      
    case 'datetime':
      return (
        <input
          type="datetime-local"
          value={editValue || ''}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
        />
      );
      
    default:
      return (
        <input
          type={mapping.type === 'email' ? 'email' : 
                mapping.type === 'phone' ? 'tel' : 
                mapping.type === 'number' || mapping.type === 'currency' ? 'number' : 
                'text'}
          value={editValue || ''}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          placeholder={mapping.label}
        />
      );
  }
};
```

## Casos de Uso

### CRM com Mapeamento Personalizado
```json
{
  "connection": {
    "name": "CRM Leads",
    "type": "NOCODB",
    "host": "https://app.nocodb.com",
    "nocodb_project_id": "p_crm_123",
    "nocodb_table_id": "t_leads_456"
  },
  "fieldMappings": [
    {
      "columnName": "nome_completo",
      "label": "Nome do Lead",
      "visible": true,
      "editable": true,
      "type": "text",
      "required": true,
      "validation": {
        "minLength": 2,
        "maxLength": 100
      }
    },
    {
      "columnName": "email_contato",
      "label": "E-mail Principal",
      "visible": true,
      "editable": true,
      "type": "email",
      "required": true
    },
    {
      "columnName": "telefone_principal",
      "label": "Telefone",
      "visible": true,
      "editable": true,
      "type": "phone",
      "format": {
        "mask": "(99) 99999-9999"
      }
    },
    {
      "columnName": "status_lead",
      "label": "Status do Lead",
      "visible": true,
      "editable": true,
      "type": "select",
      "validation": {
        "options": ["novo", "contatado", "qualificado", "proposta", "convertido", "perdido"]
      }
    },
    {
      "columnName": "valor_estimado",
      "label": "Valor Estimado (R$)",
      "visible": true,
      "editable": true,
      "type": "currency",
      "format": {
        "currency": "BRL"
      }
    },
    {
      "columnName": "data_primeiro_contato",
      "label": "Primeiro Contato",
      "visible": true,
      "editable": false,
      "type": "datetime",
      "format": {
        "dateFormat": "DD/MM/YYYY HH:mm"
      }
    },
    {
      "columnName": "observacoes_internas",
      "label": "Observações",
      "visible": true,
      "editable": true,
      "type": "textarea"
    }
  ]
}
```

### E-commerce com Produtos
```json
{
  "connection": {
    "name": "Catálogo de Produtos",
    "type": "NOCODB",
    "nocodb_project_id": "p_ecommerce_789",
    "nocodb_table_id": "t_products_012"
  },
  "fieldMappings": [
    {
      "columnName": "codigo_produto",
      "label": "Código",
      "visible": true,
      "editable": false,
      "type": "text"
    },
    {
      "columnName": "nome_produto",
      "label": "Nome do Produto",
      "visible": true,
      "editable": true,
      "type": "text",
      "required": true
    },
    {
      "columnName": "preco_venda",
      "label": "Preço de Venda",
      "visible": true,
      "editable": true,
      "type": "currency",
      "required": true,
      "format": {
        "currency": "BRL"
      }
    },
    {
      "columnName": "estoque_atual",
      "label": "Estoque",
      "visible": true,
      "editable": true,
      "type": "number",
      "validation": {
        "min": 0
      }
    },
    {
      "columnName": "categoria_produto",
      "label": "Categoria",
      "visible": true,
      "editable": true,
      "type": "select",
      "validation": {
        "options": ["eletronicos", "roupas", "casa", "esportes", "livros", "outros"]
      }
    },
    {
      "columnName": "produto_ativo",
      "label": "Ativo",
      "visible": true,
      "editable": true,
      "type": "checkbox"
    },
    {
      "columnName": "descricao_completa",
      "label": "Descrição",
      "visible": false,
      "editable": true,
      "type": "textarea"
    }
  ]
}
```

## Troubleshooting

### Problemas Comuns

#### 1. Mapeamento não aparece na interface
**Causa**: Mapeamento mal formatado ou campo não existe na tabela

**Solução**:
```javascript
// Verificar se o campo existe na tabela
const columns = await databaseService.getNocoDBColumns(host, token, tableId);
const fieldExists = columns.some(col => col.column_name === mapping.columnName);

if (!fieldExists) {
  console.error(`Campo ${mapping.columnName} não existe na tabela`);
}
```

#### 2. Validação não funciona
**Causa**: Regex inválido ou tipo de campo incorreto

**Solução**:
```javascript
// Testar regex
try {
  const regex = new RegExp(mapping.validation.pattern);
  console.log('Regex válido:', regex.test(testValue));
} catch (error) {
  console.error('Regex inválido:', error.message);
}
```

#### 3. Formatação não aplicada
**Causa**: Tipo de campo não suporta formatação ou formato inválido

**Solução**:
```javascript
// Verificar se tipo suporta formatação
const formattableTypes = ['date', 'datetime', 'currency', 'number', 'phone'];
if (!formattableTypes.includes(mapping.type)) {
  console.warn(`Tipo ${mapping.type} não suporta formatação`);
}
```

### Debug de Mapeamento
```javascript
const debugFieldMapping = (mappings, data) => {
  console.group('🔍 Debug Field Mapping');
  
  console.log('Mapeamentos configurados:', mappings.length);
  console.table(mappings.map(m => ({
    coluna: m.columnName,
    label: m.label,
    tipo: m.type,
    visível: m.visible,
    editável: m.editable
  })));
  
  if (data.length > 0) {
    const sampleRow = data[0];
    const availableFields = Object.keys(sampleRow);
    const mappedFields = mappings.map(m => m.columnName);
    
    console.log('Campos disponíveis nos dados:', availableFields);
    console.log('Campos mapeados:', mappedFields);
    
    const missingFields = mappedFields.filter(field => !availableFields.includes(field));
    if (missingFields.length > 0) {
      console.warn('⚠️ Campos mapeados mas não encontrados nos dados:', missingFields);
    }
    
    const unmappedFields = availableFields.filter(field => !mappedFields.includes(field));
    if (unmappedFields.length > 0) {
      console.info('ℹ️ Campos disponíveis mas não mapeados:', unmappedFields);
    }
  }
  
  console.groupEnd();
};
```

---

**Conclusão**: Este guia fornece uma base completa para implementação e uso de mapeamento de campos na integração NocoDB, permitindo interfaces flexíveis e personalizáveis para diferentes casos de uso.