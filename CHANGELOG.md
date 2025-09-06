# Changelog

All notable changes to ban-chess.ts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2025-01-06

### Added
- **Interactive CLI**: New command-line interface for playing Ban Chess
  - Supports Ban Chess Notation (BCN): algebraic for bans (e2e4), SAN for moves (Nf3, Qxf7+)
  - Commands: board, fen, load, new, pgn, history, undo, help, quit
  - Smart error messages that explain why moves are illegal
  - ASCII board visualization with banned square indicators
  - Checkmate detection and announcement
  - FEN loading/saving with strict validation
  - Command-line arguments: `--fen` to start with position, `--help` for usage
- **Undo Functionality**: New `undo()` method to revert the last action
  - Correctly handles both ban and move undos
  - Restores board position and active bans
  - Maintains proper game state and history
  - Returns `true` if undo was successful, `false` if nothing to undo
- **Strict FEN Validation**: Enhanced FEN parsing with Ban Chess validation
  - Validates ply field format: `ply[:ban][indicator]`
  - Ensures bans only exist at even plies (after moves)
  - Validates square notation (a-h, 1-8)
  - Throws descriptive errors for invalid FEN strings

### Changed
- **FEN Loading**: Now strictly validates Ban Chess FEN format
  - Standard FEN without 7th field defaults to ply 1
  - Invalid Ban Chess fields are rejected with clear error messages

### Fixed
- Checkmate detection for ban-caused checkmates now working correctly
- FEN parsing properly validates game state consistency

## [3.1.0] - 2025-01-04

### Added
- **Enhanced FEN Format with Game State Indicators**: The extended FEN format now includes PGN-style indicators for game state
  - Check indicator (`+`) appended when king is in check
  - Checkmate indicator (`#`) appended when game ends in checkmate
  - Stalemate/Draw indicator (`=`) appended for stalemate or draw positions
  - Format: `[standard FEN] [ply[:ban][indicator]]`
  - Examples:
    - Check: `rnb1kbnr/pppp1ppp/4p3/8/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3 9+`
    - Checkmate: `rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3 9#`
    - Stalemate: `7k/5Q2/8/8/8/8/8/K7 b - - 0 1 5=`
- **Automatic State Detection**: FEN strings now automatically include appropriate indicators based on current game state
- **Backwards Compatible Parsing**: FEN parser handles both new format with indicators and legacy format without

### Changed
- FEN type definitions updated to document the new indicator format
- `fen()` method now appends PGN indicators when applicable
- `loadFromFEN()` method extracts and handles PGN indicators

## [1.2.2] - 2025-08-29

### Fixed
- Fixed TypeScript configuration to properly include VERSION in type definitions
- Fixed build process to correctly generate type declarations

## [1.2.1] - 2025-08-29

### Added
- `BanChess.VERSION` static property for runtime version checking
- Automatic version injection during build process
- Version display in GUI header

### Fixed
- GUI now uses 'latest' tag to always get newest library version
- GitHub Pages deployment workflow for submodule structure

## [1.2.0] - 2025-08-29

### Added
- **Ban Chess Notation (BCN)**: Standardized compact serialization format for actions
  - `b:fromto` for bans (e.g., `b:e2e4`)
  - `m:fromto[promotion]` for moves (e.g., `m:d2d4`, `m:e7e8q`)
- **Serialization API**: New methods for network synchronization
  - `BanChess.serializeAction()` - Convert actions to compact strings
  - `BanChess.deserializeAction()` - Parse strings back to action objects
  - `playSerializedAction()` - Apply serialized actions directly
  - `getLastActionSerialized()` - Get the most recent action as a string
  - `getActionHistory()` - Get all game actions as serialized strings
  - `BanChess.replayFromActions()` - Reconstruct games from action sequences
- **State Synchronization**: Methods for efficient client synchronization
  - `getSyncState()` - Get minimal state object for network transmission
  - `loadFromSyncState()` - Load game from sync state
- **New Exported Types**:
  - `SerializedAction` - Type for serialized action strings
  - `SyncState` - Interface for synchronization state objects
  - `Square`, `File`, `Rank` - Chess coordinate types
- **Documentation**: 
  - Comprehensive SYNCHRONIZATION.md guide with implementation examples
  - WebSocket and REST API integration patterns
  - Conflict resolution strategies
- **Tests**: 20+ new tests for serialization features

### Changed
- Updated README with serialization documentation and examples
- Separated GUI into independent repository as git submodule

### Fixed
- Improved type exports for better TypeScript support

## [1.1.3] - 2025-08-28

### Added
- Strict type safety for chess square coordinates
- prepublishOnly script to ensure build before publish

## [1.1.2] - 2025-08-28

### Fixed
- Build configuration improvements

## [1.1.1] - 2025-08-28

### Added
- Initial public release of ban-chess.ts
- Core BanChess class implementing the Ban Chess variant
- Extended FEN format with 7th field for ban state
- PGN support with ban annotations
- Complete test suite
- TypeScript type definitions
- GUI demonstration application

## [1.0.0] - 2025-08-27

### Added
- Initial implementation of Ban Chess rules
- Basic game flow: ban → move → ban → move pattern
- Legal move and ban calculation
- Checkmate and stalemate detection
- Game history tracking
- Reset functionality

[1.2.0]: https://github.com/bezalel6/ban-chess.ts/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/bezalel6/ban-chess.ts/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/bezalel6/ban-chess.ts/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/bezalel6/ban-chess.ts/compare/v1.0.0...v1.1.1
[1.0.0]: https://github.com/bezalel6/ban-chess.ts/releases/tag/v1.0.0