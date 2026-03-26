import { ButtonHTMLAttributes } from "react";
import Spinner from "./Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-accent hover:bg-accent-hover text-white shadow-glow-sm active:scale-95",
    secondary:
      "bg-bg-3 hover:bg-bg-4 text-text border border-border active:scale-95",
    ghost: "hover:bg-bg-2 text-text-muted hover:text-text active:scale-95",
    danger:
      "bg-error/10 hover:bg-error/20 text-error border border-error/20 active:scale-95",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}
