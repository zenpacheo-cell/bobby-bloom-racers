const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const characters = [
  ["Mrs. Bobby Brown", "#ff6fae", "#fff0a8", "Rose boost"],
  ["Candy Belle", "#ff8bd1", "#9effe6", "Sweet speed"],
  ["Princess Poppy", "#f65a8f", "#ffe36d", "Royal shield"],
  ["Starla Shine", "#8e79ff", "#fff46a", "Star shot"],
  ["Cherry Lulu", "#e9385f", "#ffffff", "Cherry dash"],
  ["Daisy Doll", "#ffd84d", "#77ddb5", "Petal glide"],
  ["Glitter Gia", "#c36bff", "#7ee4ff", "Spark trail"],
  ["Moon Mimi", "#5c70d6", "#ffd2f0", "Moon mist"],
  ["Bella Bow", "#ff91b8", "#f7528d", "Bow trap"],
  ["Pearl Peach", "#ffb987", "#f6ffff", "Pearl guard"],
  ["Cupcake Coco", "#d98958", "#ffb6db", "Frosting drift"],
  ["Violet Vee", "#7b4dff", "#ffd0fb", "Violet burst"],
  ["Angel Aura", "#86d6ff", "#ffffff", "Wing lift"],
  ["Ruby Rose", "#cf244d", "#ffd7dd", "Rose bomb"],
  ["Bobby Rabbit", "#352345", "#d8fcff", "Sabotage"]
].map(([name, color, accent, skill], id) => ({ id, name, color, accent, skill }));

const maps = [
  ["Pink Blossom Boulevard", ["#ffd2e5", "#a6f0de", "#fff0a8", "#ff5f9f"], "Win the boulevard race to recover Mrs. Bobby Brown's glitter map.", "Bobby Rabbit painted fake heart arrows on the road."],
  ["Candy Cloud Circuit", ["#c8ecff", "#ffd8f2", "#ffe36d", "#ff84b7"], "Glide through candy clouds to find the sugar-key clue.", "Sticky lollipop puddles are slowing everyone down."],
  ["Glitter Garden Speedway", ["#acf2c4", "#f6b8ff", "#ffe477", "#63cdf7"], "Follow butterfly shortcuts and collect the petal compass.", "The garden vines are snapping across the track."],
  ["Diamond Mall Dash", ["#f7ffff", "#9ee4ff", "#ff9dc8", "#ffe36d"], "Race through boutiques to find Bobby Rabbit's receipt trail.", "Perfume clouds are blocking the racing line."],
  ["Ballet Castle Raceway", ["#ffd7f2", "#d5c1ff", "#fff9c8", "#ff71a9"], "Spin through the castle halls to unlock the ballroom gate.", "Ribbon traps are falling near the chandeliers."],
  ["Moonlight Vanity Valley", ["#6e64c9", "#ff9ed1", "#bdf4ff", "#fff07b"], "Final boss race: defeat Bobby Rabbit and save the Bloom Cup.", "Moon mirrors are swapping the roads."]
].map(([name, colors, clue, sabotage]) => ({ name, colors, clue, sabotage }));

const powerUps = [
  { name: "Glitter Boost", type: "boost", color: "#ffe36d" },
  { name: "Heart Shield", type: "shield", color: "#ff6fae" },
  { name: "Bow Trap", type: "trap", color: "#f7528d" },
  { name: "Star Wand", type: "shot", color: "#fff46a" },
  { name: "Angel Wings", type: "wings", color: "#ffffff" },
  { name: "Rose Bomb", type: "bomb", color: "#cf244d" }
];

const keys = {};
let selectedCharacter = 0;
let selectedMap = 0;
let raceActive = false;
let muted = false;
let tick = 0;
let message = "Pick a racer, then press Start Game.";
let messageTimer = 0;
let stars = 0;
let finishLocked = false;

const player = {
  lane: 0,
  speed: 0,
  distance: 0,
  lap: 1,
  power: null,
  shield: 0,
  boost: 0,
  flying: 0,
  drift: 0
};

let rivals = [];
let pickups = [];
let hazards = [];
let shots = [];
let confetti = [];
let leaderboard = [];

