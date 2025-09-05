import { Chess } from 'chess.ts';
import type {
  Move,
  Ban,
  Action,
  ActionResult,
  GameFlags,
  HistoryEntry,
  Player,
  ActionType,
  Square,
  Promotion,
  SerializedAction,
  SyncState,
  IndicatorConfig
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
  private _ply: number = 1;
  private _indicatorConfig: IndicatorConfig = {
    pgn: true,
    serialization: true,
    san: true
  };
  
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
   * Gets the current ply number (1-based)
   * @returns Current ply number
   * @example
   * ```typescript
   * const game = new BanChess();
   * console.log(game.getPly()); // 1 (first ply: Black bans)
   * ```
   */
  getPly(): number {
    return this._ply;
  }

  /**
   * Gets the color of the player who performs the action at the current ply
   * @returns 'white' or 'black'
   * @example
   * ```typescript
   * const game = new BanChess();
   * console.log(game.getActivePlayer()); // 'black' (ply 1: Black bans)
   * ```
   */
  getActivePlayer(): Player {
    // Ply pattern: 1=Black ban, 2=White move, 3=White ban, 4=Black move, 5=Black ban, 6=White move...
    const plyInCycle = ((this._ply - 1) % 4) + 1; // Convert to 1-4 cycle
    switch (plyInCycle) {
      case 1: return 'black'; // Black bans
      case 2: return 'white'; // White moves  
      case 3: return 'white'; // White bans
      case 4: return 'black'; // Black moves
      default: return 'black';
    }
  }

  /**
   * Gets the type of action for the current ply
   * @returns 'ban' for odd plies, 'move' for even plies
   * @example
   * ```typescript
   * const game = new BanChess();
   * console.log(game.getActionType()); // 'ban' (ply 1: restriction)
   * ```
   */
  getActionType(): ActionType {
    return this._ply % 2 === 1 ? 'ban' : 'move';
  }

  /**
   * Gets the color of the player who needs to perform the next action (ban or move)
   * @returns 'white' or 'black'
   * @example
   * ```typescript
   * const game = new BanChess();
   * console.log(game.turn); // 'black' (Black bans first)
   * ```
   * @deprecated Use getActivePlayer() instead for clearer ply-based logic
   */
  get turn(): Player {
    return this.getActivePlayer();
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
   * @deprecated Use getActionType() instead for clearer ply-based logic
   */
  nextActionType(): ActionType {
    return this.getActionType();
  }
  
  /**
   * Plays an action (either a ban or a move) in the game
   * 
   * @param action - The action to play: `{ ban: Ban }` or `{ move: Move }`
   * 
   * @returns {ActionResult} Comprehensive result with game state:
   * 
   * @returns.success - `true` if action was valid and executed
   * @returns.action - The action that was played
   * @returns.san - Standard Algebraic Notation with indicators (+, #, =)
   * @returns.newFen - Resulting position in extended FEN format
   * @returns.error - Error message if action failed
   * @returns.flags - Game state flags:
   *   - `check`: King is in check
   *   - `checkmate`: Game ended in checkmate  
   *   - `stalemate`: Game ended in stalemate
   *   - `draw`: Game is a draw (50-move, repetition, insufficient material)
   *   - `gameOver`: Game has ended for any reason
   *   - `insufficientMaterial`: Draw by insufficient material
   *   - `threefoldRepetition`: Draw by repetition
   *   - `fiftyMoveRule`: Draw by 50-move rule
   *   - `banCausedCheckmate`: Ban removed only escape from check
   *   - `banCausedStalemate`: Ban removed only legal move
   * 
   * @example
   * ```typescript
   * // Ban a move (Black starts by banning)
   * const banResult = game.play({ ban: { from: 'e2', to: 'e4' } });
   * console.log('Banned:', banResult.san); // 'e2e4'
   * console.log('Flags:', banResult.flags); 
   * // { gameOver: false, check: false, ... }
   * 
   * // Make a move  
   * const moveResult = game.play({ move: { from: 'd2', to: 'd4' } });
   * console.log('Move:', moveResult.san); // 'd4'
   * console.log('In check?', moveResult.flags?.check); // false
   * 
   * // Checkmate example
   * const mateResult = game.play({ move: { from: 'd8', to: 'h4' } });
   * console.log('Move:', mateResult.san); // 'Qh4#'
   * console.log('Checkmate?', mateResult.flags?.checkmate); // true
   * console.log('Game over?', mateResult.flags?.gameOver); // true
   * 
   * // Ban causing checkmate (removes only escape)
   * const banMate = game.play({ ban: { from: 'g1', to: 'h1' } });
   * console.log('Ban:', banMate.san); // 'g1h1#'
   * console.log('Ban caused checkmate?', banMate.flags?.banCausedCheckmate); // true
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
    
    if (this.getActionType() !== 'ban') {
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
    
    // Check if this ban causes checkmate or stalemate
    // We need to check if the player to move has any legal moves left
    const tempChess = new Chess(this.chess.fen());
    const movesBeforeBan = tempChess.moves({ verbose: true });
    const movesAfterBan = movesBeforeBan.filter(m => 
      !(m.from === ban.from && m.to === ban.to)
    );
    
    const willCauseCheckmate = movesAfterBan.length === 0 && tempChess.inCheck();
    const willCauseStalemate = movesAfterBan.length === 0 && !tempChess.inCheck();
    const stillInCheck = tempChess.inCheck() && movesAfterBan.length > 0;
    
    // Create flags for the ban
    const flags: GameFlags = {
      check: stillInCheck,
      checkmate: willCauseCheckmate,
      stalemate: willCauseStalemate,
      gameOver: willCauseCheckmate || willCauseStalemate,
      banCausedCheckmate: willCauseCheckmate,
      banCausedStalemate: willCauseStalemate
    };
    
    // Add indicator to the ban if it causes game over
    let banNotation = `${ban.from}${ban.to}`;
    if (this._indicatorConfig.san) {
      if (willCauseCheckmate) {
        banNotation += '#';
      } else if (willCauseStalemate) {
        banNotation += '=';
      } else if (stillInCheck) {
        banNotation += '+';
      }
    }
    
    const historyEntry: HistoryEntry = {
      ply: this._ply,
      player: this.getActivePlayer(),
      actionType: 'ban',
      action: ban,
      fen: this.fen(),
      bannedMove: ban,
      san: banNotation,  // Store the ban notation with indicators
      flags: flags
    };
    
    this._history.push(historyEntry);
    this._ply++;
    
    return {
      success: true,
      action: { ban },
      san: this._indicatorConfig.san ? banNotation : `${ban.from}${ban.to}`,
      newFen: this.fen(),
      flags: flags,
      // Deprecated properties for backwards compatibility
      check: flags.check,
      checkmate: flags.checkmate,
      stalemate: flags.stalemate,
      gameOver: flags.gameOver,
      draw: flags.draw
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
    
    if (this.getActionType() !== 'move') {
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
    
    // Create comprehensive game flags after the move
    const flags: GameFlags = {
      check: this.chess.inCheck(),
      checkmate: this.chess.inCheckmate(),
      stalemate: this.chess.inStalemate(),
      draw: this.chess.inDraw(),
      gameOver: this.chess.gameOver(),
      insufficientMaterial: this.chess.insufficientMaterial(),
      threefoldRepetition: this.chess.inThreefoldRepetition(),
      fiftyMoveRule: this.chess.inDraw() && !this.chess.inStalemate() && !this.chess.insufficientMaterial()
    };
    
    const historyEntry: HistoryEntry = {
      ply: this._ply,
      player: this.getActivePlayer(),
      actionType: 'move',
      action: move,
      san: result.san,
      fen: this.fen(),
      bannedMove: this._currentBannedMove,
      flags: flags
    };
    
    this._history.push(historyEntry);
    this._currentBannedMove = null;
    this._ply++;
    
    // Respect SAN indicator configuration
    let san = result.san;
    if (!this._indicatorConfig.san && san) {
      // Strip indicators if config disables them
      san = san.replace(/[+#=]$/, '');
    }
    
    return {
      success: true,
      action: { move },
      san: san,
      newFen: this.fen(),
      flags: flags,
      // Deprecated properties for backwards compatibility
      check: flags.check,
      checkmate: flags.checkmate,
      stalemate: flags.stalemate,
      gameOver: flags.gameOver,
      draw: flags.draw
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
   * Gets all legal actions for the current ply (bans or moves)
   * @returns Array of legal actions based on current ply type
   * @example
   * ```typescript
   * const game = new BanChess();
   * const actions = game.getLegalActions(); // Returns all possible bans for ply 1
   * ```
   */
  getLegalActions(): Action[] {
    if (this.gameOver()) {
      return [];
    }
    
    if (this.getActionType() === 'ban') {
      return this.legalBans().map(ban => ({ ban }));
    } else {
      return this.legalMoves().map(move => ({ move }));
    }
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
   * @deprecated Use getLegalActions() instead for unified action handling
   */
  legalMoves(): Move[] {
    // No moves if game is over
    if (this.gameOver()) {
      return [];
    }
    
    if (this.getActionType() !== 'move') {
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
   * @deprecated Use getLegalActions() instead for unified action handling
   */
  legalBans(): Move[] {
    // No bans if game is over
    if (this.gameOver()) {
      return [];
    }
    
    if (this.getActionType() !== 'ban') {
      return [];
    }
    
    const tempChess = new Chess(this.chess.fen());
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
  currentPlayer(): Player {
    return this.turn;
  }
  
  /**
   * Configure where game state indicators (+, #, =) appear
   * @param config - Configuration for indicator display
   * @example
   * ```typescript
   * // Disable indicators in PGN but keep in SAN
   * game.setIndicatorConfig({ pgn: false, san: true });
   * ```
   */
  setIndicatorConfig(config: IndicatorConfig): void {
    this._indicatorConfig = { ...this._indicatorConfig, ...config };
  }
  
  /**
   * Get current indicator configuration
   * @returns Current indicator configuration
   */
  getIndicatorConfig(): IndicatorConfig {
    return { ...this._indicatorConfig };
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
  nextMoveColor(): Player {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }
  
  /**
   * Gets PGN-style indicator for current game state
   * @private
   */
  private getGameIndicator(): string {
    const gameFlags = this.getGameFlags();
    
    if (gameFlags.checkmate) return '#';
    if (gameFlags.stalemate || gameFlags.draw) return '=';
    if (gameFlags.check) return '+';
    
    return '';
  }
  
  /**
   * Gets current game state flags
   * @returns Current game state flags
   */
  private getGameFlags(): GameFlags {
    // Check if the last history entry was a ban that caused checkmate/stalemate
    const lastEntry = this._history[this._history.length - 1];
    const banCausedCheckmate = lastEntry?.flags?.banCausedCheckmate || false;
    const banCausedStalemate = lastEntry?.flags?.banCausedStalemate || false;
    
    return {
      check: this.chess.inCheck(),
      checkmate: this.chess.inCheckmate(),
      stalemate: this.chess.inStalemate(),
      draw: this.chess.inDraw(),
      gameOver: this.chess.gameOver(),
      insufficientMaterial: this.chess.insufficientMaterial(),
      threefoldRepetition: this.chess.inThreefoldRepetition(),
      fiftyMoveRule: this.chess.inDraw() && !this.chess.inStalemate() && !this.chess.insufficientMaterial() && !this.chess.inThreefoldRepetition(),
      banCausedCheckmate,
      banCausedStalemate
    };
  }
  
  /**
   * Gets the current position as an extended FEN string
   * @returns FEN string with 7th field for ply/ban state with optional PGN indicator
   * @example
   * ```typescript
   * const game = new BanChess();
   * game.play({ ban: { from: 'e2', to: 'e4' } });
   * console.log(game.fen());
   * // "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 2:e2e4"
   * 
   * // Position with check
   * // "rnb1kbnr/pppp1ppp/4p3/8/5PP1/8/PPPPP2P/RNBQKBNR w KQkq - 0 3 6+"
   * 
   * // Checkmate position
   * // "8/8/8/8/8/7k/6q1/7K w - - 0 1 10#"
   * ```
   */
  fen(): string {
    const baseFen = this.chess.fen();
    let plyState: string = this._ply.toString();
    
    if (this._currentBannedMove) {
      plyState += `:${this._currentBannedMove.from}${this._currentBannedMove.to}`;
    }
    
    // For FEN, check if the last action was a ban that added an indicator
    const lastEntry = this._history[this._history.length - 1];
    if (lastEntry && lastEntry.actionType === 'ban' && lastEntry.san) {
      // Use the indicator from when the ban was played
      const match = lastEntry.san.match(/[+#=]$/);
      if (match) {
        plyState += match[0];
      }
    } else {
      // For moves or no history, use current game state
      const indicator = this.getGameIndicator();
      plyState += indicator;
    }
    
    return `${baseFen} ${plyState}`;
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
      // Calculate move number based on ply
      let moveNumber = 1;
      if (entry.actionType === 'move') {
        if (entry.player === 'white') {
          // White moves: ply 2->move 1, ply 6->move 2, ply 10->move 3...
          moveNumber = Math.floor((entry.ply - 2) / 4) + 1;
        } else {
          // Black moves: ply 4->move 1, ply 8->move 2, ply 12->move 3...  
          moveNumber = Math.floor((entry.ply - 4) / 4) + 1;
        }
      }
      
      if (entry.actionType === 'ban') {
        const ban = entry.action as Ban;
        let banNotation = `${ban.from}${ban.to}`;
        
        // Use stored san if available and config allows PGN indicators
        if (this._indicatorConfig.pgn && entry.san) {
          // Use the san which already has indicators from when the ban was played
          const indicator = entry.san.match(/[+#=]$/)?.[0];
          if (indicator) {
            banNotation += indicator;
          }
        }
        
        moveText += `{banning: ${banNotation}} `;
      } else {
        if (entry.player === 'white') {
          moveText = `${moveNumber}. ${moveText}`;
        }
        
        // Respect PGN indicator configuration for moves
        let moveNotation = entry.san || '';
        if (!this._indicatorConfig.pgn && moveNotation) {
          // Strip indicators if config disables them
          moveNotation = moveNotation.replace(/[+#=]$/, '');
        }
        moveText += `${moveNotation} `;
        
        if (entry.player === 'black') {
          pgn += moveText;
          moveText = '';
          currentTurn++;
        }
      }
    }
    
    if (moveText) {
      const lastMoveNumber = this._history.length > 0 ? Math.floor((this._history[this._history.length - 1].ply + 1) / 2) : 1;
      if (!moveText.startsWith(`${lastMoveNumber}.`)) {
        moveText = `${lastMoveNumber}. ${moveText}`;
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
    this._ply = 1;
  }
  
  /**
   * Returns an ASCII representation of the current board position
   * Shows the banned move with brackets around the affected squares
   * @returns ASCII string representation of the board
   * @example
   * ```typescript
   * console.log(game.ascii());
   * // After banning e2-e4:
   * // +------------------------+
   * // | r  n  b  q  k  b  n  r |
   * // | p  p  p  p  p  p  p  p |
   * // | .  .  .  .  .  .  .  . |
   * // | .  .  .  . [.] .  .  . |  ← e4 is banned destination
   * // | .  .  .  .  .  .  .  . |
   * // | .  .  .  .  .  .  .  . |
   * // | P  P  P  P [P] P  P  P |  ← e2 is banned source
   * // | R  N  B  Q  K  B  N  R |
   * // +------------------------+
   * // Banned: e2→e4
   * ```
   */
  ascii(): string {
    // Get the base board from chess.ts
    let boardLines = this.chess.ascii().split('\n');
    
    // If there's a banned move, mark it on the board
    if (this._currentBannedMove) {
      const from = this._currentBannedMove.from;
      const to = this._currentBannedMove.to;
      
      // Convert algebraic notation to board coordinates
      // Files: a-h map to columns 0-7
      // Ranks: 1-8 map to rows 7-0 (rank 8 is row 0, rank 1 is row 7)
      const fromFile = from.charCodeAt(0) - 'a'.charCodeAt(0);
      const fromRank = 8 - parseInt(from[1]);
      const toFile = to.charCodeAt(0) - 'a'.charCodeAt(0);
      const toRank = 8 - parseInt(to[1]);
      
      // Board lines structure:
      // Line 0: +------------------------+
      // Line 1-8: | piece  piece  piece ... | (8 ranks from 8 to 1)
      // Line 9: +------------------------+
      
      // Helper to mark a square in the board string
      const markSquare = (lineIndex: number, fileIndex: number) => {
        // Line format: "N | piece  piece  piece..." where N is rank number
        // After "| " (at position 4), pieces are at positions: 4, 7, 10, 13, 16, 19, 22, 25
        // So piece position = 4 + (fileIndex * 3)
        const piecePos = 4 + (fileIndex * 3);
        const line = boardLines[lineIndex];
        
        if (line && piecePos < line.length) {
          // Get the piece character at this position
          const piece = line[piecePos];
          
          // We want to replace "X  " with "[X]" where X is the piece
          // This maintains the 3-character width per square
          const before = line.substring(0, piecePos - 1);  // Everything before the space before the piece
          const after = line.substring(piecePos + 2);      // Everything after the two spaces after the piece
          boardLines[lineIndex] = before + '[' + piece + ']' + after;
        }
      };
      
      // Mark the source square (from)
      if (fromRank >= 0 && fromRank < 8) {
        markSquare(fromRank + 1, fromFile);
      }
      
      // Mark the destination square (to) 
      if (toRank >= 0 && toRank < 8) {
        markSquare(toRank + 1, toFile);
      }
    }
    
    // Reconstruct the board
    let board = boardLines.join('\n');
    
    // Add ban information below the board
    if (this._currentBannedMove) {
      board += `\nBanned: ${this._currentBannedMove.from}→${this._currentBannedMove.to}`;
    }
    
    // Add ply and turn information
    board += `\nPly: ${this._ply} (${this.getActionType()} by ${this.getActivePlayer()})`;
    
    // Add whose pieces move next
    const nextMover = this.nextMoveColor();
    board += `\nNext move: ${nextMover}`;
    
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
      const move: Move = promotion 
        ? { from: from as Square, to: to as Square, promotion: promotion as Promotion }
        : { from: from as Square, to: to as Square };
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
    
    // Only include indicators if configuration allows
    if (!this._indicatorConfig.serialization) {
      return BanChess.serializeAction(action);
    }
    
    // Determine if we need a game state indicator
    let indicator: '+' | '#' | '=' | undefined;
    
    if (lastEntry.san) {
      // Use the stored san which has the indicator
      const match = lastEntry.san.match(/[+#=]$/);
      if (match) {
        indicator = match[0] as '+' | '#' | '=';
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
      ply: this._ply
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
    this._ply = syncState.ply;
  }
  
  /**
   * Get a unified action log with both bans and moves in a single array
   * Bans use "b:fromto" format, moves use SAN notation with indicators
   * @returns Array of actions in chronological order
   * @example
   * ```typescript
   * const log = game.getActionLog();
   * // ["b:e2e4", "d4", "b:e7e5", "d5", "b:d2d4", "Nf3", "b:h7h6", "Qh4#"]
   * ```
   */
  getActionLog(): string[] {
    return this._history.map((entry) => {
      if (entry.actionType === 'ban') {
        // Bans use b:fromto format with indicators
        const ban = entry.action as Ban;
        let banNotation = `b:${ban.from}${ban.to}`;
        
        // Add indicator if present in stored san
        if (entry.san && this._indicatorConfig.serialization) {
          const match = entry.san.match(/[+#=]$/);
          if (match) {
            banNotation += match[0];
          }
        }
        
        return banNotation;
      } else {
        // Moves use SAN notation (algebraic notation)
        // The san field already contains the proper notation with indicators
        return entry.san || `${entry.action.from}${entry.action.to}`;
      }
    });
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
      
      // Only include indicators if configuration allows
      if (!this._indicatorConfig.serialization) {
        return BanChess.serializeAction(action);
      }
      
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
   * @param fen - FEN string with optional 7th field for ply number and ban state
   * @private
   */
  private loadFromFEN(fen: string): void {
    const parts = fen.split(' ');
    
    if (parts.length < 7) {
      this.chess = new Chess(fen);
      return;
    }
    
    const baseFen = parts.slice(0, 6).join(' ');
    let plyState = parts[6];
    
    this.chess = new Chess(baseFen);
    
    // Extract PGN indicator if present
    let indicator = '';
    if (plyState && plyState !== '-') {
      // Check if the plyState ends with a PGN indicator
      const lastChar = plyState[plyState.length - 1];
      if (lastChar === '+' || lastChar === '#' || lastChar === '=') {
        indicator = lastChar;
        plyState = plyState.slice(0, -1); // Remove indicator from plyState
      }
      
      if (plyState.includes(':')) {
        const [plyStr, banState] = plyState.split(':');
        this._ply = parseInt(plyStr, 10) || 1;
        
        if (banState && banState.length >= 4) {
          this._currentBannedMove = {
            from: banState.substring(0, 2) as Square,
            to: banState.substring(2, 4) as Square
          };
        }
      } else {
        // Legacy format or just ply number
        const plyNum = parseInt(plyState, 10);
        if (!isNaN(plyNum)) {
          this._ply = plyNum;
        }
        // Support legacy ban state format for backward compatibility
        else if (plyState.startsWith('b:') || plyState.startsWith('w:')) {
          const [player, value] = plyState.split(':');
          if (value !== 'ban' && value.length === 4) {
            this._currentBannedMove = {
              from: value.substring(0, 2) as Square,
              to: value.substring(2, 4) as Square
            };
          }
        }
      }
    }
    
    // Note: The indicator represents the current game state but doesn't need to be stored
    // The actual game state is determined by the chess.ts position
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