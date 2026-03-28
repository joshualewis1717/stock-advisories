from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pytrends.request import TrendReq

try:
    import torch
except Exception:
    torch = None

app = FastAPI(title="Trend Grave API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pytrends: TrendReq | None = None
MODEL_DIR = Path(__file__).parent / "models"
MODEL_PATH = MODEL_DIR / "stock_ranker.pt"
METADATA_PATH = MODEL_DIR / "stock_ranker_metadata.json"
TRAINING_LOOKBACK = 60
PREDICTION_HORIZON = 20
MIN_TRAINING_SAMPLES = 40


class TrainModelRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=2, description="Stock symbols to train on")
    epochs: int = Field(default=30, ge=5, le=200)


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


@app.get("/model-status")
def model_status() -> dict[str, Any]:
    metadata = load_model_metadata()
    return {
        "pytorch_available": torch is not None,
        "model_ready": MODEL_PATH.exists() and metadata is not None,
        "model_path": str(MODEL_PATH),
        "metadata": metadata,
    }


@app.post("/train-model")
def train_model(request: TrainModelRequest) -> dict[str, Any]:
    if torch is None:
        return {
            "error": "PyTorch is not installed in the backend environment.",
            "pytorch_available": False,
        }

    symbols = sanitize_symbols(request.symbols)
    if len(symbols) < 2:
        return {"error": "Provide at least two valid stock symbols."}

    training_set = build_training_dataset(symbols)
    if training_set is None:
        return {"error": "Unable to build a training dataset for the supplied symbols."}

    features, labels, sample_count_by_symbol = training_set
    if len(features) < MIN_TRAINING_SAMPLES:
        return {
            "error": (
                "Not enough training samples were generated. "
                "Provide more liquid stocks or a larger stock list."
            )
        }

    split_index = max(int(len(features) * 0.8), 1)
    train_features = features[:split_index]
    train_labels = labels[:split_index]
    val_features = features[split_index:]
    val_labels = labels[split_index:]

    feature_mean = train_features.mean(axis=0)
    feature_std = train_features.std(axis=0)
    feature_std[feature_std == 0] = 1.0

    normalized_train = ((train_features - feature_mean) / feature_std).astype(np.float32)
    normalized_val = ((val_features - feature_mean) / feature_std).astype(np.float32) if len(val_features) else np.empty((0, train_features.shape[1]), dtype=np.float32)

    model, training_metrics = train_ranker_model(
        normalized_train,
        train_labels.astype(np.float32),
        normalized_val,
        val_labels.astype(np.float32),
        epochs=request.epochs,
    )
    training_loss = training_metrics["training_loss"]
    validation_loss = training_metrics["validation_loss"]
    validation_mae = training_metrics["validation_mae"]

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "input_dim": train_features.shape[1],
            "state_dict": model.state_dict(),
        },
        MODEL_PATH,
    )

    metadata = {
        "feature_names": feature_names(),
        "feature_mean": feature_mean.tolist(),
        "feature_std": feature_std.tolist(),
        "symbols": symbols,
        "sample_count": int(len(features)),
        "sample_count_by_symbol": sample_count_by_symbol,
        "prediction_horizon_days": PREDICTION_HORIZON,
        "lookback_days": TRAINING_LOOKBACK,
        "epochs": request.epochs,
        "training_loss": training_loss,
        "validation_loss": validation_loss,
        "validation_mae": validation_mae,
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return {
        "status": "trained",
        "pytorch_available": True,
        "sample_count": int(len(features)),
        "symbols": symbols,
        "metrics": {
            "training_loss": round(training_loss, 4),
            "validation_loss": round(validation_loss, 4),
            "validation_mae": round(validation_mae, 4),
        },
        "metadata": metadata,
    }


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
    model_insight = build_model_insight(cleaned_symbol, stock_snapshot, predictions)

    return {
        "symbol": cleaned_symbol,
        "company_name": company_name,
        "price": stock_snapshot["price"],
        "change_percent": stock_snapshot["change_percent"],
        "stock_data": stock_snapshot["stock_data"],
        "keywords": predictions,
        "model_insight": model_insight,
    }


def fetch_history(symbol: str, period: str) -> pd.DataFrame | None:
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period=period, interval="1d", auto_adjust=False)
        if history.empty:
            return None
        history = history.reset_index()
        history["Date"] = pd.to_datetime(history["Date"])
        return history
    except Exception as exc:
        print("Error fetching history:", exc)
        return None


