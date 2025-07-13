import React from "react";

interface HealthBarProps {
    currentHealth: number;
    maxHealth: number;
    playerName: string;
    className?: string;
    direction?: 'left' | 'right'; // Direction health bar decreases: left = left-to-right, right = right-to-left
}

export const HealthBar: React.FC<HealthBarProps> = ({
    currentHealth,
    maxHealth,
    playerName,
    className = "",
    direction = 'left',
}) => {
    // Ensure very small health values are treated as 0 to prevent UI artifacts
    const adjustedHealth = currentHealth < 0.01 ? 0 : currentHealth;
    const healthPercentage = Math.max(
        0,
        Math.min(100, (adjustedHealth / maxHealth) * 100)
    );

    const isRightDirection = direction === 'right';
    
    return (
        <div className={`w-full ${className}`}>
            <div className="player-name mb-1">{playerName}</div>
            <div className="health-bar-container">
                <div
                    className={`health-bar-fill ${currentHealth < maxHealth * 0.3 ? 'danger' : ''}`}
                    style={{ 
                        width: `${healthPercentage}%`,
                        ...(isRightDirection && {
                            marginLeft: 'auto',
                            transformOrigin: 'right center',
                        })
                    }}
                />
            </div>
        </div>
    );
};
