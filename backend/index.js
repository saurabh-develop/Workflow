import express from "express";
import "dotenv/config";

const app = express();

const PORT = process.env.PORT || 8001;

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Hello from backend");
});

app.listen(PORT, () => {
  console.log("Server is listening to the port: ", PORT);
});
