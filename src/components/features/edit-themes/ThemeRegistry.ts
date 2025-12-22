/**
 * Theme Registry
 * 
 * Singleton registry for managing edit page themes.
 * Provides isolation of themes from the core system.
 */

import type { EditTheme, EditThemeMetadata, ThemeValidationResult } from '@/types/edit-themes';

/**
 * Validates that an object implements the EditTheme interface
 */
export function validateTheme(theme: unknown): ThemeValidationResult {
  const errors: string[] = [];

  if (!theme || typeof theme !== 'object') {
    return { valid: false, errors: ['Theme must be an object'] };
  }

  const t = theme as Record<string, unknown>;

  if (typeof t.id !== 'string' || t.id.trim() === '') {
    errors.push('Theme must have a non-empty string id');
  }

  if (typeof t.name !== 'string' || t.name.trim() === '') {
    errors.push('Theme must have a non-empty string name');
  }

  if (typeof t.description !== 'string') {
    errors.push('Theme must have a string description');
  }

  if (typeof t.preview !== 'string') {
    errors.push('Theme must have a string preview');
  }

  if (typeof t.component !== 'function') {
    errors.push('Theme must have a component function');
  }

  return { valid: errors.length === 0, errors };
}

class ThemeRegistry {
  private themes = new Map<string, EditTheme>();
  private defaultThemeId = 'default';

  /**
   * Register a theme in the registry
   * @throws Error if theme is invalid or already registered
   */
  register(theme: EditTheme): void {
    const validation = validateTheme(theme);
    if (!validation.valid) {
      throw new Error(`Invalid theme: ${validation.errors.join(', ')}`);
    }

    if (this.themes.has(theme.id)) {
      throw new Error(`Theme with id "${theme.id}" is already registered`);
    }

    this.themes.set(theme.id, theme);
  }

  /**
   * Unregister a theme from the registry
   * Cannot unregister the default theme
   */
  unregister(themeId: string): boolean {
    if (themeId === this.defaultThemeId) {
      console.warn('Cannot unregister the default theme');
      return false;
    }
    return this.themes.delete(themeId);
  }

  /**
   * Get a theme by ID
   * Returns the default theme if not found
   */
  get(themeId: string): EditTheme {
    const theme = this.themes.get(themeId);
    if (theme) {
      return theme;
    }

    // Fallback to default theme
    const defaultTheme = this.themes.get(this.defaultThemeId);
    if (defaultTheme) {
      return defaultTheme;
    }

    throw new Error('No default theme registered');
  }

  /**
   * Get the default theme
   */
  getDefault(): EditTheme {
    const defaultTheme = this.themes.get(this.defaultThemeId);
    if (!defaultTheme) {
      throw new Error('No default theme registered');
    }
    return defaultTheme;
  }

  /**
   * Check if a theme is registered
   */
  has(themeId: string): boolean {
    return this.themes.has(themeId);
  }

  /**
   * List all registered themes
   */
  list(): EditTheme[] {
    return Array.from(this.themes.values());
  }

  /**
   * List metadata for all registered themes (without components)
   */
  listMetadata(): EditThemeMetadata[] {
    return this.list().map(({ id, name, description, preview }) => ({
      id,
      name,
      description,
      preview,
    }));
  }

  /**
   * Set the default theme ID
   */
  setDefaultThemeId(themeId: string): void {
    if (!this.themes.has(themeId)) {
      throw new Error(`Theme "${themeId}" is not registered`);
    }
    this.defaultThemeId = themeId;
  }

  /**
   * Get the default theme ID
   */
  getDefaultThemeId(): string {
    return this.defaultThemeId;
  }

  /**
   * Clear all themes (useful for testing)
   */
  clear(): void {
    this.themes.clear();
    this.defaultThemeId = 'default';
  }
}

// Export singleton instance
export const themeRegistry = new ThemeRegistry();

// Export class for testing
export { ThemeRegistry };
