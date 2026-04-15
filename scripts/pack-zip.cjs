/**
 * `out/` を同梱し、購入者向け README 付き ZIP を `dist/` に生成する。
 * 先に `next build`（体験版は NEXT_PUBLIC_GAME_EDITION=demo）が完了していること。
 */
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));

function rmRf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

async function main() {
  const edition = process.argv[2] === "demo" ? "demo" : "full";
  const version = pkg.version;
  const outDir = path.join(root, "out");
  if (!fs.existsSync(path.join(outDir, "index.html"))) {
    console.error(
      "out/index.html がありません。先にビルドしてください（例: npm run pack:full）。",
    );
    process.exit(1);
  }

  const folderName =
    edition === "demo"
      ? `text-hacks-rpg-demo-browser-v${version}`
      : `text-hacks-rpg-full-browser-v${version}`;

  const distRoot = path.join(root, "dist");
  const stage = path.join(distRoot, folderName);
  rmRf(stage);
  fs.mkdirSync(stage, { recursive: true });

  fs.cpSync(outDir, stage, {
    recursive: true,
    dereference: true,
    filter: (src) => path.basename(src) !== ".DS_Store",
  });

  const buyerReadme = path.join(root, "docs", "BUYER_README.txt");
  fs.copyFileSync(buyerReadme, path.join(stage, "README.txt"));

  const copyIfExists = (fromRel, toName) => {
    const from = path.join(root, "docs", fromRel);
    if (fs.existsSync(from)) {
      const dest = path.join(stage, toName);
      fs.copyFileSync(from, dest);
      return dest;
    }
    return null;
  };

  copyIfExists("local-server.cmd", "local-server.cmd");
  copyIfExists("PLAY.bat", "PLAY.bat");
  const playMac = copyIfExists("PLAY.command", "PLAY.command");
  if (playMac) {
    try {
      fs.chmodSync(playMac, 0o755);
    } catch {
      /* Windows 等では無視 */
    }
  }

  const startBat = path.join(root, "docs", "START_windows.bat");
  if (fs.existsSync(startBat)) {
    fs.copyFileSync(startBat, path.join(stage, "START.bat"));
  }

  fs.mkdirSync(distRoot, { recursive: true });
  const zipPath = path.join(distRoot, `${folderName}.zip`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(stage, folderName);
    archive.finalize();
  });

  const stat = fs.statSync(zipPath);
  console.log(
    `ZIP 作成: ${zipPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
