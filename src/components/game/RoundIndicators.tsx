import React from "react";

interface RoundIndicatorsProps {
    totalRounds: number;
    wonRounds: number;
    className?: string;
    gameMode?: string;
}

export const RoundIndicators: React.FC<RoundIndicatorsProps> = ({
    totalRounds,
    wonRounds,
    className = "",
    gameMode,
}) => {
    // Special handling for modes with totalRounds = 0 (text-based display)
    if (totalRounds === 0) {
        // Different text for different game modes
        if (gameMode === "timeattack") {
            // Time Attack: only show progress for player 1 (opponents defeated)
            // For player 2 side, don't show anything as it's not meaningful
            if (wonRounds > 0) {
                return (
                    <div className={`text-sm text-white font-bold ${className}`}>
                        Defeated: {wonRounds}
                    </div>
                );
            }
            return null;
        } else {
            // Survival mode: show completed rounds
            if (wonRounds > 0) {
                return (
                    <div className={`text-sm text-white font-bold ${className}`}>
                        Rounds Completed: {wonRounds}
                    </div>
                );
            }
        }
        // Don't show anything if no progress yet
        return null;
    }

    // Normal/Tournament mode with fixed total rounds (totalRounds = 2 for best-of-3)
    // Show round indicators as visual dots
    return (
        <div className={`flex gap-2 ${className}`}>
            {Array.from({ length: totalRounds }, (_, index) => (
                <div
                    key={index}
                    className={`w-4 h-4 rounded-full border-2 ${
                        index < wonRounds 
                            ? "bg-yellow-400 border-yellow-400" 
                            : "bg-transparent border-gray-400"
                    }`}
                    title={`Round ${index + 1} ${index < wonRounds ? "Won" : "Pending"}`}
                />
            ))}
        </div>
    );
};

