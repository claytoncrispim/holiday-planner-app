const InfoTooltip = ({ label, children }) => (
  <div className="relative group inline-block">
    <button
      type="button"
      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full border border-sky-400 text-sky-600 text-[9px] font-bold leading-none bg-white/80 shadow-sm hover:bg-sky-50 focus:outline-none focus:ring-1 focus:ring-sky-400"
      aria-label={label}
    >
      i
    </button>
    <div
      className="pointer-events-none absolute z-20 hidden w-52 rounded-md bg-slate-900/95 px-3 py-2 text-[10px] text-slate-50 shadow-lg border border-slate-700
                 group-hover:block group-focus-within:block left-1/2 -translate-x-1/2 top-5"
    >
      {children}
    </div>
  </div>
);
export default InfoTooltip;