def get_stock_snapshot(symbol: str) -> dict[str, Any] | None:
    history = fetch_history(symbol, period="3mo")
    if history is None:
        return None

    close_series = history["Close"].dropna()
    if close_series.empty:
        return None

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info if isinstance(ticker.info, dict) else {}
    except Exception:
        info = {}

    company_name = info.get("shortName") or info.get("longName") or symbol
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


def sanitize_symbols(symbols: list[str]) -> list[str]:
    cleaned_symbols: list[str] = []
    seen: set[str] = set()
    for symbol in symbols:
        cleaned = re.sub(r"[^A-Za-z.\-]", "", symbol.strip().upper())
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            cleaned_symbols.append(cleaned)
    return cleaned_symbols


def feature_names() -> list[str]:
    return [
        "return_5d",
        "return_20d",
        "return_60d",
        "volatility_20d",
        "volatility_60d",
        "sma_gap_10_30",
        "sma_gap_20_60",
        "volume_ratio_10_30",
        "drawdown_60d",
        "rsi_14",
    ]


def build_training_dataset(
    symbols: list[str],
) -> tuple[np.ndarray, np.ndarray, dict[str, int]] | None:
    all_features: list[list[float]] = []
    all_labels: list[float] = []
    sample_count_by_symbol: dict[str, int] = {}

    for symbol in symbols:
        history = fetch_history(symbol, period="18mo")
        if history is None:
            continue

        samples = build_samples_from_history(history)
        if not samples:
            continue

        sample_count_by_symbol[symbol] = len(samples)
        for feature_vector, label in samples:
            all_features.append(feature_vector)
            all_labels.append(label)

    if not all_features:
        return None

    features = np.array(all_features, dtype=np.float32)
    labels = np.array(all_labels, dtype=np.float32)
    return features, labels, sample_count_by_symbol


def build_samples_from_history(history: pd.DataFrame) -> list[tuple[list[float], float]]:
    clean_history = history.dropna(subset=["Close", "Volume"]).reset_index(drop=True)
    if len(clean_history) < TRAINING_LOOKBACK + PREDICTION_HORIZON + 1:
        return []

    samples: list[tuple[list[float], float]] = []
    final_index = len(clean_history) - PREDICTION_HORIZON

    for end_index in range(TRAINING_LOOKBACK, final_index):
        window = clean_history.iloc[end_index - TRAINING_LOOKBACK:end_index]
        current_close = float(clean_history.iloc[end_index]["Close"])
        future_close = float(clean_history.iloc[end_index + PREDICTION_HORIZON]["Close"])
        if current_close == 0:
            continue

        feature_vector = compute_feature_vector(window)
        target_return = ((future_close - current_close) / current_close) * 100
        samples.append((feature_vector, float(target_return)))

    return samples


def compute_feature_vector(history_window: pd.DataFrame) -> list[float]:
    closes = history_window["Close"].astype(float).to_numpy()
    volumes = history_window["Volume"].astype(float).to_numpy()
    if len(closes) < TRAINING_LOOKBACK:
        raise ValueError("Not enough history to compute features.")

    returns = np.diff(closes) / np.maximum(closes[:-1], 1e-6)

    def pct_change(period: int) -> float:
        base = closes[-period - 1]
        current = closes[-1]
        return 0.0 if base == 0 else ((current - base) / base) * 100

    sma_10 = float(np.mean(closes[-10:]))
    sma_20 = float(np.mean(closes[-20:]))
    sma_30 = float(np.mean(closes[-30:]))
    sma_60 = float(np.mean(closes[-60:]))
    volume_10 = float(np.mean(volumes[-10:]))
    volume_30 = float(np.mean(volumes[-30:]))
    window_peak = float(np.max(closes))
    drawdown = 0.0 if window_peak == 0 else ((closes[-1] - window_peak) / window_peak) * 100

    gains = np.clip(np.diff(closes[-15:]), 0, None)
    losses = np.abs(np.clip(np.diff(closes[-15:]), None, 0))
    average_gain = float(np.mean(gains)) if len(gains) else 0.0
    average_loss = float(np.mean(losses)) if len(losses) else 0.0
    relative_strength = average_gain / max(average_loss, 1e-6)
    rsi = 100 - (100 / (1 + relative_strength))

    return [
        pct_change(5),
        pct_change(20),
        pct_change(59),
        float(np.std(returns[-20:]) * 100),
        float(np.std(returns) * 100),
        0.0 if sma_30 == 0 else ((sma_10 - sma_30) / sma_30) * 100,
        0.0 if sma_60 == 0 else ((sma_20 - sma_60) / sma_60) * 100,
        0.0 if volume_30 == 0 else ((volume_10 - volume_30) / volume_30) * 100,
        drawdown,
        float(rsi),
    ]


