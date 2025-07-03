import React, { useEffect, useMemo, useState } from "react";

import { Button } from "../ui/Button";

interface MainMenuProps {
    onStartArcade?: () => void;
    onStartOnline?: () => void;
    onShowLeaderboard?: () => void;
    onShowSettings?: () => void;
    className?: string;
}

interface MenuOption {
    label: string;
    action: () => void;
    disabled?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
    onStartArcade,
    onStartOnline,
    onShowLeaderboard,
    onShowSettings,
    className = "",
}) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const menuOptions: MenuOption[] = useMemo(
        () => [
            {
                label: "ARCADE MODE",
                action: onStartArcade || (() => {}),
                disabled: !onStartArcade,
            },
            {
                label: "ONLINE PVP",
                action: () => {
                    // Show coming soon message instead of launching online mode
                    alert(
                        "Online PVP is coming soon! Stay tuned for multiplayer battles."
                    );
                },
                disabled: false,
            },
            {
                label: "LEADERBOARD",
                action: onShowLeaderboard || (() => {}),
                disabled: !onShowLeaderboard,
            },
            {
                label: "SETTINGS",
                action: onShowSettings || (() => {}),
                disabled: !onShowSettings,
            },
        ],
        [onStartArcade, onStartOnline, onShowLeaderboard, onShowSettings]
    );

    // Keyboard navigation
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            switch (event.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    event.preventDefault();
                    setSelectedIndex(
                        (prev) =>
                            (prev - 1 + menuOptions.length) % menuOptions.length
                    );
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    event.preventDefault();
                    setSelectedIndex((prev) => (prev + 1) % menuOptions.length);
                    break;
                case "Enter":
                case " ":
                    event.preventDefault();
                    {
                        const selectedOption = menuOptions[selectedIndex];
                        if (!selectedOption.disabled) {
                            selectedOption.action();
                        }
                    }
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [selectedIndex, menuOptions]);

    return (
        <div
            className={`flex flex-col items-center justify-center min-h-screen ${className}`}
        >
            {/* Game Title */}
            <h1 className="font-arcade-header text-6xl mb-16 arcade-glow">
                DEADLY DUEL
            </h1>

            {/* Menu Options */}
            <div className="flex flex-col gap-4">
                {menuOptions.map((option, index) => (
                    <Button
                        key={option.label}
                        variant="main-menu"
                        onClick={option.action}
                        disabled={option.disabled}
                        className={selectedIndex === index ? "active" : ""}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>

            {/* Navigation Instructions */}
            <div className="font-arcade-body text-lg mt-16 text-center opacity-70">
                <p>USE ARROW KEYS OR WASD TO NAVIGATE</p>
                <p>PRESS ENTER OR SPACE TO SELECT</p>
            </div>
        </div>
    );
};

