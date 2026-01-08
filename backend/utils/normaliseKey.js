function normaliseKey(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .trim();
}

export default normaliseKey;