const fs = require("fs");
const f = "app.js";
let c = fs.readFileSync(f, "utf8");
const marker = "function escapeHtml(text)";
const start = c.indexOf(marker);
if (start === -1) {
  console.log("marker not found");
  process.exit(1);
}
const end = c.indexOf("\n}\n", start);
if (end === -1) {
  console.log("end brace not found");
  process.exit(1);
}
const after = c.indexOf("\n", end + 2);
const finish = after === -1 ? c.length : after;
const replacement =
  "function escapeHtml(text) {\n" +
  "  const amp = '&' + 'amp;';\n" +
  '  const lt = "&" + "lt;";\n' +
  '  const gt = "&" + "gt;";\n' +
  '  const quot = "&" + "quot;";\n' +
  "  const apos = '&' + '#039;';\n" +
  '  return (text || "")\n' +
  "    .replace(/&/g, amp)\n" +
  "    .replace(/</g, lt)\n" +
  "    .replace(/>/g, gt)\n" +
  '    .replace(/"/g, quot)\n' +
  "    .replace(/'/g, apos);\n" +
  "}\n";
c = c.slice(0, start) + replacement + c.slice(finish);
fs.writeFileSync(f, c);
console.log("done");
