import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq, and, gt, lt, sql as dSql } from "drizzle-orm";
import { db } from "./database";
import { users, sessions, elements } from "./schema";
import { validateElement } from "./validation";
import type { WallElement } from "../src/types";

interface SessionUser {
    id: number;
    username: string;
    isAdmin: boolean;
}

declare module "fastify" {
    interface FastifyRequest {
        sessionUser?: SessionUser;
    }
}

const allowedOrigins = new Set([
    "https://celery.tailf0d1c0.ts.net:8448",
    "http://127.0.0.1:5178",
    "http://localhost:5178",
]);

const adminNames = new Set(["taruna1"]);

const app = Fastify({
    logger: false,
    bodyLimit: 8_100_000,
});

await app.register(cookie);

// Security hooks: origin validation for mutations, no-store cache headers, user resolution
app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");

    if (req.method !== "GET" && req.headers.origin && !allowedOrigins.has(req.headers.origin)) {
        return reply.status(403).send({ error: "Origin mismatch" });
    }

    const token = req.cookies.session;

    if (token) {
        const found = await db
            .select({
                id: users.id,
                username: users.username,
            })
            .from(sessions)
            .innerJoin(users, eq(users.id, sessions.userId))
            .where(and(eq(sessions.token, token), gt(sessions.expires, Date.now())))
            .limit(1);

        if (found.length > 0) {
            req.sessionUser = {
                id: found[0].id,
                username: found[0].username,
                isAdmin: adminNames.has(found[0].username.toLowerCase()),
            };
        }
    }
});

// Error handling matching legacy format
app.setErrorHandler((error: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
    if (error.statusCode === 413) {
        return reply.status(413).send({ error: "Maximum upload size is 5 MB" });
    }

    const errorMsg = error.message || "";
    const isDbError = (error as Error & { code?: string }).code !== undefined;
    reply.status(error.statusCode || 400).send({
        error: isDbError ? "Unable to save. Please try again." : errorMsg,
    });
});

// Routes
app.get("/api/me", async (req) => {
    return { user: req.sessionUser || null };
});

app.get("/api/wall", async () => {
    const userList = await db
        .select({
            id: users.id,
            username: users.username,
        })
        .from(users)
        .where(eq(users.plotDeleted, 0))
        .orderBy(users.id);

    const allElements = await db
        .select({
            id: elements.id,
            userId: elements.userId,
            content: elements.content,
        })
        .from(elements)
        .orderBy(elements.id);

    const elementsByUser = new Map<number, typeof allElements>();

    for (const elem of allElements) {
        const list = elementsByUser.get(elem.userId) || [];
        list.push(elem);
        elementsByUser.set(elem.userId, list);
    }

    const plots = userList.map(u => ({
        id: u.id,
        username: u.username,
        elements: (elementsByUser.get(u.id) || []).map(e => ({
            ...e.content,
            id: e.id,
        })),
    }));

    return { plots };
});

app.post<{ Body: {
    username?: string;
    password?: string;
}; }>("/api/register", async (req, reply) => {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 128) {
        return reply.status(400).send({
            error: "Username: 3–24 letters, numbers or underscores. Password: 8–128 characters.",
        });
    }

    const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

    if (existing.length > 0) {
        return reply.status(409).send({ error: "That username already has a plot" });
    }

    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");

    const [newUser] = await db
        .insert(users)
        .values({
            username,
            password: hash,
            salt,
        })
        .returning({ id: users.id });

    // Clean expired sessions
    await db.delete(sessions).where(lt(sessions.expires, Date.now()));

    const sessionToken = randomBytes(32).toString("hex");
    await db.insert(sessions).values({
        token: sessionToken,
        userId: newUser.id,
        expires: Date.now() + 604800000,
    });

    const isSecure = req.headers.origin?.startsWith("https://") ?? false;
    reply.setCookie("session", sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 604800,
        secure: isSecure,
    });

    return {
        user: {
            id: newUser.id,
            username,
            isAdmin: adminNames.has(username.toLowerCase()),
        },
    };
});

