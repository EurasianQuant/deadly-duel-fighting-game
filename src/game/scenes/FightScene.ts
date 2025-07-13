import { Scene } from "phaser";

import { GAME_CONFIG, PlayerState } from "@/config/gameConfig";
import { characterList, getCharacterById } from "@/data/characters";
import { Fighter } from "@/game/entities/Fighter";
import { InputManager } from "@/game/systems/input/InputManager";
import { AIController, AIDifficultySettings } from "@/game/systems/AIController";
import { CombatSystem } from "@/game/systems/CombatSystem";
import { MatchManager } from "@/game/systems/MatchManager";
// UICoordinator removed - using EventBus directly
import { useGameStore } from "@/state/stores/gameStore";
import EventBus from "@/lib/EventBus";
import { logger } from "@/lib/logger";
import debug from "@/lib/debug";
import { gamePauseService } from "@/services/gamePauseService";
import { Boot } from "./Boot";

export class FightScene extends Scene {
    // Core game entities
    private player1!: Fighter;
    private player2!: Fighter;
    private inputManager!: InputManager;
    
    // Game systems
    private aiController!: AIController;
    private combatSystem!: CombatSystem;
    private matchManager!: MatchManager;
    // UICoordinator removed - using EventBus directly
    
    // Game state
    private gameStarted: boolean = false;
    private gameEnded: boolean = false;
    private isCountingDown: boolean = true;
    private countdownValue: number = GAME_CONFIG.MATCH.COUNTDOWN_DURATION;
    private countdownText!: Phaser.GameObjects.Text;
    
    // Track event listeners for cleanup
    private eventListeners: Array<() => void> = [];

    constructor() {
        super({ key: "FightScene" });
    }

    preload() {
        // Assets are already loaded in Boot scene
    }

    create() {
        // Reset game state for new round
        this.gameStarted = false;
        this.gameEnded = false;
        this.isCountingDown = true;
        this.countdownValue = GAME_CONFIG.MATCH.COUNTDOWN_DURATION;
        
        // Initialize game systems
        this.initializeSystems();
        
        // Initialize match data
        this.matchManager.initializeMatch();
        
        // Create game environment
        this.createBackground();
        this.createGround();
        this.createFighters();
        
        // Check if fighters were created successfully
        if (!this.player1 || !this.player2) {
            console.error("Failed to create fighters - aborting scene creation");
            debug.warn("Failed to create fighters");
            return;
        }
        
        this.createCountdownDisplay();
        
        // Setup physics and input
        this.combatSystem.setupCombatPhysics(this.player1, this.player2);
        this.inputManager = new InputManager(this);
        
        // Setup pause functionality
        this.setupPauseHandling();
        
        // Initialize game store for React HUD
        this.setupGameStore();
        
        // Send initial UI updates directly via EventBus
        EventBus.emit("health-update", {
            player1: { health: this.player1.health, maxHealth: this.player1.maxHealth, name: this.player1.characterId },
            player2: { health: this.player2.health, maxHealth: this.player2.maxHealth, name: this.player2.characterId }
        });
        EventBus.emit("game-started", { mode: "fight", players: 2 });
        EventBus.emit("current-scene-ready", this);
        
        // Start countdown
        this.startCountdown();
        
        debug.general(`Fight Scene Ready - Round ${this.matchManager.matchData.currentRound}`);
    }

