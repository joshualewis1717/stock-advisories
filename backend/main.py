from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pytrends.request import TrendReq

app = FastAPI(title="Trend Grave API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pytrends: TrendReq | None = None


def get_pytrends() -> TrendReq | None:
    global pytrends

    if pytrends is not None:
        return pytrends

    try:
        pytrends = TrendReq(hl="en-GB", tz=0)
    except Exception as exc:
        print("Error initialising pytrends:", exc)
        return None

    return pytrends


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "API running"}


@app.get("/stock-dashboard")
def stock_dashboard(
    symbol: str = Query(..., description="Stock ticker symbol"),
    keywords: str | None = Query(
        default=None,
        description="Optional comma-separated related keywords",
    ),
) -> dict[str, Any]:
    cleaned_symbol = symbol.strip().upper()
    if not cleaned_symbol:
        return {"error": "A stock symbol is required."}

    stock_snapshot = get_stock_snapshot(cleaned_symbol)
    if stock_snapshot is None:
        return {"error": f"No stock data found for {cleaned_symbol}."}

    company_name = stock_snapshot["company_name"]
    related_keywords = parse_keywords(keywords) or generate_related_keywords(
        cleaned_symbol,
        company_name,
    )

    predictions = [
        build_keyword_prediction(keyword) for keyword in related_keywords[:6]
    ]

    return {
        "symbol": cleaned_symbol,
        "company_name": company_name,
        "price": stock_snapshot["price"],
        "change_percent": stock_snapshot["change_percent"],
        "stock_data": stock_snapshot["stock_data"],
        "keywords": predictions,
    }


def get_stock_snapshot(symbol: str) -> dict[str, Any] | None:
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period="3mo", interval="1d", auto_adjust=False)
        if history.empty:
            return None

        history = history.reset_index()
        history["Date"] = pd.to_datetime(history["Date"])

        close_series = history["Close"].dropna()
        if close_series.empty:
            return None

        info = ticker.info if isinstance(ticker.info, dict) else {}
        company_name = (
            info.get("shortName")
            or info.get("longName")
            or symbol
        )

        first_close = float(close_series.iloc[0])
        last_close = float(close_series.iloc[-1])
        change_percent = 0.0 if first_close == 0 else ((last_close - first_close) / first_close) * 100

        stock_data = [
            {
                "date": row["Date"].strftime("%Y-%m-%d"),
                "close": round(float(row["Close"]), 2),
            }
            for _, row in history.iterrows()
            if pd.notna(row["Close"])
        ]

        return {
            "company_name": company_name,
            "price": round(last_close, 2),
            "change_percent": round(change_percent, 2),
            "stock_data": stock_data,
        }
    except Exception as exc:
        print("Error fetching stock data:", exc)
        return None


def parse_keywords(raw_keywords: str | None) -> list[str]:
    if not raw_keywords:
        return []

    seen: set[str] = set()
    parsed_keywords: list[str] = []
    for keyword in raw_keywords.split(","):
        cleaned_keyword = keyword.strip()
        normalized = cleaned_keyword.lower()
        if cleaned_keyword and normalized not in seen:
            seen.add(normalized)
            parsed_keywords.append(cleaned_keyword)

    return parsed_keywords


def generate_related_keywords(symbol: str, company_name: str) -> list[str]:
    llm_keywords = generate_keywords_with_local_llm(symbol, company_name)
    if llm_keywords:
        return llm_keywords[:6]

    return generate_related_keywords_fallback(symbol, company_name)


def generate_keywords_with_local_llm(symbol: str, company_name: str) -> list[str]:
    ollama_path = shutil.which("ollama")
    if not ollama_path:
        return []

    model_name = "qwen2.5:0.5b"
    prompt = f"""
        You generate concept keywords associated with a public company.
        Return only a JSON array with exactly 6 short keyword strings.
        Do not include markdown, numbering, explanation, the ticker by itself, or generic finance terms.

        Stock symbol: {symbol}
        Company name: {company_name}

        Rules:
        - Keywords should be themes, products, technologies, markets, or cultural topics strongly associated with the company.
        - Prefer concept words people would actually search for in relation to the company.
        - Avoid generic finance phrases like "stock", "earnings", "news", "forecast", "price target", "shares".
        - Avoid repeating the ticker or company name unless it is part of a specific product or platform name.
        - Keep each keyword under 4 words.
        - Avoid duplicates.
        """.strip()

    try:
        result = subprocess.run(
            [ollama_path, "run", model_name, prompt],
            capture_output=True,
            check=True,
            text=True,
            timeout=45,
        )
    except Exception as exc:
        print("Error generating keywords with local LLM:", exc)
        return []

    return parse_generated_keywords(result.stdout)


def parse_generated_keywords(raw_output: str) -> list[str]:
    cleaned_output = raw_output.strip()
    if not cleaned_output:
        return []

    fenced_match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned_output, re.DOTALL)
    if fenced_match:
        cleaned_output = fenced_match.group(1).strip()

    try:
        parsed_output = json.loads(cleaned_output)
    except json.JSONDecodeError:
        return parse_generated_keywords_from_text(cleaned_output)

    if not isinstance(parsed_output, list):
        return []

    keywords: list[str] = []
    seen: set[str] = set()
    for item in parsed_output:
        if not isinstance(item, str):
            continue

        keyword = collapse_whitespace(item)
        normalized = keyword.lower()
        if keyword and normalized not in seen:
            seen.add(normalized)
            keywords.append(keyword)
        if len(keywords) == 6:
            break

    return keywords


