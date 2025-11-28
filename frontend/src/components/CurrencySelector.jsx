import { useState, useEffect } from "react";
import { CURRENCIES_DATA } from "../data/CurrencyData";
import { Globe2 } from "lucide-react";


// --- UI Component: Currency Dropdown Selector  ---
const CurrencySelector = ({ selectedCurrency, onCurrencyChange }) => {
    const [currencies, setCurrencies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        try {
             const transformedData = Object.entries(CURRENCIES_DATA).map(([code, details]) => {
                return [code, details.name || code];
            });
            
            if (Array.isArray(transformedData)) {
                setCurrencies(transformedData);
                // Select first currency if none selected
                if (!selectedCurrency && transformedData.length > 0 && typeof onCurrencyChange === 'function') {
                    onCurrencyChange(transformedData[0][0]); 
                }
            } else {
                setCurrencies([]); 
            }
        } catch (error) {
            console.error("Error processing currency data", error);
            setCurrencies([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCurrency, onCurrencyChange]); 


    if (isLoading) {
        return <div className="text-center py-4 text-stone-500">Loading currencies...</div>;
    }

    if (currencies.length === 0) {
        return null;
    }
    
    return (
    <section className="mb-4 flex justify-end">
      <div className="inline-flex items-center gap-3 bg-white shadow-sm rounded-full px-3 py-2 border border-orange-100">
        {/* Label + icon */}
        <div className="flex items-center gap-1 text-xs sm:text-sm text-stone-600 pl-1">
          <Globe2 size={16} className="text-orange-500" />
          <span className="font-medium text-stone-800">Currency</span>
        </div>

        {/* Styled <select> fed by CURRENCIES_DATA */}
        <select
          id="currency-select"
          value={selectedCurrency || ""}
          onChange={(e) =>
            typeof onCurrencyChange === "function" &&
            onCurrencyChange(e.target.value)
          }
          className="bg-stone-100 text-xs sm:text-sm rounded-full px-3 py-1 border border-stone-200
           focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500
           hover:bg-white transition min-w-[8rem]"
        >
          {currencies.map(([code, name]) => (
            <option key={code} value={code}>
              {`${code} — ${name}`}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
};

export default CurrencySelector;