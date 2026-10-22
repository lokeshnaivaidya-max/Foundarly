"use client";

import { useEffect, useId, useState } from "react";
import { motion } from "framer-motion";
import * as opentype from "opentype.js";
import { cn } from "@/lib/utils";

export interface SignatureProps {
  /** Text to generate signature for */
  text?: string;
  /** Color of the signature path */
  color?: string;
  /** Font size of the signature */
  fontSize?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Delay before animation starts in seconds */
  delay?: number;
  /** Additional CSS classes */
  className?: string;
  /** Only animate when in view */
  inView?: boolean;
  /** Only animate once */
  once?: boolean;
  /** Custom font URL to load */
  fontUrl?: string;
  /** Loop animation when used in continuous loading screens */
  repeat?: boolean;
}

export function Signature({
  text = "Foundarly",
  color = "#F5A623",
  fontSize = 32,
  duration = 3,
  delay = 0,
  className,
  inView = false,
  once = true,
  fontUrl,
  repeat = false,
}: SignatureProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [width, setWidth] = useState<number>(300);
  const [animationCycle, setAnimationCycle] = useState<number>(0);
  const height = fontSize * 3; // Give plenty of vertical space
  const horizontalPadding = fontSize * 0.1;
  const topMargin = fontSize * 1.5; // Shift down
  const baseline = topMargin;
  const rawId = useId();
  const maskId = `signature-reveal-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}-${animationCycle}`;

  // Font loading with support for opentype.js v1 (load) and v2 (parse arrayBuffer)
  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        let font: opentype.Font | null = null;
        const fontPaths = fontUrl
          ? [fontUrl]
          : [
              "/LastoriaBoldRegular.otf",
              "./LastoriaBoldRegular.otf",
              "https://www.componentry.fun/LastoriaBoldRegular.otf",
            ];

        for (const path of fontPaths) {
          try {
            // First try modern fetch + parse (works in opentype.js 2.x and browsers)
            if (typeof fetch === "function") {
              const res = await fetch(path);
              if (res.ok) {
                const buffer = await res.arrayBuffer();
                font = opentype.parse(buffer);
                if (font) break;
              }
            }
          } catch {
            // Try opentype.load fallback if available
            try {
              const opentypeModule = opentype as unknown as {
                load?: (p: string, cb: (err: unknown, f: opentype.Font) => void) => void;
              };
              if (typeof opentypeModule.load === "function") {
                font = await new Promise<opentype.Font>((resolve, reject) => {
                  opentypeModule.load?.(path, (err, loadedFont) => {
                    if (err || !loadedFont) reject(err);
                    else resolve(loadedFont);
                  });
                });
                if (font) break;
              }
            } catch {
              // Try next path
            }
          }
        }

        if (!font) {
          throw new Error("Font could not be loaded from any path");
        }

        if (isCancelled) return;

        let x = horizontalPadding;
        const newPaths: string[] = [];

        for (const char of text) {
          const glyph = font.charToGlyph(char);
          const path = glyph.getPath(x, baseline, fontSize);
          newPaths.push(path.toPathData(3));

          const advanceWidth = glyph.advanceWidth ?? font.unitsPerEm;
          x += advanceWidth * (fontSize / font.unitsPerEm);
        }

        if (!isCancelled) {
          setPaths(newPaths);
          setWidth(Math.max(x + horizontalPadding, 100));
        }
      } catch (error) {
        console.error("Signature component font load error:", error);
        if (!isCancelled) {
          setPaths([]);
          setWidth(text.length * fontSize * 0.6);
        }
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [text, fontSize, baseline, horizontalPadding, fontUrl]);

  // Optional periodic loop for continuous loading screens
  useEffect(() => {
    if (!repeat || once) return;
    const totalCycleTime = (duration + text.length * 0.15 + 1.2) * 1000;
    const interval = setInterval(() => {
      setAnimationCycle((c) => c + 1);
    }, totalCycleTime);
    return () => clearInterval(interval);
  }, [repeat, once, duration, text.length]);

  const variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { pathLength: 1, opacity: 1 },
  };

  if (paths.length === 0) {
    // Elegant fallback while font is loading
    return (
      <div
        className={cn(
          "flex items-center justify-center font-serif italic font-bold tracking-wider select-none animate-pulse",
          className
        )}
        style={{ color, fontSize: `${fontSize * 0.8}px`, minHeight: `${height}px` }}
      >
        {text}
      </div>
    );
  }

  return (
    <motion.svg
      key={`${paths.length}-${animationCycle}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={cn("text-foreground overflow-visible", className)}
      initial="hidden"
      whileInView={inView ? "visible" : undefined}
      animate={inView ? undefined : "visible"}
      viewport={{ once }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          {paths.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              stroke="white"
              strokeWidth={fontSize * 0.22}
              fill="none"
              variants={variants}
              transition={{
                pathLength: {
                  delay: delay + i * 0.18,
                  duration,
                  ease: "easeInOut",
                },
                opacity: {
                  delay: delay + i * 0.18 + 0.01,
                  duration: 0.01,
                },
              }}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </mask>
      </defs>

      {paths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={2}
          fill="none"
          variants={variants}
          transition={{
            pathLength: {
              delay: delay + i * 0.18,
              duration,
              ease: "easeInOut",
            },
            opacity: {
              delay: delay + i * 0.18 + 0.01,
              duration: 0.01,
            },
          }}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="butt"
          strokeLinejoin="round"
        />
      ))}

      <g mask={`url(#${maskId})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill={color} />
        ))}
      </g>
    </motion.svg>
  );
}

export default Signature;
