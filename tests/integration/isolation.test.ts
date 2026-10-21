import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "contentpilot-"));
process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "test.db").replaceAll("\\", "/")}`;
process.env.AUTH_SECRET = "test-secret-value-123";

describe("workspace isolation", () => {
  let repo: typeof import("@/lib/db/repo");

  beforeAll(async () => {
    const client = await import("@/lib/db/client");
    client.resetDbForTests();
    repo = await import("@/lib/db/repo");
    const { migrate } = await import("@/lib/db/migrate");
    await migrate();
  });

  it("does not return another user's project or document", async () => {
    const workspaceA = "workspace-a";
    const workspaceB = "workspace-b";
    await repo.insertUser({ id: "user-a", email: "a@example.com", passwordHash: "x", locale: "ru", isAdmin: false });
    await repo.insertUser({ id: "user-b", email: "b@example.com", passwordHash: "x", locale: "ru", isAdmin: false });
    await repo.insertWorkspace(workspaceA, "user-a", "A");
    await repo.insertWorkspace(workspaceB, "user-b", "B");
    await repo.insertProject({
      id: "project-b",
      workspaceId: workspaceB,
      title: "Чужой",
      task: {
        contentType: "social_post",
        platform: "instagram",
        goal: "leads",
        language: "ru",
        topic: "секрет",
        tone: "",
        audience: "",
        constraints: [],
        useKnowledgeBase: true,
      },
    });
    expect(await repo.findProject(workspaceA, "project-b")).toBeNull();
    await repo.insertDocument({
      id: "doc-b",
      workspaceId: workspaceB,
      title: "Прайс",
      sourceType: "note",
      mimeType: "text/plain",
      sizeBytes: 10,
      storageKey: null,
    });
    expect(await repo.findDocument(workspaceA, "doc-b")).toBeNull();
    expect(await repo.listDocuments(workspaceA)).toHaveLength(0);
  });
});
