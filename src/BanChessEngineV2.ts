import { BanChess } from './BanChess.js';
import type { Action, Move, Ban, GameFlags, Square, Player } from './types.js';

/**
 * Search statistics for performance monitoring
 */
export interface SearchStatistics {
  nodes: number;
  qnodes: number;
  tbhits: number;
  depth: number;
  seldepth: number;
  time: number;
  nps: number; // nodes per second
  hashfull: number;
  pv: Action[];
}

/**
 * Engine configuration following Stockfish patterns
 */
export interface EngineConfigV2 {
  threads?: number;
  hash?: number; // MB for transposition table
  multiPV?: number;
  contempt?: number;
  analysisMode?: boolean;
  skillLevel?: number; // 0-20 like Stockfish
  moveTime?: number;
  timeControl?: {
    wtime?: number;
    btime?: number;
    winc?: number;
    binc?: number;
    movestogo?: number;
  };
}

/**
 * Move with evaluation score for move ordering
 */
interface ScoredAction {
  action: Action;
  score: number;
}

/**
 * Transposition table entry with more information
 */
interface TTEntry {
  hash: bigint;
  depth: number;
  score: number;
  bound: 'exact' | 'lower' | 'upper';
  move: Action | null;
  age: number;
  pv: boolean; // Is this a PV node?
}

/**
 * Killer moves for move ordering
 */
interface KillerMoves {
  [ply: number]: Action[];
}

/**
 * History heuristic for move ordering
 */
interface HistoryTable {
  [key: string]: number;
}

/**
 * Principal Variation table
 */
interface PVTable {
  [ply: number]: Action[];
}

/**
 * Ban Chess Engine V2 - Following Stockfish architecture principles
 * 
 * Key improvements:
 * - Proper player perspective handling
 * - Quiescence search for tactical stability
 * - Advanced move ordering with killers and history
 * - Principal variation tracking
 * - Aspiration windows
 * - Proper time management
 * - Ban-specific strategic evaluation
 */
export class BanChessEngineV2 {
  // Configuration
  private config: Required<EngineConfigV2>;
  
  // Search state
  private nodes: number = 0;
  private qnodes: number = 0;
  private maxPly: number = 0;
  private searchStartTime: number = 0;
  private searchTimeLimit: number = 0;
  private stopSearch: boolean = false;
  
  // Move ordering
  private killerMoves: KillerMoves = {};
  private historyTable: HistoryTable = {};
  private pvTable: PVTable = {};
  private pvLength: number[] = new Array(128).fill(0);
  
  // Transposition table
  private ttSize: number;
  private ttTable: Map<string, TTEntry>;
  private ttAge: number = 0;
  
  // Zobrist hashing keys (simplified - in production would be pre-generated)
  private zobristPieces: bigint[][] = [];
  private zobristCastling: bigint[] = [];
  private zobristEnPassant: bigint[] = [];
  private zobristSide: bigint = BigInt(0);
  private zobristBan: Map<string, bigint> = new Map();
  
  // Evaluation parameters (tunable)
  private readonly PIECE_VALUES = {
    'p': 100,
    'n': 320,
    'b': 330,
    'r': 500,
    'q': 900,
    'k': 20000
  };
  
  // Piece-square tables (from white's perspective)
  private readonly PST = {
    'p': [
      0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5,-10,  0,  0,-10, -5,  5,
      5, 10, 10,-20,-20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0
    ],
    'n': [
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50
    ],
    'b': [
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5, 10, 10,  5,  0,-10,
      -10,  5,  5, 10, 10,  5,  5,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  5,  0,  0,  0,  0,  5,-10,
      -20,-10,-10,-10,-10,-10,-10,-20
    ],
    'r': [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0
    ],
    'q': [
      -20,-10,-10, -5, -5,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5,  5,  5,  5,  0,-10,
      -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
      -10,  5,  5,  5,  5,  5,  0,-10,
      -10,  0,  5,  0,  0,  0,  0,-10,
      -20,-10,-10, -5, -5,-10,-10,-20
    ],
    'k': [
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
      20, 20,  0,  0,  0,  0, 20, 20,
      20, 30, 10,  0,  0, 10, 30, 20
    ],
    'k_endgame': [
      -50,-40,-30,-20,-20,-30,-40,-50,
      -30,-20,-10,  0,  0,-10,-20,-30,
      -30,-10, 20, 30, 30, 20,-10,-30,
      -30,-10, 30, 40, 40, 30,-10,-30,
      -30,-10, 30, 40, 40, 30,-10,-30,
      -30,-10, 20, 30, 30, 20,-10,-30,
      -30,-30,  0,  0,  0,  0,-30,-30,
      -50,-30,-30,-30,-30,-30,-30,-50
    ]
  };
  
