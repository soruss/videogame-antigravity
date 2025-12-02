import { useEffect, useRef, useState } from 'react';
import { Engine, GameState } from './game/Engine';
import './index.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [debugText, setDebugText] = useState<string>("Initializing...");
  const [gameState, setGameState] = useState<GameState>(GameState.COUNTDOWN);
  const [winnerText, setWinnerText] = useState('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("App mounted");
    setDebugText("App mounted");

    if (!canvasRef.current) {
      console.error("Canvas not found!");
      setDebugText("Error: Canvas not found");
      return;
    }

    console.log("Initializing Engine...");
    try {
      engineRef.current = new Engine(canvasRef.current);
      console.log("Engine initialized");
      engineRef.current.start();
      console.log("Engine started");
      setDebugText("Engine running");

      // Add event listeners for game state changes and winner
      engineRef.current.onGameStateChange = (newState) => {
        setGameState(newState);
      };
      engineRef.current.onWinner = (winner) => {
        setWinnerText(winner);
      };

    } catch (e) {
      console.error("Engine Initialization Error:", e);
      const errorMessage = (e as Error).message;
      setDebugText("Error: " + errorMessage);
      setError("Engine Initialization Error: " + errorMessage); // Set error state
    }

    return () => {
      console.log("Cleaning up Engine...");
      if (engineRef.current) {
        engineRef.current.cleanup();
        engineRef.current = null;
      }
    };
  }, []);

  // Conditional rendering based on error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-900 text-white">
        <div className="p-8 bg-black rounded border border-red-500">
          <h1 className="text-2xl font-bold mb-4">Game Error</h1>
          <pre className="text-red-300">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full" />
      {/* Removed: <div className="absolute top-0 left-0 bg-white text-black p-2 z-50">DEBUG: React is rendering</div> */}

      {/* UI Overlay */}
      <div className={`absolute inset-0 pointer-events-none flex items-center justify-center transition-all duration-1000 ${gameState === GameState.GAME_OVER ? 'backdrop-blur-md bg-black/40' : ''}`}>
        {gameState === GameState.GAME_OVER && (
          <div className="text-center animate-in fade-in zoom-in duration-500">
            <h1 className={`text-8xl font-bold mb-4 drop-shadow-lg ${winnerText === 'VICTORY!' ? 'text-green-500' : 'text-red-500'}`}
              style={{ textShadow: '0 0 20px currentColor' }}>
              {winnerText}
            </h1>
            <p className="text-white text-2xl font-light tracking-widest animate-pulse">
              PRESS <span className="font-bold text-yellow-400">R</span> TO RESTART
            </p>
          </div>
        )}
      </div>
    </div>
  );
}



export default App;
