# ban-chess.ts

A TypeScript wrapper library for implementing the **Ban Chess** variant on top of the `chess.ts` library. In Ban Chess, players must navigate around banned moves - each move is preceded by the opponent banning one of their legal options.

**Key concept**: Bans happen BEFORE moves. The opponent always bans one of your moves right before your turn, limiting your options. This is why Black bans first - they ban a White move before White's opening move.

## Overview

Ban Chess follows this turn sequence:

1. **Black bans**: Black bans one of White's possible opening moves
2. **White moves**: White plays their first move (with Black's ban in effect)
3. **White bans**: White bans one of Black's possible responses
4. **Black moves**: Black plays their first move (with White's ban in effect)
5. **Black bans**: Black bans one of White's next possible moves
6. **White moves**: White plays (with Black's ban in effect)
7. **Pattern continues**: Ban → Move → Ban → Move...

### Key Rules

- **Bans precede moves**: Every move is preceded by the opponent banning one option
- **Bans are square-to-square**: A ban blocks ALL moves from square A to square B (e.g., banning e7-e8 blocks ALL promotions on that square: Queen, Rook, Bishop, and Knight)
- **Forced bans**: Players must ban a move - they cannot pass. 
- **Black starts**: Black bans first, establishing the pattern of ban-before-move

### Checkmate Condition

The key strategic element: When a king is in check and has only **one legal move** to escape, that player is essentially in checkmate already - because their opponent will ban that escape move on the next turn, leaving zero legal moves.

## Installation

```bash
npm install ban-chess.ts
# or
yarn add ban-chess.ts
```

## Dependencies

- `chess.ts@^0.16.2` - Core chess logic and validation
- TypeScript support included

## Quick Start

```typescript
import { BanChess } from 'ban-chess.ts';

// Create a new Ban Chess game
const game = new BanChess();

// Game starts: Black bans a White move (before White has moved at all)
console.log(game.turn); // 'black'
console.log(game.nextActionType()); // 'ban'

// Black bans White's e2-e4 opening BEFORE White's first move
game.play({ ban: { from: 'e2', to: 'e4' } });

// Now White moves (with e2-e4 banned)
console.log(game.turn); // 'white'
console.log(game.nextActionType()); // 'move'
console.log(game.legalMoves()); // e2-e4 is NOT available
game.play({ move: { from: 'd2', to: 'd4' } });

// White bans a Black move BEFORE Black's first move
console.log(game.turn); // 'white' (White does the banning)
console.log(game.nextActionType()); // 'ban'
game.play({ ban: { from: 'e7', to: 'e5' } });

// Now Black moves (with e7-e5 banned)
console.log(game.turn); // 'black'
console.log(game.nextActionType()); // 'move'
console.log(game.legalMoves()); // e7-e5 is NOT available
game.play({ move: { from: 'd7', to: 'd5' } });

// Black bans White's next move BEFORE White moves again
console.log(game.turn); // 'black' (Black does the banning)
console.log(game.nextActionType()); // 'ban'
// Pattern continues: ban-before-move
```

## API Reference

### Core Classes

#### `BanChess`

The main class that extends chess.ts functionality with ban mechanics.

```typescript
class BanChess {
  constructor(fen?: string, pgn?: string);
  
  // Game state
  turn: 'white' | 'black';
  currentBannedMove: Ban | null;
  
  // Core method - handles both bans and moves
  play(action: Action): ActionResult;
  
  // Query methods
  nextActionType(): 'ban' | 'move';
  legalMoves(): Move[];  // Returns moves WITHOUT banned moves
  legalBans(): Move[];   // Returns opponent moves that can be banned
  
  // Game state queries
  inCheck(): boolean;
  inCheckmate(): boolean;
  inStalemate(): boolean;
  gameOver(): boolean;
  
  // State management
  fen(): string;
  pgn(): string;  // Includes ban annotations as comments
  history(): HistoryEntry[];
  reset(): void;
}
```

### Types

#### `Action`
```typescript
type Action = 
  | { move: Move }
  | { ban: Ban };
```

#### `Move`
```typescript
interface Move {
  from: string;    // e.g., 'e2'
  to: string;      // e.g., 'e4'  
  promotion?: 'q' | 'r' | 'b' | 'n';
}
```

#### `Ban`
```typescript
interface Ban {
  from: string;    // e.g., 'e7'
  to: string;      // e.g., 'e8'
  // NO promotion field - bans apply to ALL moves from-to
}
```

#### `ActionResult`
```typescript
interface ActionResult {
  success: boolean;
  action?: Action;
  san?: string;         // Standard Algebraic Notation (for moves)
  error?: string;
  newFen?: string;
  gameOver?: boolean;
  checkmate?: boolean;
  stalemate?: boolean;
}
```

#### `HistoryEntry`
```typescript
interface HistoryEntry {
  turnNumber: number;
  player: 'white' | 'black';
  actionType: 'ban' | 'move';
  action: Ban | Move;
  san?: string;        // For moves only
  fen: string;         // Position after the action
  bannedMove?: Ban;    // The currently active ban (if any)
}
```

### Understanding Turn Flow

In Ban Chess, the flow follows a strict pattern: before EVERY move, the opponent bans one option. So White's move is preceded by Black's ban, and Black's move is preceded by White's ban. The game tracks whose action it is (ban or move) at each step:

```typescript
const game = new BanChess();

// Query what action is expected
if (game.nextActionType() === 'ban') {
  const bans = game.legalBans();
  console.log(`${game.turn} can ban:`, bans);
  // Player selects a ban...
  game.play({ ban: selectedBan });
}

if (game.nextActionType() === 'move') {
  const moves = game.legalMoves(); 
  console.log(`${game.turn} can move:`, moves);
  // Player selects a move...
  game.play({ move: selectedMove });
}
```

### Advanced Features

#### Game State Analysis

```typescript
const game = new BanChess();

// Check current constraints
if (game.currentBannedMove) {
  console.log('Banned move:', game.currentBannedMove);
}

// Analyze position
if (game.inCheck()) {
  const legalMoves = game.legalMoves();
  if (legalMoves.length === 1) {
    console.log('Only one escape move - vulnerable to ban checkmate!');
  }
}

// Game termination
if (game.gameOver()) {
  if (game.inCheckmate()) {
    const winner = game.turn === 'white' ? 'black' : 'white';
    console.log(`Checkmate! ${winner} wins`);
  } else if (game.inStalemate()) {
    console.log('Stalemate - draw');
  }
}
```

#### PGN Integration

Ban Chess uses standard PGN with ban annotations in comments. This ensures portability - any standard PGN parser can read the moves, while Ban Chess parsers can also extract the ban information:

```typescript
const game = new BanChess();

// Play sequence demonstrating PGN format
game.play({ ban: { from: 'e2', to: 'e4' } });   // Black bans (before White moves)
game.play({ move: { from: 'd2', to: 'd4' } });  // White's 1st move
game.play({ ban: { from: 'e7', to: 'e5' } });   // White bans (before Black moves)
game.play({ move: { from: 'd7', to: 'd5' } });  // Black's 1st move

console.log(game.pgn());
// Output: "1. {banning: e2e4} d4 {banning: e7e5} d5"

// PGN format explanation:
// - {banning: FROM_TO} appears BEFORE the move it affects
// - This shows the ban was in effect when the move was made
// - Standard PGN readers ignore comments, preserving compatibility
// - Ban Chess parsers understand the ban-before-move relationship
```

#### Loading Games

```typescript
// From FEN (standard position)
const game1 = new BanChess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

// From PGN with ban history
const pgn = '1. {banning: e2e4} d4 {banning: e7e5} d5 2. {banning: g1f3} Bf4';
const game2 = new BanChess(undefined, pgn);

// Game state restored with ban history
console.log(game2.history());
```

## Usage Examples

### Basic Game Flow

```typescript
import { BanChess } from 'ban-chess.ts';

const game = new BanChess();

// Opening sequence showing ban-before-move pattern
game.play({ ban: { from: 'e2', to: 'e4' } });    // Black bans BEFORE White's 1st move
game.play({ move: { from: 'd2', to: 'd4' } });   // White's 1st move (e4 banned)
game.play({ ban: { from: 'e7', to: 'e5' } });    // White bans BEFORE Black's 1st move
game.play({ move: { from: 'd7', to: 'd6' } });   // Black's 1st move (e5 banned)
game.play({ ban: { from: 'g1', to: 'f3' } });    // Black bans BEFORE White's 2nd move
game.play({ move: { from: 'c1', to: 'f4' } });   // White's 2nd move (Nf3 banned)

console.log('Position after opening:', game.fen());
console.log('PGN:', game.pgn());
// Output: "1. {banning: e2e4} d4 {banning: e7e5} d6 2. {banning: g1f3} Bf4"
```

### Tactical Ban Checkmate

```typescript
// Setup: Position where Black king will have only one escape from check
const dangerousPos = new BanChess('rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 1');

// White moves: Bxf7+ (check!)
dangerousPos.play({ move: { from: 'c4', to: 'f7' } });

// Now it's White's turn to ban BEFORE Black's move
// Black has only one legal move to escape check: Ke7
const escapes = dangerousPos.legalBans();
console.log('Black\'s only escape:', escapes); // [{ from: 'e8', to: 'e7' }]

// White bans that escape move
dangerousPos.play({ ban: { from: 'e8', to: 'e7' } });

// Black's turn to move, but has NO legal moves (checkmate!)
console.log('Game over:', dangerousPos.gameOver()); // true
console.log('Checkmate:', dangerousPos.inCheckmate()); // true
```

### Promotion Ban Example

```typescript
// Position: White has pawn on a7, ready to promote
const game = new BanChess('4k3/P7/8/8/8/8/8/4K3 b - - 0 1');

// Black bans BEFORE White's move (preventing promotion)
game.play({ ban: { from: 'a7', to: 'a8' } });

// CRITICAL: This single ban blocks ALL promotions:
// - a7a8=Q (promote to queen) - BANNED
// - a7a8=R (promote to rook) - BANNED  
// - a7a8=B (promote to bishop) - BANNED
// - a7a8=N (promote to knight) - BANNED

// White's turn to move, but cannot promote
console.log(game.legalMoves()); // No a7-a8 moves available
game.play({ move: { from: 'e1', to: 'e2' } }); // Must move king instead
```

### Defensive Ban Strategy

```typescript
const game = new BanChess();

// Opening: Using bans to control development

// Black bans Nf3 BEFORE White's opening move
game.play({ ban: { from: 'g1', to: 'f3' } });
game.play({ move: { from: 'e2', to: 'e4' } });   // White opens e4 (Nf3 banned)

// White bans Nc6 BEFORE Black's response
game.play({ ban: { from: 'b8', to: 'c6' } });
game.play({ move: { from: 'e7', to: 'e5' } });   // Black plays e5 (Nc6 banned)

// Black bans Bc4 BEFORE White's next move
game.play({ ban: { from: 'f1', to: 'c4' } });
game.play({ move: { from: 'd2', to: 'd3' } });   // White plays d3 (Bc4 banned)

// The pattern: Each ban shapes the opponent's immediate next move
```

## Integration Examples

### React Component

```tsx
import React, { useState } from 'react';
import { BanChess, Action } from 'ban-chess.ts';

const BanChessBoard: React.FC = () => {
  const [game, setGame] = useState(() => new BanChess());
  
  const handleAction = (action: Action) => {
    const newGame = new BanChess(game.fen(), game.pgn());
    const result = newGame.play(action);
    
    if (result.success) {
      setGame(newGame);
    } else {
      console.error('Invalid action:', result.error);
    }
  };
  
  const handleSquareClick = (from: string, to: string) => {
    // Determine what type of action based on game state
    if (game.nextActionType() === 'ban') {
      handleAction({ ban: { from, to } });
    } else {
      handleAction({ move: { from, to } });
    }
  };
  
  return (
    <div>
      <div>Turn: {game.turn}</div>
      <div>Next Action: {game.nextActionType()}</div>
      {game.currentBannedMove && (
        <div>Banned: {game.currentBannedMove.from}-{game.currentBannedMove.to}</div>
      )}
      <div>Legal {game.nextActionType() === 'ban' ? 'Bans' : 'Moves'}: 
        {game.nextActionType() === 'ban' ? 
          game.legalBans().length : 
          game.legalMoves().length}
      </div>
      {/* Your board component here */}
    </div>
  );
};
```

### Node.js Game Engine

```typescript
import { BanChess } from 'ban-chess.ts';

class BanChessEngine {
  private game: BanChess;
  
  constructor() {
    this.game = new BanChess();
  }
  
  async processPlayerAction(playerId: string, action: Action) {
    const playerColor = this.getPlayerColor(playerId);
    
    // Validate it's player's turn
    if (this.game.turn !== playerColor) {
      throw new Error('Not your turn');
    }
    
    // Validate correct action type
    const expectedType = this.game.nextActionType();
    const actualType = 'move' in action ? 'move' : 'ban';
    
    if (actualType !== expectedType) {
      throw new Error(`Expected ${expectedType}, got ${actualType}`);
    }
    
    // Process the action
    const result = this.game.play(action);
    if (!result.success) {
      throw new Error(result.error);
    }
    
    await this.broadcastGameState();
    
    if (this.game.gameOver()) {
      await this.handleGameEnd();
    }
  }
  
  private async broadcastGameState() {
    // Emit to connected clients
    const state = {
      fen: this.game.fen(),
      pgn: this.game.pgn(),  // Includes ban annotations
      turn: this.game.turn,
      nextActionType: this.game.nextActionType(),
      currentBannedMove: this.game.currentBannedMove,
      legalMoves: this.game.legalMoves(),  // Excludes banned moves
      legalBans: this.game.legalBans(),
      gameOver: this.game.gameOver(),
      inCheck: this.game.inCheck()
    };
    
    // Your WebSocket/Socket.IO broadcast logic
    await this.io.emit('gameState', state);
  }
  
  private getPlayerColor(playerId: string): 'white' | 'black' {
    // Your player mapping logic
    return this.players[playerId];
  }
}
```

## Ban Chess Strategy Guide

### Opening Principles

1. **Ban Key Development**: Target opponent's strongest developing moves (Nf3, Nc6, Bc4, etc.)
2. **Control Center**: Don't ban central pawn moves unless creating immediate tactics
3. **Castle Safety**: Consider banning moves that prevent or delay castling

### Middlegame Tactics

1. **Escape Route Denial**: If opponent's king/piece has limited squares, ban their escape
2. **Tactical Setups**: Ban moves that would defend against your tactical threats  
3. **Positional Pressure**: Ban moves that would improve opponent's pawn structure

### Endgame Considerations

1. **King Activity**: Ban moves that activate the opponent's king
2. **Promotion Threats**: Ban critical pawn advances near promotion
3. **Stalemate Tricks**: Use bans to create or avoid stalemate patterns

## Performance Considerations

### Efficiency Tips

```typescript
// Reuse game instances when possible
const game = new BanChess();

// Batch position analysis
const analysis = {
  legalMoves: game.legalMoves(),
  legalBans: game.legalBans(), 
  inCheck: game.inCheck(),
  gameOver: game.gameOver()
};

// Avoid excessive history() calls
const history = game.history();
const lastMove = history[history.length - 1];
```

### Memory Management

```typescript
// For long-running applications, reset when needed
game.reset(); // Clears history and returns to starting position

// Or create fresh instances
const newGame = new BanChess();
```

## Testing

The library includes comprehensive test coverage:

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only  
npm run test:e2e      # End-to-end gameplay tests
npm run test:perf     # Performance benchmarks
```

### Test Categories

- **Unit Tests**: Individual method validation
- **Integration Tests**: Complete game flow scenarios  
- **Edge Cases**: Checkmate/stalemate with bans
- **Performance Tests**: Large game tree analysis
- **Compatibility Tests**: chess.ts integration

## Compatibility

### chess.ts Compatibility

ban-chess.ts maintains full compatibility with chess.ts:

```typescript
// All chess.ts methods work unchanged
const game = new BanChess();

// Standard chess.ts API
game.turn;           // 'white' | 'black'
game.inCheck();      // boolean
game.fen();          // FEN string
game.pgn();          // PGN string
game.history();      // Move history

// Plus Ban Chess extensions  
game.phase;          // 'banning' | 'moving'
game.banningPlayer;  // 'white' | 'black' | null
game.banMove();      // Ban move method
game.legalBans();    // Available bans
```

### Version Support

- Node.js: 14.x, 16.x, 18.x, 20.x
- TypeScript: 4.5+, 5.x  
- chess.ts: 0.16.x
- Browsers: Modern ES2020+ support

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/your-org/ban-chess.ts
cd ban-chess.ts
npm install
npm run build
npm test
```

### Areas for Contribution

- Performance optimizations
- Additional chess variant support  
- Analysis engine integration
- Mobile/touch interface improvements
- Accessibility enhancements

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [chess.ts](https://github.com/lubert/chess.ts) - Core chess library
- [next-chess](https://github.com/your-org/next-chess) - Full Ban Chess web application
- [ban-chess-engine](https://github.com/your-org/ban-chess-engine) - AI analysis engine

## Changelog

### v1.0.0
- Initial release with core Ban Chess mechanics
- Full chess.ts compatibility 
- Comprehensive test suite
- TypeScript definitions included

### v1.1.0 (Planned)
- Performance optimizations for large game trees
- Additional analysis methods
- Enhanced PGN export with ban annotations
- Browser compatibility improvements

---

**Ban Chess** brings new strategic depth to the classic game of chess. Whether you're building a chess application, researching chess variants, or just enjoying tactical complexity, ban-chess.ts provides the foundation you need.

For questions, issues, or feature requests, please visit our [GitHub repository](https://github.com/your-org/ban-chess.ts).