  // Ban-specific evaluation weights
  private readonly BAN_WEIGHTS = {
    centerControl: 40,
    development: 30,
    castlingRights: 50,
    onlyEscape: 10000,
    forcingMove: 25,
    pieceActivity: 20,
    pawnStructure: 15
  };
  
  constructor(config: EngineConfigV2 = {}) {
    this.config = {
      threads: config.threads ?? 1,
      hash: config.hash ?? 128,
      multiPV: config.multiPV ?? 1,
      contempt: config.contempt ?? 0,
      analysisMode: config.analysisMode ?? false,
      skillLevel: config.skillLevel ?? 20,
      moveTime: config.moveTime ?? 5000,
      timeControl: config.timeControl ?? {}
    };
    
    // Initialize transposition table
    this.ttSize = (this.config.hash * 1024 * 1024) / 64; // Approximate entries
    this.ttTable = new Map();
    
    // Initialize Zobrist keys
    this.initializeZobrist();
  }
  
  /**
   * Initialize Zobrist hashing keys
   */
  private initializeZobrist(): void {
    // Initialize piece keys [piece][square]
    this.zobristPieces = [];
    const pieces = ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k'];
    
    for (let p = 0; p < pieces.length; p++) {
      this.zobristPieces[p] = [];
      for (let sq = 0; sq < 64; sq++) {
        // Random 64-bit number (simplified)
        this.zobristPieces[p][sq] = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      }
    }
    
    // Initialize castling keys
    this.zobristCastling = [];
    for (let i = 0; i < 16; i++) {
      this.zobristCastling[i] = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    }
    
    // Initialize en passant keys
    this.zobristEnPassant = [];
    for (let i = 0; i < 8; i++) {
      this.zobristEnPassant[i] = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    }
    
    // Side to move key
    this.zobristSide = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    
    // Ban keys
    this.zobristBan = new Map();
  }
  
  /**
   * Main search function - UCI-like interface
   */
  search(game: BanChess, options: {
    depth?: number;
    movetime?: number;
    infinite?: boolean;
    nodes?: number;
  } = {}): SearchStatistics {
    // Reset search state
    this.nodes = 0;
    this.qnodes = 0;
    this.maxPly = 0;
    this.stopSearch = false;
    this.searchStartTime = Date.now();
    this.ttAge++;
    
    // Clear move ordering tables for new search
    this.killerMoves = {};
    this.pvTable = {};
    this.pvLength = new Array(128).fill(0);
    
    // Calculate time limit
    if (options.movetime) {
      this.searchTimeLimit = options.movetime;
    } else if (this.config.timeControl?.wtime || this.config.timeControl?.btime) {
      this.searchTimeLimit = this.calculateTimeForMove(game);
    } else {
      this.searchTimeLimit = this.config.moveTime || 5000;
    }
    
    let bestAction: Action | null = null;
    let bestScore = -Infinity;
    let depth = 1;
    const maxDepth = options.depth || 64;
    
    // Iterative deepening with aspiration windows
    let alpha = -Infinity;
    let beta = Infinity;
    let aspirationDelta = 50;
    
    while (depth <= maxDepth && !this.stopSearch) {
      // Check time
      if (!options.infinite && this.shouldStopSearch()) {
        break;
      }
      
      // Search with aspiration window
      let searchScore: number;
      let searchFailed = true;
      let attempts = 0;
      
      while (searchFailed && attempts < 5) {
        attempts++;
        const result = this.alphaBeta(game, depth, 0, alpha, beta);
        searchScore = result.score;
        
        // Check aspiration window failure
        if (searchScore <= alpha) {
          // Fail low - widen window downward
          beta = (alpha + beta) / 2;
          alpha = Math.max(searchScore - aspirationDelta, -Infinity);
          aspirationDelta *= 2;
        } else if (searchScore >= beta) {
          // Fail high - widen window upward
          alpha = (alpha + beta) / 2;
          beta = Math.min(searchScore + aspirationDelta, Infinity);
          aspirationDelta *= 2;
        } else {
          // Search succeeded
          searchFailed = false;
          bestScore = searchScore;
          if (result.action) {
            bestAction = result.action;
          }
          
          // Set next aspiration window
          aspirationDelta = 50;
          alpha = searchScore - aspirationDelta;
          beta = searchScore + aspirationDelta;
        }
      }
      
      // Store principal variation
      if (this.pvTable[0]) {
        console.log(`info depth ${depth} score cp ${bestScore} nodes ${this.nodes} nps ${this.getNPS()} pv ${this.getPVString()}`);
      }
      
      // Check for mate score
      if (Math.abs(bestScore) > 9000) {
        break;
      }
      
      depth++;
    }
    
    // Return best move found
    if (!bestAction) {
      const actions = game.getLegalActions();
      if (actions.length > 0) {
        bestAction = actions[0];
      }
    }
    
    return {
      nodes: this.nodes,
      qnodes: this.qnodes,
      tbhits: 0,
      depth: depth - 1,
      seldepth: this.maxPly,
      time: Date.now() - this.searchStartTime,
      nps: this.getNPS(),
      hashfull: this.getHashFull(),
      pv: this.pvTable[0] || []
    };
  }
  
