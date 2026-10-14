import type { Metadata } from "next";

import { listAllEmployees } from "@/features/people/people-queries";

const memberMetadata = async (employeeId: string): Promise<Metadata> => {
  const result = await listAllEmployees();
  const employee = result.ok
    ? result.data.find((item) => item.id === employeeId)
    : undefined;
  return { title: `${employee?.name ?? "Member profile"} | Metsys` };
};

export { memberMetadata };
