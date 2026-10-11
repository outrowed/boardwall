import type { WallElement } from "../src/types";
import { constrain } from "../src/geometry";
import { palette } from "./database";

/** Validate content at the API boundary; only safe browser-supported URLs are stored. */
export function validateElement(body: WallElement) {
    if (!["note", "image", "video", "link", "audio"].includes(body.type)) throw new Error("Unsupported element type");

    const text = String(body.text || "").slice(0, 4000);
    const url = String(body.url || "");

    if (body.type !== "note") {
        const validData = /^data:(image\/(png|jpeg|gif|webp)|video\/(mp4|webm)|audio\/(mpeg|ogg|wav|mp4));base64,[A-Za-z0-9+/=]+$/.test(url);

        if (!validData && !/^https?:\/\//i.test(url)) throw new Error("Use an HTTP(S) URL or supported uploaded media");

        if (url.length > 8_000_000) throw new Error("Media is too large (maximum 5 MB)");
    }

    for (const key of ["x", "y", "w", "h", "angle"] as const) if (!Number.isFinite(body[key])) throw new Error("Invalid element geometry");

    const z = Number.isFinite(body.z) ? Math.max(1, Math.min(9000, Math.round(Number(body.z)))) : 1;

    return {
        ...constrain({
            type: body.type,
            text,
            url,
            color: palette.includes(body.color || "") ? body.color : palette[0],
            x: body.x,
            y: body.y,
            w: body.w,
            h: body.h,
            angle: body.angle,
        }),
        z,
    };
}
