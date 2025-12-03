import FlightCard from "./FlightCard";
import InfoSectionCard from "./InfoSectionCard";
import formatDate from "../utils/formatDate";

const DestinationGuideColumn = ({
    titlePrefix,
    guide,
    departureDate,
    returnDate,
    selectedCurrency,
    showHeader = true,
}) => {
    if (!guide) return null;

    return (
        <div className="space-y-4">
            {/* Destination header */}
            {showHeader && (
                <div className="bg-gradient-to-r from-sky-100 via-orange-50 to-emerald-50 rounded-xl p-3 shadow-sm border border-amber-100">
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
        )}

            {/* Flights */}
            {guide?.flights?.length > 0 && (
                <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-stone-800">
                        ✈️ Flight options
                    </h4>
                    <div className="space-y-2">
                        {guide.flights.map((f, idx) => (
                            <FlightCard
                                key={f.id || `${f.airline}-${f.flightNumber || idx}`}
                                flight={f}
                                selectedCurrency={selectedCurrency}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Hotels */}
            {guide.hotelInfo && (
                <InfoSectionCard title="Where to stay" emoji="🏨">
                    {guide.hotelInfo}
                </InfoSectionCard>
            )}

            {/* Packages */}
            {guide.travelPackages && (
                <InfoSectionCard title="Package deals" emoji="📦">
                    {guide.travelPackages}
                </InfoSectionCard>
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
