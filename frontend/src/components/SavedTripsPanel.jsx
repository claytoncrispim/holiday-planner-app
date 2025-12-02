import { Calendar, MapPin, Users, Wallet, Trash2, RotateCcw } from "lucide-react";
import formatDate from "../tools/dateFormatter";

const budgetLabels = {
  low: "Budget",
  medium: "Balanced",
  high: "Comfort",
};

const SavedTripsPanel = ({ savedTrips, onSelectTrip, onDeleteTrip }) => {
  if (!savedTrips || savedTrips.length === 0) return null;

  return (
    <section className="mt-4 mb-4 fade-in-soft">
      <div className="bg-white/80 border border-orange-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
            <RotateCcw size={16} className="text-orange-500" />
            Recent trips
          </h3>
          <p className="text-[11px] text-stone-400">
            Click a trip to load it into the form.
          </p>
        </div>

        <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {savedTrips.map((trip) => {
            const totalPassengers =
              trip.passengers.adults +
              trip.passengers.youngAdults +
              trip.passengers.children +
              trip.passengers.infants;

            const nightsLabel =
              typeof trip.nights === "number"
                ? `${trip.nights} night${trip.nights > 1 ? "s" : ""}`
                : null;

            return (
              <li
                key={trip.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2 hover:border-orange-200 hover:bg-white transition"
              >
                <button
                  type="button"
                  onClick={() => onSelectTrip(trip)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-stone-800">
                    <MapPin size={14} className="text-orange-500" />
                    <span className="font-semibold">
                      {trip.origin} → {trip.destination}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                    {trip.departureDate && trip.returnDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-stone-400" />
                        <span>
                          {formatDate(trip.departureDate)} –{" "}
                          {formatDate(trip.returnDate)}
                        </span>
                        {nightsLabel && <span>· {nightsLabel}</span>}
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      <Users size={12} className="text-stone-400" />
                      <span>{totalPassengers} travellers</span>
                    </span>

                    {trip.budgetLevel && (
                      <span className="flex items-center gap-1">
                        <Wallet size={12} className="text-stone-400" />
                        <span>{budgetLabels[trip.budgetLevel] || trip.budgetLevel}</span>
                      </span>
                    )}

                    {trip.selectedCurrency && (
                      <span className="text-[11px] text-stone-400">
                        · {trip.selectedCurrency}
                      </span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteTrip(trip.id)}
                  className="mt-1 text-stone-300 hover:text-red-500 transition"
                  aria-label="Delete saved trip"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default SavedTripsPanel;
