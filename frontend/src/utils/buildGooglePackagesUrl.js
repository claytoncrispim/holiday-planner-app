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
};

export default buildGooglePackagesUrl;