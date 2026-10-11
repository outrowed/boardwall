import Button from "./Button";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

interface AccountRow {
    id: number;
    username: string;
    isAdmin: boolean;
    plotDeleted: boolean;
    elements: number;
    sessions: number;
}

/** Dedicated administrative workspace; only non-secret account metadata is returned. */
export default function AdminPanel({ onChange }: { onChange: () => Promise<void> }) {
    const [users, setUsers] = useState<AccountRow[]>([]);
    const [error, setError] = useState("");
    const [pending, setPending] = useState<{
        id: number;
        action: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const result = await api("admin/users"); setUsers(result.users);
        }
        catch (cause) { setError(String(cause)); }
    }, []);

    // Fetch account metadata when the administrative workspace opens.
    useEffect(() => { void load(); }, [load]);

    async function execute() {
        if (!pending) return;

        setBusy(true);
        setError("");

        try {
            await api(`admin/users/${pending.id}/${pending.action}`, "POST");
            setPending(null);
            await load();
            await onChange();
        }
        catch (cause) { setError(String(cause)); }
        finally { setBusy(false); }
    }

    return (
        <main className="mx-auto max-w-6xl px-6 pb-20">
            <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-stone-200 bg-white p-4 text-sm">
                <span>
                    {users.length}
                    {" "}
                    registered users
                </span>
                <span>
                    {users.filter(user => !user.plotDeleted).length}
                    {" "}
                    active plots
                </span>
                <span>
                    {users.reduce((sum, user) => sum + user.elements, 0)}
                    {" "}
                    elements
                </span>
                <Button type="button" variant="ghost" className="ml-auto" onClick={load}>Refresh</Button>
            </div>
            {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
            <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-left text-sm">
                    <caption className="p-4 text-left font-semibold">Registered accounts</caption>
                    <thead className="bg-stone-100"><tr>{["ID", "Username", "Role", "Plot", "Elements", "Active sessions", "Actions"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-t border-stone-200">
                                <td className="p-3">{user.id}</td>
                                <td className="p-3">{user.username}</td>
                                <td className="p-3">{user.isAdmin ? "Admin" : "User"}</td>
                                <td className="p-3">{user.plotDeleted ? "Deleted" : "Active"}</td>
                                <td className="p-3">{user.elements}</td>
                                <td className="p-3">{user.sessions}</td>
                                <td className="flex flex-wrap gap-2 p-3">
                                    {[user.plotDeleted ? "restore-plot" : "delete-plot", "revoke-sessions"].map(action => (
                                        <Button
                                            type="button"
                                            key={action}
                                            variant={action === "restore-plot" ? "secondary" : "danger"}
                                            onClick={() => setPending({
                                                id: user.id,
                                                action,
                                            })}
                                        >
                                            {action.replaceAll("-", " ")}
                                        </Button>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {pending && (
                <section role="dialog" aria-modal="true" aria-label="Confirm administrator action" className="fixed inset-0 z-[20000] m-auto h-fit max-w-md rounded-xl border border-stone-300 bg-white p-6 shadow-2xl">
                    <h2 className="mb-3 font-semibold">
                        Confirm
                        {pending.action.replaceAll("-", " ")}
                    </h2>
                    <p className="mb-4 text-sm">
                        Account #
                        {pending.id}
                        . Deleting a plot removes its elements, but keeps the account. Restoring creates an empty plot. Revoking sessions signs the user out, including you if this is your account.
                    </p>
                    <div className="flex gap-3">
                        <Button type="button" disabled={busy} variant="danger" onClick={execute}>{busy ? "Working…" : "Confirm"}</Button>
                        <Button type="button" disabled={busy} onClick={() => setPending(null)}>Cancel</Button>
                    </div>
                </section>
            )}
        </main>
    );
}
