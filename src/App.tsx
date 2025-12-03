import { useEffect, useRef, useState } from 'react';
import { Engine, GameState } from './game/Engine';
import type { UIState } from './game/Engine';
import './index.css';

import { Analytics } from "@vercel/analytics/react"

// import { Joystick } from 'react-joystick-component';

// Custom Virtual Joystick Component
const VirtualJoystick = ({ onMove }: { onMove: (x: number, y: number) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleStart = (clientX: number, clientY: number) => {
    setActive(true);
    handleMove(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const maxDist = rect.width / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    setPosition({ x: dx, y: dy });
    onMove(dx / maxDist, -dy / maxDist); // Invert Y for game engine
  };

  const handleEnd = () => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  };

  // Touch Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation(); // Prevent shooting
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (active) handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    handleEnd();
  };

  // Mouse Handlers (for testing)
  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleStart(e.clientX, e.clientY);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (active) handleMove(e.clientX, e.clientY);
  };
  const onMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleEnd();
  };
  const onMouseLeave = () => {
    if (active) handleEnd();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-32 h-32 rounded-full bg-white/10 border-2 border-white/30 backdrop-blur-sm touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <div
        ref={stickRef}
        className="absolute w-12 h-12 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] pointer-events-none transition-transform duration-75"
        style={{
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
        }}
      />
    </div>
  );
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.COUNTDOWN);
  const [winnerText, setWinnerText] = useState('');
  const [uiState, setUiState] = useState<UIState | null>(null);
  const requestRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      engineRef.current = new Engine(canvasRef.current);
      engineRef.current.start();

      engineRef.current.onGameStateChange = (newState) => {
        setGameState(newState);
      };
      engineRef.current.onWinner = (winner) => {
        setWinnerText(winner);
      };

      // UI Update Loop
      const updateUI = () => {
        if (engineRef.current) {
          setUiState(engineRef.current.getUIState());
        }
        requestRef.current = requestAnimationFrame(updateUI);
      };
      requestRef.current = requestAnimationFrame(updateUI);

    } catch (e) {
      console.error("Engine Init Error:", e);
      setError((e as Error).message);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (engineRef.current) {
        engineRef.current.cleanup();
        engineRef.current = null;
      }
    };
  }, []);

  // Mobile Handlers
  // const handleJoystickMove = (event: any) => {
  //   if (engineRef.current) {
  //     engineRef.current.setJoystick(event.x, event.y);
  //   }
  // };

  // const handleJoystickStop = () => {
  //   if (engineRef.current) {
  //     engineRef.current.setJoystick(0, 0);
  //   }
  // };

  const handleDash = () => {
    if (engineRef.current) {
      engineRef.current.triggerDash();
    }
  };

  const handleCanvasTouch = (e: React.TouchEvent) => {
    // Prevent default to stop scrolling/zooming
    // e.preventDefault(); // Might block other interactions, test carefully

    if (engineRef.current && e.touches.length > 0) {
      // Use the first touch that isn't on the joystick/buttons (simplified: just use first touch)
      // Ideally we filter out touches on UI controls, but for "Tap to Shoot", we can just use the touch coordinates.
      // However, the joystick also triggers touches. We rely on the fact that the joystick captures its own events?
      // Actually, tapping the screen anywhere (except controls) should shoot.
      // Let's assume controls stop propagation or we check target.

      // Simple implementation: Just pass the touch to engine. 
      // If the user is using the joystick, that's a touch too.
      // We need to differentiate.
      // A simple way is to check if the target is the canvas.
      if ((e.target as HTMLElement).tagName === 'CANVAS') {
        const touch = e.touches[0];
        engineRef.current.handleTouchShoot(touch.clientX, touch.clientY);
      }
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.triggerRestart();
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-900 text-white font-sans">
        <div className="p-8 bg-black rounded border border-red-500">
          <h1 className="text-2xl font-bold mb-4">Game Error</h1>
          <pre className="text-red-300">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none touch-none">
      <Analytics />
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        onTouchStart={handleCanvasTouch}
      />

      {/* HUD Overlay */}
      {uiState && gameState !== GameState.GAME_OVER && (
        <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between z-10">

          {/* Top Left: Weapon & Ammo - Scaled */}
          <div className="flex flex-col gap-2 items-start origin-top-left scale-75">
            {uiState.weapon && (
              <div className="flex flex-col bg-slate-900/80 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm shadow-xl">
                <span className="text-slate-400 text-xs font-black tracking-widest uppercase mb-1">Weapon</span>
                <span className="text-3xl font-black text-white tracking-wider drop-shadow-lg uppercase">
                  {uiState.weapon}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-4xl font-black tracking-tighter ${uiState.ammo === 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {uiState.ammo}
                  </span>
                  <span className="text-slate-500 font-black text-lg">/ {uiState.maxAmmo}</span>
                </div>
                {/* Reload Bar */}
                {uiState.isReloading && (
                  <div className="w-full h-1 bg-slate-700 mt-2 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 animate-[width_1s_ease-in-out]" style={{ width: '100%' }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Left: Player Status - Scaled */}
          <div className="flex flex-col gap-4 w-96 origin-bottom-left scale-75">

            {/* Shield Bar (Blue, On Top) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-cyan-400 text-sm font-black tracking-widest uppercase drop-shadow-md">
                <span>Shield</span>
                <span>{Math.ceil(uiState.shield)} / {uiState.maxShield}</span>
              </div>
              <div className="h-4 bg-slate-900/90 rounded-sm overflow-hidden border border-slate-700/50 relative shadow-lg">
                <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)]" />
                <div
                  className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] transition-all duration-300 ease-out"
                  style={{ width: `${(uiState.shield / uiState.maxShield) * 100}%` }}
                />
              </div>
            </div>

            {/* Health Bar (Red, Below Shield) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-red-500 text-sm font-black tracking-widest uppercase drop-shadow-md">
                <span>Health</span>
                <span>{Math.ceil(uiState.health)} / {uiState.maxHealth}</span>
              </div>
              <div className="h-6 bg-slate-900/90 rounded-sm overflow-hidden border border-slate-700/50 relative shadow-lg">
                <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)]" />
                <div
                  className="h-full bg-gradient-to-r from-red-700 to-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all duration-300 ease-out"
                  style={{ width: `${(uiState.health / uiState.maxHealth) * 100}%` }}
                />
              </div>
            </div>

            {/* Dash Indicator */}
            <div className="flex items-center gap-3">
              <div className={`
                  px-4 py-2 rounded bg-slate-900/80 border border-slate-700/50 backdrop-blur-sm
                  flex items-center gap-3 transition-all duration-300
                  ${uiState.dashReady ? 'shadow-[0_0_15px_rgba(255,255,255,0.4)] border-white/50' : 'opacity-70'}
               `}>
                <span className="text-white font-black uppercase tracking-widest text-sm">Dash</span>
                <div className={`w-3 h-3 rounded-full ${uiState.dashReady ? 'bg-white shadow-[0_0_10px_#fff]' : 'bg-slate-600'}`} />
                {!uiState.dashReady && (
                  <span className="text-slate-400 font-black text-xs">
                    {uiState.dashCooldown.toFixed(1)}s
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Mobile Controls (Visible only on touch devices ideally, but showing always for now as requested) */}
      {gameState !== GameState.GAME_OVER && (
        <>
          {/* Custom Virtual Joystick */}
          <div className="fixed bottom-12 left-12 z-[9999]" style={{ pointerEvents: 'auto' }}>
            <VirtualJoystick onMove={(x, y) => engineRef.current?.setJoystick(x, y)} />
          </div>

          {/* DEBUG: State Indicator */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] text-white text-2xl font-black bg-black/50 p-4">
            STATE: {gameState}
          </div>

          {/* Dash Button (Bottom Right) */}
          <div className="fixed bottom-12 right-12 z-[9999]" style={{ pointerEvents: 'auto' }}>
            <button
              className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all active:scale-95 ${uiState?.dashReady ? 'bg-cyan-500/40 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]' : 'bg-gray-800/50 border-gray-600 opacity-50'}`}
              onTouchStart={(e) => { e.stopPropagation(); handleDash(); }}
              onMouseDown={(e) => { e.stopPropagation(); handleDash(); }}
            >
              <span className="text-white font-black text-lg uppercase tracking-wider">DASH</span>
            </button>
          </div>
        </>
      )}


      {/* Game Over / Victory Screen - NUCLEAR OPTION: Inline Styles */}
      {gameState === GameState.GAME_OVER && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          pointerEvents: 'auto',
          transition: 'all 0.5s ease-in-out'
        }}>
          <h1 style={{
            fontSize: '8rem',
            fontWeight: '900',
            fontStyle: 'italic',
            color: winnerText === 'VICTORY!' ? '#FACC15' : '#DC2626', // Yellow or Red
            textShadow: winnerText === 'VICTORY!' ? '0 0 50px rgba(250, 204, 21, 0.8)' : '0 0 60px rgba(220, 38, 38, 0.8)',
            marginBottom: '2rem',
            lineHeight: '1',
            WebkitTextStroke: '2px rgba(255,255,255,0.2)'
          }}>
            {winnerText === 'Player' ? 'VICTORY!' : winnerText}
          </h1>

          <div style={{ width: '300px', height: '4px', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '2px', marginBottom: '3rem' }} />

          <p style={{
            color: 'white',
            fontSize: '2rem',
            fontWeight: 'bold',
            letterSpacing: '0.5em',
            textShadow: '0 0 20px rgba(255,255,255,0.5)',
            marginBottom: '2rem'
          }}>
            PRESS <span style={{ color: '#FACC15', fontSize: '2.5rem', margin: '0 10px' }}>R</span> TO RESTART
          </p>

          {/* Mobile Restart Button */}
          <button
            onClick={handleRestart}
            onTouchStart={handleRestart}
            className="px-8 py-4 bg-white text-black font-black text-xl rounded-full hover:scale-105 active:scale-95 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          >
            TAP TO RESTART
          </button>
        </div>
      )}

      {/* Stopwatch - Fixed & Styled (Top Right) */}
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}>
        <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm shadow-xl flex flex-col items-center"
          style={{
            width: '160px',
            minWidth: '160px',
            maxWidth: '160px',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}>
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">TIME</span>
          <span className="text-xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] font-mono tabular-nums">
            {
              (() => {
                if (!uiState) return '00:00.00';
                const ms = Math.floor(uiState.elapsedTime);
                const minutes = Math.floor(ms / 60000);
                const seconds = Math.floor((ms % 60000) / 1000);
                const centiseconds = Math.floor((ms % 1000) / 10);
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
              })()
            }
          </span>
        </div>
      </div>

      {/* Players Alive - Fixed & Styled (Below Stopwatch) */}
      <div style={{
        position: 'fixed',
        top: '120px', // Below the Stopwatch box
        right: '24px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}>
        <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700/50 backdrop-blur-sm shadow-xl flex flex-col items-center min-w-[120px]">
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">PLAYERS</span>
          <span className="text-5xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {uiState ? uiState.aliveCount : '?'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
