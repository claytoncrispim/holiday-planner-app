const InfoSectionCard = ({ title, emoji, children }) => {
  return (
    <section className="
      group
      bg-white/95
      rounded-2xl
      border border-amber-50
      p-4 sm:p-5
      shadow-sm
      
      transition-all duration-200
      hover:-translate-y-[2px]
      hover:shadow-md
      hover:border-amber-200
      hover:bg-amber-50/60
    "
    >
      <header className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <h3 className="
          text-sm font-semibold text-stone-800 tracking-wide uppercase
          transition-colors duration-200
          group-hover:text-amber-800
        ">
          {title}
        </h3>
      </header>
      <div className="text-sm sm:text-[15px] text-stone-700 leading-relaxed whitespace-pre-line">
        {children}
      </div>

    </section>
  );
};

export default InfoSectionCard;
