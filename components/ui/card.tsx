import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
  variant?: "default" | "success" | "warning" | "error";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, noPadding = false, variant = "default", children, ...props }, ref) => {
    const variantStyles = {
      default: "bg-white dark:bg-gray-800",
      success: "bg-green-50 dark:bg-green-900/20",
      warning: "bg-yellow-50 dark:bg-yellow-900/20",
      error: "bg-red-50 dark:bg-red-900/20",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700",
          variantStyles[variant],
          noPadding ? "" : "p-6",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl font-bold text-gray-900 dark:text-white", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-4 pt-4 border-t border-gray-200 dark:border-gray-700", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
