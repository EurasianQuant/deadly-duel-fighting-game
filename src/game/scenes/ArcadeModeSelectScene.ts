import Phaser from "phaser";

import EventBus from "@/lib/EventBus";
import { logger } from "@/lib/logger";
import { getArcadeMode, getAllArcadeModes, ArcadeModeConfig } from "@/config/arcadeModes";
import { Boot } from "./Boot";
import { TEXT_STYLES, UI_COLORS } from "@/game/ui/UIConstants";
import { solanaWalletService } from "@/services/solanaWalletService";

interface ModeOption {
    config: ArcadeModeConfig;
    action: () => void;
}

export class ArcadeModeSelectScene extends Phaser.Scene {
    private backgroundImage!: Phaser.GameObjects.Image;
    private modeOptions: ModeOption[] = [];
    private modeTexts: Phaser.GameObjects.Text[] = [];
    private descriptionTexts: Phaser.GameObjects.Text[] = [];
    private selectedIndex: number = 0;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>;
    private selectionIndicator!: Phaser.GameObjects.Text;
    private titleText!: Phaser.GameObjects.Text;
    private walletStatusText!: Phaser.GameObjects.Text;
    

    constructor() {
        super({ key: "ArcadeModeSelectScene" });
    }

    preload(): void {
        // Background will be shared with main menu
        this.load.image("arcade-bg", "assets/backgrounds/mainmenu-bg.png");
    }

    create(): void {
        // Reset selection state
        this.selectedIndex = 0;
        this.modeTexts = [];
        this.descriptionTexts = [];

        const { width, height } = this.cameras.main;

        // Use standardized background system
        Boot.createStandardBackground(this, true, 0.6);

        // Title using standardized text styles
        this.titleText = this.add.text(width / 2, 120, "ARCADE MODE", TEXT_STYLES.TITLE);
        this.titleText.setOrigin(0.5);

        // Add wallet status indicator
        this.createWalletStatusIndicator();

        // Subtitle using standardized text styles
        const subtitleText = this.add.text(width / 2, 180, "Choose Your Battle Style", TEXT_STYLES.SUBHEADER);
        subtitleText.setOrigin(0.5);

        // Setup menu options and UI
        this.setupModeOptions();
        this.createModeItems();
        this.setupInputHandlers();

        // Fade in effect
        this.cameras.main.fadeIn(300, 0, 0, 0);

        // Emit scene ready event
        EventBus.emit("current-scene-ready", this);

        logger.gameEvent("arcade-mode-select-opened", {
            scene: "ArcadeModeSelectScene"
        });
    }

    private setupModeOptions(): void {
        const arcadeModes = getAllArcadeModes();
        
        this.modeOptions = arcadeModes.map(config => ({
            config,
            action: () => this.startGameMode(config.id)
        }));
    }


    private createModeItems(): void {
        const { width, height } = this.cameras.main;
        const startY = height / 2 - 140;
        const spacing = 95;

        this.modeOptions.forEach((option, index) => {
            const y = startY + index * spacing;
            const config = option.config;

            // Mode title with better visibility
            const modeText = this.add.text(width / 2, y, config.name, {
                fontFamily: "Press Start 2P",
                fontSize: "28px",
                color: config.enabled ? "#FFFFFF" : "#9CA3AF",
                align: "center",
                stroke: "#000000",
                strokeThickness: 3,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: "#000000",
                    blur: 0,
                    fill: true,
                },
            });
            modeText.setOrigin(0.5);
            this.modeTexts.push(modeText);

            // Mode description with better contrast
            const descText = this.add.text(width / 2, y + 40, config.description, {
                fontFamily: "Press Start 2P",
                fontSize: "18px",
                color: config.enabled ? "#E5E7EB" : "#6B7280",
                align: "center",
                lineSpacing: 6,
                stroke: "#000000",
                strokeThickness: 2,
            });
            descText.setOrigin(0.5);
            this.descriptionTexts.push(descText);
        });

