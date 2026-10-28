import mongoose from "mongoose";
import { cleanJSON } from "./plugin.js";

export const ROLES = ["admin", "coadmin", "viewer"];

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  color: String,
  role: { type: String, enum: ROLES, default: "viewer" },
  passwordHash: { type: String, select: false },
});
cleanJSON(schema);
// never leak the hash, even if it was selected explicitly
schema.set("toJSON", {
  versionKey: false,
  transform: (_d, ret) => { delete ret._id; delete ret.passwordHash; return ret; },
});
export default mongoose.model("User", schema);
