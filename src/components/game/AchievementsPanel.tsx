import React, { useState, useEffect } from "react";
import { achievementService, Achievement, PlayerAchievements } from "@/services/achievementService";
import { solanaWalletService } from "@/services/solanaWalletService";

interface AchievementsPanelProps {
    isVisible: boolean;
    onClose: () => void;
}

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({ isVisible, onClose }) => {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [playerData, setPlayerData] = useState<PlayerAchievements | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [walletConnected, setWalletConnected] = useState(false);

    useEffect(() => {
        if (isVisible) {
            loadAchievements();
            setWalletConnected(solanaWalletService.isConnected());
        }
    }, [isVisible]);

    const loadAchievements = () => {
        const allAchievements = achievementService.getAchievements();
        setAchievements(allAchievements);
        setPlayerData(achievementService.getPlayerAchievements());
    };

    const getFilteredAchievements = () => {
        let filtered = achievements;

        if (selectedCategory !== "all") {
            filtered = filtered.filter(achievement => achievement.category === selectedCategory);
        }

        // Show wallet-only achievements only if wallet is connected
        if (!walletConnected) {
            filtered = filtered.filter(achievement => !achievement.walletOnly);
        }

        return filtered;
    };

    const categories = [
        { id: "all", name: "All", icon: "🏆" },
        { id: "global", name: "Global", icon: "🌐" },
        { id: "combat", name: "Combat", icon: "⚔️" },
        { id: "survival", name: "Survival", icon: "🛡️" },
        { id: "timeattack", name: "Time Attack", icon: "⚡" },
        { id: "tournament", name: "Tournament", icon: "🎯" },
        { id: "social", name: "Social", icon: "🤝" },
    ];

    const getProgressPercentage = (achievement: Achievement): number => {
        if (!achievement.maxProgress) return achievement.unlocked ? 100 : 0;
        return Math.round((achievement.progress || 0) / achievement.maxProgress * 100);
    };

    const getRarityColor = (rarity: string) => {
        switch (rarity) {
            case 'common': return 'text-gray-400 border-gray-400';
            case 'rare': return 'text-blue-400 border-blue-400';
            case 'epic': return 'text-purple-400 border-purple-400';
            case 'legendary': return 'text-yellow-400 border-yellow-400';
            default: return 'text-gray-400 border-gray-400';
        }
    };

    const getRarityBg = (rarity: string) => {
        switch (rarity) {
            case 'common': return 'bg-gray-800/50';
            case 'rare': return 'bg-blue-800/50';
            case 'epic': return 'bg-purple-800/50';
            case 'legendary': return 'bg-yellow-800/50';
            default: return 'bg-gray-800/50';
        }
    };

    if (!isVisible) return null;

    const filteredAchievements = getFilteredAchievements();
    const unlockedCount = filteredAchievements.filter(a => a.unlocked).length;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">🏆 Achievements</h2>
                            <div className="text-sm opacity-90">
                                <span>{unlockedCount}/{filteredAchievements.length} Unlocked</span>
                                {playerData && (
                                    <span className="ml-4">Total Points: {playerData.totalPoints}</span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white text-2xl"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Wallet Status */}
                    {!walletConnected && (
                        <div className="mt-4 p-3 bg-amber-600/80 rounded-lg text-sm">
                            🔗 Connect your wallet to unlock global achievements!
                        </div>
                    )}
                </div>

                <div className="flex h-[70vh]">
                    {/* Categories Sidebar */}
                    <div className="w-64 bg-gray-800 p-4 overflow-y-auto">
                        <h3 className="text-white font-semibold mb-3">Categories</h3>
                        <div className="space-y-2">
                            {categories.map(category => (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`
                                        w-full text-left p-3 rounded-lg transition-colors
                                        ${selectedCategory === category.id
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                        }
                                    `}
                                >
                                    <span className="mr-2">{category.icon}</span>
                                    {category.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Achievements Grid */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredAchievements.map(achievement => (
                                <div
                                    key={achievement.id}
                                    className={`
                                        border rounded-lg p-4 transition-all
                                        ${achievement.unlocked 
                                            ? `${getRarityBg(achievement.rarity)} ${getRarityColor(achievement.rarity)}` 
                                            : 'bg-gray-800/30 border-gray-600 text-gray-400'
                                        }
                                        ${achievement.walletOnly && !walletConnected ? 'opacity-50' : ''}
                                    `}
                                >
                                    <div className="flex items-start space-x-3">
                                        <span className={`text-2xl ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>
                                            {achievement.icon}
                                        </span>
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <h4 className="font-semibold">
                                                    {achievement.name}
                                                </h4>
                                                {achievement.walletOnly && (
                                                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                                                        🌐 Global
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm opacity-80 mb-2">
                                                {achievement.description}
                                            </p>
                                            
                                            {/* Progress Bar */}
                                            {achievement.maxProgress && achievement.maxProgress > 1 && (
                                                <div className="mb-2">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span>Progress</span>
                                                        <span>{achievement.progress || 0}/{achievement.maxProgress}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full transition-all ${
                                                                achievement.unlocked ? 'bg-green-500' : 'bg-blue-500'
                                                            }`}
                                                            style={{ width: `${getProgressPercentage(achievement)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Reward */}
                                            {achievement.reward && (
                                                <div className="text-xs opacity-70">
                                                    <span className="font-semibold">Reward: </span>
                                                    {achievement.reward.type === 'title' && '👑 '}
                                                    {achievement.reward.type === 'badge' && '🏆 '}
                                                    {achievement.reward.type === 'cosmetic' && '✨ '}
                                                    {achievement.reward.value}
                                                </div>
                                            )}

                                            {/* Unlock Date */}
                                            {achievement.unlocked && achievement.unlockedAt && (
                                                <div className="text-xs opacity-60 mt-2">
                                                    Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredAchievements.length === 0 && (
                            <div className="text-center text-gray-400 mt-8">
                                <div className="text-4xl mb-4">🏆</div>
                                <p>No achievements found in this category.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};