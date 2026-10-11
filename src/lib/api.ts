/** JSON API helper surfaces failed writes rather than silently losing edits. */
export async function api(path: string, method = "GET", data?: unknown) {
    const response = await fetch(`/api/${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: data ? JSON.stringify(data) : undefined,
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Request failed");

    return result;
}
