import {
    pgTable,
    serial,
    varchar,
    text,
    integer,
    bigint,
    jsonb,
    timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { WallElement } from "../src/types";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 24 }).notNull().unique(),
    password: text("password").notNull(),
    salt: text("salt").notNull(),
    plotDeleted: integer("plot_deleted").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
    token: varchar("token", { length: 64 }).primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expires: bigint("expires", { mode: "number" }).notNull(),
});

export const elements = pgTable("elements", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<WallElement>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Drizzle relations for type-safe relational querying
export const usersRelations = relations(users, ({ many }) => ({
    sessions: many(sessions),
    elements: many(elements),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));

export const elementsRelations = relations(elements, ({ one }) => ({
    user: one(users, {
        fields: [elements.userId],
        references: [users.id],
    }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ElementRecord = typeof elements.$inferSelect;
export type NewElementRecord = typeof elements.$inferInsert;
