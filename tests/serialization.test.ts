import { BanChess } from '../src/BanChess';
import type { SerializedAction } from '../src/types';

describe('Serialization', () => {
  describe('Action Serialization', () => {
    it('should serialize ban actions correctly', () => {
      const action = { ban: { from: 'e2' as const, to: 'e4' as const } };
      const serialized = BanChess.serializeAction(action);
      expect(serialized).toBe('b:e2e4');
    });

    it('should serialize move actions correctly', () => {
      const action = { move: { from: 'd2' as const, to: 'd4' as const } };
      const serialized = BanChess.serializeAction(action);
      expect(serialized).toBe('m:d2d4');
    });

    it('should serialize promotion moves correctly', () => {
      const action = { move: { from: 'e7' as const, to: 'e8' as const, promotion: 'q' as const } };
      const serialized = BanChess.serializeAction(action);
      expect(serialized).toBe('m:e7e8q');
    });

    it('should deserialize ban actions correctly', () => {
      const serialized: SerializedAction = 'b:e2e4';
      const action = BanChess.deserializeAction(serialized);
      expect(action).toEqual({ ban: { from: 'e2', to: 'e4' } });
    });

    it('should deserialize move actions correctly', () => {
      const serialized: SerializedAction = 'm:d2d4';
      const action = BanChess.deserializeAction(serialized);
      expect(action).toEqual({ move: { from: 'd2', to: 'd4' } });
    });

    it('should deserialize promotion moves correctly', () => {
      const serialized: SerializedAction = 'm:e7e8n';
      const action = BanChess.deserializeAction(serialized);
      expect(action).toEqual({ move: { from: 'e7', to: 'e8', promotion: 'n' } });
    });

    it('should throw error for invalid serialized format', () => {
      expect(() => BanChess.deserializeAction('invalid')).toThrow('Invalid serialized action format');
      expect(() => BanChess.deserializeAction('x:e2e4')).toThrow('Invalid serialized action format');
      expect(() => BanChess.deserializeAction('b:e2')).toThrow('Invalid serialized action format');
      expect(() => BanChess.deserializeAction('m:e2e9')).toThrow('Invalid serialized action format');
    });

    it('should handle round-trip serialization', () => {
      const actions = [
        { ban: { from: 'e2' as const, to: 'e4' as const } },
        { move: { from: 'd2' as const, to: 'd4' as const } },
        { move: { from: 'e7' as const, to: 'e8' as const, promotion: 'q' as const } }
      ];

      for (const original of actions) {
        const serialized = BanChess.serializeAction(original);
        const deserialized = BanChess.deserializeAction(serialized);
        expect(deserialized).toEqual(original);
      }
    });
  });

  describe('Game State Synchronization', () => {
    it('should get sync state correctly', () => {
      const game = new BanChess();
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'd2', to: 'd4' } });

      const syncState = game.getSyncState();
      expect(syncState.fen).toContain('w:ban'); // White's turn to ban
      expect(syncState.lastAction).toBe('m:d2d4');
      expect(syncState.moveNumber).toBe(1);
    });

    it('should load from sync state correctly', () => {
      const game1 = new BanChess();
      game1.play({ ban: { from: 'e2', to: 'e4' } });
      game1.play({ move: { from: 'd2', to: 'd4' } });
      
      const syncState = game1.getSyncState();
      
      const game2 = new BanChess();
      game2.loadFromSyncState(syncState);
      
      expect(game2.fen()).toBe(game1.fen());
      expect(game2.nextActionType()).toBe('ban');
      expect(game2.turn).toBe('white');
    });

    it('should play serialized actions correctly', () => {
      const game = new BanChess();
      
      let result = game.playSerializedAction('b:e2e4');
      expect(result.success).toBe(true);
      expect(game.currentBannedMove).toEqual({ from: 'e2', to: 'e4' });
      
      result = game.playSerializedAction('m:d2d4');
      expect(result.success).toBe(true);
      expect(game.currentBannedMove).toBeNull();
    });

    it('should handle invalid serialized actions gracefully', () => {
      const game = new BanChess();
      
      const result = game.playSerializedAction('invalid:action');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid serialized action');
    });

    it('should track action history correctly', () => {
      const game = new BanChess();
      
      game.play({ ban: { from: 'e2', to: 'e4' } });
      game.play({ move: { from: 'd2', to: 'd4' } });
      game.play({ ban: { from: 'e7', to: 'e5' } });
      game.play({ move: { from: 'd7', to: 'd5' } });
      
      const history = game.getActionHistory();
      expect(history).toEqual([
        'b:e2e4',
        'm:d2d4',
        'b:e7e5',
        'm:d7d5'
      ]);
    });

    it('should replay from actions correctly', () => {
      const actions: SerializedAction[] = [
        'b:e2e4',
        'm:d2d4',
        'b:e7e5',
        'm:d7d5'
      ];
      
      const game = BanChess.replayFromActions(actions);
      
      expect(game.getActionHistory()).toEqual(actions);
      expect(game.nextActionType()).toBe('ban');
      expect(game.turn).toBe('black');
    });

    it('should throw error when replay fails', () => {
      const actions: SerializedAction[] = [
        'b:e2e4',
        'm:e2e4' // This should fail because e2-e4 is banned
      ];
      
      expect(() => BanChess.replayFromActions(actions))
        .toThrow('Failed to replay action m:e2e4');
    });

    it('should replay from a custom starting position', () => {
      const customFen = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1 w:ban';
      const actions: SerializedAction[] = [
        'b:e7e5',
        'm:d7d5'
      ];
      
      const game = BanChess.replayFromActions(actions, customFen);
      
      expect(game.getActionHistory()).toEqual(actions);
      expect(game.turn).toBe('black');
    });
  });

  describe('Incremental Updates', () => {
    it('should handle incremental updates between clients', () => {
      // Client A starts a game
      const clientA = new BanChess();
      clientA.play({ ban: { from: 'e2', to: 'e4' } });
      
      // Client B receives the sync state
      const syncState1 = clientA.getSyncState();
      const clientB = new BanChess();
      clientB.loadFromSyncState(syncState1);
      
      // Both clients should be in sync
      expect(clientB.fen()).toBe(clientA.fen());
      expect(clientB.currentBannedMove).toEqual(clientA.currentBannedMove);
      
      // Client B makes a move
      clientB.play({ move: { from: 'd2', to: 'd4' } });
      
      // Client A receives just the action
      const lastAction = clientB.getLastActionSerialized();
      expect(lastAction).toBe('m:d2d4');
      clientA.playSerializedAction(lastAction!);
      
      // Both should be in sync (state-wise, not history-wise)
      expect(clientA.fen()).toBe(clientB.fen());
      // Note: Action histories will differ since clientB joined mid-game
      expect(clientA.getActionHistory()).toEqual(['b:e2e4', 'm:d2d4']);
      expect(clientB.getActionHistory()).toEqual(['m:d2d4']);
    });

    it('should handle out-of-sync recovery', () => {
      // Two clients play independently
      const clientA = new BanChess();
      const clientB = new BanChess();
      
      // Client A plays some moves
      clientA.play({ ban: { from: 'e2', to: 'e4' } });
      clientA.play({ move: { from: 'd2', to: 'd4' } });
      clientA.play({ ban: { from: 'e7', to: 'e5' } });
      
      // Client B is out of sync - gets full state
      const syncState = clientA.getSyncState();
      clientB.loadFromSyncState(syncState);
      
      // Now they should be in sync
      expect(clientB.fen()).toBe(clientA.fen());
      expect(clientB.turn).toBe(clientA.turn);
      expect(clientB.nextActionType()).toBe(clientA.nextActionType());
    });
  });

  describe('Network Protocol Examples', () => {
    it('should support WebSocket-style messaging', () => {
      const game = new BanChess();
      
      // Simulate sending an action over network
      const action = { ban: { from: 'e2' as const, to: 'e4' as const } };
      const message = {
        type: 'action',
        data: BanChess.serializeAction(action),
        timestamp: Date.now()
      };
      
      // Simulate receiving and applying
      const receivedAction = message.data;
      const result = game.playSerializedAction(receivedAction);
      expect(result.success).toBe(true);
    });

    it('should support REST API-style endpoints', () => {
      const game = new BanChess();
      
      // Simulate GET /game/state
      const state = game.getSyncState();
      const jsonResponse = JSON.stringify(state);
      expect(jsonResponse).toBeTruthy();
      
      // Simulate POST /game/action
      const actionPayload = { action: 'b:e2e4' };
      const result = game.playSerializedAction(actionPayload.action as SerializedAction);
      const response = {
        success: result.success,
        newState: game.getSyncState(),
        error: result.error
      };
      expect(response.success).toBe(true);
    });
  });
});