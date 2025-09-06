import { BanChess } from '../src/BanChess';

describe('ASCII Board Checkmate Visualization', () => {
  it('should show the position from the scenario', () => {
    const game = new BanChess();
    
    console.log('\n=== Initial Position ===');
    console.log(game.ascii());
    
    // Play the sequence from your scenario
    // Move 1: Black bans e2-e4, White plays d2-d4
    game.play({ ban: { from: 'e2', to: 'e4' } });
    console.log('\n=== After Black bans e2-e4 ===');
    console.log(game.ascii());
    
    game.play({ move: { from: 'd2', to: 'd4' } });
    console.log('\n=== After White plays d2-d4 ===');
    console.log(game.ascii());
    
    // White bans a7-a6, Black plays d7-d5
    game.play({ ban: { from: 'a7', to: 'a6' } });
    game.play({ move: { from: 'd7', to: 'd5' } });
    
    // Move 2: Black bans a2-a3, White plays Qd1-h5
    game.play({ ban: { from: 'a2', to: 'a3' } });
    game.play({ move: { from: 'd1', to: 'h5' } });
    console.log('\n=== After White plays Qh5 ===');
    console.log(game.ascii());
    
    // White bans b7-b6, Black plays e7-e6 
    game.play({ ban: { from: 'b7', to: 'b6' } });
    game.play({ move: { from: 'e7', to: 'e6' } });
    
    // Move 3: Black bans something, White plays Qxf7+
    game.play({ ban: { from: 'c1', to: 'f4' } });
    const qxf7 = game.play({ move: { from: 'h5', to: 'f7' } });
    
    console.log('\n=== After White plays Qxf7+ ===');
    console.log(game.ascii());
    console.log('Move result:', qxf7.san, 'Check?', qxf7.flags?.check);
    console.log('Is Black in check?', game.inCheck());
    
    // Now let's see if White can ban Kxf7 to cause checkmate
    const bans = game.legalBans();
    console.log('\nBlack moves White can ban:', bans.map(b => `${b.from}-${b.to}`));
    
    const kxf7Ban = bans.find(b => b.from === 'e8' && b.to === 'f7');
    if (kxf7Ban) {
      console.log('\n=== White bans Kxf7 ===');
      const banResult = game.play({ ban: kxf7Ban });
      console.log(game.ascii());
      console.log('Ban result:', banResult.san);
      console.log('Ban caused checkmate?', banResult.flags?.banCausedCheckmate);
      console.log('Game over?', game.gameOver());
    }
  });

  it('should visualize a simple checkmate position', () => {
    // Queen gives check, king has one escape
    const fenWithCheck = 'rnbqkbnr/pppppQpp/8/8/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1';
    const game = new BanChess(fenWithCheck);
    
    console.log('\n=== Queen on f7 giving check ===');
    console.log(game.ascii());
    console.log('Black is in check?', game.inCheck());
    console.log('Black is in checkmate?', game.inCheckmate());
    
    // Black bans, then moves
    game.play({ ban: { from: 'f7', to: 'e8' } });
    console.log('\n=== After Black bans Qxe8 ===');
    console.log(game.ascii());
    
    const moves = game.legalMoves();
    console.log('Black legal moves:', moves.map(m => `${m.from}-${m.to}`));
    
    if (moves.length > 0) {
      game.play({ move: moves[0] });
      console.log('\n=== After Black escapes ===');
      console.log(game.ascii());
    }
  });

  it('should visualize corner checkmate', () => {
    // King in corner, rook gives check
    const cornerMate = '7k/6R1/8/8/8/8/8/7K b - - 0 1';
    const game = new BanChess(cornerMate);
    
    console.log('\n=== Corner position - Rook gives check ===');
    console.log(game.ascii());
    console.log('Black king in check?', game.inCheck());
    
    // Black must ban
    game.play({ ban: { from: 'g7', to: 'g8' } });
    console.log('\n=== After Black bans Rg8# ===');
    console.log(game.ascii());
    
    // Check Black's options
    const escapes = game.legalMoves();
    console.log('Black escape moves:', escapes.map(m => `${m.from}-${m.to}`));
    
    if (escapes.length === 0) {
      console.log('No escape moves available - this is already checkmate!');
      console.log('Is checkmate?', game.inCheckmate());
    }
  });

  it('should test the exact failing scenario step by step', () => {
    // Let's build up to a position where Qxf7+ is possible
    const game = new BanChess();
    
    // Quick scholar's mate attempt
    game.play({ ban: { from: 'e2', to: 'e4' } }); // Black bans e4
    game.play({ move: { from: 'e2', to: 'e3' } }); // White plays e3
    game.play({ ban: { from: 'f1', to: 'c4' } }); // White bans Bc4  
    game.play({ move: { from: 'e7', to: 'e5' } }); // Black plays e5
    game.play({ ban: { from: 'd2', to: 'd4' } }); // Black bans d4
    game.play({ move: { from: 'f1', to: 'c4' } }); // White plays Bc4
    game.play({ ban: { from: 'g8', to: 'f6' } }); // White bans Nf6
    game.play({ move: { from: 'f7', to: 'f6' } }); // Black weakens with f6
    
    console.log('\n=== Position before Qh5+ ===');
    console.log(game.ascii());
    
    game.play({ ban: { from: 'b8', to: 'c6' } }); // Black bans Nc6
    const qh5 = game.play({ move: { from: 'd1', to: 'h5' } }); // White plays Qh5+
    
    console.log('\n=== After Qh5+ ===');
    console.log(game.ascii());
    console.log('Move:', qh5.san, 'Check?', qh5.flags?.check);
    console.log('Black in check?', game.inCheck());
    
    if (game.inCheck()) {
      // White's turn to ban
      const blackMoves = game.legalBans();
      console.log('Black moves that can be banned:', blackMoves.map(m => `${m.from}-${m.to}`));
      
      // Look for critical moves
      const g6Move = blackMoves.find(m => m.from === 'g7' && m.to === 'g6');
      const keMove = blackMoves.find(m => m.from === 'e8' && m.to === 'e7');
      
      if (g6Move) {
        console.log('\n=== White bans g7-g6 ===');
        const banResult = game.play({ ban: g6Move });
        console.log(game.ascii());
        console.log('After banning g6, is it checkmate?', banResult.flags?.banCausedCheckmate);
        
        if (!game.gameOver()) {
          const remainingMoves = game.legalMoves();
          console.log('Black still has:', remainingMoves.map(m => `${m.from}-${m.to}`));
        }
      }
    }
  });
});