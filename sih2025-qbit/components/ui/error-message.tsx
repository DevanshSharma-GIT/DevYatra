import React from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ErrorMessageProps {
  message: string;
  className?: string;
  variant?: "error" | "warning" | "info";
  onDismiss?: () => void;
}

export function ErrorMessage({ message, className, variant = "error", onDismiss }: ErrorMessageProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const variantStyles = {
    error: "bg-red-50 text-red-800 border-red-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border mb-4",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-center gap-3">
        <AlertCircle className={cn("h-5 w-5", {
          "text-red-500": variant === "error",
          "text-yellow-500": variant === "warning", 
          "text-blue-500": variant === "info"
        })} />
        <p className="text-sm">{message}</p>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-6 w-6 rounded-full hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
