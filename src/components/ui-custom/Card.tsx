
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  hover?: boolean;
  border?: boolean;
  padding?: "none" | "small" | "medium" | "large";
  variant?: "default" | "dark" | "black" | "gradient" | "elevated";
  glow?: boolean;
  interactive?: boolean;
}

const Card = ({
  children,
  className,
  glass = false,
  hover = false,
  border = true,
  padding = "medium",
  variant = "default",
  glow = false,
  interactive = false,
  ...props
}: CardProps) => {
  const paddingClasses = {
    none: "",
    small: "p-3",
    medium: "p-6",
    large: "p-8",
  };

  const variantClasses = {
    default: "bg-card text-card-foreground",
    dark: "bg-slate-800 text-white",
    black: "bg-slate-900 text-white",
    gradient: "bg-gradient-to-br from-card to-card/80 text-card-foreground",
    elevated: "bg-card text-card-foreground shadow-xl",
  };

  return (
    <div
      className={cn(
        "rounded-lg shadow-sm transition-all duration-300",
        variantClasses[variant],
        border && "border border-border",
        glass && "glassmorphism backdrop-blur-sm",
        hover && "hover:shadow-md hover:-translate-y-1",
        interactive && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        glow && "shadow-lg shadow-primary/10 hover:shadow-primary/20",
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
