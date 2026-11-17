window.SkyCast = (function () {
  const THEME_KEY = "skycast-theme";
  const SCENES = ["sunny", "cloudy", "rain", "storm", "snow", "fog", "night", "night-cloudy"];

  const TYPE_EMOJI = {
    sunny: "☀️",
    cloudy: "☁️",
    rain: "🌧️",
    drizzle: "🌦️",
    storm: "⛈️",
    snow: "❄️",
    fog: "🌫️",
    night: "🌙",
    "night-cloudy": "☁️"
  };

  function emojiFor(type) {
    return TYPE_EMOJI[type] || "🌤️";
  }

  function emojiFromIcon(icon) {
    if (!icon) return "🌤️";
    const code = parseInt(icon.substring(0, 2), 10);
    const night = icon.endsWith("n");
    if (code === 1) return night ? "🌙" : "☀️";
    if (code === 2) return night ? "🌤️" : "🌤️";
    if (code === 3 || code === 4) return "☁️";
    if (code === 9) return "🌦️";
    if (code === 10) return "🌧️";
    if (code === 11) return "⛈️";
    if (code === 13) return "❄️";
    if (code === 50) return "🌫️";
    return "🌤️";
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function addParticles(layer, className, count, durationMin, durationMax) {
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("span");
      particle.className = "particle " + className;
      particle.style.left = randomBetween(0, 100) + "%";
      particle.style.top = randomBetween(-10, 0) + "%";
      particle.style.animationDuration = randomBetween(durationMin, durationMax) + "s";
      particle.style.animationDelay = randomBetween(0, 8) + "s";
      particle.style.opacity = String(randomBetween(0.35, 0.95));
      if (className === "rain-drop") {
        particle.style.height = randomBetween(12, 26) + "px";
      }
      if (className === "snow-flake") {
        const size = randomBetween(4, 9) + "px";
        particle.style.width = size;
        particle.style.height = size;
      }
      layer.appendChild(particle);
    }
  }

  function renderParticles(scene) {
    const layer = document.getElementById("weatherParticles");
    if (!layer) return;
    layer.innerHTML = "";

    if (scene === "sunny") {
      const orb = document.createElement("span");
      orb.className = "particle sun-orb";
      layer.appendChild(orb);
      addParticles(layer, "cloud-puff", 3, 55, 90);
    } else if (scene === "cloudy") {
      addParticles(layer, "cloud-puff", 6, 45, 85);
    } else if (scene === "rain") {
      addParticles(layer, "cloud-puff", 5, 50, 80);
      addParticles(layer, "rain-drop", 65, 0.7, 1.5);
    } else if (scene === "storm") {
      addParticles(layer, "cloud-puff", 6, 40, 75);
      addParticles(layer, "rain-drop", 85, 0.55, 1.2);
      const flash = document.createElement("span");
      flash.className = "lightning-flash";
      layer.appendChild(flash);
    } else if (scene === "snow") {
      addParticles(layer, "cloud-puff", 4, 55, 90);
      addParticles(layer, "snow-flake", 55, 7, 15);
    } else if (scene === "fog") {
      addParticles(layer, "cloud-puff", 9, 60, 100);
    } else if (scene === "night" || scene === "night-cloudy") {
      addParticles(layer, "cloud-puff", 2, 65, 100);
    }
  }

  function setWeatherScene(type) {
    let scene = type || "sunny";
    if (scene === "night-cloudy") scene = "night";
    if (SCENES.indexOf(scene) === -1) scene = "sunny";
    const body = document.body;
    SCENES.forEach(function (item) {
      body.classList.remove("weather-" + item);
    });
    body.classList.add("weather-" + scene);
    body.dataset.scene = scene;
    renderParticles(scene);
  }

  function initStars() {
    const layer = document.getElementById("starsLayer");
    if (!layer) return;
    for (let index = 0; index < 90; index += 1) {
      const star = document.createElement("span");
      star.className = "star";
      star.style.left = randomBetween(1, 99) + "%";
      star.style.top = randomBetween(1, 85) + "%";
      star.style.animationDelay = randomBetween(0, 5) + "s";
      star.style.animationDuration = randomBetween(2, 6) + "s";
      const size = randomBetween(1, 3) + "px";
      star.style.width = size;
      star.style.height = size;
      layer.appendChild(star);
    }
  }

  function updateThemeIcon() {
    const button = document.getElementById("themeToggle");
    if (!button) return;
    const isLight = document.body.classList.contains("light-mode");
    button.innerHTML = isLight ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
    button.title = isLight ? "Switch to dark theme" : "Switch to light theme";
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light") document.body.classList.add("light-mode");
    updateThemeIcon();

    const button = document.getElementById("themeToggle");
    if (button) {
      button.addEventListener("click", function () {
        const isLight = document.body.classList.toggle("light-mode");
        localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
        updateThemeIcon();
        window.dispatchEvent(new CustomEvent("skycast:themechange", { detail: { light: isLight } }));
      });
    }
  }

  function showLoading() {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.remove("hidden");
  }

  function hideLoading() {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) window.setTimeout(function () { overlay.classList.add("hidden"); }, 350);
  }

  function toast(message, type) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toastElement = document.createElement("div");
    toastElement.className = "toast align-items-center border-0";
    toastElement.setAttribute("role", "status");
    toastElement.setAttribute("aria-live", "polite");
    toastElement.innerHTML =
      '<div class="d-flex">' +
      '<div class="toast-body"><i class="bi ' + (type === "error" ? "bi-exclamation-circle" : "bi-check-circle") + ' me-2"></i>' +
      String(message).replace(/[&<>"]/g, function (character) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character];
      }) +
      "</div>" +
      '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
      "</div>";
    container.appendChild(toastElement);
    if (window.bootstrap && bootstrap.Toast) {
      new bootstrap.Toast(toastElement, { delay: 4000 }).show();
    }
    toastElement.addEventListener("hidden.bs.toast", function () { toastElement.remove(); });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initStars();
    initTheme();
    setWeatherScene(document.body.dataset.scene || "sunny");
  });

  return {
    emojiFor: emojiFor,
    emojiFromIcon: emojiFromIcon,
    setWeatherScene: setWeatherScene,
    showLoading: showLoading,
    hideLoading: hideLoading,
    toast: toast,
    escapeHtml: escapeHtml
  };
})();
