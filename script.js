const storageKey = "drive-thru-timer-two-lane-v1";

const positionOrder = [
  "l1-pre2",
  "l1-pre1",
  "l1-order",
  "l2-pre2",
  "l2-pre1",
  "l2-order",
  "after-order-2",
  "after-order-1",
  "cash",
  "present"
];

const autoMoveOrder = [
  ["after-order-1", "cash"],
  ["after-order-2", "after-order-1"],
  ["l1-pre1", "l1-order"],
  ["l1-pre2", "l1-pre1"],
  ["l2-pre1", "l2-order"],
  ["l2-pre2", "l2-pre1"]
];

let state = {
  nextCarNumber: 1,
  cars: [],
  completed: []
};

const $ = (id) => document.getElementById(id);

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function formatTime(value) {
  const totalSeconds = Math.max(0, Math.round(value || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function showStatus(message) {
  $("statusBar").textContent = message;
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
      state = {
        nextCarNumber: parsed.nextCarNumber || 1,
        cars: parsed.cars,
        completed: parsed.completed
      };
    }
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function targetValues() {
  return {
    order1: Number($("targetOrder1").value) || 30,
    order2: Number($("targetOrder2").value) || 30,
    cash: Number($("targetCash").value) || 20,
    present: Number($("targetPresent").value) || 20,
    total: Number($("targetTotal").value) || 170
  };
}

function carAt(position) {
  return state.cars.find((car) => car.position === position);
}

function isFree(position) {
  return !carAt(position);
}

function elapsedStage(car) {
  return nowSeconds() - car.stageStartedAt;
}

function elapsedTotal(car) {
  if (!car.totalStartedAt) return 0;
  return nowSeconds() - car.totalStartedAt;
}

function addCar(lane) {
  const spawnPosition = lane === 1 ? "l1-pre2" : "l2-pre2";
  if (!isFree(spawnPosition)) {
    showStatus(`Lane ${lane} spawn is full. The new car must wait until the two-spaces-before-speaker position is clear.`);
    return;
  }

  const seconds = nowSeconds();
  state.cars.push({
    number: state.nextCarNumber++,
    lane,
    position: spawnPosition,
    enteredAt: seconds,
    stageStartedAt: seconds,
    totalStartedAt: null,
    timings: {}
  });

  showStatus(`Car added to Lane ${lane}. It spawned two spaces before the speaker box.`);
  saveState();
  render();
}

function completeOrder(lane) {
  const orderPosition = lane === 1 ? "l1-order" : "l2-order";
  const car = carAt(orderPosition);

  if (!car) {
    showStatus(`There is no car at Lane ${lane} speaker box.`);
    return;
  }

  if (!isFree("after-order-2")) {
    showStatus(`Car #${car.number} cannot leave Lane ${lane} order yet because the shared lane is full.`);
    return;
  }

  car.timings.order = (car.timings.order || 0) + elapsedStage(car);
  car.position = "after-order-2";
  car.stageStartedAt = nowSeconds();
  car.totalStartedAt = nowSeconds();

  showStatus(`Car #${car.number} left Lane ${lane} order. Total time has started.`);
  saveState();
  render();
}

function completeCash() {
  const car = carAt("cash");

  if (!car) {
    showStatus("There is no car at cash.");
    return;
  }

  if (!isFree("present")) {
    showStatus(`Car #${car.number} cannot leave cash because present is occupied.`);
    return;
  }

  car.timings.cash = (car.timings.cash || 0) + elapsedStage(car);
  car.position = "present";
  car.stageStartedAt = nowSeconds();

  showStatus(`Car #${car.number} moved from cash to present.`);
  saveState();
  render();
}

function completePresent() {
  const car = carAt("present");

  if (!car) {
    showStatus("There is no car at present.");
    return;
  }

  car.timings.present = (car.timings.present || 0) + elapsedStage(car);
  car.timings.total = elapsedTotal(car);
  car.finishedAt = nowSeconds();

  state.cars = state.cars.filter((existing) => existing.number !== car.number);
  state.completed.unshift(car);
  state.completed = state.completed.slice(0, 100);

  showStatus(`Car #${car.number} completed. Total time was ${formatTime(car.timings.total)} excluding order time.`);
  saveState();
  render();
}

function tickMovement() {
  let moved = false;
  const seconds = nowSeconds();

  for (const [from, to] of autoMoveOrder) {
    const car = carAt(from);

    if (!car || !isFree(to)) continue;
    if (seconds - car.stageStartedAt < 1) continue;

    car.position = to;
    car.stageStartedAt = seconds;

    if (to.endsWith("order")) {
      showStatus(`Car #${car.number} reached Lane ${car.lane} speaker box. Order timer started.`);
    }

    if (to === "cash") {
      showStatus(`Car #${car.number} reached cash.`);
    }

    moved = true;
  }

  if (moved) saveState();
}

function resetDay() {
  if (!confirm("Reset all active cars and completed history?")) return;

  state = {
    nextCarNumber: 1,
    cars: [],
    completed: []
  };

  showStatus("Day reset.");
  saveState();
  render();
}

function allCarsForStats() {
  return [...state.completed, ...state.cars];
}

function valuesForOrder(lane) {
  return allCarsForStats().flatMap((car) => {
    if (car.lane !== lane) return [];

    const orderPosition = lane === 1 ? "l1-order" : "l2-order";
    if (Number.isFinite(car.timings.order)) return [car.timings.order];
    if (car.position === orderPosition) return [elapsedStage(car)];

    return [];
  });
}

function valuesForStage(stage) {
  return allCarsForStats().flatMap((car) => {
    if (Number.isFinite(car.timings[stage])) return [car.timings[stage]];
    if (car.position === stage) return [elapsedStage(car)];
    return [];
  });
}

function valuesForTotal() {
  return allCarsForStats().flatMap((car) => {
    if (Number.isFinite(car.timings.total)) return [car.timings.total];
    if (car.totalStartedAt) return [elapsedTotal(car)];
    return [];
  });
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function performancePercent(avg, target) {
  if (!avg || !target) return 0;
  return Math.round((target / avg) * 100);
}

function setTimerColour(element, avg, target) {
  if (!element) return;
  const ratio = target ? avg / target : 0;

  if (!avg) {
    element.style.color = "var(--orange)";
  } else if (ratio <= 1) {
    element.style.color = "var(--green)";
  } else if (ratio <= 1.35) {
    element.style.color = "var(--orange)";
  } else {
    element.style.color = "var(--red)";
  }
}

function renderStats() {
  const targets = targetValues();

  const stats = {
    order1: average(valuesForOrder(1)),
    order2: average(valuesForOrder(2)),
    cash: average(valuesForStage("cash")),
    present: average(valuesForStage("present")),
    total: average(valuesForTotal())
  };

  const mapping = [
    ["order1", "order1Avg", "order1Pct"],
    ["order2", "order2Avg", "order2Pct"],
    ["cash", "cashAvg", "cashPct"],
    ["present", "presentAvg", "presentPct"],
    ["total", "totalAvg", "totalPct"]
  ];

  for (const [key, avgId, pctId] of mapping) {
    $(avgId).textContent = formatTime(stats[key]);
    $(pctId).textContent = `${performancePercent(stats[key], targets[key])}%`;
    setTimerColour($(avgId), stats[key], targets[key]);
  }
}

function carTimerLabel(car) {
  if (car.position === "l1-order" || car.position === "l2-order") {
    return `Order ${formatTime(elapsedStage(car))}`;
  }

  if (car.position === "cash") {
    return `Cash ${formatTime(elapsedStage(car))}`;
  }

  if (car.position === "present") {
    return `Present ${formatTime(elapsedStage(car))}`;
  }

  if (car.totalStartedAt) {
    return `Total ${formatTime(elapsedTotal(car))}`;
  }

  return "Pre-order";
}

function renderLanes() {
  for (const position of positionOrder) {
    const slot = $(`slot-${position}`);
    if (!slot) continue;

    slot.innerHTML = "";
    const car = carAt(position);
    if (!car) continue;

    const carElement = document.createElement("div");
    carElement.className = "car-card";
    carElement.innerHTML = `
      <strong>#${car.number}</strong>
      <small>Lane ${car.lane}</small>
      <span>${carTimerLabel(car)}</span>
    `;
    slot.appendChild(carElement);
  }

  const lane1OrderCar = carAt("l1-order");
  const lane2OrderCar = carAt("l2-order");
  $("lane1OrderLive").textContent = `Order ${lane1OrderCar ? formatTime(elapsedStage(lane1OrderCar)) : "0:00"}`;
  $("lane2OrderLive").textContent = `Order ${lane2OrderCar ? formatTime(elapsedStage(lane2OrderCar)) : "0:00"}`;
}

function renderSummary() {
  $("carsInLane").textContent = state.cars.length;
  $("lane1Active").textContent = state.cars.filter((car) => car.lane === 1).length;
  $("lane2Active").textContent = state.cars.filter((car) => car.lane === 2).length;

  const totals = valuesForTotal();
  const longest = totals.length ? Math.max(...totals) : 0;
  $("longestTotal").textContent = formatTime(longest);
}

function renderHistory() {
  const body = $("historyBody");

  if (!state.completed.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No completed cars yet.</td></tr>';
    return;
  }

  body.innerHTML = state.completed.slice(0, 15).map((car) => `
    <tr>
      <td>#${car.number}</td>
      <td>${car.lane}</td>
      <td>${formatTime(car.timings.order)}</td>
      <td>${formatTime(car.timings.cash)}</td>
      <td>${formatTime(car.timings.present)}</td>
      <td>${formatTime(car.timings.total)}</td>
    </tr>
  `).join("");
}

function renderClock() {
  const date = new Date();
  $("currentTime").textContent = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function render() {
  renderClock();
  renderStats();
  renderLanes();
  renderSummary();
  renderHistory();
}

function wireEvents() {
  $("addLane1Btn").addEventListener("click", () => addCar(1));
  $("addLane2Btn").addEventListener("click", () => addCar(2));
  $("completeOrder1Btn").addEventListener("click", () => completeOrder(1));
  $("completeOrder2Btn").addEventListener("click", () => completeOrder(2));
  $("completeCashBtn").addEventListener("click", completeCash);
  $("completePresentBtn").addEventListener("click", completePresent);
  $("resetBtn").addEventListener("click", resetDay);

  for (const inputId of ["targetOrder1", "targetOrder2", "targetCash", "targetPresent", "targetTotal"]) {
    $(inputId).addEventListener("input", render);
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (key === "1") addCar(1);
    if (key === "2") addCar(2);
    if (key === "q") completeOrder(1);
    if (key === "w") completeOrder(2);
    if (key === "c") completeCash();
    if (key === "p") completePresent();
  });
}

loadState();
wireEvents();
render();

setInterval(() => {
  tickMovement();
  render();
}, 1000);
