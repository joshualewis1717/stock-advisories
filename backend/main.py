# main.py
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pytrends.request import TrendReq
import pandas as pd
import numpy as np
import time

app = FastAPI(title="Trend Death Predictor API")

# Allow your Next.js frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise pytrends once (reuse session)
pytrends = TrendReq(hl='en-GB', tz=0)


# -----------------------------
# Utility: fetch trend data
# -----------------------------
def get_trend_data(keyword: str):
    try:
        pytrends.build_payload([keyword], timeframe='today 3-m')
        df = pytrends.interest_over_time()

        if df.empty:
            return None

        # remove "isPartial" column if present
        if "isPartial" in df.columns:
            df = df.drop(columns=["isPartial"])

        return df.reset_index()

    except Exception as e:
        print("Error fetching trends:", e)
        return None


# -----------------------------
# Utility: feature extraction
# -----------------------------
def extract_features(df: pd.DataFrame, keyword: str):
    values = df[keyword].values

    peak = np.max(values)
    mean = np.mean(values)
    std = np.std(values)

    # simple slope (trend direction)
    x = np.arange(len(values))
    slope = np.polyfit(x, values, 1)[0]

    return {
        "peak": float(peak),
        "mean": float(mean),
        "std": float(std),
        "slope": float(slope),
    }


# -----------------------------
# Dummy prediction (replace later with TensorFlow)
# -----------------------------
def predict_lifespan(features: dict):
    # VERY basic placeholder logic
    score = features["peak"] * 0.02 + features["slope"] * 10

    # clamp result
    days = max(0.5, min(7, score))

    return round(days, 2)


# -----------------------------
# Routes
# -----------------------------

@app.get("/")
def root():
    return {"status": "API running"}


@app.get("/predict")
def predict(keyword: str = Query(..., description="Search term")):
    time.sleep(1)  # basic rate limiting

    df = get_trend_data(keyword)

    if df is None:
        return {"error": "No data found"}

    features = extract_features(df, keyword)
    prediction = predict_lifespan(features)

    return {
        "keyword": keyword,
        "prediction_days": prediction,
        "features": features,
        "data": df.to_dict(orient="records")
    }