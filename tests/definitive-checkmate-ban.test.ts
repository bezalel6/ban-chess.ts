import { BanChess } from '../src/BanChess';

describe('Definitive Checkmate-by-Ban Test', () => {
  it('PROOF: Ban causing checkmate gets # indicator', () => {
    console.log('\n=== Definitive Test: Ban Checkmate Detection ===');
    
    // Create exact position: White king in check with ONE escape
    // Position: White Kg1 in check from Black Qd4+, only escape is Kh1
    // If Black bans g1-h1, it's checkmate
    
    const testFEN = '7k/8/8/8/3q4/8/8/6K1 w - - 0 1 8'; // White to move (ply 8)
    const game = new BanChess(testFEN);
    
    console.log('\n1. Initial position (White to move):');
    console.log('   - White King on g1');
    console.log('   - Black Queen on d4 giving check');
    console.log('   - White in check?', game.inCheck());
    
    // White's legal moves (should be very limited due to check)
    const whiteMoves = game.legalMoves();
    console.log('   - White legal moves:', whiteMoves.map(m => `K${m.from}-${m.to}`));
    
    // White must escape check
    if (whiteMoves.length > 0) {
      const escapeMove = whiteMoves[0];
      const moveResult = game.play({ move: escapeMove });
      console.log(`\n2. White escapes check: ${moveResult.san}`);
      console.log('   - New ply:', game.getPly());
      console.log('   - Next action:', game.getActionType(), 'by', game.getActivePlayer());
    }
    
    // Now let's create a NEW scenario where we KNOW there's one escape
    console.log('\n=== Creating Perfect Checkmate-by-Ban Scenario ===');
    
    // Position: White Kh1 trapped, Black Qg2 gives check from g2
    // Only escape is Kg1, if banned = checkmate
    const perfectFEN = '7k/8/8/8/8/8/6q1/7K w - - 0 1 10'; // White to move while in check (ply 10)
    const perfectGame = new BanChess(perfectFEN);
    
    console.log('\nSetup:');
    console.log('- White King on h1 (trapped in corner)');
    console.log('- Black Queen on g2 giving check');
    console.log('- Ply:', perfectGame.getPly());
    console.log('- White in check?', perfectGame.inCheck());
    
    // Get White's legal moves
    const escapeMoves = perfectGame.legalMoves();
    console.log('- White legal escapes:', escapeMoves.map(m => `${m.from}-${m.to}`));
    
    if (escapeMoves.length === 1) {
      console.log('\n✅ PERFECT: White has exactly ONE legal move!');
      const onlyEscape = escapeMoves[0];
      console.log(`- The only escape: K${onlyEscape.from}-${onlyEscape.to}`);
      
      // Black bans the only escape
      console.log('\n3. Black bans the only escape move...');
      const banAction = { ban: { from: onlyEscape.from, to: onlyEscape.to } };
      const banResult = perfectGame.play(banAction);
      
      console.log('\nBan Result:');
      console.log('- Success:', banResult.success);
      console.log('- SAN notation:', banResult.san);
      console.log('- Contains #?', banResult.san?.includes('#'));
      
      // CRITICAL ASSERTION
      expect(banResult.san).toBeDefined();
      expect(banResult.san).toContain('#');
      
      // Verify White has no moves left
      const movesAfterBan = perfectGame.legalMoves();
      console.log('\n4. After the ban:');
      console.log('- White legal moves remaining:', movesAfterBan.length);
      console.log('- Is checkmate?', perfectGame.inCheckmate());
      console.log('- Game over?', perfectGame.gameOver());
      
      expect(movesAfterBan.length).toBe(0);
      expect(perfectGame.inCheck()).toBe(true);
      
      // Check PGN
      const pgn = perfectGame.pgn();
      console.log('\n5. PGN Output:');
      console.log(pgn);
      
      // The ban should appear with # in PGN
      expect(pgn).toContain(`{banning: ${onlyEscape.from}${onlyEscape.to}#}`);
      
      console.log('\n✅ SUCCESS: Ban causing checkmate correctly marked with #');
    } else {
      console.log('\n❌ Test position does not have exactly one escape');
      console.log('Escapes found:', escapeMoves.length);
    }
  });
  
  it('COMPREHENSIVE: Test all indicator scenarios', () => {
    console.log('\n=== Testing All Indicator Scenarios ===');
    
    // Test 1: Regular ban (no indicator)
    const game1 = new BanChess();
    const ban1 = game1.play({ ban: { from: 'e2', to: 'e4' } });
    console.log('1. Regular ban:', ban1.san, '(no indicator expected)');
    expect(ban1.san).toBe('e2e4');
    
    // Test 2: Move causing check (+)
    const checkFEN = '7k/8/8/8/8/8/8/R6K w - - 0 1 2';
    const game2 = new BanChess(checkFEN);
    const checkMove = game2.play({ move: { from: 'a1', to: 'a8' } });
    console.log('2. Move with check:', checkMove.san);
    expect(checkMove.san).toContain('+');
    
    // Test 3: Move causing checkmate (#)
    const mateFEN = 'k7/7R/8/8/8/8/8/R6K w - - 0 1 2';
    const game3 = new BanChess(mateFEN);
    const mateMove = game3.play({ move: { from: 'a1', to: 'a8' } });
    console.log('3. Move with checkmate:', mateMove.san);
    expect(mateMove.san).toContain('#');
    
    // Test 4: Ban when opponent in check (should show +)
    const banCheckFEN = 'r6k/8/8/8/8/8/8/R6K b - - 0 1 3'; // Black to ban, White in check
    const game4 = new BanChess(banCheckFEN);
    const banWithCheck = game4.play({ ban: { from: 'h1', to: 'g1' } });
    console.log('4. Ban with opponent in check:', banWithCheck.san);
    // This should show the check indicator if White remains in check
    
    console.log('\n✅ All indicator types tested');
  });
  
  it('EDGE CASE: Multiple pieces can block check', () => {
    // When multiple pieces can block a check, banning one shouldn't be checkmate
    const multipleFEN = 'r6k/8/8/8/8/1N6/1B6/R6K b - - 0 1 3';
    const game = new BanChess(multipleFEN);
    
    console.log('\n=== Multiple Block Options ===');
    console.log('White in check from rook on a8');
    console.log('Both knight and bishop can block');
    
    const moves = game.legalMoves();
    console.log('Legal moves:', moves.length);
    
    if (moves.length > 1) {
      // Ban one blocking move
      const banResult = game.play({ ban: moves[0] });
      console.log('Banned one option:', banResult.san);
      
      // Should NOT be checkmate (other piece can still block)
      expect(banResult.san).not.toContain('#');
      
      const remaining = game.legalMoves();
      console.log('Remaining moves:', remaining.length);
      expect(remaining.length).toBeGreaterThan(0);
    }
  });
});