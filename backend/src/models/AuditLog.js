import mongoose from "mongoose";
import { cleanJSON } from "./plugin.js";

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String, userName: String, role: String,
  action: String,   // create | update | delete
  entity: String,   // issues, sprints, projects, users, ...
  entityId: String,
  summary: String,
  at: { type: Number, default: () => Date.now(), index: true },
});
cleanJSON(schema);
export default mongoose.model("AuditLog", schema);
