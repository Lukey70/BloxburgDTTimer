import { DriveThruSimulator, computeScoreboard, TARGETS } from './simulation.mjs';

const STORAGE_KEY = 'drive-thru-timer-map-v2';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const POSITION_UI = {
  present: { x: 128, y: 72, rotation: 180 },
  gap_present1: { x: 288, y: 72, rotation: 180 },
  cash: { x: 446, y: 72, rotation: 180 },
  gap_cash1: { x: 604, y: 72, rotation: 180 },
  gap_cash2: { x: 806, y: 132, rotation: -90 },
  order1: { x: 690, y: 274, rotation: -90 },
  order2: { x: 806, y: 250, rotation: -90 },
  lane1_pre1: { x: 690, y: 374, rotation: -90 },
  lane1_pre2: { x: 690, y: 476, rotation: -90 },
  lane2_pre1: { x: 806, y: 364, rotation: -90 },
  lane2_pre2: { x: 806, y: 476, rotation: -90 },
};

const simulator = new DriveThruSimulator(loadState());
let soundsEnabled = false;
let audioUnlocked = false;

const sounds = {
  lane1Entry: new Audio('assets/lane1-entry.wav'),
  lane2Entry: new Audio('assets/lane2-entry.mp3'),
  yellow: new Audio('assets/yellow-threshold.wav'),
  red: new Audio('assets/red-threshold.wav'),
};
Object.values(sounds).forEach((audio) => {
  audio.preload = 'auto';
});

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(simulator.serialize()));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function statusColourForPct(pct) {
  if (pct >= 75) return 'pct-good';
  if (pct >= 50) return 'pct-mid';
  return 'pct-bad';
}

function carStatus(car) {
  const total = simulator.totalElapsed(car);
  if (total >= 90) return 'red';
  if (total >= 60) return 'yellow';
  return 'green';
}

function carImageForStatus(status) {
  return `assets/car_${status}.png`;
}

