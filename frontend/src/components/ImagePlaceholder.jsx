// --- UI COMPONENT: ImagePlaceholder ---
// A placeholder with a pulsing animation shown while the AI image is being generated.
// This improves user experience by managing expectations.
const ImagePlaceholder = () => (
  <div className="bg-stone-200 rounded-lg h-48 sm:h-56 md:h-64 flex items-center justify-center animate-pulse">
    <p className="text-stone-500">Generating location art...</p>
  </div>
)

export default ImagePlaceholder;