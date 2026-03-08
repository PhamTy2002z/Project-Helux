"use client";

import { useEffect, useRef } from "react";

type HlsVideoProps = {
  src: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function HlsVideo({ src, className, style }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mergedStyle: React.CSSProperties = {
    ...style,
    filter: `${style?.filter ? `${style.filter} ` : ""}contrast(1.08) saturate(1.08)`,
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let isDisposed = false;
    let hlsCleanup: (() => void) | undefined;
    let nativeCleanup: (() => void) | undefined;

    const playVideo = () => {
      void video.play().catch(() => undefined);
    };

    const setupVideo = async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener("loadedmetadata", playVideo);
        nativeCleanup = () => video.removeEventListener("loadedmetadata", playVideo);
        return;
      }

      const { default: Hls } = await import("hls.js");
      if (isDisposed || !Hls.isSupported()) {
        return;
      }

      const hls = new Hls({
        autoStartLoad: true,
        capLevelToPlayerSize: true,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.8,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const highestLevel = data.levels.length - 1;
        const startupLevel = Math.max(0, highestLevel - 1);
        // Start near-high quality to avoid the initial blurry ramp-up.
        hls.startLevel = startupLevel;
        hls.nextLevel = startupLevel;
        playVideo();
      });
      hlsCleanup = () => hls.destroy();
    };

    void setupVideo();

    return () => {
      isDisposed = true;
      nativeCleanup?.();
      hlsCleanup?.();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      className={className}
      style={mergedStyle}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
