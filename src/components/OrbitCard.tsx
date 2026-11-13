"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import type { Orbit } from "@/types";

interface OrbitCardProps {
  orbit: Orbit;
  size?: "lg" | "md" | "sm";
  showChildren?: boolean;
  childCount?: number;
}

const SIZES = { lg: 180, md: 140, sm: 110 };

export default memo(function OrbitCard({ orbit, size = "md", showChildren, childCount }: OrbitCardProps) {
  const router = useRouter();
  const S = SIZES[size];
  const pc = Math.min(orbit.entryCount || 0, 8);

  return (
    <div className="group relative flex flex-col items-center">
      <button
        onClick={() => router.push(`/orbits/${orbit.id}`)}
        className="relative flex items-center justify-center transition-transform hover:scale-105"
        style={{ width: S, height: S }}
      >
        {/* Orbit ring */}
        <div
          className="absolute rounded-full border"
          style={{ width: S * 0.78, height: S * 0.78, borderColor: orbit.color + "20" }}
        />
        {/* Orbiting dots */}
        {Array.from({ length: pc }).map((_, i) => {
          const a = (i / pc) * 360;
          const rad = S * 0.33;
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: size === "sm" ? 5 : 7,
                height: size === "sm" ? 5 : 7,
                background: orbit.color + "90",
                boxShadow: `0 0 5px ${orbit.color}50`,
                top: "calc(50% - 3px)",
                left: "calc(50% - 3px)",
                transform: `rotate(${a}deg) translateY(-${rad}px)`,
              }}
            />
          );
        })}
        {/* Central orb */}
        <div
          className="relative rounded-full flex items-center justify-center"
          style={{
            width: S * 0.33,
            height: S * 0.33,
            background: `radial-gradient(circle at 35% 30%, ${orbit.color}cc, ${orbit.color}60 50%, ${orbit.color}20)`,
            boxShadow: `0 0 ${S * 0.07}px ${orbit.color}70, 0 0 ${S * 0.14}px ${orbit.color}30`,
            animation: "pulse 2.5s ease-in-out infinite",
          }}
        >
          {/* Gloss highlight */}
          <div
            className="absolute rounded-full"
            style={{
              width: "28%",
              height: "18%",
              background: "rgba(255,255,255,0.3)",
              top: "18%",
              left: "15%",
              borderRadius: "50%",
              transform: "rotate(-25deg)",
            }}
          />
          <span
            className="text-white/90 font-bold z-10 drop-shadow-md"
            style={{ fontSize: size === "sm" ? 11 : size === "md" ? 13 : 15 }}
          >
            {orbit.entryCount}
          </span>
        </div>
      </button>
      {/* Label */}
      <div className="mt-2 text-center">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
          {orbit.name}
        </span>
        {showChildren && childCount !== undefined && childCount > 0 && (
          <span className="text-[10px] text-zinc-500 dark:text-zinc-500 ml-1">+{childCount}</span>
        )}
      </div>
    </div>
  );
});
