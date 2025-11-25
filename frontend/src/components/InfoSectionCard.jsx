const InfoSectionCard = ({ title, emoji, children }) => {
  return (
    <section className="bg-white rounded-2xl shadow-md p-4 sm:p-5 border border-amber-50">
      <header className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <h3 className="text-lg font-semibold text-stone-800">
          {title}
        </h3>
      </header>
      <p className="text-sm sm:text-base text-stone-700 leading-relaxed whitespace-pre-line">
        {children}
      </p>
    </section>
  );
};

export default InfoSectionCard;
