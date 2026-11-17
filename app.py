import hashlib
import math
import os
import random
from collections import Counter, OrderedDict
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, render_template, request

try:
    import requests
except ImportError:
    requests = None

from model import TemperaturePredictor


def _load_dotenv():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_dotenv()

app = Flask(__name__)
API_KEY = os.environ.get("OPENWEATHER_API_KEY", "").strip()
BASE_URL = "https://api.openweathermap.org/data/2.5"
UNITS = "metric"
DEFAULT_CITY = "London"
DATASET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataset", "weather_history.csv")

predictor = TemperaturePredictor(DATASET_PATH)
predictor.load_or_train()


class WeatherServiceError(Exception):
    def __init__(self, message, status_code=404):
        super().__init__(message)
        self.status_code = status_code


def _local_datetime(timestamp, offset=0):
    return datetime.fromtimestamp(timestamp + offset, tz=timezone.utc)


def _format_time(timestamp, offset=0):
    return _local_datetime(timestamp, offset).strftime("%I:%M %p")


def _weather_type(condition, icon, is_day=True):
    code = int(icon[-2:]) if icon and len(icon) >= 4 else 800
    if 200 <= code <= 232:
        return "storm"
    if 300 <= code <= 531:
        return "rain"
    if 600 <= code <= 622:
        return "snow"
    if 700 <= code <= 781:
        return "fog"
    if code == 800:
        return "sunny" if is_day else "night"
    return "cloudy" if is_day else "night-cloudy"


def _icon_for(kind, is_day):
    suffix = "d" if is_day else "n"
    mapping = {
        "sunny": "01", "cloudy": "03", "rain": "10", "drizzle": "09",
        "storm": "11", "snow": "13", "fog": "50", "night": "01"
    }
    return mapping.get(kind, "02") + suffix


def _normalize_current(raw):
    weather = raw.get("weather", [{}])[0]
    main = raw.get("main", {})
    wind = raw.get("wind", {})
    sys = raw.get("sys", {})
    offset = int(raw.get("timezone", 0))
    now = raw.get("dt", int(datetime.now(timezone.utc).timestamp()))
    sunrise = sys.get("sunrise", now - 6 * 3600)
    sunset = sys.get("sunset", now + 6 * 3600)
    is_day = sunrise <= now <= sunset
    condition = weather.get("main", "Clear")
    icon = weather.get("icon", "01d")

    return {
        "city": raw.get("name", "Unknown"),
        "country": sys.get("country", ""),
        "temp": round(float(main.get("temp", 0)), 1),
        "feels_like": round(float(main.get("feels_like", main.get("temp", 0))), 1),
        "humidity": int(main.get("humidity", 0)),
        "wind_speed": round(float(wind.get("speed", 0)), 1),
        "wind_deg": int(wind.get("deg", 0)),
        "pressure": int(main.get("pressure", 0)),
        "visibility": round(raw.get("visibility", 10000) / 1000, 1),
        "condition": condition,
        "description": str(weather.get("description", "")).title(),
        "icon": icon,
        "weather_type": _weather_type(condition, icon, is_day),
        "sunrise": _format_time(sunrise, offset),
        "sunset": _format_time(sunset, offset),
        "is_day": is_day,
        "timezone": offset,
        "lat": round(raw.get("coord", {}).get("lat", 0), 4),
        "lon": round(raw.get("coord", {}).get("lon", 0), 4),
        "observed_at": _format_time(now, offset)
    }


def _normalize_forecast(raw):
    entries = []
    offset = int(raw.get("city", {}).get("timezone", 0))
    for item in raw.get("list", [])[:40]:
        weather = item.get("weather", [{}])[0]
        main = item.get("main", {})
        moment = _local_datetime(item.get("dt", 0), offset)
        icon = weather.get("icon", "02d")
        condition = weather.get("main", "Clear")
        entries.append({
            "dt": item.get("dt", 0),
            "date": moment.strftime("%Y-%m-%d"),
            "time": moment.strftime("%a %H:%M"),
            "hour": moment.strftime("%H:%M"),
            "label": moment.strftime("%a %H:%M"),
            "temp": round(float(main.get("temp", 0)), 1),
            "feels_like": round(float(main.get("feels_like", 0)), 1),
            "humidity": int(main.get("humidity", 0)),
            "wind_speed": round(float(item.get("wind", {}).get("speed", 0)), 1),
            "pressure": int(main.get("pressure", 0)),
            "condition": condition,
            "description": str(weather.get("description", "")).title(),
            "icon": icon,
            "pop": int(round(float(item.get("pop", 0)) * 100)),
            "weather_type": _weather_type(condition, icon, moment.hour >= 6 and moment.hour < 19)
        })
    return entries, offset


