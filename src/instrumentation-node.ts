import { migrate } from "@/lib/db/migrate";

export async function registerNode() {
  try {
    await migrate();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "migrate_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}
