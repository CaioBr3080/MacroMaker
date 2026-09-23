import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(projectRoot, "out");
const stagingDirectory = resolve(outputDirectory, ".package");
const packagedModuleDirectory = resolve(stagingDirectory, "macro-maker");
const archivePath = resolve(outputDirectory, "macro-maker.zip");

const packageEntries = [
  "module.json",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "src",
  "templates",
  "styles",
  "lang",
  "schemas",
  "examples",
];

function assertInside(parent, target) {
  const pathFromParent = relative(parent, target);
  const escapesParent =
    pathFromParent === "" ||
    pathFromParent === ".." ||
    pathFromParent.startsWith(`..${sep}`) ||
    isAbsolute(pathFromParent);

  if (escapesParent) {
    throw new Error(`Caminho de pacote inseguro: ${target}`);
  }
}

function createArchive() {
  if (process.platform === "win32") {
    return spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Compress-Archive -LiteralPath $env:MM_PACKAGE_SOURCE -DestinationPath $env:MM_PACKAGE_DESTINATION -CompressionLevel Optimal -Force",
      ],
      {
        env: {
          ...process.env,
          MM_PACKAGE_SOURCE: packagedModuleDirectory,
          MM_PACKAGE_DESTINATION: archivePath,
        },
        stdio: "inherit",
      },
    );
  }

  return spawnSync("zip", ["-qr", archivePath, "macro-maker"], {
    cwd: stagingDirectory,
    stdio: "inherit",
  });
}

assertInside(outputDirectory, stagingDirectory);
assertInside(outputDirectory, archivePath);

await mkdir(outputDirectory, { recursive: true });
await rm(stagingDirectory, { recursive: true, force: true });
await rm(archivePath, { force: true });

try {
  await mkdir(packagedModuleDirectory, { recursive: true });

  for (const entry of packageEntries) {
    await cp(resolve(projectRoot, entry), resolve(packagedModuleDirectory, entry), {
      recursive: true,
    });
  }

  const archiveResult = createArchive();

  if (archiveResult.error) {
    throw archiveResult.error;
  }

  if (archiveResult.status !== 0) {
    throw new Error(`O compactador terminou com o código ${archiveResult.status}.`);
  }
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}

const archiveStats = await stat(archivePath);
const sizeInMegabytes = (archiveStats.size / 1024 / 1024).toFixed(2);
console.log(`Pacote criado em out/macro-maker.zip (${sizeInMegabytes} MB).`);
