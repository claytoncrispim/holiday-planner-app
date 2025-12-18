import FlightCard from "./FlightCard";
import InfoSectionCard from "./InfoSectionCard";
import formatDate from "../utils/formatDate";
import WeatherCard from "./WeatherCard";
import { Sparkles, Info } from "lucide-react";


// --- HELPERS ---
// Helper to build a Google Hotel search URL
const buildGoogleHotelsUrl = ({
    destinationName,
    departureDate,
    returnDate,
    totalPassengers,
}) => {
    if (!destinationName) {
        return "https://www.google.com/travel/hotels";
    }

    let datePart = "";
    if (departureDate && returnDate) {
        datePart = `from ${departureDate} to ${returnDate}`;
    } else if (departureDate) {
        datePart = `from ${departureDate}`;
    }

    let paxPart = "";
    if (typeof totalPassengers === "number" && totalPassengers > 0) {
        paxPart = ` for ${totalPassengers} guest${
            totalPassengers > 1 ? "s" : ""
        }`;
    }

    const query = `Hotels in ${destinationName} ${datePart} ${paxPart}`;
    const encoded = encodeURIComponent(query.trim());

    return `https://www.google.com/travel/hotels?q=${encoded}`;
}

// Helper to build a Google Package search URL
const buildGooglePackagesUrl = ({
    originName,
    destinationName,
    departureDate,
    returnDate,
    nights,
    totalPassengers,
}) => {
    if (!originName || !destinationName) {
        return "https://www.google.com/search?q=package+holidays";

    }

    // Build date part
    let datePart = "";
    if (departureDate && returnDate) {
        datePart = `from ${departureDate} to ${returnDate}`;
    } else if (departureDate) {
        datePart = `from ${departureDate}`;
    }

    // Build nights part
    let nightsPart = "";
    if (typeof nights === "number" && nights > 0) {
        nightsPart = ` for ${nights} night${nights > 1 ? "s" : ""}`;
    }
    
    // Build passengers part
    let paxPart = "";
    if (typeof totalPassengers === "number" && totalPassengers > 0) {
        paxPart = ` for ${totalPassengers} guest${
            totalPassengers > 1 ? "s" : ""
        }`;
    }

    const query = `Package holidays from ${originName} to ${destinationName} ${datePart} ${nightsPart} ${paxPart}`;
    const encoded = encodeURIComponent(query.trim());

    return `https://www.google.com/search?q=${encoded}`;
}

// --- END HELPERS ---

// --- COMPONENT ---
/**
 * A column displaying a destination guide with flights, hotels, packages, and comparison info.
 *
 * Props:
 * - titlePrefix: A string prefix for the title (e.g., "Recommended Trip")
 * - guide: An object containing destination guide data
 * - departureDate: The departure date as a string (optional)
 * - returnDate: The return date as a string (optional)
 * - selectedCurrency: The selected currency code (e.g., "USD")
 * - passengers: An object with passenger counts (adults, youngAdults, children, infants)
 * - showHeader: Boolean to control header visibility (default: true)
 */
