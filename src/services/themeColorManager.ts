/**
 * Theme Color Manager Service
 * 
 * Manages dynamic theme colors by converting hex colors to HSL format
 * and applying them as CSS variables to the DOM.
 */

/**
 * Converts a hex color to HSL format
 * @param hex - Hex color string (with or without #)
 * @returns HSL string in format "H S% L%" (e.g., "210 100% 50%")
 */
export function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');

  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error(`Invalid hex color format: ${hex}`);
  }

  // Convert to RGB (0-1 range)
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Calculate HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Return in format "H S% L%"
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Calculates an appropriate foreground color based on background luminosity
 * @param hsl - HSL string in format "H S% L%"
 * @returns HSL string for foreground color (dark or light)
 */
export function calculateForeground(hsl: string): string {
  // Extract luminosity from HSL string
  const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);

  if (!match) {
    throw new Error(`Invalid HSL format: ${hsl}`);
  }

  const luminosity = parseInt(match[3], 10);

  // If luminosity > 50%, use dark foreground
  // If luminosity <= 50%, use light foreground
  if (luminosity > 50) {
    return '222 47% 11%'; // Dark color for light backgrounds
  } else {
    return '210 40% 98%'; // Light color for dark backgrounds
  }
}

/**
 * Applies theme colors to the DOM by setting CSS variables
 * @param primaryColor - Hex color for dark theme
 * @param secondaryColor - Hex color for light theme
 * @param primaryForeground - Optional hex color for dark theme foreground
 * @param secondaryForeground - Optional hex color for light theme foreground
 */
export function applyThemeColors(
  primaryColor: string,
  secondaryColor: string,
  primaryForeground?: string | null,
  secondaryForeground?: string | null
): void {
  try {
    // Convert colors to HSL
    const primaryHSL = hexToHSL(primaryColor);
    const secondaryHSL = hexToHSL(secondaryColor);

    // Calculate foreground colors or use provided ones
    let primaryForegroundHSL: string;
    if (primaryForeground) {
      primaryForegroundHSL = hexToHSL(primaryForeground);
    } else {
      primaryForegroundHSL = calculateForeground(primaryHSL);
    }

    let secondaryForegroundHSL: string;
    if (secondaryForeground) {
      secondaryForegroundHSL = hexToHSL(secondaryForeground);
    } else {
      secondaryForegroundHSL = calculateForeground(secondaryHSL);
    }

    // Get root element
    const root = document.documentElement;

    // Check if dark mode is currently active
    const isDarkMode = root.classList.contains('dark');

    // Apply colors based on current theme
    if (isDarkMode) {
      // Apply dark theme colors (uses primaryColor)
      root.style.setProperty('--primary', primaryHSL);
      root.style.setProperty('--primary-foreground', primaryForegroundHSL);
      root.style.setProperty('--accent', primaryHSL);
      root.style.setProperty('--sidebar-primary', primaryHSL);
      root.style.setProperty('--ring', primaryHSL);
    } else {
      // Apply light theme colors (uses secondaryColor)
      root.style.setProperty('--primary', secondaryHSL);
      root.style.setProperty('--primary-foreground', secondaryForegroundHSL);
      root.style.setProperty('--accent', secondaryHSL);
      root.style.setProperty('--sidebar-primary', secondaryHSL);
      root.style.setProperty('--ring', secondaryHSL);
    }

    // Store colors in data attributes for theme switching
    root.setAttribute('data-theme-primary', primaryColor);
    root.setAttribute('data-theme-secondary', secondaryColor);

    if (primaryForeground) {
      root.setAttribute('data-theme-primary-foreground', primaryForeground);
    } else {
      root.removeAttribute('data-theme-primary-foreground');
    }

    if (secondaryForeground) {
      root.setAttribute('data-theme-secondary-foreground', secondaryForeground);
    } else {
      root.removeAttribute('data-theme-secondary-foreground');
    }

    root.setAttribute('data-custom-theme', 'true');
  } catch (error) {
    console.error('Error applying theme colors:', error);
    throw error;
  }
}

