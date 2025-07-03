import React from "react";

interface CharacterPortraitProps {
    characterId: string;
    characterName: string;
    imageUrl?: string;
    selected?: "p1" | "p2" | null;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    className?: string;
}

export const CharacterPortrait: React.FC<CharacterPortraitProps> = ({
    characterId,
    characterName,
    imageUrl,
    selected = null,
    onClick,
    onMouseEnter,
    onMouseLeave,
    className = "",
}) => {
    const selectedClass = selected ? `selected-${selected}` : "";

    return (
        <div
            className={`character-portrait ${selectedClass} ${className}`}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            data-character-id={characterId}
        >
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={characterName}
                    className="w-full h-full object-cover pixel-perfect"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center font-arcade-body text-lg">
                    {characterName}
                </div>
            )}
        </div>
    );
};

