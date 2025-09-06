#!/usr/bin/env node

import * as readline from 'readline';
import { BanChess } from './BanChess.js';
import type { Move, Ban } from './types.js';

// Ban Chess Notation (BCN):
// - Bans: algebraic notation (e.g., "e2e4" or "e2-e4")
// - Moves: SAN notation (e.g., "e4", "Nf3", "Qxf7+")

class BanChessCLI {
  private game: BanChess;
  private rl: readline.Interface;

  constructor(initialFen?: string) {
    this.game = initialFen ? new BanChess(initialFen) : new BanChess();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  start() {
    console.clear();
    console.log('=================================');
    console.log('      BAN CHESS CLI v1.0');
    console.log('=================================');
    console.log('\nBan Chess Notation (BCN):');
    console.log('  • Bans: use algebraic (e.g., "e2e4" or "e2-e4")');
    console.log('  • Moves: use SAN (e.g., "e4", "Nf3", "Qxf7+")');
    console.log('  • Commands: "board", "fen", "pgn", "history", "undo", "load", "help", "quit"');
    console.log('\n' + '='.repeat(50));
    
    this.showBoard();
    this.promptAction();
  }

  private showBoard() {
    console.log('\n' + this.game.ascii());
    
    if (this.game.inCheck()) {
      console.log('\n⚠️  CHECK!');
    }
    
    if (this.game.gameOver()) {
      console.log('\n🏁 GAME OVER!');
      if (this.game.inCheckmate()) {
        const winner = this.game.getActivePlayer() === 'white' ? 'Black' : 'White';
        console.log(`✓ Checkmate! ${winner} wins!`);
      } else if (this.game.inStalemate()) {
        console.log('= Stalemate!');
      } else {
        console.log('= Draw!');
      }
    }
  }

  private promptAction() {
    if (this.game.gameOver()) {
      this.rl.question('\nGame over. Enter "new" for new game or "quit" to exit: ', (input) => {
        if (input.toLowerCase() === 'new') {
          this.game.reset();
          console.clear();
          this.start();
        } else {
          this.rl.close();
          process.exit(0);
        }
      });
      return;
    }

    const actionType = this.game.nextActionType();
    const player = this.game.getActivePlayer();
    const ply = this.game.getPly();
    
    const prompt = actionType === 'ban' 
      ? `\n[Ply ${ply}] ${player.toUpperCase()} to BAN (e.g., "e2e4"): `
      : `\n[Ply ${ply}] ${player.toUpperCase()} to MOVE (e.g., "e4", "Nf3"): `;

    this.rl.question(prompt, (input) => {
      this.handleInput(input.trim());
    });
  }

  private handleInput(input: string) {
    // Handle special commands
    switch (input.toLowerCase()) {
      case 'board':
        this.showBoard();
        this.promptAction();
        return;
      case 'fen':
        console.log('\nFEN:', this.game.fen());
        this.promptAction();
        return;
      case 'pgn':
        console.log('\nPGN:', this.game.pgn());
        this.promptAction();
        return;
      case 'history':
        console.log('\nAction History:');
        this.game.getActionLog().forEach((action, i) => {
          console.log(`  ${i + 1}. ${action}`);
        });
        this.promptAction();
        return;
      case 'undo':
        if (this.game.undo()) {
          console.log('\n✓ Undid last action');
          this.showBoard();
        } else {
          console.log('\n❌ Nothing to undo');
        }
        this.promptAction();
        return;
      case 'load':
        this.promptFenLoad();
        return;
      case 'new':
        this.game.reset();
        console.log('\n✓ Started new game');
        this.showBoard();
        this.promptAction();
        return;
      case 'help':
        this.showHelp();
        this.promptAction();
        return;
      case 'quit':
      case 'exit':
        console.log('\nThanks for playing Ban Chess!');
        this.rl.close();
        process.exit(0);
        return;
    }

    // Try to play the action
    const actionType = this.game.nextActionType();
    
    if (actionType === 'ban') {
      this.handleBan(input);
    } else {
      this.handleMove(input);
    }
  }

  private handleBan(input: string) {
    // Parse ban input (accepts "e2e4" or "e2-e4")
    const cleanInput = input.replace('-', '').toLowerCase();
    const match = cleanInput.match(/^([a-h][1-8])([a-h][1-8])$/);
    
    if (!match) {
      console.log('\n❌ Invalid ban format! Use algebraic notation like "e2e4" or "e2-e4"');
      console.log('   You entered:', input);
      this.promptAction();
      return;
    }

    const [, from, to] = match;
    const ban: Ban = { from: from as any, to: to as any };
    
    // Check if this ban is legal
    const legalBans = this.game.legalBans();
    const isLegal = legalBans.some(b => b.from === ban.from && b.to === ban.to);
    
    if (!isLegal) {
      console.log(`\n❌ Illegal ban: ${from}-${to}`);
      console.log('   Reason: You can only ban your opponent\'s possible moves.');
      
      // Show some legal bans to help
      console.log('\n   Legal bans you can make:');
      legalBans.slice(0, 10).forEach(b => {
        console.log(`     • ${b.from}${b.to}`);
      });
      if (legalBans.length > 10) {
        console.log(`     ... and ${legalBans.length - 10} more`);
      }
      
      this.promptAction();
      return;
    }

    // Play the ban
    const result = this.game.play({ ban });
    
    if (result.success) {
      console.log(`\n✓ Banned: ${result.san}`);
      
      if (result.flags?.banCausedCheckmate) {
        console.log('💀 This ban causes CHECKMATE!');
      } else if (result.flags?.banCausedStalemate) {
        console.log('🤝 This ban causes STALEMATE!');
      } else if (result.flags?.check) {
        console.log('⚠️  This ban leaves the opponent in CHECK!');
      }
      
      this.showBoard();
      this.promptAction();
    } else {
      console.log(`\n❌ Failed to play ban: ${result.error}`);
      this.promptAction();
    }
  }

  private handleMove(input: string) {
    // First try to parse as SAN
    const legalMoves = this.game.legalMoves();
    
    // Try to find a matching move by SAN
    let matchingMove: Move | undefined;
    
    // Create a temporary chess instance to validate SAN
    for (const move of legalMoves) {
      // Get the SAN for this move by playing it temporarily
      const tempGame = new BanChess(this.game.fen());
      const result = tempGame.play({ move });
      
      if (result.success && result.san) {
        // Remove check/checkmate indicators for comparison
        const cleanSan = result.san.replace(/[+#]$/, '');
        const cleanInput = input.replace(/[+#]$/, '');
        
        if (cleanSan === cleanInput) {
          matchingMove = move;
          break;
        }
      }
    }

    // If no SAN match, try algebraic notation as fallback
    if (!matchingMove) {
      const cleanInput = input.replace('-', '').toLowerCase();
      const algebraicMatch = cleanInput.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
      
      if (algebraicMatch) {
        const [, from, to, promotion] = algebraicMatch;
        matchingMove = legalMoves.find(m => 
          m.from === from && 
          m.to === to && 
          (!promotion || m.promotion === promotion)
        );
      }
    }

    if (!matchingMove) {
      console.log(`\n❌ Invalid move: "${input}"`);
      console.log('   Reason: This move is either illegal, banned, or incorrectly formatted.');
      
      if (this.game.currentBannedMove) {
        console.log(`\n   Note: ${this.game.currentBannedMove.from}-${this.game.currentBannedMove.to} is currently BANNED!`);
      }
      
      // Show legal moves
      console.log('\n   Legal moves you can make:');
      const tempGame = new BanChess(this.game.fen());
      legalMoves.slice(0, 15).forEach(m => {
        const result = tempGame.play({ move: m });
        tempGame.undo();
        if (result.success) {
          console.log(`     • ${result.san} (or ${m.from}${m.to})`);
        }
      });
      if (legalMoves.length > 15) {
        console.log(`     ... and ${legalMoves.length - 15} more`);
      }
      
      this.promptAction();
      return;
    }

    // Play the move
    const result = this.game.play({ move: matchingMove });
    
    if (result.success) {
      console.log(`\n✓ Played: ${result.san}`);
      
      if (result.flags?.checkmate) {
        console.log('♔ CHECKMATE!');
      } else if (result.flags?.check) {
        console.log('♚ CHECK!');
      } else if (result.flags?.stalemate) {
        console.log('= STALEMATE!');
      }
      
      this.showBoard();
      this.promptAction();
    } else {
      console.log(`\n❌ Failed to play move: ${result.error}`);
      this.promptAction();
    }
  }

  private promptFenLoad() {
    this.rl.question('\nEnter FEN string (or "cancel" to abort): ', (input) => {
      if (input.toLowerCase() === 'cancel') {
        console.log('Load cancelled');
        this.promptAction();
        return;
      }
      
      try {
        // Validate Ban Chess FEN format
        const fenParts = input.trim().split(' ');
        
        if (fenParts.length < 6) {
          throw new Error('FEN must have at least 6 fields for standard chess');
        }
        
        // Check if it has Ban Chess extension (7th field)
        if (fenParts.length >= 7) {
          const banChessField = fenParts[6];
          
          // Validate the Ban Chess field format
          // Should be: ply[:fromto][indicator]
          // Examples: "1", "2:e2e4", "5:g7g6+", "10:e8f7#"
          const banChessPattern = /^(\d+)(:[a-h][1-8][a-h][1-8])?([+#=])?$/;
          
          if (!banChessPattern.test(banChessField)) {
            throw new Error(`Invalid Ban Chess field: "${banChessField}". Expected format: ply[:ban][indicator]`);
          }
          
          // Extract ply number
          const plyMatch = banChessField.match(/^(\d+)/);
          const ply = plyMatch ? parseInt(plyMatch[1]) : 1;
          
          // Validate ply makes sense (must be positive)
          if (ply < 1) {
            throw new Error(`Invalid ply number: ${ply}. Ply must be at least 1`);
          }
          
          // Check if there's a ban
          const banMatch = banChessField.match(/:([a-h][1-8])([a-h][1-8])/);
          
          // Validate ban vs ply logic
          if (banMatch) {
            // Bans only exist after odd plies (ply 1, 3, 5...)
            // At even plies, there should be no active ban
            if (ply % 2 === 1) {
              throw new Error(`Invalid state: Cannot have an active ban at ply ${ply} (ban phase)`);
            }
          } else {
            // No ban specified - valid for odd plies or even plies where ban was cleared
            // This is fine
          }
          
          // Check whose turn it should be based on ply
          const expectedTurn = this.getExpectedTurn(ply);
          const actualTurn = fenParts[1];
          
          // Validate turn matches ply
          if (actualTurn !== expectedTurn) {
            console.log(`\n⚠️  Warning: FEN says ${actualTurn} to move, but ply ${ply} expects ${expectedTurn}`);
          }
        } else {
          // No Ban Chess field - treat as ply 1
          console.log('Note: Loading standard FEN, starting at ply 1');
        }
        
        // Try to create the game
        this.game = new BanChess(input);
        console.log('\n✓ Position loaded from FEN');
        this.showBoard();
        this.promptAction();
      } catch (error) {
        console.log('\n❌ Invalid FEN string');
        if (error instanceof Error) {
          console.log(`   Error: ${error.message}`);
        }
        console.log('\n   Valid Ban Chess FEN format:');
        console.log('   [position] [turn] [castling] [ep] [halfmove] [fullmove] [ply[:ban][indicator]]');
        console.log('\n   Examples:');
        console.log('   Starting: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 1');
        console.log('   With ban: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 2:e2e4');
        console.log('   In check: rnbqkb1r/pppp1Qpp/5n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 1 1+');
        this.promptAction();
      }
    });
  }
  
  private getExpectedTurn(ply: number): string {
    // Determine whose pieces should move based on ply
    // Ply 1: Black bans (but chess position shows white to move)
    // Ply 2: White moves (chess shows white to move) 
    // Ply 3: White bans (but chess position shows black to move)
    // Ply 4: Black moves (chess shows black to move)
    // Pattern: odd plies = ban phase, even plies = move phase
    
    if (ply % 4 === 1 || ply % 4 === 2) {
      // Ply 1, 2, 5, 6, 9, 10... - White's pieces will move next
      return 'w';
    } else {
      // Ply 3, 4, 7, 8, 11, 12... - Black's pieces will move next
      return 'b';
    }
  }

  private showHelp() {
    console.log('\n📖 BAN CHESS CLI HELP');
    console.log('=' .repeat(40));
    console.log('\nGAME FLOW:');
    console.log('  1. Black bans one of White\'s moves');
    console.log('  2. White moves (with the ban in effect)');
    console.log('  3. White bans one of Black\'s moves');
    console.log('  4. Black moves (with the ban in effect)');
    console.log('  ... pattern continues ...');
    console.log('\nNOTATION:');
    console.log('  Bans:  Use algebraic like "e2e4" or "e2-e4"');
    console.log('  Moves: Use SAN like "e4", "Nf3", "Qxf7+"');
    console.log('\nCOMMANDS:');
    console.log('  board   - Show the current board');
    console.log('  fen     - Show current FEN string');
    console.log('  load    - Load position from FEN');
    console.log('  new     - Start a new game');
    console.log('  pgn     - Show PGN notation');
    console.log('  history - Show move history');
    console.log('  undo    - Undo last action');
    console.log('  help    - Show this help');
    console.log('  quit    - Exit the game');
  }
}

// Start the CLI
// Check for command-line arguments
const args = process.argv.slice(2);
let initialFen: string | undefined;

if (args.length > 0) {
  if (args[0] === '--fen' && args[1]) {
    initialFen = args[1];
    console.log('Loading position from command line FEN...');
  } else if (args[0] === '--help') {
    console.log('BAN CHESS CLI');
    console.log('Usage: npm run play [options]');
    console.log('Options:');
    console.log('  --fen "FEN_STRING"  Start with a specific position');
    console.log('  --help              Show this help');
    console.log('\nExample:');
    console.log('  npm run play --fen "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"');
    process.exit(0);
  }
}

const cli = new BanChessCLI(initialFen);
cli.start();