  /**
   * Get best move from last search
   */
  getBestMove(game: BanChess): Action | null {
    const stats = this.search(game);
    return stats.pv[0] || null;
  }
  
  /**
   * Alpha-beta search with Ban Chess specifics
   */
  private alphaBeta(
    game: BanChess,
    depth: number,
    ply: number,
    alpha: number,
    beta: number,
    pvNode: boolean = true
  ): { score: number; action: Action | null } {
    // Update max ply reached
    if (ply > this.maxPly) {
      this.maxPly = ply;
    }
    
    // Check for stop signal
    if (this.stopSearch) {
      return { score: 0, action: null };
    }
    
    this.nodes++;
    
    // Clear PV for this ply
    this.pvLength[ply] = ply;
    
    // Check for draws and game over
    if (game.gameOver()) {
      if (game.inCheckmate()) {
        // Return negative score because current player lost
        return { score: -10000 + ply, action: null };
      }
      return { score: 0, action: null }; // Draw
    }
    
    // Probe transposition table
    const ttEntry = this.probeTT(game);
    const ttMove = ttEntry?.move || null;
    
    if (ttEntry && ttEntry.depth >= depth && !pvNode) {
      if (ttEntry.bound === 'exact') {
        return { score: ttEntry.score, action: ttMove };
      } else if (ttEntry.bound === 'lower' && ttEntry.score >= beta) {
        return { score: ttEntry.score, action: ttMove };
      } else if (ttEntry.bound === 'upper' && ttEntry.score <= alpha) {
        return { score: ttEntry.score, action: ttMove };
      }
    }
    
    // Quiescence search at leaf nodes
    if (depth <= 0) {
      return this.quiescence(game, ply, alpha, beta);
    }
    
    // Null move pruning (adapted for Ban Chess)
    // Only try null move if we're not in check and it's a move ply
    if (!pvNode && depth >= 3 && !game.inCheck() && game.getActionType() === 'move') {
      // In Ban Chess, "null move" means skipping our action
      // This is complex to implement correctly, skip for now
    }
    
    // Generate and order moves
    const actions = this.generateOrderedActions(game, ply, ttMove);
    
    if (actions.length === 0) {
      // No legal actions - shouldn't happen in Ban Chess
      return { score: this.evaluate(game), action: null };
    }
    
    let bestScore = -Infinity;
    let bestAction: Action | null = null;
    let bound: 'exact' | 'lower' | 'upper' = 'upper';
    
    // Search all actions
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i].action;
      
      // Make the action
      const gameCopy = new BanChess(game.fen());
      const result = gameCopy.play(action);
      
