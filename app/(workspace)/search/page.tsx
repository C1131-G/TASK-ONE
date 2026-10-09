/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { SearchForm } from "@/components/workspace/search-form";

export const metadata: Metadata = { title: "Search | Metsys" };

const SearchPage = async () => {
  await connection();
  const result = await getPersonalWorkspaceAction({});
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Search</h1>
          <p>Find projects and tasks in Metsys.</p>
        </div>
      </div>
      <SearchForm
        recentSearches={result.ok ? result.data.recentSearches : []}
      />
    </div>
  );
};

export default SearchPage;
