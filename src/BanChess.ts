import { Chess } from 'chess.ts';
import type {
  Move,
  Ban,
  Action,
  ActionResult,
  HistoryEntry,
  Color,
  ActionType,
  Square,
  SerializedAction,
  SyncState
} from './types.js';

import { VERSION } from './version.js';

/**
 * BanChess - A chess variant where moves are banned before each turn
 * 
 * In Ban Chess, before each move, the opponent bans one of your possible moves.
 * This creates a strategic layer where you must anticipate which moves will be banned.
 * 
 * @example
 * ```typescript
 * const game = new BanChess();
 * 
 * // Black bans White's e2-e4
 * game.play({ ban: { from: 'e2', to: 'e4' } });
 * 
 * // White plays d2-d4 instead
 * game.play({ move: { from: 'd2', to: 'd4' } });
 * ```
 */
export class BanChess {
  /** Current version of the BanChess library */
  static readonly VERSION = VERSION;
  
  private chess: Chess;
  private _currentBannedMove: Ban | null = null;
  private _history: HistoryEntry[] = [];
  private _turnNumber: number = 1;
  private _isFirstMove: boolean = true;
  
  /**
   * Creates a new BanChess game instance
   * @param fen - Optional FEN string to load a position (with ban state as 7th field)
   * @param pgn - Optional PGN string to load a game (with ban annotations)
   * @example
   * ```typescript
   * // Start from initial position
   * const game = new BanChess();
   * 
   * // Load from FEN with ban state
   * const game2 = new BanChess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 b:e2e4');
   * 
   * // Load from PGN
   * const game3 = new BanChess(undefined, '1. {banning: e2e4} d4');
   * ```
   */
  constructor(fen?: string, pgn?: string) {
    this.chess = new Chess();
    
    if (pgn) {
      this.loadFromPGN(pgn);
    } else if (fen) {
      this.loadFromFEN(fen);
    }
  }
  
  /**
   * Gets the color of the player who needs to perform the next action (ban or move)
   * @returns 'white' or 'black'
   * @example
   * ```typescript
   * const game = new BanChess();
   * console.log(game.turn); // 'black' (Black bans first)
   * ```
   */
  get turn(): Color {
    if (this._isFirstMove) {
      return 'black';
    }
    
    if (this.nextActionType() === 'ban') {
      return this.chess.turn() === 'w' ? 'black' : 'white';
    }
    
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }
  
  /**
   * Gets the currently banned move, if any
   * @returns The banned move or null if no move is currently banned
   * @example
   * ```typescript
   * game.play({ ban: { from: 'e2', to: 'e4' } });
   * console.log(game.currentBannedMove); // { from: 'e2', to: 'e4' }
   * ```
   */
  get currentBannedMove(): Ban | null {
    return this._currentBannedMove;
  }
  
  /**
   * Determines what type of action should be played next
   * @returns 'ban' if a ban is expected, 'move' if a move is expected
   * @example
   * ```typescript
   * const game = new BanChess();
   * console.log(game.nextActionType()); // 'ban' (game starts with a ban)
   * game.play({ ban: { from: 'e2', to: 'e4' } });
   * console.log(game.nextActionType()); // 'move' (after ban, a move is expected)
   * ```
   */
  nextActionType(): ActionType {
    if (this._isFirstMove) {
      return 'ban';
    }
    
    return this._currentBannedMove ? 'move' : 'ban';
  }
  
