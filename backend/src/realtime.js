// Socket.IO: per-user rooms for notifications + a "sync" ping so other open tabs refresh live.
import { Server } from "socket.io";
import { verifyToken } from "./auth.js";
import User from "./models/User.js";
import Notification from "./models/Notification.js";

let io = null;

export function initRealtime(httpServer, origins) {
  io = new Server(httpServer, { cors: { origin: origins } });
  io.use(async (socket, next) => {
    try {
      const { id } = verifyToken(socket.handshake.auth?.token);
      if (!(await User.exists({ id }))) throw new Error("no user");
      socket.data.userId = id;
      socket.join(`user:${id}`);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  return io;
}

// save + push a notification to every listed user except the person who did the action
export async function notify(userIds, { text, issueId = null, byId = null }) {
  for (const userId of new Set(userIds.filter(Boolean))) {
    if (userId === byId) continue;
    const doc = await Notification.create({ id: Math.random().toString(36).slice(2, 10), userId, text, issueId, byId });
    io?.to(`user:${userId}`).emit("notification", doc.toJSON());
  }
}

export const broadcastSync = (byId) => io?.emit("sync", { by: byId });
