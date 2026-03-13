import "dotenv/config";
import app from "./app.js";
import connectDb from "./config/db.js";

const PORT = process.env.PORT || 5500;

connectDb().then(() => {
  // Start server only after database connection succeeds.
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
