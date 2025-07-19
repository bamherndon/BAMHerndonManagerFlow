import express from "express";
import path from "path";
import { createServer } from "http";
import { readFileSync } from "fs";
import React from "react";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
const server = createServer(app);

app.use(express.static(path.resolve(__dirname, "public")));

app.get("*", (req, res) => {
  const appString = "<div id='root'></div>";
  const indexFile = path.resolve(__dirname, "public/index.html");
  const html = readFileSync(indexFile, "utf8").replace("<!-- APP -->", appString);
  res.send(html);
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on http://localhost:" + (process.env.PORT || 3000));
});