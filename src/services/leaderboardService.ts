import { logger } from "@/lib/logger";
import { localStorageUtils } from "@/utils/localStorageUtils";

// Core leaderboard entry interfaces
export interface SurvivalEntry {
    id: string;
    playerName: string;
    character: string;
    score: number;
    roundsCompleted: number;
    perfectRounds: number;
    enemiesDefeated: number;
    finalMultiplier: number;
    timestamp: number;
    playTime: number; // in seconds
}

export interface TimeAttackEntry {
    id: string;
    playerName: string;
    character: string;
    courseId: string;
    courseName: string;
    completionTime: number; // in seconds
    medal: 'Gold' | 'Silver' | 'Bronze' | 'None';
    bonusTime: number;
    perfectVictories: number;
    timestamp: number;
}

export interface TournamentEntry {
    id: string;
    playerName: string;
    character: string;
    completed: boolean;
    matchesWon: number;
    totalMatches: number;
    finalDifficulty: number;
    defeatedOpponents: string[];
    timestamp: number;
    playTime: number; // in seconds
}

// Character-specific statistics
export interface CharacterStats {
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    survivalBestRound: number;
    survivalBestScore: number;
    survivalTotalScore: number;
    timeAttackBestTimes: Record<string, number>; // courseId -> best time
    timeAttackCompletions: number;
    tournamentCompletions: number;
    perfectRounds: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalPlayTime: number; // in seconds
    winStreak: number;
    bestWinStreak: number;
    lastPlayed: number; // timestamp
}

// Overall player profile
export interface PlayerProfile {
    id: string;
    playerName: string;
    createdAt: number;
    lastActive: number;
    totalMatches: number;
    totalWins: number;
    totalLosses: number;
    totalPlayTime: number;
    favoriteCharacter: string;
    currentWinStreak: number;
    bestWinStreak: number;
    achievementIds: string[];
    
    // Per-character detailed stats
    characterStats: Record<string, CharacterStats>;
    
    // Game mode preferences
    preferredGameMode: 'normal' | 'tournament' | 'survival' | 'timeattack';
    
    // Settings and preferences
    settings: {
        showDebug: boolean;
        preferredDifficulty: string;
        soundEnabled: boolean;
        musicEnabled: boolean;
    };
}

// Leaderboard data structure
export interface LeaderboardData {
    survival: {
        allTime: SurvivalEntry[];
        weekly: SurvivalEntry[];
        daily: SurvivalEntry[];
        perCharacter: Record<string, SurvivalEntry[]>;
    };
    timeAttack: {
        allTime: Record<string, TimeAttackEntry[]>; // courseId -> entries
        weekly: Record<string, TimeAttackEntry[]>;
        daily: Record<string, TimeAttackEntry[]>;
        perCharacter: Record<string, TimeAttackEntry[]>;
    };
    tournament: {
        allTime: TournamentEntry[];
        weekly: TournamentEntry[];
        daily: TournamentEntry[];
        perCharacter: Record<string, TournamentEntry[]>;
    };
    lastUpdated: number;
}

// Service class for managing leaderboards
export class LeaderboardService {
    private static readonly STORAGE_KEYS = {
        PLAYER_PROFILE: 'deadly-duel-player-profile',
        LEADERBOARD_DATA: 'deadly-duel-leaderboard',
        SURVIVAL_SCORES: 'deadly-duel-survival-scores',
        TIME_ATTACK_SCORES: 'deadly-duel-timeattack-scores',
        TOURNAMENT_SCORES: 'deadly-duel-tournament-scores',
    };

    private static readonly MAX_ENTRIES_PER_LEADERBOARD = 100;
    private static readonly MAX_ENTRIES_PER_PERIOD = 50;

    // Player profile management
    public static getPlayerProfile(): PlayerProfile {
        try {
            const stored = localStorageUtils.safeRead(this.STORAGE_KEYS.PLAYER_PROFILE);
            if (stored) {
                const profile = JSON.parse(stored) as PlayerProfile;
                // Update last active timestamp
                profile.lastActive = Date.now();
                this.savePlayerProfile(profile);
                return profile;
            }
        } catch (error) {
            console.error('Failed to load player profile:', error);
        }

        // Create default profile
        return this.createDefaultProfile();
    }

