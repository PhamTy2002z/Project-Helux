"use client";

import { useEffect, useRef } from "react";

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

      const hls = new Hls({ autoStartLoad: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, playVideo);
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
      preload="metadata"
      className={className}
      style={style}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
