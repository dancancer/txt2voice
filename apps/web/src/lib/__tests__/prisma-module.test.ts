import fs from "fs";
import path from "path";

import prisma, { Decimal } from "@/lib/prisma";

describe("prisma module bridge", () => {
  it("avoids export-star re-exports from the generated CommonJS client", () => {
    const prismaModulePath = path.resolve(__dirname, "../prisma.ts");
    const source = fs.readFileSync(prismaModulePath, "utf8");

    expect(source).not.toContain("export * from");
    expect(source).not.toContain("import * as PrismaGenerated");
  });

  it("keeps app routes from importing the generated prisma runtime directly", () => {
    const appDir = path.resolve(__dirname, "../../app");
    const recursiveEntries = fs.readdirSync(appDir, {
      recursive: true,
    }) as string[];
    const routeFiles = recursiveEntries
      .filter((entry) => entry.endsWith("/route.ts"))
      .map((entry) => path.join(appDir, entry));

    for (const routeFile of routeFiles) {
      const source = fs.readFileSync(routeFile, "utf8");

      expect(source).not.toMatch(/import\s+[^;]*from\s+["']@\/generated\/prisma["']/);
    }
  });

  it("keeps explicit decimal runtime export and default client exports available", () => {
    expect(Decimal).toBeDefined();
    expect(prisma).toBeDefined();
  });
});
