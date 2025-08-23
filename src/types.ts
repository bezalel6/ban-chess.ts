export interface Move {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface Ban {
  from: string;
  to: string;
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
  turnNumber: number;
  player: 'white' | 'black';
  actionType: 'ban' | 'move';
  action: Ban | Move;
  san?: string;
  fen: string;
  bannedMove?: Ban | null;
}

export type Color = 'white' | 'black';
export type ActionType = 'ban' | 'move';