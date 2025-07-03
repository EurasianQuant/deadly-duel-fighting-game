import React, { useState, useEffect } from "react";
import EventBus from "@/lib/EventBus";
import { solanaWalletService } from "@/services/solanaWalletService";

interface WalletStatusIndicatorProps {
    className?: string;
    size?: "small" | "medium" | "large";
}

export const WalletStatusIndicator: React.FC<WalletStatusIndicatorProps> = ({ 
    className = "", 
    size = "medium" 
}) => {
    const [walletState, setWalletState] = useState(solanaWalletService.getState());

    useEffect(() => {
        const handleWalletStateChange = (state: any) => {
            setWalletState(state);
        };

        // Listen for wallet state changes
        EventBus.on("wallet-state-changed", handleWalletStateChange);
        EventBus.on("wallet-connected", handleWalletStateChange);
        EventBus.on("wallet-disconnected", () => {
            setWalletState(solanaWalletService.getState());
        });

        return () => {
            EventBus.off("wallet-state-changed", handleWalletStateChange);
            EventBus.off("wallet-connected", handleWalletStateChange);
            EventBus.off("wallet-disconnected", handleWalletStateChange);
        };
    }, []);

    // Size configurations
    const sizeConfig = {
        small: {
            text: "text-xs",
            padding: "px-2 py-1",
            icon: "text-sm"
        },
        medium: {
            text: "text-sm",
            padding: "px-3 py-1.5",
            icon: "text-base"
        },
        large: {
            text: "text-base",
            padding: "px-4 py-2",
            icon: "text-lg"
        }
    };

    const config = sizeConfig[size];

    if (walletState.connected && walletState.publicKey) {
        // Connected state - show as Global Player
        const shortAddress = walletState.publicKey.slice(0, 4) + "..." + walletState.publicKey.slice(-4);
        
        return (
            <div className={`
                inline-flex items-center space-x-2 
                bg-blue-600/90 text-white rounded-lg 
                ${config.padding} ${className}
                backdrop-blur-sm border border-blue-400/30
                shadow-lg
            `}>
                <span className={`${config.icon}`}>🌐</span>
                <div className="flex flex-col">
                    <span className={`${config.text} font-semibold`}>Global Player</span>
                    <span className={`${config.text} opacity-75`}>{shortAddress}</span>
                </div>
            </div>
        );
    } else if (walletState.connecting) {
        // Connecting state
        return (
            <div className={`
                inline-flex items-center space-x-2 
                bg-yellow-600/90 text-white rounded-lg 
                ${config.padding} ${className}
                backdrop-blur-sm border border-yellow-400/30
                shadow-lg animate-pulse
            `}>
                <span className={`${config.icon}`}>🔄</span>
                <span className={`${config.text} font-semibold`}>Connecting...</span>
            </div>
        );
    } else {
        // Disconnected state - show as Local Player
        return (
            <div className={`
                inline-flex items-center space-x-2 
                bg-amber-600/90 text-white rounded-lg 
                ${config.padding} ${className}
                backdrop-blur-sm border border-amber-400/30
                shadow-lg
            `}>
                <span className={`${config.icon}`}>⭐</span>
                <div className="flex flex-col">
                    <span className={`${config.text} font-semibold`}>Local Player</span>
                    {walletState.error && (
                        <span className={`${config.text} opacity-75 text-red-200`}>
                            Connection Failed
                        </span>
                    )}
                </div>
            </div>
        );
    }
};