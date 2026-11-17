import csv
import math
import os
import random
from datetime import datetime, timedelta

FEATURES = ["temp", "humidity", "wind_speed", "pressure", "prev_day_temp"]
TARGET = "next_day_temp"
FIELDS = ["date"] + FEATURES + [TARGET]


def generate_dataset(path, rows=240):
    random.seed(42)
    start = datetime(2024, 1, 1)
    history = []

    for index in range(rows + 2):
        day = start + timedelta(days=index)
        day_of_year = day.timetuple().tm_yday
        seasonal = 19 + 11 * math.sin((day_of_year - 105) / 365.0 * 2 * math.pi)
        temp = seasonal + random.gauss(0, 2.3)
        humidity = max(35, min(92, 62 + 14 * math.cos((day_of_year - 20) / 365.0 * 2 * math.pi) + random.gauss(0, 6)))
        wind_speed = max(1.0, min(24.0, 8 + 3 * math.sin(index / 9.0) + random.gauss(0, 2.2)))
        pressure = 1013 + 9 * math.sin(index / 14.0) + random.gauss(0, 3.5)
        history.append({"date": day.strftime("%Y-%m-%d"), "temp": temp, "humidity": humidity,
                        "wind_speed": wind_speed, "pressure": pressure})

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for index in range(1, len(history) - 1):
            current = history[index]
            writer.writerow({
                "date": current["date"],
                "temp": round(current["temp"], 1),
                "humidity": round(current["humidity"], 1),
                "wind_speed": round(current["wind_speed"], 1),
                "pressure": round(current["pressure"], 1),
                "prev_day_temp": round(history[index - 1]["temp"], 1),
                TARGET: round(history[index + 1]["temp"], 1)
            })


def _solve_linear_system(matrix, size):
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(matrix[row][column]))
        matrix[column], matrix[pivot] = matrix[pivot], matrix[column]
        divisor = matrix[column][column]
        if abs(divisor) < 1e-12:
            continue
        for row in range(column + 1, size):
            factor = matrix[row][column] / divisor
            for col in range(column, size + 1):
                matrix[row][col] -= factor * matrix[column][col]

    solution = [0.0] * size
    for row in range(size - 1, -1, -1):
        value = matrix[row][size]
        for col in range(row + 1, size):
            value -= matrix[row][col] * solution[col]
        solution[row] = value / matrix[row][row] if abs(matrix[row][row]) > 1e-12 else 0.0
    return solution


class TemperaturePredictor:
    def __init__(self, dataset_path=None):
        self.dataset_path = dataset_path
        self.model = None
        self.coefficients = None
        self.intercept = 0.0
        self.sample_count = 0
        self.engine = "none"
        self.trained = False

    def load_or_train(self, path=None):
        if path:
            self.dataset_path = path
        if not self.dataset_path:
            raise ValueError("A dataset path is required")

        if not os.path.exists(self.dataset_path):
            generate_dataset(self.dataset_path)

        rows = []
        with open(self.dataset_path, newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                try:
                    rows.append(([float(row[key]) for key in FEATURES], float(row[TARGET])))
                except (KeyError, TypeError, ValueError):
                    continue

        if not rows:
            raise ValueError("No valid training rows found in the dataset")

        features = [item[0] for item in rows]
        targets = [item[1] for item in rows]
        self.sample_count = len(rows)

        try:
            from sklearn.linear_model import LinearRegression
            self.model = LinearRegression()
            self.model.fit(features, targets)
            self.engine = "scikit-learn LinearRegression"
        except Exception:
            self.model = None
            size = len(FEATURES) + 1
            matrix = [[0.0] * (size + 1) for _ in range(size)]
            for row, target in zip(features, targets):
                values = row + [1.0]
                for i in range(size):
                    for j in range(size):
                        matrix[i][j] += values[i] * values[j]
                    matrix[i][size] += values[i] * target
            solution = _solve_linear_system(matrix, size)
            self.coefficients = solution[:-1]
            self.intercept = solution[-1]
            self.engine = "pure-python least squares"

        self.trained = True
        return self

    def predict(self, temp, humidity, wind_speed, pressure, prev_day_temp=None):
        if not self.trained:
            return round(float(temp), 1)
        if prev_day_temp is None:
            prev_day_temp = float(temp) - 0.5
        values = [float(temp), float(humidity), float(wind_speed), float(pressure), float(prev_day_temp)]

        if self.model is not None:
            return round(float(self.model.predict([values])[0]), 1)
        estimate = self.intercept + sum(coefficient * value for coefficient, value in zip(self.coefficients, values))
        return round(float(estimate), 1)

    def info(self):
        return {
            "trained": self.trained,
            "algorithm": "Linear Regression",
            "engine": self.engine,
            "samples": self.sample_count,
            "features": FEATURES,
            "target": TARGET
        }
