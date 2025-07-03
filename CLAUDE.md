# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Deadly Duel** is a high-performance, competitive pixel-art fighting game designed for the open web. Built with a "frictionless entry" philosophy, players can jump into intense 60-second matches directly from a URL with no installation or mandatory sign-up.

**Phase 1 Status**: ✅ **COMPLETE + SIGNIFICANTLY EXCEEDED** - Delivered 6 characters instead of 1, tournament mode with progressive AI difficulty, and professional-grade combat system.

**Phase 3 Status**: ✅ **COMPLETE + SIGNIFICANTLY EXCEEDED** - Delivered comprehensive leaderboard system, survival mode, time attack mode with 4 courses, player profile system, and clean text-based UI scenes optimized for readability.

The project uses **Phaser 3.80** for the game engine with **React 18.2** providing the UI overlay, connected via an EventBus architecture.

## Development Commands

```bash
# Development (with logging)
bun run dev

# Development (without logging)  
bun run dev-nolog

# Build for production
bun run build

# Build without logging
bun run build-nolog

# Linting
bun run lint

# Type checking
bun run type-check
```

## Recent Major Improvements (Latest Update)

### ✅ **Responsive Design System**
- **Full-Screen Support**: Changed scale mode from Phaser.Scale.FIT to Phaser.Scale.RESIZE for complete screen coverage
- **Dynamic Positioning**: All fighting scenes now use camera dimensions instead of fixed canvas sizes
- **Adaptive Physics**: Ground collision and fighter positioning automatically adjust to screen size
- **UI Optimization**: Health bars and HUD elements scale properly across all screen sizes

### ✅ **Enhanced Gameplay Performance**
- **20% Speed Increase**: All character speeds boosted from 350→420 base speed for faster-paced combat
- **20% Size Increase**: Fighter scale increased from 3.0→3.6 for better visibility and impact
- **Improved Jump Physics**: Jump velocities increased 20% (-800→-960) for more responsive movement
- **Balanced Scaling**: All 6 characters maintain relative speed differences while being universally faster

### ✅ **Random Background System**
- **Three Fight Backgrounds**: fight-bg.png, fight-bg2.png, fight-bg3.png randomly selected for each match
- **Dynamic Selection**: Boot.createRandomFightBackground() utility ensures variety across all fighting modes
- **Consistent Implementation**: Applied to FightScene, SurvivalScene, and TimeAttackScene for unified experience
- **Fallback System**: Graceful handling of missing background assets

### ✅ **UI/UX Polish Improvements**
- **Clean Pause Interface**: Removed arrow indicators from pause overlay for cleaner presentation
- **Optimized Health Bars**: Expanded from max-w-md to max-w-lg for better screen utilization
- **Responsive Text Scaling**: Menu text increased to 72px to compensate for RESIZE scale mode
- **Combat System Fixes**: Added missing collision detection calls to ensure reliable hit registration

## Architecture Overview

### Core Technologies
- **Game Engine**: Phaser 3.80 for all gameplay, physics, and rendering
- **UI Framework**: React 18.2 for menus, HUD, and overlays  
- **Build Tool**: Vite with custom dev/prod configurations
- **Language**: TypeScript with strict type checking disabled
- **State Management**: Zustand for game state
- **Styling**: Tailwind CSS

### Key Architectural Patterns

**Hybrid Phaser + React Architecture**: The game uses a strict separation where Phaser handles all game logic and React handles all UI. Communication occurs exclusively through the EventBus pattern.

**Responsive Design Architecture**: Dynamic camera dimension usage ensures the game adapts to any screen size, with physics and positioning calculated at runtime rather than using fixed coordinates.

**Character Stats System**: All 6 fighters use a unified stats interface that drives both AI behavior and combat balance. Each character has unique health (160-250 HP), speed (420-540 after 20% boost), jump velocity, and damage values that create distinct playstyles.

**Enhanced AI Personality System**: Character-specific AI behaviors with tournament difficulty scaling (1.0x → 3.4x aggression) create unique fighting personalities - from Rocco's aggressive tank rushes to Nyx's evasive glass cannon tactics.

**Multi-Mode Game Architecture**: 5 distinct game modes including Normal matches, Tournament mode, Survival mode, Time Attack mode, and comprehensive leaderboard system with persistent player progression.

**Entity-Component System**: The Fighter class serves as the main entity with character stats as components, enabling easy character swapping and AI personality mapping.

**32-Frame Animation Constraint**: Each character uses exactly 32 frames in an 8×4 grid layout, with creative reuse through variable playback speeds and visual effects.

**Dynamic Asset Management**: Random background selection system provides visual variety while maintaining consistent performance across all fighting scenarios.

## Project Structure

