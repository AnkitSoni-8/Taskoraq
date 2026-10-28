// Default MongoDB URI when MONGO_URI is not set. The database is called "taskoraq". If an older install already
// has data in a previous database ("sprintflow" or "jira-clone") and "taskoraq" is still empty, we keep using the
// old one, so existing accounts / issues / logins don't disappear after the rename.
import mongoose from "mongoose";

const BASE = "mongodb://127.0.0.1:27017";
const NAME = "taskoraq";
const LEGACY = ["sprintflow", "jira-clone"];

export async function defaultMongoUri() {
  let probe;
  try {
    probe = await mongoose.createConnection(`${BASE}/${NAME}`, { serverSelectionTimeoutMS: 2500 }).asPromise();
    if ((await probe.collection("users").estimatedDocumentCount()) === 0) {
      for (const old of LEGACY) {
        if ((await probe.useDb(old).collection("users").estimatedDocumentCount()) > 0) {
          console.log(`Using the existing "${old}" database (set MONGO_URI to change). Rename later with mongodump/mongorestore if you like.`);
          return `${BASE}/${old}`;
        }
      }
    }
  } catch { /* no MongoDB reachable here: the normal connect error handling explains it */ }
  finally { await probe?.close().catch(() => {}); }
  return `${BASE}/${NAME}`;
}
