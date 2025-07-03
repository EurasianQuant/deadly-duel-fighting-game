import { Scene } from "phaser";
import { GAME_CONFIG, GameState, PlayerState } from "@/config/gameConfig";
import { characterList, getCharacterById, Character } from "@/data/characters";
import { Fighter } from "@/game/entities/Fighter";
import { InputManager } from "@/game/systems/input/InputManager";
import { AIController } from "@/game/systems/AIController";
// PhaserOptimizer removed - using standard Phaser optimization
import EventBus from "@/lib/EventBus";
import { useGameStore } from "@/state/stores/gameStore";
import { logger } from "@/lib/logger";
import debug from "@/lib/debug";
import { hybridLeaderboardService } from "@/services/hybridLeaderboardService";
import { gamePauseService } from "@/services/gamePauseService";
import { Boot } from "./Boot";

interface CourseData {
    id: string;
    name: string;
    opponents: string[]; // Array of character IDs to fight
    targetTime: number;
    difficulty: string;
}

interface CourseSelection {
    id: string;
    name: string;
    opponents: number; // Number of opponents to generate
    targetTime: number;
    difficulty: string;
}

interface TimeAttackData {
    selectedCourse: CourseData;
    currentOpponentIndex: number;
    startTime: number;
    totalTime: number;
    opponentTimes: number[];
    bonusTime: number;
}

export class TimeAttackScene extends Scene {
    // Core game objects
    private player!: Fighter;
    private enemy!: Fighter;
    private groundCollider!: Phaser.Physics.Arcade.StaticGroup;
    
    // Game systems
    private inputManager!: InputManager;
    private aiController!: AIController;
    // PhaserOptimizer removed - using standard Phaser optimization
    
    // Time attack specific data
    private timeAttackData!: TimeAttackData;
    private opponentStartTime: number = 0;
    private gameStarted: boolean = false;
    private courseComplete: boolean = false;
    private processingOpponentDefeat: boolean = false;
    