    public static savePlayerProfile(profile: PlayerProfile): void {
        try {
            localStorageUtils.debouncedWriteObject(this.STORAGE_KEYS.PLAYER_PROFILE, profile);
            logger.debug('Player profile saved successfully');
        } catch (error) {
            console.error('Failed to save player profile:', error);
        }
    }

    public static createDefaultProfile(): PlayerProfile {
        const profile: PlayerProfile = {
            id: this.generateId(),
            playerName: 'Fighter',
            createdAt: Date.now(),
            lastActive: Date.now(),
            totalMatches: 0,
            totalWins: 0,
            totalLosses: 0,
            totalPlayTime: 0,
            favoriteCharacter: 'rocco',
            currentWinStreak: 0,
            bestWinStreak: 0,
            achievementIds: [],
            characterStats: {},
            preferredGameMode: 'normal',
            settings: {
                showDebug: false,
                preferredDifficulty: 'normal',
                soundEnabled: true,
                musicEnabled: true,
            },
        };

        this.savePlayerProfile(profile);
        return profile;
    }

    // Leaderboard data management
    public static getLeaderboardData(): LeaderboardData {
        try {
            const stored = localStorageUtils.safeRead(this.STORAGE_KEYS.LEADERBOARD_DATA);
            if (stored) {
                return JSON.parse(stored) as LeaderboardData;
            }
        } catch (error) {
            console.error('Failed to load leaderboard data:', error);
        }

        return this.createDefaultLeaderboard();
    }

    public static saveLeaderboardData(data: LeaderboardData): void {
        try {
            data.lastUpdated = Date.now();
            localStorageUtils.debouncedWriteObject(this.STORAGE_KEYS.LEADERBOARD_DATA, data);
        } catch (error) {
            console.error('Failed to save leaderboard data:', error);
        }
    }

    private static createDefaultLeaderboard(): LeaderboardData {
        return {
            survival: {
                allTime: [],
                weekly: [],
                daily: [],
                perCharacter: {},
            },
            timeAttack: {
                allTime: {},
                weekly: {},
                daily: {},
                perCharacter: {},
            },
            tournament: {
                allTime: [],
                weekly: [],
                daily: [],
                perCharacter: {},
            },
            lastUpdated: Date.now(),
        };
    }

    // Add new entries to leaderboards
    public static addSurvivalEntry(entry: Omit<SurvivalEntry, 'id'>): void {
        const fullEntry: SurvivalEntry = {
            ...entry,
            id: this.generateId(),
        };

        const leaderboard = this.getLeaderboardData();
        
        // Add to all-time leaderboard
        leaderboard.survival.allTime.push(fullEntry);
        leaderboard.survival.allTime.sort((a, b) => b.score - a.score);
        leaderboard.survival.allTime = leaderboard.survival.allTime.slice(0, this.MAX_ENTRIES_PER_LEADERBOARD);

        // Add to weekly/daily if within time period
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;

        if (now - entry.timestamp < dayMs) {
            leaderboard.survival.daily.push(fullEntry);
            leaderboard.survival.daily.sort((a, b) => b.score - a.score);
            leaderboard.survival.daily = leaderboard.survival.daily.slice(0, this.MAX_ENTRIES_PER_PERIOD);
        }

        if (now - entry.timestamp < weekMs) {
            leaderboard.survival.weekly.push(fullEntry);
            leaderboard.survival.weekly.sort((a, b) => b.score - a.score);
            leaderboard.survival.weekly = leaderboard.survival.weekly.slice(0, this.MAX_ENTRIES_PER_PERIOD);
        }

        // Add to character-specific leaderboard
        if (!leaderboard.survival.perCharacter[entry.character]) {
            leaderboard.survival.perCharacter[entry.character] = [];
        }
        leaderboard.survival.perCharacter[entry.character].push(fullEntry);
        leaderboard.survival.perCharacter[entry.character].sort((a, b) => b.score - a.score);
        leaderboard.survival.perCharacter[entry.character] = 
            leaderboard.survival.perCharacter[entry.character].slice(0, this.MAX_ENTRIES_PER_PERIOD);

        this.saveLeaderboardData(leaderboard);
        logger.gameEvent('survival-score-added', { score: entry.score, character: entry.character });
    }

