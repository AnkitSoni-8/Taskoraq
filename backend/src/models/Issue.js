import mongoose from "mongoose";
import { cleanJSON } from "./plugin.js";

const comment = new mongoose.Schema(
  { id: String, userId: String, text: String, at: Number },
  { _id: false }
);

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  projectId: { type: String, required: true, index: true },
  num: { type: Number, required: true },
  type: { type: String, enum: ["Story", "Task", "Bug", "Epic"], default: "Task" },
  status: { type: String, enum: ["To Do", "In Progress", "In Review", "Done"], default: "To Do" },
  priority: { type: String, enum: ["Highest", "High", "Medium", "Low", "Lowest"], default: "Medium" },
  summary: { type: String, required: true },
  description: { type: String, default: "" },
  labels: { type: [String], default: [] },
  comments: { type: [comment], default: [] },
  attachments: {
    type: [new mongoose.Schema({ id: String, name: String, url: String, size: Number, mime: String, by: String, at: Number }, { _id: false })],
    default: [],
  },
  points: { type: Number, default: null },
  sprintId: { type: String, default: null },
  epicId: { type: String, default: null },
  assigneeId: { type: String, default: null },
  reporterId: { type: String, default: null },
  dueDate: { type: String, default: "" },
  startDate: { type: String, default: "" },
  createdAt: { type: Number, default: () => Date.now() },
  doneAt: { type: Number, default: null },
  order: { type: Number, default: () => Date.now() }, // board ordering
});
// list / board / backlog queries filter by project + status or sprint and sort by `order`
schema.index({ projectId: 1, status: 1, order: 1 });
schema.index({ projectId: 1, sprintId: 1, order: 1 });
schema.index({ projectId: 1, num: 1 });
schema.index({ assigneeId: 1 });
cleanJSON(schema);
export default mongoose.model("Issue", schema);
