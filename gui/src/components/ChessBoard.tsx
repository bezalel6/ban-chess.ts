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
  try {
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
  } catch (e) {
    // Silent fail if audio doesn't work
  }
}

export function ChessBoard() {
  const [game] = useState(() => new BanChess());
  const [board, setBoard] = useState<(string | null)[][]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [selectedBan, setSelectedBan] = useState<Move | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [legalBans, setLegalBans] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [autoFlip, setAutoFlip] = useState(true);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    updateBoard();
  }, []);

  const updateBoard = () => {
    const fen = game.fen().split(' ')[0];
    const rows = fen.split('/');
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
    setBoard(parsedRows);
    setLegalMoves(game.legalMoves());
    setLegalBans(game.legalBans());
  };

  const getSquareColor = (rank: number, file: number) => {
    const isLight = (rank + file) % 2 === 0;
    return isLight ? 'square-light' : 'square-dark';
  };

  const getSquareNotation = (displayRank: number, displayFile: number) => {
    if (!flipped) {
      const rank = 8 - displayRank;
      return FILES[displayFile] + rank;
    } else {
      const rank = displayRank + 1;
      return FILES[7 - displayFile] + rank;
    }
  };

  const handleSquareClick = (displayRank: number, displayFile: number) => {
    const square = getSquareNotation(displayRank, displayFile);
    
    if (game.nextActionType() === 'ban') {
      // Find all bans involving this square
      const bansForSquare = legalBans.filter(ban => ban.from === square || ban.to === square);
      
      if (bansForSquare.length > 0) {
        // If we already have this ban selected, execute it
        if (selectedBan && (selectedBan.from === square || selectedBan.to === square)) {
          game.play({ ban: selectedBan });
          playSound(300, 150);
          setMoveHistory([...moveHistory, `🚫 ${selectedBan.from}→${selectedBan.to}`]);
          updateBoard();
          setSelectedBan(null);
        } else {
          // Select the first ban involving this square
          // In ban chess, each move can only be banned once, so this works
          setSelectedBan(bansForSquare[0]);
        }
      } else {
        setSelectedBan(null);
      }
    } else {
      if (selectedSquare) {
        const move = legalMoves.find(m => m.from === selectedSquare && m.to === square);
        if (move) {
          game.play({ move });
          playSound(600, 100);
          setMoveHistory([...moveHistory, `${move.from}→${move.to}`]);
          setLastMove({ from: move.from, to: move.to });
          updateBoard();
          setSelectedSquare(null);
          setSelectedBan(null);
        } else {
          const pieceAtSquare = getPieceAtSquare(displayRank, displayFile);
          if (pieceAtSquare && legalMoves.some(m => m.from === square)) {
            setSelectedSquare(square);
          } else {
            setSelectedSquare(null);
          }
        }
      } else {
        const pieceAtSquare = getPieceAtSquare(displayRank, displayFile);
        if (pieceAtSquare && legalMoves.some(m => m.from === square)) {
          setSelectedSquare(square);
        }
      }
    }
    
    forceUpdate({});
  };

  const getPieceAtSquare = (displayRank: number, displayFile: number) => {
    if (!flipped) {
      return board[displayRank]?.[displayFile];
    } else {
      return board[7 - displayRank]?.[7 - displayFile];
    }
  };

  const resetGame = () => {
    game.reset();
    setSelectedSquare(null);
    setSelectedBan(null);
    setLastMove(null);
    setMoveHistory([]);
    updateBoard();
    forceUpdate({});
  };

  const renderPiece = (piece: string) => {
    const isWhite = piece === piece.toUpperCase();
    const pieceType = piece.toUpperCase();
    const svgPath = PIECE_SVGS[pieceType];
    
    if (!svgPath) return null;
    
    return (
      <img 
        src={svgPath}
        alt={piece}
        className={`chess-piece ${isWhite ? 'piece-white' : 'piece-black'}`}
      />
    );
  };

  useEffect(() => {
    if (autoFlip) {
      const shouldFlip = game.turn === 'black';
      if (shouldFlip !== flipped) {
        setFlipped(shouldFlip);
      }
    }
  }, [game.turn, autoFlip]);

  return (
    <div className="container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Ban Chess</h1>
        <p className="subtitle">
          {game.gameOver() ? 'Game Over' : 'Click on a piece to select, then click destination'}
        </p>
      </div>

      {/* Game Info */}
      <div className="game-info">
        <div className="turn-indicator">
          <span className={game.turn === 'white' ? 'white-turn' : 'black-turn'}>
            Turn: {game.turn === 'white' ? 'White' : 'Black'}
          </span>
          <span className={`dot ${game.turn === 'white' ? 'dot-white' : 'dot-black'}`} />
        </div>

        <div className={`action-type ${game.nextActionType() === 'ban' ? 'ban' : 'move'}`}>
          Next: {game.nextActionType() === 'ban' ? '🚫 Ban a move' : '♟️ Make a move'}
        </div>

        {game.inCheckmate() && (
          <div className="game-status checkmate">♔ Checkmate!</div>
        )}
        {game.inCheck() && !game.inCheckmate() && (
          <div className="game-status check">♔ Check!</div>
        )}
      </div>

      {/* Board Container */}
      <div className="board-container">
        <div className="board-wrapper">
          {/* Rank labels (1-8) */}
          <div className="rank-labels">
            {Array.from({length: 8}, (_, i) => {
              const rank = flipped ? i + 1 : 8 - i;
              return <div key={i}>{rank}</div>;
            })}
          </div>

          {/* File labels (a-h) */}
          <div className="file-labels">
            {Array.from({length: 8}, (_, i) => {
              const file = flipped ? FILES[7 - i] : FILES[i];
              return <div key={i}>{file}</div>;
            })}
          </div>

          {/* Chess board grid */}
          <div className="chess-board">
            {[0,1,2,3,4,5,6,7].map(displayRank => 
              [0,1,2,3,4,5,6,7].map(displayFile => {
                const square = getSquareNotation(displayRank, displayFile);
                const piece = getPieceAtSquare(displayRank, displayFile);
                const isSelected = selectedSquare === square;
                const isLegalMove = game.nextActionType() === 'move' && 
                  selectedSquare && 
                  legalMoves.some(m => selectedSquare === m.from && square === m.to);
                const isLastMove = lastMove && (
                  lastMove.from === square || lastMove.to === square
                );
                // For bans: show all bannable moves, highlight selected ban
                const isBannable = game.nextActionType() === 'ban' && 
                  legalBans.some(ban => ban.from === square || ban.to === square);
                
                const isSelectedBan = selectedBan && 
                  (selectedBan.from === square || selectedBan.to === square);

                return (
                  <div
                    key={`${displayRank}-${displayFile}`}
                    onClick={() => handleSquareClick(displayRank, displayFile)}
                    className={`board-square ${getSquareColor(displayRank, displayFile)} ${
                      isSelected ? 'square-selected' : ''
                    } ${isLegalMove ? 'square-legal-move' : ''} ${
                      isLastMove ? 'square-last-move' : ''
                    } ${isBannable ? 'square-bannable' : ''} ${
                      isSelectedBan ? 'square-selected-ban' : ''
                    }`}>
                    {piece && renderPiece(piece)}
                    {isLegalMove && <div className="move-dot" />}
                    {isSelectedBan && <div className="ban-x">×</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button onClick={resetGame} className="btn btn-primary">New Game</button>
        <button onClick={() => setFlipped(!flipped)} className="btn">Flip Board</button>
        <button 
          onClick={() => setAutoFlip(!autoFlip)} 
          className={`btn ${autoFlip ? 'btn-success' : ''}`}>
          Auto-flip: {autoFlip ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Move History */}
      <div className="history-section">
        <h3 className="history-title">Move History</h3>
        <div className="move-history">
          {moveHistory.length > 0 ? (
            moveHistory.map((entry, i) => (
              <div key={i} className={`move-entry ${entry.startsWith('🚫') ? 'ban-entry' : ''}`}>
                {i + 1}. {entry}
              </div>
            ))
          ) : (
            <div className="move-entry">No moves yet</div>
          )}
        </div>
      </div>

      {/* Game Over Message */}
      {game.gameOver() && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <p>
            {game.inCheckmate() 
              ? `Checkmate! ${game.turn === 'white' ? 'Black' : 'White'} wins!`
              : 'Draw!'
            }
          </p>
        </div>
      )}
    </div>
  );
}