export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function apiError(res, status, code, message, details) {
    const payload = { error: { code, message } };
    if (details !== undefined) payload.error.details = details;

    res.status(status).json(payload);
}