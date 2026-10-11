import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ElementType, Plot as PlotData, User, WallElement } from "../types";
import { api } from "../lib/api";

const colors = ["#f8e5a0", "#f1c9ce", "#d8dfbc", "#cfdaee", "#e4cff0"];

const blankMedia: WallElement = {
    type: "image",
    text: "",
    url: "",
    x: 100,
    y: 100,
    w: 250,
    h: 230,
    angle: -3,
    color: colors[0],
};

function topLayer(elements: WallElement[], excludeId?: WallElement["id"]) {
    return elements.reduce((max, element) => element.id === excludeId ? max : Math.max(max, element.z ?? 1), 0);
}

/**
 * Client-authoritative board state.
 * Every edit is applied locally first; the server is updated in the background through
 * one ordered queue, so the UI never waits on the network and writes cannot overtake each other.
 * The server still enforces ownership and admin permissions.
 */
export function useBoard() {
    const [user, setUser] = useState<User | null>(null);
    const [plots, setPlots] = useState<PlotData[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<"auth" | "media" | null>(null);
    const [register, setRegister] = useState(true);
    const [error, setError] = useState("");
    const [authBusy, setAuthBusy] = useState(false);
    const [selected, setSelected] = useState<number | string | null>(null);
    const [draft, setDraft] = useState<WallElement>(blankMedia);
    const [targetPlot, setTargetPlot] = useState(0);

    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const serverIds = useRef(new Map<number | string, number>());
    const plotsRef = useRef(plots);
    plotsRef.current = plots;

    function updatePlots(transform: (current: PlotData[]) => PlotData[]) {
        const next = transform(plotsRef.current);
        plotsRef.current = next;
        setPlots(next);
    }

    // Load the session and wall once on mount; later edits never wait for the server.
    useEffect(() => {
        Promise.all([api("me"), api("wall")])
            .then(([me, wall]) => {
                setUser(me.user);
                plotsRef.current = wall.plots;
                setPlots(wall.plots);
            })
            .catch(cause => setError(String(cause instanceof Error ? cause.message : cause)))
            .finally(() => setLoading(false));
    }, []);

    /** Run a background write after all earlier writes; failures surface as a dismissible banner. */
    function sync(task: () => Promise<unknown>, failure: string) {
        queue.current = queue.current.then(task).catch(() => setError(failure));
    }

    /** Local elements keep their temporary id; the server id is looked up when a write runs. */
    function serverId(id: WallElement["id"]) {
        return typeof id === "number" ? id : serverIds.current.get(id ?? "");
    }

    /** Layer order only moves forward, so a gesture started before bring-to-front cannot undo it. */
    function withCurrentLayer(item: WallElement) {
        const current = plotsRef.current.flatMap(plot => plot.elements).find(element => element.id === item.id);
        return {
            ...item,
            z: Math.max(item.z ?? 1, current?.z ?? 1),
        };
    }

    async function refresh() {
        await queue.current;

        try {
            const wall = await api("wall");
            plotsRef.current = wall.plots;
            setPlots(wall.plots);
        }
        catch (cause) {
            setError(String(cause instanceof Error ? cause.message : cause));
        }
    }

    function openAuth() {
        setError("");
        setModal("auth");
    }

    function openRegistration() {
        setRegister(true);
        openAuth();
    }

    function jump() {
        document.getElementById("my-plot")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }

    function create(element: WallElement, plotId: number) {
        const plot = plotsRef.current.find(p => Number(p.id) === plotId);
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const next = {
            ...element,
            id,
            z: topLayer(plot?.elements ?? []) + 1,
        };

        updatePlots(current => current.map(p => Number(p.id) === plotId
            ? {
                    ...p,
                    elements: [...p.elements, next],
                }
            : p));
        setSelected(id);
        sync(async () => {
            const result = await api("elements", "POST", {
                ...next,
                plotId,
            });
            serverIds.current.set(id, Number(result.element.id));
        }, "Couldn't save a new element to the server.");
    }

    function add(type: ElementType = "note", plotId = Number(user?.id)) {
        if (!user) return openAuth();

        if (type === "note") {
            create({
                type: "note",
                text: "",
                x: 140 + Math.round(Math.random() * 40 - 20),
                y: 140 + Math.round(Math.random() * 40 - 20),
                w: 240,
                h: 220,
                angle: Math.round(Math.random() * 6 - 3),
                color: colors[Math.floor(Math.random() * colors.length)],
            }, plotId);
            return;
        }

        setTargetPlot(plotId);
        setDraft({
            ...blankMedia,
            type,
        });
        setError("");
        setModal("media");
    }

    function change(item: WallElement) {
        const next = withCurrentLayer(item);
        updatePlots(current => current.map(p => p.elements.some(e => e.id === item.id)
            ? {
                    ...p,
                    elements: p.elements.map(e => e.id === item.id ? next : e),
                }
            : p));
    }

    function save(item: WallElement) {
        const next = withCurrentLayer(item);
        sync(async () => {
            const id = serverId(next.id);

            if (id) await api(`elements/${id}`, "PUT", next);
        }, "Couldn't save a change to the server.");
    }

    function bringToFront(item: WallElement) {
        const plot = plotsRef.current.find(p => p.elements.some(e => e.id === item.id));

        if (!plot) return;

        const others = topLayer(plot.elements, item.id);
        const current = plot.elements.find(e => e.id === item.id) ?? item;

        if ((current.z ?? 1) > others) return;

        const next = {
            ...current,
            z: others + 1,
        };
        updatePlots(all => all.map(p => p.id === plot.id
            ? {
                    ...p,
                    elements: p.elements.map(e => e.id === item.id ? next : e),
                }
            : p));
        save(next);
    }

    function remove(item: WallElement) {
        updatePlots(current => current.map(p => ({
            ...p,
            elements: p.elements.filter(e => e.id !== item.id),
        })));
        setSelected(null);
        sync(async () => {
            const id = serverId(item.id);

            if (id) await api(`elements/${id}`, "DELETE");
        }, "Couldn't delete an element on the server.");
    }

    function deletePlot(id: number) {
        updatePlots(current => current.filter(p => Number(p.id) !== id));
        sync(() => api(`plots/${id}`, "DELETE"), "Couldn't delete the plot on the server.");
    }

    async function authenticate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setAuthBusy(true);
        setError("");

        try {
            const result = await api(register ? "register" : "login", "POST", Object.fromEntries(new FormData(event.currentTarget)));
            setUser(result.user);
            setModal(null);
            await refresh();
            setTimeout(jump, 100);
        }
        catch (cause) {
            setError(String(cause instanceof Error ? cause.message : cause));
        }
        finally {
            setAuthBusy(false);
        }
    }

    function submitMediaElement(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setModal(null);

        if (draft.id === undefined) {
            create(draft, targetPlot);
            return;
        }

        change(draft);
        save(draft);
    }

    function upload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (!file) return;

        if (file.size > 5 * 1024 * 1024) return setError("Choose media smaller than 5 MB.");

        const reader = new FileReader();
        reader.onload = () => setDraft(current => ({
            ...current,
            url: String(reader.result),
            type: file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image",
        }));
        reader.readAsDataURL(file);
    }

    return {
        user,
        plots,
        loading,
        modal,
        register,
        error,
        authBusy,
        selected,
        draft,
        setUser,
        setSelected,
        setDraft,
        setError,
        setModal,
        setRegister,
        refresh,
        jump,
        add,
        change,
        save,
        remove,
        deletePlot,
        bringToFront,
        authenticate,
        submitMediaElement,
        upload,
        openAuth,
        openRegistration,
    };
}
