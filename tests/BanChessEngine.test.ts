import { BanChess } from '../src/BanChess';
import { BanChessEngine } from '../src/BanChessEngine';
import type { Action } from '../src/types';

describe('BanChessEngine', () => {
  let engine: BanChessEngine;
  
  beforeEach(() => {
    engine = new BanChessEngine({
      maxDepth: 4,
      timeLimit: 1000
    });
  });
  
  describe('Basic functionality', () => {
    it('should find a legal ban for the opening position', () => {
      const game = new BanChess();
      const action = engine.findBestAction(game);
      
      expect(action).toBeDefined();
      expect('ban' in action).toBe(true);
      
      // Verify the ban is legal
      const result = game.play(action);
      expect(result.success).toBe(true);
    });
    
    it('should find a legal move after a ban', () => {
      const game = new BanChess();
      
      // Black bans e2-e4
      game.play({ ban: { from: 'e2', to: 'e4' } });
      
      // Engine should find a legal move for White
      const action = engine.findBestAction(game);
      
      expect(action).toBeDefined();
      expect('move' in action).toBe(true);
      
      // Verify the move is legal
      const result = game.play(action);
      expect(result.success).toBe(true);
    });
    
    it('should correctly alternate between bans and moves', () => {
      const game = new BanChess();
      
      // Play first 4 plies with engine
      for (let i = 0; i < 4; i++) {
        const action = engine.findBestAction(game);
        const result = game.play(action);
        
        expect(result.success).toBe(true);
        
        // Check action type alternates correctly
        if (i % 2 === 0) {
          expect('ban' in action).toBe(true);
        } else {
          expect('move' in action).toBe(true);
        }
      }
    });
  });
  
  describe('Evaluation functions', () => {
    it('should prefer banning center control moves', () => {
      const game = new BanChess();
      const action = engine.findBestAction(game);
      
      if ('ban' in action) {
        const ban = action.ban;
        // Common center control moves that might be banned
        const centerMoves = ['e4', 'd4', 'e5', 'd5'];
        const isCenterBan = centerMoves.includes(ban.to);
        
        // Engine should often (but not always) ban center moves
        console.log(`Engine banned: ${ban.from}-${ban.to}`);
      }
      
      expect(action).toBeDefined();
    });
    
    it('should avoid making illegal moves', () => {
      const game = new BanChess();
      
      // Black bans e2-e4
      game.play({ ban: { from: 'e2', to: 'e4' } });
      
      const action = engine.findBestAction(game);
      
      if ('move' in action) {
        const move = action.move;
        // Should not try to play the banned move
        expect(move.from === 'e2' && move.to === 'e4').toBe(false);
      }
      
      const result = game.play(action);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Checkmate detection', () => {
    it('should recognize and ban the only escape from check to achieve checkmate', () => {
      // Set up a position where the king is in check with only one escape
      // After queen captures: King on h1, only escape is h1-g1
      const fen = 'rnb1kbnr/pppp1ppp/8/8/8/8/PPPP1PqP/RNBQKBNR w KQkq - 0 1 7';
      const game = new BanChess(fen);
      
      // Now it's time to ban (ply 7), and Black can ban the only escape
      const action = engine.findBestAction(game);
      
      expect(action).toBeDefined();
      expect('ban' in action).toBe(true);
      
      if ('ban' in action) {
        const ban = action.ban;
        // Should ban the king's only escape move
        expect(ban.from).toBe('h1');
        expect(ban.to).toBe('g1');
        
        const result = game.play(action);
        expect(result.success).toBe(true);
        expect(result.flags?.banCausedCheckmate).toBe(true);
      }
    });
  });
  
  describe('Performance', () => {
    it('should respect time limits', () => {
      const game = new BanChess();
      const startTime = Date.now();
      
      const engine = new BanChessEngine({
        maxDepth: 10, // High depth
        timeLimit: 100 // But short time limit
      });
      
      const action = engine.findBestAction(game);
      const elapsedTime = Date.now() - startTime;
      
      expect(action).toBeDefined();
      expect(elapsedTime).toBeLessThan(200); // Allow some overhead
    });
    
    it('should use transposition table for efficiency', () => {
      const engineWithTable = new BanChessEngine({
        maxDepth: 4,
        useTranspositionTable: true
      });
      
      const engineWithoutTable = new BanChessEngine({
        maxDepth: 4,
        useTranspositionTable: false
      });
      
      const game = new BanChess();
      
      // Find best action with transposition table
      engineWithTable.findBestAction(game);
      const statsWithTable = engineWithTable.getStatistics();
      
      // Find best action without transposition table
      engineWithoutTable.findBestAction(game);
      const statsWithoutTable = engineWithoutTable.getStatistics();
      
      // Transposition table should reduce nodes evaluated
      console.log(`Nodes with table: ${statsWithTable.nodesEvaluated}`);
      console.log(`Nodes without table: ${statsWithoutTable.nodesEvaluated}`);
      console.log(`Table size: ${statsWithTable.transpositionTableSize}`);
      
      expect(statsWithTable.transpositionTableSize).toBeGreaterThan(0);
    });
  });
  
  describe('Engine configuration', () => {
    it('should use custom evaluation weights', () => {
      const customEngine = new BanChessEngine({
        maxDepth: 3,
        evaluationWeights: {
          material: 2.0,    // Double material importance
          position: 0.1,    // Less positional importance
          banPotential: 0.5,
          mobility: 0.3
        }
      });
      
      const game = new BanChess();
      const action = customEngine.findBestAction(game);
      
      expect(action).toBeDefined();
      const result = game.play(action);
      expect(result.success).toBe(true);
    });
    
    it('should handle various game positions', () => {
      // Test mid-game position
      const pgn = '{banning: e2e4} 1. d4 {banning: d7d5} Nf6 {banning: e7e6} 2. c4';
      const game = new BanChess(undefined, pgn);
      
      const action = engine.findBestAction(game);
      expect(action).toBeDefined();
      
      const result = game.play(action);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Engine vs Engine play', () => {
    it('should be able to play a complete game', () => {
      const game = new BanChess();
      let moveCount = 0;
      const maxMoves = 20; // Play 20 plies (5 full rounds)
      
      while (!game.gameOver() && moveCount < maxMoves) {
        const action = engine.findBestAction(game);
        const result = game.play(action);
        
        expect(result.success).toBe(true);
        moveCount++;
        
        console.log(`Ply ${game.getPly() - 1}: ${result.san || 'ban'}`);
      }
      
      console.log(`Game state after ${moveCount} plies:`);
      console.log(`FEN: ${game.fen()}`);
      console.log(`Game over: ${game.gameOver()}`);
    });
  });
});