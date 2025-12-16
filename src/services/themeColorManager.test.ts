import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  hexToHSL,
  calculateForeground,
  applyThemeColors,
  resetThemeColors,
  updateThemeOnModeChange,
} from './themeColorManager';

describe('themeColorManager', () => {
  describe('hexToHSL', () => {
    it('should convert hex to HSL format', () => {
      const result = hexToHSL('#3B82F6');
      expect(result).toMatch(/^\d+ \d+% \d+%$/);
    });

    it('should handle hex without # prefix', () => {
      const result = hexToHSL('3B82F6');
      expect(result).toMatch(/^\d+ \d+% \d+%$/);
    });

    it('should convert pure red correctly', () => {
      const result = hexToHSL('#FF0000');
      expect(result).toBe('0 100% 50%');
    });

    it('should convert pure green correctly', () => {
      const result = hexToHSL('#00FF00');
      expect(result).toBe('120 100% 50%');
    });

    it('should convert pure blue correctly', () => {
      const result = hexToHSL('#0000FF');
      expect(result).toBe('240 100% 50%');
    });

    it('should convert white correctly', () => {
      const result = hexToHSL('#FFFFFF');
      expect(result).toBe('0 0% 100%');
    });

    it('should convert black correctly', () => {
      const result = hexToHSL('#000000');
      expect(result).toBe('0 0% 0%');
    });

    it('should throw error for invalid hex format', () => {
      expect(() => hexToHSL('invalid')).toThrow('Invalid hex color format');
      expect(() => hexToHSL('#GGG')).toThrow('Invalid hex color format');
      expect(() => hexToHSL('#12345')).toThrow('Invalid hex color format');
    });
  });

  describe('calculateForeground', () => {
    it('should return dark foreground for light backgrounds', () => {
      const lightBackground = '210 100% 80%'; // High luminosity
      const result = calculateForeground(lightBackground);
      expect(result).toBe('222 47% 11%'); // Dark color
    });

    it('should return light foreground for dark backgrounds', () => {
      const darkBackground = '210 100% 30%'; // Low luminosity
      const result = calculateForeground(darkBackground);
      expect(result).toBe('210 40% 98%'); // Light color
    });

    it('should handle edge case at 50% luminosity', () => {
      const midBackground = '210 100% 50%';
      const result = calculateForeground(midBackground);
      expect(result).toBe('210 40% 98%'); // Light color (50% is not > 50%)
    });

    it('should throw error for invalid HSL format', () => {
      expect(() => calculateForeground('invalid')).toThrow('Invalid HSL format');
      expect(() => calculateForeground('210 100')).toThrow('Invalid HSL format');
    });
  });

  describe('applyThemeColors', () => {
    beforeEach(() => {
      // Reset any existing custom theme
      resetThemeColors();
    });

    afterEach(() => {
      // Clean up after each test
      resetThemeColors();
      document.documentElement.classList.remove('dark');
    });

    it('should apply light theme colors when not in dark mode', () => {
      const primaryColor = '#3B82F6';
      const secondaryColor = '#10B981';

      applyThemeColors(primaryColor, secondaryColor);

      const root = document.documentElement;
      const primaryVar = root.style.getPropertyValue('--primary');
      
      // Should use secondaryColor for light mode
      expect(primaryVar).toBeTruthy();
      expect(root.getAttribute('data-custom-theme')).toBe('true');
      expect(root.getAttribute('data-theme-primary')).toBe(primaryColor);
      expect(root.getAttribute('data-theme-secondary')).toBe(secondaryColor);
    });

    it('should apply dark theme colors when in dark mode', () => {
      document.documentElement.classList.add('dark');
      
      const primaryColor = '#3B82F6';
      const secondaryColor = '#10B981';

      applyThemeColors(primaryColor, secondaryColor);

      const root = document.documentElement;
      const primaryVar = root.style.getPropertyValue('--primary');
      
      // Should use primaryColor for dark mode
      expect(primaryVar).toBeTruthy();
      expect(root.getAttribute('data-custom-theme')).toBe('true');
    });

    it('should set all required CSS variables', () => {
      const primaryColor = '#3B82F6';
      const secondaryColor = '#10B981';

      applyThemeColors(primaryColor, secondaryColor);

      const root = document.documentElement;
      
      expect(root.style.getPropertyValue('--primary')).toBeTruthy();
      expect(root.style.getPropertyValue('--primary-foreground')).toBeTruthy();
      expect(root.style.getPropertyValue('--accent')).toBeTruthy();
      expect(root.style.getPropertyValue('--sidebar-primary')).toBeTruthy();
      expect(root.style.getPropertyValue('--ring')).toBeTruthy();
    });
  });

  describe('resetThemeColors', () => {
    it('should remove all custom CSS variables', () => {
      // First apply colors
      applyThemeColors('#3B82F6', '#10B981');
      
      // Then reset
      resetThemeColors();

      const root = document.documentElement;
      
      expect(root.style.getPropertyValue('--primary')).toBe('');
      expect(root.style.getPropertyValue('--primary-foreground')).toBe('');
      expect(root.style.getPropertyValue('--accent')).toBe('');
      expect(root.style.getPropertyValue('--sidebar-primary')).toBe('');
      expect(root.style.getPropertyValue('--ring')).toBe('');
    });

    it('should remove data attributes', () => {
      applyThemeColors('#3B82F6', '#10B981');
      resetThemeColors();

      const root = document.documentElement;
      
      expect(root.getAttribute('data-custom-theme')).toBeNull();
      expect(root.getAttribute('data-theme-primary')).toBeNull();
      expect(root.getAttribute('data-theme-secondary')).toBeNull();
    });
  });

  describe('updateThemeOnModeChange', () => {
    afterEach(() => {
      resetThemeColors();
      document.documentElement.classList.remove('dark');
    });

    it('should reapply colors when theme mode changes', () => {
      const primaryColor = '#3B82F6';
      const secondaryColor = '#10B981';

      // Apply colors in light mode
      applyThemeColors(primaryColor, secondaryColor);
      
      // Switch to dark mode
      document.documentElement.classList.add('dark');
      
      // Update theme
      updateThemeOnModeChange();

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--primary')).toBeTruthy();
      expect(root.getAttribute('data-custom-theme')).toBe('true');
    });

    it('should do nothing if no custom theme is applied', () => {
      updateThemeOnModeChange();
      
      const root = document.documentElement;
      expect(root.getAttribute('data-custom-theme')).toBeNull();
    });
  });
});
