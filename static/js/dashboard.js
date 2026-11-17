const SkyCharts = {};
let weatherMap = null;
let weatherMarker = null;

function cityParams(value) {
  const parts = String(value).split(",").map(function (part) { return part.trim(); }).filter(Boolean);
  if (parts.length > 1) return { city: parts[0], country: parts[1] };
  return { city: parts[0] || "" };
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setHtml(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = value;
}

function setWidth(id, value) {
  const element = document.getElementById(id);
  if (element) element.style.width = Math.max(0, Math.min(100, value)) + "%";
}

function escapeValue(value) {
  return SkyCast.escapeHtml(value);
}

function iconFor(item) {
  return SkyCast.emojiFromIcon(item.icon) || SkyCast.emojiFor(item.weather_type);
}

function showError(message) {
  const alert = document.getElementById("errorAlert");
  if (alert) alert.classList.remove("d-none");
  setText("errorText", message);
}

function clearError() {
  const alert = document.getElementById("errorAlert");
  if (alert) alert.classList.add("d-none");
}

function renderCurrent(current) {
  const city = escapeValue(current.city);
  const country = current.country ? ", " + escapeValue(current.country.trim()) : "";
  setHtml("cityName", city);
  setText("countryName", country);
  setText("pageTitle", "Weather in " + current.city);
  setText("currentClock", "Observed at " + current.observed_at);
  setText("conditionText", current.condition);
  setText("conditionDescription", current.description);
  setHtml("tempValue", Number(current.temp).toFixed(1) + "<span>°C</span>");
  setText("heroIcon", SkyCast.emojiFromIcon(current.icon));
  setText("inlineFeels", Number(current.feels_like).toFixed(1) + "°C");
  setText("inlineHumidity", current.humidity + "%");
  setText("inlineWind", current.wind_speed + " km/h");
}

function renderPrediction(prediction) {
  if (!prediction) return;
  setText("predTemp", Number(prediction.temperature).toFixed(1) + "°C");
  setText("predAdvice", prediction.advice);

  const badge = document.getElementById("predChange");
  const direction = prediction.direction;
  if (badge) {
    badge.className = "change-badge " + (direction === "up" ? "up" : direction === "down" ? "down" : "steady");
    const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
    badge.textContent = arrow + " " + Math.abs(Number(prediction.change)).toFixed(1) + "°C";
  }

  const model = prediction.model || {};
  setText("predMeta", model.algorithm + " · " + model.samples + " training samples");
  setWidth("confidenceFill", prediction.confidence);
  setText("confidenceValue", prediction.confidence + "%");
}

function renderSun(current) {
  setText("sunriseValue", current.sunrise);
  setText("sunsetValue", current.sunset);
  setText("sunStatus", current.is_day ? "Daylight now · the sun is up" : "Night time · the sun has set");
  setText("sunArcIcon", current.is_day ? "☀️" : "🌙");
}

function renderMetrics(current) {
  setText("metricHumidity", current.humidity + "%");
  setText("metricWind", current.wind_speed + " km/h");
  setText("metricPressure", current.pressure + " hPa");
  setText("metricVisibility", current.visibility + " km");
  setText("metricFeels", Number(current.feels_like).toFixed(1) + "°C");

  setWidth("barHumidity", current.humidity);
  setWidth("barWind", (current.wind_speed / 25) * 100);
  setWidth("barPressure", ((current.pressure - 980) / 60) * 100);
  setWidth("barVisibility", (current.visibility / 10) * 100);
  setWidth("barFeels", ((Number(current.feels_like) + 10) / 55) * 100);
}

function renderForecast(forecast) {
  const daily = (forecast && forecast.daily) || [];
  const hourly = (forecast && forecast.hourly) || [];

  const dailyHtml = daily.map(function (item, index) {
    const date = new Date(item.date + "T00:00:00");
    const label = isNaN(date.getTime()) ? item.date : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return '<div class="forecast-day ' + (index === 0 ? "today" : "") + '">' +
      '<div class="day-name">' + escapeValue(item.day) + "</div>" +
      '<div class="day-date">' + escapeValue(label) + "</div>" +
      '<div class="day-icon">' + iconFor(item) + "</div>" +
      '<div class="day-temps"><span class="day-high">' + Number(item.max).toFixed(0) + "°</span>" +
      '<span class="day-low">' + Number(item.min).toFixed(0) + "°</span></div>" +
      '<div class="day-meta"><i class="bi bi-droplet me-1"></i>' + item.humidity + "% · <i class=\"bi bi-umbrella\"></i> " + item.pop + "%</div>" +
      "</div>";
  }).join("");

  setHtml("forecastDaily", dailyHtml || '<div class="text-muted">Forecast data unavailable.</div>');

  const hourlyHtml = hourly.map(function (item) {
    return '<div class="forecast-hour">' +
      '<div class="hour-time">' + escapeValue(item.time.split(" ")[1] || item.time) + "</div>" +
      '<div class="hour-icon">' + iconFor(item) + "</div>" +
      '<div class="hour-temp">' + Number(item.temp).toFixed(0) + "°</div>" +
      '<div class="hour-meta">' + escapeValue(item.condition) + " · " + item.pop + "%</div>" +
      "</div>";
  }).join("");

  setHtml("forecastHourly", hourlyHtml || '<div class="text-muted">Hourly data unavailable.</div>');
}

function axisTheme() {
  const light = document.body.classList.contains("light-mode");
  return {
    text: light ? "rgba(20,35,61,0.65)" : "rgba(255,255,255,0.65)",
    grid: light ? "rgba(20,35,61,0.08)" : "rgba(255,255,255,0.09)"
  };
}

function buildChart(id, type, labels, values, lineColor, fillColor, filled) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;
  if (SkyCharts[id]) SkyCharts[id].destroy();

  const theme = axisTheme();
  SkyCharts[id] = new Chart(canvas, {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        label: id,
        data: values,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        pointBackgroundColor: lineColor,
        tension: type === "bar" ? 0 : 0.38,
        fill: filled,
        borderRadius: type === "bar" ? 6 : 0,
        barPercentage: 0.55
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(12,28,55,0.94)",
          padding: 10,
          displayColors: false
        }
      },
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: theme.text, maxTicksLimit: 5, font: { size: 9 } }
        },
        y: {
          grid: { color: theme.grid },
          ticks: { color: theme.text, font: { size: 9 }, maxTicksLimit: 5 },
          border: { display: false }
        }
      }
    }
  });
}

