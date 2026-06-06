import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  /** Kept for API compatibility — no longer rendered visually */
  icon?: ReactNode;
  endContent?: ReactNode;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  endContent,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400/60"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className={cn(
            "w-full border-b bg-transparent pb-2.5 text-[15px] font-light text-white placeholder-white/20 transition-colors focus:outline-none",
            endContent ? "pr-7" : "pr-0",
            error
              ? "border-red-400/50 focus:border-red-400/80"
              : "border-white/[0.16] focus:border-blue-400/60",
          )}
        />
        {endContent && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-white/25">
            {endContent}
          </span>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400/80">
          <CircleAlert className="size-3 shrink-0" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
