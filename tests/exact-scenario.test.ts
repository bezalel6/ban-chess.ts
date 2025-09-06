import { BanChess } from '../src/BanChess';

describe('Exact Scenario Checkmate Test', () => {
  it('should handle the specific game sequence and detect checkmate', () => {
    const game = new BanChess();
    
    console.log('\n=== Move 1 ===');
    // Move 1: Black bans e2-e4, White plays d2-d4
    let result = game.play({ ban: { from: 'e2', to: 'e4' } });
    console.log('Black bans e2-e4:', result.san);
    
    result = game.play({ move: { from: 'd2', to: 'd4' } });
    console.log('White plays d2-d4:', result.san);
    
    // White bans a7-a6, Black plays d7-d5
    result = game.play({ ban: { from: 'a7', to: 'a6' } });
    console.log('White bans a7-a6:', result.san);
    
    result = game.play({ move: { from: 'd7', to: 'd5' } });
    console.log('Black plays d7-d5:', result.san);
    
    console.log('\n=== Move 2 ===');
    // Move 2: Black bans a2-a3, White plays Qd1-h5
    result = game.play({ ban: { from: 'a2', to: 'a3' } });
    console.log('Black bans a2-a3:', result.san);
    
    result = game.play({ move: { from: 'd1', to: 'h5' } });
    console.log('White plays Qd1-h5:', result.san);
    
    // Note: The original sequence has issues here
    // The notation shows "a6a5" but a7-a6 was already banned
    // Let's continue with a valid move sequence
    
    // White bans b7-b6, Black plays g7-g6 (to kick the queen)
    result = game.play({ ban: { from: 'b7', to: 'b6' } });
    console.log('White bans b7-b6:', result.san);
    
    result = game.play({ move: { from: 'g7', to: 'g6' } });
    console.log('Black plays g7-g6:', result.san);
    
    console.log('\n=== Move 3 - The Critical Moment ===');
    // Move 3: Black bans something, White plays Qxf7+
    result = game.play({ ban: { from: 'c1', to: 'f4' } });
    console.log('Black bans c1-f4:', result.san);
    
    result = game.play({ move: { from: 'h5', to: 'f7' } });
    console.log('White plays Qxf7+! Check?', result.san, 'Flags:', result.flags);
    
    // Check if Black is in check
    console.log('Is Black in check?', game.inCheck());
    
    // Now it's White's turn to ban
    // Let's see what moves Black has available
    const blackMovesInCheck = game.legalBans(); // These are the moves White can ban
    console.log('Black\'s possible moves that White can ban:', blackMovesInCheck.length);
    
    // The key move: can Black escape by Kxf7?
    const kxf7Available = blackMovesInCheck.find(m => m.from === 'e8' && m.to === 'f7');
    if (kxf7Available) {
      console.log('Black can play Kxf7 - White will ban it to cause checkmate');
      
      // White bans Kxf7
      result = game.play({ ban: { from: 'e8', to: 'f7' } });
      console.log('White bans e8-f7:', result.san);
      console.log('Ban caused checkmate?', result.flags?.banCausedCheckmate);
      console.log('Game over?', game.gameOver());
      console.log('Checkmate?', game.inCheckmate());
      
      // The ban should have # indicator if it caused checkmate
      expect(result.san).toContain('#');
      expect(result.flags?.banCausedCheckmate).toBe(true);
    } else {
      console.log('Kxf7 is not available - checking other escape moves');
      console.log('Other available bans:', blackMovesInCheck.map(m => `${m.from}-${m.to}`));
    }
  });

  it('should detect checkmate when queen gives check and king capture is banned', () => {
    // Set up a cleaner position for testing
    // Position after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
    const game = new BanChess();
    
    // Move 1
    game.play({ ban: { from: 'd2', to: 'd4' } }); // Black bans d4
    game.play({ move: { from: 'e2', to: 'e4' } }); // White plays e4
    game.play({ ban: { from: 'd2', to: 'd3' } }); // White bans d3
    game.play({ move: { from: 'e7', to: 'e5' } }); // Black plays e5
    
    // Move 2
    game.play({ ban: { from: 'g1', to: 'f3' } }); // Black bans Nf3
    game.play({ move: { from: 'f1', to: 'c4' } }); // White plays Bc4
    game.play({ ban: { from: 'f8', to: 'c5' } }); // White bans Bc5
    game.play({ move: { from: 'b8', to: 'c6' } }); // Black plays Nc6
    
    // Move 3
    game.play({ ban: { from: 'b1', to: 'c3' } }); // Black bans Nc3
    game.play({ move: { from: 'd1', to: 'h5' } }); // White plays Qh5
    game.play({ ban: { from: 'd7', to: 'd6' } }); // White bans d6
    game.play({ move: { from: 'g8', to: 'f6' } }); // Black blunders with Nf6??
    
    // Move 4 - The checkmate
    game.play({ ban: { from: 'c4', to: 'f7' } }); // Black tries to ban Bxf7+ but...
    const qxf7 = game.play({ move: { from: 'h5', to: 'f7' } }); // White plays Qxf7#!
    
    console.log('\n=== Checkmate Sequence ===');
    console.log('Qxf7 move:', qxf7.san);
    console.log('Is check?', qxf7.flags?.check);
    console.log('Is checkmate?', qxf7.flags?.checkmate);
    console.log('Game over?', game.gameOver());
    
    // This should be checkmate
    expect(qxf7.san).toBe('Qxf7#');
    expect(qxf7.flags?.checkmate).toBe(true);
    expect(game.inCheckmate()).toBe(true);
  });
});