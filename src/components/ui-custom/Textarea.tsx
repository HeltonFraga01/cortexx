import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: "sm" | "md" | "lg"
  variant?: "default" | "outline" | "ghost"
  color?: "primary" | "success" | "error" | "warning" | "info"
  glow?: boolean
  resize?: "none" | "vertical" | "horizontal" | "both"
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const sizeClasses = {
  sm: "min-h-[60px] px-2 py-1 text-xs",
  md: "min-h-[80px] px-3 py-2 text-sm",
  lg: "min-h-[100px] px-4 py-3 text-base"
}

const variantClasses = {
  default: "border-input bg-background",
  outline: "border-2 bg-transparent",
  ghost: "border-transparent bg-transparent hover:bg-accent"
}

const colorClasses = {
  primary: "border-primary/50 focus:border-primary focus:ring-primary/20",
  success: "border-green-500/50 focus:border-green-500 focus:ring-green-500/20",
  error: "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
  warning: "border-yellow-500/50 focus:border-yellow-500 focus:ring-yellow-500/20",
  info: "border-blue-500/50 focus:border-blue-500 focus:ring-blue-500/20"
}

const glowClasses = {
  primary: "shadow-lg shadow-primary/25",
  success: "shadow-lg shadow-green-500/25",
  error: "shadow-lg shadow-red-500/25",
  warning: "shadow-lg shadow-yellow-500/25",
  info: "shadow-lg shadow-blue-500/25"
}

const resizeClasses = {
  none: "resize-none",
  vertical: "resize-y",
  horizontal: "resize-x",
  both: "resize"
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    className, 
    size = "md", 
    variant = "default", 
    color = "primary", 
    glow = false,
    resize = "vertical",
    leftIcon,
    rightIcon,
    ...props 
  }, ref) => {
    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-3 z-10 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          <textarea
            className={cn(
              "flex w-full rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
              sizeClasses[size],
              variantClasses[variant],
              colorClasses[color],
              resizeClasses[resize],
              glow && glowClasses[color],
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-3 z-10 flex items-center pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
      )
    }

    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          sizeClasses[size],
          variantClasses[variant],
          colorClasses[color],
          resizeClasses[resize],
          glow && glowClasses[color],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }