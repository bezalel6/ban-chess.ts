# ban-chess.ts

[![npm version](https://img.shields.io/npm/v/ban-chess.ts.svg)](https://www.npmjs.com/package/ban-chess.ts)
[![npm downloads](https://img.shields.io/npm/dm/ban-chess.ts.svg)](https://www.npmjs.com/package/ban-chess.ts)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A TypeScript wrapper library for implementing the **Ban Chess** variant on top of the `chess.ts` library. In Ban Chess, players must navigate around banned moves - each move is preceded by the opponent banning one of their legal options.

**Key concept**: Bans happen BEFORE moves. The opponent always bans one of your moves right before your turn, limiting your options. This is why Black bans first - they ban a White move before White's opening move.

## Try It Online

You can access this playground to test and experiment with the variant: **[https://bezalel6.github.io/ban-chess.ts/](https://bezalel6.github.io/ban-chess.ts/)**

## GUI

The interactive GUI for Ban Chess is maintained as a separate repository and included here as a git submodule:
- **GUI Repository**: [https://github.com/bezalel6/ban-chess-gui](https://github.com/bezalel6/ban-chess-gui)
- **Live Demo**: [https://bezalel6.github.io/ban-chess.ts/](https://bezalel6.github.io/ban-chess.ts/)

To clone this repository with the GUI:
```bash
git clone --recursive https://github.com/bezalel6/ban-chess.ts.git
```

To run the GUI locally:
```bash
cd gui
npm install
npm run dev
```

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

The key strategic element: When a king is in check and has only **one legal move** to escape, the opponent can achieve checkmate by banning that single escape move, leaving zero legal moves. The checkmate must be executed - it doesn't happen automatically.

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
  
  // Core method handling both bans and moves
  play(action: Action): ActionResult;
  
  // Query methods
  nextActionType(): 'ban' | 'move';
  legalMoves(): Move[];  // Excludes banned moves
  legalBans(): Move[];   // Opponent moves that can be banned
  
  // State properties
  turn: 'white' | 'black';
  currentBannedMove: Ban | null;
  
  // State management
  fen(): string;  // Returns extended FEN with ban state field
  pgn(): string;  // Returns PGN with ban annotations
  history(): HistoryEntry[];
  reset(): void;
  
  // Game status
  inCheck(): boolean;
  inCheckmate(): boolean;
  inStalemate(): boolean;
  gameOver(): boolean;
  
  // Indicator configuration (v2.0.0+)
  setIndicatorConfig(config: IndicatorConfig): void;
  getIndicatorConfig(): IndicatorConfig;
}
```

### Type Definitions

```typescript
type Action = { move: Move } | { ban: Ban };

interface Move {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

interface Ban {
  from: string;
  to: string;
  // No promotion field - bans apply to ALL moves from-to
}

interface ActionResult {
  success: boolean;
  action?: Action;
  san?: string;
  error?: string;
  newFen?: string;
  gameOver?: boolean;
  checkmate?: boolean;
  stalemate?: boolean;
}

interface IndicatorConfig {
  pgn?: boolean;         // Include indicators in PGN notation (default: true)
  serialization?: boolean; // Include indicators in serialized actions (default: true)
  san?: boolean;          // Include indicators in SAN notation (default: true)
}
```

## Serialization & Network Synchronization (v1.2.0+)

Ban Chess provides standardized serialization for efficient network communication between clients.

### Ban Chess Notation (BCN)

Compact string format for actions:
- **Ban**: `b:e2e4` (6 characters)
- **Move**: `m:d2d4` (6 characters) 
- **Promotion**: `m:e7e8q` (7-8 characters)
- **With indicators**: `m:d8h4#` (check/checkmate/stalemate indicators)

### Serialization API

```typescript
// Serialize actions
const serialized = BanChess.serializeAction({ ban: { from: 'e2', to: 'e4' } });
// Returns: "b:e2e4"

// Deserialize actions
const action = BanChess.deserializeAction('m:d2d4');
// Returns: { move: { from: 'd2', to: 'd4' } }

// Apply serialized actions directly
game.playSerializedAction('b:e2e4');

// Get sync state for network transmission
const syncState = game.getSyncState();
// Returns: { fen: string, lastAction?: string, moveNumber: number }

// Load from sync state
game.loadFromSyncState(syncState);

// Get complete action history
const history = game.getActionHistory();
// Returns: ['b:e2e4', 'm:d2d4', 'b:e7e5', 'm:d7d5']

// Replay game from actions
const game = BanChess.replayFromActions(history);
```

### Network Example

```typescript
// WebSocket - Send only the action (6-8 bytes)
ws.send(BanChess.serializeAction(action));

// REST API - Minimal payload
POST /api/game/action
{ "action": "b:e2e4" }
```

See [docs/SYNCHRONIZATION.md](docs/SYNCHRONIZATION.md) for complete implementation examples.

## Game State Indicators

The library supports standard chess notation indicators for game states:
- `+` for check
- `#` for checkmate  
- `=` for stalemate

These indicators appear in PGN, SAN, and serialized actions by default. You can configure where indicators appear:

```typescript
// Configure indicator display
game.setIndicatorConfig({
  pgn: true,          // Show indicators in PGN notation (default: true)
  serialization: true, // Show indicators in serialized actions (default: true)
  san: true           // Show indicators in SAN notation (default: true)
});

// Get current configuration
const config = game.getIndicatorConfig();

// Example with indicators disabled for serialization
game.setIndicatorConfig({ pgn: true, serialization: false, san: true });
const action = game.getLastActionSerialized(); // Returns "m:d8h4" instead of "m:d8h4#"
```

The library also detects unique Ban Chess scenarios where bans cause game endings:
- Banning the only escape from check results in checkmate
- Banning the only legal move results in stalemate

## Extended FEN Format

Ban Chess extends standard FEN with a 7th field for ban state:

```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 b:ban
```

Ban state field values:
- `b:ban` - Black's turn to ban
- `w:ban` - White's turn to ban  
- `b:e2e4` - Active ban (e2-e4 is currently banned)

## PGN Format

Ban Chess PGN includes ban annotations in comments:

```
1. {banning: e2e4} d4 {banning: e7e5} d5
2. {banning: d2d4} g4 {banning: h7h6} Qh4# 0-1
```

Each ban is recorded as `{banning: <from><to>}` before the affected move. Game state indicators (+, #, =) are included by default for both moves and bans that cause check, checkmate, or stalemate.

> **Note on notation format**: The library currently uses PGN comments (`{banning: ...}`) for ban notation to maintain compatibility with standard PGN parsers, while the serialization format uses the more compact `b:e2e4` notation for network efficiency. Future versions may consider unifying these formats based on community feedback, though this would be a breaking change.

## Complete Example

```typescript
import { BanChess } from 'ban-chess.ts';

const game = new BanChess();

// Full game example with optimal play understanding
game.play({ ban: { from: 'e2', to: 'e4' } });  // Black bans e4
game.play({ move: { from: 'd2', to: 'd4' } }); // White plays d4
game.play({ ban: { from: 'e7', to: 'e5' } });  // White bans e5
game.play({ move: { from: 'd7', to: 'd5' } }); // Black plays d5

// Continue playing...
console.log(game.pgn()); 
// Output: "1. {banning: e2e4} d4 {banning: e7e5} d5"

// Check game state
if (game.inCheckmate()) {
  console.log(`Checkmate! ${game.turn === 'white' ? 'Black' : 'White'} wins!`);
}

// Reset for a new game
game.reset();
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the library
npm run build

# Watch mode for development
npm run dev
```

## License

ISC © bezalel6

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [NPM Package](https://www.npmjs.com/package/ban-chess.ts)
- [GitHub Repository](https://github.com/bezalel6/ban-chess.ts)
- [GUI Repository](https://github.com/bezalel6/ban-chess-gui)
- [Live Demo](https://bezalel6.github.io/ban-chess.ts/)
- [Issues](https://github.com/bezalel6/ban-chess.ts/issues)