    public static addTimeAttackEntry(entry: Omit<TimeAttackEntry, 'id'>): void {
        const fullEntry: TimeAttackEntry = {
            ...entry,
            id: this.generateId(),
        };

        const leaderboard = this.getLeaderboardData();
        
        // Initialize course arrays if needed
        if (!leaderboard.timeAttack.allTime[entry.courseId]) {
            leaderboard.timeAttack.allTime[entry.courseId] = [];
        }
        if (!leaderboard.timeAttack.weekly[entry.courseId]) {
            leaderboard.timeAttack.weekly[entry.courseId] = [];
        }
        if (!leaderboard.timeAttack.daily[entry.courseId]) {
            leaderboard.timeAttack.daily[entry.courseId] = [];
        }

        // Add to all-time leaderboard (sorted by completion time, ascending)
        leaderboard.timeAttack.allTime[entry.courseId].push(fullEntry);
        leaderboard.timeAttack.allTime[entry.courseId].sort((a, b) => a.completionTime - b.completionTime);
        leaderboard.timeAttack.allTime[entry.courseId] = 
            leaderboard.timeAttack.allTime[entry.courseId].slice(0, this.MAX_ENTRIES_PER_LEADERBOARD);

        // Add to time period leaderboards
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;

        if (now - entry.timestamp < dayMs) {
            leaderboard.timeAttack.daily[entry.courseId].push(fullEntry);
            leaderboard.timeAttack.daily[entry.courseId].sort((a, b) => a.completionTime - b.completionTime);
            leaderboard.timeAttack.daily[entry.courseId] = 
                leaderboard.timeAttack.daily[entry.courseId].slice(0, this.MAX_ENTRIES_PER_PERIOD);
        }

        if (now - entry.timestamp < weekMs) {
            leaderboard.timeAttack.weekly[entry.courseId].push(fullEntry);
            leaderboard.timeAttack.weekly[entry.courseId].sort((a, b) => a.completionTime - b.completionTime);
            leaderboard.timeAttack.weekly[entry.courseId] = 
                leaderboard.timeAttack.weekly[entry.courseId].slice(0, this.MAX_ENTRIES_PER_PERIOD);
        }

        // Add to character-specific leaderboard
        if (!leaderboard.timeAttack.perCharacter[entry.character]) {
            leaderboard.timeAttack.perCharacter[entry.character] = [];
        }
        leaderboard.timeAttack.perCharacter[entry.character].push(fullEntry);
        leaderboard.timeAttack.perCharacter[entry.character].sort((a, b) => a.completionTime - b.completionTime);
        leaderboard.timeAttack.perCharacter[entry.character] = 
            leaderboard.timeAttack.perCharacter[entry.character].slice(0, this.MAX_ENTRIES_PER_PERIOD);

        this.saveLeaderboardData(leaderboard);
        logger.gameEvent('timeattack-score-added', { 
            time: entry.completionTime, 
            course: entry.courseId, 
            character: entry.character 
        });
    }

