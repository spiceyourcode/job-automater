"use client";

import { useTheme } from "@/components/theme-provider";
import { useHydrated } from "@/lib/use-hydrated";
import LightRays from "./LightRays";

/** Theme-aware LightRays backdrop shared by the auth pages. */
export function AuthLightRays() {
  const { resolvedTheme } = useTheme();
  const mounted = useHydrated();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <LightRays
        raysOrigin="top-center"
        raysColor="#ffffff"
        raysSpeed={0.6}
        lightSpread={0.7}
        rayLength={2.4}
        rayDensity={0.9}
        raySharpness={0.4}
        glow={0.5}
        haze={0.2}
        intensity={0.55}
        fadeDistance={1.1}
        saturation={1.1}
        followMouse
        mouseInfluence={0.08}
        cursorShadow
        clickPulse
        noiseAmount={0.02}
        distortion={0.1}
        lightMode={mounted && resolvedTheme === "light"}
        maxDevicePixelRatio={1.5}
        style={{}}
      />
    </div>
  );
}
