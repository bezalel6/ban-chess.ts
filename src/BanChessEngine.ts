import { BanChess } from './BanChess.js';
import type { Action, Move, Ban, GameFlags, Square } from './types.js';

/**
 * Configuration options for the BanChess engine
 */
export interface EngineConfig {
  maxDepth?: number;           // Maximum search depth (default: 6)
  timeLimit?: number;          // Time limit per move in ms (default: 5000)
  useTranspositionTable?: boolean;  // Enable transposition table (default: true)
  evaluationWeights?: {
    material?: number;        // Weight for material evaluation (default: 1.0)
    position?: number;        // Weight for positional evaluation (default: 0.3)
    banPotential?: number;    // Weight for ban evaluation (default: 0.4)
    mobility?: number;        // Weight for mobility evaluation (default: 0.2)
  };
}

/**
 * Transposition table entry for caching evaluations
 */
interface TranspositionEntry {
  score: number;
  depth: number;
  action: Action | null;
  flag: 'exact' | 'lower' | 'upper';
}

/**
 * MiniMax chess engine for the Ban Chess variant
 * Evaluates positions considering both bans and moves
 */
export class BanChessEngine {
  private config: {
    maxDepth: number;
    timeLimit: number;
    useTranspositionTable: boolean;
    evaluationWeights: {
      material: number;
      position: number;
      banPotential: number;
      mobility: number;
    };
  };
  private transpositionTable: Map<string, TranspositionEntry>;
  private nodesEvaluated: number = 0;
  
  // Piece values for material evaluation
  private static readonly PIECE_VALUES = {
    'p': 100,  // Pawn
    'n': 320,  // Knight
    'b': 330,  // Bishop
    'r': 500,  // Rook
    'q': 900,  // Queen
    'k': 20000 // King
  };
  
  // Positional bonus tables (simplified)
  private static readonly PAWN_TABLE = [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
  ];
  
