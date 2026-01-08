const LOCATION_OVERRIDES = {
  // --- Ireland ---
  "dublin": {
    iataCode: "DUB",
    name: "Dublin",
    city: "Dublin",
    country: "IE",
  },
  "dublin, ireland": {
    iataCode: "DUB",
    name: "Dublin",
    city: "Dublin",
    country: "IE",
  },

  // --- Portugal: Lisbon / Lisboa ---
  "lisbon": {
    iataCode: "LIS",
    name: "Lisbon",
    city: "Lisbon",
    country: "PT",
  },
  "lisbon, portugal": {
    iataCode: "LIS",
    name: "Lisbon",
    city: "Lisbon",
    country: "PT",
  },
  "lisboa": {
    iataCode: "LIS",
    name: "Lisbon",
    city: "Lisbon",
    country: "PT",
  },
  "lisboa, portugal": {
    iataCode: "LIS",
    name: "Lisbon",
    city: "Lisbon",
    country: "PT",
  },

  // --- Spain: Canary Islands / beachy stuff ---
  // Las Palmas de Gran Canaria
  "las palmas": {
    iataCode: "LPA",
    name: "Las Palmas de Gran Canaria",
    city: "Las Palmas",
    country: "ES",
  },
  "las palmas, gran canaria": {
    iataCode: "LPA",
    name: "Las Palmas de Gran Canaria",
    city: "Las Palmas",
    country: "ES",
  },
  "gran canaria": {
    iataCode: "LPA",
    name: "Las Palmas de Gran Canaria",
    city: "Las Palmas",
    country: "ES",
  },
  "las palmas de gran canaria": {
    iataCode: "LPA",
    name: "Las Palmas de Gran Canaria",
    city: "Las Palmas",
    country: "ES",
  },

  // Tenerife – city code covering both North/South
  "tenerife": {
    iataCode: "TCI", // city code (TFN + TFS)
    name: "Tenerife",
    city: "Tenerife",
    country: "ES",
  },
  "tenerife, spain": {
    iataCode: "TCI",
    name: "Tenerife",
    city: "Tenerife",
    country: "ES",
  },
  "tenerife north": {
    iataCode: "TFN",
    name: "Tenerife Norte",
    city: "Tenerife",
    country: "ES",
  },
  "tenerife south": {
    iataCode: "TFS",
    name: "Tenerife Sur",
    city: "Tenerife",
    country: "ES",
  },

  // --- Spain: mainland city breaks ---
  "barcelona": {
    iataCode: "BCN",
    name: "Barcelona",
    city: "Barcelona",
    country: "ES",
  },
  "barcelona, spain": {
    iataCode: "BCN",
    name: "Barcelona",
    city: "Barcelona",
    country: "ES",
  },

  "madrid": {
    iataCode: "MAD",
    name: "Madrid",
    city: "Madrid",
    country: "ES",
  },
  "madrid, spain": {
    iataCode: "MAD",
    name: "Madrid",
    city: "Madrid",
    country: "ES",
  },

  // --- France / Italy city codes ---
  "paris": {
    iataCode: "PAR", // covers CDG + ORY
    name: "Paris",
    city: "Paris",
    country: "FR",
  },
  "paris, france": {
    iataCode: "PAR",
    name: "Paris",
    city: "Paris",
    country: "FR",
  },

  "rome": {
    iataCode: "ROM", // covers FCO + CIA
    name: "Rome",
    city: "Rome",
    country: "IT",
  },
  "rome, italy": {
    iataCode: "ROM",
    name: "Rome",
    city: "Rome",
    country: "IT",
  },

  // --- UK / US big city multi-airport codes ---
  "london": {
    iataCode: "LON", // LHR, LGW, STN, LTN, LCY, SEN
    name: "London",
    city: "London",
    country: "GB",
  },
  "london, uk": {
    iataCode: "LON",
    name: "London",
    city: "London",
    country: "GB",
  },

  "new york": {
    iataCode: "NYC", // JFK, EWR, LGA
    name: "New York",
    city: "New York",
    country: "US",
  },
  "new york city": {
    iataCode: "NYC",
    name: "New York",
    city: "New York",
    country: "US",
  },
  "nyc": {
    iataCode: "NYC",
    name: "New York",
    city: "New York",
    country: "US",
  },

  // --- Brazil examples (accent-friendly thanks to normaliser) ---
  "sao paulo": {
    iataCode: "SAO", // GRU + CGH + VCP
    name: "São Paulo",
    city: "São Paulo",
    country: "BR",
  },
  "rio de janeiro": {
    iataCode: "RIO", // GIG + SDU
    name: "Rio de Janeiro",
    city: "Rio de Janeiro",
    country: "BR",
  },
};

export default LOCATION_OVERRIDES;