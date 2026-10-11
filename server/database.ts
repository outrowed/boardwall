import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString
    = process.env.DATABASE_URL || "postgres://postgres@127.0.0.1:5432/boardwall";

export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export const palette = ["#f8e5a0", "#f1c9ce", "#d8dfbc", "#cfdaee", "#e4cff0"];

export { schema };
