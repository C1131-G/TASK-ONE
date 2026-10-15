/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Report and follow bugs on your projects.",
  title: "Client portal | Metsys",
};

const Page = () => (
  <main className="page" id="portal-main">
    <h1>Client portal</h1>
  </main>
);

export default Page;