  /**
   * Plays an action (either a ban or a move) in the game
   * @param action - The action to play (ban or move)
   * @returns Result object indicating success/failure and game state
   * @example
   * ```typescript
   * // Ban a move
   * const banResult = game.play({ ban: { from: 'e2', to: 'e4' } });
   * if (banResult.success) {
   *   console.log('Ban successful');
   * }
   * 
   * // Make a move
   * const moveResult = game.play({ move: { from: 'd2', to: 'd4' } });
   * if (moveResult.success) {
   *   console.log('Move played:', moveResult.san); // 'd4'
   * }
   * ```
   */
  play(action: Action): ActionResult {
    try {
      if ('ban' in action) {
        return this.playBan(action.ban);
      } else {
        return this.playMove(action.move);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Handles playing a ban action
   * @param ban - The ban to apply
   * @returns Result of the ban action
   * @private
   */
  private playBan(ban: Ban): ActionResult {
    // Check if game is already over
    if (this.gameOver()) {
      return {
        success: false,
        error: 'Game is over'
      };
    }
    
    if (this.nextActionType() !== 'ban') {
      return {
        success: false,
        error: 'Expected a move, not a ban'
      };
    }
    
    const legalBans = this.legalBans();
    const isValidBan = legalBans.some(
      b => b.from === ban.from && b.to === ban.to
    );
    
    if (!isValidBan) {
      return {
        success: false,
        error: `Invalid ban: ${ban.from}-${ban.to}`
      };
    }
    
    this._currentBannedMove = ban;
    
    const historyEntry: HistoryEntry = {
      turnNumber: this._turnNumber,
      player: this.turn,
      actionType: 'ban',
      action: ban,
      fen: this.fen(),
      bannedMove: ban
    };
    
    this._history.push(historyEntry);
    
    if (this._isFirstMove) {
      this._isFirstMove = false;
    }
    
    return {
      success: true,
      action: { ban },
      newFen: this.fen()
    };
  }
  
  /**
   * Handles playing a move action
   * @param move - The move to play
   * @returns Result of the move action
   * @private
   */
  private playMove(move: Move): ActionResult {
    // Check if game is already over
    if (this.gameOver()) {
      return {
        success: false,
        error: 'Game is over'
      };
    }
    
    if (this.nextActionType() !== 'move') {
      return {
        success: false,
        error: 'Expected a ban, not a move'
      };
    }
    
    if (this.isBannedMove(move)) {
      return {
        success: false,
        error: `Move ${move.from}-${move.to} is banned`
      };
    }
    
    const result = this.chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion
    } as any);
    
    if (!result) {
      return {
        success: false,
        error: `Invalid move: ${move.from}-${move.to}`
      };
    }
    
    const historyEntry: HistoryEntry = {
      turnNumber: this._turnNumber,
      player: this.chess.turn() === 'w' ? 'black' : 'white',
      actionType: 'move',
      action: move,
      san: result.san,
      fen: this.fen(),
      bannedMove: this._currentBannedMove
    };
    
    this._history.push(historyEntry);
    this._currentBannedMove = null;
    
    if (this.chess.turn() === 'w') {
      this._turnNumber++;
    }
    
    // Check game state after the move
    const isGameOver = this.chess.gameOver();
    const isCheckmate = this.chess.inCheckmate();
    const isStalemate = this.chess.inStalemate();
    
    return {
      success: true,
      action: { move },
      san: result.san,
      newFen: this.fen(),
      gameOver: isGameOver,
      checkmate: isCheckmate,
      stalemate: isStalemate
    };
  }
  
  /**
   * Checks if a move is currently banned
   * @param move - The move to check
   * @returns true if the move is banned, false otherwise
   * @private
   */
  private isBannedMove(move: Move): boolean {
    if (!this._currentBannedMove) return false;
    
    return (
      this._currentBannedMove.from === move.from &&
      this._currentBannedMove.to === move.to
    );
  }
  
  /**
   * Gets all legal moves in the current position (excluding banned moves)
   * @returns Array of legal moves, empty if it's time to ban or game is over
   * @example
   * ```typescript
   * game.play({ ban: { from: 'e2', to: 'e4' } });
   * const moves = game.legalMoves();
   * // Returns all White's opening moves except e2-e4
   * ```
   */
  legalMoves(): Move[] {
    // No moves if game is over
    if (this.gameOver()) {
      return [];
    }
    
    if (this.nextActionType() !== 'move') {
      return [];
    }
    
    const chessMoves = this.chess.moves({ verbose: true });
    const moves: Move[] = chessMoves.map(m => ({
      from: m.from as Square,
      to: m.to as Square,
      promotion: m.promotion as 'q' | 'r' | 'b' | 'n' | undefined
    }));
    
    if (this._currentBannedMove) {
      return moves.filter(m => !this.isBannedMove(m));
    }
    
    return moves;
  }
  
  /**
   * Gets all legal bans (opponent's possible moves that can be banned)
   * @returns Array of moves that can be banned, empty if it's time to move or game is over
   * @example
   * ```typescript
   * const game = new BanChess();
   * const bans = game.legalBans();
   * // Returns all of White's possible opening moves
   * ```
   */
  legalBans(): Move[] {
    // No bans if game is over
    if (this.gameOver()) {
      return [];
    }
    
    if (this.nextActionType() !== 'ban') {
      return [];
    }
    
    const tempChess = new Chess(this.chess.fen());
    
    if (this._isFirstMove) {
      const moves = tempChess.moves({ verbose: true });
      return moves.map(m => ({
        from: m.from as Square,
        to: m.to as Square
      }));
    }
    
    tempChess.load(this.chess.fen());
    const moves = tempChess.moves({ verbose: true });
    
    const uniqueBans = new Map<string, Ban>();
    moves.forEach(m => {
      const key = `${m.from}-${m.to}`;
      if (!uniqueBans.has(key)) {
        uniqueBans.set(key, {
          from: m.from as Square,
          to: m.to as Square
        });
      }
    });
    
    return Array.from(uniqueBans.values());
  }
  
  /**
   * Checks if the current player's king is in check
   * @returns true if in check, false otherwise
   */
  inCheck(): boolean {
    return this.chess.inCheck();
  }
  
  /**
   * Checks if the current position is checkmate
   * @returns true if checkmate, false otherwise
   * @example
   * ```typescript
   * // If king in check with only one escape move,
   * // opponent can achieve checkmate by banning that move
   * ```
   */
  inCheckmate(): boolean {
    // Check the underlying chess position directly
    return this.chess.inCheckmate();
  }
  
  /**
   * Checks if the current position is stalemate
   * @returns true if stalemate (no legal moves but not in check), false otherwise
   */
  inStalemate(): boolean {
    // Check the underlying chess position directly
    return this.chess.inStalemate();
  }
  
  /**
   * Checks if the game is over (checkmate, stalemate, or draw)
   * @returns true if game is over, false otherwise
   */
  gameOver(): boolean {
    return this.inCheckmate() || this.inStalemate() || this.inDraw();
  }
  
  /**
   * Checks if the game is a draw (by repetition, 50-move rule, or insufficient material)
   * Note: In Ban Chess, draws are less common due to the banning mechanic
   * @returns true if the position is a draw
   */
  inDraw(): boolean {
    // Check the underlying chess position directly
    return this.chess.inDraw();
  }
  
  /**
   * Checks for threefold repetition
   * @returns true if the same position has occurred three times
   */
  inThreefoldRepetition(): boolean {
    // Check the underlying chess position directly
    return this.chess.inThreefoldRepetition();
  }
  
  /**
   * Checks if there is insufficient material to checkmate
   * @returns true if neither side can checkmate
   */
  insufficientMaterial(): boolean {
    return this.chess.insufficientMaterial();
  }
  
  /**
   * Returns the color of the player who needs to perform the next action (ban or move)
   * @returns The color of the current player
   * @deprecated Use the `turn` getter instead
   */
  currentPlayer(): Color {
    return this.turn;
  }
  
  /**
   * Returns the color of the player whose piece will move next
   * @returns 'white' or 'black' - whose pieces will move in the next move action
   * @example
   * ```typescript
   * // At game start, Black bans first, but White moves first
   * const game = new BanChess();
   * console.log(game.nextMoveColor()); // 'white'
   * ```
   */
  nextMoveColor(): Color {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }
  
  /**
   * Gets the current position as an extended FEN string
   * @returns FEN string with 7th field for ban state (e.g., "b:e2e4" or "w:ban")
   * @example
   * ```typescript
   * const game = new BanChess();
   * game.play({ ban: { from: 'e2', to: 'e4' } });
   * console.log(game.fen());
   * // "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 b:e2e4"
   * ```
   */
  fen(): string {
    const baseFen = this.chess.fen();
    let banState: string;
    
    if (this._currentBannedMove) {
      banState = `b:${this._currentBannedMove.from}${this._currentBannedMove.to}`;
    } else if (this.nextActionType() === 'ban') {
      const banningPlayer = this.turn;
      banState = `${banningPlayer.charAt(0)}:ban`;
    } else {
      banState = 'b:ban';
    }
    
    return `${baseFen} ${banState}`;
  }
  
  /**
   * Gets the game notation in PGN format with ban annotations
   * @returns PGN string with bans shown as comments like {banning: e2e4}
   * Ban annotations include:
   * - `+` when the ban forces a position where all legal moves result in check
   * - `#` when the ban causes checkmate (banning the only escape from check)
   * - `=` when the ban causes stalemate (banning the only legal move when not in check)
   * 
   * Note: The PGN format uses comments ({banning: ...}) for compatibility with standard
   * PGN parsers, while the serialization format uses the more compact b:e2e4 notation.
   * This distinction may be unified in future versions based on community feedback.
   * 
   * @example
   * ```typescript
   * const game = new BanChess();
   * game.play({ ban: { from: 'e2', to: 'e4' } });
   * game.play({ move: { from: 'd2', to: 'd4' } });
   * console.log(game.pgn()); // "1. {banning: e2e4} d4"
   * ```
   */
  pgn(): string {
    let pgn = '';
    let moveText = '';
    let currentTurn = 1;
    
    for (let i = 0; i < this._history.length; i++) {
      const entry = this._history[i];
      
      if (entry.actionType === 'ban') {
        const ban = entry.action as Ban;
        let banNotation = `${ban.from}${ban.to}`;
        
        // Check the game state after this ban
        if (i === this._history.length - 1) {
          // This is the last action in history
          if (this.gameOver()) {
            // Game ended due to this ban
            if (this.inCheckmate()) {
              // Ban caused checkmate (banned only escape from check)
              banNotation += '#';
            } else if (this.inStalemate()) {
              // Ban caused stalemate (banned only legal move when not in check)  
              banNotation += '=';
            }
          } else if (this.nextActionType() === 'move') {
            // Check if the player to move is in check after this ban
            // This happens when the ban restricts moves and the king is under attack
            const legalMoves = this.legalMoves();
            if (legalMoves.length > 0 && this.chess.inCheck()) {
              // Player is in check and has moves (but one was banned)
              banNotation += '+';
            }
          }
        }
        
        moveText += `{banning: ${banNotation}} `;
      } else {
        if (entry.player === 'white') {
          moveText = `${currentTurn}. ${moveText}`;
        }
        moveText += `${entry.san} `;
        
        if (entry.player === 'black') {
          pgn += moveText;
          moveText = '';
          currentTurn++;
        }
      }
    }
    
    if (moveText) {
      if (!moveText.startsWith(`${currentTurn}.`)) {
        moveText = `${currentTurn}. ${moveText}`;
      }
      pgn += moveText;
    }
    
    // Add game result if the game is over
    // Check if the last move caused checkmate/stalemate
    if (this._history.length > 0) {
      const lastEntry = this._history[this._history.length - 1];
      if (lastEntry.actionType === 'move' && lastEntry.san) {
        if (lastEntry.san.endsWith('#')) {
          // Checkmate - determine winner based on who delivered checkmate
          const winner = lastEntry.player === 'white' ? '1-0' : '0-1';
          pgn = pgn.trim() + ' ' + winner;
        }
      } else if (lastEntry.actionType === 'ban' && this.gameOver()) {
        // Ban caused game over
        if (this.inCheckmate()) {
          // Determine winner - opposite of who is in checkmate
          const winner = this.chess.turn() === 'w' ? '0-1' : '1-0';
          pgn = pgn.trim() + ' ' + winner;
        } else if (this.inStalemate()) {
          pgn = pgn.trim() + ' 1/2-1/2';
        }
      }
    }
    
    return pgn.trim();
  }
  
  /**
   * Gets the complete game history
   * @returns Array of history entries with all actions, positions, and metadata
   * @example
   * ```typescript
   * const history = game.history();
   * history.forEach(entry => {
   *   console.log(`${entry.player} ${entry.actionType}: ${JSON.stringify(entry.action)}`);
   * });
   * ```
   */
  history(): HistoryEntry[] {
    return [...this._history];
  }
  
  /**
   * Resets the game to the initial position
   * @example
   * ```typescript
   * game.reset();
   * console.log(game.fen()); // Starting position with "b:ban" state
   * ```
   */
  reset(): void {
    this.chess = new Chess();
    this._currentBannedMove = null;
    this._history = [];
    this._turnNumber = 1;
    this._isFirstMove = true;
  }
  
  /**
   * Returns an ASCII representation of the current board position
   * Shows the banned move with brackets if applicable
   * @returns ASCII string representation of the board
   * @example
   * ```typescript
   * console.log(game.ascii());
   * // +------------------------+
   * // | r  n  b  q  k  b  n  r |
   * // | p  p  p  p  p  p  p  p |
   * // | .  .  .  .  .  .  .  . |
   * // | .  .  .  .  .  .  .  . |
   * // | .  .  .  .  .  .  .  . |
   * // | .  .  .  .  .  .  .  . |
   * // | P  P  P  P  P  P  P  P |
   * // | R  N  B  Q  K  B  N  R |
   * // +------------------------+
   * ```
   */
  ascii(): string {
    let board = this.chess.ascii();
    
    // Add ban information if there's a current ban
    if (this._currentBannedMove) {
      board += `\nBanned: ${this._currentBannedMove.from}-${this._currentBannedMove.to}`;
    }
    
    // Add turn information
    board += `\nNext: ${this.nextActionType()} by ${this.turn}`;
    
    return board;
  }
  
  // Serialization methods for network synchronization
  
  /**
   * Serialize an action to a compact string format for network transmission
   * Includes game state indicators: + for check, # for checkmate, = for stalemate
   * @param action - The action to serialize
   * @param gameStateIndicator - Optional indicator for check/checkmate/stalemate
   * @returns Serialized action string (e.g., "b:e2e4#" for checkmate-causing ban)
   * @example
   * ```typescript
   * const ban = { ban: { from: 'e2', to: 'e4' } };
   * console.log(BanChess.serializeAction(ban)); // "b:e2e4"
   * console.log(BanChess.serializeAction(ban, '#')); // "b:e2e4#" (checkmate)
   * 
   * const promotion = { move: { from: 'e7', to: 'e8', promotion: 'q' } };
   * console.log(BanChess.serializeAction(promotion, '+')); // "m:e7e8q+"
   * ```
   */
  static serializeAction(action: Action, gameStateIndicator?: '+' | '#' | '='): SerializedAction {
    let serialized: string;
    if ('ban' in action) {
      serialized = `b:${action.ban.from}${action.ban.to}`;
    } else {
      const move = action.move;
      serialized = `m:${move.from}${move.to}${move.promotion || ''}`;
    }
    
    if (gameStateIndicator) {
      serialized += gameStateIndicator;
    }
    
    return serialized as SerializedAction;
  }
  
  /**
   * Deserialize a string to an Action object
   * Handles game state indicators: + for check, # for checkmate, = for stalemate
   * @param serialized - The serialized action string
   * @returns The Action object and any game state indicator
   * @throws Error if the format is invalid
   * @example
   * ```typescript
   * const ban = BanChess.deserializeAction('b:e2e4#');
   * // Returns: { ban: { from: 'e2', to: 'e4' } }
   * 
   * const move = BanChess.deserializeAction('m:e7e8q+');
   * // Returns: { move: { from: 'e7', to: 'e8', promotion: 'q' } }
   * ```
   */
  static deserializeAction(serialized: SerializedAction): Action {
    // Updated regex to handle optional game state indicators (+, #, =)
    const match = serialized.match(/^([bm]):([a-h][1-8])([a-h][1-8])([qrbn])?([+#=])?$/);
    if (!match) {
      throw new Error(`Invalid serialized action format: ${serialized}`);
    }
    
    const [, type, from, to, promotion, indicator] = match;
    
    if (type === 'b') {
      return { ban: { from: from as Square, to: to as Square } };
    } else {
      const move: Move = { from: from as Square, to: to as Square };
      if (promotion) {
        move.promotion = promotion as 'q' | 'r' | 'b' | 'n';
      }
      return { move };
    }
  }
  
  /**
   * Get the last action as a serialized string with game state indicators
   * @returns The last action in serialized format, or null if no actions
   * @example
   * ```typescript
   * game.play({ ban: { from: 'e2', to: 'e4' } });
   * console.log(game.getLastActionSerialized()); // "b:e2e4"
   * ```
   */
  getLastActionSerialized(): SerializedAction | null {
    if (this._history.length === 0) return null;
    
    const lastEntry = this._history[this._history.length - 1];
    const action = lastEntry.actionType === 'ban' 
      ? { ban: lastEntry.action as Ban }
      : { move: lastEntry.action as Move };
    
    // Determine if we need a game state indicator
    let indicator: '+' | '#' | '=' | undefined;
    
    if (lastEntry.actionType === 'move') {
      // For moves, check the SAN notation which already includes +/#
      if (lastEntry.san?.endsWith('#')) {
        indicator = '#';
      } else if (lastEntry.san?.endsWith('+')) {
        indicator = '+';
      }
    } else {
      // For bans, check if it caused game over or check
      if (this.gameOver()) {
        if (this.inCheckmate()) {
          indicator = '#';
        } else if (this.inStalemate()) {
          indicator = '=';
        }
      } else if (this.nextActionType() === 'move' && this.chess.inCheck()) {
        indicator = '+';
      }
    }
    
    return BanChess.serializeAction(action, indicator);
  }
  
  /**
   * Get a sync state object for network transmission
   * @returns Current state with minimal data for synchronization
   * @example
   * ```typescript
   * const state = game.getSyncState();
   * // Send state over network
   * socket.emit('gameState', state);
   * ```
   */
  getSyncState(): SyncState {
    return {
      fen: this.fen(),
      lastAction: this.getLastActionSerialized() || undefined,
      moveNumber: this._turnNumber
    };
  }
  
  /**
   * Apply a serialized action to the current game state
   * @param serialized - The serialized action to apply
   * @returns The result of applying the action
   * @example
   * ```typescript
   * // Receive action from network
   * socket.on('action', (serialized: string) => {
   *   const result = game.playSerializedAction(serialized);
   *   if (!result.success) {
   *     console.error('Invalid action:', result.error);
   *   }
   * });
   * ```
   */
  playSerializedAction(serialized: SerializedAction): ActionResult {
    try {
      const action = BanChess.deserializeAction(serialized);
      return this.play(action);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid serialized action'
      };
    }
  }
  
  /**
   * Load game state from a sync state object
   * @param syncState - The sync state to load
   * @example
   * ```typescript
   * // Receive state from network
   * socket.on('syncState', (state: SyncState) => {
   *   game.loadFromSyncState(state);
   * });
   * ```
   */
  loadFromSyncState(syncState: SyncState): void {
    this.loadFromFEN(syncState.fen);
    this._turnNumber = syncState.moveNumber;
  }
  
  /**
   * Get a compact string representation of all actions in the game
   * @returns Array of serialized actions in chronological order with game state indicators
   * @example
   * ```typescript
   * const actions = game.getActionHistory();
   * // ["b:e2e4", "m:d2d4", "b:e7e5+", "m:d7d5", "m:Qh5#", ...]
   * ```
   */
  getActionHistory(): SerializedAction[] {
    return this._history.map((entry, index) => {
      const action = entry.actionType === 'ban'
        ? { ban: entry.action as Ban }
        : { move: entry.action as Move };
      
      // Determine if we need a game state indicator
      let indicator: '+' | '#' | '=' | undefined;
      
      if (entry.actionType === 'move') {
        // For moves, check the SAN notation which already includes +/#
        if (entry.san?.endsWith('#')) {
          indicator = '#';
        } else if (entry.san?.endsWith('+')) {
          indicator = '+';
        }
      } else {
        // For bans, check if it caused game over or check
        // We need to check the state after this ban
        if (index === this._history.length - 1) {
          // This is the last action, check current game state
          if (this.gameOver()) {
            if (this.inCheckmate()) {
              indicator = '#';
            } else if (this.inStalemate()) {
              indicator = '=';
            }
          } else if (this.nextActionType() === 'move' && this.chess.inCheck()) {
            indicator = '+';
          }
        }
      }
      
      return BanChess.serializeAction(action, indicator);
    });
  }
  
  /**
   * Replay a game from a series of serialized actions
   * @param actions - Array of serialized actions to replay
   * @param startingFen - Optional starting FEN (defaults to initial position)
   * @returns A new BanChess instance with the replayed game
   * @throws Error if any action fails to replay
   * @example
   * ```typescript
   * const actions = ['b:e2e4', 'm:d2d4', 'b:e7e5', 'm:d7d5'];
   * const game = BanChess.replayFromActions(actions);
   * console.log(game.pgn()); // Reconstructed game
   * ```
   */
  static replayFromActions(actions: SerializedAction[], startingFen?: string): BanChess {
    const game = new BanChess(startingFen);
    
    for (const action of actions) {
      const result = game.playSerializedAction(action);
      if (!result.success) {
        throw new Error(`Failed to replay action ${action}: ${result.error}`);
      }
    }
    
    return game;
  }
  
  /**
   * Loads a game position from an extended FEN string
   * @param fen - FEN string with optional 7th field for ban state
   * @private
   */
  private loadFromFEN(fen: string): void {
    const parts = fen.split(' ');
    
    if (parts.length < 7) {
      this.chess = new Chess(fen);
      return;
    }
    
    const baseFen = parts.slice(0, 6).join(' ');
    const banState = parts[6];
    
    this.chess = new Chess(baseFen);
    
    if (banState && banState !== '-') {
      if (banState.includes(':')) {
        const [, value] = banState.split(':');
        if (value === 'ban') {
          this._isFirstMove = false;
        } else if (value.length === 4) {
          this._currentBannedMove = {
            from: value.substring(0, 2) as Square,
            to: value.substring(2, 4) as Square
          };
          this._isFirstMove = false;
        }
      }
    }
  }
  
  /**
   * Loads a game from PGN notation with ban annotations
   * @param pgn - PGN string with ban annotations in {banning: ...} format
   * @private
   */
  private loadFromPGN(pgn: string): void {
    this.reset();
    
    // Simple PGN parser for Ban Chess format
    // Format: 1. {banning: e2e4} d4 {banning: e7e5} d5
    
    const tokens = pgn.match(/\{banning:\s*[a-h][1-8][a-h][1-8]\}|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|\d+\./g);
    
    if (!tokens) return;
    
    for (const token of tokens) {
      // Skip move numbers
      if (/^\d+\.$/.test(token)) continue;
      
      // Handle bans
      if (token.includes('banning:')) {
        const banMatch = token.match(/([a-h][1-8])([a-h][1-8])/);
        if (banMatch) {
          const ban: Ban = {
            from: banMatch[1] as Square,
            to: banMatch[2] as Square
          };
          this.play({ ban });
        }
      } else if (/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]/.test(token)) {
        // Handle moves
        const moves = this.legalMoves();
        const matchingMove = moves.find(m => {
          const tempChess = new Chess(this.chess.fen());
          const result = tempChess.move({ from: m.from, to: m.to, promotion: m.promotion } as any);
          return result && result.san === token;
        });
        
        if (matchingMove) {
          this.play({ move: matchingMove });
        }
      }
    }
  }
}