const characterGrid = document.querySelector("#characterGrid");
const mapList = document.querySelector("#mapList");
const overlay = document.querySelector("#overlay");
const storyKicker = document.querySelector("#storyKicker");
const storyTitle = document.querySelector("#storyTitle");
const storyText = document.querySelector("#storyText");
const selectedPortrait = document.querySelector("#selectedPortrait");
const startRace = document.querySelector("#startRace");
const questHud = document.querySelector("#questHud");
const lapHud = document.querySelector("#lapHud");
const powerHud = document.querySelector("#powerHud");
const starHud = document.querySelector("#starHud");
const leaderboardList = document.querySelector("#leaderboardList");

function renderMenus() {
  characterGrid.innerHTML = "";
  characters.forEach((character, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `character-card ${index === selectedCharacter ? "active" : ""}`;
    button.innerHTML = `<canvas class="avatar" width="96" height="96"></canvas><span class="name">${character.name}</span><span class="trait">${character.skill}</span>`;
    button.addEventListener("click", () => {
      selectedCharacter = index;
      renderMenus();
      resetRace(true);
    });
    characterGrid.appendChild(button);
    drawPortrait(button.querySelector("canvas"), character);
  });

  mapList.innerHTML = "";
  maps.forEach((map, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `map-card ${index === selectedMap ? "active" : ""}`;
    button.innerHTML = `<span class="map-dot" style="background:${map.colors[3]}"></span><span><b>${map.name}</b><br><small>${map.clue}</small></span>`;
    button.addEventListener("click", () => {
      selectedMap = index;
      renderMenus();
      resetRace(true);
    });
    mapList.appendChild(button);
  });
}

function drawPortrait(canvasNode, character) {
  const a = canvasNode.getContext("2d");
  a.imageSmoothingEnabled = false;
  const scale = canvasNode.width / 96;
  a.clearRect(0, 0, canvasNode.width, canvasNode.height);
  a.save();
  a.scale(scale, scale);
  a.fillStyle = character.accent;
  a.fillRect(8, 8, 80, 80);
  a.fillStyle = "#271c32";
  a.fillRect(18, 18, 60, 60);
  a.fillStyle = character.color;
  a.fillRect(24, 22, 48, 48);
  a.fillStyle = character.accent;
  a.fillRect(34, 54, 28, 22);
  a.fillStyle = "#271c32";
  a.fillRect(34, 38, 8, 8);
  a.fillRect(54, 38, 8, 8);
  a.fillRect(40, 55, 16, 5);
  a.fillStyle = "#fff";
  a.fillRect(37, 25, 22, 6);
  a.fillStyle = character.name === "Bobby Rabbit" ? "#352345" : "#ff5f9f";
  a.fillRect(14, 12, 20, 22);
  a.fillRect(62, 12, 20, 22);
  a.fillStyle = "#ffffff";
  a.fillRect(20, 18, 8, 10);
  a.fillRect(68, 18, 8, 10);
  a.restore();
}

function resetRace(showStory = true) {
  Object.assign(player, { lane: 0, speed: 0, distance: 0, lap: 1, power: null, shield: 0, boost: 0, flying: 0, drift: 0 });
  raceActive = false;
  finishLocked = false;
  message = "Pick a racer, then press Start Game.";
  rivals = Array.from({ length: 9 }, (_, i) => ({
    lane: [-0.78, -0.52, -0.25, 0, 0.25, 0.52, 0.78, -0.12, 0.12][i],
    distance: 210 + i * 150,
    speed: 5.1 + Math.random() * 1.1,
    character: characters[(selectedCharacter + i + 1) % characters.length]
  }));
  pickups = Array.from({ length: 24 }, (_, i) => ({
    lane: [-0.62, 0, 0.62][i % 3],
    distance: 260 + i * 185,
    power: powerUps[i % powerUps.length],
    taken: false
  }));
  hazards = Array.from({ length: 22 }, (_, i) => ({
    lane: [-0.7, -0.25, 0.25, 0.7][i % 4],
    distance: 340 + i * 210,
    spin: Math.random() * 6
  }));
  shots = [];
  confetti = [];
  updateStory();
  if (showStory) overlay.classList.remove("hidden");
  updateHud();
  updateLeaderboard();
}

function updateStory() {
  const map = maps[selectedMap];
  drawPortrait(selectedPortrait, characters[selectedCharacter]);
  storyKicker.textContent = selectedMap === maps.length - 1 ? "Final Chapter" : `Chapter ${selectedMap + 1}`;
  storyTitle.textContent = map.name;
  storyText.textContent = `${characters[selectedCharacter].name} is ready. ${map.clue} Warning: ${map.sabotage}`;
  startRace.textContent = "Start Game";
}

