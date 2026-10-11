import Button from "./Button";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { Plus, Image, StickyNote, Link, RotateCw, Expand, Sparkles, AudioLines, ArrowUpRight } from "lucide-react";
import type { ElementType, Plot as PlotData, WallElement } from "../types";
import { constrain } from "../geometry";
import styles from "./Plot.module.css";
interface ElementProps {
    item: WallElement;
    editable: boolean;
    selected: boolean;
    onSelect: (id: number | string | null) => void;
    onChange: (item: WallElement) => void;
    onSave: (item: WallElement) => void;
    onDelete: (item: WallElement) => void;
    onEdit: (item: WallElement) => void;
    plotRef: RefObject<HTMLDivElement | null>;
}
interface PlotProps extends Omit<ElementProps, "item" | "editable" | "selected" | "plotRef"> {
    plot: PlotData;
    mine: boolean;
    isOwner: boolean;
    index: number;
    selected: number | string | null;
    onAdd: (type: ElementType) => void;
    onDeletePlot?: () => void;
    onFront: (item: WallElement) => void;
}
const colors = ["#f8e5a0", "#f1c9ce", "#d8dfbc", "#cfdaee", "#e4cff0"];

function Element({ item, editable, selected, onSelect, onChange, onSave, onDelete, onEdit, plotRef }: ElementProps) {
    const dirty = useRef(false);
    const [menuPoint, setMenuPoint] = useState({
        x: 12,
        y: 12,
    });
    const menuRef = useRef<HTMLElement>(null);
    const [actionOpen, setActionOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const gesture = useRef<{
        mode: string;
        startX: number;
        startY: number;
        original: WallElement;
        latest: WallElement;
        cx: number;
        cy: number;
        bearing: number;
    } | null>(null);

    // Dismiss the context menu on outside press or Escape; clean up listeners on close.
    useEffect(() => {
        if (!actionOpen) return;

        function dismiss(event: globalThis.PointerEvent) {
            if (!menuRef.current?.contains(event.target as Node)) setActionOpen(false);
        }

        function dismissKey(event: KeyboardEvent) { if (event.key === "Escape") setActionOpen(false); }

        document.addEventListener("pointerdown", dismiss, true);
        document.addEventListener("keydown", dismissKey);

        return () => {
            document.removeEventListener("pointerdown", dismiss, true); document.removeEventListener("keydown", dismissKey);
        };
    }, [actionOpen]);

    function openMenu(x: number, y: number) {
        const bounds = plotRef.current?.getBoundingClientRect();

        if (!bounds) return;

        setMenuPoint({
            x: Math.max(4, Math.min(bounds.width - 180, x - bounds.left)),
            y: Math.max(4, Math.min(bounds.height - 170, y - bounds.top)),
        });
        setConfirmDelete(false);
        setActionOpen(true);
    }

    function start(event: PointerEvent<HTMLElement>, mode: string) {
        if (!editable || event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        onSelect(item.id ?? null);
        event.currentTarget.setPointerCapture(event.pointerId);
        const bounds = plotRef.current?.getBoundingClientRect();

        if (!bounds) return;

        const cx = bounds.left + (item.x + item.w / 2) * bounds.width / 600;
        const cy = bounds.top + (item.y + item.h / 2) * bounds.width / 600;
        gesture.current = {
            mode,
            startX: event.clientX,
            startY: event.clientY,
            original: item,
            latest: item,
            cx,
            cy,
            bearing: Math.atan2(event.clientY - cy, event.clientX - cx),
        };
    }

    function move(event: PointerEvent<HTMLElement>) {
        const g = gesture.current;

        if (!g) return;

        if (!plotRef.current) return;

        const scale = 600 / plotRef.current.getBoundingClientRect().width;
        const dx = (event.clientX - g.startX) * scale;
        const dy = (event.clientY - g.startY) * scale;
        const next = { ...g.original };

        if (g.mode === "move") {
            next.x += dx; next.y += dy;
        }

        if (g.mode === "resize") {
            next.w += dx; next.h += dy;
        }

        if (g.mode === "rotate") {
            const bearing = Math.atan2(event.clientY - g.cy, event.clientX - g.cx);
            const delta = Math.atan2(Math.sin(bearing - g.bearing), Math.cos(bearing - g.bearing));
            next.angle = ((g.original.angle + delta * 180 / Math.PI + 540) % 360) - 180;
        }

        g.latest = constrain(next);
        onChange(g.latest);
    }

    function finish() {
        if (!gesture.current) return;

        const next = gesture.current.latest;
        gesture.current = null;
        onSave(next);
    }

    const pointer = {
        onPointerMove: move,
        onPointerUp: finish,
        onPointerCancel: finish,
    };

    function handlePointerDown(event: PointerEvent<HTMLElement>) {
        if (!editable || event.button !== 0) return;

        event.stopPropagation();
        onSelect(item.id ?? null);
    }

    return (
        <section
            data-wall-element=""
            aria-label={`${item.type} element`}
            className={`wall-element ${selected ? "chosen" : ""} ${item.type === "note" ? "note" : "media-card"} ${editable ? "cursor-pointer" : ""}`}
            style={{
                left: `${item.x / 6}%`,
                top: `${item.y / 6}%`,
                width: `${item.w / 6}%`,
                height: `${item.h / 6}%`,
                transform: `rotate(${item.angle}deg)`,
                background: item.type === "note" ? item.color : "#fffdf8",
                zIndex: item.z ?? (Number(item.id) || 1),
            }}
            onPointerDown={handlePointerDown}
            onContextMenu={(event) => {
                if (editable) {
                    event.preventDefault(); onSelect(item.id ?? null); openMenu(event.clientX, event.clientY);
                }
            }}
        >
            {item.type === "note"
                ? (
                        <div className="note-container">
                            <div
                                className="note-window-bar"
                                title={editable ? "Drag window bar to move" : undefined}
                                onPointerDown={e => start(e, "move")}
                                {...pointer}
                            >
                                <span className="window-dots">
                                    <span />
                                    <span />
                                    <span />
                                </span>

                            </div>
                            <div className="note-body">
                                {editable
                                    ? (
                                            <textarea
                                                aria-label="Note text"
                                                className="note-textarea"
                                                value={item.text}
                                                maxLength={4000}
                                                placeholder="Write anything you like…"
                                                onChange={(e) => {
                                                    const updated = {
                                                        ...item,
                                                        text: e.target.value,
                                                    };
                                                    dirty.current = true;
                                                    onChange(updated);
                                                }}
                                                onBlur={() => {
                                                    if (dirty.current) {
                                                        dirty.current = false; onSave(item);
                                                    }
                                                }}
                                                onPointerDown={handlePointerDown}
                                            />
                                        )
                                    : (
                                            <div className="note-text">{item.text || "Your thoughts go here…"}</div>
                                        )}
                            </div>
                        </div>
                    )
                : item.type === "image"
                    ? (
                            <div
                                className="media-wrapper"
                                onPointerDown={e => start(e, "move")}
                                {...pointer}
                            >
                                <img src={item.url} alt={item.text || "Board image"} draggable="false" />
                                <span className="caption">{item.text}</span>
                            </div>
                        )
                    : item.type === "video"
                        ? (
                                <div className="media-wrapper">
                                    <div
                                        className="media-drag-strip"
                                        title={editable ? "Drag bar to move video" : undefined}
                                        onPointerDown={e => start(e, "move")}
                                        {...pointer}
                                    >
                                        <span>VIDEO</span>
                                    </div>
                                    <video src={item.url} controls playsInline><track kind="captions" /></video>
                                </div>
                            )
                        : item.type === "audio"
                            ? (
                                    <div className="flex h-full flex-col justify-center gap-3 p-3">
                                        <div
                                            className="media-drag-strip"
                                            title={editable ? "Drag bar to move audio" : undefined}
                                            onPointerDown={e => start(e, "move")}
                                            {...pointer}
                                        >
                                            <span>AUDIO</span>
                                        </div>
                                        <AudioLines size={28} />
                                        <audio src={item.url} controls className="w-full"><track kind="captions" /></audio>
                                    </div>
                                )
                            : (
                                    <div className="link-wrapper">
                                        <div
                                            className="media-drag-strip"
                                            title={editable ? "Drag bar to move link" : undefined}
                                            onPointerDown={e => start(e, "move")}
                                            {...pointer}
                                        >
                                            <span>LINK</span>
                                        </div>
                                        <a href={item.url} target="_blank" rel="noreferrer" className="link-content">
                                            <ArrowUpRight size={26} />
                                            <strong>{item.text || "A link worth keeping"}</strong>
                                            <span>{new URL(item.url || "https://example.com").hostname}</span>
                                        </a>
                                    </div>
                                )}
            {actionOpen && plotRef.current && createPortal(
                <section
                    ref={menuRef}
                    style={{
                        left: menuPoint.x,
                        top: menuPoint.y,
                    }}
                    className="context-menu"
                    role="dialog"
                    aria-label="Element options"
                >
                    <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-semibold text-[#1d1d1f]">{confirmDelete ? "Delete element?" : "Element options"}</h4>
                        {!confirmDelete && item.type !== "note" && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setActionOpen(false); onEdit(item);
                                }}
                            >
                                Edit media
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant={confirmDelete ? "danger" : "secondary"}
                            onClick={() => {
                                if (confirmDelete) {
                                    setActionOpen(false);
                                    onDelete(item);
                                }
                                else setConfirmDelete(true);
                            }}
                        >
                            {confirmDelete ? "Confirm delete" : "Delete…"}
                        </Button>
                    </div>
                </section>, plotRef.current,
            )}
            {editable && selected && (
                <>
                    <Button type="button" className="rotate-handle" title="Drag around the center to rotate" aria-label="Rotate element" onPointerDown={e => start(e, "rotate")} {...pointer}><RotateCw size={15} /></Button>
                    <Button type="button" className="resize-handle" title="Drag to resize" aria-label="Resize element" onPointerDown={e => start(e, "resize")} {...pointer}><Expand size={15} /></Button>
                    <div className="element-actions">
                        <Button
                            type="button"
                            aria-label="Element menu"
                            onClick={(e) => {
                                e.stopPropagation();
                                openMenu(e.clientX, e.clientY);
                            }}
                        >
                            ⋯
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
}

export default function Plot({ plot, mine, isOwner, index, selected, onSelect, onChange, onSave, onDelete, onEdit, onAdd, onDeletePlot, onFront }: PlotProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [plotDelete, setPlotDelete] = useState(false);

    // Capture outside presses before an element stops propagation; remove listener on unmount.
    useEffect(() => {
        function dismiss(event: globalThis.PointerEvent) {
            const target = event.target as HTMLElement;

            if (!ref.current?.querySelector("[data-add-menu]")?.contains(target)) setMenuOpen(false);
        }

        document.addEventListener("pointerdown", dismiss, true);
        return () => document.removeEventListener("pointerdown", dismiss, true);
    }, []);

    return (
        <section id={isOwner ? "my-plot" : undefined} className={styles.surface}>

            <div className="flex items-center justify-between px-4 pb-4">
                <div className="flex items-center gap-2.5">
                    <span className="avatar" style={{ background: colors[index % colors.length] }}>{plot.username[0].toUpperCase()}</span>
                    <span className="text-sm font-semibold">{plot.username}</span>
                    {isOwner && <span className="you-tag">YOU</span>}
                </div>
                {onDeletePlot && <Button type="button" variant="danger" onClick={() => setPlotDelete(true)}>Delete plot</Button>}
            </div>
            <div
                ref={ref}
                className={`plot ${mine ? "own-plot" : ""}`}
                onPointerDown={(e) => {
                    if (e.target === ref.current) {
                        onSelect(null);
                        setMenuOpen(false);
                    }
                }}
            >
                {plotDelete && (
                    <div className="plot-overlay-modal" role="dialog" aria-label="Delete plot">
                        <div className="plot-overlay-card">
                            <h4>Delete Plot</h4>
                            <p>Are you sure you want to delete this plot and all its elements? This action cannot be undone.</p>
                            <div className="plot-overlay-actions">
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={() => {
                                        onDeletePlot?.();
                                        setPlotDelete(false);
                                    }}
                                >
                                    Delete plot
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setPlotDelete(false)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                {mine && (
                    <div data-add-menu="" className="plot-add-corner">
                        <Button
                            type="button"
                            className={`plot-add-button ${menuOpen ? "open" : ""}`}

                            aria-label="Add element to your plot"
                            title="Add note or media"
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            <Plus size={16} />
                        </Button>
                        {menuOpen && (
                            <div className="plot-add-dropdown">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="!justify-start !w-full !rounded-md !px-3 !py-2 !text-left text-[#1d1d1f] hover:!bg-[#f5f5f7]"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onAdd("note");
                                    }}
                                >
                                    <StickyNote size={15} />
                                    <span>Note</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="!justify-start !w-full !rounded-md !px-3 !py-2 !text-left text-[#1d1d1f] hover:!bg-[#f5f5f7]"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onAdd("image");
                                    }}
                                >
                                    <Image size={15} />
                                    <span>Media</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="!justify-start !w-full !rounded-md !px-3 !py-2 !text-left text-[#1d1d1f] hover:!bg-[#f5f5f7]"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onAdd("link");
                                    }}
                                >
                                    <Link size={15} />
                                    <span>Link</span>
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                {[...plot.elements].sort((a, b) => (a.z ?? (Number(a.id) || 1)) - (b.z ?? (Number(b.id) || 1)) || (Number(a.id) || 0) - (Number(b.id) || 0)).map(item => (
                    <Element
                        key={item.id}
                        item={item}
                        editable={mine}
                        selected={mine && selected === item.id}
                        plotRef={ref}
                        {...{
                            onSelect: (id) => {
                                setMenuOpen(false); onSelect(id);

                                if (id !== selected) {
                                    const item = plot.elements.find(e => e.id === id);

                                    if (item) onFront(item);
                                }
                            },
                            onChange,
                            onSave,
                            onDelete,
                            onEdit,
                        }}
                    />
                ))}
                {!plot.elements.length && (
                    <div className="empty-plot">
                        <Sparkles size={28} />
                        <p>Empty plot</p>
                        <span>Add an element in the plot.</span>
                        {mine && (
                            <Button type="button" className="small-button mt-4" onClick={() => onAdd("note")}>
                                <Plus size={15} />
                                {" "}
                                Add your first note
                            </Button>
                        )}
                    </div>
                )}

            </div>
        </section>
    );
}