    update(time: number, delta: number) {
        // Update countdown if active
        if (this.isCountingDown) {
            this.updateCountdown(delta);
            return;
        }

        // Check if match manager indicates round/match has ended - STOP IMMEDIATELY
        if (this.matchManager.matchData.isMatchComplete || this.matchManager.isRoundEnded) {
            this.gameEnded = true;
            return;
        }

        if (!this.gameStarted || this.gameEnded) return;

        // Update fighters
        this.player1.update(delta);
        this.player2.update(delta);

        // Update UI with health changes directly via EventBus (ensure 0 health precision)
        const player1Health = this.player1.health < 0.01 ? 0 : this.player1.health;
        const player2Health = this.player2.health < 0.01 ? 0 : this.player2.health;
        
        EventBus.emit("health-update", {
            player1: { health: player1Health, maxHealth: this.player1.maxHealth, name: this.player1.characterId },
            player2: { health: player2Health, maxHealth: this.player2.maxHealth, name: this.player2.characterId }
        });
        
        // Update game store for React HUD
        this.updateGameStore();

        // Handle player input
        this.handlePlayerInput();

        // Update AI behavior
        this.updateAI();

        // Update physics
        this.combatSystem.updateGroundedStates(this.player1, this.player2);

        // Handle combat collisions
        this.combatSystem.handleCombatCollision(this.player1, this.player2);

        // Check for round end conditions FIRST
        this.matchManager.checkRoundEndConditions(this.player1, this.player2);
        
        // Update round timer (only if round hasn't ended)
        if (!this.matchManager.matchData.isMatchComplete && !this.matchManager.isRoundEnded) {
            this.matchManager.updateRoundTimer(delta);
        }
    }

    private initializeSystems(): void {
        this.aiController = new AIController();
        this.combatSystem = new CombatSystem(this);
        this.matchManager = new MatchManager(this);
        // UICoordinator removed - using EventBus directly
        
        debug.general("Game systems initialized");
    }

    private createBackground(): void {
        try {
            // Use random fight background selection
            Boot.createRandomFightBackground(this);
        } catch (error) {
            debug.warn("Background image not found, using fallback", error);
            const { width, height } = this.cameras.main;
            const graphics = this.add.graphics();
            graphics.fillStyle(0x1a1a2e);
            graphics.fillRect(0, 0, width, height);
        }
    }

    private createGround(): void {
        // Visual ground removed - physics ground collision still works invisibly
        // Players will land and walk on invisible ground collision boundaries
    }

    private createFighters(): void {
        // Get selected character and AI opponent
        const selectedCharacterId = this.registry.get("selectedCharacter") || "rocco";
        const selectedCharacter = getCharacterById(selectedCharacterId);
        
        if (!selectedCharacter) {
            console.error("Character not found:", selectedCharacterId);
            debug.warn("Character not found, using default");
            return;
        }
        
        const aiOpponent = this.getOrCreateAIOpponent(selectedCharacter);
        
        if (!aiOpponent) {
            console.error("AI opponent not found");
            debug.warn("AI opponent not found");
            return;
        }
        
        // Use dynamic camera dimensions for positioning
        const { width, height } = this.cameras.main;
        const groundY = height - 20;
        const playerStartY = groundY - GAME_CONFIG.FIGHTER.GROUND_OFFSET;

        // Create fighters with dynamic positioning
        this.player1 = new Fighter(
            this,
            width * 0.15, // 15% from left edge
            playerStartY,
            selectedCharacter.spritesheetKey,
            "Player",
            selectedCharacter
        );

        this.player2 = new Fighter(
            this,
            width * 0.85, // 85% from left edge (15% from right)
            playerStartY,
            aiOpponent.spritesheetKey,
            "AI",
            aiOpponent
        );

        // Flip player 2 to face left
        this.player2.setFlipX(true);
        
        // Ensure both fighters start with full health (important for round restarts)
        this.player1.health = this.player1.maxHealth;
        this.player2.health = this.player2.maxHealth;
        
        console.log(`💚 HEALTH RESET: Fighter health reset - Player1: ${this.player1.health}/${this.player1.maxHealth}, Player2: ${this.player2.health}/${this.player2.maxHealth}`);
        
        debug.general(`Fighters created: ${selectedCharacter.name} vs ${aiOpponent.name}`);
    }

