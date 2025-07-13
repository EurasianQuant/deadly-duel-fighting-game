// src/data/characters.ts

export interface Character {
    id: string; // e.g., 'fighter_1'
    name: string; // e.g., "Rocco"
    spritesheetKey: string; // The key we use in Phaser's preloader
    portrait: string; // Path to the portrait image (we'll generate these from spritesheets)
    description: string; // Short character description
    stats: CharacterStats; // Character-specific combat stats
}

export interface CharacterStats {
    health: number;
    speed: number;
    jumpVelocity: number;
    heavyDamage: number;
    specialDamage: number;
    attackSpeed: number; // Multiplier for attack frame duration (1.0 = normal)
}

export const characterList: Character[] = [
    {
        id: "rocco",
        name: "Rocco",
        spritesheetKey: "fighter1",
        portrait: "player1-portrait",
        description: "The Veteran Brawler",
        stats: {
            health: 220, // Tanky brawler - high health
            speed: 360, // Slower movement (increased 20%: 300 * 1.2)
            jumpVelocity: -900, // Lower jump (increased 20%: -750 * 1.2)
            heavyDamage: 30, // Powerful heavy hits
            specialDamage: 22, // Solid special
            attackSpeed: 0.8, // Slower attacks (20% longer frames)
        },
    },
    {
        id: "kai",
        name: "Kai",
        spritesheetKey: "fighter2",
        portrait: "player2-portrait",
        description: "The Swift Striker",
        stats: {
            health: 180, // Glass cannon - low health
            speed: 480, // Very fast movement (increased 20%: 400 * 1.2)
            jumpVelocity: -1020, // High jump (increased 20%: -850 * 1.2)
            heavyDamage: 20, // Moderate heavies
            specialDamage: 25, // Strong special attacks
            attackSpeed: 1.3, // Faster attacks (30% shorter frames)
        },
    },
    {
        id: "kestrel",
        name: "Kestrel",
        spritesheetKey: "fighter3",
        portrait: "player3-portrait",
        description: "The Lethal Blade",
        stats: {
            health: 190, // Moderate health
            speed: 432, // Good mobility (increased 20%: 360 * 1.2)
            jumpVelocity: -960, // Standard jump (increased 20%: -800 * 1.2)
            heavyDamage: 28, // Strong heavies
            specialDamage: 18, // Lower special damage
            attackSpeed: 1.1, // Slightly faster attacks
        },
    },
    {
        id: "zadie",
        name: "Zadie",
        spritesheetKey: "fighter4",
        portrait: "player4-portrait",
        description: "The Acrobatic Tempest",
        stats: {
            health: 170, // Low health, high mobility
            speed: 504, // Fastest character (increased 20%: 420 * 1.2)
            jumpVelocity: -1080, // Highest jump (increased 20%: -900 * 1.2)
            heavyDamage: 22, // Moderate heavies
            specialDamage: 28, // Strong specials
            attackSpeed: 1.2, // Fast attacks
        },
    },
    {
        id: "kael",
        name: "Kael",
        spritesheetKey: "fighter5",
        portrait: "player5-portrait",
        description: "The Wise Master",
        stats: {
            health: 210, // High health
            speed: 384, // Moderate speed (increased 20%: 320 * 1.2)
            jumpVelocity: -936, // Lower jump (increased 20%: -780 * 1.2)
            heavyDamage: 26, // Good heavies
            specialDamage: 24, // Strong specials
            attackSpeed: 0.9, // Slightly slower attacks
        },
    },
    {
        id: "jin",
        name: "Jin",
        spritesheetKey: "fighter6",
        portrait: "player6-portrait",
        description: "The Silent Blade",
        stats: {
            health: 200, // Balanced health
            speed: 420, // Standard speed (increased 20%: 350 * 1.2)
            jumpVelocity: -960, // Standard jump (increased 20%: -800 * 1.2)
            heavyDamage: 25, // Standard heavies
            specialDamage: 20, // Standard specials
            attackSpeed: 1.0, // Standard attack speed
        },
    },
];

// Helper function to get character by ID
export const getCharacterById = (id: string): Character | undefined => {
    return characterList.find((char) => char.id === id);
};

