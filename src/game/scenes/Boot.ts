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

        // Load sound effects - comprehensive format and path testing
        console.log('🔊 Loading sound effects...');
        console.log('🔊 Testing multiple formats and paths for punch sound...');
        
        // Test if we can access the MP3 file via fetch first
        fetch('assets/sound/punch.mp3')
            .then(response => {
                console.log('🔊 FETCH TEST: punch.mp3 accessibility:', response.ok ? '✅ Accessible' : '❌ Not accessible');
                console.log('🔊 FETCH DETAILS:', { status: response.status, url: response.url, size: response.headers.get('content-length') });
                
                // Also test if it's a valid audio file
                return response.blob();
            })
            .then(blob => {
                console.log('🔊 FILE TEST:', { 
                    size: blob.size, 
                    type: blob.type,
                    validAudio: blob.type.includes('audio')
                });
            })
            .catch(error => {
                console.error('❌ FETCH TEST FAILED:', error);
                console.log('💡 SUGGESTION: Try putting punch.mp3 directly in public/ folder instead of public/assets/sound/');
            });
        
        // Load the MP3 sound file with explicit configuration
        try {
            console.log('🔊 Loading punch.mp3...');
            
            // Try multiple approaches
            this.load.audio({
                key: 'punch',
                url: 'assets/sound/punch.mp3'
            });
            
            console.log('🔊 Sound loading initiated for: punch.mp3');
        } catch (loadError) {
            console.error('❌ Sound loading failed:', loadError);
            
            // Fallback: try direct URL
            try {
                console.log('🔊 Trying alternative loading method...');
                this.load.audio('punch', ['assets/sound/punch.mp3']);
            } catch (fallbackError) {
                console.error('❌ Fallback loading also failed:', fallbackError);
            }
        }
        
        // Enhanced error handling for sound files
        this.load.on('filecomplete-audio-punch', (key: string, type: string, data: any) => {
            console.log('✅ SUCCESS: Punch sound loaded successfully', { key, type });
        });
        
        this.load.on('filecomplete-audio-special-attack', (key: string, type: string, data: any) => {
            console.log('✅ SUCCESS: Special attack sound loaded successfully', { key, type });
        });
        
        this.load.on('filecomplete', (key: string, type: string, data: any) => {
            if (type === 'audio') {
                console.log(`🔊 AUDIO LOADED: ${key} (${type})`);
            }
        });
        
        this.load.on('loaderror', (file: any) => {
            console.error(`❌ LOAD ERROR: ${file.type} file failed:`, {
                key: file.key,
                src: file.src,
                type: file.type,
                url: file.url,
                xhr: file.xhr
            });
            if (file.type === 'audio') {
                console.error(`❌ AUDIO LOAD FAILED: ${file.key}`);
                console.error('📄 File details:', {
                    attemptedSrc: file.src,
                    fullUrl: file.url,
                    httpStatus: file.xhr?.status,
                    httpStatusText: file.xhr?.statusText
                });
                console.warn('Will use procedural fallback sounds during gameplay');
            }
        });

        // Also listen for any successful loads
        this.load.on('filecomplete', (key: string, type: string, data: any) => {
            if (type === 'audio') {
                console.log(`✅ AUDIO LOADED: ${key} (${type}) successfully loaded`);
            }
        });

        // Set loading progress feedback
        this.load.on("progress", (value: number) => {
            console.log(`Boot Scene Loading: ${Math.round(value * 100)}%`);
        });
    }

    create() {
        console.log("BootScene: All assets loaded, starting TitleScene");
        
        // Check sound loading status with detailed debugging
        console.log('🔊 SOUND VERIFICATION:');
        const punchSound = this.sound.get('punch');
        const specialSound = this.sound.get('special-attack');
        
        console.log('📋 Sound Manager State:', {
            punchLoaded: !!punchSound,
            specialLoaded: !!specialSound,
            soundManagerType: this.sound.constructor.name,
            soundManager: this.sound
        });
        
        // Just check if the sound is loaded (don't play it yet due to browser policies)
        if (punchSound) {
            console.log('✅ PUNCH SOUND: Successfully loaded and cached');
        } else {
            console.error('❌ PUNCH SOUND: Failed to load - will use procedural fallbacks');
            console.log('🔧 DEBUGGING: Check if assets/sound/punch.mp3 exists and is accessible');
            console.log('🔧 DEBUGGING: Also check browser console for FETCH TEST and LOAD ERROR messages');
        }
        
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

