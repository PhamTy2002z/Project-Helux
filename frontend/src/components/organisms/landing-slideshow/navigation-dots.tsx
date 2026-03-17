type NavigationDotsProps = {
  total: number;
  active: number;
  onDotClick: (index: number) => void;
};

export default function NavigationDots({
  total,
  active,
  onDotClick,
}: NavigationDotsProps) {
  return (
    <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 gap-2">
      {Array.from({ length: total }, (_, index) => (
        <button
          key={index}
          type="button"
          aria-label={`Go to slide ${index + 1}`}
          aria-pressed={index === active}
          onClick={() => onDotClick(index)}
          className={`touch-manipulation rounded-full transition-[width,background-color,opacity] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
            index === active
              ? "h-2 w-6 bg-white"
              : "h-2 w-2 bg-white/40 hover:bg-white/70"
          }`}
        />
      ))}
    </div>
  );
}
