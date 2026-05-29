const stages = [
  { key: "order1", label: "Order-1", targetInput: "targetOrder1", liveId: "liveOrder1", avgId: "order1Avg", pctId: "order1Pct", miniId: null, pos: { left: 76, top: 57 }, vertical: false },
  { key: "order2", label: "Order-2", targetInput: "targetOrder2", liveId: "liveOrder2", avgId: "order2Avg", pctId: "order2Pct", miniId: null, pos: { left: 88, top: 38 }, vertical: true },
  { key: "cash", label: "Cash", targetInput: "targetCash", liveId: "liveCash", avgId: "cashAvg", pctId: "cashPct", miniId: "cashMini", pos: { left: 63, top: 8 }, vertical: false },
  { key: "present", label: "Present", targetInput: "targetPresent", liveId: "livePresent", avgId: "presentAvg", pctId: "presentPct", miniId: "presentMini", pos: { left: 15, top: 8 }, vertical: false }
];

const storageKey = "drive-thru-timer-state-v1";

let state = {
  cars: [],
  completed: [],
  nextCarNumber: 1,
  pullForwardSeconds: 0
};

const $ = (id) => document.getElementById(id);

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function formatTime(totalSeconds) {
  totalSeconds = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readTargets() {
  return {
    order1: Number($("targetOrder1").value) || 30,
    order2: Number($("targetOrder2").value) || 30,
    cash: Number($("targetCash").value) || 20,
    present: Number($("targetPresent").value) || 20,
    total: Number($("targetTotal").value) || 170
  };
}

function currentStageSeconds(car) {
  return nowSeconds() - car.stageStartedAt;
}

function totalCarSeconds(car) {
  return nowSeconds() - car.enteredAt;
}

function getStageCar(stageKey) {
  return state.cars.find(car => car.stage === stageKey);
}

function stageCompletePercent(avg, target) {
  if (!avg || !target) return 0;
  return Math.round((target / avg) * 100);
}

function colourFor(avg, target, element) {
  if (!element) return;
  element.classList.remove("good", "warning", "bad");
  const ratio = avg / target;
  if (ratio <= 1) {
    element.style.color = "var(--green)";
  } else if (ratio <= 1.35) {
    element.style.color = "var(--orange)";
  } else {
    element.style.color = "var(--red)";
  }
}

function addCar() {
  const seconds = nowSeconds();
  const occupiedStages = new Set(state.cars.map(car => car.stage));
  const firstFreeStage = stages.find(stage => !occupiedStages.has(stage.key));

  state.cars.push({
    number: state.nextCarNumber++,
    enteredAt: seconds,
    stage: firstFreeStage ? firstFreeStage.key : "queue",
    stageStartedAt: seconds,
    timings: {}
  });

  saveState();
  render();
}

function moveNextCar() {
  // Complete the car at present first.
  const presentCar = getStageCar("present");
  if (presentCar) {
    finishCar(presentCar);
  }

  // Move each station forward from cash -> present, order2 -> cash, order1 -> order2.
  moveStage("cash", "present");
  moveStage("order2", "cash");
  moveStage("order1", "order2");

  // Move one queued car into order1.
  const queued = state.cars.find(car => car.stage === "queue");
  if (queued && !getStageCar("order1")) {
    queued.stage = "order1";
    queued.stageStartedAt = nowSeconds();
  }

  saveState();
  render();
}

function moveStage(from, to) {
  if (getStageCar(to)) return;

  const car = getStageCar(from);
  if (!car) return;

  car.timings[from] = (car.timings[from] || 0) + currentStageSeconds(car);
  car.stage = to;
  car.stageStartedAt = nowSeconds();
}

function finishCar(car) {
  car.timings[car.stage] = (car.timings[car.stage] || 0) + currentStageSeconds(car);
  car.total = nowSeconds() - car.enteredAt;
  car.finishedAt = nowSeconds();
  state.completed.unshift(car);
  state.cars = state.cars.filter(existing => existing.number !== car.number);
  state.completed = state.completed.slice(0, 50);
}

function pullForward() {
  const presentCar = getStageCar("present");
  if (!presentCar) {
    state.pullForwardSeconds = 0;
    render();
    return;
  }

  state.pullForwardSeconds = currentStageSeconds(presentCar);
  finishCar(presentCar);
  saveState();
  render();
}

function resetDay() {
  if (!confirm("Reset all active cars and completed car history?")) return;
  state = {
    cars: [],
    completed: [],
    nextCarNumber: 1,
    pullForwardSeconds: 0
  };
  saveState();
  render();
}

function calculateAverages() {
  const targets = readTargets();
  const result = {};
  for (const stage of stages) {
    const completedDurations = state.completed
      .map(car => car.timings[stage.key])
      .filter(value => Number.isFinite(value));

    const activeCar = getStageCar(stage.key);
    if (activeCar) completedDurations.push(currentStageSeconds(activeCar));

    const avg = completedDurations.length
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : 0;

    result[stage.key] = {
      avg,
      pct: stageCompletePercent(avg, targets[stage.key])
    };
  }

  const totalDurations = state.completed.map(car => car.total).filter(value => Number.isFinite(value));
  for (const active of state.cars) {
    totalDurations.push(totalCarSeconds(active));
  }

  const totalAvg = totalDurations.length
    ? totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length
    : 0;

  result.total = {
    avg: totalAvg,
    pct: stageCompletePercent(totalAvg, targets.total)
  };

  return result;
}

function render() {
  renderClock();
  renderLiveStageTimers();
  renderAverages();
  renderCars();
  renderSummary();
  renderHistory();
}

function renderClock() {
  const date = new Date();
  $("currentTime").textContent = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderLiveStageTimers() {
  for (const stage of stages) {
    const car = getStageCar(stage.key);
    const seconds = car ? currentStageSeconds(car) : 0;
    $(stage.liveId).textContent = formatTime(seconds);
    if (stage.miniId) $(stage.miniId).textContent = formatTime(seconds);
  }

  $("pullForwardMini").textContent = formatTime(state.pullForwardSeconds);
}

function renderAverages() {
  const targets = readTargets();
  const averages = calculateAverages();

  for (const stage of stages) {
    $(stage.avgId).textContent = formatTime(averages[stage.key].avg);
    $(stage.pctId).textContent = `${averages[stage.key].pct}%`;
    colourFor(averages[stage.key].avg, targets[stage.key], $(stage.avgId));
  }

  $("totalAvg").textContent = formatTime(averages.total.avg);
  $("totalPct").textContent = `${averages.total.pct}%`;
  colourFor(averages.total.avg, targets.total, $("totalAvg"));
}

function renderCars() {
  const layer = $("carsLayer");
  layer.innerHTML = "";

  const queueCars = state.cars.filter(car => car.stage === "queue");

  for (const stage of stages) {
    const car = getStageCar(stage.key);
    if (!car) continue;
    layer.appendChild(makeCarElement(car, stage.pos.left, stage.pos.top, stage.vertical));
  }

  queueCars.forEach((car, index) => {
    layer.appendChild(makeCarElement(car, 8 + (index * 7), 8, false));
  });
}

function makeCarElement(car, left, top, vertical) {
  const el = document.createElement("div");
  el.className = `car${vertical ? " vertical" : ""}`;
  el.title = `Car ${car.number}`;
  el.style.left = `${left}%`;
  el.style.top = `${top}%`;
  return el;
}

function renderSummary() {
  $("carsInLane").textContent = state.cars.length;

  const oldestCar = state.cars.reduce((oldest, car) => {
    if (!oldest || car.enteredAt < oldest.enteredAt) return car;
    return oldest;
  }, null);

  $("currentLaneTime").textContent = oldestCar ? formatTime(totalCarSeconds(oldestCar)) : "0:00";
}

function renderHistory() {
  const body = $("historyBody");
  if (!state.completed.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No completed cars yet.</td></tr>';
    return;
  }

  body.innerHTML = state.completed.slice(0, 12).map(car => `
    <tr>
      <td>#${car.number}</td>
      <td>${formatTime(car.timings.order1)}</td>
      <td>${formatTime(car.timings.order2)}</td>
      <td>${formatTime(car.timings.cash)}</td>
      <td>${formatTime(car.timings.present)}</td>
      <td>${formatTime(car.total)}</td>
    </tr>
  `).join("");
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (parsed && Array.isArray(parsed.cars) && Array.isArray(parsed.completed)) {
      state = { ...state, ...parsed };
    }
  } catch {
    // Ignore damaged local storage data.
  }
}

function wireEvents() {
  $("addCarBtn").addEventListener("click", addCar);
  $("moveCarBtn").addEventListener("click", moveNextCar);
  $("pullForwardBtn").addEventListener("click", pullForward);
  $("resetBtn").addEventListener("click", resetDay);

  for (const inputId of ["targetOrder1", "targetOrder2", "targetCash", "targetPresent", "targetTotal"]) {
    $(inputId).addEventListener("input", render);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "a") addCar();
    if (event.key.toLowerCase() === "m") moveNextCar();
    if (event.key.toLowerCase() === "p") pullForward();
  });
}

loadState();
wireEvents();
render();
setInterval(render, 1000);
