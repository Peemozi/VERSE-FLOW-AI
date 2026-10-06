import { useEffect } from "react";
import { DashboardPage } from "@/pages/DashboardPage";
import { useAppStore } from "@/stores/app-store";

export function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <DashboardPage />;
}