async function unlockAudio() {
  if (audioUnlocked) return true;
  try {
    await Promise.all(Object.values(sounds).map(async (audio) => {
      audio.currentTime = 0;
      try {
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Some browsers still need the explicit enable button and will reject silent autoplay.
      }
    }));
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

async function enableSounds() {
  soundsEnabled = true;
  const ok = await unlockAudio();
  $('#soundStatus').textContent = ok ? 'Sounds enabled' : 'Sounds enabled (browser may still prompt on first play)';
  setStatus('Sounds enabled.');
}

async function playSound(soundKey, repeat = 1) {
  if (!soundsEnabled) return;
  if (!audioUnlocked) {
    await unlockAudio();
  }
  const template = sounds[soundKey];
  if (!template) return;
  try {
    for (let i = 0; i < repeat; i += 1) {
      const clip = template.cloneNode();
      clip.volume = 1;
      clip.play();
      if (repeat > 1 && i < repeat - 1) {
        await new Promise((resolve) => {
          clip.onended = () => resolve();
          setTimeout(resolve, 1500);
        });
      }
    }
  } catch (error) {
    $('#soundStatus').textContent = 'Sound blocked or failed';
    setStatus(`Sound could not be played: ${error.message || error}`);
  }
}

function setStatus(message) {
  $('#statusBar').textContent = message;
}

function setClock() {
  const now = new Date();
  $('#currentClock').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function renderScoreboard() {
  const scores = computeScoreboard(simulator.completedCars);
  const mappings = [
    ['order1', '#avgOrder1', '#pctOrder1'],
    ['order2', '#avgOrder2', '#pctOrder2'],
    ['cash', '#avgCash', '#pctCash'],
    ['present', '#avgPresent', '#pctPresent'],
    ['total', '#avgTotal', '#pctTotal'],
  ];
  for (const [key, avgSelector, pctSelector] of mappings) {
    const data = scores[key];
    $(avgSelector).textContent = formatTime(data.avg);
    const pctEl = $(pctSelector);
    pctEl.textContent = `${data.pct}%`;
    pctEl.className = `pct ${statusColourForPct(data.pct)}`;
  }
}

function renderLiveSectionLabels() {
  const labels = {
    present: simulator.carAt('present'),
    cash: simulator.carAt('cash'),
    order1: simulator.carAt('order1'),
    order2: simulator.carAt('order2'),
  };
  $('#labelPresentTime').textContent = labels.present ? formatTime(simulator.stationElapsed(labels.present)) : '0:00';
  $('#labelCashTime').textContent = labels.cash ? formatTime(simulator.stationElapsed(labels.cash)) : '0:00';
  $('#labelOrder1Time').textContent = labels.order1 ? formatTime(simulator.stationElapsed(labels.order1)) : '0:00';
  $('#labelOrder2Time').textContent = labels.order2 ? formatTime(simulator.stationElapsed(labels.order2)) : '0:00';
}

function renderSummaryPanel() {
  $('#carsInLane').textContent = String(simulator.getCarsInLaneCount());
  $('#longestWait').textContent = formatTime(simulator.getLongestCurrentTotal());
}

function renderControlsState() {
  $('#btnReleaseOrder1').disabled = !simulator.carAt('order1');
  $('#btnReleaseOrder2').disabled = !simulator.carAt('order2');
  $('#btnReleaseCash').disabled = !simulator.carAt('cash');
  $('#btnReleasePresent').disabled = !simulator.carAt('present');
}

function renderCars() {
  const layer = $('#carsLayer');
  layer.innerHTML = '';
  for (const car of simulator.activeCars) {
    const ui = POSITION_UI[car.position];
    if (!ui) continue;
    const status = carStatus(car);
    const wrapper = document.createElement('div');
    wrapper.className = 'car';
    wrapper.style.left = `${ui.x}px`;
    wrapper.style.top = `${ui.y}px`;
    wrapper.style.transform = `translate(-50%, -50%) rotate(${ui.rotation}deg)`;
    wrapper.innerHTML = `
      <img src="${carImageForStatus(status)}" alt="Car ${car.id}">
      <div class="car-badge">${car.id}</div>
    `;
    layer.appendChild(wrapper);
  }
}

function renderHistory() {
  const body = $('#historyBody');
  if (!simulator.completedCars.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No completed cars yet.</td></tr>';
    return;
  }
  body.innerHTML = simulator.completedCars.slice(0, 12).map((car) => `
    <tr>
      <td>#${car.id}</td>
      <td>${car.lane}</td>
      <td>${formatTime(car.lane === 1 ? car.timings.order1 : car.timings.order2)}</td>
      <td>${formatTime(car.timings.cash)}</td>
      <td>${formatTime(car.timings.present)}</td>
      <td>${formatTime(car.timings.total)}</td>
    </tr>
  `).join('');
}

function renderTargets() {
  $('#goalOrder1').textContent = formatTime(TARGETS.order1);
  $('#goalOrder2').textContent = formatTime(TARGETS.order2);
  $('#goalCash').textContent = formatTime(TARGETS.cash);
  $('#goalPresent').textContent = formatTime(TARGETS.present);
  $('#goalTotal').textContent = formatTime(TARGETS.total);
}

function render() {
  setClock();
  renderTargets();
  renderScoreboard();
  renderLiveSectionLabels();
  renderSummaryPanel();
  renderCars();
  renderHistory();
  renderControlsState();
  $('#soundStatus').textContent = soundsEnabled ? 'Sounds enabled' : 'Sounds off';
}

async function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'lane1-entry') {
      await playSound('lane1Entry');
    }
    if (event.type === 'lane2-entry') {
      await playSound('lane2Entry');
    }
    if (event.type === 'yellow-threshold') {
      await playSound('yellow');
      setStatus(`Car #${event.carId} turned yellow at 1:00 total time.`);
    }
    if (event.type === 'red-threshold') {
      await playSound('red', 2);
      setStatus(`Car #${event.carId} turned red at 1:30 total time.`);
    }
    if (event.type === 'car-completed') {
      setStatus(`Car #${event.carId} left present and was counted as a completed car.`);
    }
  }
}

async function addCar(lane) {
  const result = simulator.addCar(lane);
  if (!result.ok) {
    setStatus(result.reason);
    return;
  }
  saveState();
  render();
  await handleEvents(result.events || []);
}

function releaseStation(station) {
  const result = simulator.releaseStation(station);
  setStatus(result.reason || simulator.statusMessage);
  saveState();
  render();
}

function resetDay() {
  if (!window.confirm('Reset all active cars, averages and completed history?')) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

async function runTick() {
  const events = simulator.tick(1);
  saveState();
  render();
  await handleEvents(events);
}

function wireButtons() {
  $('#btnAddLane1').addEventListener('click', () => addCar(1));
  $('#btnAddLane2').addEventListener('click', () => addCar(2));
  $('#btnReleaseOrder1').addEventListener('click', () => releaseStation('order1'));
  $('#btnReleaseOrder2').addEventListener('click', () => releaseStation('order2'));
  $('#btnReleaseCash').addEventListener('click', () => releaseStation('cash'));
  $('#btnReleasePresent').addEventListener('click', () => releaseStation('present'));
  $('#btnEnableSounds').addEventListener('click', enableSounds);
  $('#btnTestSounds').addEventListener('click', async () => {
    await enableSounds();
    await playSound('lane1Entry');
    setStatus('Played test sound.');
  });
  $('#btnReset').addEventListener('click', resetDay);

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === '1') addCar(1);
    if (key === '2') addCar(2);
    if (key === 'q') releaseStation('order1');
    if (key === 'w') releaseStation('order2');
    if (key === 'c') releaseStation('cash');
    if (key === 'p') releaseStation('present');
  });
}

wireButtons();
setStatus(simulator.statusMessage || 'Ready.');
render();
setInterval(runTick, 1000);
setInterval(setClock, 30000);
