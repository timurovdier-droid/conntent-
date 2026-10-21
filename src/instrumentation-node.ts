import { migrate } from "@/lib/db/migrate";

export async function registerNode() {
  await migrate();
}
