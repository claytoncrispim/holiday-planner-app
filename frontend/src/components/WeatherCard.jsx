const WeatherCard = ({ weather }) => {
  if (!weather || !weather.found) return null;

  const { location, summary } = weather;
  const { name, country } = location || {};
  const { headline, avgMax, avgMin, totalPrecipitation } = summary || {};

  const hasTemps =
    typeof avgMax === "number" && typeof avgMin === "number";

  return (
    <section className="group bg-white/95 rounded-2xl border border-sky-50 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md hover:border-sky-200 hover:bg-sky-50/60">
      <header className="flex items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-stone-500">
            Live weather
          </p>
          <h3 className="text-sm font-semibold text-stone-800">
            {name}
            {country ? `, ${country}` : ""}
          </h3>
        </div>
        <span className="text-xl" role="img" aria-label="Weather">
          ☀️
        </span>
      </header>

      {hasTemps && (
        <p className="text-sm text-stone-800 mb-1">
          <span className="font-semibold">
            {Math.round(avgMax)}°C
          </span>{" "}
          high ·{" "}
          <span className="font-semibold">
            {Math.round(avgMin)}°C
          </span>{" "}
          low
        </p>
      )}

      {typeof totalPrecipitation === "number" && (
        <p className="text-xs text-stone-600 mb-1">
          Total rain over next 7 days:{" "}
          <span className="font-medium">
            {totalPrecipitation.toFixed(1)} mm
          </span>
        </p>
      )}

      {headline && (
        <p className="text-xs text-stone-700 mt-1 leading-snug">
          {headline}
        </p>
      )}

      <p className="mt-2 text-[10px] text-stone-400">
        Powered by Open-Meteo · 7-day outlook
      </p>
    </section>
  );
};

export default WeatherCard;