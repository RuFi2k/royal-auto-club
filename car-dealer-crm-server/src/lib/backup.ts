import { exec } from "child_process";
import fs from "fs";
import path from "path";

// On Windows set PG_DUMP_PATH in .env; in Docker pg_dump is on PATH by default
const PG_DUMP = process.env.PG_DUMP_PATH ?? "pg_dump";
const BACKUP_DIR = path.join(process.cwd(), "backups");
const RETAIN_DAYS = 7;

function parseDatabaseUrl(url: string) {
  const u = new URL(url.split("?")[0]); // strip query params like connection_limit
  return {
    host: u.hostname,
    port: u.port || "5432",
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1), // remove leading /
  };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(BACKUP_DIR)) {
    if (!file.endsWith(".dump")) continue;
    const filePath = path.join(BACKUP_DIR, file);
    const { mtimeMs } = fs.statSync(filePath);
    if (mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      console.log(`[backup] Deleted old backup: ${file}`);
    }
  }
}

export function runBackup(): Promise<string> {
  return new Promise((resolve, reject) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return reject(new Error("DATABASE_URL is not set"));

    const { host, port, user, password, database } = parseDatabaseUrl(dbUrl);

    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const filename = `backup_${timestamp()}.dump`;
    const filepath = path.join(BACKUP_DIR, filename);

    // -Fc = custom compressed format; restores with pg_restore
    const cmd = `"${PG_DUMP}" -h ${host} -p ${port} -U ${user} -Fc -d ${database} -f "${filepath}"`;

    const env = { ...process.env, PGPASSWORD: password };

    exec(cmd, { env }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`pg_dump failed: ${stderr || err.message}`));
        return;
      }
      pruneOldBackups();
      const sizeKb = Math.round(fs.statSync(filepath).size / 1024);
      console.log(`[backup] Created ${filename} (${sizeKb} KB)`);
      resolve(filepath);
    });
  });
}
