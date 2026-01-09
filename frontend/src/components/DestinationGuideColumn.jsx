import { useState } from "react";
import FlightCard from "./FlightCard";
import InfoSectionCard from "./InfoSectionCard";
import formatDate from "../utils/formatDate";
import WeatherCard from "./WeatherCard";
import { Sparkles, Info } from "lucide-react";
import InfoTooltip from "../utils/InfoToolTip";
import currencyFormatter from "../utils/currencyFormatter";
import buildGoogleHotelsUrl from "../utils/buildGoogleHotelsUrl";
import buildGooglePackagesUrl from "../utils/buildGooglePackagesUrl";

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
 * - isBestValue: Boolean to indicate if this destination is the best value (default: false)
 * - weather: An object containing live weather data (optional)
 *
 * Returns:
 * - JSX.Element: The rendered destination guide column component.
 */
const DestinationGuideColumn = ({
    titlePrefix,
    guide,
    origin,
    departureDate,
    returnDate,
    selectedCurrency,
    passengers,
    showHeader = true,
    isBestValue = false,
    weather,
    realFlights = [],
}) => {

    // State for the modal containing the full list of live fares
    const [showFaresModal, setShowFaresModal] = useState(false);


    if (!guide) return null;

    const totalPassengers = 
        (passengers?.adults ?? 0) +
        (passengers?.youngAdults ?? 0) +
        (passengers?.children ?? 0) +
        (passengers?.infants ?? 0);

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

    const uniqueRealFlights = (() => {
        if (!realFlights || realFlights.length === 0) return [];

        const seen = new Set();
        const result = [];

        for (const offer of realFlights) {
            const airline =
                offer.airlineName ||
                offer.airlineCode ||
                offer.carrierCode ||
                "Flight"
            ;

            const stops = typeof offer.stops === "number" ? offer.stops : 0;

            // Key: airline + price + stops
            const key = `${airline}-${offer.price}-${stops}`;

            if (!seen.has(key)) {
                seen.add(key);
                result.push(offer);
            }
        }

        return result;
    })();

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

            {/* Flights from Gemini*/}
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
                                originName={guide?.originName || origin || ""}
                                destinationName={guide?.destinationName || ""} // From Gemini JSON data
                                departureDate={departureDate}
                                returnDate={returnDate}
                                totalPassengers={totalPassengers}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Live prices (beta) from real API */}
            {Array.isArray(uniqueRealFlights) && uniqueRealFlights.length > 0 && (() => {
                // 🔒 Extra safety: if deduped list is empty, render nothing
                if (!uniqueRealFlights || uniqueRealFlights.length === 0) {
                    return null;
                }

                const topOffer = uniqueRealFlights[0]; // cheapest unique offer

                return (
                    <>
                        <section className="space-y-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-sky-900 uppercase tracking-wide">
                                    🔥 Live prices (beta)
                                </h4>
                                <span className="text-[10px] text-sky-700">
                                    From real flight API
                                </span>
                            </div>

                            {/* single highlighted fare */}
                            <div className="space-y-1.5">
                                <div
                                    key={
                                        topOffer.id ||
                                        `${topOffer.carrierCode}-${topOffer.flightNumber}-${topOffer.price}`
                                    }
                                    className="flex items-center justify-between rounded-lg bg-sky-50/70 border border-sky-100 px-3 py-2 text-xs text-stone-800"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-semibold">
                                            {topOffer.airlineName ||
                                                topOffer.airlineCode ||
                                                topOffer.carrierCode ||
                                                "Flight"}
                                        </span>

                                        {topOffer.origin && topOffer.destination && (
                                            <span className="text-[11px] text-stone-600">
                                                {topOffer.origin} → {topOffer.destination}
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-right">
                                        <span className="text-sm font-bold text-orange-600">
                                            {currencyFormatter(
                                                "en-US",
                                                selectedCurrency,
                                                topOffer.price
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <p className="text-[10px] text-stone-500">
                                    Snapshot only – tap a flight above and use{" "}
                                    <span className="italic">“Search on Google Flights”</span>{" "}
                                    for full availability and options.
                                </p>

                                {uniqueRealFlights.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowFaresModal(true)}
                                        className="ml-2 text-[10px] text-sky-700 underline underline-offset-2 hover:text-sky-900"
                                    >
                                        View all {uniqueRealFlights.length} live fares
                                    </button>
                                )}
                            </div>
                        </section>
                    </>
                );
            })()}

            {/* Live weather */}
            {weather && <WeatherCard weather={weather} />}

            {/* Hotels */}
            {guide.hotelInfo && (
                <div className="space-y-2">
                    <InfoSectionCard title="Where to stay" emoji="🏨">
                        {guide.hotelInfo}
                        <div className="mt-3 flex flex-col items-end gap-0.5">
                            <a
                                href={hotelsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs sm:text-sm font-semibold text-sky-700 hover:text-sky-900 underline"
                            >
                                Search hotels in {guide.destinationName}
                            </a>
                            <span className="text-[10px] text-stone-500">
                                (Booking.com)
                            </span>
                            <InfoTooltip label="How the hotel search link works">
                                We open a generic hotel search for {guide.destinationName}.  
                                You can adjust dates, guests and filters directly on the booking site.
                            </InfoTooltip>
                        </div>
                    </InfoSectionCard>
                </div>
            )}

            {/* Packages */}
            {guide.travelPackages && (
                <div className="space-y-2">
                    <InfoSectionCard title="Package deals" emoji="📦">
                        {guide.travelPackages}
                        <div className="mt-3 flex flex-col items-end gap-0.5">
                            <a
                                href={packagesUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs sm:text-sm font-semibold text-sky-700 hover:text-sky-900 underline"
                            >
                                Search package holidays
                            </a>
                            <span className="text-[10px] text-stone-500">
                                (External travel sites)
                            </span>
                            <InfoTooltip label="How the package search link works">
                                We send you to a search page for package holidays in{" "}
                                {guide.destinationName}.  
                                Results and availability depend on each travel provider.
                            </InfoTooltip> 
                        </div>
                    </InfoSectionCard>               
                </div>
            )}

            {/* Comparison */}
            {guide.comparisonInfo && (
                <InfoSectionCard title="What’s the best option?" emoji="⚖️">
                    {guide.comparisonInfo}
                </InfoSectionCard>
            )}

            {/* Live fares modal */}
            {showFaresModal && Array.isArray(uniqueRealFlights) && uniqueRealFlights.length > 0 && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                    <div className="mx-4 w-full max-w-md rounded-2xl bg-white/95 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                            <h3 className="text-sm font-semibold text-stone-800">
                                Live fares snapshot
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowFaresModal(false)}
                                className="text-xs text-stone-500 hover:text-stone-800"
                            >
                                Close
                            </button>
                        </div>

                        <div className="max-h-80 space-y-1 overflow-y-auto px-4 py-3">
                            {uniqueRealFlights.map((offer, idx) => (
                                <div
                                    key={
                                        offer.id ||
                                        `${offer.airlineCode || offer.carrierCode || "FL"}-${
                                        offer.flightNumber || idx
                                        }`
                                    }
                                    className="flex items-center justify-between rounded-lg bg-sky-50/80 border border-sky-100 px-3 py-2 text-xs text-stone-800"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-stone-800">
                                            {offer.airlineName ||
                                                offer.airlineCode ||
                                                offer.carrierCode ||
                                                "Flight"}
                                        </span>
                                        {offer.origin && offer.destination && (
                                            <span className="text-[11px] text-stone-600">
                                                {offer.origin} → {offer.destination}
                                            </span>
                                        )}
                                        {offer.departureTime && (
                                            <span className="text-[10px] text-stone-500">
                                                {offer.departureTime}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-orange-600">
                                            {currencyFormatter(
                                                "en-US",
                                                selectedCurrency,
                                                offer.price
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-stone-100 px-4 py-3">
                            <p className="text-[10px] leading-relaxed text-stone-500">
                                These fares come from a real flight API and are meant as a
                                quick guide to what prices look like right now. For final
                                availability, baggage rules and seat selection, use{" "}
                                <span className="italic">“Search on Google Flights”</span> or
                                your preferred booking site.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DestinationGuideColumn;
