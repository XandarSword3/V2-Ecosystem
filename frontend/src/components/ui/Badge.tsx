import * as React from "react"
import { cn } from "@/lib/cn"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "glass"
  size?: "sm" | "md" | "lg"
}

export function Badge({ 
  className, 
  variant = "default",
  size = "md",
  ...props 
}: BadgeProps) {
  const variants = {
    default: "bg-primary-500/15 text-primary-700 dark:text-primary-300 border-primary-200/50 dark:border-primary-700/30 backdrop-blur-sm",
    secondary: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/30 backdrop-blur-sm",
    destructive: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-700/30 backdrop-blur-sm",
    outline: "bg-transparent text-slate-700 dark:text-slate-300 border-slate-300/60 dark:border-slate-600/60",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-700/30 backdrop-blur-sm",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-700/30 backdrop-blur-sm",
    info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/30 backdrop-blur-sm",
    glass: "bg-white/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 border-white/40 dark:border-slate-700/40 backdrop-blur-xl shadow-sm",
  }

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm",
  }

  const baseStyles = cn(
    "inline-flex items-center rounded-full border font-semibold",
    "transition-all duration-300",
    "focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2"
  )

  return (
    <div className={cn(baseStyles, variants[variant], sizes[size], className)} {...props} />
  )
}
