document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("homeSearchForm");
  const input = document.getElementById("homeCityInput");
  const chips = document.querySelectorAll("#quickCities .chip");

  function queryForCity(value) {
    const parts = String(value || "").split(",").map(function (part) { return part.trim(); }).filter(Boolean);
    const query = new URLSearchParams();
    if (parts[0]) query.append("city", parts[0]);
    if (parts[1]) query.append("country", parts[1]);
    return query.toString();
  }

  function openDashboard(city) {
    const query = queryForCity(city);
    if (!query) return;
    window.location.href = "/dashboard?" + query;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function loadPreview(city) {
    const query = queryForCity(city) || queryForCity("London");
    SkyCast.showLoading();
    fetch("/api/weather?" + query)
      .then(function (response) { return response.json(); })
      .then(function (payload) {
        if (payload.error) throw new Error(payload.error);
        const current = payload.current;
        setText("previewCity", current.city + (current.country ? ", " + current.country.trim() : ""));
        setText("previewTime", current.observed_at);
        setText("previewTemp", Number(current.temp).toFixed(1) + "°");
        setText("previewCondition", current.condition);
        setText("previewDesc", current.description);
        setText("previewHumidity", current.humidity + "%");
        setText("previewWind", current.wind_speed + " km/h");
        setText("previewFeels", Number(current.feels_like).toFixed(1) + "°");
        setText("previewIcon", SkyCast.emojiFromIcon(current.icon));
        SkyCast.setWeatherScene(current.weather_type);
      })
      .catch(function (error) {
        setText("previewCondition", "Preview unavailable");
        setText("previewDesc", "Search from the dashboard instead");
        SkyCast.toast(error.message || "Could not load preview", "error");
      })
      .finally(function () { SkyCast.hideLoading(); });
  }

  if (form && input) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      openDashboard(input.value);
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      const city = chip.dataset.city;
      if (input) input.value = city;
      loadPreview(city);
    });
  });

  const urlCity = new URLSearchParams(window.location.search).get("city");
  loadPreview(urlCity || (input ? input.value : "London"));
});
