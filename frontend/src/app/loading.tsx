import { BrandLoader } from "@/components/atoms/BrandLoader";

export default function Loading() {
  return (
    <div
      data-cy="route-loader"
      className="flex min-h-screen items-center justify-center bg-app px-6"
    >
      <div className="flex flex-col items-center gap-4">
        <BrandLoader size={72} />
        <p className="text-sm text-muted">Loading VisgniteAI...</p>
      </div>
    </div>
  );
}
