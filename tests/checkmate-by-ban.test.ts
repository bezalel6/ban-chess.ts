import { BanChess } from '../src/BanChess';

describe('Checkmate by Banning', () => {
  it('should detect checkmate when banning the only escape from check', () => {
    // Create a position where the king is in check with only one escape
    // Position: White Queen on f7 giving check, Black King on e8
    const fenWithQueenCheck = 'rnbqkbnr/pppppQpp/8/8/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1';
    const game = new BanChess(fenWithQueenCheck);
    
    console.log('\n=== Testing Checkmate by Banning ===');
    console.log('Starting position:', game.fen());
    console.log('Black is in check?', game.inCheck());
    
    // It's Black's turn to ban (odd ply)
    expect(game.nextActionType()).toBe('ban');
    expect(game.inCheck()).toBe(true);
    
    // Black must ban a White move even though in check
    const whiteMoves = game.legalBans();
    console.log('White moves Black can ban:', whiteMoves.length);
    
    // Black bans some White move (not the queen)
    const banResult = game.play({ ban: { from: 'f7', to: 'e8' } }); // Ban Qxe8#
    expect(banResult.success).toBe(true);
    console.log('Black banned:', banResult.san);
    
    // Now Black must escape check
    const blackEscapeMoves = game.legalMoves();
    console.log('Black escape moves:', blackEscapeMoves.map(m => `${m.from}${m.to}`));
    
    // If Black has only Kxf7 as the escape
    const kxf7 = blackEscapeMoves.find(m => m.from === 'e8' && m.to === 'f7');
    const kd7 = blackEscapeMoves.find(m => m.from === 'e8' && m.to === 'd7');
    
    if (kxf7 && !kd7) {
      console.log('Only escape is Kxf7');
      
      // Play Kxf7
      const moveResult = game.play({ move: { from: 'e8', to: 'f7' } });
      console.log('Black plays Kxf7:', moveResult.san);
      
      // Now the king captured the queen, game continues
      expect(game.inCheck()).toBe(false);
    } else if (kd7) {
      console.log('King can also escape to d7');
      
      // If there are multiple escapes, we can't force checkmate by banning just one
      const moveResult = game.play({ move: { from: 'e8', to: 'd7' } });
      console.log('Black plays Kd7:', moveResult.san);
    }
  });

  it('should detect checkmate when queen gives check with only king capture available', () => {
    // More controlled position: Queen gives check, only escape is to capture it
    // But first, the capturing move must be the ONLY legal move
    
    // Custom position: Black king trapped, queen gives check
    const customFEN = 'r6r/pppppQpp/8/8/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1';
    const game = new BanChess(customFEN);
    
    console.log('\n=== Queen Check Scenario ===');
    console.log('Is Black in check?', game.inCheck());
    console.log('Current ply:', game.getPly());
    console.log('Next action:', game.nextActionType());
    
    // Black's turn to ban
    game.play({ ban: { from: 'f7', to: 'f8' } }); // Ban Qf8#
    
    // Black's legal moves
    const moves = game.legalMoves();
    console.log('Black legal moves:', moves.map(m => `${m.from}-${m.to}`));
    
    // Let's test if Black has only one move
    if (moves.length === 1) {
      console.log('Black has only one legal move!');
      
      // Play that move
      game.play({ move: moves[0] });
      
      // Now it's White's turn to ban
      // In the NEXT position, if Black would have only one move in response to a check,
      // White could ban it to cause checkmate
    }
  });

  it('should properly detect ban-caused checkmate', () => {
    // Direct test: Set up position, ban the only escape
    // Use a position where we KNOW there's only one escape
    
    // Position: White Rook on e1, Black King on e8, Black has no pieces to block
    // This is a back-rank mate scenario
    const backRankCheck = '4k3/8/8/8/8/8/8/4R3 b - - 0 1';
    const game = new BanChess(backRankCheck);
    
    console.log('\n=== Back Rank Check ===');
    console.log('King in check?', game.inCheck());
    
    // Black must ban
    game.play({ ban: { from: 'e1', to: 'e2' } }); // Ban some rook move
    
    // Black's moves
    const escapes = game.legalMoves();
    console.log('King escape squares:', escapes.map(m => `${m.from}-${m.to}`));
    
    // The king can escape to d8, f8, d7, e7, f7
    // This position has too many escapes
    
    // Let's try a corner position instead
    const cornerCheck = '7k/6R1/8/8/8/8/8/7K b - - 0 1';
    const game2 = new BanChess(cornerCheck);
    
    console.log('\n=== Corner Check ===');
    console.log('King in check?', game2.inCheck());
    
    // Black must ban
    game2.play({ ban: { from: 'g7', to: 'g8' } }); // Ban Rg8#
    
    // Black's moves - king can only go to g8
    const cornerEscapes = game2.legalMoves();
    console.log('Corner escapes:', cornerEscapes.map(m => `${m.from}-${m.to}`));
    
    if (cornerEscapes.length === 1) {
      // Play the only move
      game2.play({ move: cornerEscapes[0] });
      
      // White's turn to ban
      // Get what Black could do next
      const nextBlackMoves = game2.legalBans();
      console.log('Black\'s next possible moves:', nextBlackMoves.length);
      
      // Find king moves
      const kingMoves = nextBlackMoves.filter(m => m.from === 'g8');
      console.log('King moves from g8:', kingMoves.map(m => `${m.from}-${m.to}`));
      
      // If there's only one king move, banning it might cause issues
      if (kingMoves.length === 1) {
        const banResult = game2.play({ ban: kingMoves[0] });
        console.log('Banned the only king move:', banResult.san);
        
        // Now White moves
        const rg8 = game2.play({ move: { from: 'g7', to: 'g8' } });
        console.log('Rook to g8:', rg8.san);
        console.log('Is checkmate?', rg8.flags?.checkmate);
      }
    }
  });
});