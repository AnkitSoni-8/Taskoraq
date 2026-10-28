import mongoose from "mongoose";
import { cleanJSON } from "./plugin.js";

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  key: { type: String, required: true, uppercase: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  lead: String,
  starred: { type: Boolean, default: false },
  counter: { type: Number, default: 0 },
  members: { type: [String], default: [] },
});
cleanJSON(schema);
export default mongoose.model("Project", schema);
