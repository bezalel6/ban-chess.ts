import { useState, useEffect } from 'preact/hooks';
import { BanChess, Move, Ban } from 'ban-chess.ts';

const PIECES: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function ChessBoard() {
  const [game] = useState(() => new BanChess());
  const [board, setBoard] = useState<(string | null)[][]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [legalBans, setLegalBans] = useState<Move[]>([]);
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
    return isLight ? 'bg-amber-200' : 'bg-amber-600';
  };

  const getSquareNotation = (rank: number, file: number) => {
    return FILES[file] + RANKS[rank];
  };

  const isLegalTarget = (square: string) => {
    if (game.nextActionType() === 'move') {
      return legalMoves.some(m => m.from === selectedSquare && m.to === square);
    } else {
      return legalBans.some(b => b.from === selectedSquare && b.to === square);
    }
  };

  const handleSquareClick = (rank: number, file: number) => {
    const square = getSquareNotation(rank, file);
    
    if (!selectedSquare) {
      setSelectedSquare(square);
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
        updateBoard();
        setSelectedSquare(null);
        forceUpdate({});
      }
    } else {
      setSelectedSquare(square);
    }
  };

  const resetGame = () => {
    game.reset();
    updateBoard();
    setSelectedSquare(null);
    forceUpdate({});
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
      <div className="border-4 border-gray-800 mb-4">
        <div className="grid grid-cols-8 gap-0">
          {board.map((row, rankIndex) => 
            row.map((piece, fileIndex) => {
              const square = getSquareNotation(rankIndex, fileIndex);
              const isSelected = square === selectedSquare;
              const isLegal = selectedSquare && isLegalTarget(square);
              const isBanned = game.currentBannedMove && 
                game.currentBannedMove.from === square;
              
              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(rankIndex, fileIndex)}
                  className={`
                    w-12 h-12 md:w-16 md:h-16 flex items-center justify-center
                    cursor-pointer text-3xl md:text-4xl font-bold
                    ${getSquareColor(rankIndex, fileIndex)}
                    ${isSelected ? 'ring-4 ring-blue-500' : ''}
                    ${isLegal ? 'ring-4 ring-green-400' : ''}
                    ${isBanned ? 'opacity-50 bg-red-400' : ''}
                    hover:brightness-110
                  `}
                >
                  {piece && PIECES[piece]}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={resetGame}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          New Game
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
            7th field shows ban state: {game.fen().split(' ')[6] || 'N/A'}
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