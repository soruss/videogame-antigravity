import React, { useEffect, useState } from 'react';

interface KillBannerProps {
    active: boolean;
}

export const KillBanner: React.FC<KillBannerProps> = ({ active }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (active) {
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), 2000); // Hide after 2s
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [active]);

    if (!visible) return null;

    return (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none z-50">
            <div className="relative w-32 h-32 animate-kill-pop">
                {/* Outer Ring (Spinning) */}
                <div className="absolute inset-0 animate-spin-slow">
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="20 10" opacity="0.6" />
                        <path d="M50 5 L50 15 M50 85 L50 95 M5 50 L15 50 M85 50 L95 50" stroke="#22d3ee" strokeWidth="3" />
                    </svg>
                </div>

                {/* Inner Ring (Reverse Spin) */}
                <div className="absolute inset-4 animate-spin-reverse">
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="5 5" opacity="0.4" />
                    </svg>
                </div>

                {/* Skull Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-16 h-16 text-white drop-shadow-[0_0_15px_rgba(255,255,255,1)]" fill="currentColor">
                        <path d="M12 2C7.58 2 4 5.58 4 10C4 12.03 4.76 13.87 6 15.28V20C6 21.1 6.9 22 8 22H16C17.1 22 18 21.1 18 20V15.28C19.24 13.87 20 12.03 20 10C20 5.58 16.42 2 12 2ZM9 11C8.45 11 8 10.55 8 10C8 9.45 8.45 9 9 9C9.55 9 10 9.45 10 10C10 10.55 9.55 11 9 11ZM15 11C14.45 11 14 10.55 14 10C14 9.45 14.45 9 15 9C15.55 9 16 9.45 16 10C16 10.55 15.55 11 15 11ZM12 18C10.67 18 9.5 17.33 9 16.5H15C14.5 17.33 13.33 18 12 18Z" />
                    </svg>
                </div>

                {/* Glow Burst */}
                <div className="absolute inset-0 bg-cyan-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
            </div>
        </div>
    );
};
