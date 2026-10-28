import mongoose from "mongoose";
import { cleanJSON } from "./plugin.js";

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  projectId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  goal: { type: String, default: "" },
  state: { type: String, enum: ["future", "active", "closed"], default: "future" },
  start: { type: String, default: "" },
  end: { type: String, default: "" },
});
cleanJSON(schema);
export default mongoose.model("Sprint", schema);
