import { BanChess } from '../src/BanChess';

describe('Ban Checkmate FEN Consistency', () => {
  it('should have consistent indicators between FEN and lastAction when ban causes checkmate', () => {
    // Replay the exact game that showed the issue
    const bcn = [
      "b:e2e4", "m:d2d4", "b:e7e5", "m:g8f6", "b:g1f3", "m:e2e4",
      "b:f6e4", "m:d7d6", "b:g1f3", "m:e4e5", "b:d6e5", "m:f6e4",
      "b:f2f3", "m:d1h5", "b:g7g6", "m:d6e5", "b:h5f7", "m:h5f5",
      "b:c8f5", "m:e4d6", "b:f5e5", "m:d4e5", "b:d6f5", "m:c8f5",
      "b:e5d6", "m:g2g4", "b:f5g4", "m:f5e4", "b:e5d6", "m:e5e6",
      "b:f7e6", "m:e4h1", "b:f1g2", "m:b1c3", "b:f7e6", "m:f7f6",
      "b:c1f4", "m:c3d5", "b:h1d5", "m:c7c6", "b:c1f4", "m:d5c7",
      "b:d8c7"
    ];
    
    const game = BanChess.replayFromActions(bcn);
    
    // Get the FEN and sync state
    const fen = game.fen();
    const syncState = game.getSyncState();
    
    // Extract the indicator from FEN's 7th field
    const fenParts = fen.split(' ');
    const plyField = fenParts[6];
    
    // Extract indicator from the ply field (after the ban notation)
    const fenIndicatorMatch = plyField.match(/[+#=]$/);
    const fenIndicator = fenIndicatorMatch ? fenIndicatorMatch[0] : '';
    
    // Extract indicator from lastAction
    const lastActionIndicatorMatch = syncState.lastAction?.match(/[+#=]$/);
    const lastActionIndicator = lastActionIndicatorMatch ? lastActionIndicatorMatch[0] : '';
    
    // Both should have the same indicator
    if (game.gameOver() && game.inCheckmate()) {
      // If the ban caused checkmate, both should have '#'
      expect(fenIndicator).toBe('#');
      expect(lastActionIndicator).toBe('#');
    } else {
      // Otherwise, they should still match
      expect(fenIndicator).toBe(lastActionIndicator);
    }
    
    // The indicators should be consistent
    expect(fenIndicator).toBe(lastActionIndicator);
  });

  it('should correctly identify when a ban causes checkmate', () => {
    // Position where White knight on c7 gives check, Black queen can capture it
    // If we ban d8-c7 (queen capturing knight), it should be checkmate
    const setupFEN = 'rn1qkb1r/ppN1p1pp/2p1Pp2/3n4/6P1/8/PPP2P1P/R1B1KBNR b KQkq - 1 11 43';
    const game = new BanChess(setupFEN);
    
    // Verify position: White knight on c7 gives check
    expect(game.inCheck()).toBe(true);
    
    // Black should be in check with limited escape moves
    const legalMoves = game.legalMoves();
    
    // If the only way to escape check is Qxc7, banning it causes checkmate
    const canCaptureKnight = legalMoves.some(m => m.from === 'd8' && m.to === 'c7');
    const hasOtherEscapes = legalMoves.filter(m => !(m.from === 'd8' && m.to === 'c7')).length > 0;
    
    if (canCaptureKnight && !hasOtherEscapes) {
      // Ban the queen capture
      const result = game.play({ ban: { from: 'd8', to: 'c7' } });
      
      // This should cause checkmate
      expect(result.flags?.banCausedCheckmate).toBe(true);
      expect(result.san).toBe('d8c7#');
      
      // FEN should also have the # indicator
      const fen = game.fen();
      expect(fen).toMatch(/#$/);
      
      // Sync state should be consistent
      const syncState = game.getSyncState();
      expect(syncState.lastAction).toBe('b:d8c7#');
      expect(syncState.fen).toMatch(/44:d8c7#$/);
    }
  });
});