def _group_daily(entries):
    grouped = OrderedDict()
    for entry in entries:
        grouped.setdefault(entry["date"], []).append(entry)

    daily = []
    for date, items in list(grouped.items())[:5]:
        icons = Counter(item["icon"] for item in items)
        conditions = Counter(item["condition"] for item in items)
        icon = icons.most_common(1)[0][0]
        condition = conditions.most_common(1)[0][0]
        try:
            day_name = datetime.strptime(date, "%Y-%m-%d").strftime("%a")
        except ValueError:
            day_name = date
        daily.append({
            "date": date,
            "day": day_name,
            "min": round(min(item["temp"] for item in items), 1),
            "max": round(max(item["temp"] for item in items), 1),
            "humidity": round(sum(item["humidity"] for item in items) / len(items)),
            "wind_speed": round(sum(item["wind_speed"] for item in items) / len(items), 1),
            "pressure": round(sum(item["pressure"] for item in items) / len(items)),
            "condition": condition,
            "description": items[0]["description"],
            "icon": icon,
            "pop": max(item["pop"] for item in items),
            "weather_type": _weather_type(condition, icon, True),
            "count": len(items)
        })
    return daily


def _build_charts(entries):
    return {
        "labels": [item["label"] for item in entries],
        "temperature": [item["temp"] for item in entries],
        "humidity": [item["humidity"] for item in entries],
        "wind_speed": [item["wind_speed"] for item in entries],
        "pressure": [item["pressure"] for item in entries]
    }


def _build_payload(raw_current, raw_forecast, demo=False):
    current = _normalize_current(raw_current)
    entries, offset = _normalize_forecast(raw_forecast)
    return {
        "current": current,
        "forecast": {
            "daily": _group_daily(entries),
            "hourly": entries[:12]
        },
        "charts": _build_charts(entries[:16]),
        "meta": {
            "demo": demo,
            "units": "metric",
            "timezone": offset,
            "source": "Demo data" if demo else "OpenWeatherMap",
            "api_enabled": bool(API_KEY)
        }
    }


