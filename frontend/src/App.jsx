import { useState, useRef } from 'react';
// Import of Components
import CurrencySelector from './components/CurrencySelector';
import LoadingSpinner from './components/LoadingSpinner';
import SearchBar from './components/SearchBar';
import FlightCard from "./components/FlightCard";
import InfoSectionCard from "./components/InfoSectionCard";
import GeneratedImageCard from "./components/GeneratedImageCard";
import TripSummaryBar from "./components/TripSummaryBar";

// Import of Formatters
import formatDate from './components/dateFormatter';

// Helper function for Gemini initialization
const callGemini = async (prompt) => {
    const response = await fetch(
        "http://localhost:8080/generate-guide", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        }
    );

    const data = await response.json();

    // The backend now returns structured JSON, so we return it directly
    if (!data || typeof data !== "object") {
        throw new Error ("Gemini response is not valid JSON.");
    }
    
    return data;
}

// --- MAIN APP COMPONENT ---
const App = () => {
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

    const searchBarRef = useRef(null);

    // **** HANDLER FUNCTIONS *****

    // --- HANDLER FUNCTION: Change Trip ---
    // This function scrolls the view to the search bar for modifying the trip.
    const handleChangeTrip = () => {
        if (searchBarRef.current) {
            searchBarRef.current.scrollIntoView({ 
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
        console.log("DEBUG: loading set to TRUE");

        setError(null);
        setGuideData(null);
        setImageUrl(null);
        
        try {
            // Construct the prompt for Gemini
            const prompt = `
                Generate a JSON object describing travel options for:
                Origin: ${origin}
                Destination: ${destination}
                Date: ${formatDate(departureDate)} to ${formatDate(returnDate)}
                Passengers: ${JSON.stringify(passengers)}
                
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
            console.error(err);
            setError("Could not fetch travel guide. Please try again.");
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
        setGuideData(null);
        setError(null);
        setImageUrl(null);
    };

// **** END OF HANDLER FUNCTIONS *****

// --- RENDERING THE APP COMPONENT ---
return (
    <div className="min-h-screen bg-amber-50 font-serif p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-2xl">

        {/* HEADER */}
        <header className="text-center my-6 md:my-8">
            {/* Debugger to check loading state */}
            {/* <div className="text-red-600 font-bold">
                loading state: {loading ? "TRUE" : "FALSE"} 
            </div> */}

          <h1 className="text-4xl md:text-5xl font-bold text-stone-800">
            Holiday Planner 🏖️
          </h1>
          <p className="text-stone-600 mt-2 text-lg">Your AI guide to the world's destinations.</p>
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
                    onChangeTrip={handleChangeTrip}
                />
            )}

            {/* SEARCH BAR (scrolls into view when changing trip) */}
            <div ref={searchBarRef}>
                <SearchBar 
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
                    handleGetGuide={handleGetGuide} 
                    loading={loading} 
                />
            </div>

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
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-6 text-center">
                {error}
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
      </div>
    </div>
  )
}

export default App