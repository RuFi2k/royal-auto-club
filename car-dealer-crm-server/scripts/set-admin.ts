/**
 * Usage: npx ts-node scripts/set-admin.ts <user-email>
 * Sets the Firebase custom claim { role: "admin" } on the given user.
 * Run once per admin user. The user must log out and back in for the new
 * claim to appear in their token.
 */
import * as dotenv from "dotenv";
dotenv.config();

import { admin } from "../src/lib/firebase-admin";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx ts-node scripts/set-admin.ts <email>");
    process.exit(1);
  }

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { role: "admin" });
  console.log(`✓ Set role=admin for ${email} (uid: ${user.uid})`);
  console.log("  The user must sign out and back in for the change to take effect.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
