import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: "sm" | "md" | "lg"
  color?: "primary" | "success" | "error" | "warning" | "info"
  glow?: boolean
  pulse?: boolean
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = "md", color = "primary", glow = false, pulse = false, ...props }, ref) => {
  const sizeClasses = {
    sm: "h-5 w-9",
    md: "h-6 w-11", 
    lg: "h-7 w-13"
  }

  const thumbSizeClasses = {
    sm: "h-4 w-4 data-[state=checked]:translate-x-4",
    md: "h-5 w-5 data-[state=checked]:translate-x-5",
    lg: "h-6 w-6 data-[state=checked]:translate-x-6"
  }

  const colorClasses = {
    primary: "data-[state=checked]:bg-primary data-[state=checked]:shadow-primary/25",
    success: "data-[state=checked]:bg-green-500 data-[state=checked]:shadow-green-500/25",
    error: "data-[state=checked]:bg-red-500 data-[state=checked]:shadow-red-500/25",
    warning: "data-[state=checked]:bg-yellow-500 data-[state=checked]:shadow-yellow-500/25",
    info: "data-[state=checked]:bg-blue-500 data-[state=checked]:shadow-blue-500/25"
  }

  const glowClasses = glow ? "data-[state=checked]:shadow-lg" : ""
  const pulseClasses = pulse ? "data-[state=checked]:animate-pulse" : ""

  return (
    <SwitchPrimitives.Root
      className={cn(
        // Base styles
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
        "transition-all duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Unchecked state
        "data-[state=unchecked]:bg-input data-[state=unchecked]:hover:bg-muted",
        // Size
        sizeClasses[size],
        // Color
        colorClasses[color],
        // Effects
        glowClasses,
        pulseClasses,
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-background shadow-lg ring-0",
          "transition-transform duration-200 ease-in-out",
          "data-[state=unchecked]:translate-x-0",
          thumbSizeClasses[size]
        )}
      />
    </SwitchPrimitives.Root>
  )
})

Switch.displayName = SwitchPrimitives.Root.displayName

export default Switch