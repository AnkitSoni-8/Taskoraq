import mongoose from "mongoose";
import { cleanJSON } from "./plugin.js";

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  issueId: { type: String, default: null },
  byId: { type: String, default: null },
  read: { type: Boolean, default: false },
  at: { type: Number, default: () => Date.now(), index: true },
});
cleanJSON(schema);
export default mongoose.model("Notification", schema);
