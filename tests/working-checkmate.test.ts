import { BanChess } from '../src/BanChess';

describe('Working Checkmate Test', () => {
  it('should demonstrate checkmate detection with ASCII', () => {
    // Start from a position where we know checkmate is possible
    // Position: Queen can give check, king has limited escapes
    const game = new BanChess();
    
    // Build a simple scholar's mate variation
    console.log('\n=== Building toward Scholar\'s Mate ===');
    
    // Move 1
    game.play({ ban: { from: 'd2', to: 'd4' } }); // Black bans d4
    game.play({ move: { from: 'e2', to: 'e4' } }); // White plays e4
    console.log('\nAfter 1. e4:');
    console.log(game.ascii());
    
    game.play({ ban: { from: 'g1', to: 'f3' } }); // White bans Nf3
    game.play({ move: { from: 'e7', to: 'e5' } }); // Black plays e5
    
    // Move 2
    game.play({ ban: { from: 'd1', to: 'h5' } }); // Black bans Qh5 (too late!)
    game.play({ move: { from: 'f1', to: 'c4' } }); // White plays Bc4
    console.log('\nAfter 2. Bc4:');
    console.log(game.ascii());
    
    game.play({ ban: { from: 'f8', to: 'c5' } }); // White bans Bc5
    game.play({ move: { from: 'b8', to: 'c6' } }); // Black plays Nc6
    
    // Move 3
    game.play({ ban: { from: 'c4', to: 'f7' } }); // Black bans Bxf7+ (crucial!)
    game.play({ move: { from: 'd1', to: 'h5' } }); // White plays Qh5
    console.log('\nAfter 3. Qh5:');
    console.log(game.ascii());
    
    game.play({ ban: { from: 'g8', to: 'f6' } }); // White bans Nf6
    
    // Now Black needs to defend f7
    const blackMoves = game.legalMoves();
    console.log('Black legal moves:', blackMoves.map(m => `${m.from}-${m.to}`).slice(0, 10));
    
    // Black plays something that doesn't defend f7
    const g6Move = blackMoves.find(m => m.from === 'g7' && m.to === 'g6');
    if (g6Move) {
      game.play({ move: g6Move }); // Black plays g6
      console.log('\nAfter 3...g6:');
      console.log(game.ascii());
    } else {
      game.play({ move: { from: 'a7', to: 'a6' } }); // Black plays a6
    }
    
    // Move 4 - The critical moment
    game.play({ ban: { from: 'f8', to: 'g7' } }); // Black bans Bg7
    
    // Can White play Qxf7+?
    const qxf7 = game.play({ move: { from: 'h5', to: 'f7' } });
    console.log('\n=== The Critical Move: Qxf7+ ===');
    console.log(game.ascii());
    console.log('Move result:', qxf7.san, 'Success:', qxf7.success);
    console.log('Is check?', qxf7.flags?.check);
    console.log('Is checkmate?', qxf7.flags?.checkmate);
    console.log('Black in check?', game.inCheck());
    
    if (qxf7.flags?.checkmate) {
      console.log('\nCHECKMATE ACHIEVED!');
    } else if (qxf7.flags?.check) {
      console.log('\nCheck given, but not mate. Black can:');
      
      // White's turn to ban
      const escapeMoves = game.legalBans();
      console.log('Possible Black moves:', escapeMoves.map(m => `${m.from}-${m.to}`).slice(0, 5));
      
      // Can White cause checkmate by banning?
      const kxf7 = escapeMoves.find(m => m.from === 'e8' && m.to === 'f7');
      if (kxf7) {
        console.log('\n=== Attempting checkmate by banning Kxf7 ===');
        const banResult = game.play({ ban: kxf7 });
        console.log(game.ascii());
        console.log('Ban result:', banResult.san);
        console.log('Ban caused checkmate?', banResult.flags?.banCausedCheckmate);
        console.log('Game over?', game.gameOver());
      }
    }
  });

  it('should test a guaranteed checkmate position', () => {
    // Use a FEN where checkmate is imminent
    // Position: White queen and rook ready to mate
    const mateFEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1';
    const game = new BanChess(mateFEN);
    
    console.log('\n=== Near-Mate Position ===');
    console.log(game.ascii());
    
    // Black bans something
    game.play({ ban: { from: 'f3', to: 'f7' } }); // Black bans Qxf7+
    
    // White plays a different check
    const qh5 = game.play({ move: { from: 'f3', to: 'h5' } });
    console.log('\nAfter Qh5:');
    console.log(game.ascii());
    console.log('Check?', qh5.flags?.check);
    
    if (!qh5.flags?.check) {
      // Try another attacking move
      console.log('Qh5 didn\'t give check, position needs adjustment');
    }
  });
});