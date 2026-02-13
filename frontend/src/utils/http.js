import { safeJson } from "./safeJson";
import { ApiError } from "./apiError";

export async function throwIfNotOk(res) {
    if (res.ok) return;

    const data = await safeJson(res);

    // Support the new backend error shape
    const code = data?.error?.code || "UNKNOWN_ERROR";
    const message = 
        data?.error?.message ||
        `Request failed with status ${res.status}`;

    const details = data?.error?.details;

    throw new ApiError(message, { status: res.status, code, details });
}