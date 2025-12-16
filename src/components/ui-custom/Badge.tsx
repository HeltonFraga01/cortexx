
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: ReactNode;
  variant?: "success" | "error" | "warning" | "info" | "default";
  pill?: boolean;
  glow?: boolean;
  pulse?: boolean;
  className?: string;
}

const Badge = ({
  children,
  variant = "default",
  pill = false,
  glow = false,
  pulse = false,
  className,
}: BadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-xs font-medium px-2 py-0.5 transition-all duration-200",
        pill ? "rounded-full" : "rounded",
        variant === "success" && "bg-green-500/90 text-white",
        variant === "error" && "bg-red-500/90 text-white",
        variant === "warning" && "bg-yellow-500/90 text-white",
        variant === "info" && "bg-blue-500/90 text-white",
        variant === "default" && "bg-gray-500/90 text-white",
        glow && variant === "success" && "shadow-[0_0_10px_rgba(34,197,94,0.5)]",
        glow && variant === "error" && "shadow-[0_0_10px_rgba(239,68,68,0.5)]",
        glow && variant === "warning" && "shadow-[0_0_10px_rgba(234,179,8,0.5)]",
        glow && variant === "info" && "shadow-[0_0_10px_rgba(59,130,246,0.5)]",
        pulse && "animate-pulse-slow",
        className
      )}
    >
      {children}
    </span>
  );
};

export default Badge;