def _demo_payload(city=None, lat=None, lon=None):
    seed_text = (city or (f"{lat},{lon}" if lat is not None and lon is not None else DEFAULT_CITY)).lower()
    digest = hashlib.md5(seed_text.encode("utf-8")).digest()
    rng = random.Random(int.from_bytes(digest[:4], "big"))
    now = datetime.now(timezone.utc)
    day_of_year = now.timetuple().tm_yday
    base_temp = 18 + 10 * math.sin((day_of_year - 105) / 365.0 * 2 * math.pi) + (digest[4] % 7) - 3
    is_day = 6 <= now.hour < 19
    kind = ["sunny", "cloudy", "rain", "sunny", "cloudy", "storm"][digest[5] % 6]
    if not is_day and kind == "sunny":
        kind = "night"

    descriptions = {
        "sunny": "clear sky", "cloudy": "scattered clouds", "rain": "light rain",
        "storm": "thunderstorm", "snow": "light snow", "fog": "mist", "night": "clear night sky"
    }
    condition_names = {
        "sunny": "Clear", "cloudy": "Clouds", "rain": "Rain", "storm": "Thunderstorm",
        "snow": "Snow", "fog": "Mist", "night": "Clear"
    }

    current = {
        "city": city.title() if city else "Your Location",
        "country": " Demo",
        "temp": round(base_temp + rng.uniform(-1.2, 1.2), 1),
        "feels_like": round(base_temp + rng.uniform(-2.5, 0.5), 1),
        "humidity": rng.randint(45, 82),
        "wind_speed": round(rng.uniform(2.5, 12.0), 1),
        "wind_deg": rng.randint(0, 359),
        "pressure": rng.randint(1004, 1024),
        "visibility": round(rng.uniform(6.0, 10.0), 1),
        "condition": condition_names[kind],
        "description": descriptions[kind].title(),
        "icon": _icon_for(kind, is_day),
        "weather_type": kind,
        "sunrise": "06:12 AM",
        "sunset": "06:47 PM",
        "is_day": is_day,
        "timezone": 0,
        "lat": round(float(lat), 4) if lat is not None else 51.5074,
        "lon": round(float(lon), 4) if lon is not None else -0.1278,
        "observed_at": now.strftime("%I:%M %p")
    }

    start = now.replace(hour=(now.hour // 3) * 3, minute=0, second=0, microsecond=0)
    forecast_list = []
    for index in range(40):
        moment = start + timedelta(hours=3 * index)
        moment_day = 6 <= moment.hour < 19
        roll = rng.random()
        if roll < 0.30:
            entry_kind = "sunny" if moment_day else "night"
        elif roll < 0.58:
            entry_kind = "cloudy"
        elif roll < 0.82:
            entry_kind = "rain"
        elif roll < 0.92:
            entry_kind = "storm"
        else:
            entry_kind = "snow" if base_temp < 4 else "fog"
        temp = base_temp + 4.2 * math.sin((moment.hour - 9) / 24.0 * 2 * math.pi) + index * 0.04 + rng.uniform(-1.3, 1.3)
        forecast_list.append({
            "dt": int(moment.timestamp()),
            "main": {
                "temp": round(temp, 1),
                "feels_like": round(temp - rng.uniform(0.5, 2.0), 1),
                "humidity": rng.randint(42, 88),
                "pressure": rng.randint(1002, 1024)
            },
            "wind": {"speed": round(rng.uniform(1.8, 11.0), 1)},
            "weather": [{
                "main": condition_names[entry_kind],
                "description": descriptions[entry_kind],
                "icon": _icon_for(entry_kind, moment_day)
            }],
            "pop": round(rng.uniform(0.05, 0.85) if entry_kind in ("rain", "storm") else rng.uniform(0.0, 0.25), 2)
        })

    raw_forecast = {"city": {"timezone": 0}, "list": forecast_list}
    payload = _build_payload({"name": current["city"], "sys": {"country": "Demo"},
                              "coord": {"lat": current["lat"], "lon": current["lon"]},
                              "dt": int(now.timestamp()), "timezone": 0,
                              "visibility": int(current["visibility"] * 1000),
                              "main": {"temp": current["temp"], "feels_like": current["feels_like"],
                                       "humidity": current["humidity"], "pressure": current["pressure"]},
                              "wind": {"speed": current["wind_speed"], "deg": current["wind_deg"]},
                              "weather": [{"main": current["condition"], "description": current["description"],
                                           "icon": current["icon"]}]}, raw_forecast, demo=True)
    payload["current"] = current
    return payload


def _make_prediction(payload):
    current = payload["current"]
    daily = payload["forecast"]["daily"]
    previous = daily[0]["min"] if daily else current["temp"] - 0.5
    predicted = predictor.predict(current["temp"], current["humidity"], current["wind_speed"],
                                  current["pressure"], previous)
    change = round(predicted - current["temp"], 1)

    if change >= 1.5:
        advice = "Warmer tomorrow. Light layers will be comfortable."
    elif change <= -1.5:
        advice = "Cooler tomorrow. Keep a jacket handy."
    elif current["humidity"] > 70:
        advice = "Humid conditions may continue into tomorrow."
    else:
        advice = "Temperature is expected to stay fairly stable."

    return {
        "temperature": predicted,
        "change": change,
        "direction": "up" if change > 0 else ("down" if change < 0 else "steady"),
        "advice": advice,
        "confidence": 82,
        "model": predictor.info()
    }


def get_weather(city=None, lat=None, lon=None, country=None):
    payload = None
    if API_KEY and requests is not None:
        params = {"appid": API_KEY, "units": UNITS, "lang": "en"}
        if lat is not None and lon is not None:
            params.update({"lat": lat, "lon": lon})
        elif city:
            params["q"] = f"{city},{country}" if country else city

        try:
            current_response = requests.get(f"{BASE_URL}/weather", params=params, timeout=8)
            if current_response.status_code == 404:
                label = f"{city},{country}" if country else city
                raise WeatherServiceError(f"No city found for '{label}'.")
            if current_response.status_code == 401:
                payload = None
            elif current_response.status_code == 200:
                forecast_response = requests.get(f"{BASE_URL}/forecast", params=params, timeout=8)
                if forecast_response.status_code == 200:
                    payload = _build_payload(current_response.json(), forecast_response.json(), demo=False)
        except WeatherServiceError:
            raise
        except requests.RequestException:
            payload = None

    if payload is None:
        payload = _demo_payload(city, lat, lon)

    payload["prediction"] = _make_prediction(payload)
    return payload


@app.route("/")
def index():
    return render_template("index.html", default_city=DEFAULT_CITY, api_enabled=bool(API_KEY))


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", default_city=DEFAULT_CITY, api_enabled=bool(API_KEY))


@app.get("/api/weather")
@app.get("/api/weather/<city>")
def api_weather(city=None):
    city = (city or request.args.get("city") or "").strip()
    country = (request.args.get("country") or "").strip()
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)

    if not city and (lat is None or lon is None):
        return jsonify({"error": "Provide a city name or latitude and longitude."}), 400

    try:
        return jsonify(get_weather(city or None, lat, lon, country or None))
    except WeatherServiceError as error:
        return jsonify({"error": str(error)}), error.status_code
    except Exception as error:
        app.logger.exception("Weather request failed: %s", error)
        return jsonify({"error": "Unable to fetch weather data right now."}), 500


@app.get("/api/model")
def api_model():
    return jsonify(predictor.info())


@app.get("/api/health")
def api_health():
    return jsonify({"status": "ok", "api_key_configured": bool(API_KEY), "model": predictor.info()})


if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "5000")),
            debug=os.environ.get("FLASK_DEBUG", "1") == "1")