def parse_generated_keywords_from_text(raw_output: str) -> list[str]:
    keywords: list[str] = []
    seen: set[str] = set()
    for line in raw_output.splitlines():
        keyword = collapse_whitespace(re.sub(r"^[\-\d\.)\s]+", "", line))
        normalized = keyword.lower()
        if keyword and normalized not in seen:
            seen.add(normalized)
            keywords.append(keyword)
        if len(keywords) == 6:
            break

    return keywords


def generate_related_keywords_fallback(symbol: str, company_name: str) -> list[str]:
    company_root = normalize_company_name(company_name)
    short_alias = build_short_alias(company_root)
    normalized_symbol = symbol.upper()
    suggestion_map = {
        "NVDA": ["artificial intelligence", "AI chips", "data center", "GPUs", "CUDA", "robotics"],
        "AAPL": ["iPhone", "Apple Watch", "Vision Pro", "App Store", "iOS", "AirPods"],
        "MSFT": ["Azure", "Copilot", "Xbox", "OpenAI", "Office 365", "LinkedIn"],
        "GOOGL": ["Google Search", "YouTube", "Gemini", "Android", "cloud computing", "Waymo"],
        "AMZN": ["AWS", "Prime Video", "Alexa", "ecommerce", "logistics", "same-day delivery"],
        "META": ["Instagram", "WhatsApp", "metaverse", "Threads app", "Ray-Ban Meta", "VR headsets"],
        "TSLA": ["electric vehicles", "self-driving", "robotaxi", "Cybertruck", "battery storage", "Optimus robot"],
        "PLTR": ["data analytics", "defense tech", "Foundry", "AIP", "government contracts", "enterprise AI"],
    }

    if normalized_symbol in suggestion_map:
        suggestions = suggestion_map[normalized_symbol]
    else:
        suggestions = [
            company_root,
            f"{short_alias} products",
            f"{short_alias} AI",
            f"{short_alias} cloud",
            f"{short_alias} devices",
            f"{short_alias} software",
            f"{short_alias} platform",
            f"{short_alias} robotics",
        ]

    keywords: list[str] = []
    seen: set[str] = set()
    for keyword in suggestions:
        cleaned_keyword = collapse_whitespace(keyword)
        normalized = cleaned_keyword.lower()
        if (
            cleaned_keyword
            and normalized not in seen
            and normalized not in {symbol.lower(), company_root.lower(), short_alias.lower()}
        ):
            seen.add(normalized)
            keywords.append(cleaned_keyword)
        if len(keywords) == 6:
            break

    return keywords


def normalize_company_name(company_name: str) -> str:
    cleaned_name = collapse_whitespace(company_name.replace("&", " and "))
    cleaned_name = re.sub(r"[,./()]+", " ", cleaned_name)
    cleaned_name = collapse_whitespace(cleaned_name)
    cleaned_name = re.sub(
        r"\b(incorporated|inc|corp|corporation|co|company|holdings|holding|group|plc|ltd|limited|nv|sa|ag|se)\b",
        " ",
        cleaned_name,
        flags=re.IGNORECASE,
    )
    cleaned_name = collapse_whitespace(cleaned_name)
    return cleaned_name or company_name.strip() or "stock"


def build_short_alias(company_name: str) -> str:
    words = company_name.split()
    if len(words) <= 2:
        return company_name
    return " ".join(words[:2])


def collapse_whitespace(value: str) -> str:
    return " ".join(value.split())


def get_trend_data(keyword: str) -> pd.DataFrame | None:
    try:
        trends_client = get_pytrends()
        if trends_client is None:
            return None

        trends_client.build_payload([keyword], timeframe="today 3-m")
        df = pytrends.interest_over_time()
        if df.empty:
            return None

        if "isPartial" in df.columns:
            df = df.drop(columns=["isPartial"])

        return df.reset_index()
    except Exception as exc:
        print("Error fetching trends:", exc)
        return None


def extract_features(df: pd.DataFrame, keyword: str) -> dict[str, float]:
    values = df[keyword].values
    x_axis = np.arange(len(values))
    slope = np.polyfit(x_axis, values, 1)[0]

    return {
        "peak": float(np.max(values)),
        "mean": float(np.mean(values)),
        "std": float(np.std(values)),
        "slope": float(slope),
    }


def predict_lifespan(features: dict[str, float]) -> float:
    score = features["peak"] * 0.02 + features["slope"] * 10
    days = max(0.5, min(7, score))
    return round(days, 2)


def get_direction(slope: float) -> str:
    if slope > 0.15:
        return "up"
    if slope < -0.15:
        return "down"
    return "flat"


def build_keyword_prediction(keyword: str) -> dict[str, Any]:
    time.sleep(0.2)
    trend_df = get_trend_data(keyword)

    if trend_df is None:
        return {
            "keyword": keyword,
            "error": "No trend data found",
            "prediction_days": None,
            "direction": None,
            "data": [],
        }

    features = extract_features(trend_df, keyword)
    prediction = predict_lifespan(features)
    chart_data = [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "value": int(row[keyword]),
        }
        for _, row in trend_df.iterrows()
    ]

    return {
        "keyword": keyword,
        "prediction_days": prediction,
        "direction": get_direction(features["slope"]),
        "features": features,
        "data": chart_data,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="localhost", port=8000)