/**
 * Updates theme colors when theme mode changes (dark/light toggle)
 * Reads stored colors from data attributes and reapplies them
 */
export function updateThemeOnModeChange(): void {
  const root = document.documentElement;

  // Check if custom theme is applied
  const hasCustomTheme = root.getAttribute('data-custom-theme') === 'true';

  if (!hasCustomTheme) {
    return;
  }

  // Get stored colors
  const primaryColor = root.getAttribute('data-theme-primary');
  const secondaryColor = root.getAttribute('data-theme-secondary');
  const primaryForeground = root.getAttribute('data-theme-primary-foreground');
  const secondaryForeground = root.getAttribute('data-theme-secondary-foreground');

  if (primaryColor && secondaryColor) {
    applyThemeColors(primaryColor, secondaryColor, primaryForeground, secondaryForeground);
  }
}

/**
 * Resets theme colors by removing custom CSS variables
 */
export function resetThemeColors(): void {
  const root = document.documentElement;

  // Remove custom variables
  root.style.removeProperty('--primary');
  root.style.removeProperty('--primary-foreground');
  root.style.removeProperty('--accent');
  root.style.removeProperty('--sidebar-primary');
  root.style.removeProperty('--ring');

  // Remove data attributes
  root.removeAttribute('data-custom-theme');
  root.removeAttribute('data-theme-primary');
  root.removeAttribute('data-theme-secondary');
  root.removeAttribute('data-theme-primary-foreground');
  root.removeAttribute('data-theme-secondary-foreground');
}

/**
 * Converts hex color to RGB values
 * @param hex - Hex color string (with or without #)
 * @returns RGB object with r, g, b values (0-255)
 */
export function hexToRGB(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace('#', '');

  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error(`Invalid hex color format: ${hex}`);
  }

  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

/**
 * Calculates relative luminance of a color (WCAG formula)
 * @param rgb - RGB object with r, g, b values (0-255)
 * @returns Relative luminance (0-1)
 */
export function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  // Convert to 0-1 range and apply gamma correction
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates contrast ratio between two colors (WCAG formula)
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRGB(color1);
  const rgb2 = hexToRGB(color2);

  const l1 = getRelativeLuminance(rgb1);
  const l2 = getRelativeLuminance(rgb2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validates if contrast ratio meets WCAG AA standard
 * @param contrastRatio - Contrast ratio to validate
 * @returns Object with validation result and level
 */
export function validateContrast(contrastRatio: number): {
  isValid: boolean;
  level: 'AAA' | 'AA' | 'fail';
  ratio: number;
} {
  return {
    isValid: contrastRatio >= 4.5,
    level: contrastRatio >= 7 ? 'AAA' : contrastRatio >= 4.5 ? 'AA' : 'fail',
    ratio: Math.round(contrastRatio * 100) / 100,
  };
}

/**
 * Suggests color adjustments to improve contrast
 * @param backgroundColor - Background hex color
 * @param foregroundColor - Foreground hex color
 * @returns Suggested adjustments
 */
export function suggestContrastAdjustment(
  backgroundColor: string,
  foregroundColor: string
): {
  needsAdjustment: boolean;
  suggestion: string;
  currentRatio: number;
  targetRatio: number;
} {
  const ratio = calculateContrastRatio(backgroundColor, foregroundColor);
  const validation = validateContrast(ratio);

  if (validation.isValid) {
    return {
      needsAdjustment: false,
      suggestion: 'O contraste está adequado.',
      currentRatio: ratio,
      targetRatio: 4.5,
    };
  }

  const bgRGB = hexToRGB(backgroundColor);
  const bgLuminance = getRelativeLuminance(bgRGB);

  let suggestion = '';
  if (bgLuminance > 0.5) {
    suggestion = 'Considere usar uma cor mais escura para melhor contraste.';
  } else {
    suggestion = 'Considere usar uma cor mais clara para melhor contraste.';
  }

  return {
    needsAdjustment: true,
    suggestion,
    currentRatio: ratio,
    targetRatio: 4.5,
  };
}
