// Private admin setup (run on the server, never over HTTP):
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=long-password ADMIN_NAME="Your Name" npm run create-admin
// Creates the admin, or promotes the account if the email already exists.
import "../src/env.js";
import { defaultMongoUri } from "../src/dbUri.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.js";

const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name = "Admin" } = process.env;
if (!email || !password || password.length < 8) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars). ADMIN_NAME is optional.");
  process.exit(1);
}
await mongoose.connect(process.env.MONGO_URI || (await defaultMongoUri()), { serverSelectionTimeoutMS: 5000 });
const passwordHash = await bcrypt.hash(password.slice(0, 72), 10);
const existing = await User.findOne({ email: email.toLowerCase().trim() });
if (existing) {
  existing.role = "admin"; existing.passwordHash = passwordHash;
  await existing.save();
  console.log(`Promoted ${existing.email} to admin and reset the password.`);
} else {
  const u = await User.create({ id: Math.random().toString(36).slice(2, 9), name, email, role: "admin", color: "#0C66E4", passwordHash });
  console.log(`Created admin ${u.email}`);
}
await mongoose.disconnect();
