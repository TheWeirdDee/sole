"use client";

import { useEffect, useRef } from "react";

export function GrainOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId: number;
    const width = (canvas.width = 250);
    const height = (canvas.height = 250);

    const imgData = ctx.createImageData(width, height);
    const buffer32 = new Uint32Array(imgData.data.buffer);

    let frameCount = 0;

    function renderNoise() {
      frameCount++;
      // Render every 2 frames for classic analog film / TV static jitter
      if (frameCount % 2 === 0 && ctx) {
        const len = buffer32.length;
        for (let i = 0; i < len; i++) {
          // Generate crisp monochromatic grain particles
          const noise = Math.random() * 255;
          const alpha = Math.random() * 38 + 12; // visible tactile density
          buffer32[i] = ((alpha | 0) << 24) | ((noise | 0) << 16) | ((noise | 0) << 8) | (noise | 0);
        }
        ctx.putImageData(imgData, 0, 0);
      }
      frameId = requestAnimationFrame(renderNoise);
    }

    frameId = requestAnimationFrame(renderNoise);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
        opacity: 0.22,
        mixBlendMode: "multiply",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
