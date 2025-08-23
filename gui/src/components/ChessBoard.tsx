import { useState, useEffect, useRef } from 'preact/hooks';
import { BanChess } from 'ban-chess.ts';
import type { Move, Ban } from 'ban-chess.ts';

const PIECE_SVGS: Record<string, string> = {
  'K': '/chess-king.svg',
  'Q': '/chess-queen.svg', 
  'R': '/chess-rook.svg',
  'B': '/chess-bishop.svg',
  'N': '/chess-knight.svg',
  'P': '/chess-pawn.svg'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

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
  const [, forceUpdate] = useState({});

  useEffect(() => {
    updateBoard();
  }, []);

  const updateBoard = () => {
    const fen = game.fen().split(' ')[0];
    const rows = fen.split('/');
    const newBoard = rows.map(row => {
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
    setBoard(newBoard);
    setLegalMoves(game.legalMoves());
    setLegalBans(game.legalBans());
  };

  const getSquareColor = (rank: number, file: number) => {
    const isLight = (rank + file) % 2 === 0;
    return isLight ? 'bg-yellow-100' : 'bg-yellow-700';
  };

  const getSquareNotation = (displayRank: number, displayFile: number) => {
    // Convert display coordinates to actual board coordinates
    const actualRank = flipped ? 7 - displayRank : displayRank;
    const actualFile = flipped ? 7 - displayFile : displayFile;
    return FILES[actualFile] + RANKS[actualRank];
  };
  
  const getBoardSquare = (displayRank: number, displayFile: number) => {
    // Get the actual piece at this display position
    const actualRank = flipped ? 7 - displayRank : displayRank;
    const actualFile = flipped ? 7 - displayFile : displayFile;
    return board[actualRank]?.[actualFile] || null;
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

  const getPieceSvg = (piece: string | null, rank: number, file: number) => {
    if (!piece) return null;
    
    const isWhite = piece === piece.toUpperCase();
    const pieceType = piece.toUpperCase();
    const svgPath = PIECE_SVGS[pieceType];
    
    if (!svgPath) return null;
    
    return (
      <img 
        src={svgPath}
        alt={piece}
        className={`w-10 h-10 md:w-12 md:h-12 select-none pointer-events-none ${
          isWhite ? 'filter brightness-100' : 'filter brightness-0'
        }`}
        style={{
          filter: isWhite ? 'none' : 'invert(1)'
        }}
      />
    );
  };

  return (
    <div className="flex flex-col items-center p-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Ban Chess</h1>
      
      {/* Game State */}
      <div className="mb-4 p-4 bg-gray-100 rounded-lg w-full">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Turn:</strong> {game.turn === 'white' ? '⚪ White' : '⚫ Black'}
          </div>
          <div>
            <strong>Action:</strong> {game.nextActionType() === 'ban' ? '🚫 Ban' : '♟️ Move'}
          </div>
          <div>
            <strong>Banned Move:</strong> {game.currentBannedMove ? 
              `${game.currentBannedMove.from}-${game.currentBannedMove.to}` : 'None'}
          </div>
          <div>
            <strong>Check:</strong> {game.inCheck() ? '⚠️ Yes' : 'No'}
          </div>
        </div>
        {game.gameOver() && (
          <div className="mt-2 text-center font-bold text-lg">
            {game.inCheckmate() ? '👑 Checkmate!' : '🤝 Stalemate!'}
          </div>
        )}
      </div>

      {/* Chess Board */}
      <div className="relative">
        <div className="absolute -top-6 left-0 right-0 flex justify-around px-6">
          {(flipped ? [...FILES].reverse() : FILES).map(file => (
            <div key={file} className="text-xs font-bold text-gray-600">{file}</div>
          ))}
        </div>
        <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-around py-6">
          {(flipped ? [...RANKS].reverse() : RANKS).map(rank => (
            <div key={rank} className="text-xs font-bold text-gray-600">{rank}</div>
          ))}
        </div>
        
        <div className="border-4 border-gray-800">
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
                    className={`
                      w-12 h-12 md:w-16 md:h-16 flex items-center justify-center
                      cursor-pointer relative transition-all duration-200
                      ${getSquareColor(displayRank, displayFile)}
                      ${isSelected ? 'ring-4 ring-blue-500 ring-inset z-10 scale-105' : ''}
                      ${isLegal ? 'ring-4 ring-green-400 ring-inset' : ''}
                      ${canSelect && !isSelected ? 'hover:brightness-110' : ''}
                      ${!canSelect && !isLegal && selectedSquare ? 'opacity-50' : ''}
                    `}
                  >
                    {/* Background highlights */}
                    {isLastMoveFrom && (
                      <div className="absolute inset-0 bg-yellow-400 opacity-40" />
                    )}
                    {isLastMoveTo && (
                      <div className="absolute inset-0 bg-yellow-500 opacity-40" />
                    )}
                    {isBanned && (
                      <div className="absolute inset-0 bg-red-500 opacity-30" />
                    )}
                    
                    {/* Legal move indicator */}
                    {isLegal && !piece && (
                      <div className="absolute w-3 h-3 bg-green-400 rounded-full opacity-70" />
                    )}
                    
                    {/* Piece */}
                    <div className="relative z-10">
                      {getPieceSvg(piece, displayRank, displayFile)}
                    </div>
                    
                    {/* Ban indicator overlay */}
                    {isBanned && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-red-600 text-2xl font-bold opacity-50">×</div>
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
      <div className="flex gap-2 mt-6 mb-4">
        <button
          onClick={resetGame}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          New Game
        </button>
        <button
          onClick={() => {
            playSound(500, 50);
            setFlipped(!flipped);
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Flip Board
        </button>
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600 max-w-md text-center">
        <p className="mb-2">
          <strong>How to play:</strong> Click a piece, then click target square.
        </p>
        <p>
          {game.nextActionType() === 'ban' 
            ? `${game.turn} must ban one of opponent's moves`
            : `${game.turn} must make a move (avoiding banned square)`
          }
        </p>
      </div>

      {/* Live Internal State */}
      <div className="mt-4 w-full space-y-4">
        {/* FEN Display */}
        <div className="p-4 bg-gray-50 rounded">
          <strong className="text-sm">FEN (Live Internal State):</strong>
          <div className="font-mono text-xs mt-1 break-all bg-white p-2 rounded">
            {game.fen()}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            7th field shows ban state: <span className="font-mono bg-yellow-100 px-1">
              {game.fen().split(' ')[6] || 'N/A'}
            </span>
          </div>
        </div>

        {/* PGN Display */}
        <div className="p-4 bg-gray-50 rounded">
          <strong className="text-sm">PGN (Move History):</strong>
          <div className="font-mono text-xs mt-1 bg-white p-2 rounded">
            {game.pgn() || 'No moves yet'}
          </div>
        </div>

        {/* History Details */}
        <details className="p-4 bg-gray-50 rounded">
          <summary className="cursor-pointer text-sm font-bold">History Details (Click to expand)</summary>
          <div className="mt-2 max-h-60 overflow-y-auto">
            <pre className="text-xs">
              {JSON.stringify(game.history(), null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}