/**
 * sync-indexes.mts — dry-run-by-default index sync for every RikuOS model
 * (ported from ShikksTracker's sync-indexes.mts, generalized to iterate all
 * models instead of one).
 *
 * WHY THIS EXISTS: Mongoose only ever CREATES missing indexes. It will not
 * alter or drop an index that already exists under the same name with
 * different options — the old, wrong index silently stays. Any index change
 * therefore ships together with a run of this script (CLAUDE.md).
 *
 * USAGE
 *   npm run migrate:indexes          # DRY RUN — shows the diff, changes nothing
 *   npm run migrate:indexes:apply    # actually applies it
 *
 * Dry run is the default deliberately: syncIndexes() drops ANY index on the
 * collection that is not declared in the schema. If someone added one by hand
 * in Atlas, it would go. Look at the diff before applying, and run it while
 * nothing else is touching the database.
 */

import mongoose from "mongoose";
import ApprovalItem from "../src/models/ApprovalItem.ts";
import "../src/models/approvals/FollowupDraftApproval.ts"; // registers the discriminator's paths
import "../src/models/approvals/TriageResponseApproval.ts"; // registers the discriminator's paths
import AgentRun from "../src/models/AgentRun.ts";
import PushSubscription from "../src/models/PushSubscription.ts";
import OsSettings from "../src/models/OsSettings.ts";
import LoginAttempt from "../src/models/LoginAttempt.ts";

const APPLY = process.argv.includes("--apply");

const MODELS = [ApprovalItem, AgentRun, PushSubscription, OsSettings, LoginAttempt];

interface IndexInfo {
  name?: string;
  key?: Record<string, unknown>;
  unique?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
}

function describe(ix: IndexInfo): string {
  const bits: string[] = [`keys=${JSON.stringify(ix.key ?? {})}`];
  if (ix.unique) bits.push("unique");
  if (ix.expireAfterSeconds !== undefined) bits.push(`ttl=${ix.expireAfterSeconds}s`);
  if (ix.partialFilterExpression) {
    bits.push(`partial=${JSON.stringify(ix.partialFilterExpression)}`);
  }
  return `${(ix.name ?? "(unnamed)").padEnd(34)} ${bits.join(" · ")}`;
}

async function main(): Promise<number> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "MONGODB_URI is not set.\n" +
        "This script reads it from .env.local via node --env-file. Check that\n" +
        ".env.local exists and defines MONGODB_URI."
    );
    return 1;
  }

  const redacted = uri.replace(/\/\/[^@]*@/, "//<credentials>@");
  console.log(`Connecting to: ${redacted}`);
  console.log(`Mode:          ${APPLY ? "APPLY (will modify indexes)" : "DRY RUN (no changes)"}`);

  // Short server-selection timeout so a wrong/unreachable URI fails in
  // seconds rather than hanging on the driver's default.
  // autoIndex MUST be false here. Mongoose defaults it to true, and it builds
  // missing indexes in the background as soon as the connection is established
  // -- which would make the DRY RUN mutate the database before anyone reads the
  // diff, defeating the entire point of this script. Index changes happen only
  // through the explicit syncIndexes() call below, under --apply.
  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10_000,
    autoIndex: false,
  });
  console.log(`Database:      ${mongoose.connection.db?.databaseName ?? "(unknown)"}`);

  let pendingChanges = 0;
  for (const model of MODELS) {
    console.log(`\n── ${model.modelName} ${"─".repeat(Math.max(0, 56 - model.modelName.length))}`);

    let before: IndexInfo[] = [];
    try {
      before = (await model.collection.indexes()) as IndexInfo[];
    } catch {
      // collection does not exist yet — treated as no indexes
    }
    if (before.length === 0) console.log("   (collection does not exist yet)");
    for (const ix of before) console.log("   " + describe(ix));

    const diff = (await model.diffIndexes()) as {
      toDrop: string[];
      toCreate: Record<string, unknown>[];
    };

    if (diff.toDrop.length === 0 && diff.toCreate.length === 0) {
      console.log("   in sync — nothing to do");
      continue;
    }

    pendingChanges++;
    for (const name of diff.toDrop) console.log(`   DROP    ${name}`);
    for (const spec of diff.toCreate) console.log(`   CREATE  ${JSON.stringify(spec)}`);

    if (APPLY) {
      const dropped = await model.syncIndexes();
      console.log(`   applied (syncIndexes dropped: ${JSON.stringify(dropped)})`);
    }
  }

  if (!APPLY && pendingChanges > 0) {
    console.log(
      "\nDry run only — nothing was changed.\n" +
        "Re-run with `npm run migrate:indexes:apply` to apply the changes above.\n" +
        "Note: syncIndexes() drops ANY index not declared in the schema, so if a\n" +
        "DROP above is something you added by hand in Atlas, stop and reconsider."
    );
  }
  if (pendingChanges === 0) console.log("\nAll collections already match their schemas.");

  await mongoose.disconnect();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(async (err) => {
    console.error("\nIndex sync failed:", err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
