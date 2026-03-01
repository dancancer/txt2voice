// If I change, please update my header comment.
// input: function args/external deps
// output: utility/service exports
// pos: shared library
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
