// --- UI COMPONENT: SearchBar ---
// The main form for user input. It is a controlled component, with its value tied to state.
import { useState } from "react";
import PassengerSelector from "./PassengerSelector";

const SearchBar = ({ 
    origin, 
    setOrigin, 
    destination, 
    setDestination, 
    compareDestination,
    setCompareDestination,
    departureDate, 
    setDepartureDate, 
    returnDate, 
    setReturnDate, 
    passengers, 
    setPassengers,
    budgetLevel,
    setBudgetLevel,
    handleGetGuide, 
    loading 
}) => {
    // State to control if the dropdown is open or closed
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Budget options for the dropdown
    const BUDGET_OPTIONS = [
        { value: "low", label: "Budget" },
        { value: "medium", label: "Balanced" },
        { value: "high", label: "Comfort" },
    ];

    // Handler for budget selection
    const handleBudgetClick = (value) => {
        if (typeof setBudgetLevel === 'function') {
            setBudgetLevel(value);
        }
    };

    // Handler for applying passenger selections from the dropdown
    const handleApplyPassengers = (newPassengers) => {
        setPassengers(newPassengers);
    };

    // Calculate total passengers for the summary text
    const totalPassengers = 
    passengers.adults + 
    passengers.youngAdults + 
    passengers.children + 
    passengers.infants;

    // Format the summary text
    const passengerSummary = `${totalPassengers} Passenger${
        totalPassengers !== 1 ? 's' : ''
    }`;

  // Render the SearchBar component
    return (
        <section className="mt-4 mb-6 bg-gradient-to-r from-sky-100 via-orange-50 to-emerald-50 rounded-3xl p-[1px] shadow-lg">
            <div className="bg-white/95 rounded-[1.4rem] p-4 sm:p-5 md:p-6">
                {/* Header inside card */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-semibold text-stone-800">
                        Plan your escape ✈️
                        </h2>
                        <p className="text-xs md:text-sm text-stone-500">
                        Choose your route, dates and who&apos;s coming along.
                        </p>
                    </div>
                </div>


                <form
                onSubmit={handleGetGuide}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"
                >
                {/* Origin */}
                <div className="form-field">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                    Origin
                    </label>
                    <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Where are you flying from?"
                    className="w-full p-3 rounded-lg border border-stone-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-base hover:border-amber-400"
                    />
                </div>

                {/* Destination */}
                <div className="form-field">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                    Destination A
                    </label>
                    <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Where do you want to go?"
                    className="w-full p-3 rounded-lg border border-stone-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-base hover:border-amber-400"
                    />
                </div>

                {/* Compare destination (optional) */}
                <div className="form-field">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Compare with (optional)
                    </label>
                    <input
                        type="text"
                        value={compareDestination}
                        onChange={(e) => setCompareDestination(e.target.value)}
                        placeholder="e.g. Gran Canaria, Madeira, Malaga..."
                        className="w-full p-3 rounded-lg border border-stone-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition text-base hover:border-amber-400"
                    />
                    <p className="mt-1 text-[11px] text-stone-500">
                        If filled, we&apos;ll compare both destinations side by side.
                    </p>
                </div>

                {/* Departure Date */}
                <div className="form-field">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                    Departure date
                    </label>
                    <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full p-3 rounded-lg border border-stone-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-base hover:border-amber-400"
                    />
                </div>

                {/* Return Date */}
                <div className="form-field">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                    Return date
                    </label>
                    <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full p-3 rounded-lg border border-stone-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-base hover:border-amber-400"
                    />
                </div>

                {/* Passengers */}
                <div className="form-field passenger-field relative">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                    Travellers
                    </label>
                    <button
                    type="button"
                    className="w-full p-3 rounded-lg border border-stone-200 text-left 
                                focus:border-amber-500 focus:ring-1 focus:ring-amber-500 
                                outline-none transition text-base bg-white hover:border-amber-400"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                    {passengerSummary}
                    </button>

                    {isDropdownOpen && (
                    <PassengerSelector
                        initialPassengers={passengers}
                        onApply={handleApplyPassengers}
                        onClose={() => setIsDropdownOpen(false)}
                    />
                    )}
                </div>

                {/* Budget level */}
                <div className="form-field">
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                        Budget
                    </label>
                    <div className="flex items-center gap-2 bg-stone-100 rounded-full p-1">
                        {BUDGET_OPTIONS.map((opt) => {
                            const isActive = budgetLevel === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleBudgetClick(opt.value)}
                                        className={[
                                            "flex-1 text-xs sm:text-sm px-3 py-1 rounded-full transition font-semibold",
                                            isActive
                                            ? "bg-orange-500 text-white shadow"
                                            : "text-stone-600 hover:text-stone-800 hover:bg-white",
                                        ].join(" ")}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })
                        }
                    </div>
                </div>


                {/* Submit button – full width on its own row */}
                <div className="md:col-span-2 flex justify-end mt-1">
                    <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto bg-orange-500 text-white font-semibold py-3 px-6 
                    rounded-lg shadow-md hover:bg-orange-600 transition 
                    disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? "Exploring options..." : "Find destination"}
                    </button>
                </div>
                </form>
            </div>
        </section>
    );
};

export default SearchBar;