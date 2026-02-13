import { safeJson } from "./safeJson";
import { ApiError } from "./ApiError";

// --- RETRY HELPER FUNCTION ---
// Sleep helper function for delays between retries
// It returns a Promise that resolves after the specified milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableError(err) {
    // Fetch network errors failures often surface as TypeError
    if (err instanceof TypeError) return true;

    if (err instanceof ApiError) {
        // Consider 502, 503, 504 as retryable errors
        return [502, 503, 504].includes(err.status);
    }
    return false;
}

export async function fetchWithRetry(
    url, 
    options = {}, 
    { retries = 2, delay = 4000 } = {}
) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, options);

            if (res.ok) return res;

            // Parse standardized error backend errors: { error: { code, message, details? } }
            const data = await safeJson(res);

            const apiErr = new ApiError(
                data?.error?.message || `Request failed with status ${res.status}`,
                {
                    status: res.status,
                    code: data?.error?.code || "UNKNOWN_ERROR",
                    details: data?.error?.details,
                }
            );


            // Retry only on transient statuses
            if ([502, 503, 504].includes(res.status) && attempt < retries) {
                console.warn(
                `Request to ${url} failed with status ${res.status} (${apiErr.code}). Retrying in ${delay}ms... (Attempt ${
                    attempt + 1
                } of ${retries + 1})`
                );
                await sleep(delay);
                continue;
            }

            throw apiErr;
            
            } catch (err) {
            lastError = err;

            if (attempt < retries && isRetryableError(err)) {
                console.warn(
                    `Request to ${url} failed on attempt ${attempt + 1} of ${retries + 1}:`, err
                );            
                await sleep(delay);
                continue;
            }

            // If it's not retryable or we've exhausted retries, throw the error
            throw err;
            }
        }

        // If we exhausted all retries, throw the last error encountered
        throw lastError || new Error("Unknown error in fetchWithRetry");
  }