    // UI elements
    private timerText!: Phaser.GameObjects.Text;
    private courseText!: Phaser.GameObjects.Text;
    private opponentText!: Phaser.GameObjects.Text;
    private countdownText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: "TimeAttackScene" });
    }

    preload(): void {
        // Assets are already loaded in Boot scene
    }

    create(): void {
        debug.general("⏱️ Time Attack Scene starting...");

        // Initialize time attack data
        this.initializeTimeAttackData();
        
        // Set up the scene
        this.createBackground();
        this.createGround();
        this.createPlayer();
        this.setupInput();
        this.setupPauseHandling();
        this.createUI();
        
        // Initialize systems
        // PhaserOptimizer removed - using standard Phaser optimization
        
        // Override global fighter-defeated handler to prevent match ending
        this.setupTimeAttackEventHandlers();
        
        // Start first opponent
        this.createCurrentOpponent();
        this.startCountdown();
        
        // Set game mode in registry and store
        this.registry.set("gameMode", "timeattack");
        useGameStore.setState({ 
            currentState: GameState.PLAYING
        });

        // Health emitters will be setup after opponent creation

        EventBus.emit("current-scene-ready", this);
        logger.gameEvent("time-attack-started", { 
            course: this.timeAttackData.selectedCourse.id,
            character: this.player.fighterName 
        });
    }

    private initializeTimeAttackData(): void {
        const registryData = this.registry.get("timeAttackData") || {};
        const selectedCourse = registryData.selectedCourse;
        
        console.log("🔍 TIME ATTACK: Registry data:", registryData);
        console.log("🔍 TIME ATTACK: Selected course:", selectedCourse);
        
        if (!selectedCourse) {
            console.error("No course selected for time attack");
            this.scene.start("TimeAttackSelectScene");
            return;
        }

        // Define course opponents
        const courseOpponents = this.getCourseOpponents(selectedCourse);
        
        this.timeAttackData = {
            selectedCourse: {
                ...selectedCourse,
                opponents: courseOpponents
            },
            currentOpponentIndex: 0,
            startTime: 0,
            totalTime: 0,
            opponentTimes: [],
            bonusTime: 0
        };
        
        debug.general("Time Attack data initialized:", this.timeAttackData);
    }

    private getCourseOpponents(course: CourseSelection): string[] {
        console.log("🎯 TIME ATTACK: Getting course opponents for:", course);
        console.log("🎯 TIME ATTACK: Course.opponents value:", course.opponents, "type:", typeof course.opponents);
        
        // Generate opponent sequences based on course difficulty
        const availableCharacters = characterList.map(char => char.id);
        const opponents: string[] = [];
        
        // Ensure opponents is a valid number
        let opponentCount = typeof course.opponents === 'number' ? course.opponents : 1;
        
        // Safety check: if opponentCount is 0 or negative, default based on course ID
        if (opponentCount <= 0) {
            console.warn("🎯 TIME ATTACK: Invalid opponent count, using default based on course ID");
            switch (course.id) {
                case 'beginner':
                case 'rookie':
                    opponentCount = 3;
                    break;
                case 'intermediate':
                case 'veteran':
                    opponentCount = 3;
                    break;
                case 'advanced':
                case 'champion':
                    opponentCount = 5;
                    break;
                case 'expert':
                case 'master':
                    opponentCount = 5;
                    break;
                default:
                    opponentCount = 3;
            }
        }
        
        console.log("🎯 TIME ATTACK: Will create", opponentCount, "opponents");
        
        // Shuffle and select required number of opponents
        const shuffled = [...availableCharacters].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < opponentCount; i++) {
            opponents.push(shuffled[i % shuffled.length]);
        }
        
        console.log("🎯 TIME ATTACK: Generated opponents:", opponents);
        return opponents;
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
        const groundBody = this.groundCollider.create(width / 2, groundY + 10, undefined); // Match CombatSystem positioning
        groundBody.setSize(width, 20);
        groundBody.setVisible(false);
    }

    private createPlayer(): void {
        // Get selected character from registry
        const selectedCharacterData = this.registry.get("selectedCharacter");
        const selectedCharacterId = typeof selectedCharacterData === 'string' ? selectedCharacterData : selectedCharacterData?.id || "rocco";
        const characterData = getCharacterById(selectedCharacterId);
        
        console.log("🎮 TIME ATTACK: Creating player with character:", selectedCharacterId, characterData);
        
        if (!characterData) {
            console.error("Character not found:", selectedCharacterId, "Available characters:", characterList.map(c => c.id));
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
        
        console.log("✅ TIME ATTACK: Player created successfully:", this.player.fighterName, "at position", this.player.x, this.player.y);
        debug.general(`Player created: ${characterData.name}`);
    }

    private setupInput(): void {
        this.inputManager = new InputManager(this);
    }

    private setupPauseHandling(): void {
        // Listen for ESC key to pause the game
        this.input.keyboard!.on("keydown-ESC", () => {
            if (!gamePauseService.isPaused()) {
                gamePauseService.pauseGame("timeattack", this);
            }
        });
    }

    private createUI(): void {
        const { width } = this.cameras.main;
        
        // Only keep essential UI elements (countdown)
        // Health bars and timers are handled by React HUD
        
        // Countdown text (center, hidden initially)
        this.countdownText = this.add.text(width / 2, 300, "", {
            fontFamily: "Press Start 2P",
            fontSize: "48px",
            color: "#FBBF24",
            stroke: "#000000", 
            strokeThickness: 4,
            align: "center"
        });
        this.countdownText.setOrigin(0.5);
        this.countdownText.setVisible(false);
        
        // Create invisible text elements for internal tracking
        this.timerText = this.add.text(0, 0, "", { fontSize: "1px", color: "#000000" });
        this.courseText = this.add.text(0, 0, "", { fontSize: "1px", color: "#000000" });
        this.opponentText = this.add.text(0, 0, "", { fontSize: "1px", color: "#000000" });
        this.timerText.setVisible(false);
        this.courseText.setVisible(false);
        this.opponentText.setVisible(false);
        
        this.updateUI();
    }

    private updateUI(): void {
        const course = this.timeAttackData.selectedCourse;
        
        // Course info
        this.courseText.setText(`${course.name}\nTarget: ${this.formatTime(course.targetTime)}`);
        
        // Opponent progress
        this.opponentText.setText(`Opponent: ${this.timeAttackData.currentOpponentIndex + 1}/${course.opponents.length}`);
        
        // Timer
        if (this.gameStarted && !this.courseComplete) {
            const currentTime = (this.time.now - this.timeAttackData.startTime) / 1000;
            this.timerText.setText(this.formatTime(currentTime));
        } else {
            this.timerText.setText("--:--.--");
        }
    }

    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${minutes}:${secs.padStart(5, '0')}`;
    }

    private createCurrentOpponent(): void {
        // Remove existing enemy
        if (this.enemy) {
            this.enemy.destroy();
            this.aiController = null!;
        }

        console.log("🔍 TIME ATTACK: Current opponent index:", this.timeAttackData.currentOpponentIndex);
        console.log("🔍 TIME ATTACK: Opponents array:", this.timeAttackData.selectedCourse.opponents);
        console.log("🔍 TIME ATTACK: Opponents array length:", this.timeAttackData.selectedCourse.opponents.length);
        
        const opponentId = this.timeAttackData.selectedCourse.opponents[this.timeAttackData.currentOpponentIndex];
        const characterData = getCharacterById(opponentId);
        
        console.log(`🤖 TIME ATTACK: Creating opponent ${this.timeAttackData.currentOpponentIndex + 1} with character:`, opponentId);
        
        if (!characterData) {
            console.error("Opponent character not found:", opponentId, "Available characters:", characterList.map(c => c.id));
            return;
        }

        // Create enemy at dynamic position
        const { width, height } = this.cameras.main;
        const groundY = height - 20;
        const playerStartY = groundY - 10;
        
        this.enemy = new Fighter(
            this,
            width * 0.85, // 85% from left edge (15% from right)
            playerStartY,
            characterData.spritesheetKey,
            `Opponent ${this.timeAttackData.currentOpponentIndex + 1}`,
            characterData
        );
        
        console.log(`✅ TIME ATTACK: Opponent created successfully:`, this.enemy.fighterName, "at position", this.enemy.x, this.enemy.y);

        // Apply difficulty-based stat multipliers
        const difficulty = this.timeAttackData.selectedCourse.difficulty;
        this.applyDifficultyMultipliers(difficulty);

        // Face the player
        this.enemy.setFlipX(true);

        // Setup physics
        this.physics.add.collider(this.enemy, this.groundCollider);

        // Create AI controller with appropriate difficulty
        this.aiController = new AIController();
        
        // Setup health emitters for React HUD after opponent is created
        this.setupHealthEventEmitters();
        
        // Update health display for new opponent
        this.emitHealthUpdate();
        
        debug.general(`Created opponent: ${characterData.name} (${difficulty})`);
    }

    private applyDifficultyMultipliers(difficulty: string): void {
        let healthMultiplier = 1.0;
        let speedMultiplier = 1.0;
        
        switch (difficulty) {
            case "Intermediate":
                healthMultiplier = 1.2;
                speedMultiplier = 1.1;
                break;
            case "Advanced":
                healthMultiplier = 1.4;
                speedMultiplier = 1.2;
                break;
            case "Expert":
                healthMultiplier = 1.6;
                speedMultiplier = 1.3;
                break;
        }
        
        this.enemy.health = Math.floor(this.enemy.health * healthMultiplier);
        this.enemy.maxHealth = Math.floor(this.enemy.maxHealth * healthMultiplier);
        this.enemy.speed = Math.floor(this.enemy.speed * speedMultiplier);
    }

    private getAIDifficulty(difficulty: string): number {
        switch (difficulty) {
            case "Beginner": return 1.0;
            case "Intermediate": return 1.5;
            case "Advanced": return 2.0;
            case "Expert": return 2.5;
            default: return 1.0;
        }
    }

    private startCountdown(): void {
        let countdown = 3;
        this.countdownText.setVisible(true);
        this.countdownText.setText(countdown.toString());
        
        // Animate countdown
        this.tweens.add({
            targets: this.countdownText,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 200,
            yoyo: true,
            ease: "Power2"
        });
        
        // Countdown timer
        this.time.addEvent({
            delay: 1000,
            repeat: 2,
            callback: () => {
                countdown--;
                if (countdown > 0) {
                    this.countdownText.setText(countdown.toString());
                    this.tweens.add({
                        targets: this.countdownText,
                        scaleX: 1.5,
                        scaleY: 1.5,
                        duration: 200,
                        yoyo: true,
                        ease: "Power2"
                    });
                } else {
                    this.countdownText.setText("GO!");
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
                        }
                    });
                    this.startTimeAttack();
                }
            }
        });
    }

    private startTimeAttack(): void {
        this.gameStarted = true;
        this.timeAttackData.startTime = this.time.now;
        this.opponentStartTime = this.time.now;
        
        debug.general("Time Attack started");
    }

    private checkOpponentDefeated(): void {
        if (this.enemy && this.enemy.health <= 0 && !this.processingOpponentDefeat) {
            this.processingOpponentDefeat = true; // Prevent multiple processing
            
            console.log("🏆 TIME ATTACK: Opponent defeated! Current index:", this.timeAttackData.currentOpponentIndex);
            console.log("🏆 TIME ATTACK: Total opponents in course:", this.timeAttackData.selectedCourse.opponents.length);
            
            // Record opponent time
            const opponentTime = (this.time.now - this.opponentStartTime) / 1000;
            this.timeAttackData.opponentTimes.push(opponentTime);
            
            // Calculate bonuses
            this.calculateTimeBonuses();
            
            // Move to next opponent or complete course
            this.timeAttackData.currentOpponentIndex++;
            console.log("🏆 TIME ATTACK: Moving to opponent index:", this.timeAttackData.currentOpponentIndex);
            
            // Update course progress in React HUD
            const gameStore = useGameStore.getState();
            gameStore.updateMatchScore("player1", this.timeAttackData.currentOpponentIndex);
            
            if (this.timeAttackData.currentOpponentIndex >= this.timeAttackData.selectedCourse.opponents.length) {
                console.log("🏆 TIME ATTACK: Course complete! All opponents defeated.");
                this.completeCourse();
            } else {
                console.log("🏆 TIME ATTACK: Moving to next opponent...");
                this.nextOpponent();
            }
        }
    }

    private calculateTimeBonuses(): void {
        const opponentTime = this.timeAttackData.opponentTimes[this.timeAttackData.opponentTimes.length - 1];
        let bonus = 0;
        
        // Perfect victory bonus (no damage taken)
        if (this.player.health === this.player.maxHealth) {
            bonus += 5; // 5 seconds off
        }
        
        // Health preservation bonus
        const healthPercent = this.player.health / this.player.maxHealth;
        bonus += Math.floor(healthPercent * 3); // Up to 3 seconds
        
        // Quick victory bonus (if defeated quickly)
        if (opponentTime < 30) {
            bonus += 2; // 2 seconds for quick victory
        }
        
        this.timeAttackData.bonusTime += bonus;
        
        if (bonus > 0) {
            this.showBonusText(bonus);
        }
        
        debug.general(`Opponent defeated in ${opponentTime.toFixed(2)}s, bonus: ${bonus}s`);
    }

    private showBonusText(bonus: number): void {
        const { width, height } = this.cameras.main;
        
        const bonusText = this.add.text(width / 2, height / 2, `-${bonus}s BONUS!`, {
            fontFamily: "Press Start 2P",
            fontSize: "24px",
            color: "#00FF00",
            stroke: "#000000",
            strokeThickness: 2,
            align: "center"
        });
        bonusText.setOrigin(0.5);
        
        // Animate bonus text
        this.tweens.add({
            targets: bonusText,
            y: height / 2 - 50,
            alpha: 0,
            duration: 2000,
            ease: "Power2",
            onComplete: () => bonusText.destroy()
        });
    }

    private nextOpponent(): void {
        // Brief pause between opponents
        this.time.delayedCall(1500, () => {
            this.processingOpponentDefeat = false; // Reset the flag for next opponent
            this.createCurrentOpponent();
            this.opponentStartTime = this.time.now;
            this.updateUI();
        });
    }

    private async completeCourse(): Promise<void> {
        console.log("🏁 TIME ATTACK: completeCourse() called");
        console.log("🏁 TIME ATTACK: Final opponent index:", this.timeAttackData.currentOpponentIndex);
        console.log("🏁 TIME ATTACK: Total opponents:", this.timeAttackData.selectedCourse.opponents.length);
        
        this.courseComplete = true;
        this.gameStarted = false;
        
        // Reset course progress indicators
        const gameStore = useGameStore.getState();
        gameStore.updateMatchScore("player1", 0);
        gameStore.updateMatchScore("player2", 0);
        
        // Calculate final time
        const totalTime = (this.time.now - this.timeAttackData.startTime) / 1000;
        const finalTime = Math.max(0, totalTime - this.timeAttackData.bonusTime);
        
        this.timeAttackData.totalTime = finalTime;
        
        // Update best time if necessary (legacy localStorage)
        this.updateBestTime(finalTime);
        
        // Calculate medal
        const medal = this.calculateMedal(finalTime);
        
        // Count perfect victories (no damage taken defeats)
        const perfectVictories = this.timeAttackData.opponentTimes.filter((_, index) => {
            // This is a simplified check - in a real implementation, you'd track damage per opponent
            return this.player.health === this.player.maxHealth;
        }).length;
        
        // Get selected character data
        const selectedCharacterData = this.registry.get("selectedCharacter");
        const selectedCharacterId = typeof selectedCharacterData === "string" 
            ? selectedCharacterData 
            : selectedCharacterData?.id || "rocco";

        // Get player profile for player name
        const playerProfile = hybridLeaderboardService.getPlayerProfile();

        // Add time attack entry to leaderboard (instant memory update + async persistence)
        await hybridLeaderboardService.addTimeAttackEntry({
            playerName: playerProfile.playerName,
            character: selectedCharacterId,
            courseId: this.timeAttackData.selectedCourse.id,
            courseName: this.timeAttackData.selectedCourse.name,
            completionTime: finalTime,
            medal: medal as 'Gold' | 'Silver' | 'Bronze' | 'None',
            bonusTime: this.timeAttackData.bonusTime,
            perfectVictories: perfectVictories,
            timestamp: Date.now(),
        });

        // Update character statistics
        const currentStats = playerProfile.characterStats[selectedCharacterId];
        const currentBestTime = currentStats?.timeAttackBestTimes[this.timeAttackData.selectedCourse.id] || Infinity;
        const isNewBest = finalTime < currentBestTime;

        // Update character statistics (instant memory update + async persistence)
        hybridLeaderboardService.updateCharacterStats(selectedCharacterId, {
            matchesPlayed: 1,
            timeAttackCompletions: (currentStats?.timeAttackCompletions || 0) + 1,
            timeAttackBestTimes: {
                ...currentStats?.timeAttackBestTimes,
                [this.timeAttackData.selectedCourse.id]: isNewBest ? finalTime : currentBestTime
            },
            totalPlayTime: (currentStats?.totalPlayTime || 0) + totalTime,
        });
        
        // Log completion
        logger.gameEvent("time-attack-completed", {
            course: this.timeAttackData.selectedCourse.id,
            totalTime: totalTime,
            finalTime: finalTime,
            bonusTime: this.timeAttackData.bonusTime,
            medal: medal,
            character: selectedCharacterId,
            isNewBest: isNewBest
        });

        console.log("📊 TIME ATTACK: Score saved to leaderboard:", {
            course: this.timeAttackData.selectedCourse.name,
            time: hybridLeaderboardService.formatTime(finalTime),
            medal: medal,
            character: selectedCharacterId,
            isNewBest: isNewBest,
        });
        
        // Show completion screen
        this.showCompletionScreen(finalTime, medal);
        
        debug.general(`Course completed in ${finalTime.toFixed(2)}s (${medal} medal)`);
    }

    private updateBestTime(finalTime: number): void {
        const courseId = this.timeAttackData.selectedCourse.id;
        const bestTimes = JSON.parse(localStorage.getItem("timeAttackBestTimes") || "{}");
        
        if (!bestTimes[courseId] || finalTime < bestTimes[courseId]) {
            bestTimes[courseId] = finalTime;
            localStorage.setItem("timeAttackBestTimes", JSON.stringify(bestTimes));
        }
    }

    private calculateMedal(finalTime: number): string {
        const targetTime = this.timeAttackData.selectedCourse.targetTime;
        
        // Medal thresholds based on target time
        const goldTime = targetTime * 0.8;   // 80% of target
        const silverTime = targetTime * 0.9; // 90% of target
        const bronzeTime = targetTime;       // Target time
        
        if (finalTime <= goldTime) return "Gold";
        if (finalTime <= silverTime) return "Silver";
        if (finalTime <= bronzeTime) return "Bronze";
        return "None";
    }

    private showCompletionScreen(finalTime: number, medal: string): void {
        const { width, height } = this.cameras.main;
        
        // Overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        
        // Course complete text
        const completeText = this.add.text(width / 2, height / 2 - 120, "COURSE COMPLETE!", {
            fontFamily: "Press Start 2P",
            fontSize: "36px",
            color: "#FBBF24",
            stroke: "#000000",
            strokeThickness: 4,
            align: "center"
        });
        completeText.setOrigin(0.5);
        
        // Medal and time info
        const medalColor = this.getMedalColor(medal);
        const resultsText = this.add.text(width / 2, height / 2,
            `MEDAL: ${medal}\n\n` +
            `TIME: ${this.formatTime(finalTime)}\n` +
            `TARGET: ${this.formatTime(this.timeAttackData.selectedCourse.targetTime)}\n` +
            `BONUS: -${this.timeAttackData.bonusTime}s`,
            {
                fontFamily: "Press Start 2P",
                fontSize: "24px",
                color: medalColor,
                stroke: "#000000",
                strokeThickness: 2,
                align: "center",
                lineSpacing: 10
            }
        );
        resultsText.setOrigin(0.5);
        
        // Continue instruction
        const continueText = this.add.text(width / 2, height / 2 + 120, "Press ENTER to continue", {
            fontFamily: "Press Start 2P",
            fontSize: "20px",
            color: "#FFFFFF",
            align: "center"
        });
        continueText.setOrigin(0.5);
        
        // Handle input for returning to course select
        this.input.keyboard!.once("keydown-ENTER", () => {
            this.scene.start("TimeAttackSelectScene");
        });
    }

    private getMedalColor(medal: string): string {
        switch (medal) {
            case "Gold": return "#FFD700";
            case "Silver": return "#C0C0C0";
            case "Bronze": return "#CD7F32";
            default: return "#FFFFFF";
        }
    }

    private checkPlayerDefeated(): void {
        if (this.player.health <= 0) {
            this.gameStarted = false;
            
            // Reset course progress indicators
            const gameStore = useGameStore.getState();
            gameStore.updateMatchScore("player1", 0);
            gameStore.updateMatchScore("player2", 0);
            
            this.showGameOverScreen();
        }
    }

    private showGameOverScreen(): void {
        const { width, height } = this.cameras.main;
        
        // Overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        
        // Game Over text
        const gameOverText = this.add.text(width / 2, height / 2 - 50, "TIME ATTACK FAILED", {
            fontFamily: "Press Start 2P",
            fontSize: "36px",
            color: "#FF4444",
            stroke: "#000000",
            strokeThickness: 4,
            align: "center"
        });
        gameOverText.setOrigin(0.5);
        
        // Continue instruction
        const continueText = this.add.text(width / 2, height / 2 + 50, "Press ENTER to try again", {
            fontFamily: "Press Start 2P",
            fontSize: "20px",
            color: "#FFFFFF",
            align: "center"
        });
        continueText.setOrigin(0.5);
        
        // Handle input for retry
        this.input.keyboard!.once("keydown-ENTER", () => {
            this.scene.start("TimeAttackSelectScene");
        });
    }

    update(time: number, delta: number): void {
        if (!this.gameStarted || this.courseComplete) return;
        
        // Update player
        this.handleInput();
        this.player.update(delta);
        
        // Update enemy and AI
        if (this.enemy && this.enemy.health > 0) {
            this.enemy.update(delta);
            // Calculate distance and difficulty
            const distance = Math.abs(this.enemy.x - this.player.x);
            const enemyDifficulty = this.timeAttackData.selectedCourse.difficulty;
            const difficultyLevel = this.getAIDifficulty(enemyDifficulty);
            const difficultySettings = { aggression: difficultyLevel, reaction: difficultyLevel, strategy: difficultyLevel, level: difficultyLevel };
            this.aiController?.updateAI(this.enemy, this.player, distance, difficultySettings);
        }
        
        // Update grounded states for proper animation transitions
        this.updateGroundedStates();
        
        // Check for combat collisions
        this.checkCombatCollisions();
        
        // Check end conditions
        this.checkOpponentDefeated();
        this.checkPlayerDefeated();
        
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
        // Check player attacks against enemy
        if (this.player.getIsAttacking() && this.enemy && this.enemy.health > 0 && !this.enemy.getIsInvulnerable()) {
            const playerHitbox = this.player.getAttackHitbox();
            const enemyBounds = this.enemy.getBounds();
            
            if (Phaser.Geom.Rectangle.Overlaps(
                new Phaser.Geom.Rectangle(playerHitbox.x, playerHitbox.y, playerHitbox.width, playerHitbox.height),
                enemyBounds
            )) {
                const attackType = this.player.getCurrentAttackType();
                if (attackType) {
                    const damage = this.getAttackDamage(attackType);
                    this.enemy.takeDamage(damage);
                    debug.general(`Player hit enemy for ${damage} damage`);
                }
            }
        }
        
        // Check enemy attacks against player
        if (this.enemy && this.enemy.health > 0 && this.enemy.getIsAttacking() && !this.player.getIsInvulnerable()) {
            const enemyHitbox = this.enemy.getAttackHitbox();
            const playerBounds = this.player.getBounds();
            
            if (Phaser.Geom.Rectangle.Overlaps(
                new Phaser.Geom.Rectangle(enemyHitbox.x, enemyHitbox.y, enemyHitbox.width, enemyHitbox.height),
                playerBounds
            )) {
                const attackType = this.enemy.getCurrentAttackType();
                if (attackType) {
                    const damage = this.getAttackDamage(attackType);
                    this.player.takeDamage(damage);
                    debug.general(`Enemy hit player for ${damage} damage`);
                }
            }
        }
    }

    private getAttackDamage(attackType: string): number {
        switch (attackType) {
            case "light": return GAME_CONFIG.COMBAT.LIGHT_DAMAGE;
            case "heavy": return GAME_CONFIG.COMBAT.HEAVY_DAMAGE; 
            case "special": return GAME_CONFIG.COMBAT.SPECIAL_DAMAGE;
            default: return 0;
        }
    }

    private setupHealthEventEmitters(): void {
        // Initialize game store for Time Attack mode
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
            isAlive: true
        });
        
        gameStore.addPlayer({
            id: "player2",
            health: this.enemy ? this.enemy.health : 100,
            maxHealth: this.enemy ? this.enemy.maxHealth : 100,
            name: this.enemy ? this.enemy.fighterName : "Opponent",
            x: this.enemy ? this.enemy.x : 0,
            y: this.enemy ? this.enemy.y : 0,
            state: PlayerState.IDLE,
            score: 0,
            isLocal: false,
            isAlive: true
        });
        
        // Set time attack-specific UI state - show target time initially
        gameStore.updateRoundTime(this.timeAttackData.selectedCourse.targetTime);
        
        // Initialize match score to show course progress with text display
        gameStore.updateMatchScore("player1", 0); // Opponents defeated
        gameStore.updateMatchScore("player2", this.timeAttackData.selectedCourse.opponents.length); // Total opponents
        gameStore.setMaxRounds(0); // Set to 0 to use text-based progress display instead of round indicators
        
        // Emit initial health state
        this.emitHealthUpdate();
    }

    private emitHealthUpdate(): void {
        const gameStore = useGameStore.getState();
        
        const enemyHealthData = this.enemy ? {
            health: this.enemy.health,
            maxHealth: this.enemy.maxHealth,
            name: `Opponent ${this.timeAttackData.currentOpponentIndex + 1}`
        } : {
            health: 0,
            maxHealth: 100,
            name: "No Opponent"
        };

        // Update players in game store for React HUD
        gameStore.updatePlayer("player1", {
            health: this.player.health,
            maxHealth: this.player.maxHealth,
            name: this.player.fighterName
        });
        
        gameStore.updatePlayer("player2", enemyHealthData);
        
        // Update elapsed time (for time attack, show elapsed time not countdown)
        if (this.gameStarted && !this.courseComplete) {
            const currentTime = (this.time.now - this.timeAttackData.startTime) / 1000;
            // For time attack, we want to show elapsed time, not countdown
            // Pass negative value to indicate this is elapsed time display mode
            // Use -0.1 - currentTime so it's always between -0.1 and negative infinity
            // This way survival mode can use < -1 to hide timer completely
            gameStore.updateRoundTime(-0.1 - currentTime);
        }

        // Also emit legacy event for backwards compatibility
        EventBus.emit("health-update", {
            player1: {
                health: this.player.health,
                maxHealth: this.player.maxHealth,
                name: this.player.fighterName
            },
            player2: enemyHealthData
        });
    }

    private setupTimeAttackEventHandlers(): void {
        console.log("🎯 TIME ATTACK: Setting up custom event handlers");
        
        // Note: We can't easily remove the global handler since it's set up in a React hook
        // Instead, we'll ensure our custom handler doesn't interfere
        // The global handler calls endRound() which we want to avoid
        
        // For now, let's just be careful about not triggering the global handler
        // by ensuring our enemy fighter names don't match what the global handler expects
    }
    

    private updateGroundedStates(): void {
        const { height } = this.cameras.main;
        const groundY = height - 20;
        const groundOffset = GAME_CONFIG.FIGHTER.GROUND_OFFSET;
        
        // Update player grounded state
        this.player.updateGroundedState(this.player.y >= groundY - groundOffset);
        
        // Update enemy grounded state if enemy exists
        if (this.enemy) {
            this.enemy.updateGroundedState(this.enemy.y >= groundY - groundOffset);
        }
    }

    shutdown(): void {
        // Clean up fighters to prevent stale references during scene transitions
        if (this.player) {
            this.player.destroy();
            this.player = null!;
        }
        
        if (this.enemy) {
            this.enemy.destroy();
            this.enemy = null!;
        }
        
        // Clean up AI controller
        this.aiController = null!;
        
        // Reset processing flags
        this.processingOpponentDefeat = false;
        this.gameStarted = false;
        this.courseComplete = false;
        
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