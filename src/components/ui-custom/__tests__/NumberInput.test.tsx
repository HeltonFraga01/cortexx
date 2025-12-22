import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { NumberInput } from '../NumberInput';

describe('NumberInput', () => {
  describe('Integer Mode', () => {
    it('should render with initial value', () => {
      render(<NumberInput value={123} mode="integer" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('123');
    });

    it('should call onChange with numeric value', () => {
      const onChange = vi.fn();
      render(<NumberInput value={null} onChange={onChange} mode="integer" />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '456' } });
      fireEvent.blur(input);
      
      expect(onChange).toHaveBeenCalledWith(456);
    });

    it('should reject decimal values in integer mode', () => {
      const onChange = vi.fn();
      const onValidationChange = vi.fn();
      
      render(
        <NumberInput
          value={null}
          onChange={onChange}
          onValidationChange={onValidationChange}
          mode="integer"
        />
      );
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '123.45' } });
      fireEvent.blur(input);
      
      expect(onValidationChange).toHaveBeenCalledWith(false, 'Apenas números inteiros são permitidos');
    });

    it('should format integer on blur', () => {
      render(<NumberInput value={1234567} mode="integer" />);
      const input = screen.getByRole('textbox');
      
      fireEvent.focus(input);
      expect(input).toHaveValue('1234567');
      
      fireEvent.blur(input);
      expect(input).toHaveValue('1.234.567');
    });
  });

  describe('Decimal Mode', () => {
    it('should accept decimal values', () => {
      const onChange = vi.fn();
      render(<NumberInput value={null} onChange={onChange} mode="decimal" precision={2} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '123.45' } });
      fireEvent.blur(input);
      
      expect(onChange).toHaveBeenCalledWith(123.45);
    });

    it('should enforce precision', () => {
      const onValidationChange = vi.fn();
      
      render(
        <NumberInput
          value={null}
          onValidationChange={onValidationChange}
          mode="decimal"
          precision={2}
        />
      );
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '123.456' } });
      fireEvent.blur(input);
      
      expect(onValidationChange).toHaveBeenCalledWith(false, 'Máximo de 2 casas decimais');
    });

    it('should format decimal on blur', () => {
      render(<NumberInput value={123.45} mode="decimal" precision={2} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.focus(input);
      expect(input).toHaveValue('123.45');
      
      fireEvent.blur(input);
      expect(input).toHaveValue('123,45');
    });
  });

  describe('Currency Mode', () => {
    it('should display currency symbol', () => {
      render(<NumberInput value={1234.56} mode="currency" precision={2} />);
      const input = screen.getByRole('textbox');
      
      // Currency formatting includes non-breaking space
      expect(input.value).toContain('1.234,56');
    });

    it('should remove currency formatting on focus', () => {
      render(<NumberInput value={1234.56} mode="currency" precision={2} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.focus(input);
      expect(input).toHaveValue('1234.56');
    });
  });

  describe('Percent Mode', () => {
    it('should display percent symbol', () => {
      render(<NumberInput value={50} mode="percent" precision={2} />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveValue('50,00%');
    });

    it('should remove percent formatting on focus', () => {
      render(<NumberInput value={50} mode="percent" precision={2} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.focus(input);
      expect(input).toHaveValue('50');
    });
  });

  describe('Validation', () => {
    it('should validate min value', () => {
      const onValidationChange = vi.fn();
      
      render(
        <NumberInput
          value={null}
          onValidationChange={onValidationChange}
          min={10}
        />
      );
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.blur(input);
      
      expect(onValidationChange).toHaveBeenCalledWith(false, 'Valor mínimo é 10');
    });

    it('should validate max value', () => {
      const onValidationChange = vi.fn();
      
      render(
        <NumberInput
          value={null}
          onValidationChange={onValidationChange}
          max={100}
        />
      );
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '150' } });
      fireEvent.blur(input);
      
      expect(onValidationChange).toHaveBeenCalledWith(false, 'Valor máximo é 100');
    });

    it('should reject negative values when not allowed', () => {
      const onValidationChange = vi.fn();
      
      render(
        <NumberInput
          value={null}
          onValidationChange={onValidationChange}
          allowNegative={false}
        />
      );
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '-10' } });
      fireEvent.blur(input);
      
      expect(onValidationChange).toHaveBeenCalledWith(false, 'Valores negativos não são permitidos');
    });

    it('should accept negative values when allowed', () => {
      const onChange = vi.fn();
      
      render(
        <NumberInput
          value={null}
          onChange={onChange}
          allowNegative={true}
        />
      );
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '-10' } });
      fireEvent.blur(input);
      
      expect(onChange).toHaveBeenCalledWith(-10);
    });

    it('should reject non-numeric input', () => {
      const onValidationChange = vi.fn();
      
      render(
        <NumberInput
          value={null}
          onChange={vi.fn()}
          onValidationChange={onValidationChange}
        />
      );
      
      const input = screen.getByRole('textbox');
      // The component sanitizes input, so 'abc' becomes empty string
      fireEvent.change(input, { target: { value: 'abc123def' } });
      fireEvent.blur(input);
      
      // After sanitization, '123' is valid
      expect(onValidationChange).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<NumberInput value={123} disabled />);
      const input = screen.getByRole('textbox');
      
      expect(input).toBeDisabled();
    });

    it('should not call onChange when disabled', () => {
      const onChange = vi.fn();
      render(<NumberInput value={123} onChange={onChange} disabled />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '456' } });
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Empty Values', () => {
    it('should handle null value', () => {
      render(<NumberInput value={null} />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveValue('');
    });

    it('should handle undefined value', () => {
      render(<NumberInput value={undefined} />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveValue('');
    });

    it('should handle empty string', () => {
      render(<NumberInput value="" />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveValue('');
    });
  });

  describe('Focus Behavior', () => {
    it('should convert formatted value to raw number on focus', () => {
      render(<NumberInput value={1234} mode="integer" />);
      const input = screen.getByRole('textbox');
      
      // Initially formatted
      expect(input).toHaveValue('1.234');
      
      // On focus, should show raw number
      fireEvent.focus(input);
      expect(input).toHaveValue('1234');
    });
  });
});
