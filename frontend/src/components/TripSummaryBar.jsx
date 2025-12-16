// TripSummaryBar.jsx

import formatDate from "../utils/formatDate";

const TripSummaryBar = ({
  originName,
  destinationName,
  departureDate,
  returnDate,
  passengers,
  budgetLevel,
  onChangeTrip,
  isSaved = false,
}) => {
  const totalPassengers =
    (passengers?.adults ?? 0) +
    (passengers?.youngAdults ?? 0) +
    (passengers?.children ?? 0) +
    (passengers?.infants ?? 0);

  const budgetLabel =
    budgetLevel === "low"
      ? "Budget"
      : budgetLevel === "high"
      ? "Comfort"
      : "Balanced";

  return (
    <section className="mt-4 mb-3 fade-in-soft">
      <div className="bg-gradient-to-r from-sky-100 via-orange-50 to-emerald-50 rounded-2xl shadow-md border border-amber-100/70 px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Trip summary */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500 mb-1">
            Suggested trip
          </p>
          <p className="text-sm sm:text-base font-semibold text-stone-800">
            {originName
              ? `${originName} → ${destinationName}`
              : destinationName}
          </p>
          <p className="text-xs sm:text-sm text-stone-600">
            <span className="font-medium">
              {departureDate ? formatDate(departureDate) : "Flexible start"}
            </span>{" "}
            –{" "}
            <span className="font-medium">
              {returnDate ? formatDate(returnDate) : "Flexible end"}
            </span>{" "}
            · {totalPassengers} traveller{totalPassengers !== 1 ? "s" : ""} ·{" "}
            {budgetLabel}
          </p>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          {isSaved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-100 shadow-sm">
              <span>★</span>
              <span>Saved</span>
            </span>
          )}

          <button
            type="button"
            onClick={onChangeTrip}
            className="text-xs sm:text-sm font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-2"
          >
            Change trip
          </button>
        </div>
      </div>
    </section>
  );
};

export default TripSummaryBar;
