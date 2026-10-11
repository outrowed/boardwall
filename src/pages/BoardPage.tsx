import Button from "../components/Button";
import { useState } from "react";
import AdminPanel from "../components/AdminPanel";
import AdminNav from "../components/AdminNav";
import { Plus, Image, StickyNote, Link, LogOut } from "lucide-react";
import EditorDialog from "../components/EditorDialog";
import Plot from "../components/Plot";
import { api } from "../lib/api";
import { useBoard } from "../hooks/useBoard";

export default function BoardPage() {
    const { user, plots, loading, modal, register, error, authBusy, selected, draft, setSelected, setDraft, setError, setModal, setRegister, setUser, refresh, jump, add, change, save, remove, deletePlot, bringToFront, authenticate, submitMediaElement, upload, openRegistration, openAuth } = useBoard();
    const [adminOpen, setAdminOpen] = useState(false);
    const displayed = plots;

    return (
        <div
            className="min-h-screen"
            onPointerDown={(e) => {
                const target = e.target as HTMLElement;

                if (!target.closest("[data-wall-element]") && !target.closest("[data-add-menu]") && !target.closest("[data-dock]") && !target.closest("[role=dialog]")) {
                    setSelected(null);
                }
            }}
        >
            <header className="sticky top-0 z-40 mb-6 flex w-full items-center justify-between gap-4 border-b border-[#e5e5ea] bg-white px-6 py-4 sm:px-12">
                <div className="flex items-center gap-6">
                    <button
                        type="button"
                        onClick={() => setAdminOpen(false)}
                        className="text-lg font-semibold tracking-tight text-[#1d1d1f] hover:opacity-80 transition-opacity"
                    >
                        Plots
                    </button>
                    {user?.isAdmin && (
                        <AdminNav
                            currentView={adminOpen ? "admin" : "wall"}
                            onSelectView={view => setAdminOpen(view === "admin")}
                        />
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {user
                        ? (
                                <>
                                    <Button type="button" variant="ghost" className="hidden sm:inline-flex text-sm text-[#1d1d1f]" onClick={jump}>
                                        @
                                        {user.username}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="icon"
                                        title="Sign out"
                                        onClick={async () => {
                                            await api("logout", "POST");
                                            setUser(null);
                                            setSelected(null);
                                        }}
                                    >
                                        <LogOut size={16} />
                                    </Button>
                                </>
                            )
                        : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        setRegister(false);
                                        openAuth();
                                    }}
                                >
                                    Sign in
                                </Button>
                            )}
                    <Button type="button" variant="primary" onClick={() => user ? add("note") : openRegistration()}>
                        <Plus size={16} />
                        {user ? "Add to my plot" : "Sign up"}
                    </Button>
                </div>
            </header>
            {adminOpen && user?.isAdmin
                ? <AdminPanel onChange={refresh} />
                : (
                        <main className="mx-auto max-w-[1480px] px-6 pb-20 sm:px-12">
                            <div className="wall-toolbar">
                                <div className="flex items-center gap-3">
                                    <h2 className="font-semibold">All plots</h2>
                                    <span className="rounded-full border border-stone-300 px-2 py-0.5 text-xs">{plots.length}</span>
                                </div>
                                <div className="flex gap-4 text-xs text-stone-500">
                                    {user && <Button type="button" onClick={jump} className="font-semibold text-stone-800">My plot ↗</Button>}
                                    <Button type="button" onClick={() => refresh().catch(e => setError(e.message))}>Refresh wall</Button>
                                    <span className="hidden sm:inline" />
                                </div>
                            </div>
                            {!plots.length && !loading && <div className="mb-6 text-xs text-stone-500">No plots yet. Sign up to create one.</div>}
                            {error && !modal && (
                                <div role="alert" className="mb-5 rounded-xl bg-red-100 p-3 text-sm text-red-800">
                                    {error}
                                    <Button type="button" className="float-right" onClick={() => setError("")}>Dismiss</Button>
                                </div>
                            )}
                            {loading
                                ? <p className="py-20 text-center">Loading plots…</p>
                                : (
                                        <div className="wall-grid">
                                            {displayed.map((plot, index) => (
                                                <Plot
                                                    key={plot.id}
                                                    plot={plot}
                                                    mine={user?.isAdmin === true || user?.id === plot.id}
                                                    isOwner={user?.id === plot.id}
                                                    index={index}
                                                    selected={selected}
                                                    onFront={bringToFront}
                                                    onSelect={setSelected}
                                                    onChange={change}
                                                    onSave={save}
                                                    onDelete={remove}
                                                    onEdit={(item) => {
                                                        setDraft(item);
                                                        setError("");
                                                        setModal("media");
                                                    }}
                                                    onDeletePlot={user?.isAdmin ? () => deletePlot(Number(plot.id)) : undefined}
                                                    onAdd={type => add(type, Number(plot.id))}
                                                />
                                            ))}
                                        </div>
                                    )}
                        </main>
                    )}

            {/* Mobile bottom dock (visible on screens <= 640px) */}
            {user && (
                <div data-dock="" className="editor-dock sm:hidden">
                    <Button type="button" onClick={() => add("note")}>
                        <StickyNote size={18} />
                        <span>Note</span>
                    </Button>
                    <Button type="button" onClick={() => add("image")}>
                        <Image size={18} />
                        <span>Media</span>
                    </Button>
                    <Button type="button" onClick={() => add("link")}>
                        <Link size={18} />
                        <span>Link</span>
                    </Button>
                    <span className="dock-divider" />
                    <span className="text-xs text-stone-500">Drag ✥ · rotate ↻</span>
                </div>
            )}

            <EditorDialog {...{
                modal,
                register,
                draft,
                authBusy,
                error,
                setModal,
                setRegister,
                setError,
                setDraft,
                authenticate,
                submitMediaElement,
                upload,
            }}
            />
        </div>
    );
}
