"use client";

import { useEffect, useRef } from "react";

import Hls from "hls.js";

type HlsVideoProps = {
  src: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function HlsVideo({ src, className, style }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let cleanupNative: (() => void) | undefined;

    if (Hls.isSupported()) {
      const hls = new Hls({ autoStartLoad: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
      return () => hls.destroy();
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      const onLoadedMetadata = () => {
        void video.play().catch(() => undefined);
      };
      video.src = src;
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      cleanupNative = () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
    }

    return cleanupNative;
  }, [src]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
      style={style}
    />
  );
}
