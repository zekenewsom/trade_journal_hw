"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number | null;
  onChange: (value: number) => void;
  max?: number;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function StarRating({
  value,
  onChange,
  max = 5,
  size = "md",
  readonly = false,
}: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(star)}
          className={cn(
            "transition-colors",
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
          )}
        >
          <Star
            className={cn(
              sizeClasses[size],
              star <= (value ?? 0)
                ? "fill-yellow-500 text-yellow-500"
                : "text-muted-foreground"
            )}
          />
        </button>
      ))}
      {value && (
        <span className="ml-2 text-sm text-muted-foreground">{value}/{max}</span>
      )}
    </div>
  );
}
