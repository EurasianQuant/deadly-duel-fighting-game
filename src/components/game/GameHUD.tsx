import React, { useState, useEffect } from "react";

import { useGameStore } from "@/state/stores/gameStore";
import EventBus from "@/lib/EventBus";

import { GameTimer } from "./GameTimer";
import { HealthBar } from "./HealthBar";
import { RoundIndicators } from "./RoundIndicators";
// NetworkStatus removed - offline game only

interface GameHUDProps {
    className?: string;
}

export const GameHUD: React.FC<GameHUDProps> = ({ className = "" }) => {
    // Get live game data from store
    const players = useGameStore((state) => state.players);
    const roundTimeLeft = useGameStore((state) => state.roundTimeLeft);
    const maxRounds = useGameStore((state) => state.maxRounds);
    const matchScore = useGameStore((state) => state.matchScore);
    // Network mode removed - offline game only
    
    // Countdown state
    const [countdownValue, setCountdownValue] = useState<number>(0);
    const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
    
    // Listen for countdown events
    useEffect(() => {
        const handleCountdownUpdate = (data: { value: number; isCountingDown: boolean }) => {
            setCountdownValue(data.value);
            setIsCountingDown(data.isCountingDown);
        };
        
        EventBus.on("countdown-update" as any, handleCountdownUpdate);
        
        return () => {
            EventBus.off("countdown-update" as any, handleCountdownUpdate);
        };
    }, []);

    // Get player data safely
    const player1 = players["player1"];
    const player2 = players["player2"];

    // Don't render if players aren't loaded yet
    if (!player1 || !player2) {
        return null;
    }

    // Detect game mode based on context
    // Time Attack: maxRounds = 0 and matchScore.player2 represents total opponents
    // Survival: maxRounds = 0 and matchScore.player2 = 0 (not used)
    const isTimeAttackMode = maxRounds === 0 && (matchScore[player2.id] || 0) > 0;
    const gameMode = isTimeAttackMode ? "timeattack" : undefined;

    return (
        <div className={`absolute top-0 left-0 right-0 z-10 p-4 ${className}`}>

            {/* Countdown Overlay */}
            {isCountingDown && countdownValue > 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-50">
                    <div className="text-8xl font-bold text-white stroke-black" 
                         style={{ 
                             textShadow: '4px 4px 0px #000, -4px -4px 0px #000, 4px -4px 0px #000, -4px 4px 0px #000',
                             animation: 'pulse 0.5s ease-in-out'
                         }}>
                        {countdownValue}
                    </div>
                </div>
            )}
            
            <div className="flex items-start justify-between w-full mx-auto px-4">
                {/* Player 1 HUD */}
                <div className="flex-1 max-w-lg">
                    <HealthBar
                        currentHealth={player1.health}
                        maxHealth={player1.maxHealth}
                        playerName={player1.name}
                    />
                    <RoundIndicators
                        totalRounds={maxRounds}
                        wonRounds={matchScore[player1.id] || 0}
                        className="mt-2"
                        gameMode={gameMode}
                    />
                </div>

                {/* Central Timer */}
                <div className="mx-4 flex-shrink-0">
                    <GameTimer timeRemaining={roundTimeLeft} />
                    {/* Network status removed - offline game only */}
                </div>

                {/* Player 2 HUD */}
                <div className="flex-1 max-w-lg">
                    <HealthBar
                        currentHealth={player2.health}
                        maxHealth={player2.maxHealth}
                        playerName={player2.name}
                        className="text-right"
                        direction="right"
                    />
                    <RoundIndicators
                        totalRounds={maxRounds}
                        wonRounds={matchScore[player2.id] || 0}
                        className="mt-2 justify-end"
                        gameMode={gameMode}
                    />
                </div>
            </div>
        </div>
    );
};