    private setupGameStore(): void {
        const gameStore = useGameStore.getState();
        
        // Clear any existing players to prevent health persistence from previous matches
        gameStore.removePlayer("player1");
        gameStore.removePlayer("player2");
        
        // Force clean state
        gameStore.resetMatch();
        
        // Add players to store with fresh health values
        gameStore.addPlayer({
            id: "player1",
            health: this.player1.maxHealth, // Ensure full health
            maxHealth: this.player1.maxHealth,
            name: this.player1.fighterName,
            x: this.player1.x,
            y: this.player1.y,
            state: PlayerState.IDLE,
            score: 0,
            isLocal: true,
            isAlive: true
        });
        
        gameStore.addPlayer({
            id: "player2",
            health: this.player2.maxHealth, // Ensure full health
            maxHealth: this.player2.maxHealth,
            name: this.player2.fighterName,
            x: this.player2.x,
            y: this.player2.y,
            state: PlayerState.IDLE,
            score: 0,
            isLocal: false,
            isAlive: true
        });
        
        // Set match settings for best-of-3 (first to 2 wins)
        gameStore.updateRoundTime(GAME_CONFIG.MATCH.ROUND_DURATION);
        gameStore.setMaxRounds(GAME_CONFIG.MATCH.MAX_ROUNDS); // Should be 2 for best-of-3
        
        // Only initialize round scores to 0 if this is a completely new match
        // Check if we have existing match data (continuing from previous round)
        const existingMatchData = this.registry.get("matchData");
        if (!existingMatchData) {
            // New match - reset scores
            gameStore.updateMatchScore("player1", 0);
            gameStore.updateMatchScore("player2", 0);
            debug.general("New match started - scores reset to 0");
        } else {
            // Continuing match - preserve existing scores
            gameStore.updateMatchScore("player1", existingMatchData.player1RoundWins || 0);
            gameStore.updateMatchScore("player2", existingMatchData.player2RoundWins || 0);
            debug.general("Continuing match - preserved scores:", existingMatchData);
        }
        
        debug.general("Game store initialized for FightScene with maxRounds:", GAME_CONFIG.MATCH.MAX_ROUNDS);
    }

    private updateGameStore(): void {
        const gameStore = useGameStore.getState();
        
        // Ensure health precision for UI display (force 0 when health is very low)
        const player1Health = this.player1.health < 0.01 ? 0 : this.player1.health;
        const player2Health = this.player2.health < 0.01 ? 0 : this.player2.health;
        
        // Update player health
        gameStore.updatePlayer("player1", {
            health: player1Health,
            x: this.player1.x,
            y: this.player1.y
        });
        
        gameStore.updatePlayer("player2", {
            health: player2Health,
            x: this.player2.x,
            y: this.player2.y
        });
        
        // Update round time
        gameStore.updateRoundTime(this.matchManager.roundTimeRemaining);
    }

    private getOrCreateAIOpponent(selectedCharacter: any): any {
        let aiOpponent = this.registry.get("aiOpponent");
        const gameMode = this.registry.get("gameMode") || "normal";
        const tournamentData = this.registry.get("tournamentData");
        
        if (!aiOpponent) {
            if (gameMode === "tournament" && tournamentData) {
                // Tournament mode: select next opponent in sequence
                aiOpponent = this.matchManager.selectTournamentOpponent(selectedCharacter, tournamentData);
                logger.gameEvent("tournament-opponent-selected", {
                    opponentName: aiOpponent.name,
                    opponentId: aiOpponent.id,
                    playerCharacter: selectedCharacter.name,
                    matchNumber: tournamentData.currentMatch + 1,
                    difficultyLevel: tournamentData.difficultyLevel
                });
            } else {
                // Normal mode: select AI opponent randomly
                const availableOpponents = characterList.filter(
                    (char) => char.id !== selectedCharacter.id
                );
                aiOpponent = availableOpponents[
                    Math.floor(Math.random() * availableOpponents.length)
                ];
                logger.gameEvent("ai-opponent-selected", {
                    opponentName: aiOpponent.name,
                    opponentId: aiOpponent.id,
                    playerCharacter: selectedCharacter.name
                });
            }
            
            // Persist AI opponent for the entire match
            this.registry.set("aiOpponent", aiOpponent);
        }

        return aiOpponent;
    }

    private handlePlayerInput(): void {
        // Movement
        if (this.inputManager.isLeftPressed()) {
            this.player1.move("left");
        } else if (this.inputManager.isRightPressed()) {
            this.player1.move("right");
        }

        // Jumping
        if (this.inputManager.isUpPressed()) {
            this.player1.jump();
        }

        // Attacks

        if (this.inputManager.isHeavyAttackPressed()) {
            this.player1.attack("heavy");
        }

        if (this.inputManager.isSpecialAttackPressed()) {
            this.player1.attack("special");
        }
    }

