import type { Geometry } from "./types";

/** Keep the complete rotated rectangle inside a 600-unit square plot. */
export function constrain<T extends Geometry>(item: T): T {
    let w = Math.max(70, Math.min(500, Number(item.w) || 180));
    let h = Math.max(60, Math.min(500, Number(item.h) || 150));
    const angle = Math.max(-180, Math.min(180, Number(item.angle) || 0));
    const radians = angle * Math.PI / 180;
    const c = Math.abs(Math.cos(radians));
    const s = Math.abs(Math.sin(radians));
    const scale = Math.min(1, 584 / (w * c + h * s), 584 / (w * s + h * c));
    w *= scale;
    h *= scale;
    const ex = (w * c + h * s) / 2;
    const ey = (w * s + h * c) / 2;
    const cx = Math.max(ex + 8, Math.min(592 - ex, (Number(item.x) || 0) + w / 2));
    const cy = Math.max(ey + 8, Math.min(592 - ey, (Number(item.y) || 0) + h / 2));
    return {
        ...item,
        w,
        h,
        angle,
        x: cx - w / 2,
        y: cy - h / 2,
    };
}
