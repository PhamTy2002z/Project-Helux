"use client";

import { useEffect, useRef } from "react";

type HlsVideoProps = {
  src: string;
  /** Mux poster URL or any image URL shown while video loads */
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function HlsVideo({ src, poster, className, style }: HlsVideoProps) {
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
        // Force highest quality from start — poster covers the load time
        const highestLevel = data.levels.length - 1;
        hls.startLevel = highestLevel;
        hls.nextLevel = highestLevel;
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
      poster={poster}
      className={className}
      style={mergedStyle}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
