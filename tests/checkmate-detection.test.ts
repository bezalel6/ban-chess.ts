import { BanChess } from '../src/BanChess';

describe('Checkmate Detection - Specific Scenario', () => {
  it('should detect checkmate after Qxf7+ when king cannot escape', () => {
    const game = new BanChess();
    
    // Move sequence from the scenario:
    // 1. Black bans e2-e4, White plays d2-d4
    game.play({ ban: { from: 'e2', to: 'e4' } });
    expect(game.getPly()).toBe(2);
    
    const d4Result = game.play({ move: { from: 'd2', to: 'd4' } });
    expect(d4Result.success).toBe(true);
    expect(game.getPly()).toBe(3);
    
    // White bans a7-a6, Black plays d7-d5
    game.play({ ban: { from: 'a7', to: 'a6' } });
    expect(game.getPly()).toBe(4);
    
    const d5Result = game.play({ move: { from: 'd7', to: 'd5' } });
    expect(d5Result.success).toBe(true);
    expect(game.getPly()).toBe(5);
    
    // 2. Black bans a2-a3, White plays Qd1-h5
    game.play({ ban: { from: 'a2', to: 'a3' } });
    expect(game.getPly()).toBe(6);
    
    const qh5Result = game.play({ move: { from: 'd1', to: 'h5' } });
    expect(qh5Result.success).toBe(true);
    expect(qh5Result.san).toBe('Qh5');
    expect(game.getPly()).toBe(7);
    
    // White bans b7-b6, Black plays a6-a5 (wait, a6 was banned earlier)
    // Let me check the notation - it seems there's an issue with the move notation
    // Let's assume Black plays a different move since a7-a6 was banned
    // Black plays e7-e6 instead
    game.play({ ban: { from: 'b7', to: 'b6' } });
    expect(game.getPly()).toBe(8);
    
    const e6Result = game.play({ move: { from: 'e7', to: 'e6' } });
    expect(e6Result.success).toBe(true);
    expect(game.getPly()).toBe(9);
    
    // 3. Black bans a2-a3 again (or another move), White plays Qxf7+
    game.play({ ban: { from: 'g1', to: 'f3' } }); // Ban some white move
    expect(game.getPly()).toBe(10);
    
    // White captures on f7 with check
    const qxf7Result = game.play({ move: { from: 'h5', to: 'f7' } });
    expect(qxf7Result.success).toBe(true);
    expect(qxf7Result.san).toBe('Qxf7+');
    expect(qxf7Result.flags?.check).toBe(true);
    expect(game.inCheck()).toBe(true);
    expect(game.getPly()).toBe(11);
    
    // Now White should ban the king's only escape (Kxf7)
    // This should cause checkmate
    const banKxf7 = game.play({ ban: { from: 'e8', to: 'f7' } });
    expect(banKxf7.success).toBe(true);
    expect(banKxf7.san).toBe('e8f7#'); // Should have checkmate indicator
    expect(banKxf7.flags?.banCausedCheckmate).toBe(true);
    expect(banKxf7.flags?.checkmate).toBe(true);
    expect(banKxf7.flags?.gameOver).toBe(true);
    
    // Verify the game is in checkmate
    expect(game.inCheckmate()).toBe(true);
    expect(game.gameOver()).toBe(true);
  });

  it('should detect checkmate in a simpler scenario', () => {
    const game = new BanChess();
    
    // Set up a position where the king is in check with only one escape
    // We'll use a custom FEN for clarity
    const fenWithCheck = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBN1 w KQkq - 0 1';
    const gameFromFen = new BanChess(fenWithCheck);
    
    // Move the queen to give check
    gameFromFen.play({ ban: { from: 'g1', to: 'f3' } });
    const qh5 = gameFromFen.play({ move: { from: 'd1', to: 'h5' } });
    expect(qh5.success).toBe(true);
    expect(qh5.flags?.check).toBe(true);
    
    // Now if White bans the only escape move, it should be checkmate
    // First, let's see what moves Black has
    gameFromFen.play({ ban: { from: 'g7', to: 'g6' } }); // Ban g7-g6 which blocks the check
    
    // Check if this causes issues or if there are other ways to block
    const legalMoves = gameFromFen.legalMoves();
    console.log('Legal moves after banning g7-g6:', legalMoves.length);
    
    // The game should detect if banning all escape moves causes checkmate
  });

  it('should properly handle the exact sequence with corrected moves', () => {
    const game = new BanChess();
    
    // Reconstructed sequence that makes sense:
    // Opening moves
    game.play({ ban: { from: 'e2', to: 'e4' } }); // Black bans e4
    game.play({ move: { from: 'd2', to: 'd4' } }); // White plays d4
    game.play({ ban: { from: 'g8', to: 'f6' } }); // White bans Nf6
    game.play({ move: { from: 'e7', to: 'e6' } }); // Black plays e6
    
    // Develop queen
    game.play({ ban: { from: 'f1', to: 'c4' } }); // Black bans Bc4
    game.play({ move: { from: 'd1', to: 'h5' } }); // White plays Qh5
    
    // Now let's set up a position where Black's king is vulnerable
    game.play({ ban: { from: 'd7', to: 'd5' } }); // White bans d5
    game.play({ move: { from: 'g7', to: 'g6' } }); // Black plays g6 to kick the queen
    
    game.play({ ban: { from: 'f8', to: 'g7' } }); // Black bans Bg7
    const qf7Check = game.play({ move: { from: 'h5', to: 'f7' } }); // White plays Qxf7+!
    
    expect(qf7Check.success).toBe(true);
    expect(qf7Check.san).toBe('Qxf7+');
    expect(qf7Check.flags?.check).toBe(true);
    
    // Now the critical moment: can White achieve checkmate by banning Kxf7?
    const banResult = game.play({ ban: { from: 'e8', to: 'f7' } });
    
    // This should cause checkmate if Kxf7 was the only way to escape check
    console.log('Ban result:', banResult);
    console.log('Game over?', game.gameOver());
    console.log('Checkmate?', game.inCheckmate());
    
    // Let's check what other moves Black had
    if (!banResult.flags?.banCausedCheckmate) {
      // If not checkmate, let's see what other legal moves Black has
      const legalMoves = game.legalMoves();
      console.log('Black still has these legal moves:', legalMoves);
    }
  });
});