import { Image as ImageIcon, MapPin } from "lucide-react";
import formatDate from "./dateFormatter";

const GeneratedImageCard = ({
  imageUrl,
  destinationName,
  originName,
  departureDate,
  returnDate,
}) => {
  const hasDates = departureDate && returnDate;

  return (
    <section className="mt-8 fade-in-soft-delayed">
      <div className="bg-gradient-to-r from-sky-100 via-orange-50 to-emerald-50 rounded-3xl p-[1px] shadow-lg">
        <div className="bg-white rounded-[1.6rem] p-4 sm:p-5 md:p-6">
          {/* Header */}
          <header className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-orange-50 flex items-center justify-center">
                <ImageIcon className="text-orange-500" size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-800">
                  Visual trip preview
                </h3>
                <p className="text-xs text-stone-500">
                  A generated glimpse of your destination.
                </p>
              </div>
            </div>

            {destinationName && (
              <div className="hidden sm:flex items-center gap-1 text-xs text-stone-500">
                <MapPin size={14} className="text-emerald-600" />
                <span>
                  {originName && <>{originName} → </>}
                  <span className="font-semibold text-stone-700">
                    {destinationName}
                  </span>
                </span>
              </div>
            )}
          </header>

          {/* Image frame */}
          <div className="rounded-2xl overflow-hidden shadow-md bg-stone-100">
            <img
              src={imageUrl}
              alt={destinationName || "Generated travel preview"}
              className="w-full h-auto object-cover transition-transform duration-700 hover:scale-[1.03]"
            />
          </div>

          {/* Caption */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-stone-600">
            {destinationName && (
              <p>
                Dreaming of{" "}
                <span className="font-semibold text-stone-800">
                  {destinationName}
                </span>
                {originName && (
                  <>
                    {" "}
                    from{" "}
                    <span className="font-semibold text-stone-800">
                      {originName}
                    </span>
                  </>
                )}
                .
              </p>
            )}
            {hasDates && (
              <p className="text-stone-500">
                Trip window:{" "}
                <span className="font-semibold text-stone-800">
                  {formatDate(departureDate)}
                </span>{" "}
                –{" "}
                <span className="font-semibold text-stone-800">
                  {formatDate(returnDate)}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GeneratedImageCard;
