import { writeFileSync } from "node:fs";
import { buildSchema } from "./schema";

const path = new URL("../schema.json", import.meta.url);

writeFileSync(path, `${JSON.stringify(buildSchema(), null, "\t")}\n`, "utf8");
console.log(`Generated ${path.pathname}`);
