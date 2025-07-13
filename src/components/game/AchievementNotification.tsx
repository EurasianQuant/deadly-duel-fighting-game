import React, { useState, useEffect } from "react";
import EventBus from "@/lib/EventBus";

interface AchievementData {
    achievement: {
        id: string;
        name: string;
        description: string;
        icon: string;
        rarity: 'common' | 'rare' | 'epic' | 'legendary';
        reward?: {
            type: 'badge' | 'title' | 'cosmetic';
            value: string;
        };
    };
    points: number;
    totalPoints: number;
}

export const AchievementNotification: React.FC = () => {
    const [currentAchievement, setCurrentAchievement] = useState<AchievementData | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleAchievementUnlocked = (data: AchievementData) => {
            setCurrentAchievement(data);
            setIsVisible(true);

            // Auto-hide after 5 seconds
            setTimeout(() => {
                setIsVisible(false);
            }, 5000);

            // Clear after animation
            setTimeout(() => {
                setCurrentAchievement(null);
            }, 5500);
        };

        EventBus.on("achievement-unlocked", handleAchievementUnlocked);

        return () => {
            EventBus.off("achievement-unlocked", handleAchievementUnlocked);
        };
    }, []);

    if (!currentAchievement) {
        return null;
    }

    const getRarityColor = (rarity: string) => {
        switch (rarity) {
            case 'common':
                return 'from-gray-500 to-gray-600 border-gray-400';
            case 'rare':
                return 'from-blue-500 to-blue-600 border-blue-400';
            case 'epic':
                return 'from-purple-500 to-purple-600 border-purple-400';
            case 'legendary':
                return 'from-yellow-500 to-yellow-600 border-yellow-400';
            default:
                return 'from-gray-500 to-gray-600 border-gray-400';
        }
    };

    const getRarityGlow = (rarity: string) => {
        switch (rarity) {
            case 'common':
                return 'shadow-lg shadow-gray-500/50';
            case 'rare':
                return 'shadow-lg shadow-blue-500/50';
            case 'epic':
                return 'shadow-xl shadow-purple-500/60';
            case 'legendary':
                return 'shadow-2xl shadow-yellow-500/80';
            default:
                return 'shadow-lg shadow-gray-500/50';
        }
    };

    return (
        <div className={`
            fixed top-4 left-1/2 transform -translate-x-1/2 z-50
            transition-all duration-500 ease-out
            ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
        `}>
            <div className={`
                bg-gradient-to-r ${getRarityColor(currentAchievement.achievement.rarity)}
                ${getRarityGlow(currentAchievement.achievement.rarity)}
                border-2 rounded-lg p-4 max-w-md
                backdrop-blur-sm
                animate-pulse
            `}>
                {/* Header */}
                <div className="flex items-center space-x-3 mb-2">
                    <span className="text-3xl">{currentAchievement.achievement.icon}</span>
                    <div className="flex-1">
                        <div className="flex items-center space-x-2">
                            <span className="text-white font-bold text-sm uppercase tracking-wide">
                                Achievement Unlocked!
                            </span>
                            <span className={`
                                px-2 py-1 rounded text-xs font-bold uppercase
                                ${currentAchievement.achievement.rarity === 'legendary' ? 'bg-yellow-200 text-yellow-900' :
                                  currentAchievement.achievement.rarity === 'epic' ? 'bg-purple-200 text-purple-900' :
                                  currentAchievement.achievement.rarity === 'rare' ? 'bg-blue-200 text-blue-900' :
                                  'bg-gray-200 text-gray-900'}
                            `}>
                                {currentAchievement.achievement.rarity}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Achievement Info */}
                <div className="text-white">
                    <h3 className="font-bold text-lg mb-1">
                        {currentAchievement.achievement.name}
                    </h3>
                    <p className="text-sm opacity-90 mb-2">
                        {currentAchievement.achievement.description}
                    </p>
                    
                    {/* Reward Info */}
                    {currentAchievement.achievement.reward && (
                        <div className="text-xs opacity-80 mb-2">
                            <span className="font-semibold">Reward: </span>
                            {currentAchievement.achievement.reward.type === 'title' && '👑 '}
                            {currentAchievement.achievement.reward.type === 'badge' && '🏆 '}
                            {currentAchievement.achievement.reward.type === 'cosmetic' && '✨ '}
                            {currentAchievement.achievement.reward.value}
                        </div>
                    )}

                    {/* Points */}
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold">
                            +{currentAchievement.points} points
                        </span>
                        <span className="opacity-80">
                            Total: {currentAchievement.totalPoints} points
                        </span>
                    </div>
                </div>

                {/* Progress bar animation for legendary achievements */}
                {currentAchievement.achievement.rarity === 'legendary' && (
                    <div className="mt-3 h-1 bg-black/20 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-yellow-300 rounded-full transform -translate-x-full animate-slide-right"
                            style={{
                                animation: 'slideRight 2s ease-out 0.5s forwards'
                            }}
                        />
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideRight {
                    from {
                        transform: translateX(-100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                .animate-slide-right {
                    animation: slideRight 2s ease-out 0.5s forwards;
                }
            `}</style>
        </div>
    );
};