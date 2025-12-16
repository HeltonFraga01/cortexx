
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  variant?: "default" | "success" | "error" | "warning"
  size?: "sm" | "md" | "lg"
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", size = "md", leftIcon, rightIcon, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 px-2 py-1 text-sm",
      md: "h-10 px-3 py-2 text-base md:text-sm",
      lg: "h-12 px-4 py-3 text-lg"
    }

    const variantClasses = {
      default: "border-input focus-visible:ring-ring",
      success: "border-green-500 focus-visible:ring-green-500 focus-visible:border-green-500",
      error: "border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500",
      warning: "border-yellow-500 focus-visible:ring-yellow-500 focus-visible:border-yellow-500"
    }

    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex w-full rounded-lg border bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
              sizeClasses[size],
              variantClasses[variant],
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
      )
    }

    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-lg border bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
