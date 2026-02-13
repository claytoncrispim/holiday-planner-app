import { ApiError } from "./ApiError";

export default function getUserMessage(err) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "VALIDATION_ERROR":
        return err.message;
      case "NOT_FOUND":
        return "We couldn’t find that location. Try adding the country (e.g., “Dublin, Ireland”).";
      case "UPSTREAM_UNAVAILABLE":
        return "Service temporarily unavailable. Please try again in a moment.";
      case "UPSTREAM_BAD_RESPONSE":
        return "Provider error. Please try again.";
      default:
        if (err.status === 429) return "Too many requests right now. Please try again shortly.";
        if (err.status >= 500) return "Server problem. Please try again shortly.";
        if ([502, 503, 504].includes(err.status)) return "Service temporarily unavailable. Please try again in a moment.";
        return "There was an issue with the request. Please check your inputs and try again.";
    }
  }

  if (err instanceof TypeError) {
    return "Network error. Please check your connection and try again.";
  }

  if (err?.message === "UNEXPECTED_RESPONSE_SHAPE") {
    return "The AI reply came back in an unexpected format. Please try again in a moment.";
  }

  return "Something went wrong while generating your travel guide. Please try again.";
}
