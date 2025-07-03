import React from "react";

interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: "main-menu" | "ui";
    disabled?: boolean;
    className?: string;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    onClick,
    variant = "main-menu",
    disabled = false,
    className = "",
}) => {
    const baseClasses = "btn-arcade";
    const variantClasses = variant === "main-menu" ? "btn-main-menu" : "btn-ui";

    return (
        <button
            className={`${baseClasses} ${variantClasses} ${className}`}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
};
