import { Scene } from "phaser";
import { GAME_CONFIG } from "@/config/gameConfig";
import { characterList } from "@/data/characters";
import { Fighter } from "@/game/entities/Fighter";
import EventBus from "@/lib/EventBus";
import { logger } from "@/lib/logger";
import debug from "@/lib/debug";
import { hybridLeaderboardService } from "@/services/hybridLeaderboardService";
import { useGameStore } from "@/state/stores/gameStore";

export interface MatchData {
    player1RoundWins: number;
    player2RoundWins: number;
    currentRound: number;
    isMatchComplete: boolean;
}

/**
 * Manages match progression, round endings, and tournament flow
 */
export class MatchManager {
    private scene: Scene;
    private player1RoundWins: number = 0;
    private player2RoundWins: number = 0;
    private currentRound: number = 1;
    private isMatchComplete: boolean = false;
    private roundTimeLeft: number = GAME_CONFIG.MATCH.ROUND_DURATION;
    private roundEnded: boolean = false;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Initialize match data from registry or start fresh
     */
    public initializeMatch(): void {
        const matchData = this.scene.registry.get("matchData") || {
            player1RoundWins: 0,
            player2RoundWins: 0,
            currentRound: 1,
            isMatchComplete: false,
        };

        this.player1RoundWins = matchData.player1RoundWins;
        this.player2RoundWins = matchData.player2RoundWins;
        this.currentRound = matchData.currentRound;
        this.isMatchComplete = matchData.isMatchComplete;
        this.roundTimeLeft = GAME_CONFIG.MATCH.ROUND_DURATION;
        this.roundEnded = false;

        debug.general(`Match initialized - Round ${this.currentRound}, Score: ${this.player1RoundWins}-${this.player2RoundWins}`);
    }

    /**
     * Check for round end conditions
     */
    public checkRoundEndConditions(player1: Fighter, player2: Fighter): void {
        if (this.isMatchComplete || this.roundEnded) return;

        let roundWinner: string | null = null;
        let endReason: string = "";

        // Check for fighter defeat
        if (player1.health <= 0) {
            roundWinner = "Player 2 (AI)";
            endReason = "K.O.!";
            this.player2RoundWins++;
            // Update gameStore for UI
            useGameStore.getState().updateMatchScore("player2", this.player2RoundWins);
        } else if (player2.health <= 0) {
            roundWinner = player1.fighterName;
            endReason = "K.O.!";
            this.player1RoundWins++;
            // Update gameStore for UI
            useGameStore.getState().updateMatchScore("player1", this.player1RoundWins);
        }
        // Check for time expiration
        else if (this.roundTimeLeft <= 0) {
            if (player1.health > player2.health) {
                roundWinner = player1.fighterName;
                this.player1RoundWins++;
                // Update gameStore for UI
                useGameStore.getState().updateMatchScore("player1", this.player1RoundWins);
            } else if (player2.health > player1.health) {
                roundWinner = "Player 2 (AI)";
                this.player2RoundWins++;
                // Update gameStore for UI
                useGameStore.getState().updateMatchScore("player2", this.player2RoundWins);
            } else {
                roundWinner = "Draw";
                // No one gets a round win on draw
            }
            endReason = "TIME'S UP!";
        }

        // Check if match is complete
        if (this.player1RoundWins >= 2 || this.player2RoundWins >= 2) {
            this.isMatchComplete = true;
        }

        // If we have a round result, end the round
        if (roundWinner !== null) {
            this.roundEnded = true;
            this.endRound(endReason, roundWinner, player1, player2);
        }
    }

    /**
     * Update round timer
     */
    public updateRoundTimer(delta: number): void {
        // Don't update timer if round has ended
        if (this.roundEnded || this.isMatchComplete) {
            return;
        }
        
        this.roundTimeLeft -= delta / 1000;

        // Emit timer update for React UI (throttled)
        if (Math.floor(this.roundTimeLeft) !== Math.floor(this.roundTimeLeft + delta / 1000)) {
            EventBus.emit("round-timer", { timeLeft: this.roundTimeLeft });
        }
    }

