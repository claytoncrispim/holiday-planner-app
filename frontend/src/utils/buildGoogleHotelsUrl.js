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
};

export default buildGoogleHotelsUrl;