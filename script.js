const storageKey = "drive-thru-timer-next-version-v1";
const { DriveThruSimulation, POSITIONS, DEFAULT_TARGETS } = window.DriveThruTimer;

const POSITION_LABELS = {
  l1_pre2: "2 spaces before Order 1",
  l1_pre1: "1 space before Order 1",
  l1_order: "Order 1",
  l1_gap1: "1 gap to Cash",
  l2_pre2: "2 spaces before Order 2",
  l2_pre1: "1 space before Order 2",
  l2_order: "Order 2",
  l2_gap2: "2 gaps to Cash",
  l2_gap1: "1 gap to Cash",
  cash: "Cash",
  cash_gap: "1 gap to Present",
  present: "Present"
};

const SOUND_SOURCES = {
  lane1Entry: "assets/A%20Bass.wav",
  lane2Entry: "assets/Pre-Warn.mp3",
  yellow: "assets/SOUND181%20(1).wav",
  red: "assets/SOUND136.wav"
};

let engine = new DriveThruSimulation(loadState());
let latestStatus = "Ready.";

function $(id) {
  return document.getElementById(id);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function formatTime(value) {
  const seconds = Math.max(0, Math.round(value || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(engine.exportState()));
}

function playSound(source, repeat = 1) {
  let played = 0;

  function playNext() {
    played += 1;
    const audio = new Audio(source);
    audio.addEventListener("ended", () => {
      if (played < repeat) playNext();
    }, { once: true });

    audio.play().catch(() => {
      // Browsers may block audio until the page has had a user interaction.
    });
  }

  playNext();
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === "laneEntry" && event.lane === 1) playSound(SOUND_SOURCES.lane1Entry);
    if (event.type === "laneEntry" && event.lane === 2) playSound(SOUND_SOURCES.lane2Entry);
    if (event.type === "thresholdYellow") playSound(SOUND_SOURCES.yellow);
    if (event.type === "thresholdRed") playSound(SOUND_SOURCES.red, 2);

    if (event.message) latestStatus = event.message;
  }

  $("statusBar").textContent = latestStatus;
}

function action(callback) {
  callback(nowSeconds());
  handleEvents(engine.consumeEvents());
  saveState();
  render();
}

function setScoreColour(element, average, target) {
  if (!average) {
    element.style.color = "var(--orange)";
    return;
  }

  if (average <= target) {
    element.style.color = "var(--green)";
  } else if (average <= target * 1.35) {
    element.style.color = "var(--orange)";
  } else {
    element.style.color = "var(--red)";
  }
}

function renderBoard() {
  const stats = engine.getBoardStats();
  const targets = engine.state.targets;
  const rows = [
    ["order1", "order1Avg", "order1Pct"],
    ["order2", "order2Avg", "order2Pct"],
    ["cash", "cashAvg", "cashPct"],
    ["present", "presentAvg", "presentPct"],
    ["total", "totalAvg", "totalPct"]
  ];

  for (const [metric, avgId, pctId] of rows) {
    const average = stats[metric].average;
    $(avgId).textContent = formatTime(average);
    $(pctId).textContent = `${stats[metric].percent}%`;
    setScoreColour($(avgId), average, targets[metric]);
  }
}

function renderPositionLabels() {
  const wrap = $("positionLabels");
  if (wrap.dataset.rendered === "true") return;

  for (const [key, pos] of Object.entries(POSITIONS)) {
    const marker = document.createElement("div");
    marker.className = `position-marker ${pos.type === "order" ? "station-order" : ""} ${pos.type === "cash" ? "station-cash" : ""} ${pos.type === "present" ? "station-present" : ""} ${pos.type === "gap" ? "gap" : ""}`;
    marker.style.left = `${pos.x}%`;
    marker.style.top = `${pos.y}%`;
    marker.textContent = POSITION_LABELS[key] || pos.label;
    wrap.appendChild(marker);
  }

  wrap.dataset.rendered = "true";
}

