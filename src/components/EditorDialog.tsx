import Button from "./Button";
import { Plus, X, Image, Link, AudioLines, Film } from "lucide-react";
import type { useBoard } from "../hooks/useBoard";

export default function EditorDialog({
    modal,
    register,
    draft,
    authBusy: busy,
    error,
    setModal,
    setRegister,
    setError,
    setDraft,
    authenticate,
    submitMediaElement,
    upload,
}: Pick<
    ReturnType<typeof useBoard>,
    | "modal"
    | "register"
    | "draft"
    | "authBusy"
    | "error"
    | "setModal"
    | "setRegister"
    | "setError"
    | "setDraft"
    | "authenticate"
    | "submitMediaElement"
    | "upload"
>) {
    const isEditingMedia = draft.id !== undefined;

    return (
        <>
            {modal && (
                <div className="modal-backdrop">
                    <section
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label={modal === "auth" ? "Account" : isEditingMedia ? "Edit media" : "Add media"}
                    >
                        {/* Smooth circular close button comfortably inset from modal curves */}
                        <button
                            type="button"
                            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f7] text-[#6e6e73] transition-colors hover:bg-[#e8e8ed] hover:text-[#1d1d1f]"
                            aria-label="Close dialog"
                            onClick={() => setModal(null)}
                        >
                            <X size={16} />
                        </button>

                        {modal === "auth"
                            ? (
                                    <>
                                        <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
                                            {register ? "Create Account" : "Sign In"}
                                        </h2>
                                        <p className="mt-1 mb-6 text-sm text-[#6e6e73]">
                                            {register
                                                ? "Enter a username and password to claim your plot."
                                                : "Sign in to manage and edit your plot."}
                                        </p>
                                        <form onSubmit={authenticate}>
                                            <label>
                                                Username
                                                <input
                                                    name="username"
                                                    required
                                                    minLength={3}
                                                    maxLength={24}
                                                    pattern="[A-Za-z0-9_]+"
                                                    autoComplete="username"
                                                    placeholder="e.g. olive"
                                                />
                                            </label>
                                            <label>
                                                Password
                                                <input
                                                    name="password"
                                                    type="password"
                                                    required
                                                    minLength={8}
                                                    maxLength={128}
                                                    autoComplete={register ? "new-password" : "current-password"}
                                                    placeholder="At least 8 characters"
                                                />
                                            </label>
                                            <Button
                                                type="submit"
                                                disabled={busy}
                                                variant="primary"
                                                className="mt-2 w-full"
                                            >
                                                {busy
                                                    ? "One moment…"
                                                    : register
                                                        ? "Create account"
                                                        : "Sign in"}
                                            </Button>
                                        </form>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="mt-4 w-full"
                                            onClick={() => {
                                                setRegister(!register);
                                                setError("");
                                            }}
                                        >
                                            {register
                                                ? "Already have a plot? Sign in"
                                                : "New here? Create an account"}
                                        </Button>
                                    </>
                                )
                            : (
                                    <>
                                        <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
                                            {isEditingMedia ? "Edit Media" : "Add Media"}
                                        </h2>
                                        <p className="mt-1 mb-6 text-sm text-[#6e6e73]">
                                            {isEditingMedia
                                                ? "Update the caption or media URL for this element."
                                                : "Add an image, video, audio, or website link to your plot."}
                                        </p>
                                        <form onSubmit={submitMediaElement}>
                                            <div className="mb-5 flex flex-wrap gap-2">
                                                {(
                                                    [
                                                        ["image", Image],
                                                        ["video", Film],
                                                        ["audio", AudioLines],
                                                        ["link", Link],
                                                    ] as const
                                                ).map(([type, Icon]) => (
                                                    <Button
                                                        type="button"
                                                        key={type}
                                                        variant={draft.type === type ? "primary" : "secondary"}
                                                        onClick={() =>
                                                            setDraft({
                                                                ...draft,
                                                                type,
                                                            })}
                                                    >
                                                        <Icon size={15} />
                                                        {type === "image" ? "Image / GIF" : type}
                                                    </Button>
                                                ))}
                                            </div>
                                            <label>
                                                Caption / title
                                                <input
                                                    value={draft.text}
                                                    maxLength={200}
                                                    onChange={e =>
                                                        setDraft({
                                                            ...draft,
                                                            text: e.target.value,
                                                        })}
                                                    placeholder="Give it a title or caption…"
                                                />
                                            </label>
                                            <label>
                                                {draft.type === "link" ? "Website URL" : "Direct media URL"}
                                                <input
                                                    type={draft.url?.startsWith("data:") ? "text" : "url"}
                                                    required
                                                    value={draft.url?.startsWith("data:") ? "Uploaded media" : draft.url}
                                                    readOnly={draft.url?.startsWith("data:")}
                                                    onChange={e =>
                                                        setDraft({
                                                            ...draft,
                                                            url: e.target.value,
                                                        })}
                                                    placeholder="https://…"
                                                />
                                            </label>
                                            {draft.type !== "link" && (
                                                <label className="upload-label">
                                                    Or upload image, GIF, video, or audio (5 MB max)
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,audio/mp4"
                                                        onChange={upload}
                                                    />
                                                </label>
                                            )}
                                            <p className="mb-4 text-xs text-[#6e6e73]">
                                                Videos need a direct MP4/WebM URL, not a YouTube page.
                                            </p>
                                            <Button
                                                type="submit"
                                                disabled={busy}
                                                variant="primary"
                                                className="mt-2 w-full"
                                            >
                                                {busy
                                                    ? "Saving…"
                                                    : isEditingMedia
                                                        ? "Save changes"
                                                        : "Add to plot"}
                                                {!isEditingMedia && <Plus size={16} />}
                                            </Button>
                                        </form>
                                    </>
                                )}
                        {error && (
                            <p role="alert" className="mt-4 text-sm text-[#d70015]">
                                {error}
                            </p>
                        )}
                    </section>
                </div>
            )}
        </>
    );
}
