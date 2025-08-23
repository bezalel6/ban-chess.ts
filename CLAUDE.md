# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ban-chess.ts is a TypeScript wrapper library for implementing the Ban Chess variant on top of the chess.ts library. Ban Chess is a chess variant where moves get banned BEFORE a player makes their move - the opponent bans one of your possible moves right before your turn.

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

## Project Structure (Planned)

```
ban-chess.ts/
├── src/
│   ├── BanChess.ts         # Main class extending chess.ts
│   ├── types.ts             # TypeScript type definitions
│   └── utils.ts             # Helper functions
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── performance/         # Performance benchmarks
├── examples/                # Usage examples
├── package.json
├── tsconfig.json
└── README.md
```

## Development Setup

Since the project is in initial setup phase, here are the necessary steps:

```bash
# Initialize the project (if not done)
npm init -y

# Install dependencies
npm install chess.ts@^0.16.2
npm install --save-dev typescript @types/node jest @types/jest ts-jest

# Initialize TypeScript config
npx tsc --init
```

## Recommended package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint . --ext .ts",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  }
}
```

## Core API Design

The main `BanChess` class should extend chess.ts functionality:

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
3. **FEN Extension**: Add 7th field for ban state:
   - `b:[from][to]` - Active ban (e.g., `b:e2e4`)
   - `w:ban` - White's turn to ban
   - `b:ban` - Black's turn to ban
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
- TypeScript 4.5+ recommended
- Node.js 14+ required