function carTimerLabel(car, now) {
  if (car.position === "l1_order" || car.position === "l2_order") {
    if (car.orderReady) return "Order ready";
    return `Order ${formatTime(now - car.positionEnteredAt)}`;
  }

  if (car.position === "cash") {
    if (car.cashReady) return "Cash ready";
    return `Cash ${formatTime(now - car.positionEnteredAt)}`;
  }

  if (car.position === "present") {
    if (car.presentReady) return "Present ready";
    return `Present ${formatTime(now - car.positionEnteredAt)}`;
  }

  if (car.totalStartedAt != null) {
    return `Total ${formatTime(now - car.totalStartedAt)}`;
  }

  return "Pre-order";
}

function renderCars() {
  const now = nowSeconds();
  const layer = $("carsLayer");
  layer.innerHTML = "";

  for (const car of engine.state.cars) {
    const pos = POSITIONS[car.position];
    if (!pos) continue;

    const carElement = document.createElement("div");
    carElement.className = `car ${engine.getCarColour(car, now)}`;
    carElement.style.left = `${pos.x}%`;
    carElement.style.top = `${pos.y}%`;
    carElement.innerHTML = `<strong>#${car.id}</strong><small>L${car.lane} · ${carTimerLabel(car, now)}</small>`;
    layer.appendChild(carElement);
  }
}

function renderSummary() {
  const now = nowSeconds();
  const activeTotals = engine.state.cars.map((car) => engine.activeTotalSeconds(car, now));
  const longest = activeTotals.length ? Math.max(...activeTotals) : 0;

  $("activeCount").textContent = engine.state.cars.length;
  $("completedCount").textContent = engine.state.completed.length;
  $("longestActiveTotal").textContent = formatTime(longest);
}

function renderHistory() {
  const body = $("historyBody");
  if (!engine.state.completed.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No completed cars yet.</td></tr>';
    return;
  }

  body.innerHTML = engine.state.completed.slice(0, 20).map((car) => `
    <tr>
      <td>#${car.id}</td>
      <td>${car.lane}</td>
      <td>${formatTime(car.metrics.order1 ?? car.metrics.order2)}</td>
      <td>${formatTime(car.metrics.cash)}</td>
      <td>${formatTime(car.metrics.present)}</td>
      <td>${formatTime(car.metrics.total)}</td>
    </tr>
  `).join("");
}

function renderClock() {
  const date = new Date();
  $("currentTime").textContent = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function render() {
  renderClock();
  renderPositionLabels();
  renderBoard();
  renderCars();
  renderSummary();
  renderHistory();
}

function resetDay() {
  if (!confirm("Reset all active cars and completed car history?")) return;
  engine = new DriveThruSimulation();
  latestStatus = "Day reset.";
  localStorage.removeItem(storageKey);
  $("statusBar").textContent = latestStatus;
  render();
}

function wireEvents() {
  $("addLane1Btn").addEventListener("click", () => action((now) => engine.addCar(1, now)));
  $("addLane2Btn").addEventListener("click", () => action((now) => engine.addCar(2, now)));
  $("releaseOrder1Btn").addEventListener("click", () => action((now) => engine.releaseOrder(1, now)));
  $("releaseOrder2Btn").addEventListener("click", () => action((now) => engine.releaseOrder(2, now)));
  $("releaseCashBtn").addEventListener("click", () => action((now) => engine.releaseCash(now)));
  $("releasePresentBtn").addEventListener("click", () => action((now) => engine.releasePresent(now)));
  $("resetBtn").addEventListener("click", resetDay);

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "1") action((now) => engine.addCar(1, now));
    if (key === "2") action((now) => engine.addCar(2, now));
    if (key === "q") action((now) => engine.releaseOrder(1, now));
    if (key === "w") action((now) => engine.releaseOrder(2, now));
    if (key === "c") action((now) => engine.releaseCash(now));
    if (key === "p") action((now) => engine.releasePresent(now));
  });
}

wireEvents();
render();

setInterval(() => {
  engine.tick(nowSeconds());
  handleEvents(engine.consumeEvents());
  saveState();
  render();
}, 1000);

// Exposed for lightweight browser debugging only.
window.driveThruEngine = engine;
window.driveThruTargets = DEFAULT_TARGETS;
