import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  pendingText: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function SubmitButton({ pendingText, icon, children }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-1 w-full rounded-[5px] bg-white py-3 text-[12.5px] font-bold uppercase tracking-[0.08em] text-slate-900 shadow-none hover:bg-white/90 focus-visible:ring-white/40"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="size-3.5 animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-900" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}
