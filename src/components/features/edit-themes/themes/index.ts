/**
 * Theme Registration
 * 
 * This module registers all available edit themes with the ThemeRegistry.
 * Import this module to ensure all themes are registered.
 */

import { themeRegistry } from '../ThemeRegistry';
import { DefaultThemeComponent } from './DefaultTheme';
import { ProfileCardThemeComponent } from './ProfileCardTheme';
import { SectionsThemeComponent } from './SectionsTheme';
import type { EditTheme } from '@/types/edit-themes';

// Default Theme Definition
const defaultTheme: EditTheme = {
  id: 'default',
  name: 'Padrão',
  description: 'Layout padrão com formulário em grid de duas colunas',
  preview: '/theme-previews/default.png',
  component: DefaultThemeComponent,
};

// Profile Card Theme Definition
const profileCardTheme: EditTheme = {
  id: 'profile-card',
  name: 'Cartão de Perfil',
  description: 'Layout com avatar e informações em destaque, ideal para perfis de usuários',
  preview: '/theme-previews/profile-card.png',
  component: ProfileCardThemeComponent,
};

// Sections Theme Definition
const sectionsTheme: EditTheme = {
  id: 'sections',
  name: 'Seções',
  description: 'Layout com seções expansíveis, ideal para formulários com muitos campos',
  preview: '/theme-previews/sections.png',
  component: SectionsThemeComponent,
};

// Register all themes
export function registerAllThemes(): void {
  // Clear existing themes (useful for hot reload)
  themeRegistry.clear();
  
  // Register all themes
  themeRegistry.register(defaultTheme);
  themeRegistry.register(profileCardTheme);
  themeRegistry.register(sectionsTheme);
  
  // Set default theme
  themeRegistry.setDefaultThemeId('default');
}

// Auto-register themes on module load
registerAllThemes();

// Export themes for direct access if needed
export { defaultTheme, profileCardTheme, sectionsTheme };
export { DefaultThemeComponent } from './DefaultTheme';
export { ProfileCardThemeComponent } from './ProfileCardTheme';
export { SectionsThemeComponent } from './SectionsTheme';
