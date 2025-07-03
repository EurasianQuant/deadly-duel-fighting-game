import { Scene } from "phaser";

import {
    Character,
    characterList,
} from "@/data/characters";
import EventBus from "@/lib/EventBus";
import { logger } from "@/lib/logger";
import { solanaWalletService } from "@/services/solanaWalletService";
import { UI_COLORS } from "@/game/ui/UIConstants";

export class CharacterSelectScene extends Scene {
    private characters: Character[] = [];
    private selectedCharacterIndex: number = 0;
    private backgroundImage!: Phaser.GameObjects.Image;
    private titleText!: Phaser.GameObjects.Text;
    private characterPortraits: Phaser.GameObjects.Image[] = [];
    private characterNames: Phaser.GameObjects.Text[] = [];
    private selectionBorder!: Phaser.GameObjects.Graphics;
    private instructionText!: Phaser.GameObjects.Text;
    private confirmText!: Phaser.GameObjects.Text;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>;
    private walletStatusText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: "CharacterSelectScene" });
    }

    create() {
        // Reset selection state
        this.selectedCharacterIndex = 0;
        this.characterPortraits = [];
        this.characterNames = [];

        // Clear previous match data when starting fresh character selection
        this.registry.remove("matchData");
        this.registry.remove("aiOpponent");

        // Use centralized character data
        this.characters = characterList;

        // Create background with overlay
        const { width, height } = this.cameras.main;
        try {
            this.backgroundImage = this.add.image(
                width / 2,
                height / 2,
                "mainmenu-bg"
            );
            this.backgroundImage.setDisplaySize(width, height);

            // Add dark overlay for better text contrast
            const overlay = this.add.graphics();
            overlay.fillStyle(0x000000, 0.6);
            overlay.fillRect(0, 0, width, height);
        } catch (error) {
            logger.warn("Failed to load background image", { error });
            // Fallback background with gradient
            const graphics = this.add.graphics();
            graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e);
            graphics.fillRect(0, 0, width, height);
        }

        // Title without background container - just text
        this.titleText = this.add.text(width / 2, 80, "SELECT YOUR FIGHTER", {
            fontFamily: "Press Start 2P",
            fontSize: "32px",
            color: "#FBBF24",
            align: "center",
            stroke: "#000000",
            strokeThickness: 6,
            shadow: {
                offsetX: 4,
                offsetY: 4,
                color: "#000000",
                blur: 0,
                fill: true,
            },
        });
        this.titleText.setOrigin(0.5);

        // Add wallet status indicator
        this.createWalletStatusIndicator();

        // Create character grid (3x2 layout)
        this.createCharacterGrid();

        // Instructions without background containers - just text
        this.instructionText = this.add.text(
            width / 2,
            height - 122,
            "USE ARROW KEYS OR WASD TO NAVIGATE",
            {
                fontFamily: "Press Start 2P",
                fontSize: "12px",
                color: "#9CA3AF",
                align: "center",
                stroke: "#000000",
                strokeThickness: 1,
            }
        );
        this.instructionText.setOrigin(0.5);

        this.confirmText = this.add.text(
            width / 2,
            height - 77,
            "PRESS ENTER OR SPACE TO SELECT",
            {
                fontFamily: "Press Start 2P",
                fontSize: "12px",
                color: "#FBBF24",
                align: "center",
                stroke: "#000000",
                strokeThickness: 1,
            }
        );
        this.confirmText.setOrigin(0.5);

        // Setup input
        this.setupInputHandlers();

        // Update initial selection
        this.updateSelection();

        // Fade in
        this.cameras.main.fadeIn(300, 0, 0, 0);

        // Emit scene ready
        EventBus.emit("current-scene-ready", this);
    }

    private createCharacterGrid(): void {
        const { width, height } = this.cameras.main;

        // Clean grid layout - moved up and tighter spacing
        const portraitSize = 120;
        const gridSpacingX = 180;
        const gridSpacingY = 160; // Reduced from 180 since no descriptions
        const gridStartX = width / 2 - gridSpacingX; // Center 3-column grid
        const gridStartY = height / 2 - 80; // Moved up more

        this.characters.forEach((character, index) => {
            const row = Math.floor(index / 3);
            const col = index % 3;
            const x = gridStartX + col * gridSpacingX;
            const y = gridStartY + row * gridSpacingY;

            // Create clean portrait frame
            const frameGraphics = this.add.graphics();
            frameGraphics.lineStyle(2, 0x374151, 1); // Dark gray border
            frameGraphics.fillStyle(0x111827, 0.8); // Very dark background

            const frameSize = portraitSize + 8; // Small padding around portrait
            frameGraphics.fillRect(
                x - frameSize / 2,
                y - frameSize / 2,
                frameSize,
                frameSize
            );
            frameGraphics.strokeRect(
                x - frameSize / 2,
                y - frameSize / 2,
                frameSize,
                frameSize
            );

            // Create portrait image - properly centered
            const portrait = this.add.image(x, y, character.portrait);
            portrait.setDisplaySize(portraitSize, portraitSize);
            portrait.setOrigin(0.5, 0.5);
            this.characterPortraits.push(portrait);

            // Character name below portrait - minimal spacing
            const nameText = this.add.text(
                x,
                y + portraitSize / 2 + 15, // Reduced from 25 to 15
                character.name,
                {
                    fontFamily: "Press Start 2P",
                    fontSize: "12px", // Slightly smaller for cleaner look
                    color: "#E5E7EB",
                    align: "center",
                    stroke: "#000000",
                    strokeThickness: 2,
                }
            );
            nameText.setOrigin(0.5);
            this.characterNames.push(nameText);

            // No descriptions - removed completely
        });

        // Create selection border (bright golden highlight)
        this.selectionBorder = this.add.graphics();
        this.updateSelection(); // Initialize selection on first character
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
            case "ArrowLeft":
            case "KeyA":
                this.moveSelection(-1, 0);
                break;
            case "ArrowRight":
            case "KeyD":
                this.moveSelection(1, 0);
                break;
            case "ArrowUp":
            case "KeyW":
                this.moveSelection(0, -1);
                break;
            case "ArrowDown":
            case "KeyS":
                this.moveSelection(0, 1);
                break;
            case "Enter":
            case "Space":
                this.selectCharacter();
                break;
            case "Escape":
                this.goBack();
                break;
        }
    };

    private moveSelection(deltaX: number, deltaY: number): void {
        const cols = 3;
        const rows = 2;

        const currentRow = Math.floor(this.selectedCharacterIndex / cols);
        const currentCol = this.selectedCharacterIndex % cols;

        let newRow = currentRow + deltaY;
        let newCol = currentCol + deltaX;

        // Wrap around vertically
        if (newRow < 0) newRow = rows - 1;
        if (newRow >= rows) newRow = 0;

        // Wrap around horizontally
        if (newCol < 0) newCol = cols - 1;
        if (newCol >= cols) newCol = 0;

        const newIndex = newRow * cols + newCol;

        // Make sure we don't go beyond available characters
        if (newIndex < this.characters.length) {
            this.selectedCharacterIndex = newIndex;
            this.updateSelection();

            // Play selection sound (when audio is added)
            // this.sound.play('menu-move');
        }
    }

    private updateSelection(): void {
        const selectedCharacter = this.characters[this.selectedCharacterIndex];
        const selectedPortrait =
            this.characterPortraits[this.selectedCharacterIndex];
        
        // Use the selected character for UI updates
        if (selectedCharacter) {
            logger.gameEvent("character-selected", { 
                characterName: selectedCharacter.name,
                characterId: selectedCharacter.id 
            });
        }

        // Null check for safety
        if (!selectedPortrait || !selectedPortrait.active) {
            return;
        }

        // Clear and redraw selection border
        this.selectionBorder.clear();
        this.selectionBorder.lineStyle(4, 0xfbbf24, 1); // Bright golden border
        this.selectionBorder.setDepth(100); // Ensure it's on top

        const portraitSize = 120; // Match the new portrait size
        const frameSize = portraitSize + 8 + 8; // Frame padding + selection border padding
        this.selectionBorder.strokeRect(
            selectedPortrait.x - frameSize / 2,
            selectedPortrait.y - frameSize / 2,
            frameSize,
            frameSize
        );

        // Update character name highlighting with null checks
        this.characterNames.forEach((nameText, index) => {
            if (nameText && nameText.active) {
                if (index === this.selectedCharacterIndex) {
                    nameText.setColor("#FBBF24"); // Golden highlight for selected
                    nameText.setScale(1.1); // Slight scale increase
                } else {
                    nameText.setColor("#E5E7EB"); // Normal gray for unselected
                    nameText.setScale(1.0); // Normal scale
                }
            }
        });

        // Play selection sound (when audio is added)
        // this.sound.play('menu-move');
    }

    private selectCharacter(): void {
        const selectedCharacter = this.characters[this.selectedCharacterIndex];

        // Store selected character in registry for use in game scenes
        this.registry.set("selectedCharacter", selectedCharacter.id);

        // Clear any previous match data when starting a new match
        this.registry.remove("matchData");

        console.log("Starting new match - cleared previous match data");
        console.log("Selected character:", selectedCharacter.name);

        // Visual feedback
        this.cameras.main.flash(200, 255, 215, 0, false);

        // Navigate to appropriate scene based on game mode
        const gameMode = this.registry.get("gameMode") || "normal";
        
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            switch (gameMode) {
                case "survival":
                    this.scene.start("SurvivalScene");
                    break;
                case "timeattack":
                    this.scene.start("TimeAttackScene");
                    break;
                case "tournament":
                case "normal":
                default:
                    this.scene.start("FightScene");
                    break;
            }
        });
    }

    private goBack(): void {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            const gameMode = this.registry.get("gameMode");
            
            // Navigate back to appropriate scene
            if (gameMode === "timeattack") {
                this.scene.start("TimeAttackSelectScene");
            } else {
                this.scene.start("ArcadeModeSelectScene");
            }
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
        // Clean up
        this.input.keyboard!.removeAllListeners();
        this.tweens.killAll();

        // Clean up EventBus listeners
        EventBus.off("wallet-state-changed", this.updateWalletStatus, this);
        EventBus.off("wallet-connected", this.updateWalletStatus, this);
        EventBus.off("wallet-disconnected", this.updateWalletStatus, this);

        // Clear arrays to prevent stale references
        this.characterPortraits = [];
        this.characterNames = [];
    }
}