      if (!result.success) {
        continue;
      }
      
      let score: number;
      
      // Principal variation search
      if (i === 0) {
        // Check if same player continues
        const nextPlayer = gameCopy.getActivePlayer();
        const currentPlayer = game.getActivePlayer();
        const samePlayer = nextPlayer === currentPlayer;
        
        // Search first move with full window (negate only if player changes)
        const pvScore = this.alphaBeta(gameCopy, depth - 1, ply + 1, 
                                       samePlayer ? alpha : -beta, 
                                       samePlayer ? beta : -alpha, pvNode).score;
        score = samePlayer ? pvScore : -pvScore;
      } else {
        // Late move reductions (LMR)
        let reduction = 0;
        if (depth >= 3 && i >= 4 && !game.inCheck()) {
          reduction = Math.floor(Math.sqrt(depth - 1) + Math.sqrt(i));
          reduction = Math.min(reduction, depth - 2);
        }
        
        // CRITICAL: Check if same player continues (Ban Chess specific)
        const nextPlayer = gameCopy.getActivePlayer();
        const currentPlayer = game.getActivePlayer();
        const samePlayer = nextPlayer === currentPlayer;
        
        // Search with null window (negate score only if player changes)
        const nullScore = this.alphaBeta(gameCopy, depth - 1 - reduction, ply + 1, 
                                         samePlayer ? alpha : -alpha - 1, 
                                         samePlayer ? beta : -alpha, false).score;
        score = samePlayer ? nullScore : -nullScore;
        
        // Re-search if it fails high
        if (score > alpha && score < beta) {
          const pvScore = this.alphaBeta(gameCopy, depth - 1, ply + 1, 
                                         samePlayer ? alpha : -beta, 
                                         samePlayer ? beta : -alpha, pvNode).score;
          score = samePlayer ? pvScore : -pvScore;
        }
      }
      
      // Update best move
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
        