function renderCharts(charts) {
  if (!charts || !charts.labels || !charts.labels.length) return;
  buildChart("tempChart", "line", charts.labels, charts.temperature, "#ff8a9b", "rgba(255,138,155,0.16)", true);
  buildChart("humidityChart", "line", charts.labels, charts.humidity, "#5cc8f5", "rgba(92,200,245,0.16)", true);
  buildChart("windChart", "bar", charts.labels, charts.wind_speed, "#4ed6a5", "rgba(78,214,165,0.5)", false);
  buildChart("pressureChart", "line", charts.labels, charts.pressure, "#ffc46b", "rgba(255,196,107,0.14)", false);
}

function updateChartTheme() {
  const theme = axisTheme();
  Object.keys(SkyCharts).forEach(function (id) {
    const chart = SkyCharts[id];
    chart.options.scales.x.ticks.color = theme.text;
    chart.options.scales.y.ticks.color = theme.text;
    chart.options.scales.y.grid.color = theme.grid;
    chart.update();
  });
}

function initMap() {
  const element = document.getElementById("weatherMap");
  if (!element) return;
  if (!window.L) {
    element.innerHTML = '<div class="d-flex h-100 align-items-center justify-content-center" style="color:rgba(255,255,255,.6)">Map unavailable while offline</div>';
    return;
  }
  weatherMap = L.map("weatherMap", { scrollWheelZoom: false }).setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(weatherMap);
}

function renderMap(current) {
  const label = document.getElementById("mapLabel");
  if (label) {
    label.innerHTML = '<i class="bi bi-geo-alt-fill me-1"></i>' + escapeValue(current.city) +
      " · " + Number(current.lat).toFixed(2) + ", " + Number(current.lon).toFixed(2);
  }
  if (!window.L || !weatherMap) return;

  const lat = Number(current.lat);
  const lon = Number(current.lon);
  weatherMap.setView([lat, lon], 9);

  if (weatherMarker) weatherMap.removeLayer(weatherMarker);
  const icon = L.divIcon({
    className: "",
    html: '<div class="weather-marker">' + SkyCast.emojiFromIcon(current.icon) + "</div>",
    iconSize: [44, 48],
    iconAnchor: [22, 46],
    popupAnchor: [0, -42]
  });
  weatherMarker = L.marker([lat, lon], { icon: icon }).addTo(weatherMap);
  weatherMarker.bindPopup(
    "<strong>" + escapeValue(current.city) + "</strong><br>" +
    Number(current.temp).toFixed(1) + "°C · " + escapeValue(current.description)
  ).openPopup();
  window.setTimeout(function () { weatherMap.invalidateSize(); }, 250);
}