        // Selection indicator (arrow) with better visibility
        this.selectionIndicator = this.add.text(0, 0, "►", {
            fontFamily: "Press Start 2P",
            fontSize: "32px",
            color: "#FBBF24",
            align: "center",
            stroke: "#000000",
            strokeThickness: 2,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: "#000000",
                blur: 0,
                fill: true,
            },
        });
        this.selectionIndicator.setOrigin(0.5);

        // Update selection visual
        this.updateSelection();

        // Add selection indicator animation
        this.tweens.add({
            targets: this.selectionIndicator,
            x: "+=10",
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: "Power2",
        });

        // Add back button instruction
        this.add.text(width / 2, height - 50, "Press ESC to go back", {
            fontFamily: "Press Start 2P",
            fontSize: "18px",
            color: "#9CA3AF",
            align: "center",
        }).setOrigin(0.5);
    }

    private setupInputHandlers(): void {
        // Clear any existing listeners first
        this.input.keyboard!.removeAllListeners();

        // Cursor keys
        this.cursors = this.input.keyboard!.createCursorKeys();

        // WASD keys
        this.wasdKeys = this.input.keyboard!.addKeys("W,S,A,D,ENTER,SPACE,ESC") as Record<string, Phaser.Input.Keyboard.Key>;

        // Listen for key presses
        this.input.keyboard!.on("keydown", this.handleKeyPress, this);
    }

    private handleKeyPress = (event: KeyboardEvent): void => {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                this.moveSelection(-1);
                break;
            case "ArrowDown":
            case "KeyS":
                this.moveSelection(1);
                break;
            case "Enter":
            case "Space":
                this.selectCurrentOption();
                break;
            case "Escape":
                // Return to main menu
                this.goBackToMainMenu();
                break;
        }
    };

    private moveSelection(direction: number): void {
        // Find next enabled option
        let newIndex = this.selectedIndex;
        do {
            newIndex = (newIndex + direction + this.modeOptions.length) % this.modeOptions.length;
        } while (
            !this.modeOptions[newIndex].config.enabled &&
            newIndex !== this.selectedIndex
        );

        if (newIndex !== this.selectedIndex) {
            this.selectedIndex = newIndex;
            this.updateSelection();

            // Play selection sound (when audio is added)
            // this.sound.play('menu-move');
        }
    }

    private updateSelection(): void {
        // Reset all mode items to normal color
        this.modeTexts.forEach((text, index) => {
            const config = this.modeOptions[index].config;
            if (index === this.selectedIndex && config.enabled) {
                text.setColor("#FBBF24"); // Bright gold highlight
                text.setScale(1.1); // Larger scale for selection
                this.descriptionTexts[index].setColor("#FFFFFF");
                this.descriptionTexts[index].setScale(1.05);
            } else {
                text.setColor(config.enabled ? "#FFFFFF" : "#9CA3AF");
                text.setScale(1.0);
                this.descriptionTexts[index].setColor(config.enabled ? "#E5E7EB" : "#6B7280");
                this.descriptionTexts[index].setScale(1.0);
            }
        });

        // Position selection indicator
        const selectedText = this.modeTexts[this.selectedIndex];
        this.selectionIndicator.setPosition(
            selectedText.x - selectedText.displayWidth / 2 - 60,
            selectedText.y
        );
    }

    private selectCurrentOption(): void {
        const selectedOption = this.modeOptions[this.selectedIndex];

        if (selectedOption && selectedOption.config.enabled) {
            // Play confirmation sound (when audio is added)
            // this.sound.play('menu-select');

            logger.gameEvent("arcade-mode-selected", {
                mode: selectedOption.config.id,
                name: selectedOption.config.name,
                index: this.selectedIndex
            });

            selectedOption.action();
        }
    }

    private startGameMode(modeId: string): void {
        const config = getArcadeMode(modeId);
        if (!config) {
            console.error(`Unknown arcade mode: ${modeId}`);
            return;
        }

        console.log(`Starting ${config.name}...`);
        
        // Set game mode in registry
        this.registry.set("gameMode", modeId);
        this.registry.set("arcadeModeConfig", config);
        
        // Initialize mode-specific data based on configuration
        this.initializeModeData(config);
        
        // Determine navigation flow based on configuration
        this.navigateToNextScene(config);
    }

    private initializeModeData(config: ArcadeModeConfig): void {
        // Clear any existing mode data
        this.registry.remove("tournamentData");
        this.registry.remove("survivalData");
        this.registry.remove("timeAttackData");

        switch (config.id) {
            case "tournament":
                this.registry.set("tournamentData", {
                    currentMatch: 0,
                    totalMatches: config.gameplay.totalMatches || 5,
                    wins: 0,
                    losses: 0,
                    defeatedOpponents: [],
                    difficultyLevel: 1,
                    startTime: Date.now() // Track tournament start time for leaderboard
                });
                break;

            case "survival":
                this.registry.set("survivalData", {
                    currentRound: 0,
                    score: 0,
                    highScore: localStorage.getItem("survivalHighScore") || 0,
                    defeatedOpponents: 0,
                    streakMultiplier: 1.0
                });
                break;

            case "timeattack":
                this.registry.set("timeAttackData", {
                    selectedCourse: null,
                    bestTimes: JSON.parse(localStorage.getItem("timeAttackBestTimes") || "{}"),
                    medals: JSON.parse(localStorage.getItem("timeAttackMedals") || "{}")
                });
                break;

            case "normal":
            default:
                // Normal match doesn't need special data initialization
                break;
        }
    }

    private navigateToNextScene(config: ArcadeModeConfig): void {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            if (config.flow.courseSelection) {
                // Time Attack goes to course selection first
                this.scene.start("TimeAttackSelectScene");
            } else if (config.flow.characterSelection) {
                // All other modes go to character selection
                this.scene.start("CharacterSelectScene");
            } else {
                // Direct start (not currently used)
                console.warn("Direct start not implemented");
                this.scene.start("CharacterSelectScene");
            }
        });
    }

    private goBackToMainMenu(): void {
        logger.gameEvent("arcade-mode-select-back", {
            selectedIndex: this.selectedIndex
        });

        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("MainMenuScene");
        });
    }

    private createWalletStatusIndicator(): void {
        const { width } = this.cameras.main;
        const walletState = solanaWalletService.getState();

        let statusText = "";
        let statusColor = "";

        if (walletState.connected && walletState.publicKey) {
            // Connected state - show as Global Player
            const shortAddress = walletState.publicKey.slice(0, 4) + "..." + walletState.publicKey.slice(-4);
            statusText = `🌐 Global Player (${shortAddress})`;
            statusColor = UI_COLORS.PRIMARY; // Blue
        } else if (walletState.connecting) {
            // Connecting state
            statusText = "🔄 Connecting Wallet...";
            statusColor = UI_COLORS.WARNING; // Yellow
        } else {
            // Disconnected state - show as Local Player
            statusText = "⭐ Local Player";
            statusColor = UI_COLORS.SECONDARY; // Gold/Amber
        }

        this.walletStatusText = this.add.text(width - 20, 20, statusText, {
            fontFamily: "Press Start 2P",
            fontSize: "10px",
            color: statusColor,
            align: "right",
            stroke: "#000000",
            strokeThickness: 2,
        });
        this.walletStatusText.setOrigin(1, 0); // Right-aligned

        // Listen for wallet state changes to update the indicator
        EventBus.on("wallet-state-changed", this.updateWalletStatus, this);
        EventBus.on("wallet-connected", this.updateWalletStatus, this);
        EventBus.on("wallet-disconnected", this.updateWalletStatus, this);
    }

    private updateWalletStatus = (): void => {
        if (!this.walletStatusText || !this.walletStatusText.active) {
            return;
        }

        const walletState = solanaWalletService.getState();

        if (walletState.connected && walletState.publicKey) {
            const shortAddress = walletState.publicKey.slice(0, 4) + "..." + walletState.publicKey.slice(-4);
            this.walletStatusText.setText(`🌐 Global Player (${shortAddress})`);
            this.walletStatusText.setColor(UI_COLORS.PRIMARY);
        } else if (walletState.connecting) {
            this.walletStatusText.setText("🔄 Connecting Wallet...");
            this.walletStatusText.setColor(UI_COLORS.WARNING);
        } else {
            this.walletStatusText.setText("⭐ Local Player");
            this.walletStatusText.setColor(UI_COLORS.SECONDARY);
        }
    };

    shutdown(): void {
        // Clean up event listeners
        this.input.keyboard!.removeAllListeners();
        this.tweens.killAll();

        // Clean up EventBus listeners
        EventBus.off("wallet-state-changed", this.updateWalletStatus, this);
        EventBus.off("wallet-connected", this.updateWalletStatus, this);
        EventBus.off("wallet-disconnected", this.updateWalletStatus, this);

        // Clear arrays to prevent stale references
        this.modeTexts = [];
        this.descriptionTexts = [];
        this.modeOptions = [];
    }
}