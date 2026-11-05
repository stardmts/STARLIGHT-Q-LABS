const osc = require("osc");
const { WebSocketServer } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "public");
const TYPES = {
  ".html": "text/html", ".png": "image/png", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".js": "text/javascript",
  ".css": "text/css", ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const full = path.join(PUBLIC, urlPath === "/" ? "index.html" : urlPath);
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

const udp = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 53001,            
  remoteAddress: "127.0.0.1",
  remotePort: 53000,
  metadata: true
});
udp.on("error", e => console.error("OSC error:", e.message));
udp.open();

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const { address, args = [] } = JSON.parse(raw);
      udp.send({
        address,
        args: args.map(a => typeof a === "number"
          ? { type: Number.isInteger(a) ? "i" : "f", value: a }
          : { type: "s", value: String(a) })
      });
    } catch (e) { console.error("Bad message:", e.message); }
  });
});

udp.on("message", (msg) => {
  const out = JSON.stringify({ address: msg.address, args: (msg.args || []).map(a => a.value) });
  wss.clients.forEach(c => c.readyState === 1 && c.send(out));
});

server.listen(8080, "127.0.0.1", () => console.log("Open http://localhost:8080"));