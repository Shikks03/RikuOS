/**
 * resolve-action.mts — resolve an ApprovalItem parked as `needs_verification`.
 *
 * `needs_verification` means the outward action MAY have taken effect. There is
 * deliberately no button for it: the only safe resolution starts with a human
 * checking the far side by hand — the contact's lane in ShikksTracker, which
 * is where every action type in this repo lands. This script prints the item's
 * type before you decide.
 *
 * It used to name a per-type far side, because `triage-response` items pointed
 * at a Messenger thread instead. That lane was deleted in S15 (2026-09-05);
 * `followup-draft` is the only discriminator left, so the wording is direct
 * again. Restore the per-type branch if a second action type ever ships.
 *
 *   The action worked      -> resolve as done
 *   Nothing happened        -> resolve as failed, then use the Retry button
 *                               in the queue
 *
 * USAGE
 *   npm run action:resolve -- --id <ApprovalItem _id> --as done
 *   npm run action:resolve -- --id <ApprovalItem _id> --as failed
 */

import mongoose from "mongoose";
import ApprovalItem from "../src/models/ApprovalItem.ts";
import "../src/models/approvals/FollowupDraftApproval.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<number> {
  const uri = process.env.MONGODB_URI;
  const id = arg("id");
  const as = arg("as");

  if (!uri) {
    console.error("MONGODB_URI is not set (read from .env.local via node --env-file).");
    return 1;
  }
  if (!id || (as !== "done" && as !== "failed")) {
    console.error(
      "Usage: npm run action:resolve -- --id <ApprovalItem _id> --as done|failed\n" +
        "  done   the action worked — a ShikksTracker draft exists\n" +
        "  failed nothing happened (no draft; Retry is then safe)"
    );
    return 1;
  }

  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 10_000 });
  console.log(`Database: ${mongoose.connection.db?.databaseName ?? "(unknown)"}`);

  // Read-only, before the guarded write: print the type so the human knows
  // what they are resolving.
  const existing = await ApprovalItem.findById(id).select("type").lean();
  if (existing) {
    console.log(`Item ${id} is type "${existing.type}" — verify against ShikksTracker before deciding.`);
  }

  // Guarded: only a parked item moves, so this can never overwrite a live result.
  const updated = await ApprovalItem.findOneAndUpdate(
    { _id: id, actionStatus: "needs_verification" },
    {
      $set: {
        actionStatus: as,
        actionAt: new Date(),
        actionError: `Resolved by hand as "${as}" after checking ShikksTracker.`,
      },
    },
    { new: true }
  );

  if (!updated) {
    console.error(`No item ${id} with actionStatus "needs_verification". Nothing changed.`);
    await mongoose.disconnect();
    return 1;
  }

  console.log(`Item ${id} is now actionStatus "${as}".`);
  if (as === "failed") console.log("Use the Retry button in the queue to run the action again.");
  await mongoose.disconnect();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(async (err) => {
    console.error("Resolve failed:", err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
