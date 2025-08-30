import { BanChess } from '../src/BanChess';

describe('Chess Pattern Compliance', () => {
  describe('Draw detection', () => {
    it('should detect draws by insufficient material', () => {
      // King vs King position
      const fen = '8/8/8/4k3/8/3K4/8/8 w - - 0 1 b:ban';
      const game = new BanChess(fen);
      
      expect(game.insufficientMaterial()).toBe(true);
      
      // After a ban, it's time to move
      const bans = game.legalBans();
      if (bans.length > 0) {
        game.play({ ban: bans[0] });
        expect(game.inDraw()).toBe(true);
      }
    });
    
    it('should have threefold repetition detection', () => {
      const game = new BanChess();
      expect(game.inThreefoldRepetition()).toBe(false);
      
      // Would need to create a position that repeats 3 times
      // This is handled by chess.ts internally
    });
  });
  
  describe('Special move notations', () => {
    it('should handle castling notation correctly', () => {
      const game = new BanChess();
      
      // Setup position for quick castling
      game.play({ ban: { from: 'e2', to: 'e3' } });
      game.play({ move: { from: 'e2', to: 'e4' } });
      game.play({ ban: { from: 'e7', to: 'e6' } });
      game.play({ move: { from: 'e7', to: 'e5' } });
      game.play({ ban: { from: 'f1', to: 'd3' } });
      game.play({ move: { from: 'g1', to: 'f3' } });
      game.play({ ban: { from: 'b8', to: 'a6' } });
      game.play({ move: { from: 'b8', to: 'c6' } });
      game.play({ ban: { from: 'f1', to: 'c4' } });
      game.play({ move: { from: 'f1', to: 'e2' } });
      game.play({ ban: { from: 'f8', to: 'd6' } });
      game.play({ move: { from: 'f8', to: 'e7' } });
      game.play({ ban: { from: 'a2', to: 'a3' } });
      
      // Castle kingside
      const result = game.play({ move: { from: 'e1', to: 'g1' } });
      
      expect(result.san).toBe('O-O');
      expect(game.pgn()).toContain('O-O');
    });
    
    it('should handle en passant notation', () => {
      // En passant scenario - with ban state
      const fenBeforeEp = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 1 b:ban';
      const game = new BanChess(fenBeforeEp);
      
      // Black bans something, then White can capture en passant
      game.play({ ban: { from: 'd5', to: 'd4' } });
      const epCapture = game.play({ move: { from: 'e5', to: 'd6' } });
      
      expect(epCapture.san).toBe('exd6'); // En passant capture notation
    });
    
    it('should handle promotion notation', () => {
      // Pawn ready to promote - with ban state
      const promotionFen = 'rnbqkbnr/pppppP1p/8/8/8/8/PPPPP1PP/RNBQKBNR w KQkq - 0 1 b:ban';
      const game = new BanChess(promotionFen);
      
      game.play({ ban: { from: 'a7', to: 'a6' } });
      
      // Promote to queen
      const promoResult = game.play({ 
        move: { from: 'f7', to: 'f8', promotion: 'q' }
      });
      
      expect(promoResult.san).toMatch(/f8=Q/);
      expect(game.pgn()).toContain('f8=Q');
    });
    
    it('should handle capture notation', () => {
      const game = new BanChess();
      
      game.play({ ban: { from: 'e2', to: 'e3' } });
      game.play({ move: { from: 'e2', to: 'e4' } });
      game.play({ ban: { from: 'd7', to: 'd6' } });
      game.play({ move: { from: 'd7', to: 'd5' } });
      game.play({ ban: { from: 'a2', to: 'a3' } });
      
      // Pawn captures pawn
      const capture = game.play({ move: { from: 'e4', to: 'd5' } });
      
      expect(capture.san).toBe('exd5');
      expect(game.pgn()).toContain('exd5');
    });
    
    it('should handle disambiguation notation', () => {
      // Position where two knights can move to same square - with ban state
      const disambigFen = 'rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1 b:ban';
      const game = new BanChess(disambigFen);
      
      game.play({ ban: { from: 'e7', to: 'e6' } });
      
      // Move the f3 knight to e5 (must disambiguate from f6 knight)
      const result = game.play({ move: { from: 'f3', to: 'e5' } });
      
      // Should include file or rank to disambiguate
      expect(result.san).toMatch(/N[f3]e5/);
    });
  });
  
  describe('Board visualization', () => {
    it('should provide ASCII board representation', () => {
      const game = new BanChess();
      const ascii = game.ascii();
      
      expect(ascii).toContain('r  n  b  q  k  b  n  r');
      expect(ascii).toContain('P  P  P  P  P  P  P  P');
      expect(ascii).toContain('Next: ban by black');
    });
    
    it('should show banned move in ASCII', () => {
      const game = new BanChess();
      game.play({ ban: { from: 'e2', to: 'e4' } });
      
      const ascii = game.ascii();
      expect(ascii).toContain('Banned: e2-e4');
      expect(ascii).toContain('Next: move by white');
    });
  });
});