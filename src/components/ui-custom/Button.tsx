
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button as ShadcnButton } from "@/components/ui/button";
import { ButtonProps as ShadcnButtonProps } from "@/components/ui/button";

interface ButtonProps extends ShadcnButtonProps {
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  gradient?: boolean;
  loading?: boolean;
  color?: "primary" | "success" | "error" | "warning" | "info" | "gray";
  glow?: boolean;
  pulse?: boolean;
}

const Button = ({
  className,
  children,
  variant = "default",
  size = "default",
  icon,
  iconPosition = "left",
  gradient = false,
  loading = false,
  color,
  glow = false,
  pulse = false,
  disabled,
  ...props
}: ButtonProps) => {
  const isIconOnly = icon && !children;
  
  // Gradient styles
  const gradientClassName = gradient 
    ? "bg-gradient-to-r from-primary/90 to-primary hover:from-primary hover:to-primary/90 transition-all duration-300" 
    : "";
    
  // Color variants
  let colorClassName = "";
  if (color === "success") {
    colorClassName = "bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700";
  } else if (color === "error") {
    colorClassName = "bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700";
  } else if (color === "warning") {
    colorClassName = "bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600 hover:border-yellow-700";
  } else if (color === "info") {
    colorClassName = "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700";
  } else if (color === "gray") {
    colorClassName = "bg-slate-700 hover:bg-slate-800 text-white border-slate-700 hover:border-slate-800";
  } else if (color === "primary") {
    colorClassName = "bg-primary hover:bg-primary/90 text-primary-foreground border-primary hover:border-primary/90";
  }

  // Glow effect
  const glowClassName = glow 
    ? "shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow duration-300" 
    : "";

  // Pulse animation
  const pulseClassName = pulse ? "animate-pulse-slow" : "";

  return (
    <ShadcnButton
      className={cn(
        "font-medium tracking-tight rounded-md shadow-sm transition-all duration-300",
        "active:scale-[0.98] hover:scale-[1.02]",
        "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        gradient && variant === "default" ? gradientClassName : "",
        color && variant === "default" ? colorClassName : "",
        glowClassName,
        pulseClassName,
        isIconOnly && "flex items-center justify-center p-2",
        loading && "opacity-80 pointer-events-none cursor-not-allowed",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {children && <span>Carregando...</span>}
        </div>
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <span className={cn("mr-2", isIconOnly ? "mr-0" : "")}>{icon}</span>
          )}
          {children}
          {icon && iconPosition === "right" && (
            <span className="ml-2">{icon}</span>
          )}
        </>
      )}
    </ShadcnButton>
  );
};

export default Button;
