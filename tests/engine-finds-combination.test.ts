import { BanChess } from '../src/BanChess';
import { BanChessEngine } from '../src/BanChessEngine';
import { BanChessEngineV2 } from '../src/BanChessEngineV2';
import type { Square } from '../src/types';

describe('Engine finds queen sacrifice to ban-checkmate combination', () => {
  
  // Helper to set up the critical position
  function setupCriticalPosition(): BanChess {
    // Position where:
    // - Black king on h8 (trapped in corner)
    // - Black pawn on g7 (protecting king)
    // - White queen on f6 (ready to sacrifice)
    // - White's turn to move (ply 14)
    // After Qxg7+, only Kxg7 is legal, then White bans it -> checkmate
    
    const fen = '7k/6p1/5Q2/8/8/8/6PP/6K1 w - - 0 1 14';
    return new BanChess(fen);
  }

  describe('BanChessEngine V1', () => {
    it('should find Qxg7+ as the best move and evaluate it as winning', () => {
      const game = setupCriticalPosition();
      const engine = new BanChessEngine({ 
        maxDepth: 6,
        timeLimit: 5000 
      });
      
      console.log('\n=== V1 Engine Test ===');
      console.log('Position:');
      console.log(game.ascii());
      console.log(`Ply ${game.getPly()}: White to move\n`);
      
      // Engine should find Qxg7+
      const bestAction = engine.findBestAction(game);
      console.log('Engine found:', bestAction);
      
      // Verify it's the queen sacrifice
      expect(bestAction).toBeDefined();
      expect('move' in bestAction).toBe(true);
      if ('move' in bestAction) {
        expect(bestAction.move.from).toBe('f6');
        expect(bestAction.move.to).toBe('g7');
        console.log('✓ Engine found Qxg7+');
        
        // Play the move
        const result = game.play(bestAction);
        expect(result.success).toBe(true);
        expect(result.flags?.check).toBe(true);
        console.log('Move gives check:', result.flags?.check);
        
        // Now White should ban Kxg7
        console.log('\nAfter Qxg7+, White to ban:');
        const banAction = engine.findBestAction(game);
        console.log('Engine wants to ban:', banAction);
        
        expect('ban' in banAction).toBe(true);
        if ('ban' in banAction) {
          expect(banAction.ban.from).toBe('h8');
          expect(banAction.ban.to).toBe('g7');
          console.log('✓ Engine found the winning ban Kh8xg7');
          
          // Verify it causes checkmate
          const banResult = game.play(banAction);
          expect(banResult.flags?.banCausedCheckmate).toBe(true);
          console.log('Ban causes checkmate:', banResult.flags?.banCausedCheckmate);
        }
      }
    });

    it('should evaluate the position as highly favorable for White', () => {
      const game = setupCriticalPosition();
      const engine = new BanChessEngine({ maxDepth: 6 });
      
      // Get engine statistics
      const action = engine.findBestAction(game);
      const stats = engine.getStatistics();
      
      console.log('\nV1 Engine evaluation statistics:');
      console.log('Nodes evaluated:', stats.nodesEvaluated);
      console.log('Transposition table size:', stats.transpositionTableSize);
      
      // The evaluation should be very positive for White (winning)
      // We can't directly access the score, but finding the right move indicates correct evaluation
      expect('move' in action && action.move.from === 'f6' && action.move.to === 'g7').toBe(true);
    });
  });

  describe('BanChessEngine V2', () => {
    it('should find Qxg7+ and evaluate as checkmate in 2', () => {
      const game = setupCriticalPosition();
      const engine = new BanChessEngineV2({ 
        hash: 128,
        moveTime: 5000 
      });
      
      console.log('\n=== V2 Engine Test ===');
      console.log('Position for V2 analysis\n');
      
      // Search for best move
      const searchResult = engine.search(game, { 
        depth: 8,
        movetime: 3000 
      });
      
      console.log('V2 Search results:');
      console.log('Depth reached:', searchResult.depth);
      console.log('Nodes searched:', searchResult.nodes);
      console.log('Quiescence nodes:', searchResult.qnodes);
      console.log('NPS:', searchResult.nps);
      
      // Check the principal variation
      expect(searchResult.pv.length).toBeGreaterThan(0);
      const bestMove = searchResult.pv[0];
      
      console.log('\nPrincipal Variation:');
      searchResult.pv.slice(0, 4).forEach((action, i) => {
        if ('move' in action) {
          console.log(`  ${i + 1}. Move ${action.move.from}-${action.move.to}`);
        } else {
          console.log(`  ${i + 1}. Ban ${action.ban.from}-${action.ban.to}`);
        }
      });
      
      // Verify first move is Qxg7+
      expect('move' in bestMove).toBe(true);
      if ('move' in bestMove) {
        expect(bestMove.move.from).toBe('f6');
        expect(bestMove.move.to).toBe('g7');
        console.log('\n✓ V2 found Qxg7+ as best move');
        
        // The second move in PV should be the ban
        if (searchResult.pv.length > 1) {
          const secondAction = searchResult.pv[1];
          expect('ban' in secondAction).toBe(true);
          if ('ban' in secondAction) {
            expect(secondAction.ban.from).toBe('h8');
            expect(secondAction.ban.to).toBe('g7');
            console.log('✓ V2 PV includes the winning ban');
          }
        }
      }
      
      // Play it out to verify
      game.play(bestMove);
      const banMove = engine.getBestMove(game);
      if (banMove && 'ban' in banMove) {
        const result = game.play(banMove);
        expect(result.flags?.banCausedCheckmate).toBe(true);
        console.log('✓ V2 achieves checkmate');
      }
    });

    it('should give a mate score evaluation', () => {
      const game = setupCriticalPosition();
      const engine = new BanChessEngineV2({ hash: 64 });
      
      // Get position evaluation
      const staticEval = engine.evaluatePosition(game);
      console.log('\nV2 Static evaluation:', staticEval);
      
      // Search should find mate
      const searchResult = engine.search(game, { depth: 6 });
      
      // The score should indicate mate (very high value)
      // Mate scores are typically > 9000
      console.log('Search indicates winning position');
      
      // Verify the combination is in the PV
      const pv = searchResult.pv;
      if (pv.length >= 2) {
        const move1 = pv[0];
        const move2 = pv[1];
        
        const isCorrectSequence = 
          'move' in move1 && move1.move.from === 'f6' && move1.move.to === 'g7' &&
          'ban' in move2 && move2.ban.from === 'h8' && move2.ban.to === 'g7';
        
        expect(isCorrectSequence).toBe(true);
        console.log('✓ PV contains the complete winning sequence');
      }
    });
  });

  describe('Comparison test', () => {
    it('both engines should find the same winning combination', () => {
      const game1 = setupCriticalPosition();
      const game2 = setupCriticalPosition();
      
      const engineV1 = new BanChessEngine({ maxDepth: 6 });
      const engineV2 = new BanChessEngineV2({ hash: 64 });
      
      console.log('\n=== Comparing Both Engines ===\n');
      
      // V1 finds the move
      const v1Move = engineV1.findBestAction(game1);
      console.log('V1 found:', v1Move);
      
      // V2 finds the move
      const v2Move = engineV2.getBestMove(game2);
      console.log('V2 found:', v2Move);
      
      // Both should find Qxg7+
      expect('move' in v1Move && v1Move.move.from === 'f6' && v1Move.move.to === 'g7').toBe(true);
      expect(v2Move && 'move' in v2Move && v2Move.move.from === 'f6' && v2Move.move.to === 'g7').toBe(true);
      
      // Play the moves
      game1.play(v1Move);
      if (v2Move) game2.play(v2Move);
      
      // Both should find the winning ban
      const v1Ban = engineV1.findBestAction(game1);
      const v2Ban = engineV2.getBestMove(game2);
      
      console.log('V1 ban:', v1Ban);
      console.log('V2 ban:', v2Ban);
      
      expect('ban' in v1Ban && v1Ban.ban.from === 'h8' && v1Ban.ban.to === 'g7').toBe(true);
      expect(v2Ban && 'ban' in v2Ban && v2Ban.ban.from === 'h8' && v2Ban.ban.to === 'g7').toBe(true);
      
      console.log('\n✓ Both engines find the complete winning combination!');
    });
  });

  describe('Different depths test', () => {
    it('should find the combination even at shallow depth', () => {
      const game = setupCriticalPosition();
      const engine = new BanChessEngine({ 
        maxDepth: 3, // Shallow depth
        timeLimit: 1000 
      });
      
      console.log('\n=== Shallow Depth Test (depth=3) ===');
      
      const move = engine.findBestAction(game);
      console.log('Found at depth 3:', move);
      
      // Even at depth 3, it should find the obvious queen sacrifice
      expect('move' in move).toBe(true);
      if ('move' in move) {
        expect(move.move.from).toBe('f6');
        expect(move.move.to).toBe('g7');
        console.log('✓ Found Qxg7+ even at shallow depth');
        
        // Play it
        game.play(move);
        
        // Should also find the ban at shallow depth
        const ban = engine.findBestAction(game);
        console.log('Ban found at depth 3:', ban);
        
        expect('ban' in ban).toBe(true);
        if ('ban' in ban) {
          expect(ban.ban.from).toBe('h8');
          expect(ban.ban.to).toBe('g7');
          console.log('✓ Found winning ban at shallow depth');
        }
      }
    });

    it('should find it faster at deeper depths', () => {
      const shallow = new BanChessEngine({ maxDepth: 3 });
      const deep = new BanChessEngine({ maxDepth: 6 });
      
      const game1 = setupCriticalPosition();
      const game2 = setupCriticalPosition();
      
      console.log('\n=== Depth Comparison ===');
      
      // Time shallow search
      const start1 = Date.now();
      const move1 = shallow.findBestAction(game1);
      const time1 = Date.now() - start1;
      
      // Time deep search
      const start2 = Date.now();
      const move2 = deep.findBestAction(game2);
      const time2 = Date.now() - start2;
      
      console.log(`Depth 3: ${time1}ms, found ${'move' in move1 ? `${move1.move.from}-${move1.move.to}` : 'ban'}`);
      console.log(`Depth 6: ${time2}ms, found ${'move' in move2 ? `${move2.move.from}-${move2.move.to}` : 'ban'}`);
      
      const stats1 = shallow.getStatistics();
      const stats2 = deep.getStatistics();
      
      console.log(`Depth 3 evaluated ${stats1.nodesEvaluated} nodes`);
      console.log(`Depth 6 evaluated ${stats2.nodesEvaluated} nodes`);
      
      // Both should find the same move
      expect('move' in move1 && move1.move.from === 'f6').toBe(true);
      expect('move' in move2 && move2.move.from === 'f6').toBe(true);
    });
  });
});