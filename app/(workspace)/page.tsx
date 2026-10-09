import type { Metadata } from "next";
import { Suspense } from "react";

import { WorkspaceHome } from "@/components/workspace/workspace-home";

export const metadata: Metadata = { title: "Home | Metsys" };

const HomeContent = async ({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) => {
  const params = await searchParams;
  const rawTaskView =
    typeof params.taskView === "string" ? params.taskView : "";
  const taskView = ["upcoming", "overdue", "completed"].includes(rawTaskView)
    ? (rawTaskView as "upcoming" | "overdue" | "completed")
    : "upcoming";

  return <WorkspaceHome taskView={taskView} />;
};

const HomePage = ({ searchParams }: PageProps<"/">) => (
  <Suspense
    fallback={
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h1 className="font-heading text-xl font-semibold">
            Preparing your workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Loading your dashboard…
          </p>
        </section>
      </div>
    }
  >
    <HomeContent searchParams={searchParams} />
  </Suspense>
);

export default HomePage;
