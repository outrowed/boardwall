import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./database";
import { users } from "./schema";

interface AdminAccountConfig {
    username: string;
    password: string;
    role: "admin";
}

const ACCOUNTS_FILE = resolve("accounts.json");

/**
 * Loads admin accounts from accounts.json.
 */
export function getAdminAccounts(): AdminAccountConfig[] {
    if (!existsSync(ACCOUNTS_FILE)) return [];

    try {
        const raw = readFileSync(ACCOUNTS_FILE, "utf-8");
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(
            (acc): acc is AdminAccountConfig =>
                Boolean(acc)
                && acc.role === "admin"
                && typeof acc.username === "string"
                && typeof acc.password === "string"
                && acc.username.trim().length >= 3
                && acc.password.length >= 8,
        ).map(acc => ({
            username: acc.username.trim().toLowerCase(),
            password: acc.password,
            role: acc.role,
        }));
    }
    catch (err) {
        console.error("Failed to parse accounts.json:", err);
        return [];
    }
}

/**
 * Checks whether a given username is designated as an admin via accounts.json.
 */
export function isConfiguredAdmin(username: string): boolean {
    const norm = username.trim().toLowerCase();
    return getAdminAccounts().some(acc => acc.username === norm);
}

/**
 * Returns a Set of all admin usernames in lowercase.
 */
export function getAdminUsernames(): Set<string> {
    return new Set(getAdminAccounts().map(acc => acc.username));
}

/**
 * Syncs all admin accounts defined in accounts.json into the database.
 * Admin accounts are created or their password hash/salt is updated.
 */
export async function syncAdminAccounts(): Promise<void> {
    const adminAccounts = getAdminAccounts();

    if (adminAccounts.length === 0) return;

    for (const admin of adminAccounts) {
        const existing = await db
            .select()
            .from(users)
            .where(eq(users.username, admin.username))
            .limit(1);

        const salt = randomBytes(16).toString("hex");
        const hash = scryptSync(admin.password, salt, 64).toString("hex");

        if (existing.length === 0) {
            console.log(`[Admin Sync] Creating admin account: ${admin.username}`);
            await db.insert(users).values({
                username: admin.username,
                password: hash,
                salt,
                plotDeleted: 0,
            });
        }
        else {
            // Update password & ensure plot is active
            await db
                .update(users)
                .set({
                    password: hash,
                    salt,
                    plotDeleted: 0,
                })
                .where(eq(users.id, existing[0].id));
        }
    }
}
