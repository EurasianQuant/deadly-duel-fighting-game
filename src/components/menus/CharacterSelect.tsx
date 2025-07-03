import React, { useState } from "react";

import { Button } from "../ui/Button";
import { CharacterPortrait } from "../ui/CharacterPortrait";

interface Character {
    id: string;
    name: string;
    imageUrl?: string;
}

interface CharacterSelectProps {
    characters: Character[];
    onCharacterSelect?: (characterId: string) => void;
    onConfirm?: () => void;
    onBack?: () => void;
    selectedCharacter?: string;
    className?: string;
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({
    characters,
    onCharacterSelect,
    onConfirm,
    onBack,
    selectedCharacter,
    className = "",
}) => {
    const [hoveredCharacter, setHoveredCharacter] = useState<string | null>(
        null
    );

    const handleCharacterClick = (characterId: string) => {
        if (onCharacterSelect) {
            onCharacterSelect(characterId);
        }
    };

    return (
        <div
            className={`flex flex-col items-center justify-center min-h-screen ${className}`}
        >
            {/* Title */}
            <h1 className="font-arcade-header text-5xl mb-8 arcade-glow">
                CHOOSE YOUR FIGHTER
            </h1>

            {/* Character Grid */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {characters.map((character) => (
                    <CharacterPortrait
                        key={character.id}
                        characterId={character.id}
                        characterName={character.name}
                        imageUrl={character.imageUrl}
                        selected={
                            selectedCharacter === character.id ? "p1" : null
                        }
                        onClick={() => handleCharacterClick(character.id)}
                        onMouseEnter={() => setHoveredCharacter(character.id)}
                        onMouseLeave={() => setHoveredCharacter(null)}
                    />
                ))}
            </div>

            {/* Character Info */}
            {(selectedCharacter || hoveredCharacter) && (
                <div className="game-panel mb-8 min-w-80">
                    <h3 className="font-arcade-header text-2xl mb-4">
                        {
                            characters.find(
                                (c) =>
                                    c.id ===
                                    (hoveredCharacter || selectedCharacter)
                            )?.name
                        }
                    </h3>
                    <p className="font-arcade-body text-lg">Ready to fight!</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
                {onBack && (
                    <Button variant="ui" onClick={onBack}>
                        BACK
                    </Button>
                )}
                {onConfirm && (
                    <Button
                        variant="ui"
                        onClick={onConfirm}
                        disabled={!selectedCharacter}
                    >
                        FIGHT
                    </Button>
                )}
            </div>

            {/* Instructions */}
            <div className="font-arcade-body text-lg mt-8 text-center opacity-70">
                <p>SELECT A CHARACTER TO CONTINUE</p>
            </div>
        </div>
    );
};

