import { Chess } from 'chess.ts';
import { 
  Move, 
  Ban, 
  Action, 
  ActionResult, 
  HistoryEntry, 
  Color, 
  ActionType 
} from './types.js';

export class BanChess {
  private chess: Chess;
  private _currentBannedMove: Ban | null = null;
  private _history: HistoryEntry[] = [];
  private _turnNumber: number = 1;
  private _isFirstMove: boolean = true;
  
  constructor(fen?: string, pgn?: string) {
    this.chess = new Chess();
    
    if (pgn) {
      this.loadFromPGN(pgn);
    } else if (fen) {
      this.loadFromFEN(fen);
    }
  }
  
  get turn(): Color {
    if (this._isFirstMove) {
      return 'black';
    }
    
    if (this.nextActionType() === 'ban') {
      return this.chess.turn() === 'w' ? 'black' : 'white';
    }
    
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }
  
  get currentBannedMove(): Ban | null {
    return this._currentBannedMove;
  }
  
  nextActionType(): ActionType {
    if (this._isFirstMove) {
      return 'ban';
    }
    
    return this._currentBannedMove ? 'move' : 'ban';
  }
  
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
  
  private playBan(ban: Ban): ActionResult {
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
  
  private playMove(move: Move): ActionResult {
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
    
    return {
      success: true,
      action: { move },
      san: result.san,
      newFen: this.fen(),
      gameOver: this.gameOver(),
      checkmate: this.inCheckmate(),
      stalemate: this.inStalemate()
    };
  }
  
  private isBannedMove(move: Move): boolean {
    if (!this._currentBannedMove) return false;
    
    return (
      this._currentBannedMove.from === move.from &&
      this._currentBannedMove.to === move.to
    );
  }
  
  legalMoves(): Move[] {
    if (this.nextActionType() !== 'move') {
      return [];
    }
    
    const chessMoves = this.chess.moves({ verbose: true });
    const moves: Move[] = chessMoves.map(m => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion as 'q' | 'r' | 'b' | 'n' | undefined
    }));
    
    if (this._currentBannedMove) {
      return moves.filter(m => !this.isBannedMove(m));
    }
    
    return moves;
  }
  
  legalBans(): Move[] {
    if (this.nextActionType() !== 'ban') {
      return [];
    }
    
    const tempChess = new Chess(this.chess.fen());
    
    if (this._isFirstMove) {
      const moves = tempChess.moves({ verbose: true });
      return moves.map(m => ({
        from: m.from,
        to: m.to
      }));
    }
    
    tempChess.load(this.chess.fen());
    const moves = tempChess.moves({ verbose: true });
    
    const uniqueBans = new Map<string, Ban>();
    moves.forEach(m => {
      const key = `${m.from}-${m.to}`;
      if (!uniqueBans.has(key)) {
        uniqueBans.set(key, {
          from: m.from,
          to: m.to
        });
      }
    });
    
    return Array.from(uniqueBans.values());
  }
  
  inCheck(): boolean {
    return this.chess.inCheck();
  }
  
  inCheckmate(): boolean {
    if (this.nextActionType() !== 'move') return false;
    return this.legalMoves().length === 0 && this.inCheck();
  }
  
  inStalemate(): boolean {
    if (this.nextActionType() !== 'move') return false;
    return this.legalMoves().length === 0 && !this.inCheck();
  }
  
  gameOver(): boolean {
    return this.inCheckmate() || this.inStalemate();
  }
  
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
  
  pgn(): string {
    let pgn = '';
    let moveText = '';
    let currentTurn = 1;
    
    for (const entry of this._history) {
      if (entry.actionType === 'ban') {
        const ban = entry.action as Ban;
        moveText += `{banning: ${ban.from}${ban.to}} `;
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
    
    return pgn.trim();
  }
  
  history(): HistoryEntry[] {
    return [...this._history];
  }
  
  reset(): void {
    this.chess = new Chess();
    this._currentBannedMove = null;
    this._history = [];
    this._turnNumber = 1;
    this._isFirstMove = true;
  }
  
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
            from: value.substring(0, 2),
            to: value.substring(2, 4)
          };
          this._isFirstMove = false;
        }
      }
    }
  }
  
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
            from: banMatch[1],
            to: banMatch[2]
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