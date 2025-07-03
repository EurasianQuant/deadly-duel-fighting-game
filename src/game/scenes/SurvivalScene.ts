import { Scene } from "phaser";

import {
    GAME_CONFIG,
    GameState,
    PlayerState,
} from "@/config/gameConfig";
import {
    Character,
    characterList,
    getCharacterById,
} from "@/data/characters";
import { FrameDataVisualizer } from "@/game/debug/FrameDataVisualizer";
import { Fighter } from "@/game/entities/Fighter";
import { AIController } from "@/game/systems/AIController";
import { InputManager } from "@/game/systems/input/InputManager";
// PhaserOptimizer removed - using standard Phaser optimization
import debug from "@/lib/debug";
import EventBus from "@/lib/EventBus";
import { logger } from "@/lib/logger";
import { useGameStore } from "@/state/stores/gameStore";
import { hybridLeaderboardService } from "@/services/hybridLeaderboardService";
import { gamePauseService } from "@/services/gamePauseService";
import { Boot } from "./Boot";

interface SurvivalData {
    currentRound: number;
    score: number;
    highScore: number;
    defeatedOpponents: number;
    streakMultiplier: number;
    roundStartTime: number;
    perfectRounds: number;
    gameStartTime: number; // Track total game session time
}

export class SurvivalScene extends Scene {
    // Core game objects
    private player!: Fighter;
    private enemies: Fighter[] = [];
    private groundCollider!: Phaser.Physics.Arcade.StaticGroup;

    // Game systems
    private inputManager!: InputManager;
    private aiControllers: AIController[] = [];
    private frameVisualizer!: FrameDataVisualizer;
    // PhaserOptimizer removed - using standard Phaser optimization

    // Survival specific data
    private survivalData!: SurvivalData;
    private betweenRoundsMode: boolean = false;
    private countdownTimer: number = 0;
    private roundStartHealth: number = 0;

