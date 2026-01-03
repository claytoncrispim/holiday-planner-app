import { useState, useRef, useEffect } from 'react';
// Import of Components
import CurrencySelector from './components/CurrencySelector';
import LoadingSpinner from './components/LoadingSpinner';
import SearchForm from './components/SearchForm';
import GeneratedImageCard from "./components/GeneratedImageCard";
import TripSummaryBar from "./components/TripSummaryBar";
import SavedTripsPanel from "./components/SavedTripsPanel";
import DestinationGuideColumn from './components/DestinationGuideColumn';
// Import of Formatters
import formatDate from './utils/formatDate';
import toIsoDate from './utils/toIsoDate';

// --- CONFIGURATION ---
// Base URL for the backend API
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";


// --- HELPERS ---

// --- RETRY HELPER FUNCTION ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
    url, 
    options = {}, 
    { retries = 2, delay = 4000 } = {}
) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, options);

            // If it's a "cold backend" style status, retry a couple of times
            if (!res.ok && [502, 503, 504].includes(res.status) && attempt < retries) {
                console.warn(
                `Request to ${url} failed with status ${res.status}. Retrying in ${delay}ms... (Attempt ${
                    attempt + 1
                } of ${retries + 1})`
                );
                await sleep(delay);
                continue;
            }

            // Return the response *even if* it's not ok.
            // callGemini / other callers will inspect res.ok / res.status.
            return res;
            } catch (err) {
            lastError = err;
            console.warn(`Request to ${url} failed on attempt ${attempt}:`, err);

            if (attempt < retries) {
                await sleep(delay);
                continue;
            }

            // All retries exhausted → propagate network error
            throw lastError;
            }
        }

        // Should never reach here, but just in case:
        throw lastError || new Error("Unknown error in fetchWithRetry");
        }