```
src/
├── game/                    # Phaser game engine code
│   ├── entities/           # Fighter class and game objects
│   │   ├── Fighter.ts      # Main fighter entity with stats integration
│   │   └── EnhancedFighter.ts # Extended fighter capabilities
│   ├── scenes/             # Game scenes
│   │   ├── FightScene.ts   # Main combat scene with enhanced AI system
│   │   ├── CharacterSelectScene.ts # Character selection
│   │   ├── ArcadeModeSelectScene.ts # Game mode selection (Normal/Tournament)
│   │   ├── SurvivalScene.ts # Endless survival mode with progressive difficulty
│   │   ├── TimeAttackScene.ts # Time attack mode with course progression
│   │   ├── TimeAttackSelectScene.ts # Time attack course selection
│   │   ├── LeaderboardScene.ts # Comprehensive leaderboard display
│   │   ├── PlayerProfileScene.ts # Player statistics and profile management
│   │   └── MainMenuScene.ts # Menu navigation
│   ├── systems/            # Input management and game systems
│   │   └── input/InputManager.ts # Input handling
│   └── debug/              # Development tools and visualizers
│       └── FrameDataVisualizer.ts # Debug visualization (toggleable)
├── components/             # React UI components
│   ├── game/               # Game-specific UI
│   │   ├── GameHUD.tsx     # In-game overlay with round indicators
│   │   └── HealthBar.tsx   # Directional health display
│   └── menus/              # Menu screens
│       ├── MainMenu.tsx    # Main navigation
│       ├── CharacterSelect.tsx # Character picker
│       └── ArcadeModeSelect.tsx # Game mode selection UI
├── data/                   # Game data and character definitions
│   └── characters.ts       # All 6 character definitions with stats
├── services/               # Game services and data management
│   ├── leaderboardService.ts # Comprehensive leaderboard and player statistics
│   └── testLeaderboard.ts  # Leaderboard service testing utilities
├── state/stores/           # Zustand state management
│   └── gameStore.ts        # Enhanced game state with tournament support
├── config/                 # Game configuration constants
│   └── arcadeModes.ts      # Time attack courses and survival mode config
└── hooks/                  # React hooks for game integration
    └── useGameEvents.ts    # EventBus integration hook
```

## Key Configuration Files

### TypeScript Configuration
- Path aliases configured for `@/*` imports
- Phaser types included with `useDefineForClassFields: false`
- Experimental decorators enabled for future features

### Game Configuration
- 60 FPS target with 1280×720 canvas
- Gravity set to 2000 for fighting game physics
- Best-of-3 match structure (first to 2 round wins)
- 59-second round timer for fast-paced tournament play
- Tournament mode: 5 consecutive matches with progressive difficulty scaling
- Enhanced match flow with proper round indicators and score tracking

## Character System

The game features 6 unique fighters with distinct stats and AI personalities:

- **Rocco (Veteran Brawler)**: Tank with 250 HP, 360 speed (20% boost), aggressive close combat AI
- **Kai (Swift Striker)**: Speed demon with 504 speed (20% boost), 180 HP, hit-and-run tactics  
- **Kestrel (Lethal Blade)**: High damage dealer with 200 HP, calculated strike AI (2.5% aggression)
- **Zadie (Acrobatic Tempest)**: Mobile fighter with -1140 jump velocity (20% boost), unpredictable aerial AI
- **Kael (Mystic Guardian)**: Defensive specialist with 220 HP, range control and special attack focus
- **Nyx (Shadow Assassin)**: Glass cannon with 160 HP, 540 speed (20% boost), becomes evasive when damaged

### AI Personality System
Each character has unique AI behavior patterns:
- **Aggression Levels**: From Kestrel's cautious 2.5% to Nyx's aggressive 4.5%
- **Tactical Behaviors**: Hit-and-run, defensive positioning, aerial mobility, range control
- **Tournament Scaling**: Progressive difficulty enhancement (1.0x → 3.4x aggression scaling)
- **Adaptive Logic**: Nyx becomes evasive when health drops, Zadie uses random jumps

AI behavior is mapped to character stats, creating distinct fighting personalities without complex behavioral trees.

## EventBus Communication

All Phaser-React communication uses the EventBus pattern:

```typescript
// Phaser to React
EventBus.emit('health-update', { player1: {...}, player2: {...} });
EventBus.emit('round-timer', { timeLeft: 45 });
EventBus.emit('round-update', { player1Score: 1, player2Score: 0 });
EventBus.emit('tournament-progress', { currentMatch: 3, totalMatches: 5 });

// React to Phaser  
EventBus.emit('start-game', { selectedCharacter, gameMode: 'normal' });
EventBus.emit('start-tournament', selectedCharacter);
EventBus.emit('navigate-to-arcade-mode-select');
```

## Development Notes

### Animation System
- Uses 32-frame constraint creatively with variable playback speeds
- Idle: frames 0-3, Run: frames 4-11, Attacks: frames 16-23
- Debug visualization available (disabled by default)