    private updateAI(): void {
        if (!this.gameStarted || this.gameEnded || !this.player2) return;

        const distance = this.getDistanceBetweenFighters();
        const gameMode = this.registry.get("gameMode");
        const tournamentData = this.registry.get("tournamentData");
        
        // Calculate difficulty settings
        const difficulty: AIDifficultySettings = AIController.calculateDifficulty(gameMode, tournamentData);
        
        // Update AI behavior using the controller
        this.aiController.updateAI(this.player2, this.player1, distance, difficulty);
    }

    private getDistanceBetweenFighters(): number {
        return Phaser.Math.Distance.Between(
            this.player1.x,
            this.player1.y,
            this.player2.x,
            this.player2.y
        );
    }

    private createCountdownDisplay(): void {
        const { width, height } = this.cameras.main;
        this.countdownText = this.add.text(
            width / 2,
            height / 2,
            "",
            {
                fontSize: "42px",
                color: "#ffff00",
                fontFamily: "Press Start 2P",
                stroke: "#000000",
                strokeThickness: 4,
            }
        );
        this.countdownText.setOrigin(0.5);
        this.countdownText.setDepth(1000);
    }

    private startCountdown(): void {
        this.isCountingDown = true;
        this.gameStarted = false;
        this.countdownValue = GAME_CONFIG.MATCH.COUNTDOWN_DURATION;
    }

    private updateCountdown(delta: number): void {
        this.countdownValue -= delta / 1000;

        if (this.countdownValue > 0) {
            const countdownNumber = Math.ceil(this.countdownValue);
            this.countdownText.setText(countdownNumber.toString());
        } else {
            // Countdown finished
            this.countdownText.setText("FIGHT!");

            // Hide countdown after brief delay and start game
            this.time.delayedCall(500, () => {
                this.countdownText.setVisible(false);
                this.isCountingDown = false;
                this.startGame();
            });
        }
    }

    private startGame(): void {
        this.gameStarted = true;
        this.countdownText.setVisible(false);
        
        debug.general("Fight started! Use WASD to move, K/L to attack, H to toggle hitbox debug");
    }

    private setupPauseHandling(): void {
        // Listen for ESC key to pause the game
        this.input.keyboard!.on("keydown-ESC", () => {
            if (!gamePauseService.isPaused()) {
                const gameMode = this.registry.get("gameMode") === "tournament" ? "tournament" : "normal";
                gamePauseService.pauseGame(gameMode, this);
            }
        });
        
        // Listen for H key to toggle hitbox debug
        this.input.keyboard!.on("keydown-H", () => {
            this.player1.toggleHitboxDebug();
            this.player2.toggleHitboxDebug();
        });
    }

    shutdown(): void {
        // Clean up game store to prevent health persistence
        const gameStore = useGameStore.getState();
        gameStore.removePlayer("player1");
        gameStore.removePlayer("player2");
        
        // Clean up input listeners
        this.input.keyboard!.removeAllListeners();
        
        // Clean up tweens
        this.tweens.killAll();
        
        // Clean up all custom event listeners
        this.eventListeners.forEach(cleanup => cleanup());
        this.eventListeners = [];
        
        // Clean up game systems
        this.combatSystem?.cleanup();
        
        // Clean up timers
        this.time.removeAllEvents();
        
        logger.gameEvent("fight-scene-shutdown", {
            scene: "FightScene"
        });
    }

    destroy() {
        // Clean up all event listeners to prevent memory leaks
        this.eventListeners.forEach(cleanup => cleanup());
        this.eventListeners = [];
        
        // Clean up game systems
        this.combatSystem?.cleanup();
        // UICoordinator cleanup removed - using EventBus directly
        
        // Clean up timers
        if (this.time) {
            this.time.removeAllEvents();
        }
        
        logger.gameEvent("fight-scene-destroyed", {
            eventListenersCleared: this.eventListeners.length
        });
        
        // Scene cleanup completed
        debug.general("FightScene cleanup completed");
    }
}