// --- GEMINI API CALL FUNCTION ---
// Helper function for Gemini initialization
const callGemini = async (prompt) => {
    let response;
    try {
        response = await fetchWithRetry(
            `${API_BASE_URL}/generate-guide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
    } catch (networkErr) {
        // Network, CORS, or backend not runnning error
        const err = new Error("NETWORK_ERROR");
        err.cause = networkErr;
        throw err;
    }

    let data;
    try {
        data = await response.json();
    } catch (parseErr) {
        const err = new Error("INVALID_JSON_FROM_SERVER");
        err.status = response.status;
        err.cause = parseErr;
        throw err;
    }

    if (!response.ok) {
        // Backend returned an error status
        const message =
            data?.error ||
            `Server returned an error (${response.status}). Please try again`;

        const err = new Error(message);
        err.status = response.status;
        throw err;
    }

    // The backend now returns structured JSON, so we return it directly
    if (!data || typeof data !== "object") {
        throw new Error("UNEXPECTED_RESPONSE_SHAPE");
    }

    return data;
}

// --- NIGHTS CALCULATION FUNCTION ---
// Helper function to calculate number of nights between two dates
const calculateNights = (start, end) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate) || isNaN(endDate)) return null;

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;

}

// --- PROMPT BUILDER FUNCTION ---
// Helper function to build the Gemini prompt
const buildPrompt = ({
    origin,
    destination,
    departureDate,
    returnDate,
    passengers,
    nights,
    budgetLevel,
    selectedCurrency,
    weatherSummary,
}) => {
    // Detect if there are minors in the group
    const hasMinors = 
        passengers &&
            (   
                // if any of these counts are greater than zero
                // then we have minors in the group
                // at least one child, infant, or young adult
                // considered a minor for travel purposes
                (passengers.children ?? 0) > 0 ||
                (passengers.infants ?? 0) > 0 ||
                (passengers.youngAdults ?? 0) > 0
            );
    
    const imagePromptInstruction = hasMinors
    ? `
        Create the imageGenPrompt so that it focuses mainly on the scenery
        and atmosphere of ${destination}. You may include a few generic
        adult travellers in the distance, but DO NOT mention children,
        kids, minors, teens, or infants explicitly in the imageGenPrompt.
        The style should be photorealistic but travel-poster friendly.
      `
    : `
        Create the imageGenPrompt as a photorealistic travel scene of
        adult travellers enjoying iconic landmarks or activities in
        ${destination} during ${
          nights !== null ? nights + " nights" : "their trip"
        }.
        Focus on a diverse group of adult travellers and the destination's
        key scenery, regardless of the budget level.
        Ensure the diverse group of adults are people of various ethnicities and backgrounds.
      `;
    
    return `
        Generate a JSON object describing travel options for:
        Origin: ${origin}
        Destination: ${destination}
        Date: ${formatDate(departureDate)} to ${formatDate(returnDate)}
        Passengers: ${JSON.stringify(passengers)}
        Trip length in nights: ${nights !== null ? nights : "Not specified"
        }.
        Budget level: ${budgetLevel || "not specified"
        } (low = budget-conscious, medium = balanced, high = comfort-focused).

        ${
            weatherSummary
            ? `Real live-weather summary for these dates: ${weatherSummary}.
            Use this when describing outdoor activities, packing tips (e.g. light layers vs. warm clothing), and whether it is better for sun-seeking, mild city exploring, or cooler escapes.`
            : ""
        }  

        Use the budget level when describing flight choices, hotels, and packages.

        For example, for low budget focus on economy options and value deals, for high budget highlight comfort, convenience, and premium experiences.

        The JSON must contain (DO NOT include code fences or markdown formatting.):
        - originName
        - destinationName
        - flights (array) {
            airline (string)
            flightNumber (string)
            flightPricePerPerson (number)

            For each flight, calculate totalPrice as:
                totalFlightPrice = flightPricePerPerson * (number of Passengers)
            Return prices in chosen currency: ${selectedCurrency}
        }
        - hotelInfo (string)
        - travelPackages (string)
        - comparisonInfo (string)
        - imageGenPrompt (string)

        If the trip length is provided, tailor flight, hotel, and package recommendations to that duration (e.g., suitable for a weekend, 7 nights, or a long stay).

        Ensure all prices reflect the selected currency: ${selectedCurrency}.

        ${imagePromptInstruction}
    `;
}

// --- FLIGHT PRICE EXTRACTION HELPER ---
// Helper function to get the cheapest flight price from the guide data
const getCheapestFlightPrice = (guide) => {
  if (!guide || !Array.isArray(guide.flights) || guide.flights.length === 0) {
    return null;
  }

  let min = null;

  for (const f of guide.flights) {
    // Try a bunch of possible fields Gemini might use
    let raw =
      f.totalFlightPrice ??
      f.totalPriceEUR ??
      f.totalPrice ??
      f.flightTotalPrice ??
      f.flightPrice ??
      f.flightPricePerPerson ??
      f.priceEUR ??
      f.price ??
      null;

    let price = null;

    if (typeof raw === "number") {
      price = raw;
    } else if (typeof raw === "string") {
      // Strip currency symbols and text, keep digits / separators
      const cleaned = raw.replace(/[^\d.,-]/g, "").replace(",", ".");
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        price = parsed;
      }
    }

    if (typeof price === "number" && !isNaN(price)) {
      if (min === null || price < min) {
        min = price;
      }
    }
  }

  return min;
};

// --- WEATHER FETCH HELPER ---
// Helper function to fetch weather forecast from backend
const fetchWeatherForDestination = async (destination) => {
    if (!destination) return null;

    try {
        const res = await fetchWithRetry(
            `${API_BASE_URL}/weather?destination=${encodeURIComponent(
                destination
            )}`
        );

        if (!res.ok) {
            console.error("Weather API error:", res.status, await res.text());
            return null;
        }

        const data = await res.json();
        return data;
    } catch (err) {
        console.error("Weather fetch failed:", err);
        return null;
    }
}

// --- END OF HELPERS --- 


// --- MAIN APP COMPONENT ---
const App = () => {

    // **** STATE VARIABLES ****

    // --- Currency state ---
    // State for the selected currency
    const [selectedCurrency, setSelectedCurrency] = useState('');

    // --- Search states ---
    // State for the origin input
    const [origin, setOrigin] = useState('');
    // State for the destination input
    const [destination, setDestination] = useState('');
    // State for the compare destination input
    const [compareDestination, setCompareDestination] = useState('');
    // State for the departure date
    const [departureDate, setDepartureDate] = useState('');
    // State for the return date
    const [returnDate, setReturnDate] = useState('');
    // State for date error messages
    const [dateError, setDateError] = useState(null);
    // State for passenger details
    const [passengers, setPassengers] = useState({
        adults: 1,
        youngAdults: 0,
        children: 0,
        infants: 0,
    });

    // --- States for managing the travel guide response ---
    // Primary guide data State to hold the travel guide from the Gemini API
    const [guideData, setGuideData] = useState(null);
    // Secondary guide data state to hold the travel guide from the Gemini API for comparison
    const [guideDataSecondary, setGuideDataSecondary] = useState(null);
    // State to manage loading status
    const [loading, setLoading] = useState(false);
    // State to hold any potential error messages
    const [error, setError] = useState(null);

    // State to manage the lifecycle of the image generation
    const [imageUrl, setImageUrl] = useState(null);
    const [isImageLoading, setIsImageLoading] = useState(false);

    // Budget state
    const [budgetLevel, setBudgetLevel] = useState("medium");

    // --- Saved trips state ---
    const [savedTrips, setSavedTrips] = useState([]);

    // --- Weather state ---
    // Live weather for the primary destination
    const [weatherPrimary, setWeatherPrimary] = useState(null);
    // Live weather for the comparison destination (if any)
    const [weatherSecondary, setWeatherSecondary] = useState(null);

    // --- Real flight offers (Live API)
    const [realFlightsPrimary, setRealFlightsPrimary] = useState([]);
    const [realFlightsCompare, setRealFlightsCompare] = useState([]);


    // **** END OF STATE VARIABLES ****



    // **** EFFECTS *****

    // Load saved trips from localStorage on initial render
    useEffect(() => {
        try {
            const raw = localStorage.getItem("holidayPlanner.savedTrips");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setSavedTrips(parsed);
                }
            }
        } catch (err) {
            console.error("Error loading saved trips from localStorage:", err);
        }
    }, []);

    // Persist to localStorage when savedTrips changes
    useEffect(() => {
        try {
            localStorage.setItem(
                "holidayPlanner.savedTrips",
                JSON.stringify(savedTrips)
            );
        } catch (err) {
            console.error("Error saving trips to localStorage:", err);
        }
    }, [savedTrips]);


    // Fetch weather for the primary destination whenever the main guide changes
    useEffect(() => {
        const loadWeather = async () => {
            if (!guideData || !guideData.destinationName) {
                setWeatherPrimary(null);
                return;
            }

            const data = await fetchWeatherForDestination(
                guideData.destinationName
            );
            setWeatherPrimary(data);
        };

        loadWeather();
    }, [guideData?.destinationName]);

    // Fetch weather for the secondary destination in compare mode
    useEffect(() => {
        const loadWeatherSecondary = async () => { 
            if (!guideDataSecondary || !guideDataSecondary.destinationName) {
                setWeatherSecondary(null);
                return;
            }

            const data = await fetchWeatherForDestination(
                guideDataSecondary.destinationName
            );

            setWeatherSecondary(data);
        };

        loadWeatherSecondary();
    }, [guideDataSecondary?.destinationName]);


    // **** END OF EFFECTS *****


    // **** REFS *****
    // Ref for the search form to enable scrolling into view
    const searchFormRef = useRef(null);


    // **** HANDLER FUNCTIONS *****

    // --- HANDLER FUNCTION: Change Trip ---
    // This function scrolls the view to the search bar for modifying the trip.
    const handleChangeTrip = () => {
        if (searchFormRef.current) {
            searchFormRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    // --- HANDLER FUNCTION: Image Generation ---
    // This function handles the image generation process.
    const handleGenerateImage = async (prompt) => {
        setIsImageLoading(true);
        setImageUrl(null);

        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/generate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });

            const data = await response.json();

            const base64 = data.predictions?.[0]?.bytesBase64Encoded;
            if (!base64) {
                console.warn('No image returned from image generation. Prompt may have been blocked.');
                return;
            }

            setImageUrl(`data:image/png;base64,${base64}`);
        } catch (err) {
            console.error('Image generation error:', err);
        } finally {
            setIsImageLoading(false);
        }
    };

    // --- HANDLER FUNCTION: Get Travel Guide ---
    // This function fetches the travel guide from the Gemini API based on user input.
    const handleGetGuide = async (e) => {
        e.preventDefault();

        // Basic input validation
        if (!origin) {
            setError('Please enter a point of departure.');
            return;
        }

        if (!destination) {
            setError('Please enter a destination.');
            return;
        }

        setLoading(true);
        setError(null);
        setDateError(null);
        setGuideData(null);
        setGuideDataSecondary(null);
        setImageUrl(null);
        setRealFlightsPrimary([]);
        setRealFlightsCompare([]);

        try {
            // Compute trip nights if both dates are provided
            const tripNights =
                departureDate && returnDate
                    ? calculateNights(departureDate, returnDate)
                    : null;

            // If both dates are provided but invalid, show error
            if (departureDate && returnDate && !tripNights) {
                setLoading(false);
                setDateError("Return date must be after departure date.");
                return;
            }

            const destA = destination.trim();
            const destB = compareDestination.trim();

            // --- Fetch live weather BEFORE calling Gemini ---
            let weatherSummaryA = null;
            let weatherSummaryB = null;

            // Primary destination weather
            try {
                const weatherA = await fetchWeatherForDestination(destA);
                if (weatherA && weatherA.found && weatherA.summary?.headline) {
                    weatherSummaryA = weatherA.summary.headline;
                }
                // Update UI weather state immediately
                setWeatherPrimary(weatherA);
            } catch (err) {
                console.error("Error fetching weather for primary destination:", err);
                setWeatherPrimary(null);
            }

            // Comparison destination weather (if any)
            if (destB) {
                try {
                    const weatherB = await fetchWeatherForDestination(destB);
                    if (weatherB && weatherB.found && weatherB.summary?.headline) {
                        weatherSummaryB = weatherB.summary.headline;
                    }
                    // Update UI weather state immediately
                    setWeatherSecondary(weatherB);
                } catch (err) {
                    console.error("Error fetching weather for secondary destination:", err);
                    setWeatherSecondary(null);
                }
            }

            // --- Build prompt for primary destination ---
            const promptA = buildPrompt({
                origin,
                destination: destA,
                departureDate,
                returnDate,
                passengers,
                nights: tripNights,
                budgetLevel,
                selectedCurrency,
                weatherSummary: weatherSummaryA,
            });

            // Always call for primary destination first
            const primaryResponse = await callGemini(promptA);
            console.log("Primary Gemini response:", primaryResponse);
            setGuideData(primaryResponse);

            // --- REAL FLIGHTS FETCH ---
            // Real flights for primary destination
            try {
                // 1. Compute  total passengers
                const totalPassengers =
                    (passengers.adults ?? 0) +
                    (passengers.youngAdults ?? 0) +
                    (passengers.children ?? 0) +
                    (passengers.infants ?? 0);

                // 2. Prepare params for the ral flights endpoint
                const originCode = origin.trim().toUpperCase();
                const destinationCode = destination.trim().toUpperCase();
                const departureISO = toIsoDate(departureDate);
                const returnISO = toIsoDate(returnDate);

                // Only hit the API if origin/destination look like IATA codes (3 letters)
                const iataRegex = /^[A-Z]{3}$/;

                if (
                    iataRegex.test(originCode) &&
                    iataRegex.test(destinationCode) &&
                    departureISO
                ) {
                    const queryParams = new URLSearchParams({
                        origin: originCode,
                        destination: destinationCode,
                        departureDate: departureISO,
                        adults: String(totalPassengers || 1),
                    });

                    if (returnISO) {
                        queryParams.set("returnDate", returnISO);
                    }

                    const realFlightResponse = await fetchWithRetry(
                        `${API_BASE_URL}/real-flights?${queryParams.toString()}`
                        );

                        // IMPORTANT: parse JSON
                        const realFlightsJson = await realFlightResponse.json();

                        // DEBUG LOG
                        console.log("Real flights JSON (primary):", realFlightsJson);

                        // Extract offers safely
                        let offers = [];
                        if (Array.isArray(realFlightsJson.offers)) {
                        offers = realFlightsJson.offers;
                        } else if (Array.isArray(realFlightsJson.data)) {
                        offers = realFlightsJson.data;
                        }

                        // Push into state (or empty if nothing valid)
                        setRealFlightsPrimary(offers);

                    } else {
                        // If they typed city names instead of IATA codes, just clear live prices
                        setRealFlightsPrimary([]);
                    }
                } catch (err) {
                    console.error("Real flights fetch failed:", err);
                    setRealFlightsPrimary([]);
                }

            // Live prices for comparison destination (Option B)
            try {
                if (hasComparison) {
                    const totalPassengers =
                    (passengers.adults ?? 0) +
                    (passengers.youngAdults ?? 0) +
                    (passengers.children ?? 0) +
                    (passengers.infants ?? 0);

                    const originCode = origin.trim().toUpperCase();
                    const compareCode = compareDestination.trim().toUpperCase();
                    const departureISO = toIsoDate(departureDate);
                    const returnISO = toIsoDate(returnDate);
                    const iataRegex = /^[A-Z]{3}$/;

                    if (
                    iataRegex.test(originCode) &&
                    iataRegex.test(compareCode) &&
                    departureISO
                    ) {
                    const queryParamsB = new URLSearchParams({
                        origin: originCode,
                        destination: compareCode,
                        departureDate: departureISO,
                        adults: String(totalPassengers || 1),
                    });
                    if (returnISO) queryParamsB.set("returnDate", returnISO);

                    const realFlightResponseB = await fetchWithRetry(
                        `${API_BASE_URL}/real-flights?${queryParamsB.toString()}`
                    );

                    const realFlightsJsonB = await realFlightResponseB.json();
                    console.log("Real flights JSON (compare):", realFlightsJsonB);

                    let offersB = [];
                    if (Array.isArray(realFlightsJsonB.offers)) {
                        offersB = realFlightsJsonB.offers;
                    } else if (Array.isArray(realFlightsJsonB.data)) {
                        offersB = realFlightsJsonB.data;
                    }

                    setRealFlightsCompare(offersB);
                    } else {
                    setRealFlightsCompare([]);
                    }
                } else {
                    // no compare destination, make sure column B is empty
                    setRealFlightsCompare([]);
                }
                } catch (err) {
                console.error("Real flights fetch failed (compare):", err);
                setRealFlightsCompare([]);
                }


            // Generate image based on primary suggestion
            if (primaryResponse.imageGenPrompt) {
                await handleGenerateImage(primaryResponse.imageGenPrompt);
            }

            // If there is no comparison destination, we are done
            if (!destB) {
                return;
            }

            // Build prompt for secondary destination
            const promptB = buildPrompt({
                origin,
                destination: destB,
                departureDate,
                returnDate,
                passengers,
                nights: tripNights,
                budgetLevel,
                selectedCurrency,
                weatherSummary: weatherSummaryB,
            });

            // Call for secondary destination
            const secondaryResponse = await callGemini(promptB);
            console.log("Secondary Gemini response:", secondaryResponse);
            setGuideDataSecondary(secondaryResponse);

        } catch (err) {
            console.error("Frontend error in handleGetGuide:", err);

            // Safe default
            let userMessage =
                "Something went wrong while generating your travel guide. Please try again.";

            // Custom network marker from callGemini
            if (err.message === "NETWORK_ERROR") {
                userMessage =
                    "Oops! I couldn’t reach the Holiday Planner server on the first try. " +
                    "If this is your first request in a while, the server might be waking up. " +
                    "Please wait a few seconds and try again.";

                console.error("Please check if the server is running on " + API_BASE_URL + ". Network error details:", err.cause);
            }
            // JSON parse / unexpected format from backend
            else if (
                err.message === "INVALID_JSON_FROM_SERVER" ||
                err.message === "UNEXPECTED_RESPONSE_SHAPE"
            ) {
                userMessage =
                    "The AI reply came back in an unexpected format. Please try again in a moment.";
            }
            // HTTP status-based messages from backend
            else if (typeof err.status === "number") {
                if (err.status === 429) {
                    userMessage =
                        "The AI service is receiving too many requests right now. Please wait a few seconds and try again.";
                } else if (err.status >= 500) {
                    userMessage =
                        "Our server had a problem while generating your guide. Please try again shortly.";
                } else if (err.status >= 400 && err.status < 500) {
                    userMessage =
                        "There was an issue with the request. Please check your inputs and try again.";
                }
            }
            // Fallback: use any other message (except the internal marker)
            else if (err.message && err.message !== "NETWORK_ERROR") {
                userMessage = err.message;
            }

            setError(userMessage);
        } finally {
            console.log("DEBUG: loading set to FALSE");
            setLoading(false);
        }
    };

    // --- HANDLER FUNCTION: Reset Search ---
    // This function resets the search inputs and results.
    const handleResetSearch = () => {
        setOrigin('');
        setDestination('');
        setCompareDestination('');
        setDepartureDate('');
        setReturnDate('');
        setPassengers({
            adults: 1,
            youngAdults: 0,
            children: 0,
            infants: 0,
        });
        setBudgetLevel("medium");
        setGuideData(null);
        setGuideDataSecondary(null);
        setError(null);
        setImageUrl(null);
    };

    // --- HANDLER FUNCTION: Save Trip ---
    // This function saves the current trip to localStorage.
    const handleSaveCurrentTrip = () => {
        if (!guideData) return;

        const nights = calculateNights(departureDate, returnDate);

        const newTrip = {
            id: Date.now().toString(),
            origin,
            destination,
            compareDestination: compareDestination || "",
            departureDate,
            returnDate,
            nights,
            passengers,
            budgetLevel,
            selectedCurrency,
            createdAt: new Date().toISOString(),
        };

        // Avoid duplicates based on all key details
        // Obs: If we wanted to allow duplicates, we could skip this check
        const isDuplicate = savedTrips.some((t) =>
            t.origin === newTrip.origin &&
            t.destination === newTrip.destination &&
            t.departureDate === newTrip.departureDate &&
            t.returnDate === newTrip.returnDate &&
            t.budgetLevel === newTrip.budgetLevel &&
            t.selectedCurrency === newTrip.selectedCurrency
        );

        if (isDuplicate) {
            return;
        }

        setSavedTrips((prev) => [newTrip, ...prev]);
    };

    // --- HANDLER FUNCTION: Select Saved Trip ---
    // This function loads a saved trip into the search form.
    const handleSelectSavedTrip = (trip) => {
        setOrigin(trip.origin || "");
        setDestination(trip.destination || "");
        setCompareDestination(trip.compareDestination || "");
        setDepartureDate(trip.departureDate || "");
        setReturnDate(trip.returnDate || "");
        setPassengers(trip.passengers || {
            adults: 1,
            youngAdults: 0,
            children: 0,
            infants: 0,
        });
        setBudgetLevel(trip.budgetLevel || "medium");
        setSelectedCurrency(trip.selectedCurrency || selectedCurrency);

        // Clear current results so user knows they need to rerun
        setGuideData(null);
        setImageUrl(null);
        setError(null);
        setDateError(null);

        // Scroll to the form so the user can review and click "Find destination"
        if (searchFormRef.current) {
            searchFormRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    };

    // --- HANDLER FUNCTION: Delete Saved Trip ---
    // This function deletes a saved trip from localStorage.
    const handleDeleteTrip = (id) => {
        setSavedTrips((prev) => prev.filter((t) => t.id !== id));
    };

    // **** END OF HANDLER FUNCTIONS *****

    // Compute if comparison mode is active - Result has to be strictly a Boolean
    const hasComparison =
        !!(compareDestination && compareDestination.trim().length > 0);

    // --- COMPUTE DERIVED VALUES ---
    // Compute the cheapest flight prices for display
    const cheapestA = getCheapestFlightPrice(guideData);
    const cheapestB = getCheapestFlightPrice(guideDataSecondary);
    // Sanity check: only show cheaper label if prices are different
    console.log("Cheapest A:", cheapestA, "Cheapest B:", cheapestB);

    let cheaperLabel = null;
    if (
        typeof cheapestA === "number" &&
        typeof cheapestB === "number" &&
        cheapestA !== cheapestB
    ) {
        // Determine which guide is cheaper
        // If guide A is cheaper, it's guideData, else guideDataSecondary
        const cheaperGuide =
            cheapestA < cheapestB ? guideData : guideDataSecondary;

        cheaperLabel = cheaperGuide.destinationName || null;
    }

    // Flags for "best value" badges in compare mode
    const hasBothPrices =
        typeof cheapestA === "number" && typeof cheapestB === "number";

    const isBestValueA = hasBothPrices && cheapestA < cheapestB;
    const isBestValueB = hasBothPrices && cheapestB < cheapestA;

    // Is the current trip already saved?
    const isCurrentTripSaved =
        !!guideData &&
        savedTrips.some((t) =>
            t.origin === origin &&
            t.destination === destination &&
            t.departureDate === departureDate &&
            t.returnDate === returnDate &&
            t.budgetLevel === budgetLevel &&
            t.selectedCurrency === selectedCurrency
        );


    // --- RENDER THE APP COMPONENT ---
    return (
        <div className="relative min-h-screen font-sans p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-3xl">
                
                {/* Soft Imagen background overlay */}
                {imageUrl && !isImageLoading && (
                    <div
                        className="
                            pointer-events-none
                            absolute inset-0
                            opacity-10
                            sm:opacity-20
                            bg-cover bg-center
                            blur-sm
                        "
                        style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                )}

                {/* HEADER */}
                <header className="text-center my-6 md:my-8">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-800">
                        Holiday Planner 🏖️
                    </h1>
                    <p className="mt-2 text-sm md:text-base text-stone-600">
                        Your AI guide to the world&apos;s destinations.
                    </p>

                    {/* Badge */}
                    <div className="flex justify-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1 shadow-sm">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                                Beta
                            </span>
                            <span className="text-[11px] text-stone-500">
                                AI-powered holiday planning
                            </span>
                        </div>
                    </div>
                </header>


                <main>
                    {/* CURRENCY SELECTOR */}
                    <CurrencySelector
                        selectedCurrency={selectedCurrency}
                        onCurrencyChange={setSelectedCurrency}
                    />

                    {/* TRIP SUMMARY BAR */}
                    {guideData && (
                        <TripSummaryBar
                            originName={guideData.originName || origin}
                            destinationName={guideData.destinationName || destination}
                            departureDate={departureDate}
                            returnDate={returnDate}
                            passengers={passengers}
                            budgetLevel={budgetLevel}
                            isSaved={isCurrentTripSaved}
                            onChangeTrip={handleChangeTrip}
                        />
                    )}

                    {/* SAVED TRIPS AREA */}
                    {(guideData || savedTrips.length > 0) && (
                    <section className="mt-6">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 mb-1">
                        Saved trips
                        </h2>

                        {savedTrips.length === 0 ? (
                        <p className="text-xs sm:text-sm text-stone-400">
                            You haven&apos;t saved any trips yet. When you find something you like,
                            hit{" "}
                            <span className="font-semibold text-emerald-700">
                            “Save this trip”
                            </span>{" "}
                            and it will appear here.
                        </p>
                        ) : (
                        <SavedTripsPanel
                            savedTrips={savedTrips}
                            onSelectTrip={handleSelectSavedTrip}
                            onDeleteTrip={handleDeleteTrip}
                            currentTrip={{
                                origin,
                                destination,
                                compareDestination,
                                departureDate,
                                returnDate,
                                budgetLevel,
                                selectedCurrency,
                            }}
                        />
                        )}
                    </section>
                    )}

                    {/* SAVE TRIP BUTTON */}
                    {guideData && (
                        <div className="flex justify-end mt-1">
                            <button
                                type="button"
                                // Disable click if already saved, to avoid double saves, else call handler
                                onClick={isCurrentTripSaved ? undefined : handleSaveCurrentTrip}
                                disabled={loading || isCurrentTripSaved}
                                className={`text-xs sm:text-sm font-semibold underline disabled:opacity-60 ${
                                    isCurrentTripSaved
                                        ? "text-emerald-600 cursor-default"
                                        : "text-emerald-700 hover:text-emerald-800"
                                }`}
                            >
                                {isCurrentTripSaved ? "Saved" : "Save this trip"}
                            </button>
                        </div>
                    )}

                    {/* SEARCH FORM (scrolls into view when changing trip) */}
                    <div ref={searchFormRef}>
                        <SearchForm
                            origin={origin}
                            setOrigin={setOrigin}
                            destination={destination}
                            setDestination={setDestination}
                            compareDestination={compareDestination}
                            setCompareDestination={setCompareDestination}
                            departureDate={departureDate}
                            setDepartureDate={setDepartureDate}
                            returnDate={returnDate}
                            setReturnDate={setReturnDate}
                            passengers={passengers}
                            setPassengers={setPassengers}
                            budgetLevel={budgetLevel}
                            setBudgetLevel={setBudgetLevel}
                            handleGetGuide={handleGetGuide}
                            loading={loading}
                        />
                    </div>

                    {/* HELPER TIP - only before the first result and when there is no error */}
                    {!guideData && !error && (
                        <div className="mt-2 text-xs sm:text-sm text-stone-500 flex justify-center">
                            <p className="flex items-center gap-2">
                                <span role="img" aria-label="tip">
                                    💡
                                </span>
                                Try: {" "}
                                <span>
                                    <span className="font-semibold">
                                        Dublin → Tenerife · 7 nights · 2 adults
                                    </span>
                                </span>

                            </p>
                        </div>

                    )}

                    {/* DATE ERROR MESSAGE */}
                    {dateError && (
                        <div className="mt-2 text-xs text-red-600 text-center">
                            {dateError}
                        </div>
                    )}

                    {/* CLEAR / NEW SEARCH BUTTON – only when there is a result */}
                    {guideData && (
                        <div className="flex justify-end mt-2">
                            <button
                                type="button"
                                onClick={handleResetSearch}
                                disabled={loading || isImageLoading}
                                className="text-xs sm:text-sm font-semibold text-stone-500 hover:text-stone-700 
                                underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Start new search
                            </button>
                        </div>
                    )}

                    {/* ERRORS */}
                    {error && (
                        <div className="mt-4 flex justify-center">
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-xs sm:text-sm max-w-md">
                                <span className="font-semibold mr-1">Oops!</span>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* MAIN LOADING SPINNER */}
                    {loading && (
                        <div className="w-full flex justify-center mt-10">
                            <LoadingSpinner />
                        </div>
                    )}
                    
                    {/* SINGLE DESTINATION MODE */}
                    {!loading && guideData && !guideDataSecondary && (
                    <section className="mt-8 space-y-6 fade-in-soft">
                        {/* Existing single-destination layout, using guideData exactly as before */}
                        <div className="bg-gradient-to-r from-sky-100 via-orange-50 to-emerald-50 rounded-2xl p-4 sm:p-5 shadow-md border border-amber-100">
                            <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">
                                Suggested trip
                            </p>
                            <h2 className="text-2xl font-bold text-stone-800">
                                {guideData.originName
                                ? `${guideData.originName} → ${guideData.destinationName}`
                                : guideData.destinationName}
                            </h2>
                            <p className="text-sm text-stone-600 mt-1">
                                From{" "}
                                <span className="font-semibold">
                                {formatDate(departureDate)}
                                </span>{" "}
                                to{" "}
                                <span className="font-semibold">
                                {formatDate(returnDate)}
                                </span>
                            </p>
                        </div>

                        {/* Flights, hotels, comparison using the previous cards */}
                        {/* You can keep the old structure here or use DestinationGuideColumn for consistency */}

                        {/* SINGLE DESTINATION Guide Column */}                                        
                        <DestinationGuideColumn
                            titlePrefix="Destination"
                            guide={guideData}
                            origin={origin}
                            departureDate={departureDate}
                            returnDate={returnDate}
                            selectedCurrency={selectedCurrency}
                            passengers={passengers}
                            showHeader={false}
                            weather={weatherPrimary}
                            realFlights={realFlightsPrimary}
                        />
                    </section>
                    )}

                    {/* COMPARE MODE: TWO DESTINATIONS */}
                    {!loading && guideData && guideDataSecondary && (
                    <section className="mt-8 space-y-4 fade-in-soft">
                        <div className="text-center">
                            <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">
                                Comparing destinations
                            </p>
                            <h2 className="text-xl md:text-2xl font-semibold text-stone-800">
                                {guideData.destinationName} vs{" "}
                                {guideDataSecondary.destinationName}
                            </h2>
                            <p className="text-xs text-stone-500 mt-1">
                                Same dates, passengers and budget — different vibes.
                            </p>
                            {cheaperLabel && (
                                <p className="mt-1 text-xs text-emerald-700">
                                    💡 Based on the cheapest flights,{" "}
                                    <span className="font-semibold">{cheaperLabel}</span> looks a bit
                                    more budget-friendly.
                                </p>
                            )}
                        </div>

                        {/* Destination A */}
                        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                            <DestinationGuideColumn
                                titlePrefix="Option A"
                                guide={guideData}
                                origin={origin}
                                departureDate={departureDate}
                                returnDate={returnDate}
                                selectedCurrency={selectedCurrency}
                                passengers={passengers}
                                isBestValue={isBestValueA}
                                weather={weatherPrimary}
                                realFlights={realFlightsPrimary}
                            />
                            {/* Destination B */}
                            <DestinationGuideColumn
                                titlePrefix="Option B"
                                guide={guideDataSecondary}
                                origin={origin}
                                departureDate={departureDate}
                                returnDate={returnDate}
                                selectedCurrency={selectedCurrency}
                                passengers={passengers}
                                isBestValue={isBestValueB}
                                weather={weatherSecondary}
                                realFlights={realFlightsCompare}
                            />
                        </div>
                    </section>
                    )}

                    {/* IMAGE LOADING SPINNER */}
                    {isImageLoading && (
                        <div className="w-full flex justify-center mt-10">
                            <LoadingSpinner />
                        </div>
                    )}

                    {/* IMAGE DISPLAY */}
                    {!isImageLoading && imageUrl && (
                        <GeneratedImageCard
                            imageUrl={imageUrl}
                            destinationName={guideData?.destinationName}
                            originName={guideData?.originName}
                            departureDate={departureDate}
                            returnDate={returnDate}
                        />
                    )}
                </main>

                {/* Footer and Credits */}
                <footer className="mt-10 text-center text-[11px] text-stone-400">
                    <p>
                        Built by <a href="https://www.claytoncrispim.com" target="_blank" rel="noopener noreferrer" className="underline">Clayton Crispim </a> · Powered by Gemini & Imagen
                    </p>
                </footer>
            </div>
        </div>
    )
}

export default App