export type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type Square = `${File}${Rank}`;

export interface Move {
  from: Square;
  to: Square;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface Ban {
  from: Square;
  to: Square;
}

export type Action = 
  | { move: Move }
  | { ban: Ban };

export interface ActionResult {
  success: boolean;
  action?: Action;
  san?: string;
  error?: string;
  newFen?: string;
  gameOver?: boolean;
  checkmate?: boolean;
  stalemate?: boolean;
}

export interface HistoryEntry {
  ply: number;
  player: 'white' | 'black';
  actionType: 'ban' | 'move';
  action: Ban | Move;
  san?: string;
  fen: string;
  bannedMove?: Ban | null;
}

export type Color = 'white' | 'black';
export type ActionType = 'ban' | 'move';

// Serialized action formats for network transmission
export type SerializedAction = string; // Format: "b:e2e4" for ban, "m:e2e4" for move, "m:e7e8q" for promotion

export interface SyncState {
  fen: string;
  lastAction?: SerializedAction;
  ply: number;
}

export interface IndicatorConfig {
  /** Include indicators in PGN notation (default: true) */
  pgn?: boolean;
  /** Include indicators in serialized actions (default: true) */
  serialization?: boolean;
  /** Include indicators in SAN notation for moves (default: true) */
  san?: boolean;
}