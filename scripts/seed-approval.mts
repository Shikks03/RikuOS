/**
 * seed-approval.mts — seeds one pending followup-draft ApprovalItem.
 *
 * P3's acceptance test uses this: the real producer (the chaser) is P4, and
 * P3 explicitly has no dependency on it — the queue is tested with manually
 * seeded items (ROADMAP.md P3).
 *
 * USAGE:  npm run seed:approval
 */

import mongoose from "mongoose";
import FollowupDraftApproval from "../src/models/approvals/FollowupDraftApproval.ts";

async function main(): Promise<number> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set (read from .env.local via node --env-file).");
    return 1;
  }

  await mongoose.connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 10_000 });
  console.log(`Database: ${mongoose.connection.db?.databaseName ?? "(unknown)"}`);

  const item = await FollowupDraftApproval.create({
    source: "manual",
    title: "Follow up: Sample Bakery",
    summary: "Replied 3 days ago asking about pricing; no answer has gone out yet.",
    staleAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    payload: {
      contactId: "seed-contact-1",
      contactName: "Sample Bakery",
      channel: "facebook",
      draftBody:
        "Hi po! Salamat sa pag-reply. Para po sa isang simpleng website na may menu at " +
        "contact form, nasa PHP 8k–12k po ang usual range. Pwede ko po kayong gawan ng " +
        "free mockup para makita niyo muna. Kailan po kayo free para sa quick chat?",
      replySnippet: "Magkano po ang website?",
    },
  });

  console.log(`Seeded pending ApprovalItem ${item._id}`);
  await mongoose.disconnect();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch(async (err) => {
    console.error("Seeding failed:", err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
