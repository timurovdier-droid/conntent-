import { json, requireUser, withHandler } from "@/lib/http";
import { quotaSnapshot } from "@/lib/services/quota";
import { queryMany } from "@/lib/db/client";

export const runtime = "nodejs";

export const GET = withHandler(async () => {
  const user = await requireUser();
  const quota = await quotaSnapshot(user.id);
  const rows = await queryMany(
    `SELECT operation, model_id, status, input_tokens, output_tokens, estimated_cost, created_at
     FROM usage_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
    [user.id],
  );
  return json({
    quota,
    events: rows.map((row) => ({
      operation: String(row.operation),
      modelId: String(row.model_id ?? ""),
      status: String(row.status),
      inputTokens: row.input_tokens == null ? null : Number(row.input_tokens),
      outputTokens: row.output_tokens == null ? null : Number(row.output_tokens),
      estimatedCost: row.estimated_cost == null ? null : Number(row.estimated_cost),
      createdAt: String(row.created_at),
    })),
  });
});
