import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { getDashboardSnapshot } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const snapshot = await getDashboardSnapshot();

  return <DashboardApp initialSnapshot={snapshot} />;
}

