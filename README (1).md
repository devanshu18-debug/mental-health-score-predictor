# Student Mental Health Score Predictor

Predicts a student's mental health score (out of 10, higher is better) from their social media use, sleep, study time, physical activity and stress level.

The project covers the full workflow: data cleaning, feature engineering, a scikit-learn preprocessing and Random Forest pipeline, a FastAPI REST API with input validation, and a web interface that calls the API and shows the result on a score dial.

> This model is trained on a student survey dataset and gives an estimate for learning and demonstration. It is not a medical or diagnostic tool.

## Features

- Cleaning and outlier checks, duplicate removal, and clipping of impossible values
- Feature engineering: countries outside the 10 most common are grouped as `Other`
- One preprocessing and modelling pipeline saved as a single file, so training and serving use identical steps
- REST API with typed, range-checked input (Pydantic) and a typed response
- Frontend in plain HTML, CSS and JavaScript with validation, a loading state and clear error messages

## Model

| Step | Details |
|---|---|
| Target | `Mental_Health_Score` (regression) |
| Skewed numeric | `Study_Hours`: log transform, then standard scaling |
| Other numeric | Age, daily usage hours, daily unlocks, physical activity, sleep: standard scaling |
| Ordinal | `Stress_Level`: Low < Medium < High < Very High |
| Categorical | Platform, gender, academic level, purpose of use, grouped country: one-hot encoding (`handle_unknown="ignore"`) |
| Model | Random Forest regressor inside a scikit-learn `Pipeline` |

**Results (test set, score scale 0 to 10):**

| Model | Test R² | MAE | RMSE |
|---|---|---|---|
| Linear regression (baseline) | 0.74 | not recorded | not recorded |
| Random Forest (deployed) | 0.88 | 0.35 | 0.46 |

The Random Forest fits the training data more closely (train R² 0.98) than the test data (0.88), so it overfits somewhat. A tuned version (GridSearchCV, 72 parameter combinations) narrowed the gap (train 0.95, test 0.87) but did not beat the default on the test set, so the default model is the one used by the API.

## Project structure

```
Mental_Health_Model/
├── main.py                      # FastAPI app
├── random_forest_model.pkl      # trained pipeline (scikit-learn 1.6.1)
├── requirements.txt
├── mental_health_project_fixed (1).ipynb   # EDA, training, evaluation
├── Student Social Media And Mental Health Impact (1).csv
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

## Run locally

Use **Python 3.13**. The saved model needs `scikit-learn==1.6.1`, which has no prebuilt package for newer Python versions.

```bash
# 1. Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac / Linux

# 2. Install dependencies
python -m pip install -r requirements.txt

# 3. Start the API
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000
- Interactive docs: http://127.0.0.1:8000/docs

Then open `frontend/index.html` in your browser. If your API runs somewhere other than `http://127.0.0.1:8000`, change `API_URL` at the top of `frontend/script.js`.

## API

### `POST /predict`

Request:

```json
{
  "age": 20,
  "gender": "Female",
  "country": "India",
  "academic_level": "Undergraduate",
  "most_used_platform": "Instagram",
  "purpose_of_use": "Entertainment",
  "avg_daily_usage_hours": 4.5,
  "daily_unlocks": 80,
  "study_hours": 3,
  "physical_activity_hours": 1,
  "sleep_hours_per_night": 6.5,
  "stress_level": "Medium"
}
```

Response:

```json
{ "predicted_mental_health_score": 6.78 }
```

| Field | Allowed values |
|---|---|
| `age` | integer, 10 to 100 |
| `gender` | `Male`, `Female` |
| `academic_level` | `High School`, `Undergraduate`, `Graduate` |
| `most_used_platform` | Facebook, LinkedIn, Instagram, Snapchat, Twitter, YouTube, TikTok, LINE, KakaoTalk, VKontakte, WhatsApp, WeChat |
| `purpose_of_use` | Networking, Education, Entertainment, News |
| `avg_daily_usage_hours`, `study_hours`, `physical_activity_hours`, `sleep_hours_per_night` | number, 0 to 24 |
| `daily_unlocks` | integer, 0 or more |
| `stress_level` | Low, Medium, High, Very High |
| `country` | any text (unknown countries are grouped as `Other`) |

Invalid input returns a `422` response that names the offending field.

## Deployment

Start command for most hosts (for example Render):

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Set the Python version to 3.13, and upload `random_forest_model.pkl` next to `main.py`. Host the `frontend` folder on GitHub Pages or Netlify, and set `API_URL` in `script.js` to your deployed API address.

## Limitations

- The data comes from a survey dataset, and the relationships in it look cleaner than real-world data usually is, so the metrics show the pipeline working, not real-world accuracy.
- The score reflects patterns in this dataset only. It says nothing about any individual's actual health.
- The model was trained on students aged roughly 18 to 24. Predictions for ages outside that range are not reliable, even though the API accepts ages 10 to 100.

## Tech stack

Python, pandas, NumPy, scikit-learn, joblib, FastAPI, Pydantic, Uvicorn, HTML, CSS, JavaScript.

## Dataset

Student Social Media and Mental Health Impact dataset, included in this repository as a CSV file (5,000 rows).