    private endRound(reason: string, roundWinner: string, player1: Fighter, player2?: Fighter): void {
        debug.general(`Round ended: P1 wins: ${this.player1RoundWins}, P2 wins: ${this.player2RoundWins}, complete: ${this.isMatchComplete}`);

        // IMMEDIATELY stop all game activity
        this.roundEnded = true;

        // Stop fighters and reset to idle animation
        if (player2) {
            this.stopFighters(player1, player2);
        }

        const matchWinner = this.player1RoundWins >= 2 
            ? player1.fighterName 
            : this.player2RoundWins >= 2 
            ? "Player 2 (AI)" 
            : null;

        if (matchWinner) {
            this.isMatchComplete = true;
            this.handleMatchEnd(matchWinner, reason);
        } else {
            this.handleRoundEnd(reason, roundWinner);
        }
    }

    private stopFighters(player1: Fighter, player2: Fighter): void {
        if (player1) {
            const body1 = player1.body as Phaser.Physics.Arcade.Body;
            body1?.setVelocity(0, 0);
            player1.anims?.play("idle", true);
            player1.currentState = "idle";
        }
        if (player2) {
            const body2 = player2.body as Phaser.Physics.Arcade.Body;
            body2?.setVelocity(0, 0);
            player2.anims?.play("idle", true);
            player2.currentState = "idle";
        }
    }

    private handleMatchEnd(matchWinner: string, reason: string): void {
        this.isMatchComplete = true;

        // Use dynamic camera dimensions for text positioning
        const { width, height } = this.scene.cameras.main;

        // Show match end message
        const endText = this.scene.add.text(
            width / 2,
            height / 2 - 50,
            `${matchWinner} WINS THE MATCH!`,
            {
                fontSize: "48px",
                color: "#FFD700",
                fontFamily: "Press Start 2P",
                stroke: "#000000",
                strokeThickness: 4,
            }
        );
        endText.setOrigin(0.5);
        endText.setDepth(1000);

        const scoreText = this.scene.add.text(
            width / 2,
            height / 2 + 20,
            `Final Score: ${this.player1RoundWins} - ${this.player2RoundWins}`,
            {
                fontSize: "24px",
                color: "#FFFFFF",
                fontFamily: "Press Start 2P",
            }
        );
        scoreText.setOrigin(0.5);
        scoreText.setDepth(1000);

        EventBus.emit("match-ended", {
            winner: matchWinner,
            score: `${this.player1RoundWins}-${this.player2RoundWins}`,
        });

        // Handle tournament progression or return to selection
        this.scene.time.delayedCall(6000, () => {
            this.handlePostMatchTransition(matchWinner);
        });
    }

    private handleRoundEnd(reason: string, roundWinner: string): void {
        const completedRound = this.currentRound;
        this.currentRound++;

        // Use dynamic camera dimensions for text positioning
        const { width, height } = this.scene.cameras.main;

        const endText = this.scene.add.text(
            width / 2,
            height / 2 - 50,
            `${reason}\\n${roundWinner} wins Round ${completedRound}!`,
            {
                fontSize: "36px",
                color: "#ff0000",
                fontFamily: "Press Start 2P",
                stroke: "#000000",
                strokeThickness: 4,
                align: "center",
            }
        );
        endText.setOrigin(0.5);
        endText.setDepth(1000);

        const scoreText = this.scene.add.text(
            width / 2,
            height / 2 + 40,
            `Score: ${this.player1RoundWins} - ${this.player2RoundWins}`,
            {
                fontSize: "24px",
                color: "#FFFFFF",
                fontFamily: "Press Start 2P",
            }
        );
        scoreText.setOrigin(0.5);
        scoreText.setDepth(1000);

        EventBus.emit("round-ended", {
            round: completedRound,
            winner: roundWinner,
            score: `${this.player1RoundWins}-${this.player2RoundWins}`,
        });

        // Continue to next round after 3 seconds
        this.scene.time.delayedCall(3000, () => {
            this.persistMatchData();
            this.scene.scene.restart();
        });
    }

