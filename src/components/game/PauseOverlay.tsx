import { useEffect, useState, useRef } from "react";
import EventBus from "@/lib/EventBus";

interface PauseOverlayProps {
  isVisible: boolean;
  onResume: () => void;
  onMainMenu: () => void;
}

export function PauseOverlay({ isVisible, onResume, onMainMenu }: PauseOverlayProps) {
  const [selectedOption, setSelectedOption] = useState<"resume" | "mainmenu">("resume");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    // Focus the overlay when it becomes visible for accessibility
    if (overlayRef.current) {
      overlayRef.current.focus();
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          setSelectedOption("resume");
          break;
        case "ArrowDown":
        case "KeyS":
          setSelectedOption("mainmenu");
          break;
        case "Enter":
        case "Space":
          if (selectedOption === "resume") {
            onResume();
          } else {
            onMainMenu();
          }
          break;
        case "Escape":
          onResume(); // ESC resumes the game
          break;
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isVisible, selectedOption, onResume, onMainMenu]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Game paused menu"
    >
      <div 
        className="rounded-lg shadow-2xl" 
        style={{ 
          width: '500px', 
          padding: '2.5rem',
          backgroundColor: 'var(--color-arcade-bg)',
          border: `4px solid var(--color-arcade-yellow)`,
          boxShadow: `0 0 20px rgba(251, 191, 36, 0.3)`
        }}
      >
        <h2 
          className="font-arcade-header text-center mb-8 tracking-wider"
          style={{ 
            fontSize: 'var(--font-size-3xl)',
            color: 'var(--color-arcade-yellow)'
          }}
        >
          GAME PAUSED
        </h2>
        
        <div className="space-y-4">
          <button
            className={`w-full px-6 py-4 font-arcade-header border-2 transition-all duration-200 tracking-wide ${
              selectedOption === "resume" ? "transform scale-105" : ""
            }`}
            style={{
              fontSize: 'var(--font-size-lg)',
              backgroundColor: selectedOption === "resume" ? 'var(--color-arcade-yellow)' : 'transparent',
              color: selectedOption === "resume" ? 'var(--color-arcade-black)' : 'var(--color-arcade-white)',
              borderColor: selectedOption === "resume" ? 'var(--color-arcade-yellow)' : 'var(--color-arcade-gray)',
              boxShadow: selectedOption === "resume" ? '0 4px 12px rgba(251, 191, 36, 0.4)' : 'none'
            }}
            onClick={onResume}
            onMouseEnter={() => setSelectedOption("resume")}
          >
            RESUME GAME
          </button>
          
          <button
            className={`w-full px-6 py-4 font-arcade-header border-2 transition-all duration-200 tracking-wide ${
              selectedOption === "mainmenu" ? "transform scale-105" : ""
            }`}
            style={{
              fontSize: 'var(--font-size-lg)',
              backgroundColor: selectedOption === "mainmenu" ? 'var(--color-arcade-yellow)' : 'transparent',
              color: selectedOption === "mainmenu" ? 'var(--color-arcade-black)' : 'var(--color-arcade-white)',
              borderColor: selectedOption === "mainmenu" ? 'var(--color-arcade-yellow)' : 'var(--color-arcade-gray)',
              boxShadow: selectedOption === "mainmenu" ? '0 4px 12px rgba(251, 191, 36, 0.4)' : 'none'
            }}
            onClick={onMainMenu}
            onMouseEnter={() => setSelectedOption("mainmenu")}
          >
            MAIN MENU
          </button>
        </div>
        
        <div 
          className="mt-8 text-center font-arcade-body tracking-wide"
          style={{ 
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-arcade-gray)'
          }}
        >
          Use WASD/Arrows to navigate • ENTER to select • ESC to resume
        </div>
      </div>
    </div>
  );
}