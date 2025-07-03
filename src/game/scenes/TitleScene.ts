import Phaser from "phaser";

import EventBus from "@/lib/EventBus";

export class TitleScene extends Phaser.Scene {
    private startText!: Phaser.GameObjects.Text;
    private backgroundImage!: Phaser.GameObjects.Image;
    private pressAnyKeyTween!: Phaser.Tweens.Tween;

    constructor() {
        super({ key: "TitleScene" });
    }

    preload(): void {
        // Load title background
        this.load.image("title-bg", "assets/backgrounds/title-bg.png");
    }

    create(): void {
        const { width, height } = this.cameras.main;

        // Background
        this.backgroundImage = this.add.image(
            width / 2,
            height / 2,
            "title-bg"
        );
        this.backgroundImage.setDisplaySize(width, height);

        // "Press Any Button to Start" text
        this.startText = this.add.text(
            width / 2,
            height - 100, // Moved closer to bottom to ensure visibility
            "PRESS ANY BUTTON TO START",
            {
                fontFamily: "Press Start 2P",
                fontSize: "64px", // 2x bigger than original 32px
                color: "#FBBF24",
                align: "center",
                stroke: "#000000",
                strokeThickness: 4, // Increased stroke for better visibility with larger text
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: "#000000",
                    blur: 0,
                    fill: true,
                },
            }
        );
        this.startText.setOrigin(0.5);

        // Blinking animation for start text
        this.pressAnyKeyTween = this.tweens.add({
            targets: this.startText,
            alpha: { from: 1, to: 0.3 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: "Power2",
        });

        // Listen for any input to proceed
        this.setupInputListeners();

        // Emit scene ready event
        EventBus.emit("current-scene-ready", this);
    }

    private setupInputListeners(): void {
        // Clear any existing listeners first
        this.input.keyboard!.removeAllListeners();
        this.input.removeAllListeners();

        // Keyboard input
        this.input.keyboard!.on("keydown", this.handleStart, this);

        // Mouse/touch input
        this.input.on("pointerdown", this.handleStart, this);

        // Gamepad support (if available)
        if (this.input.gamepad) {
            this.input.gamepad.removeAllListeners();
            this.input.gamepad.on("down", this.handleStart, this);
        }
    }

    private handleStart = (): void => {
        // Stop all tweens
        this.pressAnyKeyTween.destroy();
        this.tweens.killAll();

        // Add a quick fade out effect
        this.cameras.main.fadeOut(300, 0, 0, 0);

        // Transition to main menu after fade
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("MainMenuScene");
        });
    };

    shutdown(): void {
        // Clean up event listeners
        this.input.keyboard!.removeAllListeners();
        this.input.removeAllListeners();

        if (this.input.gamepad) {
            this.input.gamepad.removeAllListeners();
        }

        // Stop all tweens
        this.tweens.killAll();
    }
}

