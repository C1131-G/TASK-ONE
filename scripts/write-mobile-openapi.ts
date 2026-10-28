import { writeFileSync } from "node:fs";

import { buildOpenApiDocument } from "../src/server/api/contract";

// Writes the contract the app team reads. Run it after changing a route; a
// backend test fails while the file and the code disagree.
const target = new URL("../docs/mobile-openapi.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
process.stdout.write("Wrote docs/mobile-openapi.json\n");
