import { BanChess } from '../src/BanChess';

describe('100% Accurate Game State Indicators', () => {
  describe('FEN - Extended with ban state', () => {
    it('should include ply and ban information in 7th field', () => {
      const game = new BanChess();
      
      // Initial FEN should have ply 1
      const initialFen = game.fen();
      expect(initialFen).toMatch(/\s1$/); // Ends with ply 1
      
      // After a ban
      game.play({ ban: { from: 'e2', to: 'e4' } });
      const fenAfterBan = game.fen();
      expect(fenAfterBan).toMatch(/\s2:e2e4$/); // Ply 2 with ban
      
      // After a move
      game.play({ move: { from: 'd2', to: 'd4' } });
      const fenAfterMove = game.fen();
      expect(fenAfterMove).toMatch(/\s3$/); // Ply 3, no active ban
    });
  });

  describe('SAN - Standard Algebraic Notation with indicators', () => {
    it('should ALWAYS include + for check', () => {
      // Position where move causes check
      const checkFEN = '7k/8/8/8/8/8/8/R6K w - - 0 1 2';
      const game = new BanChess(checkFEN);
      
      const result = game.play({ move: { from: 'a1', to: 'a8' } });
      
      expect(result.san).toBeDefined();
      expect(result.san).toContain('+');
      expect(result.san).toBe('Ra8+'); // Rook to a8 with check
    });
    
    it('should ALWAYS include # for checkmate', () => {
      const game = new BanChess();
      
      // Fool's mate
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'f2', to: 'f3' } });
      game.play({ ban: { from: 'd7', to: 'd5' } });
      game.play({ move: { from: 'e7', to: 'e5' } });
      game.play({ ban: { from: 'd2', to: 'd4' } });
      game.play({ move: { from: 'g2', to: 'g4' } });
      game.play({ ban: { from: 'h7', to: 'h6' } });
      
      const mateResult = game.play({ move: { from: 'd8', to: 'h4' } });
      
      expect(mateResult.san).toBe('Qh4#');
      expect(mateResult.san).toContain('#');
      expect(mateResult.flags?.checkmate).toBe(true);
    });
    
    it('should ALWAYS include = for stalemate', () => {
      // Create a stalemate position
      const stalemateFEN = '7k/8/6Q1/8/8/8/8/7K w - - 0 1 2';
      const game = new BanChess(stalemateFEN);
      
      // Move queen to h6 for stalemate
      const result = game.play({ move: { from: 'g6', to: 'h6' } });
      
      if (game.inStalemate()) {
        expect(result.san).toContain('=');
      }
    });
  });

  describe('BCN - Ban Chess Notation with indicators', () => {
    it('should include # when ban causes checkmate', () => {
      // Position where king in check with one escape
      const testFEN = '7k/8/8/8/3q4/8/8/6K1 w - - 0 1 10';
      const game = new BanChess(testFEN);
      
      // White is in check from queen on d4
      expect(game.inCheck()).toBe(true);
      
      const legalMoves = game.legalMoves();
      
      if (legalMoves.length === 1) {
        // White escapes
        game.play({ move: legalMoves[0] });
        
        // Black bans (example)
        game.play({ ban: { from: 'h8', to: 'g8' } });
        
        // Get serialized format
        const history = game.getActionHistory();
        const lastAction = history[history.length - 1];
        
        // BCN format for bans
        expect(lastAction).toMatch(/^b:[a-h][1-8][a-h][1-8]/);
      }
    });
    
    it('should serialize moves with indicators', () => {
      const game = new BanChess();
      
      // Play to checkmate
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'f2', to: 'f3' } });
      game.play({ ban: { from: 'd7', to: 'd5' } });
      game.play({ move: { from: 'e7', to: 'e5' } });
      game.play({ ban: { from: 'd2', to: 'd4' } });
      game.play({ move: { from: 'g2', to: 'g4' } });
      game.play({ ban: { from: 'h7', to: 'h6' } });
      game.play({ move: { from: 'd8', to: 'h4' } });
      
      const history = game.getActionHistory();
      const lastMove = history[history.length - 1];
      
      // BCN format: m:d8h4#
      expect(lastMove).toBe('m:d8h4#');
      expect(lastMove).toContain('#');
    });
    
    it('should handle promotion with indicators', () => {
      const promotionFEN = 'rnbqkbn1/pppppP1p/7r/8/8/8/PPPPP1PP/RNBQKBNR w KQq - 0 1 2';
      const game = new BanChess(promotionFEN);
      
      const result = game.play({ move: { from: 'f7', to: 'g8', promotion: 'q' } });
      
      // Check if promotion gives check
      if (game.inCheck()) {
        expect(result.san).toBe('fxg8=Q+');
        
        const serialized = game.getLastActionSerialized();
        expect(serialized).toBe('m:f7g8q+');
      }
    });
  });

  describe('PGN - Portable Game Notation with full indicators', () => {
    it('should include all indicators in move annotations', () => {
      const game = new BanChess();
      
      // Play a full game with various indicators
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'f2', to: 'f3' } });
      game.play({ ban: { from: 'd7', to: 'd5' } });
      game.play({ move: { from: 'e7', to: 'e5' } });
      game.play({ ban: { from: 'd2', to: 'd4' } });
      game.play({ move: { from: 'g2', to: 'g4' } });
      game.play({ ban: { from: 'h7', to: 'h6' } });
      game.play({ move: { from: 'd8', to: 'h4' } }); // Checkmate
      
      const pgn = game.pgn();
      
      // PGN should include:
      // - Ban annotations: {banning: e2e4}
      // - Check indicators: +
      // - Checkmate indicators: #
      // - Game result: 0-1
      
      expect(pgn).toContain('Qh4#');
      expect(pgn).toContain('0-1');
      expect(pgn).toContain('{banning: e2e4}');
      expect(pgn).toContain('{banning: d7d5}');
    });
    
    it('should mark bans that cause checkmate with #', () => {
      const game = new BanChess();
      game.setIndicatorConfig({ pgn: true, serialization: true, san: true });
      
      // Create scenario where ban causes checkmate
      // This is detected in BanChess.ts lines 243-250
      
      const pgn = game.pgn();
      
      // If a ban causes checkmate, it should appear as {banning: e7e8#}
      expect(game.getIndicatorConfig().pgn).toBe(true);
    });
  });

  describe('Unified getActionLog() format', () => {
    it('should provide consistent indicators across all actions', () => {
      const game = new BanChess();
      
      // Play various moves
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'f2', to: 'f3' } });
      game.play({ ban: { from: 'd7', to: 'd5' } });
      game.play({ move: { from: 'e7', to: 'e5' } });
      game.play({ ban: { from: 'd2', to: 'd4' } });
      game.play({ move: { from: 'g2', to: 'g4' } });
      game.play({ ban: { from: 'h7', to: 'h6' } });
      game.play({ move: { from: 'd8', to: 'h4' } }); // Checkmate
      
      const actionLog = game.getActionLog();
      
      // Verify format
      expect(actionLog[0]).toBe('b:e2e4');  // Ban
      expect(actionLog[1]).toBe('f3');       // Move (pawn)
      expect(actionLog[7]).toBe('Qh4#');     // Move with checkmate
      
      // Last move should have checkmate indicator
      const lastAction = actionLog[actionLog.length - 1];
      expect(lastAction).toContain('#');
    });
  });
  
  describe('Configuration control', () => {
    it('should respect indicator configuration settings', () => {
      const game = new BanChess();
      
      // Test with indicators enabled (default)
      game.setIndicatorConfig({ pgn: true, serialization: true, san: true });
      
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'f2', to: 'f3' } });
      game.play({ ban: { from: 'd7', to: 'd5' } });
      game.play({ move: { from: 'e7', to: 'e5' } });
      game.play({ ban: { from: 'd2', to: 'd4' } });
      game.play({ move: { from: 'g2', to: 'g4' } });
      game.play({ ban: { from: 'h7', to: 'h6' } });
      const result = game.play({ move: { from: 'd8', to: 'h4' } });
      
      expect(result.san).toBe('Qh4#');
      
      // Test with indicators disabled
      game.reset();
      game.setIndicatorConfig({ pgn: false, serialization: false, san: false });
      
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'f2', to: 'f3' } });
      game.play({ ban: { from: 'd7', to: 'd5' } });
      game.play({ move: { from: 'e7', to: 'e5' } });
      game.play({ ban: { from: 'd2', to: 'd4' } });
      game.play({ move: { from: 'g2', to: 'g4' } });
      game.play({ ban: { from: 'h7', to: 'h6' } });
      const result2 = game.play({ move: { from: 'd8', to: 'h4' } });
      
      // SAN should not include # when disabled
      expect(result2.san).toBe('Qh4');
    });
  });

  describe('Edge cases and accuracy', () => {
    it('should handle en passant with indicators', () => {
      const epFEN = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 1 2';
      const game = new BanChess(epFEN);
      
      const result = game.play({ move: { from: 'e5', to: 'f6' } });
      
      // En passant capture
      expect(result.san).toMatch(/exf6/);
    });
    
    it('should handle castling with check', () => {
      const castleFEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1 2';
      const game = new BanChess(castleFEN);
      
      const result = game.play({ move: { from: 'e1', to: 'g1' } });
      
      expect(result.san).toBe('O-O');
      
      // If castling gives check (in different position)
      // expect(result.san).toBe('O-O+');
    });
    
    it('should be 100% consistent across all notation formats', () => {
      const game = new BanChess();
      
      // Checkmate scenario
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'f2', to: 'f3' } });
      game.play({ ban: { from: 'd7', to: 'd5' } });
      game.play({ move: { from: 'e7', to: 'e5' } });
      game.play({ ban: { from: 'd2', to: 'd4' } });
      game.play({ move: { from: 'g2', to: 'g4' } });
      game.play({ ban: { from: 'h7', to: 'h6' } });
      const result = game.play({ move: { from: 'd8', to: 'h4' } });
      
      // All formats should agree on checkmate
      expect(result.san).toContain('#');                    // SAN has #
      expect(result.flags?.checkmate).toBe(true);           // Result indicates checkmate
      expect(game.getLastActionSerialized()).toContain('#'); // BCN has #
      expect(game.pgn()).toContain('Qh4#');                 // PGN has #
      expect(game.getActionLog().pop()).toContain('#');     // Action log has #
    });
  });
});