class StockRanker(torch.nn.Module if torch is not None else object):
    def __init__(self, input_dim: int) -> None:
        if torch is None:
            raise RuntimeError("PyTorch is not available.")

        super().__init__()
        self.layers = torch.nn.Sequential(
            torch.nn.Linear(input_dim, 48),
            torch.nn.ReLU(),
            torch.nn.Linear(48, 24),
            torch.nn.ReLU(),
            torch.nn.Linear(24, 12),
            torch.nn.ReLU(),
            torch.nn.Linear(12, 1),
        )

    def forward(self, inputs: Any) -> Any:
        return self.layers(inputs)


def build_ranker_model(input_dim: int) -> StockRanker:
    return StockRanker(input_dim)


def train_ranker_model(
    train_features: np.ndarray,
    train_labels: np.ndarray,
    val_features: np.ndarray,
    val_labels: np.ndarray,
    epochs: int,
) -> tuple[StockRanker, dict[str, float]]:
    if torch is None:
        raise RuntimeError("PyTorch is not available.")

    torch.manual_seed(42)
    model = build_ranker_model(train_features.shape[1])
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    loss_fn = torch.nn.MSELoss()

    train_x = torch.tensor(train_features, dtype=torch.float32)
    train_y = torch.tensor(train_labels.reshape(-1, 1), dtype=torch.float32)
    val_x = torch.tensor(val_features, dtype=torch.float32) if len(val_features) else train_x
    val_y = torch.tensor(val_labels.reshape(-1, 1), dtype=torch.float32) if len(val_labels) else train_y

    batch_size = min(32, len(train_x))
    best_state = model.state_dict()
    best_val_loss = float("inf")
    patience = 6
    stale_epochs = 0
    training_loss = 0.0
    validation_loss = 0.0
    validation_mae = 0.0

    for _ in range(epochs):
        model.train()
        permutation = torch.randperm(len(train_x))
        batch_losses: list[float] = []

        for batch_start in range(0, len(train_x), batch_size):
            batch_indices = permutation[batch_start:batch_start + batch_size]
            batch_x = train_x[batch_indices]
            batch_y = train_y[batch_indices]

            optimizer.zero_grad()
            predictions = model(batch_x)
            loss = loss_fn(predictions, batch_y)
            loss.backward()
            optimizer.step()
            batch_losses.append(float(loss.item()))

        training_loss = float(np.mean(batch_losses)) if batch_losses else 0.0

        model.eval()
        with torch.no_grad():
            val_predictions = model(val_x)
            validation_loss = float(loss_fn(val_predictions, val_y).item())
            validation_mae = float(torch.mean(torch.abs(val_predictions - val_y)).item())

        if validation_loss < best_val_loss:
            best_val_loss = validation_loss
            best_state = {key: value.detach().clone() for key, value in model.state_dict().items()}
            stale_epochs = 0
        else:
            stale_epochs += 1
            if stale_epochs >= patience:
                break

    model.load_state_dict(best_state)
    return model, {
        "training_loss": training_loss,
        "validation_loss": best_val_loss if best_val_loss != float("inf") else validation_loss,
        "validation_mae": validation_mae,
    }


def load_pytorch_model() -> StockRanker | None:
    if torch is None or not MODEL_PATH.exists():
        return None

    checkpoint = torch.load(MODEL_PATH, map_location="cpu")
    input_dim = int(checkpoint["input_dim"])
    model = build_ranker_model(input_dim)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model


def load_model_metadata() -> dict[str, Any] | None:
    if not METADATA_PATH.exists():
        return None

    try:
        return json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        print("Error loading model metadata:", exc)
        return None


