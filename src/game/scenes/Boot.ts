import { Scene } from "phaser";

export class Boot extends Scene {
    constructor() {
        super({ key: "Boot" });
    }

    preload() {
        //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
        //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

        // Add error handling for asset loading
        this.load.on('loaderror', (file: any) => {
            console.error(`Failed to load asset: ${file.src}`);
            // Continue loading other assets instead of crashing
        });
        
        // Load character sprites as spritesheets (32 frames in 8x4 grid)
        this.load.spritesheet(
            "fighter1",
            "assets/sprites/characters/player1/player1.png",
            {
                frameWidth: 100,
                frameHeight: 100,
            }
        );
        this.load.spritesheet(
            "fighter2",
            "assets/sprites/characters/player2/player2.png",
            {
                frameWidth: 100,
                frameHeight: 100,
            }
        );
        this.load.spritesheet(
            "fighter3",
            "assets/sprites/characters/player3/player3.png",
            {
                frameWidth: 100,
                frameHeight: 100,
            }
        );
        this.load.spritesheet(
            "fighter4",
            "assets/sprites/characters/player4/player4.png",
            {
                frameWidth: 100,
                frameHeight: 100,
            }
        );
        this.load.spritesheet(
            "fighter5",
            "assets/sprites/characters/player5/player5.png",
            {
                frameWidth: 100,
                frameHeight: 100,
            }
        );
        this.load.spritesheet(
            "fighter6",
            "assets/sprites/characters/player6/player6.png",
            {
                frameWidth: 100,
                frameHeight: 100,
            }
        );

        // Load character portraits for selection screen
        this.load.image(
            "player1-portrait",
            "assets/portraits/player1portrait.png"
        );
        this.load.image(
            "player2-portrait",
            "assets/portraits/player2portrait.png"
        );
        this.load.image(
            "player3-portrait",
            "assets/portraits/player3portrait.png"
        );
        this.load.image(
            "player4-portrait",
            "assets/portraits/player4portrait.png"
        );
        this.load.image(
            "player5-portrait",
            "assets/portraits/player5portrait.png"
        );
        this.load.image(
            "player6-portrait",
            "assets/portraits/player6portrait.png"
        );

        // Create ground texture (keeping the generated one for consistency)
        this.add
            .graphics()
            .fillStyle(0x8b4513)
            .fillRect(0, 0, 1280, 20)
            .generateTexture("ground", 1280, 20);

        // Load additional assets with error handling
        // Create fallback textures in case assets are missing
        this.add.graphics()
            .fillStyle(0x4a5568) // Gray background
            .fillRect(0, 0, 1280, 720)
            .generateTexture("fight-bg-fallback", 1280, 720);
            
        this.add.graphics()
            .fillStyle(0x2d3748) // Darker gray background
            .fillRect(0, 0, 1280, 720)
            .generateTexture("mainmenu-bg-fallback", 1280, 720);
        
        // Unified background system - use single atmospheric background for all menu screens
        try {
            // Load all 3 fight backgrounds for random selection
            this.load.image("fight-bg", "assets/backgrounds/fight-bg.png");
            this.load.image("fight-bg2", "assets/backgrounds/fight-bg2.png");
            this.load.image("fight-bg3", "assets/backgrounds/fight-bg3.png");
            // Use the same atmospheric mainmenu background for ALL menu screens to maintain consistency
            this.load.image("mainmenu-bg", "assets/backgrounds/mainmenu-bg.png");
            this.load.image("atmospheric-bg", "assets/backgrounds/mainmenu-bg.png"); // Unified background alias
        } catch (error) {
            console.warn('Background assets not found, using fallbacks');
        }

        // Set loading progress feedback
        this.load.on("progress", (value: number) => {
            console.log(`Boot Scene Loading: ${Math.round(value * 100)}%`);
        });
    }

    create() {
        console.log("BootScene: All assets loaded, starting TitleScene");
        
        // Ensure textures are properly initialized before starting next scene
        this.time.delayedCall(100, () => {
            // Check if critical textures loaded, use fallbacks if needed
            if (!this.textures.exists('fight-bg')) {
                console.warn('fight-bg not loaded, using fallback');
                this.textures.addBase64('fight-bg', this.textures.get('fight-bg-fallback').getSourceImage());
            }
            if (!this.textures.exists('mainmenu-bg')) {
                console.warn('mainmenu-bg not loaded, using fallback');
                this.textures.addBase64('mainmenu-bg', this.textures.get('mainmenu-bg-fallback').getSourceImage());
            }
            if (!this.textures.exists('atmospheric-bg')) {
                console.warn('atmospheric-bg not loaded, using mainmenu-bg fallback');
                // Use mainmenu-bg as fallback for atmospheric-bg
                this.textures.addBase64('atmospheric-bg', this.textures.get('mainmenu-bg-fallback').getSourceImage());
            }
            
            this.scene.start("TitleScene");
        });
    }

    // Static utility for standardized background creation across all menu scenes
    static createStandardBackground(scene: Phaser.Scene, withOverlay: boolean = true, overlayOpacity: number = 0.7): Phaser.GameObjects.Image {
        const { width, height } = scene.cameras.main;
        
        // Try atmospheric-bg first, fallback to mainmenu-bg if needed
        let backgroundKey = "atmospheric-bg";
        if (!scene.textures.exists("atmospheric-bg")) {
            backgroundKey = "mainmenu-bg";
            console.warn("atmospheric-bg not found, using mainmenu-bg");
        }
        
        const bg = scene.add.image(width / 2, height / 2, backgroundKey);
        bg.setDisplaySize(width, height);
        
        // Add dark overlay for text readability if requested
        if (withOverlay) {
            scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, overlayOpacity);
        }
        
        return bg;
    }

    // Static utility for random fight background selection
    static createRandomFightBackground(scene: Phaser.Scene): Phaser.GameObjects.Image {
        const { width, height } = scene.cameras.main;
        
        // Array of available fight backgrounds
        const fightBackgrounds = ["fight-bg", "fight-bg2", "fight-bg3"];
        
        // Filter to only include backgrounds that actually loaded
        const availableBackgrounds = fightBackgrounds.filter(bg => scene.textures.exists(bg));
        
        // Select random background
        let selectedBackground: string;
        if (availableBackgrounds.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableBackgrounds.length);
            selectedBackground = availableBackgrounds[randomIndex];
            console.log(`🎨 Selected fight background: ${selectedBackground}`);
        } else {
            selectedBackground = "fight-bg"; // Fallback to original
            console.warn("No fight backgrounds found, using fallback");
        }
        
        const bg = scene.add.image(width / 2, height / 2, selectedBackground);
        bg.setDisplaySize(width, height);
        
        return bg;
    }
}

