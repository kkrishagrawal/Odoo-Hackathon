const COUNTRIES_API_URL = "https://restcountries.com/v3.1/all?fields=name,currencies,cca2";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const FALLBACK_COUNTRIES = [
  {
    code: "US",
    name: "United States",
    currencyCode: "USD",
    currencyName: "US Dollar",
    currencySymbol: "$",
  },
  {
    code: "IN",
    name: "India",
    currencyCode: "INR",
    currencyName: "Indian Rupee",
    currencySymbol: "Rs",
  },
  {
    code: "SG",
    name: "Singapore",
    currencyCode: "SGD",
    currencyName: "Singapore Dollar",
    currencySymbol: "$",
  },
  {
    code: "GB",
    name: "United Kingdom",
    currencyCode: "GBP",
    currencyName: "Pound Sterling",
    currencySymbol: "GBP",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    currencyCode: "AED",
    currencyName: "UAE Dirham",
    currencySymbol: "AED",
  },
  {
    code: "DE",
    name: "Germany",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "EUR",
  },
  {
    code: "FR",
    name: "France",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "EUR",
  },
  {
    code: "CA",
    name: "Canada",
    currencyCode: "CAD",
    currencyName: "Canadian Dollar",
    currencySymbol: "$",
  },
  {
    code: "AU",
    name: "Australia",
    currencyCode: "AUD",
    currencyName: "Australian Dollar",
    currencySymbol: "$",
  },
  {
    code: "JP",
    name: "Japan",
    currencyCode: "JPY",
    currencyName: "Yen",
    currencySymbol: "JPY",
  },
];

let cachedCountries = [];
let countriesByCode = new Map();
let cacheExpiresAt = 0;
let inFlightCountriesRequest = null;

function normalizeCountryRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((country) => {
      if (!country || typeof country !== "object") {
        return null;
      }

      const code = typeof country.cca2 === "string" ? country.cca2.trim().toUpperCase() : "";
      const name = country?.name?.common;
      const currencies = country.currencies && typeof country.currencies === "object" ? country.currencies : null;

      if (!code || code.length !== 2 || typeof name !== "string" || !currencies) {
        return null;
      }

      const currencyCodes = Object.keys(currencies);
      if (currencyCodes.length === 0) {
        return null;
      }

      const currencyCode = currencyCodes[0];
      const currencyMeta = currencies[currencyCode] || {};

      return {
        code,
        name: name.trim(),
        currencyCode,
        currencyName:
          typeof currencyMeta.name === "string" && currencyMeta.name.trim()
            ? currencyMeta.name.trim()
            : currencyCode,
        currencySymbol:
          typeof currencyMeta.symbol === "string" && currencyMeta.symbol.trim()
            ? currencyMeta.symbol.trim()
            : currencyCode,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function updateCache(countries) {
  cachedCountries = countries;
  countriesByCode = new Map(countries.map((country) => [country.code, country]));
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

async function fetchCountriesFromApi() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(COUNTRIES_API_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Countries API request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const normalizedCountries = normalizeCountryRows(payload);

    if (normalizedCountries.length === 0) {
      throw new Error("Countries API returned no valid countries");
    }

    return normalizedCountries;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureCountriesLoaded() {
  if (cachedCountries.length > 0 && Date.now() < cacheExpiresAt) {
    return cachedCountries;
  }

  if (!inFlightCountriesRequest) {
    inFlightCountriesRequest = fetchCountriesFromApi();
  }

  try {
    const countries = await inFlightCountriesRequest;
    updateCache(countries);
    return countries;
  } catch (error) {
    if (cachedCountries.length > 0) {
      return cachedCountries;
    }

    console.error("Unable to load countries from API, using fallback list", error);
    updateCache(FALLBACK_COUNTRIES);
    return FALLBACK_COUNTRIES;
  } finally {
    inFlightCountriesRequest = null;
  }
}

async function listCountries() {
  return ensureCountriesLoaded();
}

async function getCountryByCode(code) {
  if (!code) {
    return null;
  }

  await ensureCountriesLoaded();
  return countriesByCode.get(String(code).trim().toUpperCase()) || null;
}

module.exports = {
  listCountries,
  getCountryByCode,
};
