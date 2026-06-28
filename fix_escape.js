const fs = require("fs");
const content = fs.readFileSync("app.js", "utf8");
const fixed = content.replace(
  /function escapeHtml\(text\) \{[^}]+\}/,
  `function escapeHtml(text) {
  return (text || "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "&#039;");
}`,
);
fs.writeFileSync("app.js", fixed);
console.log("Fixed");
