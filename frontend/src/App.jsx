import { useState, useRef, useEffect } from 'react';
// Import of Components
import CurrencySelector from './components/CurrencySelector';
import LoadingSpinner from './components/LoadingSpinner';
import SearchForm from './components/SearchForm';
import GeneratedImageCard from "./components/GeneratedImageCard";
import TripSummaryBar from "./components/TripSummaryBar";
import SavedTripsPanel from "./components/SavedTripsPanel";
import DestinationGuideColumn from './components/DestinationGuideColumn';
// Import of Utils
import formatDate from './utils/formatDate';
import buildImagePrompt from './utils/buildImagePrompt';
import hasMinorsInPassengers from './utils/hasMinorsInPassengers';
import { fetchWithRetry } from './utils/fetchWithRetry';
import { ApiError } from './utils/ApiError';
import getUserMessage from './utils/getUserMessage';


// --- CONFIGURATION ---
// Base URL for the backend API
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";


// --- HELPERS ---

// --- GEMINI API CALL FUNCTION ---
// Helper function for Gemini initialization
const callGemini = async (prompt) => {
    try {
        const res = await fetchWithRetry(
            `${API_BASE_URL}/generate-guide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });

        const data = await res.json();

        if (!data || typeof data !== "object") {
            throw new Error("UNEXPECTED_RESPONSE_SHAPE");
        }

        return data;
    } catch (err) {
        // Keep rich errors from backend (VALIDATION_ERROR, UPSTREAM_*, etc.)
        if (err instanceof ApiError) throw err;

        // Network failure / JSOn parse failure / unexpected response shape
        throw err;
    }    
};

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

};

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
    const hasMinors = hasMinorsInPassengers(passengers);
    
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
};

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

        // res is guaranteed ok here; otherwise fetchWithRetry throws and we catch in the outer block
        const data = await res.json();
        return data;
    } catch (err) {
        // Nicer logging for known API errors
        if (err instanceof ApiError) {
            console.warn("Weather API error:", err.status, err.code, err.message);
        } else {
            console.warn("Weather fetch failed:", err);
        }
        return null; // non-blocking
    }
};

// --- REAL FLIGHTS HELPERS ---
// AIRPORT RESOLUTION HELPER: resolve user text into IATA codes via backend
async function resolveAirports({
    origin,
    destination,
    compareDestination,
    API_BASE_URL,
}) {
    const resolveUrl = new URL(`${API_BASE_URL}/resolve-airports`);

    if (origin) resolveUrl.searchParams.set("origin", origin);  
    if (destination) resolveUrl.searchParams.set("destination", destination);
    if (compareDestination) resolveUrl.searchParams.set("compare", compareDestination);

    try {
        const res  = await fetchWithRetry(resolveUrl.toString());
        const resolved = await res.json();
        
        console.log("Resolved airports:", resolved);

        return {
            originIata: resolved.origin?.iataCode ?? null,
            destinationIata: resolved.destination?.iataCode ?? null,
            compareIata: resolved.compare?.iataCode ?? null,
            raw: resolved,
        };
    } catch (err) {
        // Let the caller decide how to display the error, but keep rich info
        if (err instanceof ApiError) {
            // Examples:
            // err.code === "NOT_FOUND" → user typed a fictional place
            // err.code === "UPSTREAM_UNAVAILABLE" -> Amadeus down
            throw err;
        }
        throw err; // network or unexpected error
    }
};

// REALFLIGHTS FETCHER HELPER: Help function to fetch real flight offers
async function fetchRealFlights({
  originIata,
  destinationIata,
  departureDate,
  returnDate,
  passengers,
}) {
    const url = new URL(`${API_BASE_URL}/real-flights`);
    url.searchParams.set("origin", originIata);
    url.searchParams.set("destination", destinationIata);
    url.searchParams.set("departureDate", departureDate);
    // returnDate is included only if it is provided, avoiding sending "null" or empty.
    if (returnDate) url.searchParams.set("returnDate", returnDate);
    url.searchParams.set("adults", String(passengers));

    const res = await fetchWithRetry(url.toString());
    return res.json(); // { offers: [...] }
};


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
    // const [isImageLoading, setIsImageLoading] = useState(false); // REFACTORED: We now have a more granular loading state for different parts of the UI, including image generation, so we replaced isImageLoading with loadingParts.image. This allows us to show loading indicators for specific sections (e.g., "Generating image...") without blocking the entire UI with a generic loading state.

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
    const [realFlightsSecondary, setRealFlightsSecondary] = useState([]);

    // --- Components Loading state ---
    const [loadingParts, setLoadingParts] = useState({
        weatherA: false,
        weatherB: false,
        airports: false,
        flightsA: false,
        flightsB: false,
        guideA: false,
        guideB: false,
        image: false,
    });

    // --- Image Notice State ---
    const [imageNotice, setImageNotice] = useState(null);

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
        setPartLoading("image", true);
        setImageUrl(null);
        setImageNotice(null);

        try {
            const response = await fetchWithRetry(`${API_BASE_URL}/generate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });

            const data = await response.json();

            const base64 = data.predictions?.[0]?.bytesBase64Encoded;
            if (!base64) {
                // Not fatal: image is optional and we can still show the guide data. But log it so we can investigate. 
                console.warn("Image generation returned no image (possibly blocked). Payload:", data);
                setImageNotice("Image isn’t available right now. Showing the guide without it.");
                return null;
            }

            const imgUrl = `data:image/png;base64,${base64}`;
            setImageUrl(imgUrl);
            return imgUrl;
        } catch (err) {
            // Not fatal: image is optional.
            if (err instanceof ApiError) {
                console.warn(
                    'Image generation failed:', 
                    err.status, 
                    err.code, 
                    err.message, 
                    err.details
                );
                
                //  If rate-limited or upstream issue, show a user-friendly hint:
                if (err.status === 429) {
                    setImageNotice("Image generation is rate-limited right now. Try again in a minute.");
                } else {
                    setImageNotice("Image isn’t available right now. Showing the guide without it.");
                }
            } else {
                console.warn('Image generation failed:', err);
                setImageNotice("Image isn’t available right now. Showing the guide without it.");
            }
            return null;
        } finally {
            setPartLoading("image", false);  
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

        // Detect if there are minors in the group (for safe image prompting)
        const hasMinors = hasMinorsInPassengers(passengers);

        setLoading(true);
        setError(null);
        setDateError(null);
        setGuideData(null);
        setGuideDataSecondary(null);
        setImageNotice(null);
        setImageUrl(null);
        setRealFlightsPrimary([]);
        setRealFlightsSecondary([]);

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
            setPartLoading("weatherA", true);
            const weatherA = await fetchWeatherForDestination(destA);
            // Update UI weather state immediately
            setWeatherPrimary(weatherA);
            if (weatherA && weatherA.found && weatherA.summary?.headline) {
                weatherSummaryA = weatherA.summary.headline;
            }
            setPartLoading("weatherA", false);            
       
            // Comparison destination weather (if any)
            if (destB) {
                setPartLoading("weatherB", true);
                const weatherB = await fetchWeatherForDestination(destB);
                // Update UI weather state immediately
                setWeatherSecondary(weatherB); 
                if (weatherB && weatherB.found && weatherB.summary?.headline) {
                    weatherSummaryB = weatherB.summary.headline;
                }
                setPartLoading("weatherB", false);                              
            }

            // --- REAL FLIGHTS FETCH ---
            // Reset previous real flight results
            setRealFlightsPrimary([]);
            setRealFlightsSecondary([]);

            // --- 1) Resolve airports via backend ---
            let originIata = null;
            let destinationIata = null;
            let compareIata = null;

            setPartLoading("airports", true);
            try {                
                const { originIata: oIata, destinationIata: dIata, compareIata: cIata, raw } =
                    await resolveAirports({
                    origin,                 
                    destination: destA,     
                    compareDestination: destB,
                    API_BASE_URL,
                    });

                console.log("Resolved airports (frontend):", raw);

                originIata = oIata;
                destinationIata = dIata;
                compareIata = cIata;
            } catch (err) {
                if (err instanceof ApiError && err.code === "NOT_FOUND") {
                    setError(getUserMessage(err));
                    return;
                }
                setError("Service temporarily unavailable. Please try again.");
                return;
            } finally {
                setPartLoading("airports", false);
            }

            // Compute total passengers once
            const totalPassengers =
            passengers.adults +
            passengers.youngAdults +
            passengers.children +
            passengers.infants;

            // --- 2) Call real-flights for primary destination (if we have IATA codes) ---
            let primaryOffers = [];
            if (originIata && destinationIata) {
                setPartLoading("flightsA", true);
                try {
                    const realJson = await fetchRealFlights({
                    originIata,
                    destinationIata,
                    departureDate,
                    returnDate,
                    passengers: totalPassengers,
                    });
                    primaryOffers = realJson.offers || [];
                } catch (err) {
                    console.error("Real flights (primary) unavailable:", err);
                } finally {
                    setPartLoading("flightsA", false);
                }
            }

            // --- 3) Call real-flights for compare destination, if applicable ---
            let secondaryOffers = [];
            const hasComparison = !!destB;

            if (hasComparison && originIata && compareIata) {
                setPartLoading("flightsB", true);
                try {
                    const realJson = await fetchRealFlights({
                    originIata,
                    destinationIata: compareIata,
                    departureDate,
                    returnDate,
                    passengers: totalPassengers,
                    });
                    secondaryOffers = realJson.offers || [];
                } catch (err) {
                    console.error("Real flights (secondary) unavailable:", err);
                } finally {
                    setPartLoading("flightsB", false);
                }
            }

            // --- 4) Push into state so UI can render ---
            setRealFlightsPrimary(primaryOffers);
            setRealFlightsSecondary(secondaryOffers);


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
            setPartLoading("guideA", true);
            const primaryResponse = await callGemini(promptA);
            console.log("Primary Gemini response:", primaryResponse);
            setGuideData(primaryResponse); 
            setPartLoading("guideA", false);

            // --- IMAGE GENERATION ---
            // Build a safe, diversity-aware, minors-aware prompt for Imagen
            const safeImagePrompt = buildImagePrompt({
                destinationName: primaryResponse.destinationName || destA,
                weatherSummary: weatherSummaryA,
                hasMinors,
            });

            await handleGenerateImage(safeImagePrompt);

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
            setPartLoading("guideB", true);
            const secondaryResponse = await callGemini(promptB);
            console.log("Secondary Gemini response:", secondaryResponse);
            setGuideDataSecondary(secondaryResponse);
            setPartLoading("guideB", false);
        } catch (err) {
            console.error("Frontend error in handleGetGuide:", err);
            setError(getUserMessage(err));
        } finally {
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

    // PARTS LOADING STATE HELPER: Helper function to set loading state for different parts of the UI
    const setPartLoading = (key, value) =>
        setLoadingParts((prev) => ({ ...prev, [key]: value }));

    // LOADING LABEL HELPER: Helper function to get loading label based on which part is loading
    const loadingLabel = 
        loadingParts.guideA || loadingParts.guideB ? "Generating guide..." :
        loadingParts.flightsA || loadingParts.flightsB ? "Fetching flight..." :
        loadingParts.weatherA || loadingParts.weatherB ? "Fetching weather..." :
        loadingParts.airports ? "Resolving airports..." :
        loadingParts.image ? "Generating image..." :
        "Exploring options..."
    ;


    // --- RENDER THE APP COMPONENT ---
    return (
        <div className="relative min-h-screen font-sans p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-3xl">
                
                {/* Soft Imagen background overlay */}
                {imageUrl && !loadingParts.image && (
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
                            loading={loading} loadingLabel={loadingLabel}
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
                                disabled={loading || loadingParts.image}
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

                    {/* MAIN LOADING SPINNER + LOADING PARTS*/}
                    {loading  && (
                        <div className="w-full flex flex-col items-center mt-10 gap-3">
                            <LoadingSpinner />
                            <div className="flex flex-wrap justify-center gap-2 text-sm">
                            {loadingParts.weatherA && <span className="px-3 py-1 rounded-full bg-black/10">Weather (A)…</span>}
                            {loadingParts.weatherB && <span className="px-3 py-1 rounded-full bg-black/10">Weather (B)…</span>}
                            {loadingParts.airports && <span className="px-3 py-1 rounded-full bg-black/10">Resolving airports…</span>}
                            {loadingParts.flightsA && <span className="px-3 py-1 rounded-full bg-black/10">Flights (A)…</span>}
                            {loadingParts.flightsB && <span className="px-3 py-1 rounded-full bg-black/10">Flights (B)…</span>}
                            {loadingParts.guideA && <span className="px-3 py-1 rounded-full bg-black/10">Guide (A)…</span>}
                            {loadingParts.guideB && <span className="px-3 py-1 rounded-full bg-black/10">Guide (B)…</span>}
                            {loadingParts.image && <span className="px-3 py-1 rounded-full bg-black/10">Generating image…</span>}
                            </div>
                        </div>
                    )}

                    
                    {/* SINGLE DESTINATION MODE */}
                    {guideData && !guideDataSecondary && (
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
                    {guideData && guideDataSecondary && (
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
                                realFlights={realFlightsSecondary}
                            />
                        </div>
                    </section>
                    )}
            
                    {/* IMAGE NOTICE */}
                    {imageNotice && (
                        <div className="mt-3 flex justify-center">
                            <div className="text-xs sm:text-sm px-3 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                            {imageNotice}
                            </div>
                        </div>
                    )}

                    {/* IMAGE DISPLAY */}
                    {!loadingParts.image && imageUrl && (
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