// Change this to your deployed API URL when you publish the backend.
const API_URL = "https://mental-health-score-predictor-yze9.onrender.com";

const form = document.getElementById("predict-form");
const banner = document.getElementById("banner");
const submitBtn = document.getElementById("submit");
const btnText = submitBtn.querySelector(".btn-text");
const resetBtn = document.getElementById("reset");
const result = document.getElementById("result");
const dialFill = document.getElementById("dial-fill");
const needle = document.getElementById("needle");
const scoreValue = document.getElementById("score-value");
const bandLabel = document.getElementById("band-label");
const bandText = document.getElementById("band-text");
const apiStatus = document.getElementById("api-status");
const apiStatusText = document.getElementById("api-status-text");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Rules mirror the Pydantic StudentData model in main.py */
const NUMBER_RULES = {
  age: { label: "Age", min: 10, max: 100, integer: true },
  avg_daily_usage_hours: { label: "Daily social media use", min: 0, max: 24 },
  daily_unlocks: { label: "Phone unlocks", min: 0, integer: true },
  study_hours: { label: "Study time", min: 0, max: 24 },
  physical_activity_hours: { label: "Physical activity", min: 0, max: 24 },
  sleep_hours_per_night: { label: "Sleep", min: 0, max: 24 },
};

const REQUIRED_TEXT = [
  "gender",
  "country",
  "academic_level",
  "most_used_platform",
  "purpose_of_use",
  "stress_level",
];

const BANDS = [
  { key: "low", max: 5, label: "Lower range",
    text: "In the survey data, profiles like this tend to score lower. Screen time, sleep and stress level move the score most." },
  { key: "moderate", max: 6.5, label: "Moderate",
    text: "A middle-of-the-road result. Small changes to sleep or daily phone use can shift it." },
  { key: "good", max: 8, label: "Good",
    text: "Habits in this profile are linked to above-average scores in the survey data." },
  { key: "high", max: Infinity, label: "High",
    text: "This profile sits in the top range of the survey data: balanced screen time, good sleep and manageable stress." },
];

/* ---------- Small helpers ---------- */

function bandFor(score) {
  return BANDS.find((b) => score < b.max);
}

function fieldEl(name) {
  return form.querySelector(`.field[data-field="${name}"]`);
}

function setFieldError(name, message) {
  const field = fieldEl(name);
  if (!field) return false;
  field.classList.add("invalid");
  const slot = field.querySelector(`[data-error-for="${name}"]`);
  if (slot) slot.textContent = message;
  return true;
}

function clearErrors() {
  form.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  form.querySelectorAll("[data-error-for]").forEach((s) => (s.textContent = ""));
  hideBanner();
}

function showBanner(title, detail) {
  banner.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  banner.appendChild(strong);
  if (detail) {
    const p = document.createElement("span");
    p.textContent = detail;
    banner.appendChild(p);
  }
  banner.hidden = false;
}

function hideBanner() {
  banner.hidden = true;
  banner.innerHTML = "";
}

function focusFirstInvalid() {
  const first = form.querySelector(".field.invalid");
  if (!first) return;
  const target = first.querySelector("input, select");
  if (target) target.focus();
}

/* ---------- Slider read-outs ---------- */

function syncOutput(input) {
  const out = form.querySelector(`output[for="${input.id}"]`);
  if (out) out.textContent = `${input.value} ${out.dataset.unit || ""}`.trim();
}

form.querySelectorAll('input[type="range"]').forEach((input) => {
  syncOutput(input);
  input.addEventListener("input", () => syncOutput(input));
});

/* ---------- Read and validate ---------- */

function readPayload() {
  const fd = new FormData(form);
  const num = (key) => {
    const raw = fd.get(key);
    return raw === null || String(raw).trim() === "" ? NaN : Number(raw);
  };
  return {
    age: num("age"),
    gender: fd.get("gender"),
    country: String(fd.get("country") || "").trim(),
    academic_level: fd.get("academic_level"),
    most_used_platform: fd.get("most_used_platform"),
    purpose_of_use: fd.get("purpose_of_use"),
    avg_daily_usage_hours: num("avg_daily_usage_hours"),
    daily_unlocks: num("daily_unlocks"),
    study_hours: num("study_hours"),
    physical_activity_hours: num("physical_activity_hours"),
    sleep_hours_per_night: num("sleep_hours_per_night"),
    stress_level: fd.get("stress_level"),
  };
}