def build_model_insight(
    symbol: str,
    stock_snapshot: dict[str, Any],
    keyword_predictions: list[dict[str, Any]],
) -> dict[str, Any]:
    metadata = load_model_metadata()
    if torch is None:
        return {
            "trained": False,
            "error": "PyTorch is not installed in the backend environment.",
        }

    if metadata is None or not MODEL_PATH.exists():
        return {"trained": False, "error": "No trained PyTorch model found. Train the model first."}

    history = fetch_history(symbol, period="12mo")
    if history is None:
        return {
            "trained": False,
            "error": f"Unable to fetch enough history to score {symbol}.",
        }

    clean_history = history.dropna(subset=["Close", "Volume"]).reset_index(drop=True)
    if len(clean_history) < TRAINING_LOOKBACK:
        return {
            "trained": False,
            "error": f"Not enough price history available to score {symbol}.",
        }

    feature_vector = compute_feature_vector(clean_history.tail(TRAINING_LOOKBACK))
    model = load_pytorch_model()
    if model is None:
        return {"trained": False, "error": "Unable to load the saved PyTorch model."}

    feature_mean = np.array(metadata["feature_mean"], dtype=np.float32)
    feature_std = np.array(metadata["feature_std"], dtype=np.float32)
    normalized_features = (np.array(feature_vector, dtype=np.float32) - feature_mean) / feature_std
    model.eval()
    with torch.no_grad():
        predicted_return = float(
            model(torch.tensor(normalized_features.reshape(1, -1), dtype=torch.float32)).item()
        )

    keyword_score = summarize_keyword_signal(keyword_predictions)
    price_momentum = float(stock_snapshot["change_percent"])
    model_score = clip_score(50 + predicted_return * 2.2)
    momentum_adjustment = float(np.clip(price_momentum * 0.45, -12, 12))
    holistic_score = clip_score(model_score + keyword_score["adjustment"] + momentum_adjustment)

    return {
        "trained": True,
        "prediction_horizon_days": metadata.get("prediction_horizon_days", PREDICTION_HORIZON),
        "predicted_return_percent": round(predicted_return, 2),
        "model_score": round(model_score, 2),
        "holistic_score": round(holistic_score, 2),
        "rank": rank_from_score(holistic_score),
        "confidence": confidence_from_metadata(metadata),
        "keyword_signal": keyword_score,
        "momentum_adjustment": round(momentum_adjustment, 2),
        "feature_values": {
            name: round(value, 4) for name, value in zip(feature_names(), feature_vector, strict=False)
        },
        "training_symbols": metadata.get("symbols", []),
    }


def summarize_keyword_signal(keyword_predictions: list[dict[str, Any]]) -> dict[str, Any]:
    slopes = [
        float(item["features"]["slope"])
        for item in keyword_predictions
        if item.get("features") and item["features"].get("slope") is not None
    ]
    direction_values = [item.get("direction") for item in keyword_predictions]
    up_count = sum(1 for direction in direction_values if direction == "up")
    down_count = sum(1 for direction in direction_values if direction == "down")
    average_slope = float(np.mean(slopes)) if slopes else 0.0
    slope_adjustment = float(np.clip(np.tanh(average_slope * 2.5) * 8, -8, 8))
    direction_adjustment = float(np.clip((up_count - down_count) * 1.5, -6, 6))
    adjustment = slope_adjustment + direction_adjustment

    return {
        "average_slope": round(average_slope, 4),
        "up_count": up_count,
        "down_count": down_count,
        "adjustment": round(adjustment, 2),
    }


def clip_score(value: float) -> float:
    return float(np.clip(value, 0, 100))


def rank_from_score(score: float) -> str:
    if score >= 80:
        return "Strong Buy"
    if score >= 65:
        return "Buy"
    if score >= 45:
        return "Hold"
    if score >= 30:
        return "Caution"
    return "Avoid"


def confidence_from_metadata(metadata: dict[str, Any]) -> str:
    sample_count = int(metadata.get("sample_count", 0))
    validation_mae = float(metadata.get("validation_mae", 0))

    if sample_count >= 250 and validation_mae <= 6:
        return "High"
    if sample_count >= 120 and validation_mae <= 10:
        return "Medium"
    return "Low"


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