  private static readonly KNIGHT_TABLE = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ];
  
  constructor(config: EngineConfig = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 6,
      timeLimit: config.timeLimit ?? 5000,
      useTranspositionTable: config.useTranspositionTable ?? true,
      evaluationWeights: {
        material: config.evaluationWeights?.material ?? 1.0,
        position: config.evaluationWeights?.position ?? 0.3,
        banPotential: config.evaluationWeights?.banPotential ?? 0.4,
        mobility: config.evaluationWeights?.mobility ?? 0.2
      }
    };
    
    this.transpositionTable = new Map();
  }
  
  /**
   * Find the best action for the current position
   * @param game - The current game state
   * @param timeLimit - Optional time limit override
   * @returns The best action found
   */
  findBestAction(game: BanChess, timeLimit?: number): Action {
    const startTime = Date.now();
    const maxTime = timeLimit ?? this.config.timeLimit;
    
    this.nodesEvaluated = 0;
    let bestAction: Action | null = null;
    let bestScore = -Infinity;
    
    // Clear transposition table for new search
    if (this.config.useTranspositionTable) {
      this.transpositionTable.clear();
    }
    
    // Iterative deepening
    for (let depth = 1; depth <= this.config.maxDepth; depth++) {
      // Check time limit
      if (Date.now() - startTime > maxTime * 0.9) {
        break;
      }
      
      const result = this.minimax(game, depth, -Infinity, Infinity, true);
      
      if (result.action) {
        bestAction = result.action;
        bestScore = result.score;
      }
      
      // Stop if we found a forced win
      if (Math.abs(bestScore) > 9000) {
        break;
      }
      
      // Adaptive time control
      if (depth > 4 && Date.now() - startTime > maxTime * 0.5) {
        break;
      }
    }
    
    // Fallback to first legal action if no best action found
    if (!bestAction) {
      const legalActions = game.getLegalActions();
      if (legalActions.length > 0) {
        bestAction = legalActions[0];
      } else {
        throw new Error('No legal actions available');
      }
    }
    
    return bestAction;
  }
  
  /**
   * MiniMax algorithm with alpha-beta pruning
   */
  private minimax(
    game: BanChess,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean
  ): { score: number; action: Action | null } {
    this.nodesEvaluated++;
    
    // Check transposition table
    const hash = this.getPositionHash(game);
    if (this.config.useTranspositionTable) {
      const cached = this.transpositionTable.get(hash);
      if (cached && cached.depth >= depth) {
        if (cached.flag === 'exact') {
          return { score: cached.score, action: cached.action };
        } else if (cached.flag === 'lower' && cached.score > alpha) {
          alpha = cached.score;
        } else if (cached.flag === 'upper' && cached.score < beta) {
          beta = cached.score;
        }
        
        if (alpha >= beta) {
          return { score: cached.score, action: cached.action };
        }
      }
    }
    
    // Terminal node evaluation
    if (depth === 0 || game.gameOver()) {
      const score = this.evaluatePosition(game);
      return { score: maximizing ? score : -score, action: null };
    }
    
    const actions = game.getLegalActions();
    
    // No legal actions (shouldn't happen in Ban Chess but handle it)
    if (actions.length === 0) {
      const score = this.evaluatePosition(game);
      return { score: maximizing ? score : -score, action: null };
    }
    
    // Order actions for better pruning
    const orderedActions = this.orderActions(game, actions);
    
    let bestAction: Action | null = null;
    let bestScore = maximizing ? -Infinity : Infinity;
    let flag: 'exact' | 'lower' | 'upper' = 'exact';
    
    for (const action of orderedActions) {
      // Clone game and make the action
      const gameCopy = this.cloneGame(game);
      const result = gameCopy.play(action);
      
      if (!result.success) {
        continue;
      }
      
      // Check if this action caused immediate checkmate
      if (result.flags?.banCausedCheckmate || result.flags?.checkmate) {
        // Immediate win for the player who just moved
        const winScore = maximizing ? 10000 - (10 - depth) : -10000 + (10 - depth);
        if (maximizing && winScore > bestScore) {
          bestScore = winScore;
          bestAction = action;
        } else if (!maximizing && winScore < bestScore) {
          bestScore = winScore;
          bestAction = action;
        }
        
        // This is the best possible outcome, we can stop searching
        if (maximizing) {
          alpha = Math.max(alpha, bestScore);
        } else {
          beta = Math.min(beta, bestScore);
        }
        
        if (alpha >= beta) {
          break;
        }
        continue;
      }
      
      // Recursively evaluate
      // CRITICAL: In Ban Chess, check if the SAME player continues (e.g., move then ban)
      const nextPlayer = gameCopy.getActivePlayer();
      const currentPlayer = game.getActivePlayer();
      const flipMaximizing = nextPlayer !== currentPlayer;
      const evalResult = this.minimax(gameCopy, depth - 1, alpha, beta, flipMaximizing ? !maximizing : maximizing);
      
      if (maximizing) {
        if (evalResult.score > bestScore) {
          bestScore = evalResult.score;
          bestAction = action;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (evalResult.score < bestScore) {
          bestScore = evalResult.score;
          bestAction = action;
        }
        beta = Math.min(beta, bestScore);
      }
      
      // Alpha-beta pruning
      if (beta <= alpha) {
        flag = maximizing ? 'lower' : 'upper';
        break;
      }
    }
    
    // Store in transposition table
    if (this.config.useTranspositionTable) {
      this.transpositionTable.set(hash, {
        score: bestScore,
        depth,
        action: bestAction,
        flag
      });
    }
    
    return { score: bestScore, action: bestAction };
  }
  
  /**
   * Evaluate the current position
   */
  private evaluatePosition(game: BanChess): number {
    // Check for game over states including ban-caused checkmate
    // Note: After a ban causes checkmate, the flags are set but gameOver() might not reflect it
    const lastEntry = game.history()[game.history().length - 1];
    if (lastEntry?.flags?.banCausedCheckmate) {
      // The last action caused checkmate via ban - the player who banned wins
      // Since evaluation is from current player's perspective, and they can't move, they lost
      return -10000;
    }
    
    if (game.inCheckmate()) {
      // Current player is in checkmate - very bad for them
      return -10000;
    }
    
    if (game.inStalemate() || game.inDraw()) {
      return 0; // Draw
    }
    
    // Get base evaluations
    const materialScore = this.getMaterialScore(game);
    const positionScore = this.getPositionalScore(game);
    const mobilityScore = this.getMobilityScore(game);
    
    // Context-aware evaluation based on action type
    const nextAction = game.getActionType();
    let banScore = 0;
    
    if (nextAction === 'ban') {
      // Evaluate ban potential
      banScore = this.evaluateBanPotential(game);
    } else if (game.currentBannedMove) {
      // Evaluate impact of current ban
      banScore = -this.evaluateBannedMoveImpact(game);
    }
    
    // Combine scores with weights
    const weights = this.config.evaluationWeights;
    const totalScore = 
      materialScore * weights.material +
      positionScore * weights.position +
      mobilityScore * weights.mobility +
      banScore * weights.banPotential;
    
    // Adjust for whose turn it is
    const activePlayer = game.getActivePlayer();
    return activePlayer === 'white' ? totalScore : -totalScore;
  }
  
  /**
   * Calculate material balance
   */
  private getMaterialScore(game: BanChess): number {
    const fen = game.fen();
    const board = fen.split(' ')[0];
    let score = 0;
    
    for (const char of board) {
      if (char in BanChessEngine.PIECE_VALUES) {
        const value = BanChessEngine.PIECE_VALUES[char.toLowerCase() as keyof typeof BanChessEngine.PIECE_VALUES];
        score += char === char.toUpperCase() ? value : -value;
      }
    }
    
    return score;
  }
  
  /**
   * Calculate positional score
   */
  private getPositionalScore(game: BanChess): number {
    const fen = game.fen();
    const board = fen.split(' ')[0];
    let score = 0;
    let row = 0, col = 0;
    
    for (const char of board) {
      if (char === '/') {
        row++;
        col = 0;
      } else if ('12345678'.includes(char)) {
        col += parseInt(char);
      } else {
        const piece = char.toLowerCase();
        const isWhite = char === char.toUpperCase();
        const index = isWhite ? (row * 8 + col) : ((7 - row) * 8 + col);
        
        let pieceScore = 0;
        if (piece === 'p') {
          pieceScore = BanChessEngine.PAWN_TABLE[index];
        } else if (piece === 'n') {
          pieceScore = BanChessEngine.KNIGHT_TABLE[index];
        }
        
        score += isWhite ? pieceScore : -pieceScore;
        col++;
      }
    }
    
    return score;
  }
  
  /**
   * Calculate mobility score (number of legal moves)
   */
  private getMobilityScore(game: BanChess): number {
    const actions = game.getLegalActions();
    return actions.length * 10; // Simple mobility bonus
  }
  
  /**
   * Evaluate the potential value of available bans
   */
  private evaluateBanPotential(game: BanChess): number {
    const bans = game.legalBans();
    let score = 0;
    
    for (const ban of bans) {
      // Check if ban prevents development
      if (this.preventsKnightDevelopment(ban)) {
        score += 30;
      }
      
      // Check if ban prevents center control
      if (this.preventsCenterControl(ban)) {
        score += 40;
      }
      
      // Check if ban prevents castling
      if (this.preventsCastling(game, ban)) {
        score += 50;
      }
      
      // Check if this is the only escape from check (instant win)
      if (this.isOnlyEscape(game, ban)) {
        score += 10000;
      }
    }
    
    return score;
  }
  
  /**
   * Evaluate impact of currently banned move
   */
  private evaluateBannedMoveImpact(game: BanChess): number {
    const banned = game.currentBannedMove;
    if (!banned) return 0;
    
    let impact = 10; // Base impact
    
    // Higher impact for center squares
    if (['e4', 'e5', 'd4', 'd5'].includes(banned.to)) {
      impact += 20;
    }
    
    // Higher impact for development moves
    if (banned.from[1] === '1' || banned.from[1] === '8') {
      impact += 15;
    }
    
    return impact;
  }
  
  /**
   * Check if ban prevents knight development
   */
  private preventsKnightDevelopment(ban: Ban): boolean {
    const knightDevelopmentMoves = [
      { from: 'b1' as Square, to: 'c3' as Square },
      { from: 'b1' as Square, to: 'a3' as Square },
      { from: 'g1' as Square, to: 'f3' as Square },
      { from: 'g1' as Square, to: 'h3' as Square },
      { from: 'b8' as Square, to: 'c6' as Square },
      { from: 'b8' as Square, to: 'a6' as Square },
      { from: 'g8' as Square, to: 'f6' as Square },
      { from: 'g8' as Square, to: 'h6' as Square }
    ];
    
    return knightDevelopmentMoves.some(
      move => move.from === ban.from && move.to === ban.to
    );
  }
  
  /**
   * Check if ban prevents center control
   */
  private preventsCenterControl(ban: Ban): boolean {
    const centerSquares = ['e4', 'e5', 'd4', 'd5'];
    return centerSquares.includes(ban.to);
  }
  
  /**
   * Check if ban prevents castling
   */
  private preventsCastling(game: BanChess, ban: Ban): boolean {
    const castlingMoves = [
      { from: 'e1' as Square, to: 'g1' as Square }, // White kingside
      { from: 'e1' as Square, to: 'c1' as Square }, // White queenside
      { from: 'e8' as Square, to: 'g8' as Square }, // Black kingside
      { from: 'e8' as Square, to: 'c8' as Square }  // Black queenside
    ];
    
    return castlingMoves.some(
      move => move.from === ban.from && move.to === ban.to
    );
  }
  
  /**
   * Check if this ban blocks the only escape from check
   */
  private isOnlyEscape(game: BanChess, ban: Ban): boolean {
    // Clone game to test
    const testGame = this.cloneGame(game);
    
    // Skip if not in check
    if (!testGame.inCheck()) {
      return false;
    }
    
    // Get all legal moves
    const moves = testGame.legalMoves();
    
    // If only one legal move and it matches the ban, it's checkmate
    if (moves.length === 1) {
      const onlyMove = moves[0];
      return onlyMove.from === ban.from && onlyMove.to === ban.to;
    }
    
    return false;
  }
  
  /**
   * Order actions for better alpha-beta pruning
   */
  private orderActions(game: BanChess, actions: Action[]): Action[] {
    return actions.sort((a, b) => {
      const scoreA = this.getActionPriority(game, a);
      const scoreB = this.getActionPriority(game, b);
      return scoreB - scoreA;
    });
  }
  
  /**
   * Get priority score for move ordering
   */
  private getActionPriority(game: BanChess, action: Action): number {
    let score = 0;
    
    if ('move' in action) {
      const move = action.move;
      
      // Prioritize captures (simplified - would need to check actual capture)
      const testGame = this.cloneGame(game);
      const beforeMaterial = this.getMaterialScore(testGame);
      testGame.play(action);
      const afterMaterial = this.getMaterialScore(testGame);
      
      if (Math.abs(afterMaterial - beforeMaterial) > 0) {
        score += 100; // Likely a capture
      }
      
      // Prioritize center control
      if (['e4', 'e5', 'd4', 'd5'].includes(move.to)) {
        score += 50;
      }
      
      // Prioritize development
      if (move.from[1] === '1' || move.from[1] === '8') {
        score += 30;
      }
      
      // Prioritize checks
      if (testGame.inCheck()) {
        score += 80;
      }
    } else if ('ban' in action) {
      const ban = action.ban;
      
      // Prioritize banning center moves
      if (['e4', 'e5', 'd4', 'd5'].includes(ban.to)) {
        score += 40;
      }
      
      // Prioritize banning development
      if (this.preventsKnightDevelopment(ban)) {
        score += 30;
      }
    }
    
    return score;
  }
  
  /**
   * Clone game state efficiently
   */
  private cloneGame(game: BanChess): BanChess {
    return new BanChess(game.fen());
  }
  
  /**
   * Get position hash for transposition table
   */
  private getPositionHash(game: BanChess): string {
    // Simple FEN-based hash
    // In production, would use Zobrist hashing for better performance
    return game.fen();
  }
  
  /**
   * Get statistics about the last search
   */
  getStatistics(): { nodesEvaluated: number; transpositionTableSize: number } {
    return {
      nodesEvaluated: this.nodesEvaluated,
      transpositionTableSize: this.transpositionTable.size
    };
  }
}