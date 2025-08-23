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
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [legalBans, setLegalBans] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [autoFlip, setAutoFlip] = useState(true);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [, forceUpdate] = useState({});
  
  // Visual customization states
  const [boardSize, setBoardSize] = useState(4);
  const [strokeWidth, setStrokeWidth] = useState(16);
  const [strokeOpacity, setStrokeOpacity] = useState(1);
  const [pieceContrast, setPieceContrast] = useState(1);
  const [pieceBrightness, setPieceBrightness] = useState(1);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    updateBoard();
  }, []);

  // Update CSS variables when settings change
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--board-size', `${boardSize}rem`);
    root.style.setProperty('--stroke-width', `${strokeWidth}`);
    root.style.setProperty('--stroke-opacity', `${strokeOpacity}`);
    root.style.setProperty('--piece-contrast', `${pieceContrast}`);
    root.style.setProperty('--piece-brightness', `${pieceBrightness}`);
  }, [boardSize, strokeWidth, strokeOpacity, pieceContrast, pieceBrightness]);

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

  const handleSquareClick = (displayRank: number, displayFile: number) => {
    const square = getSquareNotation(displayRank, displayFile);
    
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
        
        if (game.nextActionType() === 'move') {
          setMoveHistory([...moveHistory, `🚫 ${selectedSquare}→${square}`]);
        } else {
          setMoveHistory([...moveHistory, `${selectedSquare}→${square}`]);
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

  const getPieceAtSquare = (displayRank: number, displayFile: number) => {
    if (!flipped) {
      return board[displayRank]?.[displayFile];
    } else {
      return board[7 - displayRank]?.[7 - displayFile];
    }
  };

  const resetGame = () => {
    playSound(1000, 100);
    game.reset();
    setSelectedSquare(null);
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
      <div 
        className="piece-wrapper"
        style={{
          opacity: strokeOpacity
        }}
      >
        <img 
          src={svgPath}
          alt={piece}
          className={`chess-piece ${isWhite ? 'piece-white' : 'piece-black'}`}
        />
      </div>
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
        <div className="header-content">
          <img src={`${BASE_PATH}logo.png`} alt="Ban Chess Logo" className="header-logo" />
          <div className="header-text">
            <h1 className="page-title">Ban Chess</h1>
            <p className="subtitle">
              {game.gameOver() ? 'Game Over' : 'Click on a piece to select, then click destination'}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Controls */}
      <div className="controls-section">
        <button 
          className="btn btn-secondary controls-toggle"
          onClick={() => setShowControls(!showControls)}
        >
          {showControls ? '🎨 Hide Controls' : '🎨 Show Controls'}
        </button>
        
        {showControls && (
          <div className="controls-panel">
            <div className="control-group">
              <label className="control-label">
                Board Size: {boardSize}rem
              </label>
              <input
                type="range"
                min="3"
                max="8"
                step="0.5"
                value={boardSize}
                onChange={(e) => setBoardSize(parseFloat(e.target.value))}
                className="control-slider"
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                Stroke Width: {strokeWidth}px
              </label>
              <input
                type="range"
                min="0"
                max="32"
                step="2"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                className="control-slider"
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                Stroke Opacity: {Math.round(strokeOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={strokeOpacity}
                onChange={(e) => setStrokeOpacity(parseFloat(e.target.value))}
                className="control-slider"
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                Piece Contrast: {Math.round(pieceContrast * 100)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={pieceContrast}
                onChange={(e) => setPieceContrast(parseFloat(e.target.value))}
                className="control-slider"
              />
            </div>

            <div className="control-group">
              <label className="control-label">
                Piece Brightness: {Math.round(pieceBrightness * 100)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={pieceBrightness}
                onChange={(e) => setPieceBrightness(parseFloat(e.target.value))}
                className="control-slider"
              />
            </div>
          </div>
        )}
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
                    className={`board-square ${getSquareColor(displayRank, displayFile)} ${
                      isSelected ? 'square-selected' : ''
                    } ${isLegal ? 'square-legal-move' : ''} ${
                      isLastMoveFrom ? 'square-last-move-from' : ''
                    } ${isLastMoveTo ? 'square-last-move-to' : ''} ${
                      isBanned ? 'square-banned' : ''
                    } ${canSelect && !isSelected ? 'square-can-select' : ''} ${
                      !canSelect && !isLegal && selectedSquare ? 'square-inactive' : ''
                    }`}>
                    {piece && renderPiece(piece)}
                    {isLegal && !piece && <div className="move-dot" />}
                    {isBanned && (
                      <div className="ban-overlay">
                        <div className="ban-x">×</div>
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