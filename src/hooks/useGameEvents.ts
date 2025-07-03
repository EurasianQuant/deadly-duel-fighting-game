import { useEffect } from "react";

import { GameState, PlayerState } from "@/config/gameConfig";
import EventBus from "@/lib/EventBus";
import { useGameStore } from "@/state/stores/gameStore";
import { logger } from "@/lib/logger";

export const useGameEvents = () => {
    useEffect(() => {
        // Get store actions
        const {
            setState,
            addPlayer,
            updatePlayer,
            updateRoundTime,
            endRound,
            setLocalPlayer,
        } = useGameStore.getState();

        // Fighter damage events
        const handleFighterDamaged = ({
            fighter,
            currentHealth,
        }: {
            fighter: string;
            damage: number;
            currentHealth: number;
            maxHealth: number;
        }) => {
            updatePlayer(fighter, { health: currentHealth });
        };

        // Fighter defeated event
        const handleFighterDefeated = ({ fighter }: { fighter: string }) => {
            updatePlayer(fighter, { health: 0 });
            endRound(fighter === "player1" ? "player2" : "player1");
        };

        // Round timer event
        const handleRoundTimer = ({ timeLeft }: { timeLeft: number }) => {
            updateRoundTime(Math.max(0, timeLeft));
        };

        // Game started event
        const handleGameStarted = ({
            mode: _mode,
        }: {
            mode: string;
            players: number;
        }) => {
            setState(GameState.PLAYING);

            // Clear existing players first (reset to exactly 2 players)
            // Note: Don't call resetMatch() here as it clears matchScore between rounds
            useGameStore.setState({ players: {} });

            // Add only the 2 current players
            addPlayer({
                id: "player1",
                name: "Player 1",
                health: 200,
                maxHealth: 200,
                x: 200,
                y: 0,
                state: PlayerState.IDLE,
                score: 0,
                isLocal: true,
                isAlive: true,
            });

            addPlayer({
                id: "player2",
                name: "Player 2 (AI)",
                health: 200,
                maxHealth: 200,
                x: 800,
                y: 0,
                state: PlayerState.IDLE,
                score: 0,
                isLocal: false,
                isAlive: true,
            });

            setLocalPlayer("player1");
        };

        // Round ended event
        const handleRoundEnded = ({
            round: _round,
            winner,
            score,
        }: {
            round: number;
            winner: string;
            score?: string;
        }) => {
            setState(GameState.ROUND_END);
            
            // Parse the score string (e.g., "1-0" or "1-1") to get actual round wins
            if (score) {
                const [player1Wins, player2Wins] = score.split("-").map(Number);
                
                // Set the exact match score instead of incrementing to avoid double counting
                console.log(`Setting match score: player1=${player1Wins}, player2=${player2Wins}`);
                useGameStore.setState({
                    matchScore: {
                        player1: player1Wins,
                        player2: player2Wins,
                    },
                });
                
                logger.gameEvent("round-ended", { 
                    winner, 
                    round: _round, 
                    score: `${player1Wins}-${player2Wins}` 
                });
            }
        };

        // Game over event
        const handleGameOver = ({
            winner: _winner,
            finalScore: _finalScore,
        }: {
            winner: string;
            finalScore: number;
        }) => {
            setState(GameState.GAME_OVER);
        };

        // Scene ready event
        const handleSceneReady = ({ sceneName }: { sceneName: string }) => {
            if (sceneName === "FightScene") {
                setState(GameState.PLAYING);
            }
        };

        // Set up event listeners
        EventBus.on("fighter-damaged", handleFighterDamaged);
        EventBus.on("fighter-defeated", handleFighterDefeated);
        EventBus.on("round-timer", handleRoundTimer);
        EventBus.on("game-started", handleGameStarted);
        EventBus.on("round-ended", handleRoundEnded);
        EventBus.on("game-over", handleGameOver);
        EventBus.on("scene-ready", handleSceneReady);

        // Cleanup function
        return () => {
            EventBus.off("fighter-damaged", handleFighterDamaged);
            EventBus.off("fighter-defeated", handleFighterDefeated);
            EventBus.off("round-timer", handleRoundTimer);
            EventBus.off("game-started", handleGameStarted);
            EventBus.off("round-ended", handleRoundEnded);
            EventBus.off("game-over", handleGameOver);
            EventBus.off("scene-ready", handleSceneReady);
        };
    }, []);
};