app.post<{ Body: {
    username?: string;
    password?: string;
}; }>("/api/login", async (req, reply) => {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 128) {
        return reply.status(400).send({
            error: "Username: 3–24 letters, numbers or underscores. Password: 8–128 characters.",
        });
    }

    const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

    const account = existing[0];

    if (!account || !timingSafeEqual(Buffer.from(String(account.password), "hex"), scryptSync(password, String(account.salt), 64))) {
        return reply.status(401).send({ error: "Incorrect username or password" });
    }

    await db.delete(sessions).where(lt(sessions.expires, Date.now()));

    const sessionToken = randomBytes(32).toString("hex");
    await db.insert(sessions).values({
        token: sessionToken,
        userId: account.id,
        expires: Date.now() + 604800000,
    });

    const isSecure = req.headers.origin?.startsWith("https://") ?? false;
    reply.setCookie("session", sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 604800,
        secure: isSecure,
    });

    return {
        user: {
            id: account.id,
            username,
            isAdmin: adminNames.has(username.toLowerCase()),
        },
    };
});

app.post("/api/logout", async (req, reply) => {
    const token = req.cookies.session;

    if (token) {
        await db.delete(sessions).where(eq(sessions.token, token));
    }

    reply.setCookie("session", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    return { ok: true };
});

// Admin endpoints
app.get("/api/admin/users", async (req, reply) => {
    const user = req.sessionUser;

    if (!user) return reply.status(401).send({ error: "Sign in to edit your plot" });

    if (!user.isAdmin) return reply.status(403).send({ error: "Administrator access required" });

    const rows = await db
        .select({
            id: users.id,
            username: users.username,
            plotDeleted: users.plotDeleted,
            elementsCount: dSql<number>`count(distinct ${elements.id})::int`,
            sessionsCount: dSql<number>`count(distinct case when ${sessions.expires} > ${Date.now()} then ${sessions.token} end)::int`,
        })
        .from(users)
        .leftJoin(elements, eq(elements.userId, users.id))
        .leftJoin(sessions, eq(sessions.userId, users.id))
        .groupBy(users.id, users.username, users.plotDeleted)
        .orderBy(users.id);

    const result = rows.map(account => ({
        id: account.id,
        username: account.username,
        isAdmin: adminNames.has(account.username.toLowerCase()),
        plotDeleted: Boolean(account.plotDeleted),
        elements: account.elementsCount,
        sessions: account.sessionsCount,
    }));

    return { users: result };
});

app.post<{ Params: {
    id: string;
    action: string;
}; }>("/api/admin/users/:id/:action", async (req, reply) => {
    const user = req.sessionUser;

    if (!user) return reply.status(401).send({ error: "Sign in to edit your plot" });

    if (!user.isAdmin) return reply.status(403).send({ error: "Administrator access required" });

    const { id: rawId, action } = req.params;
    const id = Number(rawId);

    if (!["delete-plot", "restore-plot", "revoke-sessions"].includes(action)) {
        return reply.status(404).send({ error: "Not found" });
    }

    const check = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);

    if (check.length === 0) {
        return reply.status(404).send({ error: "Account not found" });
    }

    if (action === "revoke-sessions") {
        await db.delete(sessions).where(eq(sessions.userId, id));
    }
    else if (action === "delete-plot") {
        await db.transaction(async (tx) => {
            await tx.delete(elements).where(eq(elements.userId, id));
            await tx.update(users).set({ plotDeleted: 1 }).where(eq(users.id, id));
        });
    }
    else {
        await db.update(users).set({ plotDeleted: 0 }).where(eq(users.id, id));
    }

    return { ok: true };
});

