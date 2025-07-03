import React from "react";

interface GameTimerProps {
    timeRemaining: number;
    className?: string;
}

export const GameTimer: React.FC<GameTimerProps> = ({
    timeRemaining,
    className = "",
}) => {
    // Handle different timer modes:
    // timeRemaining >= 0: Countdown timer (normal/tournament mode)
    // timeRemaining < -1: Hide timer if < -1 (survival mode), or show elapsed time (time attack mode)
    // time attack uses format: -0.1 - elapsed_time, so < -1 means show elapsed time
    
    if (timeRemaining < -1) {
        // This is time attack mode - extract elapsed time
        const elapsedTime = Math.abs(timeRemaining + 0.1);
        
        // Format time as MM:SS.SS for time attack precision
        const formatElapsedTime = (seconds: number): string => {
            const mins = Math.floor(seconds / 60);
            const secs = (seconds % 60);

            if (mins > 0) {
                return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
            }
            return secs.toFixed(2);
        };

        return (
            <div className={`game-timer ${className}`}>
                {formatElapsedTime(elapsedTime)}
            </div>
        );
    } else if (timeRemaining < 0) {
        // Survival mode - hide timer (timeRemaining == -1)
        return null;
    }

    // Normal countdown mode
    // Format time as MM:SS or just SS for under a minute
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, "0")}`;
        }
        return secs.toString();
    };

    return (
        <div className={`game-timer ${className}`}>
            {formatTime(timeRemaining)}
        </div>
    );
};
