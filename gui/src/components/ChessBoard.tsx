import { useState, useEffect } from 'preact/hooks';
import { BanChess } from 'ban-chess.ts';
import type { Move } from 'ban-chess.ts';

const BASE_PATH = import.meta.env.BASE_URL;
const PIECE_SVGS: Record<string, string> = {
  'K': `${BASE_PATH}chess-king.svg`,
  'Q': `${BASE_PATH}chess-queen.svg`, 
  'R': `${BASE_PATH}chess-rook.svg`,
  'B': `${BASE_PATH}chess-bishop.svg`,
  'N': `${BASE_PATH}chess-knight.svg`,
  'P': `${BASE_PATH}chess-pawn.svg`
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Simple audio using Web Audio API
function playSound(frequency: number, duration: number = 100) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration / 1000);
}

export function ChessBoard() {
  const [game] = useState(() => new BanChess());
  const [board, setBoard] = useState<(string | null)[][]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [legalBans, setLegalBans] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [autoFlip, setAutoFlip] = useState(true);
  const [darkTheme, setDarkTheme] = useState(true);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    updateBoard();
  }, []);

  const updateBoard = () => {
    const fen = game.fen().split(' ')[0];
    const rows = fen.split('/');
    // FEN starts from rank 8 (index 0) to rank 1 (index 7)
    // Parse each row
    const parsedRows = rows.map(row => {
      const squares = [];
      for (const char of row) {
        if (isNaN(parseInt(char))) {
          squares.push(char);
        } else {
          for (let i = 0; i < parseInt(char); i++) {
            squares.push(null);
          }
        }
      }
      return squares;
    });
    // Keep FEN order: index 0 = rank 8 (black's back rank), index 7 = rank 1 (white's back rank)
    setBoard(parsedRows);
    setLegalMoves(game.legalMoves());
    setLegalBans(game.legalBans());
  };

  const getSquareColor = (rank: number, file: number) => {
    const isLight = (rank + file) % 2 === 0;
    if (darkTheme) {
      return isLight ? 'bg-gray-700' : 'bg-gray-900';
    } else {
      return isLight ? 'bg-amber-100' : 'bg-amber-700';
    }
  };

  const getSquareNotation = (displayRank: number, displayFile: number) => {
    // Display row 0 = top of screen, row 7 = bottom of screen
    
    if (!flipped) {
      // Normal view: white at bottom
      // Display row 0 (top) = rank 8, Display row 7 (bottom) = rank 1
      const rank = 8 - displayRank;  // 0->8, 1->7, ..., 7->1
      return FILES[displayFile] + rank;
    } else {
      // Flipped view: black at bottom
      // Display row 0 (top) = rank 1, Display row 7 (bottom) = rank 8
      const rank = displayRank + 1;  // 0->1, 1->2, ..., 7->8
      return FILES[7 - displayFile] + rank;
    }
  };
  
  const getBoardSquare = (displayRank: number, displayFile: number) => {
    // Board array: index 0 = rank 8 (black's back rank), index 7 = rank 1 (white's back rank)
    // Display: row 0 = top of screen, row 7 = bottom of screen
    
    if (!flipped) {
      // Normal view: white at bottom
      // Display row 0 (top) should show rank 8 (board[0])
      // Display row 7 (bottom) should show rank 1 (board[7])
      return board[displayRank]?.[displayFile] || null;
    } else {
      // Flipped view: black at bottom  
      // Display row 0 (top) should show rank 1 (board[7])
      // Display row 7 (bottom) should show rank 8 (board[0])
      return board[7 - displayRank]?.[7 - displayFile] || null;
    }
  };

  const isLegalTarget = (square: string) => {
    if (!selectedSquare) return false;
    if (game.nextActionType() === 'move') {
      return legalMoves.some(m => m.from === selectedSquare && m.to === square);
    } else {
      return legalBans.some(b => b.from === selectedSquare && b.to === square);
    }
  };

  const canSelectSquare = (square: string) => {
    if (game.nextActionType() === 'move') {
      return legalMoves.some(m => m.from === square);
    } else {
      return legalBans.some(b => b.from === square);
    }
  };

  const handleSquareClick = (rank: number, file: number) => {
    const square = getSquareNotation(rank, file);
    
    // Play click sound
    playSound(600, 50);
    
    if (!selectedSquare) {
      if (canSelectSquare(square)) {
        setSelectedSquare(square);
      }
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare(null);
      return;
    }

    if (isLegalTarget(square)) {
      const action = game.nextActionType() === 'move' 
        ? { move: { from: selectedSquare, to: square } }
        : { ban: { from: selectedSquare, to: square } };
      
      const result = game.play(action);
      if (result.success) {
        // Play different sounds for move vs ban
        if (game.nextActionType() === 'ban') {
          playSound(800, 150); // Higher pitch for move
        } else {
          playSound(400, 200); // Lower pitch for ban
        }
        
        setLastMove({ from: selectedSquare, to: square });
        updateBoard();
        setSelectedSquare(null);
        forceUpdate({});
        
        // Check for game over
        if (game.gameOver()) {
          setTimeout(() => {
            playSound(200, 500); // Deep sound for game over
          }, 200);
        }
      }
    } else if (canSelectSquare(square)) {
      setSelectedSquare(square);
    }
  };

  const resetGame = () => {
    playSound(1000, 100);
    game.reset();
    updateBoard();
    setSelectedSquare(null);
    setLastMove(null);
    forceUpdate({});
  };

  const getPieceSvg = (piece: string | null) => {
    if (!piece) return null;
    
    const isWhite = piece === piece.toUpperCase();
    const pieceType = piece.toUpperCase();
    const svgPath = PIECE_SVGS[pieceType];
    
    if (!svgPath) return null;
    
    return (
      <img 
        src={svgPath}
        alt={piece}
        className={`select-none pointer-events-none`}
        style={{
          width: '40px',
          height: '40px',
          maxWidth: '100%',
          maxHeight: '100%',
          filter: isWhite 
            ? 'invert(1) drop-shadow(1px 0 0 rgba(0,0,0,0.4)) drop-shadow(0 1px 0 rgba(0,0,0,0.4))' 
            : 'drop-shadow(1px 0 0 rgba(255,255,255,0.4)) drop-shadow(0 1px 0 rgba(255,255,255,0.4))'
        }}
      />
    );
  };

  // Auto-flip board based on whose turn it is
  useEffect(() => {
    if (autoFlip) {
      const shouldFlip = game.turn === 'black';
      if (shouldFlip !== flipped) {
        setFlipped(shouldFlip);
      }
    }
  }, [game.turn, autoFlip]);

  // Generate game state message
  const getGameStateMessage = () => {
    if (game.gameOver()) {
      if (game.inCheckmate()) {
        return `Checkmate! ${game.turn === 'white' ? 'Black' : 'White'} wins!`;
      }
      return 'Stalemate - Draw!';
    }

    const currentPlayer = game.turn === 'white' ? 'White' : 'Black';
    const opponent = game.turn === 'white' ? 'Black' : 'White';
    
    if (game.nextActionType() === 'ban') {
      return `${currentPlayer} is selecting a move to ban. ${opponent} will then play.`;
    } else {
      const bannedInfo = game.currentBannedMove 
        ? ` (${game.currentBannedMove.from}→${game.currentBannedMove.to} is banned)`
        : '';
      return `${currentPlayer} to move${bannedInfo}`;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkTheme ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'
    }`}>
      <div className="flex flex-col items-center p-4 max-w-4xl mx-auto">
        
        {/* Header with title */}
        <h1 className={`text-4xl font-bold mb-6 ${
          darkTheme ? 'text-gray-100' : 'text-gray-900'
        }`}>Ban Chess</h1>
        
        {/* Prominent Game State Banner */}
        <div className={`mb-6 p-4 rounded-lg w-full text-center text-white ${
          game.gameOver() 
            ? 'bg-gradient-to-r from-purple-900 to-purple-700' 
            : game.nextActionType() === 'ban'
            ? 'bg-gradient-to-r from-red-900 to-red-700'
            : 'bg-gradient-to-r from-blue-900 to-blue-700'
        }`}>
          <div className="text-xl font-semibold">
            {getGameStateMessage()}
          </div>
          {game.inCheck() && !game.gameOver() && (
            <div className="text-yellow-400 mt-1">⚠️ Check!</div>
          )}
        </div>

      {/* Chess Board */}
      <div className="relative">
        <div className="absolute -top-6 left-0 right-0 flex justify-around px-6">
          {(flipped ? [...FILES].reverse() : FILES).map(file => (
            <div key={file} className={`text-xs font-bold ${
              darkTheme ? 'text-gray-400' : 'text-gray-600'
            }`}>{file}</div>
          ))}
        </div>
        <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-around py-6">
          {(flipped ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1']).map(rank => (
            <div key={rank} className={`text-xs font-bold ${
              darkTheme ? 'text-gray-400' : 'text-gray-600'
            }`}>{rank}</div>
          ))}
        </div>
        
        <div className={`border-4 shadow-2xl ${
          darkTheme ? 'border-gray-600' : 'border-gray-800'
        }`}>
          <div className="grid grid-cols-8 gap-0">
            {[0,1,2,3,4,5,6,7].map(displayRank => 
              [0,1,2,3,4,5,6,7].map(displayFile => {
                const square = getSquareNotation(displayRank, displayFile);
                const piece = getBoardSquare(displayRank, displayFile);
                const isSelected = square === selectedSquare;
                const isLegal = selectedSquare && isLegalTarget(square);
                const isBanned = game.currentBannedMove && 
                  (game.currentBannedMove.from === square || game.currentBannedMove.to === square);
                const isLastMoveFrom = lastMove?.from === square;
                const isLastMoveTo = lastMove?.to === square;
                const canSelect = canSelectSquare(square);
                
                return (
                  <div
                    key={`${displayRank}-${displayFile}`}
                    onClick={() => handleSquareClick(displayRank, displayFile)}
                    style={{
                      width: '60px',
                      height: '60px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s'
                    }}
                    className={`
                      ${getSquareColor(displayRank, displayFile)}
                      ${isSelected ? 'ring-4 ring-cyan-400 ring-inset z-10 scale-105' : ''}
                      ${isLegal ? 'ring-4 ring-emerald-400 ring-inset' : ''}
                      ${canSelect && !isSelected ? 'hover:brightness-125' : ''}
                      ${!canSelect && !isLegal && selectedSquare ? 'opacity-40' : ''}
                    `}
                  >
                    {/* Background highlights */}
                    {isLastMoveFrom && (
                      <div className="absolute inset-0 bg-amber-400 opacity-30" />
                    )}
                    {isLastMoveTo && (
                      <div className="absolute inset-0 bg-amber-500 opacity-30" />
                    )}
                    {isBanned && (
                      <div className="absolute inset-0 bg-red-600 opacity-40" />
                    )}
                    
                    {/* Legal move indicator */}
                    {isLegal && !piece && (
                      <div className="absolute w-3 h-3 bg-emerald-400 rounded-full opacity-80" />
                    )}
                    
                    {/* Piece */}
                    <div className="relative z-10">
                      {getPieceSvg(piece)}
                    </div>
                    
                    {/* Ban indicator overlay */}
                    {isBanned && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-red-500 text-3xl font-bold opacity-70">×</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mt-6 mb-6 flex-wrap justify-center">
        <button
          onClick={resetGame}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
        >
          New Game
        </button>
        <button
          onClick={() => {
            playSound(500, 50);
            setFlipped(!flipped);
            setAutoFlip(false);
          }}
          className={`px-5 py-2.5 rounded-lg transition-colors font-medium shadow-lg ${
            darkTheme
              ? 'bg-gray-700 text-white hover:bg-gray-600'
              : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
          }`}
        >
          Flip Board
        </button>
        <button
          onClick={() => {
            playSound(500, 50);
            setAutoFlip(!autoFlip);
          }}
          className={`px-5 py-2.5 rounded-lg transition-colors font-medium shadow-lg ${
            autoFlip 
              ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
              : darkTheme
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
          }`}
        >
          Auto-Flip: {autoFlip ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => {
            playSound(500, 50);
            setDarkTheme(!darkTheme);
          }}
          className={`px-5 py-2.5 rounded-lg transition-colors font-medium shadow-lg ${
            darkTheme
              ? 'bg-gray-700 text-white hover:bg-gray-600'
              : 'bg-gray-300 text-gray-900 hover:bg-gray-400'
          }`}
        >
          {darkTheme ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* Live Internal State - Collapsible */}
      <details className="mt-8 w-full">
        <summary className={`cursor-pointer text-sm font-medium transition-colors ${
          darkTheme 
            ? 'text-gray-400 hover:text-gray-200'
            : 'text-gray-600 hover:text-gray-900'
        }`}>
          View Debug Information
        </summary>
        <div className="mt-4 w-full space-y-4">
          {/* FEN Display */}
          <div className={`p-4 rounded-lg border ${
            darkTheme
              ? 'bg-gray-800 border-gray-700'
              : 'bg-gray-100 border-gray-300'
          }`}>
            <strong className={`text-sm ${
              darkTheme ? 'text-gray-300' : 'text-gray-700'
            }`}>FEN (Live Internal State):</strong>
            <div className={`font-mono text-xs mt-1 break-all p-2 rounded ${
              darkTheme
                ? 'bg-gray-900 text-gray-400'
                : 'bg-white text-gray-600'
            }`}>
              {game.fen()}
            </div>
            <div className={`text-xs mt-1 ${
              darkTheme ? 'text-gray-500' : 'text-gray-600'
            }`}>
              7th field shows ban state: <span className={`font-mono px-1 ${
                darkTheme
                  ? 'bg-gray-700 text-amber-400'
                  : 'bg-yellow-100 text-amber-700'
              }`}>
                {game.fen().split(' ')[6] || 'N/A'}
              </span>
            </div>
          </div>

          {/* PGN Display */}
          <div className={`p-4 rounded-lg border ${
            darkTheme
              ? 'bg-gray-800 border-gray-700'
              : 'bg-gray-100 border-gray-300'
          }`}>
            <strong className={`text-sm ${
              darkTheme ? 'text-gray-300' : 'text-gray-700'
            }`}>PGN (Move History):</strong>
            <div className={`font-mono text-xs mt-1 p-2 rounded ${
              darkTheme
                ? 'bg-gray-900 text-gray-400'
                : 'bg-white text-gray-600'
            }`}>
              {game.pgn() || 'No moves yet'}
            </div>
          </div>

          {/* History Details */}
          <details className={`p-4 rounded-lg border ${
            darkTheme
              ? 'bg-gray-800 border-gray-700'
              : 'bg-gray-100 border-gray-300'
          }`}>
            <summary className={`cursor-pointer text-sm font-bold ${
              darkTheme ? 'text-gray-300' : 'text-gray-700'
            }`}>History Details</summary>
            <div className="mt-2 max-h-60 overflow-y-auto">
              <pre className={`text-xs ${
                darkTheme ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {JSON.stringify(game.history(), null, 2)}
              </pre>
            </div>
          </details>
        </div>
      </details>
      
      </div>
    </div>
  );
}