    // UI elements
    private scoreText!: Phaser.GameObjects.Text;
    private roundText!: Phaser.GameObjects.Text;
    private multiplierText!: Phaser.GameObjects.Text;
    private countdownText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: "SurvivalScene" });
    }

    preload(): void {
        // Assets are already loaded in Boot scene
    }

    create(): void {
        debug.general("🏟️ Survival Scene starting...");

        // Initialize survival data
        this.initializeSurvivalData();

        // Set up the scene
        this.createBackground();
        this.createGround();
        this.createPlayer();
        this.setupInput();
        this.setupPauseHandling();
        this.createUI();

        // Initialize systems
        // PhaserOptimizer removed - using standard Phaser optimization

        // Initialize first round
        this.initializeFirstRound();

        // Set game mode in registry and store
        this.registry.set("gameMode", "survival");
        useGameStore.setState({
            currentState: GameState.PLAYING,
        });

        // Setup health emitters will be called after first round initialization

        EventBus.emit("current-scene-ready", this);
        logger.gameEvent("survival-mode-started", {
            character: this.player.fighterName,
        });
    }

    private initializeSurvivalData(): void {
        // Clear ALL survival-related data to ensure completely fresh start
        this.registry.remove("survivalData");
        localStorage.removeItem("survivalData"); // Remove any localStorage survival data

        // Always start fresh - only preserve high score from localStorage
        this.survivalData = {
            currentRound: 1,
            score: 0,
            highScore: parseInt(
                localStorage.getItem("survivalHighScore") || "0"
            ),
            defeatedOpponents: 0,
            streakMultiplier: 1.0,
            roundStartTime: 0,
            perfectRounds: 0,
            gameStartTime: this.time.now, // Track when the game session started
        };

        console.log("🧹 SURVIVAL: All old data cleared, starting fresh");
        debug.general(
            "Survival data initialized (fresh start):",
            this.survivalData
        );
    }

    private createBackground(): void {
        // Use random fight background selection
        Boot.createRandomFightBackground(this);
    }

    private createGround(): void {
        const { width, height } = this.cameras.main;
        const groundY = height - 20;

        // Visual ground removed - physics collision still works invisibly

        // Physics ground collider
        this.groundCollider = this.physics.add.staticGroup();
        const groundBody = this.groundCollider.create(
            width / 2,
            groundY + 10, // Match CombatSystem positioning
            undefined
        );
        groundBody.setSize(width, 20);
        groundBody.setVisible(false);
    }

    private createPlayer(): void {
        // Get selected character from registry
        const selectedCharacterData = this.registry.get("selectedCharacter");
        const selectedCharacterId =
            typeof selectedCharacterData === "string"
                ? selectedCharacterData
                : selectedCharacterData?.id || "rocco";
        const characterData = getCharacterById(selectedCharacterId);

        console.log(
            "🎮 SURVIVAL: Creating player with character:",
            selectedCharacterId,
            characterData
        );

        if (!characterData) {
            console.error(
                "Character not found:",
                selectedCharacterId,
                "Available characters:",
                characterList.map((c) => c.id)
            );
            // Fallback to first character
            const fallbackCharacter = characterList[0];
            console.log("Using fallback character:", fallbackCharacter.id);
            this.createPlayerWithCharacter(fallbackCharacter);
            return;
        }

        this.createPlayerWithCharacter(characterData);
    }

    private createPlayerWithCharacter(characterData: Character): void {
        // Create player at dynamic position
        const { width, height } = this.cameras.main;
        const groundY = height - 20;
        const playerStartY = groundY - 10;

        this.player = new Fighter(
            this,
            width * 0.15, // 15% from left edge
            playerStartY,
            characterData.spritesheetKey,
            "Player",
            characterData
        );

        // Setup physics collision
        this.physics.add.collider(this.player, this.groundCollider);

        console.log(
            "✅ SURVIVAL: Player created successfully:",
            this.player.fighterName,
            "at position",
            this.player.x,
            this.player.y
        );
        debug.general(`Player created: ${characterData.name}`);
    }

    private setupInput(): void {
        this.inputManager = new InputManager(this);
    }

    private setupPauseHandling(): void {
        // Listen for ESC key to pause the game
        this.input.keyboard!.on("keydown-ESC", () => {
            if (!gamePauseService.isPaused()) {
                gamePauseService.pauseGame("survival", this);
            }
        });
    }

    private createUI(): void {
        const { width } = this.cameras.main;

        // Only keep essential UI elements (countdown and score popups)
        // Health bars and timers are handled by React HUD

        // Countdown text (hidden initially)
        this.countdownText = this.add.text(width / 2, 300, "", {
            fontFamily: "Press Start 2P",
            fontSize: "48px",
            color: "#FBBF24",
            stroke: "#000000",
            strokeThickness: 4,
            align: "center",
        });
        this.countdownText.setOrigin(0.5);
        this.countdownText.setVisible(false);

        // Create invisible score and round text for internal tracking
        this.scoreText = this.add.text(0, 0, "", {
            fontSize: "1px",
            color: "#000000",
        });
        this.roundText = this.add.text(0, 0, "", {
            fontSize: "1px",
            color: "#000000",
        });
        this.multiplierText = this.add.text(0, 0, "", {
            fontSize: "1px",
            color: "#000000",
        });
        this.scoreText.setVisible(false);
        this.roundText.setVisible(false);
        this.multiplierText.setVisible(false);

        this.updateUI();
    }

    private updateUI(): void {
        this.scoreText.setText(
            `SCORE: ${this.survivalData.score.toLocaleString()}\nHIGH: ${this.survivalData.highScore.toLocaleString()}`
        );
        this.roundText.setText(`ROUND ${this.survivalData.currentRound}`);

        if (this.survivalData.streakMultiplier > 1.0) {
            this.multiplierText.setText(
                `${this.survivalData.streakMultiplier.toFixed(1)}X STREAK`
            );
        } else {
            this.multiplierText.setText("");
        }
    }

    private initializeFirstRound(): void {
        this.survivalData.currentRound = 1;
        this.betweenRoundsMode = true;
        this.countdownTimer = 3;

        // Store starting health for perfect round detection
        this.roundStartHealth = this.player.health;

        // Create enemies for first round
        this.createEnemiesForRound();

        // Start countdown
        this.startCountdown();

        this.updateUI();

        // Setup health emitters for React HUD after players and enemies are created
        this.setupHealthEventEmitters();

        // Update health display for new enemies
        if (this.enemies.length > 0) {
            this.emitHealthUpdate();
        }

        debug.general(`Starting Round ${this.survivalData.currentRound}`);
    }

    private startNextRound(): void {
        this.survivalData.currentRound++;
        this.betweenRoundsMode = true;
        this.countdownTimer = 3;

        // Clear any existing enemies
        this.clearEnemies();

        // Heal player between rounds (25% recovery)
        if (this.survivalData.currentRound > 1) {
            const healAmount = Math.floor(this.player.maxHealth * 0.25);
            this.player.health = Math.min(
                this.player.maxHealth,
                this.player.health + healAmount
            );
        }

        // Store starting health for perfect round detection
        this.roundStartHealth = this.player.health;

        // Create enemies based on round number
        this.createEnemiesForRound();

        // Start countdown
        this.startCountdown();

        this.updateUI();

        // Update health display for new enemies
        if (this.enemies.length > 0) {
            this.emitHealthUpdate();
        }

        debug.general(`Starting Round ${this.survivalData.currentRound}`);
    }

    private createEnemiesForRound(): void {
        const round = this.survivalData.currentRound;
        const { width, height } = this.cameras.main;
        const groundY = height - 20;
        const playerStartY = groundY - 10;

        // Determine number of enemies and their stats
        let enemyCount = 1;
        let statMultiplier = 1.0;
        let speedMultiplier = 1.0;

        if (round >= 6) {
            enemyCount = 2; // Dual opponents from round 6
        }

        if (round >= 10) {
            statMultiplier = 1.5; // Enhanced stats from round 10
            speedMultiplier = 1.2;
        }

        if (round >= 15) {
            statMultiplier = 2.0; // Maximum stats from round 15
            speedMultiplier = 1.4;
        }

        // Create enemies
        for (let i = 0; i < enemyCount; i++) {
            // Select random character (but not the same as player)
            const selectedCharacterData =
                this.registry.get("selectedCharacter");
            const playerCharId =
                typeof selectedCharacterData === "string"
                    ? selectedCharacterData
                    : selectedCharacterData?.id || "rocco";
            const availableCharacters = characterList.filter(
                (char) => char.id !== playerCharId
            );
            const randomCharacter =
                availableCharacters[
                    Math.floor(Math.random() * availableCharacters.length)
                ];

            console.log(
                `🤖 SURVIVAL: Creating enemy ${i + 1} with character:`,
                randomCharacter.id
            );

            // Position enemies on the right side using dynamic width
            const enemyX = width * 0.85 - i * 100; // 85% from left edge, spread out for multiple enemies

            const enemy = new Fighter(
                this,
                enemyX,
                playerStartY,
                randomCharacter.spritesheetKey,
                `Enemy ${i + 1}`,
                randomCharacter
            );

            console.log(
                `✅ SURVIVAL: Enemy ${i + 1} created successfully:`,
                enemy.fighterName,
                "at position",
                enemy.x,
                enemy.y
            );

            // Apply stat multipliers
            enemy.health = Math.floor(enemy.health * statMultiplier);
            enemy.maxHealth = Math.floor(enemy.maxHealth * statMultiplier);
            enemy.speed = Math.floor(enemy.speed * speedMultiplier);

            // Face the player
            enemy.setFlipX(true);

            // Setup physics
            this.physics.add.collider(enemy, this.groundCollider);

            // Create AI controller
            const aiController = new AIController();

            this.enemies.push(enemy);
            this.aiControllers.push(aiController);
        }

        debug.general(
            `Created ${enemyCount} enemies for round ${round} with ${statMultiplier}x stats`
        );
    }

    private startCountdown(): void {
        this.countdownText.setVisible(true);
        this.countdownText.setText(this.countdownTimer.toString());

        // Animate countdown
        this.tweens.add({
            targets: this.countdownText,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 200,
            yoyo: true,
            ease: "Power2",
        });

        // Countdown timer
        this.time.delayedCall(1000, () => {
            this.countdownTimer--;
            if (this.countdownTimer > 0) {
                this.countdownText.setText(this.countdownTimer.toString());
                this.tweens.add({
                    targets: this.countdownText,
                    scaleX: 1.5,
                    scaleY: 1.5,
                    duration: 200,
                    yoyo: true,
                    ease: "Power2",
                });
                this.startCountdown();
            } else {
                this.countdownText.setText("FIGHT!");
                this.tweens.add({
                    targets: this.countdownText,
                    scaleX: 2.0,
                    scaleY: 2.0,
                    alpha: 0,
                    duration: 500,
                    ease: "Power2",
                    onComplete: () => {
                        this.countdownText.setVisible(false);
                        this.countdownText.setAlpha(1);
                        this.countdownText.setScale(1);
                    },
                });
                this.startRoundFighting();
            }
        });
    }

    private startRoundFighting(): void {
        this.betweenRoundsMode = false;

        this.survivalData.roundStartTime = this.time.now;

        debug.general("Round fighting started");
    }

    private clearEnemies(): void {
        this.enemies.forEach((enemy) => enemy.destroy());
        this.aiControllers = [];
        this.enemies = [];
    }

    private checkRoundEnd(): void {
        if (this.betweenRoundsMode) return;

        // Check if player is defeated
        if (this.player.health <= 0) {
            this.endSurvival();
            return;
        }

        // Check if all enemies are defeated
        const aliveEnemies = this.enemies.filter((enemy) => enemy.health > 0);
        if (aliveEnemies.length === 0) {
            this.completeRound();
        }
    }

    private completeRound(): void {
        const roundTime = this.time.now - this.survivalData.roundStartTime;
        const baseScore = 100;

        // Calculate score with bonuses
        let roundScore = baseScore;

        // Time bonus (faster = more points)
        const timeBonus = Math.max(0, 30000 - roundTime) / 1000; // Up to 30 bonus points
        roundScore += timeBonus;

        // Health bonus
        const healthPercent = this.player.health / this.player.maxHealth;
        const healthBonus = Math.floor(healthPercent * 50); // Up to 50 bonus points
        roundScore += healthBonus;

        // Perfect round bonus
        let perfectBonus = 0;
        if (this.player.health === this.roundStartHealth) {
            perfectBonus = 500;
            this.survivalData.perfectRounds++;
        }

        // Dual enemy bonus
        if (this.enemies.length > 1) {
            roundScore += 50 * (this.enemies.length - 1);
        }

        // Apply streak multiplier
        const finalScore = Math.floor(
            (roundScore + perfectBonus) * this.survivalData.streakMultiplier
        );

        // Update survival data
        this.survivalData.score += finalScore;
        this.survivalData.defeatedOpponents += this.enemies.length;

        // Increase streak multiplier (max 5.0x)
        this.survivalData.streakMultiplier = Math.min(
            5.0,
            this.survivalData.streakMultiplier + 0.1
        );

        // Update round indicators in React HUD - only when player defeats all enemies
        const gameStore = useGameStore.getState();
        // Show completed rounds (current round - 1 since we're about to start next round)
        gameStore.updateMatchScore("player1", this.survivalData.currentRound);

        // Show score popup
        this.showScorePopup(finalScore, perfectBonus > 0);

        // Start next round after delay
        this.time.delayedCall(2000, () => {
            this.startNextRound();
        });

        debug.general(
            `Round ${this.survivalData.currentRound} completed. Score: ${finalScore}`
        );
    }

    private setupHealthEventEmitters(): void {
        // Initialize game store for Survival mode
        const gameStore = useGameStore.getState();

        // Add players to store
        gameStore.addPlayer({
            id: "player1",
            health: this.player.health,
            maxHealth: this.player.maxHealth,
            name: this.player.fighterName,
            x: this.player.x,
            y: this.player.y,
            state: PlayerState.IDLE,
            score: 0,
            isLocal: true,
            isAlive: true,
        });

        gameStore.addPlayer({
            id: "player2",
            health: this.enemies.length > 0 ? this.enemies[0].health : 100,
            maxHealth:
                this.enemies.length > 0 ? this.enemies[0].maxHealth : 100,
            name:
                this.enemies.length > 0 ? this.enemies[0].fighterName : "Enemy",
            x: this.enemies.length > 0 ? this.enemies[0].x : 0,
            y: this.enemies.length > 0 ? this.enemies[0].y : 0,
            state: PlayerState.IDLE,
            score: 0,
            isLocal: false,
            isAlive: true,
        });

        // Set survival-specific UI state - no timer, no initial round indicators
        gameStore.updateRoundTime(-1); // -1 indicates no timer should be shown
        
        // Initialize round indicators - no rounds won initially
        gameStore.updateMatchScore("player1", 0); // Rounds completed by player
        gameStore.updateMatchScore("player2", 0); // Not used in survival
        gameStore.setMaxRounds(0); // No maximum rounds in survival

        // Emit initial health state
        this.emitHealthUpdate();
    }

    private emitHealthUpdate(): void {
        const gameStore = useGameStore.getState();

        const enemyHealthData =
            this.enemies.length > 0
                ? {
                      health: this.enemies[0].health,
                      maxHealth: this.enemies[0].maxHealth,
                      name: `Enemy ${this.enemies.length > 0 ? "1" : "None"}`,
                  }
                : {
                      health: 0,
                      maxHealth: 100,
                      name: "No Enemy",
                  };

        // Update players in game store for React HUD
        gameStore.updatePlayer("player1", {
            health: this.player.health,
            maxHealth: this.player.maxHealth,
            name: this.player.fighterName,
        });

        gameStore.updatePlayer("player2", enemyHealthData);

        // Also emit legacy event for backwards compatibility
        EventBus.emit("health-update", {
            player1: {
                health: this.player.health,
                maxHealth: this.player.maxHealth,
                name: this.player.fighterName,
            },
            player2: enemyHealthData,
        });
    }

    private showScorePopup(score: number, perfect: boolean): void {
        const { width, height } = this.cameras.main;

        let text = `+${score.toLocaleString()} POINTS`;
        if (perfect) {
            text += "\nPERFECT ROUND!";
        }

        const popup = this.add.text(width / 2, height / 2, text, {
            fontFamily: "Press Start 2P",
            fontSize: "32px",
            color: perfect ? "#FFD700" : "#00FF00",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center",
        });
        popup.setOrigin(0.5);

        // Animate popup
        this.tweens.add({
            targets: popup,
            y: height / 2 - 50,
            alpha: 0,
            duration: 2000,
            ease: "Power2",
            onComplete: () => popup.destroy(),
        });
    }

    private async endSurvival(): Promise<void> {
        debug.general("Survival mode ended");

        // Reset round indicators when game ends
        const gameStore = useGameStore.getState();
        gameStore.updateMatchScore("player1", 0);
        gameStore.updateMatchScore("player2", 0);

        // Calculate total play time
        const totalPlayTime = (this.time.now - this.survivalData.gameStartTime) / 1000;

        // Get selected character data
        const selectedCharacterData = this.registry.get("selectedCharacter");
        const selectedCharacterId = typeof selectedCharacterData === "string" 
            ? selectedCharacterData 
            : selectedCharacterData?.id || "rocco";

        // Get player profile for player name
        const playerProfile = hybridLeaderboardService.getPlayerProfile();

        // Add survival entry to leaderboard (instant memory update + async persistence)
        await hybridLeaderboardService.addSurvivalEntry({
            playerName: playerProfile.playerName,
            character: selectedCharacterId,
            score: this.survivalData.score,
            roundsCompleted: this.survivalData.currentRound - 1,
            perfectRounds: this.survivalData.perfectRounds,
            enemiesDefeated: this.survivalData.defeatedOpponents,
            finalMultiplier: this.survivalData.streakMultiplier,
            timestamp: Date.now(),
            playTime: totalPlayTime,
        });

        // Update character statistics (instant memory update + async persistence)
        hybridLeaderboardService.updateCharacterStats(selectedCharacterId, {
            matchesPlayed: 1,
            survivalBestRound: Math.max(
                playerProfile.characterStats[selectedCharacterId]?.survivalBestRound || 0,
                this.survivalData.currentRound - 1
            ),
            survivalBestScore: Math.max(
                playerProfile.characterStats[selectedCharacterId]?.survivalBestScore || 0,
                this.survivalData.score
            ),
            survivalTotalScore: (playerProfile.characterStats[selectedCharacterId]?.survivalTotalScore || 0) + this.survivalData.score,
            perfectRounds: (playerProfile.characterStats[selectedCharacterId]?.perfectRounds || 0) + this.survivalData.perfectRounds,
            totalPlayTime: (playerProfile.characterStats[selectedCharacterId]?.totalPlayTime || 0) + totalPlayTime,
        });

        // Update high score if necessary (keep legacy localStorage for compatibility)
        if (this.survivalData.score > this.survivalData.highScore) {
            this.survivalData.highScore = this.survivalData.score;
            localStorage.setItem(
                "survivalHighScore",
                this.survivalData.highScore.toString()
            );
        }

        // Log final stats
        logger.gameEvent("survival-mode-ended", {
            finalScore: this.survivalData.score,
            roundsCompleted: this.survivalData.currentRound - 1,
            enemiesDefeated: this.survivalData.defeatedOpponents,
            perfectRounds: this.survivalData.perfectRounds,
            character: selectedCharacterId,
            playTime: totalPlayTime,
        });

        console.log("📊 SURVIVAL: Score saved to leaderboard:", {
            score: this.survivalData.score,
            rounds: this.survivalData.currentRound - 1,
            character: selectedCharacterId,
            playTime: hybridLeaderboardService.formatTime(totalPlayTime),
        });

        // Show game over screen
        this.showGameOverScreen();
    }

    private showGameOverScreen(): void {
        const { width, height } = this.cameras.main;

        // Overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

        // Game Over text
        const gameOverText = this.add.text(
            width / 2,
            height / 2 - 100,
            "SURVIVAL ENDED",
            {
                fontFamily: "Press Start 2P",
                fontSize: "48px",
                color: "#FF4444",
                stroke: "#000000",
                strokeThickness: 4,
                align: "center",
            }
        );
        gameOverText.setOrigin(0.5);

        // Stats
        const statsText = this.add.text(
            width / 2,
            height / 2,
            `ROUNDS COMPLETED: ${this.survivalData.currentRound - 1}\n` +
                `ENEMIES DEFEATED: ${this.survivalData.defeatedOpponents}\n` +
                `PERFECT ROUNDS: ${this.survivalData.perfectRounds}\n` +
                `FINAL SCORE: ${this.survivalData.score.toLocaleString()}\n` +
                `HIGH SCORE: ${this.survivalData.highScore.toLocaleString()}`,
            {
                fontFamily: "Press Start 2P",
                fontSize: "24px",
                color: "#FFFFFF",
                stroke: "#000000",
                strokeThickness: 2,
                align: "center",
                lineSpacing: 10,
            }
        );
        statsText.setOrigin(0.5);

        // Continue instruction
        const continueText = this.add.text(
            width / 2,
            height / 2 + 150,
            "Press ENTER to return to menu",
            {
                fontFamily: "Press Start 2P",
                fontSize: "20px",
                color: "#FBBF24",
                align: "center",
            }
        );
        continueText.setOrigin(0.5);

        // Handle input for returning to menu
        this.input.keyboard!.once("keydown-ENTER", () => {
            this.scene.start("ArcadeModeSelectScene");
        });
    }

    update(time: number, delta: number): void {
        if (this.betweenRoundsMode) return;

        // Update player
        this.handleInput();
        this.player.update(delta);

        // Update enemies and AI
        this.enemies.forEach((enemy, index) => {
            if (enemy.health > 0) {
                enemy.update(delta);
                // Calculate distance and difficulty
                const distance = Math.abs(enemy.x - this.player.x);
                const difficulty = {
                    aggression: 1.0,
                    reaction: 1.0,
                    strategy: 1.0,
                    level: 1.0,
                };
                this.aiControllers[index]?.updateAI(
                    enemy,
                    this.player,
                    distance,
                    difficulty
                );
            }
        });

        // Update grounded states for proper animation transitions
        this.updateGroundedStates();

        // Check for combat collisions
        this.checkCombatCollisions();

        // Check round end conditions
        this.checkRoundEnd();

        // Update UI
        this.updateUI();

        // Emit health updates for React HUD
        this.emitHealthUpdate();
    }

    private handleInput(): void {
        // Movement
        if (this.inputManager.isLeftPressed()) {
            this.player.move("left");
        } else if (this.inputManager.isRightPressed()) {
            this.player.move("right");
        }

        // Jump
        if (this.inputManager.isUpPressed()) {
            this.player.jump();
        }

        // Attacks
        if (this.inputManager.isLightAttackPressed()) {
            this.player.attack("light");
        } else if (this.inputManager.isHeavyAttackPressed()) {
            this.player.attack("heavy");
        } else if (this.inputManager.isSpecialAttackPressed()) {
            this.player.attack("special");
        }
    }

    private checkCombatCollisions(): void {
        // Check player attacks against enemies
        if (this.player.getIsAttacking()) {
            const playerHitbox = this.player.getAttackHitbox();

            this.enemies.forEach((enemy) => {
                if (enemy.health <= 0 || enemy.getIsInvulnerable()) return;

                // Simple rectangular collision detection
                const enemyBounds = enemy.getBounds();
                if (
                    Phaser.Geom.Rectangle.Overlaps(
                        new Phaser.Geom.Rectangle(
                            playerHitbox.x,
                            playerHitbox.y,
                            playerHitbox.width,
                            playerHitbox.height
                        ),
                        enemyBounds
                    )
                ) {
                    // Apply damage
                    const attackType = this.player.getCurrentAttackType();
                    if (attackType) {
                        const damage = this.getAttackDamage(attackType);
                        enemy.takeDamage(damage);
                        debug.general(`Player hit enemy for ${damage} damage`);
                    }
                }
            });
        }

        // Check enemy attacks against player
        this.enemies.forEach((enemy) => {
            if (enemy.health <= 0 || !enemy.getIsAttacking()) return;

            const enemyHitbox = enemy.getAttackHitbox();
            const playerBounds = this.player.getBounds();

            if (
                Phaser.Geom.Rectangle.Overlaps(
                    new Phaser.Geom.Rectangle(
                        enemyHitbox.x,
                        enemyHitbox.y,
                        enemyHitbox.width,
                        enemyHitbox.height
                    ),
                    playerBounds
                )
            ) {
                // Apply damage to player
                const attackType = enemy.getCurrentAttackType();
                if (attackType && !this.player.getIsInvulnerable()) {
                    const damage = this.getAttackDamage(attackType);
                    this.player.takeDamage(damage);

                    // Reset streak multiplier on taking damage
                    this.survivalData.streakMultiplier = 1.0;

                    debug.general(`Enemy hit player for ${damage} damage`);
                }
            }
        });
    }

    private getAttackDamage(attackType: string): number {
        switch (attackType) {
            case "light":
                return GAME_CONFIG.COMBAT.LIGHT_DAMAGE;
            case "heavy":
                return GAME_CONFIG.COMBAT.HEAVY_DAMAGE;
            case "special":
                return GAME_CONFIG.COMBAT.SPECIAL_DAMAGE;
            default:
                return 0;
        }
    }

    private updateGroundedStates(): void {
        const { height } = this.cameras.main;
        const groundY = height - 20;
        const groundOffset = GAME_CONFIG.FIGHTER.GROUND_OFFSET;
        
        // Update player grounded state
        this.player.updateGroundedState(this.player.y >= groundY - groundOffset);
        
        // Update enemies grounded states
        this.enemies.forEach(enemy => {
            enemy.updateGroundedState(enemy.y >= groundY - groundOffset);
        });
    }

    shutdown(): void {
        // Clean up fighters to prevent stale references during scene transitions
        if (this.player) {
            this.player.destroy();
            this.player = null!;
        }
        
        // Clean up enemies and AI controllers
        this.clearEnemies();
        
        // Reset flags
        this.betweenRoundsMode = false;
        
        // Clean up input
        this.input.keyboard!.removeAllListeners();
        
        // Clean up tweens
        this.tweens.killAll();
        
        // Clean up timers
        this.time.removeAllEvents();
    }

    destroy(): void {
        // Call shutdown for consistency
        this.shutdown();
    }
}

