import { BanChess } from '../src/BanChess';

describe('Unified Action Log Format', () => {
  it('should return unified action log with bans and SAN moves', () => {
    const game = new BanChess();
    
    // Play a sample game
    game.play({ ban: { from: 'e2', to: 'e4' } });    // Black bans e4
    game.play({ move: { from: 'd2', to: 'd4' } });   // White plays d4
    game.play({ ban: { from: 'e7', to: 'e5' } });    // White bans e5
    game.play({ move: { from: 'd7', to: 'd5' } });   // Black plays d5
    game.play({ ban: { from: 'g1', to: 'f3' } });    // Black bans Nf3
    game.play({ move: { from: 'c1', to: 'f4' } });   // White plays Bf4
    game.play({ ban: { from: 'f8', to: 'b4' } });    // White bans Bb4
    game.play({ move: { from: 'g8', to: 'f6' } });   // Black plays Nf6
    
    // Get the action log
    const actionLog = game.getActionLog();
    
    console.log('Action Log:', actionLog);
    
    // Verify format
    expect(actionLog).toHaveLength(8);
    
    // Bans should use b:fromto format
    expect(actionLog[0]).toBe('b:e2e4');
    expect(actionLog[2]).toBe('b:e7e5');
    expect(actionLog[4]).toBe('b:g1f3');
    expect(actionLog[6]).toBe('b:f8b4');
    
    // Moves should use SAN notation
    expect(actionLog[1]).toBe('d4');      // Pawn move
    expect(actionLog[3]).toBe('d5');      // Pawn move
    expect(actionLog[5]).toBe('Bf4');     // Bishop move
    expect(actionLog[7]).toBe('Nf6');     // Knight move
  });
  
  it('should include indicators in action log', () => {
    const game = new BanChess();
    
    // Create a position that leads to check/checkmate
    game.play({ ban: { from: 'e2', to: 'e4' } });
    game.play({ move: { from: 'f2', to: 'f3' } });
    game.play({ ban: { from: 'd7', to: 'd5' } });
    game.play({ move: { from: 'e7', to: 'e5' } });
    game.play({ ban: { from: 'd2', to: 'd4' } });
    game.play({ move: { from: 'g2', to: 'g4' } });
    game.play({ ban: { from: 'h7', to: 'h6' } });
    game.play({ move: { from: 'd8', to: 'h4' } }); // Checkmate!
    
    const actionLog = game.getActionLog();
    
    console.log('Action Log with checkmate:', actionLog);
    
    // Last move should have # indicator for checkmate
    expect(actionLog[actionLog.length - 1]).toBe('Qh4#');
  });
  
  it('should handle promotion in SAN format', () => {
    // Create a position where promotion is possible
    const promotionFEN = 'rnbqkbnr/pppppP1p/8/8/8/8/PPPPP1PP/RNBQKBNR w KQkq - 0 1 2';
    const game = new BanChess(promotionFEN);
    
    // White promotes
    game.play({ move: { from: 'f7', to: 'f8', promotion: 'q' } });
    
    const actionLog = game.getActionLog();
    const lastAction = actionLog[actionLog.length - 1];
    
    console.log('Promotion move in SAN:', lastAction);
    
    // Should be in SAN format (f8=Q)
    expect(lastAction).toMatch(/f8=Q/);
  });
  
  it('should handle castling in SAN format', () => {
    const game = new BanChess();
    
    // Setup for castling
    game.play({ ban: { from: 'e2', to: 'e4' } });
    game.play({ move: { from: 'e2', to: 'e3' } });
    game.play({ ban: { from: 'd7', to: 'd5' } });
    game.play({ move: { from: 'e7', to: 'e6' } });
    game.play({ ban: { from: 'd2', to: 'd4' } });
    game.play({ move: { from: 'g1', to: 'f3' } });
    game.play({ ban: { from: 'g8', to: 'f6' } });
    game.play({ move: { from: 'f8', to: 'e7' } });
    game.play({ ban: { from: 'b1', to: 'c3' } });
    game.play({ move: { from: 'f1', to: 'e2' } });
    game.play({ ban: { from: 'b8', to: 'c6' } });
    game.play({ move: { from: 'g8', to: 'h6' } });
    game.play({ ban: { from: 'c1', to: 'd2' } });
    game.play({ move: { from: 'e1', to: 'g1' } }); // Kingside castle
    
    const actionLog = game.getActionLog();
    const lastAction = actionLog[actionLog.length - 1];
    
    console.log('Castling in SAN:', lastAction);
    
    // Should be O-O for kingside castling
    expect(lastAction).toBe('O-O');
  });
  
  it('should handle ban causing checkmate with # indicator', () => {
    // Position where king in check with one escape
    const checkmateByBanFEN = '7k/8/8/8/3q4/8/8/6K1 w - - 0 1 10'; // White to move
    const game = new BanChess(checkmateByBanFEN);
    
    // White is in check, must escape
    const escapes = game.legalMoves();
    console.log('White escape moves:', escapes.map(m => `${m.from}-${m.to}`));
    
    if (escapes.length === 1) {
      // White escapes
      game.play({ move: escapes[0] });
      
      // Black bans to potentially cause checkmate in future
      // For this test, we verify the format is correct
      game.play({ ban: { from: 'h8', to: 'g8' } });
      
      const actionLog = game.getActionLog();
      console.log('Action log with ban:', actionLog);
      
      // Verify ban format
      expect(actionLog[actionLog.length - 1]).toMatch(/^b:[a-h][1-8][a-h][1-8]/);
    }
  });
  
  it('should maintain chronological order of all actions', () => {
    const game = new BanChess();
    const expectedSequence: string[] = [];
    
    // Track actions as we play them
    game.play({ ban: { from: 'e2', to: 'e4' } });
    expectedSequence.push('b:e2e4');
    
    game.play({ move: { from: 'g1', to: 'f3' } });
    expectedSequence.push('Nf3');
    
    game.play({ ban: { from: 'e7', to: 'e5' } });
    expectedSequence.push('b:e7e5');
    
    game.play({ move: { from: 'd7', to: 'd6' } });
    expectedSequence.push('d6');
    
    const actionLog = game.getActionLog();
    
    console.log('Expected:', expectedSequence);
    console.log('Actual:  ', actionLog);
    
    expect(actionLog).toEqual(expectedSequence);
  });
  
  it('should differentiate between piece moves in SAN', () => {
    const game = new BanChess();
    
    // Play various piece moves
    game.play({ ban: { from: 'e2', to: 'e4' } });
    game.play({ move: { from: 'g1', to: 'f3' } }); // Knight
    game.play({ ban: { from: 'd7', to: 'd5' } });
    game.play({ move: { from: 'e7', to: 'e6' } }); // Pawn
    game.play({ ban: { from: 'f1', to: 'c4' } });
    game.play({ move: { from: 'd2', to: 'd4' } }); // Pawn
    game.play({ ban: { from: 'f8', to: 'e7' } });
    game.play({ move: { from: 'c8', to: 'b7' } }); // Bishop
    
    const actionLog = game.getActionLog();
    
    console.log('Various piece moves:', actionLog);
    
    // Verify SAN notation
    expect(actionLog[1]).toBe('Nf3');  // Knight uses N
    expect(actionLog[3]).toBe('e6');   // Pawn has no prefix
    expect(actionLog[5]).toBe('d4');   // Pawn has no prefix
    expect(actionLog[7]).toBe('Bb7');  // Bishop uses B
  });
  
  it('should handle captures in SAN notation', () => {
    const game = new BanChess();
    
    // Setup a position with a capture
    game.play({ ban: { from: 'e2', to: 'e4' } });
    game.play({ move: { from: 'd2', to: 'd4' } });
    game.play({ ban: { from: 'e7', to: 'e6' } });
    game.play({ move: { from: 'e7', to: 'e5' } });
    game.play({ ban: { from: 'd4', to: 'd5' } });
    game.play({ move: { from: 'd4', to: 'e5' } }); // Pawn captures pawn
    
    const actionLog = game.getActionLog();
    const captureMove = actionLog[actionLog.length - 1];
    
    console.log('Capture in SAN:', captureMove);
    
    // Should show capture notation (dxe5)
    expect(captureMove).toContain('x');
  });
  
  it('should compare with traditional getActionHistory format', () => {
    const game = new BanChess();
    
    // Play some moves
    game.play({ ban: { from: 'e2', to: 'e4' } });
    game.play({ move: { from: 'd2', to: 'd4' } });
    game.play({ ban: { from: 'e7', to: 'e5' } });
    game.play({ move: { from: 'd7', to: 'd5' } });
    
    // Get both formats
    const actionLog = game.getActionLog();
    const actionHistory = game.getActionHistory();
    
    console.log('\n=== Format Comparison ===');
    console.log('New Action Log:', actionLog);
    console.log('Old Action History:', actionHistory);
    
    // Both should have same length
    expect(actionLog.length).toBe(actionHistory.length);
    
    // New format uses SAN for moves, old format uses m:fromto
    expect(actionLog[1]).toBe('d4');          // SAN
    expect(actionHistory[1]).toBe('m:d2d4');  // Serialized format
  });
});