function validate(payload) {
  let valid = true;

  for (const [name, rule] of Object.entries(NUMBER_RULES)) {
    const value = payload[name];
    let message = "";
    if (Number.isNaN(value)) message = `Enter a number for ${rule.label.toLowerCase()}.`;
    else if (rule.integer && !Number.isInteger(value)) message = "Use a whole number.";
    else if (rule.min !== undefined && value < rule.min) message = `Must be at least ${rule.min}.`;
    else if (rule.max !== undefined && value > rule.max) message = `Must be at most ${rule.max}.`;
    if (message) {
      setFieldError(name, message);
      valid = false;
    }
  }

  for (const name of REQUIRED_TEXT) {
    if (!payload[name]) {
      setFieldError(name, "This field is required.");
      valid = false;
    }
  }

  return valid;
}

/* ---------- Result panel ---------- */

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  btnText.textContent = isLoading ? "Predicting" : "Predict score";
  result.dataset.state = isLoading ? "loading" : result.dataset.state;
  if (isLoading) {
    result.dataset.state = "loading";
    bandLabel.textContent = "Working it out";
    bandText.textContent = "Sending the profile to the model.";
  }
}

function animateNumber(target) {
  if (reduceMotion) {
    scoreValue.textContent = target.toFixed(1);
    return;
  }
  const duration = 900;
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    scoreValue.textContent = (target * eased).toFixed(1);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function showResult(rawScore) {
  const score = Math.max(0, Math.min(10, Number(rawScore)));
  const band = bandFor(score);

  result.dataset.state = "done";
  result.dataset.band = band.key;
  dialFill.style.strokeDasharray = `${score * 10} 100`;
  needle.style.transform = `rotate(${-90 + score * 18}deg)`;
  animateNumber(score);
  bandLabel.textContent = band.label;
  bandText.textContent = band.text;

  if (window.matchMedia("(max-width: 860px)").matches) {
    result.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
}

function resetResult() {
  result.dataset.state = "idle";
  result.dataset.band = "none";
  dialFill.style.strokeDasharray = "0 100";
  needle.style.transform = "rotate(-90deg)";
  scoreValue.textContent = "--";
  bandLabel.textContent = "Waiting for input";
  bandText.textContent = "Fill in the form and press Predict score.";
}

/* ---------- API call ---------- */

async function requestPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function handleValidationResponse(detail) {
  // FastAPI 422 body: { detail: [{ loc: ["body", "age"], msg: "..." }, ...] }
  let unmatched = 0;
  if (Array.isArray(detail)) {
    detail.forEach((item) => {
      const name = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null;
      if (!setFieldError(name, item.msg || "Invalid value.")) unmatched += 1;
    });
  } else {
    unmatched = 1;
  }
  showBanner(
    "The server rejected some values",
    unmatched ? "Check the entries and try again." : "Fix the highlighted fields and try again."
  );
  focusFirstInvalid();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();

  const payload = readPayload();
  if (!validate(payload)) {
    showBanner("Some fields need attention", "Fix the highlighted fields and try again.");
    focusFirstInvalid();
    return;
  }

  setLoading(true);

  try {
    const res = await requestPrediction(payload);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* response had no JSON body */
    }

    if (res.ok && data && typeof data.predicted_mental_health_score === "number") {
      showResult(data.predicted_mental_health_score);
      return;
    }

    resetResult();
    if (res.status === 422) {
      handleValidationResponse(data && data.detail);
    } else if (res.status >= 500) {
      showBanner(
        "The model hit an error",
        "Check the uvicorn terminal for the traceback. A common cause is a column or category the model was not trained on."
      );
    } else {
      const detail = data && typeof data.detail === "string" ? data.detail : `Status ${res.status}.`;
      showBanner("The request failed", detail);
    }
  } catch (err) {
    resetResult();
    if (err.name === "AbortError") {
      showBanner("The API took too long to answer", "Try again in a moment.");
    } else {
      showBanner(
        "Cannot reach the API",
        `Is uvicorn running at ${API_URL}? Start it with: uvicorn main:app --reload`
      );
      setApiStatus("offline");
    }
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = "Predict score";
  }
});

/* ---------- Reset ---------- */

resetBtn.addEventListener("click", () => {
  form.reset();
  form.querySelectorAll('input[type="range"]').forEach(syncOutput);
  clearErrors();
  resetResult();
});

/* ---------- API status chip ---------- */

function setApiStatus(state) {
  apiStatus.dataset.state = state;
  const host = new URL(API_URL).host;
  apiStatusText.textContent =
    state === "online" ? `Connected to API at ${host}`
    : state === "offline" ? `API not reachable at ${host}`
    : "Checking API";
}

async function checkApi() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${API_URL}/`, { signal: controller.signal });
    setApiStatus(res.ok ? "online" : "offline");
  } catch (_) {
    setApiStatus("offline");
  } finally {
    clearTimeout(timer);
  }
}

checkApi();