function renderAll(payload) {
  renderCurrent(payload.current);
  renderPrediction(payload.prediction);
  renderSun(payload.current);
  renderMetrics(payload.current);
  renderForecast(payload.forecast);
  renderCharts(payload.charts);
  renderMap(payload.current);
  SkyCast.setWeatherScene(payload.current.weather_type);

  const badge = document.getElementById("dataBadge");
  const badgeText = document.getElementById("dataBadgeText");
  if (badge) badge.classList.toggle("demo", Boolean(payload.meta && payload.meta.demo));
  setText("dataBadgeText", payload.meta && payload.meta.demo ? "Demo data" : "Live data");
}

function currentParams() {
  const query = new URLSearchParams(window.location.search);
  const city = query.get("city");
  const country = query.get("country");
  const lat = query.get("lat");
  const lon = query.get("lon");
  if (city) return country ? { city: city, country: country } : { city: city };
  if (lat && lon) return { lat: lat, lon: lon };
  return { city: document.body.dataset.defaultCity || "London" };
}

function loadWeather(params) {
  const query = new URLSearchParams();
  Object.keys(params || {}).forEach(function (key) {
    if (params[key] !== "" && params[key] != null) query.append(key, params[key]);
  });
  clearError();
  SkyCast.showLoading();

  fetch("/api/weather?" + query.toString())
    .then(function (response) {
      return response.json().then(function (payload) { return { ok: response.ok, payload: payload }; });
    })
    .then(function (result) {
      if (!result.ok || result.payload.error) throw new Error(result.payload.error || "Weather request failed");
      renderAll(result.payload);
      window.history.replaceState({}, "", "/dashboard?" + query.toString());
    })
    .catch(function (error) {
      showError(error.message || "Unable to load weather data.");
      SkyCast.toast(error.message || "Unable to load weather data", "error");
    })
    .finally(function () { SkyCast.hideLoading(); });
}

function requestLocation() {
  if (!navigator.geolocation) {
    SkyCast.toast("Geolocation is not supported by this browser", "error");
    return;
  }
  SkyCast.showLoading();
  navigator.geolocation.getCurrentPosition(
    function (position) {
      loadWeather({
        lat: position.coords.latitude.toFixed(4),
        lon: position.coords.longitude.toFixed(4)
      });
    },
    function () {
      SkyCast.hideLoading();
      SkyCast.toast("Location access was denied. Search for a city instead.", "error");
    },
    { timeout: 10000, maximumAge: 300000 }
  );
}

document.addEventListener("DOMContentLoaded", function () {
  setText(
    "todayDate",
    new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  );

  initMap();

  const dashboardForm = document.getElementById("dashboardSearchForm");
  if (dashboardForm) {
    dashboardForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const params = cityParams(document.getElementById("cityInput").value);
      if (params.city) loadWeather(params);
    });
  }

  const mobileForm = document.getElementById("mobileSearchForm");
  if (mobileForm) {
    mobileForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const params = cityParams(document.getElementById("mobileCityInput").value);
      if (params.city) loadWeather(params);
    });
  }

  document.getElementById("locateBtn").addEventListener("click", requestLocation);
  const mobileLocate = document.getElementById("mobileLocateBtn");
  if (mobileLocate) mobileLocate.addEventListener("click", requestLocation);

  document.getElementById("refreshBtn").addEventListener("click", function () { loadWeather(currentParams()); });

  document.querySelectorAll(".tab-pill").forEach(function (button) {
    button.addEventListener("click", function () {
      document.querySelectorAll(".tab-pill").forEach(function (item) { item.classList.remove("active"); });
      button.classList.add("active");
      const tab = button.dataset.tab;
      const daily = document.getElementById("forecastDaily");
      const hourly = document.getElementById("forecastHourly");
      if (daily) daily.classList.toggle("d-none", tab !== "daily");
      if (hourly) hourly.classList.toggle("d-none", tab !== "hourly");
    });
  });

  window.addEventListener("skycast:themechange", function () {
    window.setTimeout(updateChartTheme, 40);
  });

  loadWeather(currentParams());
});
