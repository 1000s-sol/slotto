/**
 * Brand PNGs must use a plain <img>: next/image optimization can flatten alpha onto black.
 */
export function BrandPng({
  src,
  alt,
  width,
  height,
  className,
  priority,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : undefined}
      style={{ colorScheme: "light" }}
      className={["bg-transparent [background:none]", className].filter(Boolean).join(" ")}
    />
  );
}
