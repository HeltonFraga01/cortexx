/**
 * TemplateStorage
 * 
 * Manages block templates using localStorage.
 * Allows saving, loading, listing, and deleting block configurations.
 */

import type { BlockTemplate, ITemplateStorage } from '@/types/page-builder';

const STORAGE_KEY = 'page-builder-templates';

export class TemplateStorage implements ITemplateStorage {
  /**
   * Save a template to storage
   */
  save(template: BlockTemplate): void {
    try {
      const templates = this.getAll();
      const existingIndex = templates.findIndex(t => t.id === template.id);
      
      if (existingIndex >= 0) {
        templates[existingIndex] = template;
      } else {
        templates.push(template);
      }
      
      this.saveAll(templates);
    } catch (error) {
      console.error('Failed to save template:', error);
      throw new Error('Falha ao salvar template. Verifique o espaço de armazenamento.');
    }
  }

  /**
   * Load a template by ID
   */
  load(id: string): BlockTemplate | null {
    const templates = this.getAll();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * List all templates
   */
  list(): BlockTemplate[] {
    return this.getAll();
  }

  /**
   * Delete a template by ID
   */
  delete(id: string): void {
    const templates = this.getAll();
    const filtered = templates.filter(t => t.id !== id);
    this.saveAll(filtered);
  }

  /**
   * Check if a template exists
   */
  exists(id: string): boolean {
    return this.load(id) !== null;
  }

  /**
   * Get templates by block type
   */
  listByType(blockType: string): BlockTemplate[] {
    return this.getAll().filter(t => t.blockType === blockType);
  }

  /**
   * Clear all templates
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear templates:', error);
    }
  }

  /**
   * Get all templates from storage
   */
  private getAll(): BlockTemplate[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      
      return parsed;
    } catch (error) {
      console.error('Failed to load templates:', error);
      return [];
    }
  }

  /**
   * Save all templates to storage
   */
  private saveAll(templates: BlockTemplate[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }
}

// Export singleton instance
export const templateStorage = new TemplateStorage();

/**
 * Generate a unique template ID
 */
export function generateTemplateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a template from a block configuration
 */
export function createTemplateFromBlock(
  name: string,
  blockType: string,
  props: Record<string, any>,
  children?: BlockTemplate[]
): BlockTemplate {
  return {
    id: generateTemplateId(),
    name,
    blockType: blockType as BlockTemplate['blockType'],
    props: JSON.parse(JSON.stringify(props)), // Deep clone
    children: children ? JSON.parse(JSON.stringify(children)) : undefined,
    createdAt: new Date().toISOString(),
  };
}
