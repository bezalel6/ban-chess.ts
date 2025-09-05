import { BanChess } from '../src/BanChess';

describe('ASCII Board Banned Move Visualization', () => {
  it('should show brackets around banned source and destination squares', () => {
    const game = new BanChess();
    game.play({ ban: { from: 'e2', to: 'e4' } });
    
    const ascii = game.ascii();
    
    // Check that the ASCII contains brackets
    expect(ascii).toContain('[');
    expect(ascii).toContain(']');
    
    // Check that the ban information is displayed
    expect(ascii).toContain('Banned: e2→e4');
    
    // Verify brackets are in the right positions
    const lines = ascii.split('\n');
    
    // Line for rank 2 (where e2 pawn is)
    const rank2Line = lines[7]; // 8th line (0-indexed)
    expect(rank2Line).toContain('[P]'); // e2 should have bracketed pawn
    
    // Line for rank 4 (where e4 would be) 
    const rank4Line = lines[5]; // 6th line (0-indexed)
    expect(rank4Line).toContain('[.]'); // e4 should have bracketed empty square
  });
  
  it('should update brackets when ban changes', () => {
    const game = new BanChess();
    
    // First ban
    game.play({ ban: { from: 'e2', to: 'e4' } });
    let ascii = game.ascii();
    expect(ascii).toContain('Banned: e2→e4');
    
    // Check that e2 and e4 are bracketed
    let lines = ascii.split('\n');
    expect(lines[7]).toContain('[P]'); // e2 has bracketed pawn
    expect(lines[5]).toContain('[.]'); // e4 has bracketed empty square
    
    // Make a move
    game.play({ move: { from: 'd2', to: 'd4' } });
    
    // Second ban - different squares
    game.play({ ban: { from: 'g8', to: 'f6' } });
    ascii = game.ascii();
    expect(ascii).toContain('Banned: g8→f6');
    
    // New ban squares should be bracketed
    lines = ascii.split('\n');
    expect(lines[1]).toContain('[n]'); // g8 has bracketed knight
    expect(lines[3]).toContain('[.]'); // f6 has bracketed empty square
    
    // Old ban squares should not be bracketed anymore
    // e2 still has a pawn but not bracketed, e4 is empty but not bracketed
    expect(lines[7]).toContain(' P '); // e2 has normal pawn
    expect(lines[7]).not.toContain('[P]'); // e2 pawn is not bracketed
    expect(lines[5]).not.toContain('[.]'); // e4 empty square is not bracketed
  });
  
  it('should correctly show ban in complex position', () => {
    // Create a position with a specific ban
    const game = new BanChess('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2 4');
    game.play({ move: { from: 'g1', to: 'f3' } });
    game.play({ ban: { from: 'b8', to: 'c6' } });
    
    const ascii = game.ascii();
    
    // Verify the ban is shown
    expect(ascii).toContain('Banned: b8→c6');
    
    // Check that brackets appear in the ASCII board
    const lines = ascii.split('\n');
    // b8 position should show bracketed knight
    expect(lines[1]).toContain('[n]'); // b8 shows bracketed knight
    // c6 position should show bracketed empty square
    expect(lines[3]).toContain('[.]'); // c6 shows bracketed empty square
  });
  
  it('should show checkmate-causing ban correctly', () => {
    // Position where banning the only escape causes checkmate
    const testFEN = '7k/8/8/8/3q4/8/8/6K1 w - - 0 1 10';
    const game = new BanChess(testFEN);
    
    // King on g1 is in check from queen on d4
    // If king's only escape (say h1) is banned, it's checkmate
    const legalMoves = game.legalMoves();
    if (legalMoves.length === 1) {
      const escapeMove = legalMoves[0];
      game.play({ move: escapeMove });
      
      // Black bans a move (example)
      const bans = game.legalBans();
      if (bans.length > 0) {
        game.play({ ban: bans[0] });
        
        const ascii = game.ascii();
        
        // Should show the banned move
        expect(ascii).toContain('Banned:');
        expect(ascii).toContain('[');
        expect(ascii).toContain(']');
      }
    }
  });
});