const DestinationGuideColumn = ({
    titlePrefix,
    guide,
    departureDate,
    returnDate,
    selectedCurrency,
    passengers,
    showHeader = true,
    isBestValue = false,
    weather
}) => {
    if (!guide) return null;

    const totalPassengers = passengers
        ? passengers.adults +
          passengers.youngAdults +
          passengers.children +
          passengers.infants
        : null;

    // Calculate number if nights (if both dates are valid)
    let nights = null;
    if (departureDate && returnDate) {
        const start = new Date(departureDate);
        const end = new Date(returnDate);
        if (!isNaN(start) && !isNaN(end)) {
            const diffMs = end.getTime() - start.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays > 0) nights = diffDays;
        }
    }

    // Build hotel / package URLs using the helpers
    const hotelsUrl = buildGoogleHotelsUrl({
        destinationName: guide.destinationName,
        departureDate,
        returnDate,
        totalPassengers,
    });

    const packagesUrl = buildGooglePackagesUrl({
        originName: guide.originName,
        destinationName: guide.destinationName,
        departureDate,
        returnDate,
        nights,
        totalPassengers,
    });

    return (
        <div className="space-y-4 mt-4">
            {/* Destination header */}
            {showHeader && (
                <div className="bg-gradient-to-r from-sky-100 via-orange-50 to-emerald-50 rounded-xl p-3 shadow-sm border border-amber-100">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-stone-500 mb-1">
                                {titlePrefix}
                            </p>
                            <h3 className="text-lg font-semibold text-stone-800">
                                {guide.originName
                                    ? `${guide.originName} → ${guide.destinationName}`
                                    : guide.destinationName}
                            </h3>
                            {departureDate && returnDate && (
                            <p className="text-xs text-stone-600 mt-1">
                                {formatDate(departureDate)} – {formatDate(returnDate)}
                            </p>
                            )}
                        </div>

                          {isBestValue && (
                            <div className="relative group">
                                {/* Pill */}
                                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 border border-emerald-100 text-[11px] font-semibold text-emerald-700 shadow-sm">
                                    <Sparkles size={12} className="text-emerald-500" />
                                    <span>Best value</span>

                                    <button
                                    type="button"
                                    className="ml-1 inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                                    aria-label="What does Best value mean?"
                                    >
                                    <Info size={11} />
                                    </button>
                                </div>

                                {/* Tooltip */}
                                <div
                                    className="
                                    pointer-events-none
                                    absolute right-0 mt-1 w-52
                                    rounded-lg bg-stone-900/95 text-[11px] text-stone-100
                                    px-3 py-2 shadow-lg
                                    opacity-0 translate-y-1
                                    group-hover:opacity-100 group-hover:translate-y-0
                                    transition-all duration-150
                                    z-20
                                    "
                                >
                                    <p className="font-semibold mb-0.5">How we pick “Best value”</p>
                                    <p className="text-[10px] leading-snug text-stone-200">
                                    We compare the lowest total flight price returned for each destination.
                                    The option with the cheaper flight gets this badge.
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Flights */}
            {guide?.flights?.length > 0 && (
                <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-stone-800">
                        ✈️ Flight options
                        <span className="float-right text-xs font-normal text-stone-500"> *pp (price per person)</span>
                    </h4>
                    <div className="space-y-2">
                        {guide.flights.map((f, idx) => (
                            <FlightCard
                                key={f.id || `${f.airline}-${f.flightNumber || idx}`}
                                flight={f}
                                selectedCurrency={selectedCurrency}
                                originName={guide.originName}
                                destinationName={guide.destinationName}
                                departureDate={departureDate}
                                returnDate={returnDate}
                                totalPassengers={totalPassengers}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Live weather */}
            {weather && <WeatherCard weather={weather} />}

            {/* Hotels */}
            {guide.hotelInfo && (
                <div className="space-y-2">
                    <InfoSectionCard title="Where to stay" emoji="🏨">
                        {guide.hotelInfo}
                    </InfoSectionCard>

                    <div className="flex flex-col items-end">
                        <a
                            href={hotelsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm font-semibold text-sky-700 hover:text-sky-900 underline"
                        >
                            Search hotels in {guide.destinationName}
                        </a>
                        <span className="mt-0.5 text-[10px] text-stone-400">
                            Opens Google Hotels in a new tab
                        </span>
                    </div>
                </div>
            )}

            {/* Packages */}
            {guide.travelPackages && (
                <div className="space-y-2">
                    <InfoSectionCard title="Package deals" emoji="📦">
                        {guide.travelPackages}
                    </InfoSectionCard>

                    <div className="flex flex-col items-end">
                        <a
                            href={packagesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm font-semibold text-sky-700 hover:text-sky-900 underline"
                        >
                            Search package holidays
                        </a>
                        <span className="mt-0.5 text-[10px] text-stone-400">
                            Opens Google Search in a new tab
                        </span>
                    </div>
                </div>
            )}

            {/* Comparison */}
            {guide.comparisonInfo && (
                <InfoSectionCard title="What’s the best option?" emoji="⚖️">
                    {guide.comparisonInfo}
                </InfoSectionCard>
            )}
        </div>
    );
};

export default DestinationGuideColumn;
