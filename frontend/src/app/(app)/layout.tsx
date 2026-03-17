import type { ReactNode } from "react";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { GlobalLoader } from "@/components/ui/global-loader";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <GlobalLoader />
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
