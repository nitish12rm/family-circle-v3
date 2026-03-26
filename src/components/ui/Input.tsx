import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-muted">{label}</label>
      )}
      <input
        {...props}
        className={`w-full bg-bg-2 border ${
          error ? "border-error" : "border-border"
        } rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-text-faint
        focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
        transition-colors ${className}`}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-muted">{label}</label>
      )}
      <textarea
        {...props}
        className={`w-full bg-bg-2 border ${
          error ? "border-error" : "border-border"
        } rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-text-faint
        focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
        transition-colors resize-none ${className}`}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
