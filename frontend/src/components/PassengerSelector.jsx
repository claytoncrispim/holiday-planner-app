import { useState } from 'react';
import { Plus, Minus, Users } from 'lucide-react';

// --- UI SEARCH BAR COMPONENT: PassengerSelector ---
// A controlled component for selecting the number of passengers.

const rows = [
    { key: "adults", label: "Adults", description: "Ages 18+" },
    { key: "youngAdults", label: "Young Adults", description: "Ages 12–17" },
    { key: "children", label: "Children", description: "Ages 2–11" },
    { key: "infants", label: "Infants", description: "Under 2" },
];


export default function PassengerSelector({ initialPassengers, onApply, onClose }) {
    const [localPassengers, setLocalPassengers] = useState(initialPassengers);

    const updateCount = (key, delta) => {
        setLocalPassengers(prev => {
            const newValue = Math.max(0, prev[key] + delta);
            return { ...prev, [key]: newValue };
        });
    };

    return (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white shadow-xl rounded-xl border border-amber-200 p-4 z-50 animate-fadeIn">
            
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <Users className="text-amber-600" size={20} />
                <h3 className="text-lg font-semibold text-stone-800">Passengers</h3>
            </div>

            {/* Passenger Rows */}
            <div className="space-y-4">
                {rows.map(row => (
                    <div key={row.key} className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-stone-800">{row.label}</p>
                            <p className="text-sm text-stone-500">{row.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => updateCount(row.key, -1)}
                                className="w-8 h-8 flex items-center justify-center rounded-full border border-amber-300 text-amber-600 hover:bg-amber-100 transition"
                            >
                                <Minus size={16} />
                            </button>

                            <span className="w-6 text-center font-semibold text-stone-800">
                                {localPassengers[row.key]}
                            </span>

                            <button
                                type="button"
                                onClick={() => updateCount(row.key, +1)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600 transition"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 mt-5">
                <button
                    onClick={onClose}
                    type="button"
                    className="px-3 py-2 rounded-lg bg-stone-200 text-stone-700 hover:bg-stone-300 transition"
                >
                    Cancel
                </button>
                <button
                    onClick={() => {
                        onApply(localPassengers);
                        onClose();
                    }}
                    type="button"
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold shadow hover:bg-amber-700 transition"
                >
                    Apply
                </button>
            </div>
        </div>
    );
}