import React, {
    useEffect,
    useState,
} from "react";

import { GameHUD } from "./components/game/GameHUD";
import { PauseOverlay } from "./components/game/PauseOverlay";
import { AchievementNotification } from "./components/game/AchievementNotification";
import { MainMenu } from "./components/menus/MainMenu";
import { useGameEvents } from "./hooks/useGameEvents";
import type { GameMode } from "./types/game";
import EventBus from "./lib/EventBus";
import { PhaserGame } from "./PhaserGame";
import { gamePauseService } from "./services/gamePauseService";
import { ErrorBoundary } from "./components/ui";
import { LeaderboardMigration } from "./services/leaderboardMigration";
import { achievementService } from "./services/achievementService";

// import { useGameStore, gameSelectors } from "./state/stores/gameStore"; // Unused for now

function App() {
    const [currentScene, setCurrentScene] = useState<string>("");
    const [isPaused, setIsPaused] = useState<boolean>(false);
    // const currentGameState = useGameStore(gameSelectors.getCurrentState); // Unused

    // Initialize game events hook to bridge Phaser and React
    useGameEvents();

    // Perform leaderboard migration and initialize achievements on app startup
    useEffect(() => {
        LeaderboardMigration.performMigration();
        
        // Initialize achievement service
        // The service will automatically set up event listeners
        achievementService.loadPlayerAchievements();
    }, []);

    // Pause overlay handlers
    const handleResumeGame = () => {
        gamePauseService.resumeGame();
    };

    const handleReturnToMainMenu = () => {
        gamePauseService.returnToMainMenu();
    };

    // Listen for scene changes and pause events from Phaser
    useEffect(() => {
        const handleSceneReady = (scene: Phaser.Scene) => {
            setCurrentScene(scene.scene.key);
        };

        const handleGamePaused = ({ gameMode }: { gameMode: GameMode }) => {
            setIsPaused(true);
        };

        const handleGameResumed = () => {
            setIsPaused(false);
        };

        const handleGameExitToMenu = () => {
            setIsPaused(false);
        };

        // Online menu handlers removed - using offline game only

        // Leaderboard handlers disabled - using Phaser scenes instead
        // const handleShowLeaderboard = () => {
        //     setShowLeaderboard(true);
        // };

        // const handleHideLeaderboard = () => {
        //     setShowLeaderboard(false);
        // };

        EventBus.on("current-scene-ready", handleSceneReady);
        EventBus.on("game-paused", handleGamePaused);
        EventBus.on("game-resumed", handleGameResumed);
        EventBus.on("game-exit-to-menu", handleGameExitToMenu);

        return () => {
            EventBus.off("current-scene-ready", handleSceneReady);
            EventBus.off("game-paused", handleGamePaused);
            EventBus.off("game-resumed", handleGameResumed);
            EventBus.off("game-exit-to-menu", handleGameExitToMenu);
        };
    }, []);

    // Determine what UI to show based on current scene
    const showReactMenu = false; // Disabled - using Phaser scenes for all menus now
    const showGameHUD =
        currentScene === "FightScene" ||
        currentScene === "SurvivalScene" ||
        currentScene === "TimeAttackScene";

    // Online functionality disabled
    // const shouldShowOnlineMenu = false; // Unused

    return (
        <ErrorBoundary>
            <div className="w-full h-screen relative bg-game-bg font-arcade-body">
                {/* Phaser Game Canvas - Always visible */}
                <PhaserGame />

                {/* React UI Overlays - Only show when appropriate */}
                {showReactMenu && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                        <MainMenu
                            onStartArcade={() => console.log("Arcade from React")}
                            onStartOnline={() => console.log("Online from React")}
                            onShowLeaderboard={() =>
                                console.log("Leaderboard from React")
                            }
                            onShowSettings={() =>
                                console.log("Settings from React")
                            }
                        />
                    </div>
                )}

                {/* Online Play Menu - Disabled */}

                {/* Leaderboard and Player Profile screens disabled - using Phaser scenes instead */}

                {/* Game HUD (shown when in game scenes) */}
                {showGameHUD && (
                    <div className="absolute inset-0 pointer-events-none z-50">
                        <GameHUD className="pointer-events-auto" />
                    </div>
                )}

                {/* Achievement Notifications */}
                <AchievementNotification />

                {/* Pause Overlay */}
                <PauseOverlay
                    isVisible={isPaused}
                    onResume={handleResumeGame}
                    onMainMenu={handleReturnToMainMenu}
                />
            </div>
        </ErrorBoundary>
    );
}

export default App;

