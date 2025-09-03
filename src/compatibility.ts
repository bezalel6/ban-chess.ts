/**
 * Compatibility helpers and type guards for ban-chess.ts
 * Helps with migration from direct property access to flags-based API
 */

import { ActionResult, GameFlags } from './types.js';

/**
 * Type guard to check if an ActionResult has the new flags property
 */
export function hasGameFlags(result: ActionResult): result is ActionResult & { flags: GameFlags } {
  return result.flags !== undefined;
}

/**
 * Type guard to check if using deprecated properties
 * @deprecated These properties are deprecated, use flags instead
 */
export function isUsingDeprecatedAPI(result: ActionResult): boolean {
  return (
    'check' in result ||
    'checkmate' in result ||
    'stalemate' in result ||
    'gameOver' in result ||
    'draw' in result
  );
}

/**
 * Helper to safely get game state from ActionResult
 * Works with both old and new API
 */
export function getGameState(result: ActionResult): GameFlags {
  if (hasGameFlags(result)) {
    return result.flags;
  }
  
  // Fallback for deprecated properties
  return {
    check: result.check,
    checkmate: result.checkmate,
    stalemate: result.stalemate,
    gameOver: result.gameOver,
    draw: result.draw
  };
}

/**
 * Migration helper that logs deprecation warnings
 */
export function migrateActionResult(result: ActionResult): ActionResult {
  if (isUsingDeprecatedAPI(result) && typeof console !== 'undefined') {
    console.warn(
      '[ban-chess.ts] Deprecation Warning: Direct access to game state properties (check, checkmate, etc.) is deprecated. ' +
      'Please use the flags property instead: result.flags.checkmate instead of result.checkmate'
    );
  }
  return result;
}

/**
 * Type-safe getter with deprecation warning
 */
export function isCheckmate(result: ActionResult): boolean {
  if (hasGameFlags(result)) {
    return result.flags.checkmate === true;
  }
  // Fallback with warning
  if (typeof console !== 'undefined') {
    console.warn('[ban-chess.ts] Please use result.flags?.checkmate instead of direct property access');
  }
  return result.checkmate === true;
}

/**
 * Type-safe getter for game over state
 */
export function isGameOver(result: ActionResult): boolean {
  if (hasGameFlags(result)) {
    return result.flags.gameOver === true;
  }
  // Fallback with warning
  if (typeof console !== 'undefined') {
    console.warn('[ban-chess.ts] Please use result.flags?.gameOver instead of direct property access');
  }
  return result.gameOver === true;
}