### Physics & Combat
- AABB collision detection with 50px hurtbox width
- Hit prevention system ensures one hit per attack with unique identifiers
- Damage values: Light (varies by character), Heavy (stronger), Special (unique per character)
- Attack ranges: Light (40px), Heavy (60px), Special (80px)
- Dual verification: rectangle intersection + distance checking for precise combat

### Performance Considerations
- Stable 60 FPS target maintained throughout
- Asset loading optimized for sub-5-second initial load
- Physics calculations optimized for competitive play

### Testing & Quality
- Always run `bun run lint` and `bun run type-check` before committing
- Character balance verified through AI vs AI testing across all 6 characters
- Tournament mode tested with complete 5-match progression
- Event listeners properly cleaned up in scene transitions to prevent UI freezing
- Visual debug elements (purple boxes, green lines) disabled by default for clean presentation

## Game Modes

### Normal Match Mode
- Classic one-on-one battles with random AI opponents
- All 6 characters available for both player and AI selection
- Best-of-3 match structure with round indicators
- AI uses character-specific personality behaviors

### Tournament Mode
- 5 consecutive matches with progressive difficulty scaling
- Strategic opponent selection (ladder structure from weakest to strongest)
- Enhanced AI behaviors with difficulty scaling (1.0x → 3.4x aggression)
- "Tournament Champion" achievement for perfect 5-0 runs
- Immediate elimination on any loss

### Survival Mode
- Endless progression with escalating challenges
- Round 1-5: Single opponents with standard AI
- Round 6+: Dual opponents simultaneously
- Round 10+: Enhanced enemy stats (1.5x health, 1.2x speed)
- Round 15+: Maximum difficulty (2.0x health, 1.4x speed)
- Scoring system with time bonuses, health bonuses, and streak multipliers
- Perfect round detection and scoring bonuses
- Comprehensive leaderboard integration with statistics tracking

### Time Attack Mode
- 4 structured courses with progressive difficulty:
  - **Beginner Course**: 3 opponents, 3-minute target
  - **Intermediate Course**: 3 opponents, enhanced AI
  - **Advanced Course**: 5 opponents, hard AI
  - **Expert Course**: 5 opponents, maximum difficulty
- Medal system: Bronze (completion), Silver (under target), Gold (excellent time)
- Performance bonuses: Perfect victories (-5s), health preservation (-3s), quick defeats (-2s)
- Course-specific leaderboards with best time tracking
- Character-specific progression and statistics

### Leaderboard & Profile System
- **Multi-Mode Tracking**: Survival, Time Attack, and Tournament statistics
- **Time Period Filtering**: All-time, weekly, and daily leaderboards
- **Character-Specific Stats**: Individual progress tracking per fighter
- **Player Profiles**: Comprehensive analytics including win rates, play time, favorite characters
- **Achievement System**: Progress tracking and milestone rewards
- **Persistent Storage**: localStorage-based data retention with cleanup management

## Network Architecture (Phase 4 Ready)

The codebase is prepared for Phase 4 multiplayer integration:
- Deterministic combat system ready for rollback netcode
- Event-driven architecture suitable for network synchronization  
- State management designed for client-side prediction
- Input system ready for network input buffering
- Enhanced match flow system ready for server validation
- Character selection system ready for network synchronization

## Development Rules

1. **Separation of Concerns**: Never directly access Phaser objects from React or vice versa
2. **EventBus Only**: All cross-system communication must use the EventBus
3. **Responsive Design First**: Use dynamic camera dimensions (`this.cameras.main`) instead of fixed coordinates
4. **Character Stats**: Use the character stats system for all fighter properties
5. **32-Frame Limit**: Work within the animation constraint using creative techniques
6. **Performance First**: Maintain 60 FPS target in all scenarios
7. **Clean Transitions**: Always clean up event listeners when switching scenes
8. **Debug Elements**: Keep visual debug elements (FrameDataVisualizer) disabled by default
9. **Tournament Integrity**: Ensure difficulty scaling works properly across all 5 matches
10. **AI Consistency**: Each character must maintain their unique AI personality traits
11. **State Management**: Use Zustand store for complex game state including tournament progress
12. **Leaderboard Integration**: Always save progression data to LeaderboardService for all game modes
13. **Statistics Tracking**: Update character-specific statistics for comprehensive player analytics
14. **Scene Architecture**: Use pure Phaser scenes for consistency instead of React overlays
15. **Data Persistence**: Leverage localStorage through LeaderboardService for reliable data retention
16. **Clean UI Design**: Prefer clean text-based interfaces over container graphics for better readability and performance
17. **Background Consistency**: Use Boot.createRandomFightBackground() for all fighting scenes to ensure visual variety
18. **Combat System Integration**: Always include collision detection calls in scene update loops
19. **Scale Mode Awareness**: Account for Phaser.Scale.RESIZE when sizing text and UI elements