    public static addTournamentEntry(entry: Omit<TournamentEntry, 'id'>): void {
        const fullEntry: TournamentEntry = {
            ...entry,
            id: this.generateId(),
        };

        const leaderboard = this.getLeaderboardData();
        
        // Add to all-time leaderboard (sorted by completion and matches won)
        leaderboard.tournament.allTime.push(fullEntry);
        leaderboard.tournament.allTime.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? -1 : 1;
            return b.matchesWon - a.matchesWon;
        });
        leaderboard.tournament.allTime = leaderboard.tournament.allTime.slice(0, this.MAX_ENTRIES_PER_LEADERBOARD);

        // Add to time period leaderboards
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;

        if (now - entry.timestamp < dayMs) {
            leaderboard.tournament.daily.push(fullEntry);
            leaderboard.tournament.daily.sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? -1 : 1;
                return b.matchesWon - a.matchesWon;
            });
            leaderboard.tournament.daily = leaderboard.tournament.daily.slice(0, this.MAX_ENTRIES_PER_PERIOD);
        }

        if (now - entry.timestamp < weekMs) {
            leaderboard.tournament.weekly.push(fullEntry);
            leaderboard.tournament.weekly.sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? -1 : 1;
                return b.matchesWon - a.matchesWon;
            });
            leaderboard.tournament.weekly = leaderboard.tournament.weekly.slice(0, this.MAX_ENTRIES_PER_PERIOD);
        }

        // Add to character-specific leaderboard
        if (!leaderboard.tournament.perCharacter[entry.character]) {
            leaderboard.tournament.perCharacter[entry.character] = [];
        }
        leaderboard.tournament.perCharacter[entry.character].push(fullEntry);
        leaderboard.tournament.perCharacter[entry.character].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? -1 : 1;
            return b.matchesWon - a.matchesWon;
        });
        leaderboard.tournament.perCharacter[entry.character] = 
            leaderboard.tournament.perCharacter[entry.character].slice(0, this.MAX_ENTRIES_PER_PERIOD);

        this.saveLeaderboardData(leaderboard);
        logger.gameEvent('tournament-score-added', { 
            completed: entry.completed, 
            wins: entry.matchesWon, 
            character: entry.character 
        });
    }

    // Update character statistics
    public static updateCharacterStats(
        characterId: string, 
        updates: Partial<CharacterStats>
    ): void {
        const profile = this.getPlayerProfile();
        
        if (!profile.characterStats[characterId]) {
            profile.characterStats[characterId] = this.createDefaultCharacterStats();
        }

        const stats = profile.characterStats[characterId];
        Object.assign(stats, updates);
        stats.lastPlayed = Date.now();

        // Update overall profile stats
        profile.totalMatches = Object.values(profile.characterStats)
            .reduce((sum, cs) => sum + cs.matchesPlayed, 0);
        profile.totalWins = Object.values(profile.characterStats)
            .reduce((sum, cs) => sum + cs.matchesWon, 0);
        profile.totalLosses = Object.values(profile.characterStats)
            .reduce((sum, cs) => sum + cs.matchesLost, 0);

        // Update favorite character
        const mostPlayedChar = Object.entries(profile.characterStats)
            .sort(([,a], [,b]) => b.matchesPlayed - a.matchesPlayed)[0];
        if (mostPlayedChar) {
            profile.favoriteCharacter = mostPlayedChar[0];
        }

        this.savePlayerProfile(profile);
    }

    private static createDefaultCharacterStats(): CharacterStats {
        return {
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,
            survivalBestRound: 0,
            survivalBestScore: 0,
            survivalTotalScore: 0,
            timeAttackBestTimes: {},
            timeAttackCompletions: 0,
            tournamentCompletions: 0,
            perfectRounds: 0,
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            totalPlayTime: 0,
            winStreak: 0,
            bestWinStreak: 0,
            lastPlayed: Date.now(),
        };
    }

    // Utility methods
    public static formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        if (minutes > 0) {
            return `${minutes}:${secs.padStart(5, '0')}`;
        }
        return `${secs}s`;
    }

    public static formatScore(score: number): string {
        return score.toLocaleString();
    }

    public static getPlayerRank(playerId: string, leaderboard: any[], sortFn: (a: any, b: any) => number): number {
        const sorted = [...leaderboard].sort(sortFn);
        return sorted.findIndex(entry => entry.id === playerId) + 1;
    }

    private static generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Clean up old entries (call periodically)
    public static cleanupOldEntries(): void {
        const leaderboard = this.getLeaderboardData();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;

        // Clean up daily leaderboards
        leaderboard.survival.daily = leaderboard.survival.daily.filter(
            entry => now - entry.timestamp < dayMs
        );
        
        // Clean up weekly leaderboards
        leaderboard.survival.weekly = leaderboard.survival.weekly.filter(
            entry => now - entry.timestamp < weekMs
        );

        // Clean up time attack daily/weekly
        Object.keys(leaderboard.timeAttack.daily).forEach(courseId => {
            leaderboard.timeAttack.daily[courseId] = leaderboard.timeAttack.daily[courseId]
                .filter(entry => now - entry.timestamp < dayMs);
        });

        Object.keys(leaderboard.timeAttack.weekly).forEach(courseId => {
            leaderboard.timeAttack.weekly[courseId] = leaderboard.timeAttack.weekly[courseId]
                .filter(entry => now - entry.timestamp < weekMs);
        });

        // Clean up tournament daily/weekly
        leaderboard.tournament.daily = leaderboard.tournament.daily.filter(
            entry => now - entry.timestamp < dayMs
        );
        leaderboard.tournament.weekly = leaderboard.tournament.weekly.filter(
            entry => now - entry.timestamp < weekMs
        );

        this.saveLeaderboardData(leaderboard);
    }
}