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
          onClick={() => onDotClick(index)}
          className={`rounded-full transition-all duration-300 ${
            index === active ? "h-2 w-6 bg-white" : "h-2 w-2 bg-white/40"
          }`}
        />
      ))}
    </div>
  );
}
