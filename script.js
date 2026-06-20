const apiKey = "a13483b3c6f0f851ebc72365a2f1c3d8";
const INDIA_TIME_OFFSET = 5.5 * 60 * 60;
const SEARCH_HISTORY_KEY = "weather-search-history";
const HISTORY_DATABASE_NAME = "weather-app";
const HISTORY_STORE_NAME = "search-history";
let backgroundRequest = 0;
let clockTimer;
let suggestionTimer;
let suggestionRequest = 0;
let nearbySuggestion;
let historyDatabase;
let searchHistory = [];

async function getWeather() {
  const input = document.getElementById("cityInput");
  const place = input.value.trim();
  if (!place) return alert("Please enter a city, country, or place name.");

  const loader = document.getElementById("loader");
  const weatherInfo = document.getElementById("weatherInfo");
  const error = document.getElementById("error");
  loader.style.display = "block";
  weatherInfo.style.display = "none";
  error.textContent = "";

  updatePlaceBackground(place);

  try {
    const data = await getWeatherData(place);
    document.getElementById("city").textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById("temp").textContent = `${Math.round(data.main.temp)}°C`;
    document.getElementById("desc").textContent = data.weather[0].description;
    document.getElementById("humidity").textContent = `${data.main.humidity}%`;
    document.getElementById("wind").textContent = `${data.wind.speed} m/s`;
    const icon = document.getElementById("icon");
    icon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;
    icon.alt = data.weather[0].description;
    showClocks(data.name, data.timezone, data.sys.country);
    rememberSearch({
      label: `${data.name}, ${data.sys.country}`,
      query: `${data.name}, ${data.sys.country}`
    });
    weatherInfo.style.display = "block";

    // Only refine the photo when the weather service resolved a different name.
    // This avoids restarting the image request for every normal city search.
    if (!samePlace(data.name, place)) updatePlaceBackground(data.name);
  } catch (err) {
    error.textContent = err.message;
  } finally {
    loader.style.display = "none";
  }
}

async function getWeatherData(place) {
  const byName = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(place)}&appid=${apiKey}&units=metric`
  );
  if (byName.ok) return byName.json();

  // This fallback lets a country name (or a less common place name) resolve to
  // coordinates before asking OpenWeather for the local conditions and timezone.
  const geocode = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`
  );
  const location = geocode.ok ? (await geocode.json()).results?.[0] : null;
  if (!location) throw new Error("Weather could not be found for that location.");

  const byCoordinates = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${apiKey}&units=metric`
  );
  if (!byCoordinates.ok) throw new Error("Weather could not be found for that location.");

  return byCoordinates.json();
}

async function updatePlaceBackground(place) {
  const requestId = ++backgroundRequest;

  try {
    const photoUrl = await getPlacePhoto(place);
    if (!photoUrl) throw new Error("No photo for this place");

    if (requestId === backgroundRequest) {
      document.body.style.backgroundImage =
        `linear-gradient(rgba(7, 20, 35, .42), rgba(7, 20, 35, .58)), url("${photoUrl}")`;
      document.body.style.backgroundPosition = "center center";
    }
  } catch (_) {
    // Retain the last successful photo/gradient if this place has no usable image.
  }
}

async function getPlacePhoto(place) {
  // Most cities and countries have an exact Wikipedia page. This is one request,
  // rather than the previous search request followed by a second image request.
  const summaryResponse = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(place)}`
  );

  if (summaryResponse.ok) {
    const summary = await summaryResponse.json();
    if (summary.thumbnail?.source) return summary.thumbnail.source;
  }

  // Use a relevance-ranked result only when there is no exact page, such as a
  // spelling variation or a location entered with extra words.
  const searchUrl = "https://en.wikipedia.org/w/api.php?action=query&list=search" +
    `&srsearch=${encodeURIComponent(place)}&srlimit=6&format=json&origin=*`;
  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) return null;

  const searchData = await searchResponse.json();
  const results = searchData.query?.search || [];
  const exactResult = results.find((result) => samePlace(result.title, place));
  const title = (exactResult || results[0])?.title;
  if (!title) return null;

  const imageResponse = await fetch(
    "https://en.wikipedia.org/w/api.php?action=query&prop=pageimages" +
    `&titles=${encodeURIComponent(title)}&piprop=thumbnail&pithumbsize=1280&format=json&origin=*`
  );
  if (!imageResponse.ok) return null;

  const imageData = await imageResponse.json();
  return Object.values(imageData.query?.pages || {})[0]?.thumbnail?.source || null;
}

function samePlace(first, second) {
  const clean = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean(first) === clean(second);
}

function showClocks(locationName, localOffset, countryCode) {
  clearInterval(clockTimer);
  document.getElementById("localTimeLabel").textContent = `${locationName} time`;
  const isIndia = countryCode === "IN";
  document.getElementById("indiaTimeBlock").hidden = isIndia;
  document.getElementById("timeDetails").classList.toggle("single-time", isIndia);

  const update = () => {
    document.getElementById("localTime").textContent = formatTime(localOffset);
    document.getElementById("indiaTime").textContent = formatTime(INDIA_TIME_OFFSET);
  };

  update();
  clockTimer = setInterval(update, 1000);
}

