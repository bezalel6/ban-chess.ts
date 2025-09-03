// Ban Chess Type Definitions

// Basic chess types
export type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type Square = `${File}${Rank}`;
export type Promotion = "q" | "r" | "b" | "n";
export type Player = "white" | "black";

/** Action types unique to Ban Chess - alternates ban → move → ban → move */
export type ActionType = "ban" | "move";

/** Standard chess move */
export interface Move {
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: Promotion;
}

/** 
 * Ban - the unique mechanic of this variant.
 * Blocks ALL moves between two squares (including all promotions).
 */
export interface Ban {
  readonly from: Square;
  readonly to: Square;
}

/** A Ban Chess action - either a ban or a move */
export type Action =
  | { readonly move: Move }
  | { readonly ban: Ban };

/** Game state flags including ban-specific indicators */
export interface GameFlags {
  readonly check?: boolean;
  readonly checkmate?: boolean;
  readonly stalemate?: boolean;
  readonly draw?: boolean;
  readonly gameOver?: boolean;
  readonly insufficientMaterial?: boolean;
  readonly threefoldRepetition?: boolean;
  readonly fiftyMoveRule?: boolean;
  readonly banCausedCheckmate?: boolean;  // Ban Chess specific
  readonly banCausedStalemate?: boolean;  // Ban Chess specific
}

/** Result of executing an action */
export interface ActionResult {
  readonly success: boolean;
  readonly action?: Action;
  readonly san?: string;  // Standard Algebraic Notation for moves
  readonly error?: string;
  readonly newFen?: string;
  readonly flags?: GameFlags;
}

/** History entry tracking game progression */
export interface HistoryEntry {
  readonly ply: number;
  readonly player: Player;
  readonly actionType: ActionType;
  readonly action: Ban | Move;
  readonly san?: string;
  readonly fen: string;
  readonly bannedMove?: Ban | null;
  readonly flags?: GameFlags;
}

/** 
 * Ban Chess Notation (BCN) for serialization.
 * Format: "b:e2e4" (ban), "m:e2e4" (move), "m:e7e8q" (promotion)
 * With indicators: "m:d8h4#", "b:g1h1#"
 */
export type SerializedAction = string;
export type BanChessNotation = SerializedAction;  // Alias for clarity

/** Standard FEN player turn indicator */
export type FENPlayer = 'w' | 'b';

/** Standard FEN castling rights */
export type FENCastling = 'K' | 'Q' | 'k' | 'q' | 'KQkq' | 'KQk' | 'KQq' | 'Kkq' | 'Qkq' | 'KQ' | 'kq' | 'Kq' | 'Qk' | 'K' | 'Q' | 'k' | 'q' | '-';

/** Standard FEN en passant square or '-' */
export type FENEnPassant = Square | '-';

/** Ban Chess extended FEN field 7 - ply with optional ban */
export type BanChessPlyField = `${number}` | `${number}:${Square}${Square}`;

/**
 * Extended FEN for Ban Chess.
 * Standard chess FEN (6 fields) + 7th field for ban state.
 * 
 * Format: `${board} ${turn} ${castling} ${enPassant} ${halfMove} ${fullMove} ${ply}[:ban]`
 * 
 * The 7th field contains:
 * - Just ply number when no ban is active: "1", "2", "3"
 * - Ply with ban when ban is active: "2:e2e4", "4:d7d5"
 * 
 * @example Standard opening position: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 1"
 * @example After Black bans e2e4: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 2:e2e4"
 */
export type BanChessFEN = string;  // Extended FEN string with 7th field

/** Synchronization state for network play */
export interface SyncState {
  readonly fen: BanChessFEN;  // Extended FEN with ban state
  readonly lastAction?: SerializedAction;
  readonly ply: number;
}

/** Configuration for game state indicators (+, #, =) */
export interface IndicatorConfig {
  readonly pgn?: boolean;  // Include in PGN (default: true)
  readonly serialization?: boolean;  // Include in BCN (default: true)
  readonly san?: boolean;  // Include in SAN (default: true)
}
