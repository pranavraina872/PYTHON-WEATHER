# SkyCast - Weather Prediction and Monitoring System

A modern, glassmorphism weather dashboard built with Flask, Bootstrap 5, Chart.js, Leaflet and a scikit-learn linear regression model. Designed as a polished final-year college project that runs locally with or without an API key.

## Features

- Live current conditions: temperature, feels-like, humidity, wind, pressure, visibility, sunrise/sunset
- City search and browser geolocation
- 5-day and 12-step hourly forecasts with weather icons
- Four interactive Chart.js visualisations: temperature, humidity, wind and pressure
- Machine learning prediction of tomorrow's temperature
- Leaflet map with an animated weather marker for the selected location
- Animated sunny, rain, storm, snow, fog, cloud and night-sky backgrounds
- Automatic day/night detection plus a manual light/dark theme toggle
- Loading animations, toasts, responsive Apple Weather-inspired layout

## Project Structure

```text
weather-project/
├── app.py                    Flask routes and OpenWeatherMap integration
├── model.py                  Linear regression training and prediction
├── requirements.txt          Python dependencies
├── .env.example              API key template
├── dataset/
│   └── weather_history.csv   Auto-generated training data
├── static/
│   ├── css/style.css         Glassmorphism, gradients and animations
│   ├── js/app.js             Shared theme, scene and particle engine
│   ├── js/index.js           Landing page preview and search
│   ├── js/dashboard.js       API calls, charts, map and rendering
│   └── images/favicon.svg
└── templates/
    ├── index.html            Landing page
    └── dashboard.html        Full dashboard
```

## Quick Start

### 1. Create and activate a virtual environment

Windows:

```powershell
python -m venv venv
.\venv\Scripts\activate
```

macOS / Linux:

```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the application

```bash
python app.py
```

Open `http://127.0.0.1:5000` in your browser. The dashboard is at `/dashboard`.

An OpenWeatherMap key is already configured in `.env`. The app falls back to **demo mode** if the key is missing or a request fails, so every page and feature still works during development or a presentation.

## Adding or Changing the Live API Key

1. Get a free key from [OpenWeatherMap](https://openweathermap.org/api).
2. Open `.env` in the project root.
3. Replace the value with your key:

```dotenv
OPENWEATHER_API_KEY=your_actual_key_here
```

Alternatively, set an environment variable before running the app:

```powershell
$env:OPENWEATHER_API_KEY = "your_actual_key_here"
python app.py
```

```bash
export OPENWEATHER_API_KEY="your_actual_key_here"
python app.py
```

Restart the server after changing the key. The dashboard badge changes from **Demo data** to **Live data**. Search accepts `City` or `City,Country` (for example `London,GB`). The key stays server-side and is never sent to the browser.

> Note: newly created OpenWeatherMap keys can take a couple of hours to activate. The app automatically falls back to demo data if a request fails.

## Machine Learning Module

`model.py` trains a linear regression model on `dataset/weather_history.csv`. The dataset is generated automatically on first run if it does not exist, using a reproducible seasonal pattern with realistic noise.

- Inputs: current temperature, humidity, wind speed, pressure and previous day's temperature
- Target: next day's temperature
- Engine: scikit-learn when available, with a pure-Python least-squares fallback
- Output: predicted temperature, change, confidence and a short advisory message

Inspect the trained model at `/api/model`.

## API Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /` | Landing page |
| `GET /dashboard` | Dashboard page |
| `GET /api/weather?city=London` | Current weather, forecast, charts and prediction |
| `GET /api/weather?city=London&country=GB` | Disambiguate a city using its country code |
| `GET /api/weather?lat=19.07&lon=72.87` | Weather for a geographic coordinate |
| `GET /api/model` | Model metadata |
| `GET /api/health` | Service health check |

## Deploying to Vercel

Vercel detects `app.py` automatically because it exports a Flask instance named `app`. During the build, `build.py` copies `static/` into `public/static/` so Vercel can serve CSS, JavaScript and images from its CDN.

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import `PYTHON-WEATHER`.
3. Add the environment variable `OPENWEATHER_API_KEY` with your key. The local `.env` file is intentionally not committed.
4. Deploy, then open the generated URL with `/dashboard` appended.

Use `vercel dev` to test the Vercel setup locally.

## Presentation Tips

- Run with a live API key and search for a city chosen by the audience.
- Toggle the theme and switch between sunny, rainy and night conditions to show the animated backgrounds.
- Use the Daily/Hourly tabs, hover over the charts and zoom the map.
- Explain the regression inputs and show `/api/model` to demonstrate the ML component.

## Troubleshooting

- **Charts or map do not load:** check your internet connection; Bootstrap, Chart.js, Leaflet and fonts are loaded from CDNs.
- **Location button does nothing:** browsers require HTTPS or localhost for geolocation, and permission must be granted.
- **"No city found" error:** check the spelling, or use demo mode without a key.
- **scikit-learn not installed:** the model still trains using the built-in least-squares implementation.
