import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  size?: "sm" | "md" | "lg"
  color?: "primary" | "success" | "error" | "warning" | "info"
  variant?: "default" | "rounded" | "square"
  glow?: boolean
  pulse?: boolean
  indeterminate?: boolean
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ 
  className, 
  size = "md", 
  color = "primary", 
  variant = "default",
  glow = false,
  pulse = false,
  indeterminate = false,
  ...props 
}, ref) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  }

  const iconSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4", 
    lg: "h-5 w-5"
  }

  const variantClasses = {
    default: "rounded-sm",
    rounded: "rounded-full",
    square: "rounded-none"
  }

  const colorClasses = {
    primary: {
      border: "border-primary",
      checked: "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
      indeterminate: "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary"
    },
    success: {
      border: "border-green-500",
      checked: "data-[state=checked]:bg-green-500 data-[state=checked]:text-white data-[state=checked]:border-green-500",
      indeterminate: "data-[state=indeterminate]:bg-green-500 data-[state=indeterminate]:text-white data-[state=indeterminate]:border-green-500"
    },
    error: {
      border: "border-red-500",
      checked: "data-[state=checked]:bg-red-500 data-[state=checked]:text-white data-[state=checked]:border-red-500",
      indeterminate: "data-[state=indeterminate]:bg-red-500 data-[state=indeterminate]:text-white data-[state=indeterminate]:border-red-500"
    },
    warning: {
      border: "border-yellow-500",
      checked: "data-[state=checked]:bg-yellow-500 data-[state=checked]:text-white data-[state=checked]:border-yellow-500",
      indeterminate: "data-[state=indeterminate]:bg-yellow-500 data-[state=indeterminate]:text-white data-[state=indeterminate]:border-yellow-500"
    },
    info: {
      border: "border-blue-500",
      checked: "data-[state=checked]:bg-blue-500 data-[state=checked]:text-white data-[state=checked]:border-blue-500",
      indeterminate: "data-[state=indeterminate]:bg-blue-500 data-[state=indeterminate]:text-white data-[state=indeterminate]:border-blue-500"
    }
  }

  const glowClasses = glow ? {
    primary: "data-[state=checked]:shadow-lg data-[state=checked]:shadow-primary/25",
    success: "data-[state=checked]:shadow-lg data-[state=checked]:shadow-green-500/25",
    error: "data-[state=checked]:shadow-lg data-[state=checked]:shadow-red-500/25",
    warning: "data-[state=checked]:shadow-lg data-[state=checked]:shadow-yellow-500/25",
    info: "data-[state=checked]:shadow-lg data-[state=checked]:shadow-blue-500/25"
  }[color] : ""

  const pulseClasses = pulse ? "data-[state=checked]:animate-pulse" : ""

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        // Base styles
        "peer shrink-0 ring-offset-background transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "hover:scale-105 active:scale-95",
        // Size
        sizeClasses[size],
        // Variant
        variantClasses[variant],
        // Color
        colorClasses[color].border,
        colorClasses[color].checked,
        colorClasses[color].indeterminate,
        // Effects
        glowClasses,
        pulseClasses,
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        {indeterminate ? (
          <Minus className={iconSizeClasses[size]} />
        ) : (
          <Check className={iconSizeClasses[size]} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})

Checkbox.displayName = CheckboxPrimitive.Root.displayName

export default Checkbox