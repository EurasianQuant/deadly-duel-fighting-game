import {
    forwardRef,
    useEffect,
    useLayoutEffect,
    useRef,
} from "react";

import EventBus from "@/lib/EventBus";

import StartGame from "./game/main";

export interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface IProps {
    currentActiveScene?: (scene_instance: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
    function PhaserGame({ currentActiveScene }, ref) {
        const game = useRef<Phaser.Game | null>(null!);

        useLayoutEffect(() => {
            if (game.current === null) {
                // Add delay to ensure DOM is ready
                const timer = setTimeout(() => {
                    try {
                        game.current = StartGame("game-container");

                        if (typeof ref === "function") {
                            ref({ game: game.current, scene: null });
                        } else if (ref) {
                            ref.current = { game: game.current, scene: null };
                        }
                    } catch (error) {
                        console.error('Failed to start Phaser game:', error);
                    }
                }, 100);
                
                return () => {
                    clearTimeout(timer);
                };
            }

            return () => {
                if (game.current) {
                    game.current.destroy(true);
                    if (game.current !== null) {
                        game.current = null;
                    }
                }
            };
        }, [ref]);

        useEffect(() => {
            const handleSceneReady = (scene_instance: Phaser.Scene) => {
                if (
                    currentActiveScene &&
                    typeof currentActiveScene === "function"
                ) {
                    currentActiveScene(scene_instance);
                }

                if (typeof ref === "function") {
                    ref({ game: game.current, scene: scene_instance });
                } else if (ref) {
                    ref.current = {
                        game: game.current,
                        scene: scene_instance,
                    };
                }
            };

            const handleStartOnlineFight = () => {
                if (game.current) {
                    game.current.scene.start("OnlineFightScene");
                }
            };

            EventBus.on("current-scene-ready", handleSceneReady);
            EventBus.on("start-online-fight", handleStartOnlineFight);
            
            return () => {
                EventBus.off("current-scene-ready", handleSceneReady);
                EventBus.off("start-online-fight", handleStartOnlineFight);
            };
        }, [currentActiveScene, ref]);

        return (
            <div 
                id="game-container" 
                style={{ 
                    width: '100%', 
                    height: '100%',
                    position: 'relative',
                    imageRendering: 'auto' // Override any CSS image-rendering conflicts
                }}
            ></div>
        );
    }
);
