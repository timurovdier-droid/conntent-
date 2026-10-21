import { migrate } from "@/lib/db/migrate";

migrate()
  .then(() => {
    console.log("Миграции применены.");
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Миграция не выполнена.");
    process.exit(1);
  });
