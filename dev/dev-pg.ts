import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const DB_DIR = resolve("data/postgres");
const LOG_FILE = resolve("data/postgres/server.log");
const PORT = Number(process.env.PGPORT || 5432);
const USER = process.env.PGUSER || "postgres";
const PASSWORD = process.env.PGPASSWORD || "password";
const DATABASE = process.env.PGDATABASE || "boardwall";

// Path to pg_ctl and initdb inside @embedded-postgres binary package
const PG_CTL = resolve(
    "node_modules/.pnpm/@embedded-postgres+linux-x64@18.4.0-beta.17/node_modules/@embedded-postgres/linux-x64/native/bin/pg_ctl",
);
const INITDB = resolve(
    "node_modules/.pnpm/@embedded-postgres+linux-x64@18.4.0-beta.17/node_modules/@embedded-postgres/linux-x64/native/bin/initdb",
);

mkdirSync(DB_DIR, { recursive: true });

const action = process.argv[2];

if (action === "start") {
    console.log(`Starting PostgreSQL daemon on port ${PORT}...`);

    if (!existsSync(`${DB_DIR}/PG_VERSION`)) {
        console.log("Initializing database cluster with initdb...");
        execFileSync(INITDB, ["-D", DB_DIR, "-U", USER, "--auth=trust"], {
            stdio: "inherit",
        });
    }

    // Check if already running
    const status = spawnSync(PG_CTL, ["status", "-D", DB_DIR], {
        encoding: "utf-8",
    });
    if (status.status === 0) {
        console.log("PostgreSQL daemon is already running.");
    } else {
        execFileSync(
            PG_CTL,
            [
                "start",
                "-D",
                DB_DIR,
                "-l",
                LOG_FILE,
                "-w",
                "-o",
                `-p ${PORT}`,
            ],
            { stdio: "inherit" },
        );
        console.log("PostgreSQL daemon started successfully.");
    }

    // Ensure database exists
    const sql = postgres({
        host: "127.0.0.1",
        port: PORT,
        user: USER,
        password: PASSWORD,
        database: "postgres",
    });

    const exists = await sql`SELECT 1 FROM pg_database WHERE datname = ${DATABASE}`;
    if (exists.length === 0) {
        console.log(`Creating database "${DATABASE}"...`);
        await sql`CREATE DATABASE ${sql(DATABASE)}`;
    }
    await sql.end();

    console.log(`Ready! DATABASE_URL=postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`);
} else if (action === "stop") {
    console.log("Shutting down PostgreSQL daemon...");
    const status = spawnSync(PG_CTL, ["status", "-D", DB_DIR], {
        encoding: "utf-8",
    });
    if (status.status !== 0) {
        console.log("PostgreSQL is not running.");
    } else {
        execFileSync(PG_CTL, ["stop", "-D", DB_DIR, "-m", "fast", "-w"], {
            stdio: "inherit",
        });
        console.log("PostgreSQL daemon stopped.");
    }
} else if (action === "status") {
    spawnSync(PG_CTL, ["status", "-D", DB_DIR], { stdio: "inherit" });
} else {
    console.log("Usage: tsx dev/dev-pg.ts [start|stop|status]");
}
