/**
 * resolve-action.mts — resolve an ApprovalItem parked as `needs_verification`.
 *
 * `needs_verification` means the outward action MAY have taken effect. There is
 * deliberately no button for it: the only safe resolution starts with a human
 * checking the actual far side by hand — WHICH far side depends on the item's
 * type: a `followup-draft` item means the contact's lane in ShikksTracker; a
 * `triage-response` item (P6) means the Messenger thread itself, since its
 * action is sending a reply, not creating a draft. This script prints the
 * item's type before you decide, and the note it records is worded for that
 * type rather than assuming ShikksTracker either way.
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
import "../src/models/approvals/TriageResponseApproval.ts";

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
        "  done   the action worked — a ShikksTracker draft exists, or the Messenger reply\n" +
        "         was sent, depending on the item's type (this script names which one to\n" +
        "         check once you give it a valid --id)\n" +
        "  failed nothing happened (no draft, no reply; Retry is then safe)"
    );
    return 1;
  }

  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 10_000 });
  console.log(`Database: ${mongoose.connection.db?.databaseName ?? "(unknown)"}`);

  // Read-only, before the guarded write: which far side to check depends on
  // the item's type, and the note the write records below is worded for it.
  const existing = await ApprovalItem.findById(id).select("type").lean();
  const farSide = existing?.type === "triage-response" ? "the Messenger thread" : "ShikksTracker";
  if (existing) {
    console.log(`Item ${id} is type "${existing.type}" — verify against ${farSide} before deciding.`);
  }

  // Guarded: only a parked item moves, so this can never overwrite a live result.
  const updated = await ApprovalItem.findOneAndUpdate(
    { _id: id, actionStatus: "needs_verification" },
    {
      $set: {
        actionStatus: as,
        actionAt: new Date(),
        actionError: `Resolved by hand as "${as}" after checking ${farSide}.`,
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
