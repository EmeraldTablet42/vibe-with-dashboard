export type DashboardSnapshot = Awaited<
  ReturnType<typeof import("@/lib/db/queries").getDashboardSnapshot>
>;

export type DashboardCard = DashboardSnapshot["cards"][number];
export type DashboardRun = DashboardSnapshot["runs"][number];
export type DashboardDecision = DashboardSnapshot["decisions"][number];
export type DashboardEvent = DashboardSnapshot["events"][number];

