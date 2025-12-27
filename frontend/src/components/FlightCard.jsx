import { Plane, ArrowRight } from "lucide-react";
import currencyFormatter from "../utils/currencyFormatter";
import { buildGoogleFlightsUrl } from "../utils/buildGoogleFlightsUrl";

// --- COMPONENT ---
/**
 * Flight card component to display flight details.
 * 
 * Props:
 * - flight: Flight data object.
 * - selectedCurrency: Currency code for price display.
 * - originName: Name of the origin location.
 * - destinationName: Name of the destination location.
 * - departureDate: Departure date string.
 * - returnDate: Return date string.
 * - totalPassengers: Total number of passengers.
 * 
 * Returns:
 * - JSX.Element: Rendered flight card component.
 */

const FlightCard = ({ 
  flight, 
  selectedCurrency,
  originName,
  destinationName,
  departureDate,
  returnDate,
  totalPassengers,
}) => {
  if (!flight) return null;

  console.log("FlightCard Google URL params:", {
    originName,
    destinationName,
    departureDate,
    returnDate,
    totalPassengers,
  });


  const googleFlightsUrl = buildGoogleFlightsUrl({
    originName,
    destinationName,
    departureDate,
    returnDate,
    totalPassengers,
    flight
  });

  // Support both older and newer field names from Gemini
  const price =
    flight.flightPrice ?? 
    flight.priceEUR ?? 
    flight.price ?? 
    flight.flightPricePerPerson ?? 
    null;
  
  const totalPrice =
    flight.totalFlightPrice ?? 
    flight.totalPriceEUR ?? 
    null;

  const hasTimes = flight.departureTime && flight.arrivalTime;


 return (
    <article className="
    group
    bg-white/95 
    rounded-3xl 
    shadow-md
    border border-white/70
    p-4 sm:p-5 md:p-6
    flex flex-col gap-3
    
    transition-all duration-200
    hover:-translate-y-1 
    hover:shadow-xl
    hover:shadow-sky-200/70
    hover:border-sky-200/70
    ">
      {/* Airline + route + prices */}
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
              {flight.flightNumber && <>Flight {flight.flightNumber}</>}
            </p>
          </div>
        </div>

        {price != null && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-stone-400">
              From
            </p>
            <p className="text-lg font-bold text-orange-600 transition-colors duration-200 group-hover:text-orange-500">
              {currencyFormatter("en-US", selectedCurrency, price)}
              {/* Uncomment if you want explicit pp label */}
              <span className="text-xs font-normal text-stone-500 
              group-hover:text-stone-600 transition-colors duration-200">/pp*</span>
            </p>
            {totalPrice != null && (
              <p className="text-xs text-stone-500 group-hover:text-stone-600 transition-colors duration-200">
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
            <span className="font-semibold">{flight.departureTime}</span>
            <ArrowRight size={16} className="text-stone-400" />
            <span className="font-semibold">{flight.arrivalTime}</span>
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
          {flight.layoverCity && <> Layover: {flight.layoverCity}.</>}
          {flight.layoverAirport && <> Layover airport: {flight.layoverAirport}.</>}
        </p>
      )}

      {/* Booking / search actions */}
      <div className="flex items-center gap-2 sm:justify-end">
        <div>
          {flight.bookingLink && (
            <a
              href={flight.bookingLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-amber-700 hover:text-amber-800"
            >
              View deal
              <ArrowRight size={14} />
            </a>
          )}

          <a
            href={googleFlightsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="
              text-xs sm:text-sm font-semibold
              text-sky-700
              underline underline-offset-2
              transition-colors duration-150
              group-hover:text-sky-900
            "
          >
            Search on Google Flights
          </a>

          
        </div>
        <span className="text-[10px] text-stone-400">
          Opens external site in a new tab
        </span>          

        {/* Tooltip trigger */}
        <div className="relative group">
          <button
            type="button"
            className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-sky-400 text-sky-600 text-[10px] font-bold leading-none bg-white/80 shadow-sm hover:bg-sky-50 focus:outline-none focus:ring-1 focus:ring-sky-400"
            aria-label="How this Google Flights link works"
            // title="We pre-fill your route, dates and travellers where possible. Google Flights may still adjust details based on your location and availability."
          >
            i
          </button>

          {/* Tooltip bubble */}
          <div
            className="pointer-events-none absolute z-20 hidden w-56 rounded-md bg-slate-900/95 px-3 py-2 text-[10px] text-slate-50 shadow-lg border border-slate-700 group-hover:block group-focus-within:block right-0 top-6"
          >
            We pre-fill your route, dates and travellers where possible.  
            Google Flights may still adjust details based on your location and availability.
          </div>
        </div>
      </div>
    </article>
  );
};

export default FlightCard;
