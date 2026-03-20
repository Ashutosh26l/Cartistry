import "dotenv/config";
import app from "./app.js";
import connectDb from "./config/db.js";
import { createServer } from "http";
import { initSocketServer } from "./realtime/socketServer.js";

const PORT = process.env.PORT || 5500;
const httpServer = createServer(app);

connectDb().then(() => {
  initSocketServer(httpServer);
  // Start server only after database connection succeeds.
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