function start() {
  overlay.classList.add("hidden");
  raceActive = true;
  finishLocked = false;
  message = "Race started! Use W A S D.";
  messageTimer = 160;
  beep();
}

function update() {
  tick++;
  if (!raceActive) return;

  const throttle = keys.KeyW ? 0.18 : 0;
  const brake = keys.KeyS ? -0.22 : 0;
  const steer = (keys.KeyA ? -1 : 0) + (keys.KeyD ? 1 : 0);
  const drifting = keys.ShiftLeft || keys.ShiftRight;
  player.speed += throttle + brake;
  player.speed *= player.flying ? 0.993 : 0.975;
  player.speed = Math.max(-1.8, Math.min(player.boost ? 13.5 : 8.6, player.speed));
  player.lane += steer * (drifting ? 0.036 : 0.026) * Math.max(0.35, Math.abs(player.speed) / 4);
  player.lane *= 0.992;
  player.lane = Math.max(-1.18, Math.min(1.18, player.lane));
  player.distance += player.speed;
  player.drift = drifting && steer ? 1 : Math.max(0, player.drift - 0.04);

  if (player.boost) player.boost--;
  if (player.shield) player.shield--;
  if (player.flying) player.flying--;
  if (messageTimer) messageTimer--;

  if (Math.floor(player.distance / 1800) + 1 > player.lap) {
    player.lap++;
    say(player.lap > 3 ? "Quest complete!" : `Lap ${player.lap}!`);
  }

  rivals.forEach((rival) => {
    rival.distance += rival.speed;
    rival.lane += Math.sin((tick + rival.distance) / 90) * 0.003;
  });

  pickups.forEach((pickup) => {
    if (pickup.taken) return;
    const z = pickup.distance - player.distance;
    if (z > 0 && z < 52 && Math.abs(pickup.lane - player.lane) < 0.28) {
      pickup.taken = true;
      player.power = pickup.power;
      say(`${pickup.power.name} collected! Press Space.`);
    }
  });

  hazards.forEach((hazard) => {
    const z = hazard.distance - player.distance;
    if (z > 0 && z < 48 && Math.abs(hazard.lane - player.lane) < 0.25 && !player.flying) {
      if (player.shield) {
        player.shield = 0;
        hazard.distance -= 600;
        say("Heart Shield blocked Bobby Rabbit!");
      } else {
        player.speed *= -0.3;
        hazard.distance -= 700;
        say("Sabotage hit!");
      }
    }
  });

  if (Math.floor(player.distance) % 900 < 10 && player.speed > 5 && !player.flying) {
    player.flying = 105;
    say("Glide ramp! You are flying.");
  }

  shots.forEach((shot) => {
    shot.distance += 16;
    shot.life--;
    rivals.forEach((rival) => {
      if (shot.life > 0 && Math.abs(rival.distance - shot.distance) < 60 && Math.abs(rival.lane - shot.lane) < 0.25) {
        rival.speed *= 0.35;
        shot.life = 0;
        say("Sparkle shot landed!");
      }
    });
  });
  shots = shots.filter((shot) => shot.life > 0);

  updateLeaderboard();
  if (player.lap > 3) finishRace();
  updateHud();
}

function finishRace() {
  if (finishLocked) return;
  finishLocked = true;
  raceActive = false;
  stars++;
  const results = getPlacements();
  leaderboard = results.slice(0, 10);
  updateLeaderboard();
  launchConfetti();
  playStarSound();
  overlay.classList.remove("hidden");
  storyKicker.textContent = "You've Got a Star";
  storyTitle.textContent = results[0].name === characters[selectedCharacter].name ? "1st Place Winner" : "Race Finished";
  storyText.innerHTML = `${characters[selectedCharacter].name} earned a golden Bloom Star. <span class="star-award">★</span>${buildPodium(results)}`;
  if (selectedMap < maps.length - 1) {
    startRace.textContent = "Next Quest";
    startRace.onclick = () => {
      selectedMap++;
      renderMenus();
      resetRace(false);
      startRace.onclick = start;
      start();
    };
  } else {
    startRace.textContent = "Play Again";
    startRace.onclick = () => {
      selectedMap = 0;
      renderMenus();
      resetRace(false);
      startRace.onclick = start;
      start();
    };
  }
  updateHud();
}

