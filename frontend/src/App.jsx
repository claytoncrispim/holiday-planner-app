import { useState, useRef, useEffect } from 'react';
// Import of Components
import CurrencySelector from './components/CurrencySelector';
import LoadingSpinner from './components/LoadingSpinner';
import SearchForm from './components/SearchForm';
import FlightCard from "./components/FlightCard";
import InfoSectionCard from "./components/InfoSectionCard";
import GeneratedImageCard from "./components/GeneratedImageCard";
import TripSummaryBar from "./components/TripSummaryBar";
import SavedTripsPanel from "./components/SavedTripsPanel";

// Import of Formatters
import formatDate from './tools/dateFormatter';

// --- HELPERS ---

// --- GEMINI API CALL FUNCTION ---
// Helper function for Gemini initialization
const callGemini = async (prompt) => {
    let response;
    try {
        response = await fetch(
        "http://localhost:8080/generate-guide", {
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
    // State to hold the travel guide from the Gemini API
    const [guideData, setGuideData] = useState(null);
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
            const response = await fetch("http://localhost:8080/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });

            const data = await response.json();

            const base64 = data.predictions?.[0]?.bytesBase64Encoded;
            if (!base64) {
                throw new Error('No image returned from image generation.');
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
        setImageUrl(null);

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

            // Construct the prompt for Gemini
            const prompt = `
                Generate a JSON object describing travel options for:
                Origin: ${origin}
                Destination: ${destination}
                Date: ${formatDate(departureDate)} to ${formatDate(returnDate)}
                Passengers: ${JSON.stringify(passengers)}
                Trip length in nights: ${tripNights !== null ? tripNights : "Not specified"
                }.
                Budget level: ${
                    budgetLevel || "not specified"
                } (low = budget-conscious, medium = balanced, high = comfort-focused).

                Use the budget level when describing flight choices, hotels, and packages. 
                For example, for low budget focus on economy options and value deals, for high budget highlight comfort, convenience, and premium experiences.


                The JSON must contain (DO NOT include code fences or markdown formatting.
                ):
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

                Ensure the generated imageGenPrompt reflects a photorealistic image of the ${destination}.
                
                Ensure the generated imageGenPrompt reflects a photorealistic image of a diverse type of travelers (matching the passenger details) enjoying iconic landmarks or activities in ${destination} during ${tripNights !== null ? tripNights + " nights" : "their trip"}.
            `;

            // Call Gemini API
            const geminiResponse = await callGemini(prompt);
            console.log("Gemini response:", geminiResponse);

            // geminiResponse is already parsed JSON
            setGuideData(geminiResponse);

            // Generate beased on Gemini's suggestion
            if (geminiResponse.imageGenPrompt) {
                await handleGenerateImage(geminiResponse.imageGenPrompt);
            }
        } catch (err) {
            console.error("Frontend error in handleGetGuide:", err);

            // Custom network marker
            if (err.message === "NETWORK_ERROR") {
                userMessage = 
                    "I couldn’t reach the Holiday Planner server. Make sure the backend is running on http://localhost:8080 and your connection is OK.";
            }
            // JSON parse / unexpected format
            else if (
                err.message === "INVALID_JSON_FROM_SERVER" ||
                err.message === "UNEXPECTED_RESPONSE_SHAPE"
            ) {
                userMessage = 
                    "The AI reply came back in an unexpected format. Please try again in a moment.";
            }
            // HTTP status-based messages
            else if (typeof err.status === "number") {
                if (err.status === 429) {
                    userMessage = 
                        "The AI service is receiving too many requests right now. Please try again in a few seconds.";
                } else if (err.status >= 500) {
                    userMessage = 
                        "Our server had a problem while generating your guide. Please try again shortly.";
                } else if (err.status >= 400 && err.status < 500) {
                    userMessage = 
                        "There was an issue with the request. Please check your inputs and try again.";
                }
            }
            // Fallback: If backend sent a message, use it
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

    // --- RENDERING THE APP COMPONENT ---
    return (
        <div className="min-h-screen font-sans p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-3xl">

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
                            onChangeTrip={handleChangeTrip}
                        />
                    )}

                    {/* SAVED TRIPS PANEL */}
                    {savedTrips.length > 0 && (
                        <SavedTripsPanel
                            savedTrips={savedTrips}
                            onSelectTrip={handleSelectSavedTrip}
                            onDeleteTrip={handleDeleteTrip}
                        />
                    )}

                    {/* SAVE TRIP BUTTON */}
                    {guideData && (
                        <div className="flex justify-end mt-1">
                            <button
                            type="button"
                            onClick={handleSaveCurrentTrip}
                            disabled={loading}
                            className="text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-800 underline disabled:opacity-50"
                            >
                                Save this trip
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

                    {/* ONLY SHOWS RESULTS *AFTER* LOADING IS COMPLETE */}
                    {!loading && guideData && (
                        <section className="mt-8 space-y-6 fade-in-soft">
                            {/* Destination header card */}
                            <div className="bg-gradient-to-r from-sky-100 via-amber-50 to-amber-100 rounded-2xl p-4 sm:p-5 shadow-md border border-amber-100">
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

                            {/* Flights */}
                            {guideData?.flights?.length > 0 && (
                                <section className="space-y-3">
                                    <h3 className="text-lg font-semibold text-stone-800 flex items-center gap-2">
                                        ✈️ Flight options
                                    </h3>
                                    <div className="space-y-3">
                                        {guideData.flights.map((f, idx) => (
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
                            {guideData.hotelInfo && (
                                <InfoSectionCard title="Where to stay" emoji="🏨">
                                    {guideData.hotelInfo}
                                </InfoSectionCard>
                            )}

                            {/* Travel Packages */}
                            {guideData.travelPackages && (
                                <InfoSectionCard title="Package deals" emoji="📦">
                                    {guideData.travelPackages}
                                </InfoSectionCard>
                            )}

                            {/* Comparison */}
                            {guideData.comparisonInfo && (
                                <InfoSectionCard title="What’s the best option?" emoji="⚖️">
                                    {guideData.comparisonInfo}
                                </InfoSectionCard>
                            )}
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