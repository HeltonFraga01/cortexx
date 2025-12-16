/**
 * HistoryManager
 * 
 * Manages undo/redo state history for the Page Builder.
 * Maintains a stack of states with a maximum capacity of 50.
 */

import type { HistoryState, IHistoryManager } from '@/types/page-builder';

const MAX_HISTORY_SIZE = 50;

export class HistoryManager implements IHistoryManager {
  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];

  /**
   * Push a new state to the history.
   * Clears the redo stack and enforces max capacity.
   */
  push(state: HistoryState): void {
    // Deep clone the state to prevent mutations
    const clonedState = this.cloneState(state);
    
    this.undoStack.push(clonedState);
    this.redoStack = []; // Clear redo stack on new action
    
    // Enforce max capacity by removing oldest states
    while (this.undoStack.length > MAX_HISTORY_SIZE) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last action and return the previous state.
   * Returns null if there's nothing to undo.
   */
  undo(): HistoryState | null {
    if (!this.canUndo()) {
      return null;
    }

    const currentState = this.undoStack.pop();
    if (currentState) {
      this.redoStack.push(currentState);
    }

    // Return the new current state (top of undo stack)
    const previousState = this.undoStack[this.undoStack.length - 1];
    return previousState ? this.cloneState(previousState) : null;
  }

  /**
   * Redo the last undone action and return the restored state.
   * Returns null if there's nothing to redo.
   */
  redo(): HistoryState | null {
    if (!this.canRedo()) {
      return null;
    }

    const stateToRestore = this.redoStack.pop();
    if (stateToRestore) {
      this.undoStack.push(stateToRestore);
      return this.cloneState(stateToRestore);
    }

    return null;
  }

  /**
   * Check if undo is available.
   * Need at least 2 states: current + previous to undo to.
   */
  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get the current state without modifying history.
   */
  getCurrentState(): HistoryState | null {
    const current = this.undoStack[this.undoStack.length - 1];
    return current ? this.cloneState(current) : null;
  }

  /**
   * Get the number of states in the undo stack.
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * Get the number of states in the redo stack.
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * Deep clone a state to prevent mutations.
   */
  private cloneState(state: HistoryState): HistoryState {
    return {
      blocks: JSON.parse(JSON.stringify(state.blocks)),
      selectedBlockId: state.selectedBlockId,
    };
  }
}

// Export singleton instance for convenience
export const historyManager = new HistoryManager();

// Export max size constant for testing
export { MAX_HISTORY_SIZE };
