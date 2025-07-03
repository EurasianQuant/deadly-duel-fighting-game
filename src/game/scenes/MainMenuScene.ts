import Phaser from "phaser";

import EventBus from "@/lib/EventBus";

interface MenuOption {
    text: string;
    action: () => void;
    enabled: boolean;
}

export class MainMenuScene extends Phaser.Scene {
    private backgroundImage!: Phaser.GameObjects.Image;
    private menuOptions: MenuOption[] = [];
    private menuTexts: Phaser.GameObjects.Text[] = [];
    private selectedIndex: number = 0;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>;
    private selectionIndicator!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: "MainMenuScene" });
    }

    preload(): void {
        // Load main menu background
        this.load.image("mainmenu-bg", "assets/backgrounds/mainmenu-bg.png");
    }

    create(): void {
        // Reset selection state
        this.selectedIndex = 0;
        this.menuTexts = [];

        const { width, height } = this.cameras.main;

        // Background
        this.backgroundImage = this.add.image(
            width / 2,
            height / 2,
            "mainmenu-bg"
        );
        this.backgroundImage.setDisplaySize(width, height);

        // Logo removed as requested

        // Menu options
        this.setupMenuOptions();
        this.createMenuItems();
        this.setupInputHandlers();

        // Fade in effect
        this.cameras.main.fadeIn(300, 0, 0, 0);

        // Emit scene ready event
        EventBus.emit("current-scene-ready", this);
    }

    private setupMenuOptions(): void {
        this.menuOptions = [
            {
                text: "ARCADE MODE",
                action: () => this.startArcadeMode(),
                enabled: true,
            },
            {
                text: "ONLINE PVP",
                action: () =>
                    this.showComingSoonMessage("ONLINE PVP COMING SOON!"),
                enabled: true,
            },
            {
                text: "LEADERBOARD",
                action: () => this.showLeaderboard(),
                enabled: true, // Enabled for Phase 3
            },
        ];
    }

    private createMenuItems(): void {
        const { width, height } = this.cameras.main;
        const startY = height / 2 - 60;
        const spacing = 60; // Reduced spacing to bring items closer together

        this.menuOptions.forEach((option, index) => {
            const y = startY + index * spacing;

            const menuText = this.add.text(width / 2, y, option.text, {
                fontFamily: "Press Start 2P",
                fontSize: "72px", // Much larger to compensate for scaling
                color: option.enabled ? "#FFFFFF" : "#6B7280",
                align: "center",
                stroke: "#000000",
                strokeThickness: 4,
                shadow: {
                    offsetX: 3,
                    offsetY: 3,
                    color: "#000000",
                    blur: 0,
                    fill: true,
                },
            });
            menuText.setOrigin(0.5);

            this.menuTexts.push(menuText);
        });

        // Selection indicator (arrow)
        this.selectionIndicator = this.add.text(0, 0, ">", {
            fontFamily: "Press Start 2P",
            fontSize: "72px", // Match menu text size
            color: "#FBBF24",
            align: "center",
            stroke: "#000000",
            strokeThickness: 4,
            shadow: {
                offsetX: 3,
                offsetY: 3,
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
    }

    private setupInputHandlers(): void {
        // Clear any existing listeners first
        this.input.keyboard!.removeAllListeners();

        // Cursor keys
        this.cursors = this.input.keyboard!.createCursorKeys();

        // WASD keys
        this.wasdKeys = this.input.keyboard!.addKeys(
            "W,S,A,D,ENTER,SPACE"
        ) as Record<string, Phaser.Input.Keyboard.Key>;

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
                // Return to title screen
                this.scene.start("TitleScene");
                break;
        }
    };

    private moveSelection(direction: number): void {
        // Find next enabled option
        let newIndex = this.selectedIndex;
        do {
            newIndex =
                (newIndex + direction + this.menuOptions.length) %
                this.menuOptions.length;
        } while (
            !this.menuOptions[newIndex].enabled &&
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
        // Reset all menu items to normal color
        this.menuTexts.forEach((text, index) => {
            const option = this.menuOptions[index];
            if (index === this.selectedIndex && option.enabled) {
                text.setColor("#FBBF24"); // Highlight selected
                text.setScale(1.1); // Slightly larger
            } else {
                text.setColor(option.enabled ? "#FFFFFF" : "#6B7280");
                text.setScale(1.0);
            }
        });

        // Position selection indicator
        const selectedText = this.menuTexts[this.selectedIndex];
        this.selectionIndicator.setPosition(
            selectedText.x - selectedText.displayWidth / 2 - 50, // Adjusted for better spacing
            selectedText.y
        );
    }

    private selectCurrentOption(): void {
        const selectedOption = this.menuOptions[this.selectedIndex];

        if (selectedOption && selectedOption.enabled) {
            // Play confirmation sound (when audio is added)
            // this.sound.play('menu-select');

            selectedOption.action();
        }
    }

    private startArcadeMode(): void {
        console.log("Starting Arcade Mode...");
        // Navigate to arcade mode selection first
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("ArcadeModeSelectScene");
        });
    }

    private startOnlineMode(): void {
        console.log("Starting Online PVP...");
        // Show the React-based online menu
        EventBus.emit("show-online-menu", {});
    }

    private showLeaderboard(): void {
        console.log("Showing Leaderboard...");
        // Navigate to Phaser-based leaderboard scene
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("LeaderboardScene");
        });
    }


    private showComingSoonMessage(message: string): void {
        const { width, height } = this.cameras.main;

        const messageText = this.add.text(width / 2, height - 100, message, {
            fontFamily: "Press Start 2P",
            fontSize: "36px", // Larger for better visibility
            color: "#EF4444",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3,
        });
        messageText.setOrigin(0.5);

        // Fade out after 2 seconds
        this.tweens.add({
            targets: messageText,
            alpha: 0,
            duration: 2000,
            ease: "Power2",
            onComplete: () => messageText.destroy(),
        });
    }

    shutdown(): void {
        // Clean up event listeners
        this.input.keyboard!.removeAllListeners();
        this.tweens.killAll();

        // Clear arrays to prevent stale references
        this.menuTexts = [];
        this.menuOptions = [];
    }
}