function usePower() {
  if (!raceActive || !player.power) return;
  const power = player.power;
  player.power = null;
  if (power.type === "boost") player.boost = 150;
  if (power.type === "shield") player.shield = 360;
  if (power.type === "wings") player.flying = 150;
  if (power.type === "shot" || power.type === "bomb") shots.push({ lane: player.lane, distance: player.distance + 80, life: 100, color: power.color });
  if (power.type === "trap") hazards.push({ lane: player.lane, distance: player.distance + 120, spin: 0 });
  say(`${power.name} activated!`);
}

function draw() {
  const map = maps[selectedMap];
  drawSky(map);
  drawRoad(map);
  drawObjects();
  drawPlayer();
  drawConfetti();
  drawHudBox(map);
}

function drawSky(map) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, map.colors[0]);
  grad.addColorStop(0.48, map.colors[1]);
  grad.addColorStop(1, "#fff7fb");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,.45)";
  for (let i = 0; i < 38; i++) {
    const x = (i * 127 - player.distance * 0.08) % (canvas.width + 90) - 45;
    const y = 36 + (i * 61) % 245;
    drawFlower(x, y, i % 2 ? map.colors[3] : "#ffffff", 0.55);
  }
}

function drawRoad(map) {
  const horizon = 210 - (player.flying ? 18 : 0);
  ctx.fillStyle = map.colors[2];
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);
  for (let i = 34; i >= 0; i--) {
    const near = i / 34;
    const far = (i + 1) / 34;
    drawRoadSlice(far, near, i, horizon, map);
  }
}

function roadShape(t, horizon) {
  const y = horizon + t * t * (canvas.height - horizon + 70);
  const roadW = 58 + t * t * 820;
  const center = canvas.width / 2 + Math.sin((player.distance / 420) + t * 4.8 + selectedMap) * 95 * (1 - t) - player.lane * 250 * t;
  return { y, left: center - roadW / 2, right: center + roadW / 2, center, roadW };
}

function drawRoadSlice(far, near, i, horizon, map) {
  const a = roadShape(far, horizon);
  const b = roadShape(near, horizon);
  ctx.beginPath();
  ctx.moveTo(a.left, a.y);
  ctx.lineTo(a.right, a.y);
  ctx.lineTo(b.right, b.y);
  ctx.lineTo(b.left, b.y);
  ctx.closePath();
  ctx.fillStyle = i % 2 ? "#fff7fb" : "#ffe4f0";
  ctx.fill();
  ctx.strokeStyle = "#271c32";
  ctx.lineWidth = near > 0.94 ? 6 : 3;
  ctx.stroke();
  if (i % 3 === 0) {
    ctx.strokeStyle = map.colors[3];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo((a.left + a.right) / 2, a.y);
    ctx.lineTo((b.left + b.right) / 2, b.y);
    ctx.stroke();
  }
}

function drawObjects() {
  const visible = [];
  pickups.forEach((item) => !item.taken && visible.push({ ...item, kind: "pickup" }));
  hazards.forEach((item) => visible.push({ ...item, kind: "hazard" }));
  rivals.forEach((item) => visible.push({ ...item, kind: "rival" }));
  shots.forEach((item) => visible.push({ ...item, kind: "shot" }));
  visible
    .map((item) => ({ ...item, z: item.distance - player.distance }))
    .filter((item) => item.z > 10 && item.z < 950)
    .sort((a, b) => b.z - a.z)
    .forEach(drawWorldObject);
}

function drawWorldObject(item) {
  const t = 1 - item.z / 950;
  const road = roadShape(Math.max(0.03, t), 210 - (player.flying ? 18 : 0));
  const x = road.center + item.lane * road.roadW * 0.42;
  const y = road.y;
  const s = Math.max(0.24, t * 1.35);
  if (item.kind === "pickup") drawPowerBox(x, y, s, item.power);
  if (item.kind === "hazard") drawHazard(x, y, s);
  if (item.kind === "rival") drawKart(x, y, s, item.character, false);
  if (item.kind === "shot") drawStar(x, y, 18 * s, item.color);
}

