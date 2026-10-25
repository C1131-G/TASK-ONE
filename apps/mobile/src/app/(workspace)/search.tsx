import { Effect } from "effect";
import { useRouter } from "expo-router";

import { SearchScreen } from "@/features/workspace/domain-list-screen";
import { searchProgram } from "@/features/workspace/domain-queries";
import { useApi } from "@/runtime/api-hooks";

export default function Route() {
  const api = useApi();
  const router = useRouter();

  return (
    <SearchScreen
      onHit={(hit) => router.push(hit.kind === "project" ? "/projects" : "/tasks")}
      search={(query) => (api === null ? Effect.succeed({ rows: [] }) : searchProgram(api, query))}
    />
  );
}
