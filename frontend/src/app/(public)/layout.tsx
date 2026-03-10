import type { ReactNode } from "react";

import { PublicAuthProvider } from "@/components/providers/PublicAuthProvider";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicAuthProvider>{children}</PublicAuthProvider>;
}
