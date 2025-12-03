import { MapPin, Calendar, Users, Wallet } from "lucide-react";
import formatDate from "../utils/formatDate";

const TripSummaryBar = ({
  originName,
  destinationName,
  departureDate,
  returnDate,
  passengers,
  budgetLevel,
  onChangeTrip,
}) => {
  const totalPassengers =
    passengers.adults +
    passengers.youngAdults +
    passengers.children +
    passengers.infants;

  const hasDates = departureDate && returnDate;

  // Compute nights labe if date are valid
  let nightsLabel = null;
  if (hasDates) {
    const startDate = new Date(departureDate);
    const endDate = new Date(returnDate);
    if (!isNaN(startDate) && !isNaN(endDate)) {
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        nightsLabel = `${diffDays} night${diffDays > 1 ? "s" : ""}`;
      }
    }
  }

  // Budget label mapping
  const budgetLabels = {
    low: "Budget",
    medium: "Balanced",
    high: "Comfort",
  };

  return (
    <section className="mt-4 mb-4 fade-in-soft">
      <div className="bg-gradient-to-r from-sky-100 via-orange-50 to-emerald-50 rounded-2xl px-4 py-3 shadow-sm border border-orange-100 flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-sm">

        {/* Route */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
            <MapPin className="text-orange-500" size={16} />
          </div>
          <div className="text-stone-800">
            <p className="font-semibold leading-tight">
              {originName ? `${originName} → ${destinationName}` : destinationName}
            </p>
            <p className="text-[11px] text-stone-500 uppercase tracking-wide">
              Current itinerary
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-8 w-px bg-amber-200" />

        {/* Dates */}
        {hasDates && (
          <div className="flex items-center gap-2">
            <Calendar className="text-orange-500" size={16} />
            <p className="text-stone-700">
              <span className="font-semibold">
                {formatDate(departureDate)}
              </span>{" "}
              –{" "}
              <span className="font-semibold">
                {formatDate(returnDate)}
              </span>
              {nightsLabel && (
                <span>
                  {" "} · {nightsLabel}
                </span>)}            </p>
          </div>
        )}

        {/* Divider */}
        <div className="hidden sm:block h-8 w-px bg-amber-200" />

        {/* Passengers */}
        <div className="flex items-center gap-2">
          <Users className="text-orange-500" size={16} />
          <p className="text-stone-700">
            <span className="font-semibold">{totalPassengers}</span>{" "}
            traveller{totalPassengers !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-8 w-px bg-amber-200" />

        {/* Budget */}
        {budgetLevel && (
          <div className="flex items-center gap-2">
            <Wallet className="text-orange-500" size={16} />
            <p className="text-stone-700 text-xs sm:text-sm">
              <span className="text-stone-500">Budget:</span>{" "}
              <span className="font-semibold">
                {budgetLabels[budgetLevel] || budgetLevel}
              </span>
            </p>
          </div>
        )}

        {/* Change trip button – pushed to the right */}
        {onChangeTrip && (
          <button
            type="button"
            onClick={onChangeTrip}
            className="ml-auto pl-3 text-xs sm:text-sm font-semibold text-orange-600 hover:text-orange-700 underline"
          >
            Change Trip
          </button>
        )}
      </div>
    </section>
  );
};

export default TripSummaryBar;
