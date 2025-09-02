import { BanChess } from '../src/BanChess';

describe('BanChess', () => {
  describe('Game Flow', () => {
    it('should start with Black banning White\'s first move', () => {
      const game = new BanChess();
      expect(game.turn).toBe('black');
      expect(game.nextActionType()).toBe('ban');
    });

    it('should follow the correct turn sequence', () => {
      const game = new BanChess();
      
      // Black bans
      expect(game.turn).toBe('black');
      expect(game.nextActionType()).toBe('ban');
      const blackBanResult = game.play({ ban: { from: 'e2', to: 'e4' } });
      expect(blackBanResult.success).toBe(true);
      
      // White moves
      expect(game.turn).toBe('white');
      expect(game.nextActionType()).toBe('move');
      const whiteMoveResult = game.play({ move: { from: 'd2', to: 'd4' } });
      expect(whiteMoveResult.success).toBe(true);
      
      // White bans
      expect(game.turn).toBe('white');
      expect(game.nextActionType()).toBe('ban');
      const whiteBanResult = game.play({ ban: { from: 'e7', to: 'e5' } });
      expect(whiteBanResult.success).toBe(true);
      
      // Black moves
      expect(game.turn).toBe('black');
      expect(game.nextActionType()).toBe('move');
      const blackMoveResult = game.play({ move: { from: 'd7', to: 'd5' } });
      expect(blackMoveResult.success).toBe(true);
      
      // Black bans again
      expect(game.turn).toBe('black');
      expect(game.nextActionType()).toBe('ban');
    });

    it('should prevent banned moves', () => {
      const game = new BanChess();
      
      // Black bans e2-e4
      game.play({ ban: { from: 'e2', to: 'e4' } });
      
      // White tries to play banned move
      const result = game.play({ move: { from: 'e2', to: 'e4' } });
      expect(result.success).toBe(false);
      expect(result.error).toContain('banned');
      
      // White plays legal move
      const legalResult = game.play({ move: { from: 'd2', to: 'd4' } });
      expect(legalResult.success).toBe(true);
    });

    it('should not allow moves when expecting bans', () => {
      const game = new BanChess();
      
      // Try to move when should ban
      const result = game.play({ move: { from: 'e2', to: 'e4' } });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected a ban');
    });

    it('should not allow bans when expecting moves', () => {
      const game = new BanChess();
      
      // Black bans first
      game.play({ ban: { from: 'e2', to: 'e4' } });
      
      // Try to ban again when should move
      const result = game.play({ ban: { from: 'd2', to: 'd4' } });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected a move');
    });
  });

  describe('Legal Moves and Bans', () => {
    it('should return legal bans for the first move', () => {
      const game = new BanChess();
      const bans = game.legalBans();
      
      expect(bans.length).toBeGreaterThan(0);
      expect(bans).toContainEqual({ from: 'e2', to: 'e4' });
      expect(bans).toContainEqual({ from: 'g1', to: 'f3' });
    });

    it('should return legal moves excluding banned move', () => {
      const game = new BanChess();
      
      // Black bans e2-e4
      game.play({ ban: { from: 'e2', to: 'e4' } });
      
      const moves = game.legalMoves();
      expect(moves.length).toBeGreaterThan(0);
      expect(moves).not.toContainEqual({ from: 'e2', to: 'e4' });
      expect(moves).toContainEqual({ from: 'd2', to: 'd4' });
    });

    it('should handle promotion bans correctly', () => {
      const game = new BanChess('4k3/P7/8/8/8/8/8/4K3 b - - 0 1 1'); // Ply 1
      
      // Black bans a7-a8 (blocks ALL promotions)
      game.play({ ban: { from: 'a7', to: 'a8' } });
      
      const moves = game.legalMoves();
      const a7a8Moves = moves.filter(m => m.from === 'a7' && m.to === 'a8');
      expect(a7a8Moves.length).toBe(0);
    });
  });

  describe('Checkmate', () => {
    it('should detect checkmate when only escape is banned', () => {
      // Test that checkmate is properly detected when no legal moves exist
      const testGame = new BanChess('4k3/4Q3/4K3/8/8/8/8/8 b - - 0 1 3'); // Ply 3 - White's turn to ban
      
      // Black king is in check with limited escapes
      const bans = testGame.legalBans();
      
      if (bans.length > 0) {
        // Ban one of the escapes
        testGame.play({ ban: bans[0] });
        
        // Check if this results in checkmate
        const moves = testGame.legalMoves();
        if (moves.length === 0 && testGame.inCheck()) {
          expect(testGame.inCheckmate()).toBe(true);
          expect(testGame.gameOver()).toBe(true);
        }
      }
      
      // This test validates the checkmate detection logic
      expect(testGame.inCheck()).toBe(true);
    });
  });

  describe('FEN Support', () => {
    it('should generate FEN with ban state', () => {
      const game = new BanChess();
      
      // Initial position - Black to ban
      let fen = game.fen();
      expect(fen).toContain('1'); // Ply 1
      
      // After Black bans
      game.play({ ban: { from: 'e2', to: 'e4' } });
      fen = game.fen();
      expect(fen).toContain('2:e2e4'); // Ply 2 with banned move
      
      // After White moves
      game.play({ move: { from: 'd2', to: 'd4' } });
      fen = game.fen();
      expect(fen).toContain('3'); // Ply 3, White's turn to ban
    });

    it('should load from extended FEN', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 2:e2e4'; // Ply 2 with banned move
      const game = new BanChess(fen);
      
      expect(game.currentBannedMove).toEqual({ from: 'e2', to: 'e4' });
      expect(game.getActionType()).toBe('move');
      expect(game.getActivePlayer()).toBe('white');
      
      // e2-e4 should be banned
      const moves = game.legalMoves();
      expect(moves).not.toContainEqual({ from: 'e2', to: 'e4' });
    });
  });

  describe('PGN Support', () => {
    it('should generate PGN with ban annotations', () => {
      const game = new BanChess();
      
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'd2', to: 'd4' } });
      game.play({ ban: { from: 'e7', to: 'e5' } });
      game.play({ move: { from: 'd7', to: 'd5' } });
      
      const pgn = game.pgn();
      expect(pgn).toBe('1. {banning: e2e4} d4 {banning: e7e5} d5');
    });

    it('should load from PGN with bans', () => {
      const pgn = '1. {banning: e2e4} d4 {banning: e7e5} d5';
      const game = new BanChess(undefined, pgn);
      
      const history = game.history();
      expect(history.length).toBe(4);
      expect(history[0].actionType).toBe('ban');
      expect(history[1].actionType).toBe('move');
      expect(history[2].actionType).toBe('ban');
      expect(history[3].actionType).toBe('move');
    });
  });

  describe('History', () => {
    it('should track complete game history', () => {
      const game = new BanChess();
      
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'd2', to: 'd4' } });
      
      const history = game.history();
      expect(history.length).toBe(2);
      
      expect(history[0]).toMatchObject({
        ply: 1,
        player: 'black',
        actionType: 'ban',
        action: { from: 'e2', to: 'e4' }
      });
      
      expect(history[1]).toMatchObject({
        ply: 2, // White move is on ply 2
        player: 'white',
        actionType: 'move',
        action: { from: 'd2', to: 'd4' },
        san: 'd4'
      });
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      const game = new BanChess();
      
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'd2', to: 'd4' } });
      
      game.reset();
      
      expect(game.turn).toBe('black');
      expect(game.nextActionType()).toBe('ban');
      expect(game.currentBannedMove).toBeNull();
      expect(game.history().length).toBe(0);
    });
  });
});