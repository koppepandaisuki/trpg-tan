import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverImageProps {
  src: string | null;
  alt: string;
  className?: string;
  /** Tailwind aspect-ratio utility class, defaults to 16:10. */
  aspect?: string;
}

/**
 * Display a product cover image.
 *
 * Uses a plain <img> on purpose — next/image would require remotePatterns
 * config keyed to the Supabase host, which we defer until Phase 9.
 * When src is null, render a neutral placeholder so the layout doesn't shift.
 */
export function CoverImage({
  src,
  alt,
  className,
  aspect = "aspect-[16/10]",
}: CoverImageProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md bg-muted",
        aspect,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" aria-hidden />
          <span className="sr-only">表紙画像なし</span>
        </div>
      )}
    </div>
  );
}