    private handlePostMatchTransition(matchWinner: string): void {
        const gameMode = this.scene.registry.get("gameMode");
        
        this.scene.cameras.main.fadeOut(300, 0, 0, 0);
        this.scene.cameras.main.once("camerafadeoutcomplete", () => {
            if (gameMode === "tournament") {
                this.handleTournamentProgression(matchWinner);
            } else {
                // Normal mode - return to character selection
                this.clearMatchData();
                this.scene.scene.start("CharacterSelectScene");
            }
        });
    }

    private handleTournamentProgression(matchWinner: string): void {
        const tournamentData = this.scene.registry.get("tournamentData");
        if (!tournamentData) return;

        const aiOpponent = this.scene.registry.get("aiOpponent");
        const player1Name = this.scene.registry.get("selectedCharacter")?.name || "Player";
        
        if (matchWinner.includes(player1Name)) {
            // Player won
            tournamentData.wins++;
            tournamentData.defeatedOpponents.push(aiOpponent.id);
            
            logger.gameEvent("tournament-match-won", {
                matchNumber: tournamentData.currentMatch + 1,
                defeatedOpponent: aiOpponent.name,
                totalWins: tournamentData.wins
            });
        } else {
            // Player lost
            tournamentData.losses++;
            
            logger.gameEvent("tournament-match-lost", {
                matchNumber: tournamentData.currentMatch + 1,
                lostTo: aiOpponent.name,
                totalLosses: tournamentData.losses
            });
        }

        tournamentData.currentMatch++;
        
        // Increase difficulty for next match
        if (tournamentData.currentMatch < 5) {
            tournamentData.difficultyLevel = Math.min(5, tournamentData.difficultyLevel + 1);
        }

        this.scene.registry.set("tournamentData", tournamentData);

        // Check if tournament is complete
        if (tournamentData.currentMatch >= 5 || tournamentData.losses > 0) {
            this.completeTournament(tournamentData);
        } else {
            this.proceedToNextTournamentMatch(tournamentData);
        }
    }

    private completeTournament(tournamentData: any): void {
        const isChampion = tournamentData.wins === 5 && tournamentData.losses === 0;
        
        // Calculate total play time
        const playTime = tournamentData.startTime ? (Date.now() - tournamentData.startTime) / 1000 : 0;

        // Get selected character data
        const selectedCharacterData = this.scene.registry.get("selectedCharacter");
        const selectedCharacterId = typeof selectedCharacterData === "string" 
            ? selectedCharacterData 
            : selectedCharacterData?.id || "rocco";

        // Get player profile for player name
        const playerProfile = hybridLeaderboardService.getPlayerProfile();

        // Add tournament entry to leaderboard with automatic wallet integration
        hybridLeaderboardService.addTournamentEntry({
            playerName: playerProfile.playerName,
            character: selectedCharacterId,
            completed: isChampion,
            matchesWon: tournamentData.wins,
            totalMatches: tournamentData.totalMatches || 5,
            finalDifficulty: tournamentData.difficultyLevel,
            defeatedOpponents: tournamentData.defeatedOpponents || [],
            timestamp: Date.now(),
            playTime: playTime,
        });

        // Update character statistics
        const currentStats = playerProfile.characterStats[selectedCharacterId];
        hybridLeaderboardService.updateCharacterStats(selectedCharacterId, {
            matchesPlayed: tournamentData.wins + tournamentData.losses,
            matchesWon: tournamentData.wins,
            matchesLost: tournamentData.losses,
            tournamentCompletions: (currentStats?.tournamentCompletions || 0) + (isChampion ? 1 : 0),
            totalPlayTime: (currentStats?.totalPlayTime || 0) + playTime,
            winStreak: isChampion ? (currentStats?.winStreak || 0) + tournamentData.wins : 0,
            bestWinStreak: Math.max(
                currentStats?.bestWinStreak || 0,
                tournamentData.wins
            ),
        });

        logger.gameEvent("tournament-completed", {
            wins: tournamentData.wins,
            losses: tournamentData.losses,
            isChampion: isChampion,
            character: selectedCharacterId,
            playTime: playTime,
            defeatedOpponents: tournamentData.defeatedOpponents
        });

        console.log("📊 TOURNAMENT: Score saved to leaderboard:", {
            completed: isChampion,
            wins: tournamentData.wins,
            losses: tournamentData.losses,
            character: selectedCharacterId,
            playTime: hybridLeaderboardService.formatTime(playTime),
        });

        // Show tournament results
        const { width, height } = this.scene.cameras.main;
        
        const resultTitle = isChampion ? "TOURNAMENT CHAMPION!" : "TOURNAMENT ENDED";
        const resultColor = isChampion ? "#FFD700" : "#EF4444";

        const titleText = this.scene.add.text(width / 2, height / 2 - 80, resultTitle, {
            fontSize: "48px",
            color: resultColor,
            fontFamily: "Press Start 2P",
            stroke: "#000000",
            strokeThickness: 4,
        });
        titleText.setOrigin(0.5);
        titleText.setDepth(2000);

        const statsText = this.scene.add.text(
            width / 2,
            height / 2,
            `Wins: ${tournamentData.wins} / 5\\nLosses: ${tournamentData.losses}`,
            {
                fontSize: "24px",
                color: "#FFFFFF",
                fontFamily: "Press Start 2P",
                align: "center",
                lineSpacing: 8,
            }
        );
        statsText.setOrigin(0.5);
        statsText.setDepth(2000);

        // Return to arcade mode selection after 5 seconds
        this.scene.time.delayedCall(5000, () => {
            this.scene.cameras.main.fadeOut(300, 0, 0, 0);
            this.scene.cameras.main.once("camerafadeoutcomplete", () => {
                this.clearTournamentData();
                this.scene.scene.start("ArcadeModeSelectScene");
            });
        });
    }

