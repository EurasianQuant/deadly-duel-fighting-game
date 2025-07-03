import EventBus from "@/lib/EventBus";

export type GameMode = "normal" | "tournament" | "survival" | "timeattack";

class GamePauseService {
  private _isPaused: boolean = false;
  private currentGameMode: GameMode | null = null;
  private currentScene: Phaser.Scene | null = null;

  public pauseGame(gameMode: GameMode, scene: Phaser.Scene): void {
    if (this._isPaused) return;

    this._isPaused = true;
    this.currentGameMode = gameMode;
    this.currentScene = scene;

    // Pause the Phaser scene
    scene.scene.pause();

    // Emit pause event for React components
    (EventBus as any).emit("game-paused", {
      gameMode,
      sceneName: scene.scene.key
    });

    console.log(`🎮 GAME PAUSED: ${gameMode} mode in ${scene.scene.key}`);
  }

  public resumeGame(): void {
    if (!this._isPaused || !this.currentScene) return;

    this._isPaused = false;

    // Resume the Phaser scene
    this.currentScene.scene.resume();

    // Emit resume event for React components
    (EventBus as any).emit("game-resumed", {
      gameMode: this.currentGameMode,
      sceneName: this.currentScene.scene.key
    });

    console.log(`🎮 GAME RESUMED: ${this.currentGameMode} mode`);

    // Clear current state
    this.currentGameMode = null;
    this.currentScene = null;
  }

  public returnToMainMenu(): void {
    if (!this._isPaused || !this.currentScene) return;

    console.log(`🎮 RETURNING TO MAIN MENU from ${this.currentGameMode} mode`);

    // Stop the current scene and go to main menu
    this.currentScene.scene.stop();
    this.currentScene.scene.start("MainMenuScene");

    // Emit main menu navigation event
    (EventBus as any).emit("game-exit-to-menu", {
      fromGameMode: this.currentGameMode,
      fromScene: this.currentScene.scene.key
    });

    // Reset pause state
    this._isPaused = false;
    this.currentGameMode = null;
    this.currentScene = null;
  }

  public isPaused(): boolean {
    return this._isPaused;
  }

  public getCurrentGameMode(): GameMode | null {
    return this.currentGameMode;
  }
}

// Export singleton instance
export const gamePauseService = new GamePauseService();