        // Update PV
        if (score > alpha) {
          this.updatePV(ply, action);
        }
      }
      
      // Update alpha
      if (score > alpha) {
        alpha = score;
        bound = 'exact';
        
        // Update history and killers for good moves
        if (!this.isCapture(game, action)) {
          this.updateHistory(action, depth);
          this.updateKillers(ply, action);
        }
      }
      
      // Beta cutoff
      if (alpha >= beta) {
        bound = 'lower';
        
        // Update killers for cut moves
        if (!this.isCapture(game, action)) {
          this.updateKillers(ply, action);
        }
        break;
      }
    }
    
    // Store in transposition table
    this.storeTT(game, depth, bestScore, bound, bestAction);
    
    return { score: bestScore, action: bestAction };
  }
  
  /**
   * Quiescence search to avoid horizon effect
   */
  private quiescence(
    game: BanChess,
    ply: number,
    alpha: number,
    beta: number
  ): { score: number; action: Action | null } {
    this.qnodes++;
    
    // Stand pat score
    const standPat = this.evaluate(game);
    
    if (standPat >= beta) {
      return { score: beta, action: null };
    }
    
    if (alpha < standPat) {
      alpha = standPat;
    }
    
    // Only search captures and checks in quiescence
    // In Ban Chess, we should also consider bans that cause immediate checkmate
    const actions = this.generateOrderedActions(game, ply, null, true);
    
    let bestScore = standPat;
    let bestAction: Action | null = null;
    
    for (const scored of actions) {
      const action = scored.action;
      
      // Skip if not a forcing move
      if (!this.isForcingAction(game, action)) {
        continue;
      }
      
      const gameCopy = new BanChess(game.fen());
      const result = gameCopy.play(action);
      
      if (!result.success) {
        continue;
      }
      
      const score = -this.quiescence(gameCopy, ply + 1, -beta, -alpha).score;
      
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
      
      if (score > alpha) {
        alpha = score;
      }
      
      if (alpha >= beta) {
        break;
      }
    }
    
    return { score: bestScore, action: bestAction };
  }
  
  /**
   * Evaluate position from current player's perspective
   */
  private evaluate(game: BanChess): number {
    // Terminal positions
    if (game.inCheckmate()) {
      return -10000; // Current player is checkmated
    }
    
    if (game.inStalemate() || game.inDraw()) {
      return 0;
    }
    
    // Get the current player to move (not the one who just moved)
    const sideToMove = game.getActivePlayer();
    
    // Calculate various evaluation components
    let score = 0;
    
    // Material balance
    score += this.getMaterialBalance(game);
    
    // Piece-square tables
    score += this.getPieceSquareScore(game);
    
    // Mobility
    score += this.getMobilityScore(game);
    
    // King safety
    score += this.getKingSafety(game);
    
    // Pawn structure
    score += this.getPawnStructure(game);
    
    // Ban-specific evaluation
    if (game.getActionType() === 'ban') {
      score += this.getBanPotentialScore(game);
    } else if (game.currentBannedMove) {
      score -= this.getBannedMoveImpact(game);
    }
    
    // Return score from perspective of side to move
    return sideToMove === 'white' ? score : -score;
  }
  
  /**
   * Calculate material balance
   */
  private getMaterialBalance(game: BanChess): number {
    const fen = game.fen();
    const board = fen.split(' ')[0];
    let score = 0;
    
    for (const char of board) {
      const piece = char.toLowerCase();
      if (piece in this.PIECE_VALUES) {
        const value = this.PIECE_VALUES[piece as keyof typeof this.PIECE_VALUES];
        score += char === char.toUpperCase() ? value : -value;
      }
    }
    
    return score;
  }
  
  /**
   * Calculate piece-square table scores
   */
  private getPieceSquareScore(game: BanChess): number {
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
        
        // Calculate square index
        const whiteSquare = row * 8 + col;
        const blackSquare = (7 - row) * 8 + col;
        const squareIndex = isWhite ? whiteSquare : blackSquare;
        
        // Get PST value
        if (piece in this.PST) {
          const pst = this.PST[piece as keyof typeof this.PST];
          const value = Array.isArray(pst) ? pst[squareIndex] : 0;
          score += isWhite ? value : -value;
        }
        
        col++;
      }
    }
    
    return score;
  }
  
  /**
   * Calculate mobility score
   */
  private getMobilityScore(game: BanChess): number {
    const actions = game.getLegalActions();
    return actions.length * 10;
  }
  
  /**
   * Evaluate king safety
   */
  private getKingSafety(game: BanChess): number {
    // Simplified king safety - would be more complex in production
    let score = 0;
    
    if (game.inCheck()) {
      score -= 50;
    }
    
    // Penalty for exposed king (simplified)
    // Would check pawn shelter, open files, etc.
    
    return score;
  }
  
  /**
   * Evaluate pawn structure
   */
  private getPawnStructure(game: BanChess): number {
    // Simplified - would evaluate doubled, isolated, passed pawns
    return 0;
  }
  
  /**
   * Evaluate ban potential
   */
  private getBanPotentialScore(game: BanChess): number {
    const bans = game.legalBans();
    let bestBanScore = 0;
    
    for (const ban of bans) {
      let banScore = 0;
      
      // Check if ban causes checkmate
      const testGame = new BanChess(game.fen());
      const result = testGame.play({ ban });
      if (result.flags?.banCausedCheckmate) {
        return this.BAN_WEIGHTS.onlyEscape;
      }
      
      // Evaluate ban impact
      if (this.blocksCenterControl(ban)) {
        banScore += this.BAN_WEIGHTS.centerControl;
      }
      
      if (this.blocksDevelopment(ban)) {
        banScore += this.BAN_WEIGHTS.development;
      }
      
      if (this.blocksCastling(ban)) {
        banScore += this.BAN_WEIGHTS.castlingRights;
      }
      
      bestBanScore = Math.max(bestBanScore, banScore);
    }
    
    return bestBanScore;
  }
  
  /**
   * Evaluate impact of current ban
   */
  private getBannedMoveImpact(game: BanChess): number {
    const banned = game.currentBannedMove;
    if (!banned) return 0;
    
    let impact = 10;
    
    if (this.blocksCenterControl(banned)) {
      impact += this.BAN_WEIGHTS.centerControl;
    }
    
    if (this.blocksDevelopment(banned)) {
      impact += this.BAN_WEIGHTS.development;
    }
    
    return impact;
  }
  
  /**
   * Generate and order actions for search
   */
  private generateOrderedActions(
    game: BanChess,
    ply: number,
    ttMove: Action | null,
    capturesOnly: boolean = false
  ): ScoredAction[] {
    const actions = game.getLegalActions();
    const scored: ScoredAction[] = [];
    
    for (const action of actions) {
      if (capturesOnly && !this.isForcingAction(game, action)) {
        continue;
      }
      
      let score = 0;
      
      // TT move gets highest priority
      if (ttMove && this.actionsEqual(action, ttMove)) {
        score += 1000000;
      }
      
      // Score captures by MVV-LVA
      if (this.isCapture(game, action)) {
        score += 100000 + this.getMVVLVA(game, action);
      }
      
      // Killer moves
      if (this.isKillerMove(ply, action)) {
        score += 90000;
      }
      
      // History heuristic
      score += this.getHistoryScore(action);
      
      // Ban-specific ordering
      if ('ban' in action) {
        // Prioritize bans that might cause checkmate
        const testGame = new BanChess(game.fen());
        const result = testGame.play(action);
        if (result.flags?.banCausedCheckmate) {
          score += 500000;
        }
      }
      
      scored.push({ action, score });
    }
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    return scored;
  }
  
  // Helper methods
  
  private blocksCenterControl(ban: Ban): boolean {
    const centerSquares = ['e4', 'e5', 'd4', 'd5'];
    return centerSquares.includes(ban.to);
  }
  
  private blocksDevelopment(ban: Ban): boolean {
    const developmentSquares = ['c3', 'f3', 'c6', 'f6', 'b5', 'g5', 'b4', 'g4'];
    return developmentSquares.includes(ban.to) || 
           (ban.from[1] === '1' || ban.from[1] === '8');
  }
  
  private blocksCastling(ban: Ban): boolean {
    const castlingMoves = [
      { from: 'e1' as Square, to: 'g1' as Square },
      { from: 'e1' as Square, to: 'c1' as Square },
      { from: 'e8' as Square, to: 'g8' as Square },
      { from: 'e8' as Square, to: 'c8' as Square }
    ];
    return castlingMoves.some(m => m.from === ban.from && m.to === ban.to);
  }
  
  private isCapture(game: BanChess, action: Action): boolean {
    if ('ban' in action) return false;
    
    // Check if destination square is occupied
    const testGame = new BanChess(game.fen());
    const beforeMaterial = this.getMaterialBalance(testGame);
    testGame.play(action);
    const afterMaterial = this.getMaterialBalance(testGame);
    
    return Math.abs(afterMaterial - beforeMaterial) > 50; // More than a pawn
  }
  
  private isForcingAction(game: BanChess, action: Action): boolean {
    // Check if action is forcing (capture, check, or ban causing checkmate)
    if (this.isCapture(game, action)) return true;
    
    const testGame = new BanChess(game.fen());
    const result = testGame.play(action);
    
    return result.flags?.check || 
           result.flags?.checkmate || 
           result.flags?.banCausedCheckmate || false;
  }
  
  private getMVVLVA(game: BanChess, action: Action): number {
    // Most Valuable Victim - Least Valuable Attacker
    // Simplified version
    return 0;
  }
  
  private actionsEqual(a1: Action, a2: Action): boolean {
    if ('ban' in a1 && 'ban' in a2) {
      return a1.ban.from === a2.ban.from && a1.ban.to === a2.ban.to;
    }
    if ('move' in a1 && 'move' in a2) {
      return a1.move.from === a2.move.from && 
             a1.move.to === a2.move.to &&
             a1.move.promotion === a2.move.promotion;
    }
    return false;
  }
  
  private isKillerMove(ply: number, action: Action): boolean {
    const killers = this.killerMoves[ply] || [];
    return killers.some(k => this.actionsEqual(k, action));
  }
  
  private updateKillers(ply: number, action: Action): void {
    if (!this.killerMoves[ply]) {
      this.killerMoves[ply] = [];
    }
    
    // Keep 2 killer moves per ply
    const killers = this.killerMoves[ply];
    if (!killers.some(k => this.actionsEqual(k, action))) {
      killers.unshift(action);
      if (killers.length > 2) {
        killers.pop();
      }
    }
  }
  
  private getHistoryScore(action: Action): number {
    const key = this.getActionKey(action);
    return this.historyTable[key] || 0;
  }
  
  private updateHistory(action: Action, depth: number): void {
    const key = this.getActionKey(action);
    this.historyTable[key] = (this.historyTable[key] || 0) + depth * depth;
  }
  
  private getActionKey(action: Action): string {
    if ('ban' in action) {
      return `b:${action.ban.from}${action.ban.to}`;
    } else {
      return `m:${action.move.from}${action.move.to}${action.move.promotion || ''}`;
    }
  }
  
  private updatePV(ply: number, action: Action): void {
    this.pvTable[ply] = [action];
    
    // Copy PV from next ply
    if (this.pvTable[ply + 1]) {
      this.pvTable[ply].push(...this.pvTable[ply + 1]);
    }
    
    this.pvLength[ply] = this.pvTable[ply].length;
  }
  
  private getPVString(): string {
    if (!this.pvTable[0]) return '';
    
    return this.pvTable[0].map(action => {
      if ('ban' in action) {
        return `${action.ban.from}${action.ban.to}`;
      } else {
        return `${action.move.from}${action.move.to}${action.move.promotion || ''}`;
      }
    }).join(' ');
  }
  
  private probeTT(game: BanChess): TTEntry | null {
    const hash = game.fen(); // Simplified - would use Zobrist hash
    return this.ttTable.get(hash) || null;
  }
  
  private storeTT(
    game: BanChess,
    depth: number,
    score: number,
    bound: 'exact' | 'lower' | 'upper',
    move: Action | null
  ): void {
    const hash = game.fen(); // Simplified
    
    // Always replace for now - would use replacement scheme
    this.ttTable.set(hash, {
      hash: BigInt(0), // Would be Zobrist hash
      depth,
      score,
      bound,
      move,
      age: this.ttAge,
      pv: bound === 'exact'
    });
    
    // Limit table size
    if (this.ttTable.size > this.ttSize) {
      // Remove old entries (simplified)
      const toRemove = this.ttTable.size - this.ttSize;
      let removed = 0;
      for (const [key, entry] of this.ttTable) {
        if (entry.age < this.ttAge - 2) {
          this.ttTable.delete(key);
          removed++;
          if (removed >= toRemove) break;
        }
      }
    }
  }
  
  private calculateTimeForMove(game: BanChess): number {
    const tc = this.config.timeControl!;
    const isWhite = game.getActivePlayer() === 'white';
    const time = isWhite ? (tc.wtime || 5000) : (tc.btime || 5000);
    const inc = isWhite ? (tc.winc || 0) : (tc.binc || 0);
    const movesToGo = tc.movestogo || 40;
    
    // Simple time management
    const baseTime = time / movesToGo + inc * 0.8;
    
    // Adjust for game phase
    const moveNumber = Math.floor(game.getPly() / 4);
    let multiplier = 1.0;
    
    if (moveNumber < 10) {
      multiplier = 0.8; // Opening - move faster
    } else if (moveNumber < 30) {
      multiplier = 1.2; // Middlegame - think more
    } else {
      multiplier = 1.0; // Endgame
    }
    
    return Math.min(baseTime * multiplier, time * 0.1); // Never use more than 10% of remaining time
  }
  
  private shouldStopSearch(): boolean {
    if (this.stopSearch) return true;
    
    const elapsed = Date.now() - this.searchStartTime;
    return elapsed >= this.searchTimeLimit;
  }
  
  private getNPS(): number {
    const elapsed = (Date.now() - this.searchStartTime) / 1000;
    if (elapsed <= 0) return 0;
    return Math.floor(this.nodes / elapsed);
  }
  
  private getHashFull(): number {
    // Approximate hash fullness
    return Math.min(1000, Math.floor(this.ttTable.size * 1000 / this.ttSize));
  }
  
  /**
   * Stop the current search
   */
  stop(): void {
    this.stopSearch = true;
  }
  
  /**
   * Get current evaluation of position
   */
  evaluatePosition(game: BanChess): number {
    return this.evaluate(game);
  }
}