    private proceedToNextTournamentMatch(tournamentData: any): void {
        // Show progression message
        const { width, height } = this.scene.cameras.main;
        
        const progressText = this.scene.add.text(
            width / 2,
            height / 2 - 50,
            `Match ${tournamentData.currentMatch + 1} / 5\\nPrepare for your next opponent!`,
            {
                fontSize: "32px",
                color: "#FBBF24",
                fontFamily: "Press Start 2P",
                stroke: "#000000",
                strokeThickness: 4,
                align: "center",
                lineSpacing: 8,
            }
        );
        progressText.setOrigin(0.5);
        progressText.setDepth(2000);

        // Continue to next match after 3 seconds
        this.scene.time.delayedCall(3000, () => {
            this.clearMatchOnlyData();
            EventBus.emit("reset-match-score", {});
            this.scene.scene.restart();
        });
    }

    /**
     * Select tournament opponent based on progression
     */
    public selectTournamentOpponent(playerCharacter: any, tournamentData: any): any {
        const availableOpponents = characterList.filter(
            (char) => char.id !== playerCharacter.id
        );

        const remainingOpponents = availableOpponents.filter(
            (char) => !tournamentData.defeatedOpponents.includes(char.id)
        );

        if (remainingOpponents.length === 0) {
            return availableOpponents[0];
        }

        // Sort by health ascending (weaker opponents first)
        const sortedOpponents = remainingOpponents.sort((a, b) => a.stats.health - b.stats.health);
        
        return sortedOpponents[0];
    }

    private persistMatchData(): void {
        this.scene.registry.set("matchData", {
            player1RoundWins: this.player1RoundWins,
            player2RoundWins: this.player2RoundWins,
            currentRound: this.currentRound,
            isMatchComplete: this.isMatchComplete,
        });
    }

    private clearMatchData(): void {
        this.scene.registry.remove("matchData");
        this.scene.registry.remove("aiOpponent");
    }

    private clearMatchOnlyData(): void {
        this.scene.registry.remove("aiOpponent");
        this.scene.registry.remove("matchData");
    }

    private clearTournamentData(): void {
        this.scene.registry.remove("tournamentData");
        this.scene.registry.remove("aiOpponent");
        this.scene.registry.remove("matchData");
    }

    // Getters for external access
    public get roundTimeRemaining(): number {
        return this.roundTimeLeft;
    }

    public get isRoundEnded(): boolean {
        return this.roundEnded;
    }

    public get matchData(): MatchData {
        return {
            player1RoundWins: this.player1RoundWins,
            player2RoundWins: this.player2RoundWins,
            currentRound: this.currentRound,
            isMatchComplete: this.isMatchComplete,
        };
    }
}