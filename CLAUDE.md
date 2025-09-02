# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ban-chess.ts is a mature TypeScript wrapper library (v3.0.0) for implementing the Ban Chess variant on top of the chess.ts library. Ban Chess is a chess variant where moves get banned BEFORE a player makes their move - the opponent bans one of your possible moves right before your turn.

**Version 3.0.0** introduces a cleaner ply-based API that makes the game flow crystal clear. Each ban and each move is now treated as a separate ply, eliminating confusion about whose "turn" it is.

## Key Game Mechanics

**CRITICAL**: The game flow follows this strict pattern:
1. Black bans one of White's possible opening moves (before White has moved)
2. White plays their first move (with Black's ban in effect)
3. White bans one of Black's possible moves (before Black moves)
4. Black plays their first move (with White's ban in effect)
5. Black bans one of White's next moves (before White moves again)
6. Pattern continues: Ban → Move → Ban → Move...

**Important Rules**:
- Bans ALWAYS precede moves (opponent bans before you move)
- Bans are square-to-square (e.g., banning e7-e8 blocks ALL promotions)
- Players cannot pass on banning
- If a king in check has only one escape move, it's checkmate (that move will be banned)

## Project Structure (Current)

```
ban-chess.ts/
├── src/
│   ├── BanChess.ts         # Main class with ply-based API
│   ├── types.ts            # TypeScript type definitions
│   ├── index.ts            # Main exports
│   └── version.ts          # Auto-generated version info
├── tests/                   # Comprehensive test suite
│   ├── BanChess.test.ts    # Core functionality tests
│   ├── chess-patterns.test.ts
│   ├── game-ending.test.ts
│   ├── game-notation.test.ts
│   ├── indicator-config.test.ts
│   └── serialization.test.ts
├── docs/
│   └── SYNCHRONIZATION.md   # Network sync guide
├── gui/                     # GUI submodule (separate repo)
├── scripts/                 # Build automation
├── dist/                    # Built files (CJS + ESM)
├── package.json
├── tsconfig*.json          # Multiple TS configs
├── CHANGELOG.md
└── README.md
```

## Development Setup

The project is fully set up and production-ready. For development:

```bash
# Clone with GUI submodule
git clone --recursive https://github.com/bezalel6/ban-chess.ts.git
cd ban-chess.ts

# Install dependencies
npm install

# Run tests
npm test

# Build library
npm run build

# Development watch mode
npm run dev
```

## Available Scripts

The project includes these production scripts:

```json
{
  "scripts": {
    "build": "npm run build:cjs && npm run build:esm",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "build:esm": "tsc -p tsconfig.esm.json",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch",
    "release": "npm version patch && npm publish && git push --follow-tags"
  }
}
```

## Core API Design (v3.0.0 - Ply-Based)

The main `BanChess` class provides a clear ply-based API:

```typescript
class BanChess {
  constructor(fen?: string, pgn?: string);
  
  // NEW v3.0.0 - Ply-based API (RECOMMENDED)
  getPly(): number;                        // Current ply (1, 2, 3...)
  getActivePlayer(): 'white' | 'black';    // Who acts at current ply
  getActionType(): 'ban' | 'move';         // What action type at current ply
  getLegalActions(): Action[];             // All legal actions at current ply
  
  // Core method handling both bans and moves
  play(action: Action): ActionResult;
  
  // LEGACY methods (deprecated but supported)
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
  
  // Serialization (v1.2.0+)
  static serializeAction(action: Action): SerializedAction;
  static deserializeAction(serialized: SerializedAction): Action;
  playSerializedAction(serialized: SerializedAction): ActionResult;
  getSyncState(): SyncState;
  loadFromSyncState(state: SyncState): void;
  getActionHistory(): SerializedAction[];
  static replayFromActions(actions: SerializedAction[]): BanChess;
  
  // Indicator configuration (v2.0.0+)
  setIndicatorConfig(config: IndicatorConfig): void;
  getIndicatorConfig(): IndicatorConfig;
}
```

## Type Definitions

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
```

## Implementation Guidelines

1. **Ban Mechanics**: Bans must be applied BEFORE the opponent's move, not after
2. **State Management**: Track whose action it is (ban or move) at each step
3. **FEN Extension**: Add 7th field for ply and ban state:
   - `1` - Ply 1 (Black's turn to ban)
   - `2:e2e4` - Ply 2 with e2-e4 banned  
   - `3` - Ply 3 (White's turn to ban)
   - `4:e7e5` - Ply 4 with e7-e5 banned
   
   The ply number determines everything:
   - Odd plies (1,3,5...): Restriction phase
   - Even plies (2,4,6...): Move phase
   - Active player and action type derive from ply
4. **PGN Format**: Use comments for bans: `{banning: e2e4}` before the affected move
5. **Validation**: Ensure bans are legal (can only ban opponent's possible moves)
6. **Checkmate Logic**: If only one escape from check exists, checkmate can be achieved by banning that move

## Testing Priorities

1. **Core Flow**: Test the ban-before-move sequence
2. **Edge Cases**: 
   - Checkmate via banning the only escape
   - Promotion bans (blocking all promotion types)
   - Stalemate scenarios
3. **chess.ts Compatibility**: Ensure all base methods still work

## Common Pitfalls to Avoid

1. **DO NOT** implement bans as happening after moves
2. **DO NOT** allow promotion-specific bans (bans are square-to-square)
3. **DO NOT** let players pass on banning
4. **DO NOT** confuse whose "turn" it is vs who performs the action

## GUI Implementation Critical Notes

### Highlighting System Architecture
The chess board highlighting system uses a **unified selection model** that is critical for proper functionality:

#### Core Principles
1. **Single Selection State**: Use ONE `selectedSquare` state for both moves and bans - DO NOT separate into `selectedSquare` and `selectedBan`
2. **Helper Functions Required**: The following helper functions are essential and must not be removed:
   - `isLegalTarget(square)`: Checks if a square is a valid target for the current action (move or ban)
   - `canSelectSquare(square)`: Checks if a piece/ban can be selected from this square
   - `getPieceAtSquare(displayRank, displayFile)`: Handles board orientation (flipped/normal) - NEVER access board array directly

#### Visual Feedback Classes
The highlighting system uses these CSS classes that must all be maintained:
- `square-selected`: Currently selected square (with scale transform)
- `square-legal-move`: Valid target squares (green border)
- `square-last-move-from` / `square-last-move-to`: Previous move highlighting
- `square-banned`: Shows the currently banned move
- `square-can-select`: Hoverable pieces that can be selected
- `square-inactive`: Non-selectable squares when a piece is selected (opacity: 0.4)

#### Why This Architecture
This unified approach was restored after a failed attempt to separate ban and move logic led to broken highlighting. The single selection state with helper functions provides:
- Consistent behavior for both moves and bans
- Proper handling of board flipping
- Clear visual feedback for all game states
- Simpler, more maintainable code

**WARNING**: Previous attempts to "fix" highlighting by separating ban selection logic or removing helper functions broke the system. Always test highlighting works in both normal and flipped board orientations after any changes.

## Dependencies

- `chess.ts@^0.16.2` - Core chess logic (required)
- TypeScript 5.9+ required (for proper type support)
- Node.js 16+ required
- Jest 30+ for testing
- Dual package support (CJS + ESM)