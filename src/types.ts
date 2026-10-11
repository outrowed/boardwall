export interface Geometry {
    x: number;
    y: number;
    w: number;
    h: number;
    angle: number;
}

export type ElementType = "note" | "image" | "video" | "audio" | "link";

export interface WallElement extends Geometry {
    id?: number | string;
    type: ElementType;
    text: string;
    url?: string;
    color?: string;
    z?: number;
}

export interface User {
    id: number | string;
    username: string;
    isAdmin?: boolean;
}

export interface Plot extends User {
    elements: WallElement[];
    isOwner?: boolean;
}