app.get("/api/admin/stats", async (req, reply) => {
    const user = req.sessionUser;

    if (!user) return reply.status(401).send({ error: "Sign in to edit your plot" });

    if (!user.isAdmin) return reply.status(403).send({ error: "Administrator access required" });

    const [userCount] = await db.select({ count: dSql<number>`count(*)::int` }).from(users);
    const [elementCount] = await db.select({ count: dSql<number>`count(*)::int` }).from(elements);

    return {
        users: userCount.count,
        elements: elementCount.count,
    };
});

app.delete<{ Params: { id: string } }>("/api/plots/:id", async (req, reply) => {
    const user = req.sessionUser;

    if (!user) return reply.status(401).send({ error: "Sign in to edit your plot" });

    if (!user.isAdmin) return reply.status(403).send({ error: "Administrator access required" });

    const id = Number(req.params.id);
    await db.transaction(async (tx) => {
        await tx.delete(elements).where(eq(elements.userId, id));
        await tx.update(users).set({ plotDeleted: 1 }).where(eq(users.id, id));
    });

    return { ok: true };
});

// Elements endpoints
app.post<{ Body: WallElement & { plotId?: number } }>("/api/elements", async (req, reply) => {
    const user = req.sessionUser;

    if (!user) return reply.status(401).send({ error: "Sign in to edit your plot" });

    const body = req.body || ({} as WallElement);
    const plotId = Number(body.plotId ?? user.id);

    if (plotId !== Number(user.id) && !user.isAdmin) {
        return reply.status(403).send({ error: "You can only add to your own plot" });
    }

    const targetUser = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, plotId), eq(users.plotDeleted, 0)))
        .limit(1);

    if (targetUser.length === 0) {
        return reply.status(404).send({ error: "Plot not found" });
    }

    const [elemCount] = await db
        .select({ count: dSql<number>`count(*)::int` })
        .from(elements)
        .where(eq(elements.userId, plotId));

    if (elemCount.count >= 40) {
        return reply.status(400).send({ error: "Maximum 40 elements per plot" });
    }

    const validated = validateElement(body);
    const [inserted] = await db
        .insert(elements)
        .values({
            userId: plotId,
            content: validated,
        })
        .returning({ id: elements.id });

    return reply.status(201).send({
        element: {
            ...validated,
            id: inserted.id,
        },
    });
});

app.put<{
    Params: { id: string };
    Body: WallElement;
}>("/api/elements/:id", async (req, reply) => {
    const user = req.sessionUser;

    if (!user) return reply.status(401).send({ error: "Sign in to edit your plot" });

    const elementId = Number(req.params.id);
    const owned = await db
        .select({
            id: elements.id,
            userId: elements.userId,
        })
        .from(elements)
        .where(eq(elements.id, elementId))
        .limit(1);

    if (owned.length === 0) return reply.status(404).send({ error: "Element not found" });

    const isOwner = owned[0].userId === user.id;

    if (!isOwner && !user.isAdmin) {
        return reply.status(403).send({ error: "You can only edit your own elements" });
    }

    const validated = validateElement(req.body || ({} as WallElement));
    await db
        .update(elements)
        .set({ content: validated })
        .where(eq(elements.id, elementId));

    return { ok: true };
});

app.delete<{ Params: { id: string } }>("/api/elements/:id", async (req, reply) => {
    const user = req.sessionUser;

    if (!user) return reply.status(401).send({ error: "Sign in to edit your plot" });

    const elementId = Number(req.params.id);
    const owned = await db
        .select({
            id: elements.id,
            userId: elements.userId,
        })
        .from(elements)
        .where(eq(elements.id, elementId))
        .limit(1);

    if (owned.length === 0) return reply.status(404).send({ error: "Element not found" });

    const isOwner = owned[0].userId === user.id;

    if (!isOwner && !user.isAdmin) {
        return reply.status(403).send({ error: "You can only edit your own elements" });
    }

    await db.delete(elements).where(eq(elements.id, elementId));

    return { ok: true };
});

const port = Number(process.env.PORT || 3018);
await app.listen({
    port,
    host: "127.0.0.1",
});
console.log(`Boardwall API listening on ${port}`);
