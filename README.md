# ban-chess.ts

[![npm version](https://img.shields.io/npm/v/ban-chess.ts.svg)](https://www.npmjs.com/package/ban-chess.ts)
[![npm downloads](https://img.shields.io/npm/dm/ban-chess.ts.svg)](https://www.npmjs.com/package/ban-chess.ts)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A TypeScript wrapper library for implementing the **Ban Chess** variant on top of the `chess.ts` library. In Ban Chess, players must navigate around banned moves - each move is preceded by the opponent banning one of their legal options.

**Version 3.0.0** introduces a cleaner ply-based API that makes the game flow crystal clear. Each ban and each move is now treated as a separate ply, eliminating confusion about whose "turn" it is.

**Latest**: Automated GUI updates ensure the live demo always uses the newest library version.

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

Ban Chess follows a ply-based model where each restriction (ban) and each move is a separate ply:

- **Ply 1**: Black restricts one of White's opening moves
- **Ply 2**: White moves (with Black's restriction in effect)
- **Ply 3**: White restricts one of Black's responses
- **Ply 4**: Black moves (with White's restriction in effect)
- **Ply 5**: Black restricts one of White's next moves
- **Ply 6**: White moves (with Black's restriction in effect)
- **Pattern continues**: Odd plies = restrictions, Even plies = moves

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

// Ply 1: Black restricts a White move
console.log(game.getPly()); // 1
console.log(game.getActivePlayer()); // 'black'
console.log(game.getActionType()); // 'ban'
game.play({ ban: { from: 'e2', to: 'e4' } });

// Ply 2: White moves (with e2-e4 banned)
console.log(game.getPly()); // 2
console.log(game.getActivePlayer()); // 'white'
console.log(game.getActionType()); // 'move'
const actions = game.getLegalActions(); // e2-e4 is NOT available
game.play({ move: { from: 'd2', to: 'd4' } });

// Ply 3: White restricts a Black move
console.log(game.getPly()); // 3
console.log(game.getActivePlayer()); // 'white'
console.log(game.getActionType()); // 'ban'
game.play({ ban: { from: 'e7', to: 'e5' } });

// Ply 4: Black moves (with e7-e5 banned)
console.log(game.getPly()); // 4
console.log(game.getActivePlayer()); // 'black'
console.log(game.getActionType()); // 'move'
game.play({ move: { from: 'd7', to: 'd5' } });

// Pattern continues with clear ply progression
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
  
  // NEW in v3.0.0 - Ply-based API
  getPly(): number;                        // Current ply (1, 2, 3...)
  getActivePlayer(): 'white' | 'black';    // Who acts at current ply
  getActionType(): 'ban' | 'move';         // What action type at current ply
  getLegalActions(): Action[];             // All legal actions at current ply
  
  // Legacy methods (deprecated but still supported)
  nextActionType(): 'ban' | 'move';        // Use getActionType() instead
  legalMoves(): Move[];                    // Use getLegalActions() instead
  legalBans(): Move[];                     // Use getLegalActions() instead
  turn: 'white' | 'black';                 // Use getActivePlayer() instead
  
  // State properties
  currentBannedMove: Ban | null;
  
  // State management
  fen(): string;  // Returns extended FEN with ply number
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

Ban Chess extends standard FEN with a 7th field containing the ply number and optional ban:

```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 1
```

Field 7 format:
- `1` - Ply 1 (Black's turn to ban)
- `2:e2e4` - Ply 2 with e2-e4 banned  
- `3` - Ply 3 (White's turn to ban)
- `4:e7e5` - Ply 4 with e7-e5 banned

The ply number determines everything:
- Odd plies (1,3,5...): Restriction phase
- Even plies (2,4,6...): Move phase
- Active player and action type derive from ply

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

// Full game example using the new ply-based API
console.log(`Ply ${game.getPly()}: ${game.getActivePlayer()} to ${game.getActionType()}`);
// Output: "Ply 1: black to ban"

game.play({ ban: { from: 'e2', to: 'e4' } });  // Ply 1: Black bans e4
game.play({ move: { from: 'd2', to: 'd4' } }); // Ply 2: White moves d4
game.play({ ban: { from: 'e7', to: 'e5' } });  // Ply 3: White bans e5
game.play({ move: { from: 'd7', to: 'd5' } }); // Ply 4: Black moves d5

// The API makes it crystal clear who acts and what they should do
const actions = game.getLegalActions();
const player = game.getActivePlayer();
console.log(`${player} has ${actions.length} legal actions at ply ${game.getPly()}`);

// Check game state
if (game.inCheckmate()) {
  const winner = game.getActivePlayer() === 'white' ? 'Black' : 'White';
  console.log(`Checkmate! ${winner} wins!`);
}

// Reset for a new game
game.reset();
console.log(game.getPly()); // Back to ply 1
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