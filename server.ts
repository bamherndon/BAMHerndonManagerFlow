import express from "express";
import path from "path";
import { createServer } from "http";
import { readFileSync } from "fs";
import React from "react";
import { renderToString } from "react-dom/server";
import { App } from "./src/App";

const app = express();
const server = createServer(app);

app.use(express.static(path.resolve(__dirname, "public")));

app.get("*", (req, res) => {
  const appString = renderToString(<App />);
  const indexFile = path.resolve(__dirname, "public/index.html");
  const html = readFileSync(indexFile, "utf8").replace("<!-- APP -->", appString);
  res.send(html);
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on http://localhost:" + (process.env.PORT || 3000));
});