import fs from "fs";
import path from "path";

const src = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", "DejaVuSans.ttf");
const destDir = path.join(process.cwd(), "public", "fonts");
const dest = path.join(destDir, "DejaVuSans.ttf");

if (fs.existsSync(src)) {
  fs.mkdirSync(destDir, { recursive: true });
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
}
