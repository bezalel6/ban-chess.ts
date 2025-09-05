export { BanChess } from './BanChess.js';
export { BanChessEngine } from './BanChessEngine.js';
export { BanChessEngineV2 } from './BanChessEngineV2.js';
export type { EngineConfig } from './BanChessEngine.js';
export type { EngineConfigV2, SearchStatistics } from './BanChessEngineV2.js';
export type { 
  Move, 
  Ban, 
  Action, 
  ActionResult,
  GameFlags,
  HistoryEntry, 
  Player,
  ActionType,
  Square,
  File,
  Rank,
  Promotion,
  SerializedAction,
  SyncState,
  IndicatorConfig,
  BanChessNotation,
  BanChessFEN
} from './types.js';

// Compatibility helpers for migration
export {
  hasGameFlags,
  isUsingDeprecatedAPI,
  getGameState,
  migrateActionResult,
  isCheckmate,
  isGameOver
} from './compatibility.js';