import { create } from "zustand";
import {
    devtools,
    persist,
} from "zustand/middleware";

import {
    GameState,
    PlayerState,
} from "@/config/gameConfig";
import EventBus from "@/lib/EventBus";

// Player data interface
interface Player {
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    x: number;
    y: number;
    state: PlayerState;
    score: number;
    isLocal: boolean;
    isAlive: boolean;
}

// Game state interface
interface GameStateData {
    // Current game state
    currentState: GameState;

    // Match data
    currentRound: number;
    maxRounds: number;
    roundTimeLeft: number;
    isPaused: boolean;

    // Players
    players: Record<string, Player>;
    localPlayerId: string | null;

    // Scores and progression
    matchScore: Record<string, number>; // wins per player

    // UI state
    showDebug: boolean;
    isLoading: boolean;
    loadingProgress: number;
}

// Game actions interface
interface GameActions {
    // State management
    setState: (state: GameState) => void;
    setLoading: (loading: boolean, progress?: number) => void;

    // Player management
    addPlayer: (player: Player) => void;
    removePlayer: (playerId: string) => void;
    updatePlayer: (playerId: string, updates: Partial<Player>) => void;
    setLocalPlayer: (playerId: string) => void;

    // Match management
    startRound: (round: number) => void;
    endRound: (winnerId: string) => void;
    updateRoundTime: (timeLeft: number) => void;
    pauseGame: () => void;
    resumeGame: () => void;

    // Score management
    updateScore: (playerId: string, score: number) => void;
    incrementRoundWin: (playerId: string) => void;
    updateMatchScore: (playerId: string, score: number) => void;
    setMaxRounds: (maxRounds: number) => void;

    // Basic connection actions (simplified for offline-focused game)
    setConnected: (connected: boolean, roomId?: string) => void;

    // Debug
    toggleDebug: () => void;

    // Reset
    resetGame: () => void;
    resetMatch: () => void;
}

type GameStore = GameStateData & GameActions;

const initialState: GameStateData = {
    currentState: GameState.LOADING,
    currentRound: 0,
    maxRounds: 2, // Best of 3 means first to 2 wins
    roundTimeLeft: 59,
    isPaused: false,
    players: {},
    localPlayerId: null,
    matchScore: {},
    showDebug: false,
    isLoading: true,
    loadingProgress: 0,
};

export const useGameStore = create<GameStore>()(
    devtools(
        persist(
            (set, get) => ({
                ...initialState,

                // State management
                setState: (state) => set({ currentState: state }),
                setLoading: (loading, progress = 0) =>
                    set({ isLoading: loading, loadingProgress: progress }),

                // Player management
                addPlayer: (player) =>
                    set((state) => ({
                        players: { ...state.players, [player.id]: player },
                    })),

                removePlayer: (playerId) =>
                    set((state) => {
                        const { [playerId]: _removed, ...players } =
                            state.players;
                        return { players };
                    }),

                updatePlayer: (playerId, updates) =>
                    set((state) => {
                        const currentPlayer = state.players[playerId];
                        if (!currentPlayer) return state;
                        
                        // Ensure health is exactly 0 when it should be defeated
                        const updatedHealth = updates.health !== undefined ? updates.health : currentPlayer.health;
                        const cleanHealth = updatedHealth < 0.01 ? 0 : updatedHealth;
                        
                        return {
                            players: {
                                ...state.players,
                                [playerId]: {
                                    ...currentPlayer,
                                    ...updates,
                                    health: cleanHealth,
                                },
                            },
                        };
                    }),

                setLocalPlayer: (playerId) => set({ localPlayerId: playerId }),

                // Match management
                startRound: (round) =>
                    set({
                        currentRound: round,
                        currentState: GameState.PLAYING,
                        roundTimeLeft: 59,
                        isPaused: false,
                    }),

                endRound: (winnerId) => {
                    const state = get();
                    set({
                        currentState: GameState.ROUND_END,
                        matchScore: {
                            ...state.matchScore,
                            [winnerId]: (state.matchScore[winnerId] || 0) + 1,
                        },
                    });
                },

                updateRoundTime: (timeLeft) => set({ roundTimeLeft: timeLeft }),

                pauseGame: () => set({ isPaused: true }),
                resumeGame: () => set({ isPaused: false }),

                // Score management
                updateScore: (playerId, score) =>
                    set((state) => ({
                        players: {
                            ...state.players,
                            [playerId]: { ...state.players[playerId], score },
                        },
                    })),

                incrementRoundWin: (playerId) =>
                    set((state) => ({
                        matchScore: {
                            ...state.matchScore,
                            [playerId]: (state.matchScore[playerId] || 0) + 1,
                        },
                    })),

                updateMatchScore: (playerId, score) =>
                    set((state) => ({
                        matchScore: {
                            ...state.matchScore,
                            [playerId]: score,
                        },
                    })),

                setMaxRounds: (maxRounds) => set({ maxRounds }),

                // Basic connection actions
                setConnected: (connected, roomId) =>
                    set((state) => ({ ...state })), // Simplified - no network state needed

                // Debug
                toggleDebug: () =>
                    set((state) => ({ showDebug: !state.showDebug })),

                // Reset functions
                resetGame: () => set(initialState),
                resetMatch: () => {
                    set({
                        currentRound: 0,
                        roundTimeLeft: 59,
                        matchScore: {},
                        currentState: GameState.MENU,
                    });
                },
            }),
            {
                name: "deadly-duel-game",
                version: 2, // Incremented to clear old cached data
                // Only persist non-sensitive game state
                partialize: (state) => ({
                    showDebug: state.showDebug,
                    // maxRounds removed from persistence to clear cache
                }),
            }
        ),
        { name: "game-store" }
    )
);

