import Phaser from "phaser";
import EventBus from "@/lib/EventBus";
import { logger } from "@/lib/logger";
import { getAllTimeAttackCourses, TimeAttackCourse } from "@/config/arcadeModes";
import { Boot } from "./Boot";
import { TEXT_STYLES, UIPanel } from "@/game/ui/UIConstants";

export class TimeAttackSelectScene extends Phaser.Scene {
    private backgroundImage!: Phaser.GameObjects.Image;
    private courseOptions: TimeAttackCourse[] = [];
    private courseTexts: Phaser.GameObjects.Text[] = [];
    private descriptionTexts: Phaser.GameObjects.Text[] = [];
    private timeTexts: Phaser.GameObjects.Text[] = [];
    private selectedIndex: number = 0;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>;
    private selectionIndicator!: Phaser.GameObjects.Text;
    private titleText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: "TimeAttackSelectScene" });
    }

    preload(): void {
        // Use the same background as arcade mode
        this.load.image("timeattack-bg", "assets/backgrounds/mainmenu-bg.png");
    }

    create(): void {
        // Reset selection state
        this.selectedIndex = 0;
        this.courseTexts = [];
        this.descriptionTexts = [];
        this.timeTexts = [];

        const { width, height } = this.cameras.main;

        // Use standardized background system
        Boot.createStandardBackground(this, true, 0.6);

        // Title using standardized text styles
        this.titleText = this.add.text(width / 2, 70, "TIME ATTACK", TEXT_STYLES.TITLE);
        this.titleText.setOrigin(0.5);

        // Subtitle using standardized text styles  
        const subtitleText = this.add.text(width / 2, 120, "Select Your Course", TEXT_STYLES.SUBHEADER);
        subtitleText.setOrigin(0.5);

        // Setup course options and UI
        this.setupCourseOptions();
        this.createCourseItems();
        this.setupInputHandlers();

        // Fade in effect
        this.cameras.main.fadeIn(300, 0, 0, 0);

        // Emit scene ready event
        EventBus.emit("current-scene-ready", this);

        logger.gameEvent("time-attack-select-opened", {
            scene: "TimeAttackSelectScene"
        });
    }

    private setupCourseOptions(): void {
        this.courseOptions = getAllTimeAttackCourses();
    }

    private createCourseItems(): void {
        const { width, height } = this.cameras.main;
        const startY = 180;
        const spacing = 90;

        this.courseOptions.forEach((course, index) => {
            const y = startY + index * spacing;

            // Course name
            const courseText = this.add.text(width / 2, y, course.name, {
                fontFamily: "Press Start 2P",
                fontSize: "20px",
                color: course.enabled ? "#FFFFFF" : "#6B7280",
                align: "center",
            });
            courseText.setOrigin(0.5);
            this.courseTexts.push(courseText);

            // Course description
            const descText = this.add.text(width / 2, y + 28, course.description, {
                fontFamily: "Press Start 2P",
                fontSize: "16px",
                color: course.enabled ? "#D1D5DB" : "#4B5563",
                align: "center",
            });
            descText.setOrigin(0.5);
            this.descriptionTexts.push(descText);

            // Best time display
            const bestTime = this.getBestTimeDisplay(course.id);
            const timeText = this.add.text(width / 2, y + 50, bestTime, {
                fontFamily: "Press Start 2P",
                fontSize: "14px",
                color: course.enabled ? "#FBBF24" : "#4B5563",
                align: "center",
            });
            timeText.setOrigin(0.5);
            this.timeTexts.push(timeText);
        });

        // Selection indicator
        this.selectionIndicator = this.add.text(0, 0, "►", {
            fontFamily: "Press Start 2P",
            fontSize: "24px",
            color: "#FBBF24",
            align: "center",
        });
        this.selectionIndicator.setOrigin(0.5);

        // Update selection visual
        this.updateSelection();

        // Add selection indicator animation
        this.tweens.add({
            targets: this.selectionIndicator,
            x: "+=8",
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: "Power2",
        });

        // Add navigation instructions
        this.add.text(width / 2, height - 100, "↑↓ Navigate  •  ENTER Select  •  ESC Back", {
            fontFamily: "Press Start 2P",
            fontSize: "16px",
            color: "#9CA3AF",
            align: "center",
        }).setOrigin(0.5);

        this.add.text(width / 2, height - 70, "Complete courses to earn medals and set records!", {
            fontFamily: "Press Start 2P",
            fontSize: "14px",
            color: "#6B7280",
            align: "center",
        }).setOrigin(0.5);
    }

    private getBestTimeDisplay(courseId: string): string {
        const bestTimes = JSON.parse(localStorage.getItem("timeAttackBestTimes") || "{}");
        const bestTime = bestTimes[courseId];
        
        if (bestTime) {
            const minutes = Math.floor(bestTime / 60);
            const seconds = (bestTime % 60).toFixed(2);
            return `Best: ${minutes}:${seconds.padStart(5, '0')}`;
        }
        
        return "Best: --:--.--";
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
                this.selectCurrentCourse();
                break;
            case "Escape":
                this.goBackToArcadeSelect();
                break;
        }
    };

    private moveSelection(direction: number): void {
        let newIndex = this.selectedIndex;
        do {
            newIndex = (newIndex + direction + this.courseOptions.length) % this.courseOptions.length;
        } while (
            !this.courseOptions[newIndex].enabled &&
            newIndex !== this.selectedIndex
        );

        if (newIndex !== this.selectedIndex) {
            this.selectedIndex = newIndex;
            this.updateSelection();
        }
    }

    private updateSelection(): void {
        // Reset all course items to normal color
        this.courseTexts.forEach((text, index) => {
            const course = this.courseOptions[index];
            if (index === this.selectedIndex && course.enabled) {
                text.setColor("#FBBF24"); // Highlight selected
                text.setScale(1.05);
                this.descriptionTexts[index].setColor("#FFFFFF");
                this.timeTexts[index].setColor("#FBBF24");
            } else {
                text.setColor(course.enabled ? "#FFFFFF" : "#6B7280");
                text.setScale(1.0);
                this.descriptionTexts[index].setColor(course.enabled ? "#D1D5DB" : "#4B5563");
                this.timeTexts[index].setColor(course.enabled ? "#FBBF24" : "#4B5563");
            }
        });

        // Position selection indicator
        const selectedText = this.courseTexts[this.selectedIndex];
        this.selectionIndicator.setPosition(
            selectedText.x - selectedText.displayWidth / 2 - 50,
            selectedText.y
        );
    }

    private selectCurrentCourse(): void {
        const selectedCourse = this.courseOptions[this.selectedIndex];

        if (selectedCourse && selectedCourse.enabled) {
            logger.gameEvent("time-attack-course-selected", {
                courseId: selectedCourse.id,
                courseName: selectedCourse.name,
                difficulty: selectedCourse.difficulty
            });

            // Store selected course data
            this.registry.set("timeAttackData", {
                ...this.registry.get("timeAttackData"),
                selectedCourse: selectedCourse
            });

            // Navigate to character selection
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.cameras.main.once("camerafadeoutcomplete", () => {
                this.scene.start("CharacterSelectScene");
            });
        }
    }

    private goBackToArcadeSelect(): void {
        logger.gameEvent("time-attack-select-back", {
            selectedIndex: this.selectedIndex
        });

        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("ArcadeModeSelectScene");
        });
    }

    shutdown(): void {
        // Clean up event listeners
        this.input.keyboard!.removeAllListeners();
        this.tweens.killAll();

        // Clear arrays to prevent stale references
        this.courseTexts = [];
        this.descriptionTexts = [];
        this.timeTexts = [];
        this.courseOptions = [];
    }
}