function drawPlayer() {
  const y = canvas.height - 96 - (player.flying ? 56 + Math.sin(tick / 8) * 8 : 0);
  const x = canvas.width / 2 + player.lane * 145;
  if (player.drift) {
    ctx.fillStyle = "rgba(255,95,159,.35)";
    ctx.fillRect(x - 72, y + 82, 144, 22);
  }
  if (player.shield) {
    ctx.strokeStyle = "#ff5f9f";
    ctx.lineWidth = 6;
    ctx.strokeRect(x - 72, y - 88, 144, 176);
  }
  drawKart(x, y, 1.95, characters[selectedCharacter], true);
}

function drawKart(x, y, s, character, hero) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (hero) {
    ctx.fillStyle = "rgba(255, 95, 159, .22)";
    ctx.fillRect(-50, 40, 100, 24);
  }
  ctx.fillStyle = "#271c32";
  ctx.fillRect(-42, -34, 84, 92);
  ctx.fillRect(-32, -54, 64, 30);
  ctx.fillStyle = character.color;
  ctx.fillRect(-34, -28, 68, 80);
  ctx.fillStyle = shade(character.color, 26);
  ctx.fillRect(-24, -48, 48, 24);
  ctx.fillStyle = character.accent;
  ctx.fillRect(-21, -15, 42, 29);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.fillRect(-15, -10, 12, 13);
  ctx.fillRect(4, -10, 12, 13);
  ctx.fillStyle = "#271c32";
  ctx.fillRect(-48, 14, 16, 42);
  ctx.fillRect(32, 14, 16, 42);
  ctx.fillRect(-45, -38, 16, 28);
  ctx.fillRect(29, -38, 16, 28);
  ctx.fillRect(-12, 22, 24, 8);
  ctx.fillStyle = "#fff0a8";
  ctx.fillRect(-30, 42, 16, 10);
  ctx.fillRect(14, 42, 16, 10);
  ctx.fillStyle = character.accent;
  ctx.fillRect(-4, -62, 8, 14);
  ctx.fillRect(-16, -58, 32, 8);
  if (hero) {
    ctx.fillStyle = "#fff46a";
    ctx.fillRect(-24, 57, 48, 10);
    ctx.fillStyle = "#ff5f9f";
    ctx.fillRect(-36, -4, 8, 17);
    ctx.fillRect(28, -4, 8, 17);
  }
  ctx.restore();
}

function drawPowerBox(x, y, s, power) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(tick / 20);
  ctx.fillStyle = "#271c32";
  ctx.fillRect(-22, -22, 44, 44);
  ctx.fillStyle = power.color;
  ctx.fillRect(-16, -16, 32, 32);
  ctx.fillStyle = "#fff";
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
}

function drawHazard(x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(tick / 15);
  ctx.fillStyle = "#271c32";
  ctx.fillRect(-24, -24, 48, 48);
  ctx.fillStyle = "#352345";
  ctx.fillRect(-17, -17, 34, 34);
  ctx.fillStyle = "#ff5f9f";
  ctx.fillRect(-6, -31, 12, 22);
  ctx.fillRect(-6, 9, 12, 22);
  ctx.restore();
}

function drawFlower(x, y, color, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.fillRect(-8, -3, 7, 7);
  ctx.fillRect(4, -3, 7, 7);
  ctx.fillRect(-2, -10, 7, 7);
  ctx.fillRect(-2, 4, 7, 7);
  ctx.fillStyle = "#ffe36d";
  ctx.fillRect(-2, -3, 7, 7);
  ctx.restore();
}

function drawStar(x, y, size, color) {
  ctx.fillStyle = "#271c32";
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  ctx.fillStyle = color;
  ctx.fillRect(x - size / 3, y - size / 3, size * 0.66, size * 0.66);
}

function shade(hex, amount) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((start) => Math.max(0, Math.min(255, parseInt(value.slice(start, start + 2), 16) + amount)));
  return `rgb(${channels.join(",")})`;
}

function getPlacements() {
  return [
    { name: characters[selectedCharacter].name, distance: player.distance },
    ...rivals.map((rival) => ({ name: rival.character.name, distance: rival.distance }))
  ].sort((a, b) => b.distance - a.distance);
}

function updateLeaderboard() {
  const rows = (raceActive ? getPlacements() : leaderboard.length ? leaderboard : getPlacements()).slice(0, 10);
  leaderboardList.innerHTML = rows.map((row) => `<li>${row.name}</li>`).join("");
}

