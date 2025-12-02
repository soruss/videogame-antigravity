import React, { useEffect, useRef } from 'react';
import { Engine } from '../game/Engine';

export const GameCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize engine
        engineRef.current = new Engine(canvasRef.current);
        engineRef.current.start();

        // Cleanup
        return () => {
            if (engineRef.current) {
                engineRef.current.cleanup();
                engineRef.current = null;
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{ display: 'block' }}
        />
    );
};