// Define all events used by gameStore for comprehensive cleanup
const GAME_STORE_EVENTS = [
    "health-update",
    "round-timer", 
    "round-update",
    "match-end",
    "tournament-progress",
    "network-connected",
    "network-disconnected",
    "player-added",
    "initial-state",
    "player-removed",
    "remote-player-update",
    "game-started",
    "reset-match-score",
    "game-phase-changed",
    "match-score-update",
    "remote-game-event",
    "match-started",
    "countdown-update"
] as const;

// Clean up any existing listeners from previous HMR instances
function cleanupEventListeners() {
    try {
        GAME_STORE_EVENTS.forEach(eventName => {
            EventBus.removeAllListeners(eventName);
        });
        console.log("🧹 Cleaned up all EventBus listeners for gameStore");
    } catch (e) {
        console.log("🧹 EventBus cleanup not available, continuing...");
    }
}

// Cleanup on module load
cleanupEventListeners();

// Export cleanup function for external use
export const cleanupGameStoreListeners = cleanupEventListeners;

// Create unique store instance ID for debugging
const STORE_ID = `gameStore-${Date.now()}`;
console.log(`🏪 Setting up EventBus listeners for ${STORE_ID}`);

// Set up event listeners after store creation
EventBus.on("health-update", (data) => {
    useGameStore.setState((state) => {
        // Ensure players exist before updating
        const player1 = state.players["player1"] || {
            id: "player1", sessionId: undefined, name: "Player 1", 
            health: 200, maxHealth: 200, x: 0, y: 0, 
            state: PlayerState.IDLE, score: 0, isLocal: true, isAlive: true
        };
        const player2 = state.players["player2"] || {
            id: "player2", sessionId: undefined, name: "Player 2", 
            health: 200, maxHealth: 200, x: 0, y: 0, 
            state: PlayerState.IDLE, score: 0, isLocal: false, isAlive: true
        };
        
        return {
            players: {
                ...state.players,
                player1: {
                    ...player1,
                    health: data.player1.health,
                    maxHealth: data.player1.maxHealth,
                    name: data.player1.name,
                    isAlive: data.player1.health > 0,
                },
                player2: {
                    ...player2,
                    health: data.player2.health,
                    maxHealth: data.player2.maxHealth,
                    name: data.player2.name,
                    isAlive: data.player2.health > 0,
                },
            },
        };
    });
});

EventBus.on("round-timer", (data) => {
    useGameStore.setState({ roundTimeLeft: data.timeLeft });
});

EventBus.on("game-started", (data) => {
    console.log("🎯 Game started event received in store:", data);
    
    useGameStore.setState(() => {
        console.log("🎯 Initializing default players for offline game");
        return {
            currentState: GameState.PLAYING,
            players: {
                player1: {
                    id: "player1",
                    name: "Player 1",
                    health: 200,
                    maxHealth: 200,
                    x: 0,
                    y: 0,
                    state: PlayerState.IDLE,
                    score: 0,
                    isLocal: true,
                    isAlive: true,
                },
                player2: {
                    id: "player2",
                    name: "Player 2 (AI)",
                    health: 200,
                    maxHealth: 200,
                    x: 0,
                    y: 0,
                    state: PlayerState.IDLE,
                    score: 0,
                    isLocal: false,
                    isAlive: true,
                },
            },
        };
    });
});

EventBus.on("reset-match-score", () => {
    console.log("RESETTING MATCH SCORE - this should only happen for new tournament matches");
    useGameStore.setState({
        matchScore: {}
    });
});

// Simplified event listeners for offline game

EventBus.on("countdown-update" as any, (data: any) => {
    // Update countdown state for any UI components that need it
    console.log("🕐 Countdown update:", data);
});

// Round update event handler
EventBus.on("round-update" as any, (data: any) => {
    const { player1Score, player2Score } = data;
    useGameStore.setState({
        matchScore: {
            player1: player1Score,
            player2: player2Score
        }
    });
});

// Selectors for optimized access
export const gameSelectors = {
    getCurrentState: (state: GameStore) => state.currentState,
    getLocalPlayer: (state: GameStore) =>
        state.localPlayerId ? state.players[state.localPlayerId] : null,
    getPlayers: (state: GameStore) => Object.values(state.players),
    getPlayerById: (playerId: string) => (state: GameStore) =>
        state.players[playerId],
    getRoundTimeLeft: (state: GameStore) => state.roundTimeLeft,
    getMatchScore: (state: GameStore) => state.matchScore,
    isGameLoading: (state: GameStore) => state.isLoading,
    isGamePaused: (state: GameStore) => state.isPaused,
};

