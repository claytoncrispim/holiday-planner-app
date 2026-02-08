export const resolveErrorType = Object.freeze({
    NONE: "NONE",
    NOT_FOUND: "NOT_FOUND",
    UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
    UPSTREAM_BAD_RESPONSE: "UPSTREAM_BAD_RESPONSE",
    INTERNAL_ERROR: "INTERNAL_ERROR",
});

/** * @typedef {Object} ResolveResult
 * @typedef {Object} ResolveResult
 * @property {any|null} result
 * @property {keyof typeof resolveErrorType} errorType
 */