function formatTime(offsetInSeconds) {
  const localDate = new Date(Date.now() + offsetInSeconds * 1000);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "UTC"
  }).format(localDate);
}

function getSearchHistory() {
  return searchHistory;
}

function getLegacyHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch (_) {
    return [];
  }
}

function rememberSearch(item) {
  const record = { ...item, searchedAt: Date.now() };
  searchHistory.unshift(record);

  if (historyDatabase) {
    addHistoryRecord(record).catch(() => {});
    return;
  }

  try {
    // Fallback for browsers that block IndexedDB.
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
  } catch (_) {
    // Search continues to work if browser storage is unavailable.
  }
}

function openHistoryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        database.createObjectStore(HISTORY_STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readHistoryRecords(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(HISTORY_STORE_NAME, "readonly")
      .objectStore(HISTORY_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.searchedAt - a.searchedAt));
    request.onerror = () => reject(request.error);
  });
}

function addHistoryRecord(record) {
  return new Promise((resolve, reject) => {
    const request = historyDatabase.transaction(HISTORY_STORE_NAME, "readwrite")
      .objectStore(HISTORY_STORE_NAME).add(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function initialiseSearchHistory() {
  const legacyHistory = getLegacyHistory();

  try {
    if (!window.indexedDB) throw new Error("IndexedDB is unavailable");
    historyDatabase = await openHistoryDatabase();
    searchHistory = await readHistoryRecords(historyDatabase);

    // Keep searches saved by the earlier version of the app.
    if (!searchHistory.length && legacyHistory.length) {
      searchHistory = legacyHistory.map((item, index) => ({
        ...item,
        searchedAt: Date.now() - index
      }));
      await Promise.all(searchHistory.map(addHistoryRecord));
    }
  } catch (_) {
    historyDatabase = null;
    searchHistory = legacyHistory;
  }

  const input = document.getElementById("cityInput");
  if (document.activeElement === input) showSuggestions(input.value);
}

function showSuggestions(query) {
  const requestId = ++suggestionRequest;
  clearTimeout(suggestionTimer);

  const searchText = query.trim().toLowerCase();
  const historyMatches = getSearchHistory().filter((item) =>
    item.label.toLowerCase().includes(searchText)
  );

  if (!searchText) {
    renderSuggestions([...(nearbySuggestion ? [nearbySuggestion] : []), ...historyMatches]);
    return;
  }

  renderSuggestions(historyMatches);
  if (searchText.length < 2) return;

  suggestionTimer = setTimeout(async () => {
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`
      );
      if (!response.ok) return;

      const data = await response.json();
      if (requestId !== suggestionRequest) return;

      const placeMatches = (data.results || []).map((place) => ({
        label: [place.name, place.admin1, place.country]
          .filter((part, index, list) => part && list.indexOf(part) === index)
          .join(", "),
        query: place.country_code ? `${place.name}, ${place.country_code}` : place.name
      }));
      renderSuggestions([...historyMatches, ...placeMatches]);
    } catch (_) {
      // Keep history suggestions visible when the location service is unavailable.
    }
  }, 250);
}

function renderSuggestions(items) {
  const menu = document.getElementById("suggestions");
  const input = document.getElementById("cityInput");
  const seen = new Set();
  const uniqueItems = items.filter((item) => {
    const key = item.query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);

  menu.replaceChildren();
  if (!uniqueItems.length) {
    menu.hidden = true;
    return;
  }

  uniqueItems.forEach((item) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "suggestion-item";
    option.role = "option";
    option.textContent = item.label;
    // Keep the input focused while a mouse or touch selection is made. Without
    // this, its blur handler can hide the menu before the click is processed.
    option.addEventListener("pointerdown", (event) => event.preventDefault());
    option.addEventListener("click", () => {
      input.value = item.query;
      menu.hidden = true;
      input.focus();
      getWeather();
    });
    menu.append(option);
  });
  menu.hidden = false;
}

function requestNearbySuggestion() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=${apiKey}&units=metric`
      );
      if (!response.ok) return;

      const data = await response.json();
      nearbySuggestion = {
        label: `Near you: ${data.name}, ${data.sys.country}`,
        query: `${data.name}, ${data.sys.country}`
      };
      const input = document.getElementById("cityInput");
      if (!input.value.trim() && document.activeElement === input) showSuggestions("");
    } catch (_) {
      // Location suggestions are optional; a denied or failed request is ignored.
    }
  }, () => {}, { maximumAge: 300000, timeout: 8000 });
}

const cityInput = document.getElementById("cityInput");
const suggestions = document.getElementById("suggestions");

cityInput.addEventListener("input", () => showSuggestions(cityInput.value));
cityInput.addEventListener("focus", () => showSuggestions(cityInput.value));
cityInput.addEventListener("blur", () => {
  setTimeout(() => { suggestions.hidden = true; }, 150);
});
cityInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    suggestions.hidden = true;
    getWeather();
  }
});

requestNearbySuggestion();
initialiseSearchHistory();
