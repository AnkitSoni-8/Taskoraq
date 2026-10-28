import mongoose from "mongoose";
import { cleanJSON } from "./plugin.js";

const schema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ["admin", "coadmin", "viewer"], default: "viewer" },
  invitedBy: String,
  used: { type: Boolean, default: false },
  expiresAt: { type: Number, required: true },
  at: { type: Number, default: () => Date.now() },
});
cleanJSON(schema);
export default mongoose.model("Invite", schema);
