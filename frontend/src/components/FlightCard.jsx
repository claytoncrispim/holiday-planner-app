import { Plane, ArrowRight } from "lucide-react";
import currencyFormatter from "../tools/currencyFormatter";

const FlightCard = ({ flight, selectedCurrency }) => {
  // Support both older and newer field names from Gemini
  const price =
    flight.flightPrice ?? flight.priceEUR ?? flight.price ?? flight.flightPricePerPerson ?? null;
  const totalPrice =
    flight.totalFlightPrice ?? flight.totalPriceEUR ?? null;

  const hasTimes = flight.departureTime && flight.arrivalTime;

  return (
    <article className="bg-white rounded-2xl shadow-md p-4 sm:p-5 flex flex-col gap-3 border border-amber-50 fade-in-soft">
      
      {/* Airline + route */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center">
            <Plane className="text-sky-600" size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-stone-800">
              {flight.airline || "Flight option"}
            </h4>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {flight.flightNumber && (
                <>Flight {flight.flightNumber}</>
              )}
            </p>
          </div>
        </div>

        {price != null && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-stone-400">
              From
            </p>
            <p className="text-lg font-bold text-orange-700">
              {currencyFormatter("en-US", selectedCurrency, price)}
            </p>
            {totalPrice != null && (
              <p className="text-xs text-stone-500">
                Total:{" "}
                {currencyFormatter("en-US", selectedCurrency, totalPrice)}
              </p>
            )}
          </div>
        )}
      </header>

      {/* Times / duration / stops */}
      {hasTimes && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {flight.departureTime}
            </span>
            <ArrowRight size={16} className="text-stone-400" />
            <span className="font-semibold">
              {flight.arrivalTime}
            </span>
          </div>
          {flight.duration && (
            <span className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
              {flight.duration}
            </span>
          )}
          {typeof flight.stops === "number" && (
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
              {flight.stops === 0
                ? "Direct"
                : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            </span>
          )}
        </div>
      )}

      {/* Extra details */}
      {(flight.details || flight.layoverCity || flight.layoverAirport) && (
        <p className="text-sm text-stone-600">
          {flight.details}
          {flight.layoverCity && (
            <> Layover: {flight.layoverCity}.</>
          )}
          {flight.layoverAirport && (
            <> Layover airport: {flight.layoverAirport}.</>
          )}
        </p>
      )}

      {/* Booking link if present */}
      {flight.bookingLink && (
        <div className="flex justify-end">
          <a
            href={flight.bookingLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-800"
          >
            View deal
            <ArrowRight size={14} />
          </a>
        </div>
      )}
    </article>
  );
};

export default FlightCard;
