import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { TypeAwareFieldInput } from '../TypeAwareFieldInput';
import { FieldType, FieldMetadata } from '@/lib/types';

describe('TypeAwareFieldInput', () => {
  describe('Text Input', () => {
    it('should render text input for TEXT type', () => {
      const field: FieldMetadata = {
        columnName: 'name',
        label: 'Name',
        type: FieldType.TEXT,
        uidt: 'SingleLineText',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="John" onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('John');
    });

    it('should render textarea for LONG_TEXT type', () => {
      const field: FieldMetadata = {
        columnName: 'description',
        label: 'Description',
        type: FieldType.LONG_TEXT,
        uidt: 'LongText',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="Long text" onChange={vi.fn()} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Long text');
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('Number Inputs', () => {
    it('should render NumberInput for NUMBER type', () => {
      const field: FieldMetadata = {
        columnName: 'age',
        label: 'Age',
        type: FieldType.NUMBER,
        uidt: 'Number',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={25} onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should render NumberInput for DECIMAL type', () => {
      const field: FieldMetadata = {
        columnName: 'price',
        label: 'Price',
        type: FieldType.DECIMAL,
        uidt: 'Decimal',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={19.99} onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should render NumberInput for CURRENCY type', () => {
      const field: FieldMetadata = {
        columnName: 'salary',
        label: 'Salary',
        type: FieldType.CURRENCY,
        uidt: 'Currency',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={5000} onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should render NumberInput for PERCENT type', () => {
      const field: FieldMetadata = {
        columnName: 'discount',
        label: 'Discount',
        type: FieldType.PERCENT,
        uidt: 'Percent',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={15} onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Email, Phone, URL Inputs', () => {
    it('should render EmailInput for EMAIL type', () => {
      const field: FieldMetadata = {
        columnName: 'email',
        label: 'Email',
        type: FieldType.EMAIL,
        uidt: 'Email',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="test@example.com" onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('test@example.com');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('should render PhoneInput for PHONE type', () => {
      const field: FieldMetadata = {
        columnName: 'phone',
        label: 'Phone',
        type: FieldType.PHONE,
        uidt: 'PhoneNumber',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="(11) 98765-4321" onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('(11) 98765-4321');
      expect(input).toHaveAttribute('type', 'tel');
    });

    it('should render UrlInput for URL type', () => {
      const field: FieldMetadata = {
        columnName: 'website',
        label: 'Website',
        type: FieldType.URL,
        uidt: 'URL',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="https://example.com" onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('https://example.com');
    });
  });

  describe('Select Inputs', () => {
    it('should render Select for SINGLE_SELECT type', () => {
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

      render(<TypeAwareFieldInput field={field} value="1" onChange={vi.fn()} />);
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should render MultiSelectInput for MULTI_SELECT type', () => {
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

      render(<TypeAwareFieldInput field={field} value={['1']} onChange={vi.fn()} />);
      
      // MultiSelectInput should be rendered
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('should fallback to text input when no options for SINGLE_SELECT', () => {
      const field: FieldMetadata = {
        columnName: 'status',
        label: 'Status',
        type: FieldType.SINGLE_SELECT,
        uidt: 'SingleSelect',
        required: false,
        editable: true,
        visible: true,
        options: []
      };

      render(<TypeAwareFieldInput field={field} value="value" onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('value');
    });
  });

  describe('Date Inputs', () => {
    it('should render date picker for DATE type', () => {
      const field: FieldMetadata = {
        columnName: 'birthdate',
        label: 'Birth Date',
        type: FieldType.DATE,
        uidt: 'Date',
        required: false,
        editable: true,
        visible: true
      };

      const date = new Date('2024-01-01');
      render(<TypeAwareFieldInput field={field} value={date} onChange={vi.fn()} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should render DateTimePicker for DATETIME type', () => {
      const field: FieldMetadata = {
        columnName: 'created_at',
        label: 'Created At',
        type: FieldType.DATETIME,
        uidt: 'DateTime',
        required: false,
        editable: true,
        visible: true
      };

      const date = new Date('2024-01-01T12:00:00');
      render(<TypeAwareFieldInput field={field} value={date} onChange={vi.fn()} />);
      
      expect(screen.getByText('Created At')).toBeInTheDocument();
    });

    it('should render TimePicker for TIME type', () => {
      const field: FieldMetadata = {
        columnName: 'time',
        label: 'Time',
        type: FieldType.TIME,
        uidt: 'Time',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="12:00" onChange={vi.fn()} />);
      
      expect(screen.getByText('Time')).toBeInTheDocument();
    });
  });

  describe('Checkbox Input', () => {
    it('should render checkbox for CHECKBOX type', () => {
      const field: FieldMetadata = {
        columnName: 'active',
        label: 'Active',
        type: FieldType.CHECKBOX,
        uidt: 'Checkbox',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={true} onChange={vi.fn()} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should handle checkbox change', () => {
      const onChange = vi.fn();
      const field: FieldMetadata = {
        columnName: 'active',
        label: 'Active',
        type: FieldType.CHECKBOX,
        uidt: 'Checkbox',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={false} onChange={onChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Special Types', () => {
    it('should render year input for YEAR type', () => {
      const field: FieldMetadata = {
        columnName: 'year',
        label: 'Year',
        type: FieldType.YEAR,
        uidt: 'Year',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={2024} onChange={vi.fn()} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(2024);
      expect(input).toHaveAttribute('min', '1900');
      expect(input).toHaveAttribute('max', '2100');
    });

    it('should render rating input for RATING type', () => {
      const field: FieldMetadata = {
        columnName: 'rating',
        label: 'Rating',
        type: FieldType.RATING,
        uidt: 'Rating',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={4} onChange={vi.fn()} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(4);
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '5');
    });

    it('should render JSON textarea for JSON type', () => {
      const field: FieldMetadata = {
        columnName: 'metadata',
        label: 'Metadata',
        type: FieldType.JSON,
        uidt: 'JSON',
        required: false,
        editable: true,
        visible: true
      };

      const jsonValue = { key: 'value' };
      render(<TypeAwareFieldInput field={field} value={jsonValue} onChange={vi.fn()} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(JSON.stringify(jsonValue, null, 2));
    });
  });

  describe('Required Fields', () => {
    it('should show asterisk for required fields', () => {
      const field: FieldMetadata = {
        columnName: 'name',
        label: 'Name',
        type: FieldType.TEXT,
        uidt: 'SingleLineText',
        required: true,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="" onChange={vi.fn()} />);
      
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should not show asterisk for non-required fields', () => {
      const field: FieldMetadata = {
        columnName: 'name',
        label: 'Name',
        type: FieldType.TEXT,
        uidt: 'SingleLineText',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="" onChange={vi.fn()} />);
      
      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should display error message', () => {
      const field: FieldMetadata = {
        columnName: 'email',
        label: 'Email',
        type: FieldType.EMAIL,
        uidt: 'Email',
        required: false,
        editable: true,
        visible: true
      };

      render(
        <TypeAwareFieldInput
          field={field}
          value="invalid"
          onChange={vi.fn()}
          error="Email inválido"
        />
      );
      
      expect(screen.getByText('Email inválido')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should not display error when no error prop', () => {
      const field: FieldMetadata = {
        columnName: 'email',
        label: 'Email',
        type: FieldType.EMAIL,
        uidt: 'Email',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="test@example.com" onChange={vi.fn()} />);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should disable input when disabled prop is true', () => {
      const field: FieldMetadata = {
        columnName: 'name',
        label: 'Name',
        type: FieldType.TEXT,
        uidt: 'SingleLineText',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="John" onChange={vi.fn()} disabled />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should disable input when field is not editable', () => {
      const field: FieldMetadata = {
        columnName: 'id',
        label: 'ID',
        type: FieldType.NUMBER,
        uidt: 'Number',
        required: false,
        editable: false,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={123} onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Value Parsing', () => {
    it('should parse null values correctly', () => {
      const field: FieldMetadata = {
        columnName: 'name',
        label: 'Name',
        type: FieldType.TEXT,
        uidt: 'SingleLineText',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={null} onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('should parse date strings to Date objects', () => {
      const field: FieldMetadata = {
        columnName: 'date',
        label: 'Date',
        type: FieldType.DATE,
        uidt: 'Date',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="2024-01-01" onChange={vi.fn()} />);
      
      // Date picker button should be rendered
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should parse checkbox values to boolean', () => {
      const field: FieldMetadata = {
        columnName: 'active',
        label: 'Active',
        type: FieldType.CHECKBOX,
        uidt: 'Checkbox',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value={1} onChange={vi.fn()} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should parse multi-select values to array', () => {
      const field: FieldMetadata = {
        columnName: 'tags',
        label: 'Tags',
        type: FieldType.MULTI_SELECT,
        uidt: 'MultiSelect',
        required: false,
        editable: true,
        visible: true,
        options: [
          { id: '1', title: 'Tag1' }
        ]
      };

      render(<TypeAwareFieldInput field={field} value="1" onChange={vi.fn()} />);
      
      // Should convert string to array
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });
  });

  describe('Helper Text', () => {
    it('should display helper text for non-checkbox fields', () => {
      const field: FieldMetadata = {
        columnName: 'email',
        label: 'Email',
        type: FieldType.EMAIL,
        uidt: 'Email',
        required: false,
        editable: true,
        visible: true,
        helperText: 'Enter your email address'
      };

      render(<TypeAwareFieldInput field={field} value="" onChange={vi.fn()} />);
      
      expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    });
  });

  describe('onChange Handling', () => {
    it('should call onChange with correct value for text input', () => {
      const onChange = vi.fn();
      const field: FieldMetadata = {
        columnName: 'name',
        label: 'Name',
        type: FieldType.TEXT,
        uidt: 'SingleLineText',
        required: false,
        editable: true,
        visible: true
      };

      render(<TypeAwareFieldInput field={field} value="" onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'John' } });
      
      expect(onChange).toHaveBeenCalledWith('John');
    });
  });
});