function buildPodium(results) {
  const top = results.slice(0, 3);
  const safe = (text) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  return `<div class="podium">
    <div class="podium-step second"><span>2nd</span><b>${safe(top[1]?.name || "Racer")}</b></div>
    <div class="podium-step first"><span>1st</span><b>${safe(top[0]?.name || "Racer")}</b></div>
    <div class="podium-step third"><span>3rd</span><b>${safe(top[2]?.name || "Racer")}</b></div>
  </div>`;
}

function launchConfetti() {
  confetti = Array.from({ length: 140 }, (_, i) => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.8,
    size: 5 + Math.random() * 10,
    speed: 1.8 + Math.random() * 4,
    drift: -1.6 + Math.random() * 3.2,
    color: ["#ff5f9f", "#ffe36d", "#6fe7c8", "#82c9ff", "#9d7bff"][i % 5],
    spin: Math.random() * 6
  }));
}

function drawConfetti() {
  if (!confetti.length) return;
  confetti.forEach((piece) => {
    piece.y += piece.speed;
    piece.x += piece.drift + Math.sin((tick + piece.spin) / 12);
    if (piece.y > canvas.height + 20) piece.y = -20;
    ctx.fillStyle = piece.color;
    ctx.fillRect(piece.x, piece.y, piece.size, Math.max(4, piece.size / 2));
  });
}

function drawHudBox(map) {
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fillRect(20, 20, 420, 88);
  ctx.strokeStyle = "#271c32";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 420, 88);
  ctx.fillStyle = "#271c32";
  ctx.font = "900 22px Nunito";
  ctx.fillText(characters[selectedCharacter].name, 38, 54);
  ctx.font = "800 16px Nunito";
  ctx.fillText(messageTimer ? message : map.sabotage, 38, 84);
  ctx.fillStyle = map.colors[3];
  ctx.fillRect(canvas.width - 170, 26, 135, 18);
  ctx.fillStyle = "#271c32";
  ctx.font = "900 16px Nunito";
  ctx.fillText(`Speed ${Math.max(0, Math.round(player.speed * 18))}`, canvas.width - 170, 68);
}

function updateHud() {
  questHud.textContent = `Quest ${selectedMap + 1} / ${maps.length}`;
  lapHud.textContent = `Lap ${Math.min(player.lap, 3)} / 3`;
  powerHud.textContent = `Power: ${player.power ? player.power.name : "none"}`;
  starHud.textContent = `Stars: ${stars}`;
}

function say(text) {
  message = text;
  messageTimer = 160;
  beep();
}

function beep() {
  if (muted) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audio = new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = 500 + Math.random() * 240;
  gain.gain.value = 0.02;
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.05);
}

function playToneSequence(notes) {
  if (muted) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audio = new AudioContext();
  notes.forEach(([frequency, start, duration, volume]) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = frequency;
    osc.type = "square";
    gain.gain.setValueAtTime(volume, audio.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + start + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + start);
    osc.stop(audio.currentTime + start + duration);
  });
}

function honk() {
  say("Honk honk!");
  playToneSequence([
    [290, 0, 0.14, 0.055],
    [230, 0.13, 0.17, 0.05]
  ]);
}

function playStarSound() {
  say("You've got a star!");
  playToneSequence([
    [523, 0, 0.12, 0.04],
    [659, 0.12, 0.12, 0.045],
    [784, 0.24, 0.16, 0.05],
    [1046, 0.42, 0.34, 0.055]
  ]);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (event.code === "Space") {
    event.preventDefault();
    usePower();
  }
  if (event.code === "KeyH") honk();
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

document.querySelectorAll("[data-control]").forEach((button) => {
  const code = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", drift: "ShiftLeft" }[button.dataset.control];
  if (code) {
    button.addEventListener("pointerdown", () => (keys[code] = true));
    button.addEventListener("pointerup", () => (keys[code] = false));
    button.addEventListener("pointerleave", () => (keys[code] = false));
  } else {
    button.addEventListener("click", usePower);
  }
});

document.querySelector("#randomRacer").addEventListener("click", () => {
  selectedCharacter = Math.floor(Math.random() * characters.length);
  renderMenus();
  resetRace(true);
});

document.querySelector("#muteToggle").addEventListener("click", () => {
  muted = !muted;
});

startRace.onclick = start;
renderMenus();
resetRace(true);
loop();
