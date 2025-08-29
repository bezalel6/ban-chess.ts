# Changelog

All notable changes to ban-chess.ts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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