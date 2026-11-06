

"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;
const FLOOR = 520;
const GRAVITY = 0.48;

const ui = {
  menu: document.getElementById("menu"),
  gameOver: document.getElementById("game-over"),
  pause: document.getElementById("pause-screen"),
  start: document.getElementById("start-button"),
  rematch: document.getElementById("rematch-button"),
  resume: document.getElementById("resume-button"),
  result: document.getElementById("result-title"),
  finalScore: document.getElementById("final-score")
};

const keys = {};
let gameState = "menu";
let lastTime = 0;
let elapsed = 0;
let timeLeft = 60;
let score = [0, 0];
let message = "";
let messageTimer = 0;
let shake = 0;
let particles = [];
let lastMoveDirection = 1;

const hoops = {
  left: { x: 95, y: 315 },
  right: { x: 1005, y: 315 }
};

const player = {
  x: 300, y: FLOOR, vx: 0, vy: 0,
  width: 48, height: 112,
  direction: 1,
  team: 0,
  color: "#24a6f5",
  dark: "#1264b5",
  skin: "#bd805d",
  hair: "#24202a",
  name: "YOU",
  onGround: true,
  hasBall: true,
  jumping: false,
  blocking: false,
  shooting: false,
  dashCooldown: 0,
  dashTimer: 0,
  stealCooldown: 0,
  shotCharge: 0,
  charging: false,
  super: 0,
  anim: 0,
  stun: 0
};

const cpu = {
  x: 800, y: FLOOR, vx: 0, vy: 0,
  width: 48, height: 112,
  direction: -1,
  team: 1,
  color: "#f04f5e",
  dark: "#a92843",
  skin: "#8e583f",
  hair: "#211a20",
  name: "RIVAL",
  onGround: true,
  hasBall: false,
  jumping: false,
  blocking: false,
  shooting: false,
  dashCooldown: 0,
  dashTimer: 0,
  stealCooldown: 0,
  shotCharge: 0,
  charging: false,
  super: 0,
  anim: 0,
  stun: 0
};

let ball = {
  x: player.x + 28,
  y: FLOOR - 28,
  vx: 0,
  vy: 0,
  radius: 13,
  owner: player,
  flying: false,
  shotBy: null,
  shotAge: 0,
  targetHoop: null,
  scored: false,
  lastTouch: null,
  bounce: 0
};

function resetGame() {
  score = [0, 0];
  timeLeft = 60;
  elapsed = 0;
  particles = [];
  message = "";
  messageTimer = 0;

  resetPlayers();
  gameState = "playing";
  ui.menu.classList.add("hidden");
  ui.gameOver.classList.add("hidden");
  ui.pause.classList.add("hidden");
}

function resetPlayers() {
  Object.assign(player, {
    x: 300, y: FLOOR, vx: 0, vy: 0,
    direction: 1, onGround: true,
    hasBall: true, jumping: false,
    blocking: false, shooting: false,
    dashCooldown: 0, dashTimer: 0,
    stealCooldown: 0, shotCharge: 0,
    charging: false, super: 0,
    anim: 0, stun: 0
  });

  Object.assign(cpu, {
    x: 800, y: FLOOR, vx: 0, vy: 0,
    direction: -1, onGround: true,
    hasBall: false, jumping: false,
    blocking: false, shooting: false,
    dashCooldown: 0, dashTimer: 0,
    stealCooldown: 0, shotCharge: 0,
    charging: false, super: 0,
    anim: 0, stun: 0
  });

  ball = {
    x: player.x + 28,
    y: FLOOR - 28,
    vx: 0, vy: 0,
    radius: 13,
    owner: player,
    flying: false,
    shotBy: null,
    shotAge: 0,
    targetHoop: null,
    scored: false,
    lastTouch: player,
    bounce: 0
  };
}

function other(p) {
  return p === player ? cpu : player;
}

function attackHoop(p) {
  return p === player ? hoops.right : hoops.left;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function showMessage(text, duration = 1.2) {
  message = text;
  messageTimer = duration;
}

function startGame() {
  resetGame();
}

ui.start.addEventListener("click", startGame);
ui.rematch.addEventListener("click", startGame);
ui.resume.addEventListener("click", () => {
  if (gameState === "paused") gameState = "playing";
  ui.pause.classList.add("hidden");
});

window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();

  if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
    e.preventDefault();
  }

  keys[key] = true;

  if (key === "escape") {
    if (gameState === "playing") {
      gameState = "paused";
      ui.pause.classList.remove("hidden");
    } else if (gameState === "paused") {
      gameState = "playing";
      ui.pause.classList.add("hidden");
    }
  }

  if (gameState !== "playing") return;

  if (key === "w" || key === "arrowup") jump(player);
  if (key === "s") player.blocking = true;
  if (key === "shift") dash(player);
  if (key === "z") superShot();
  if (key === "x") beginAction();
});

window.addEventListener("keyup", e => {
  const key = e.key.toLowerCase();
  keys[key] = false;

  if (key === "s") player.blocking = false;
  if (key === "x") releaseAction();
});

function jump(p) {
  if (p.onGround && !p.stun) {
    p.vy = -13.5;
    p.onGround = false;
    p.jumping = true;
  }
}

function dash(p) {
  if (p.dashCooldown > 0 || p.stun) return;

  p.dashTimer = 0.18;
  p.dashCooldown = 1.05;
  p.vx = p.direction * 13;
  p.anim += 2;
}

function beginAction() {
  if (ball.owner === player) {
    player.charging = true;
    player.shotCharge = 0;
  } else {
    attemptSteal(player);
  }
}

function releaseAction() {
  if (player.charging && ball.owner === player) {
    shoot(player, false);
  }
  player.charging = false;
}

function superShot() {
  if (player.super < 100 || ball.owner !== player) return;

  player.super = 0;
  shoot(player, true);
  showMessage("SUPER SHOT!", 1.3);
}

function attemptSteal(p) {
  const opponent = other(p);
  if (ball.owner !== opponent || p.stealCooldown > 0) return;

  const distance = Math.abs(p.x - opponent.x);
  const facing = Math.sign(opponent.x - p.x);

  if (distance < 78 && (p.direction === facing || p.blocking)) {
    p.stealCooldown = 0.8;
    opponent.stun = 0.38;
    opponent.hasBall = false;
    p.hasBall = true;
    ball.owner = p;
    ball.flying = false;
    ball.lastTouch = p;
    showMessage("STEAL!", 0.8);
    burst(ball.x, ball.y, "#ffdb76", 12);
  } else {
    p.stealCooldown = 0.55;
  }
}

function shoot(p, special) {
  if (ball.owner !== p) return;

  const hoop = attackHoop(p);
  const power = special ? 1 : clamp(p.shotCharge / 0.9, 0.18, 1);
  const distance = Math.abs(hoop.x - p.x);
  const targetX = hoop.x;
  const targetY = hoop.y + 7;
  const startX = p.x + p.direction * 24;
  const startY = p.y - (p.onGround ? 78 : 92);

  const travel = clamp(distance / (special ? 17 : 14), 0.9, 2.0);
  const vx = (targetX - startX) / (travel * 60);
  const vy = (targetY - startY - 0.5 * GRAVITY * Math.pow(travel * 60, 2)) / (travel * 60);

  const accuracy = special ? 1 : 0.48 + power * 0.42;
  const miss = (Math.random() - 0.5) * (1 - accuracy) * 100;

  p.hasBall = false;
  p.shooting = true;
  ball.owner = null;
  ball.flying = true;
  ball.x = startX;
  ball.y = startY;
  ball.vx = vx;
  ball.vy = vy;
  ball.shotBy = p;
  ball.shotAge = 0;
  ball.targetHoop = hoop;
  ball.scored = false;
  ball.missOffset = miss;
  ball.special = special;
  ball.lastTouch = p;

  p.super = clamp(p.super + 18, 0, 100);
  p.charging = false;
  p.shotCharge = 0;

  showMessage(special ? "SUPER SHOT!" : "SHOOT!", 0.45);
}

function giveBall(p) {
  player.hasBall = p === player;
  cpu.hasBall = p === cpu;
  ball.owner = p;
  ball.flying = false;
  ball.shotBy = null;
  ball.lastTouch = p;
  ball.vx = 0;
  ball.vy = 0;
  ball.scored = false;
  p.shooting = false;
}

function scoreBasket(p) {
  if (ball.scored) return;

  ball.scored = true;
  const points = ball.special ? 3 : (Math.abs(p.x - attackHoop(p).x) > 330 ? 3 : 2);
  score[p.team] += points;

  p.super = clamp(p.super + 25, 0, 100);
  showMessage(points + " POINT" + (points > 1 ? "S" : "") + "!", 1.3);
  burst(ball.x, ball.y, "#ffbd54", 28);
  shake = 8;

  setTimeout(() => {
    if (gameState !== "playing") return;
    resetAfterScore(p);
  }, 950);
}

function resetAfterScore(scorer) {
  player.x = 300;
  cpu.x = 800;
  player.y = cpu.y = FLOOR;
  player.vx = cpu.vx = 0;
  player.vy = cpu.vy = 0;
  player.onGround = cpu.onGround = true;
  player.stun = cpu.stun = 0;
  giveBall(other(scorer));
  showMessage("CHECK BALL!", 0.9);
}

function update(dt) {
  if (gameState !== "playing") return;

  elapsed += dt;
  timeLeft -= dt;

  if (timeLeft <= 0) {
    timeLeft = 0;
    finishGame();
    return;
  }

  if (messageTimer > 0) messageTimer -= dt;
  if (shake > 0) shake *= 0.85;

  updatePlayer(player, dt);
  updateCPU(dt);
  updateBall(dt);
  updateParticles(dt);
  checkPlayerContact();
}

function updatePlayer(p, dt) {
  p.anim += dt * (Math.abs(p.vx) > 0.5 ? 11 : 3);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.stealCooldown = Math.max(0, p.stealCooldown - dt);
  p.dashTimer = Math.max(0, p.dashTimer - dt);
  p.stun = Math.max(0, p.stun - dt);

  if (p.charging && p.hasBall) {
    p.shotCharge = Math.min(1, p.shotCharge + dt);
  }

  let move = 0;
  if (!p.stun) {
    if (keys.a || keys.arrowleft) move -= 1;
    if (keys.d || keys.arrowright) move += 1;
  }

  if (move !== 0) {
    p.direction = move;
    lastMoveDirection = move;
  }

  const speed = keys.shift ? 5.5 : 4.2;
  if (p.dashTimer <= 0) {
    p.vx += (move * speed - p.vx) * Math.min(1, dt * 13);
  }

  p.x += p.vx;
  p.x = clamp(p.x, 125, 975);

  p.vy += GRAVITY;
  p.y += p.vy;

  if (p.y >= FLOOR) {
    p.y = FLOOR;
    p.vy = 0;
    p.onGround = true;
    p.jumping = false;
  } else {
    p.onGround = false;
  }
}

function updateCPU(dt) {
  const p = cpu;
  const opponent = player;

  p.anim += dt * (Math.abs(p.vx) > 0.5 ? 10 : 3);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.stealCooldown = Math.max(0, p.stealCooldown - dt);
  p.stun = Math.max(0, p.stun - dt);

  if (p.stun > 0) {
    p.vx *= 0.85;
  } else {
    const target = p.hasBall ? 330 : opponent.x + 58;
    const diff = target - p.x;

    if (Math.abs(diff) > 20) {
      p.vx += (Math.sign(diff) * 3.0 - p.vx) * Math.min(1, dt * 4);
      p.direction = Math.sign(diff);
    } else {
      p.vx *= 0.8;
    }

    if (p.hasBall) {
      const distance = Math.abs(hoops.left.x - p.x);

      if (distance < 510 && Math.random() < dt * 0.75) {
        shootCPU();
      } else if (Math.random() < dt * 0.15 && p.onGround) {
        jump(p);
      }
    } else if (ball.owner === player && Math.abs(p.x - player.x) < 68) {
      if (Math.random() < dt * 1.5) {
        p.blocking = true;
        p.vx += p.direction * 1.4;
      }
    } else {
      p.blocking = false;
    }
  }

  p.x += p.vx;
  p.x = clamp(p.x, 125, 975);

  p.vy += GRAVITY;
  p.y += p.vy;

  if (p.y >= FLOOR) {
    p.y = FLOOR;
    p.vy = 0;
    p.onGround = true;
    p.jumping = false;
  } else {
    p.onGround = false;
  }
}

function shootCPU() {
  if (ball.owner !== cpu) return;

  const hoop = hoops.left;
  const startX = cpu.x - 25;
  const startY = cpu.y - 78;
  const travel = clamp(Math.abs(startX - hoop.x) / 14, 0.9, 1.8);
  const targetY = hoop.y + 7;

  cpu.hasBall = false;
  cpu.shooting = true;
  ball.owner = null;
  ball.flying = true;
  ball.x = startX;
  ball.y = startY;
  ball.vx = (hoop.x - startX) / (travel * 60);
  ball.vy = (targetY - startY - 0.5 * GRAVITY * Math.pow(travel * 60, 2)) / (travel * 60);
  ball.shotBy = cpu;
  ball.shotAge = 0;
  ball.targetHoop = hoop;
  ball.scored = false;
  ball.special = false;
  ball.missOffset = (Math.random() - 0.5) * 65;
  ball.lastTouch = cpu;
}

function updateBall(dt) {
  if (ball.owner) {
    const p = ball.owner;
    const bounce = Math.abs(Math.sin(elapsed * 8)) * 17;
    const side = p.direction;

    ball.x = p.x + side * 25;
    ball.y = p.y - 17 - bounce - (p.onGround ? 0 : 10);
    ball.bounce = bounce;
    return;
  }

  if (!ball.flying) return;

  ball.shotAge += dt;
  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;

  const hoop = ball.targetHoop;
  const p = ball.shotBy;

  if (hoop && !ball.scored) {
    const nearX = Math.abs(ball.x - hoop.x) < 13;
    const passedDown = ball.vy > 0 && ball.y > hoop.y - 4;
    const nearY = Math.abs(ball.y - hoop.y) < 17;

    if (nearX && passedDown && nearY && Math.abs(ball.missOffset) < 10) {
      scoreBasket(p);
      return;
    }

    // The rim deflects shots that hit it.
    if (nearX && Math.abs(ball.y - hoop.y) < 17 && Math.abs(ball.missOffset) >= 10) {
      ball.vx *= -0.65;
      ball.vy = Math.abs(ball.vy) * 0.65;
      ball.x += Math.sign(ball.vx) * 8;
      ball.missOffset = 1000;
    }
  }

  if (ball.y + ball.radius >= FLOOR) {
    ball.y = FLOOR - ball.radius;
    ball.vy *= -0.58;
    ball.vx *= 0.82;

    if (Math.abs(ball.vy) < 2.2) {
      ball.vy = 0;
    }
  }

  if (ball.shotAge > 2.5 || ball.x < 30 || ball.x > W - 30) {
    ball.flying = false;
    ball.vx = 0;
    ball.vy = 0;

    const closest = Math.abs(ball.x - player.x) < Math.abs(ball.x - cpu.x) ? player : cpu;
    giveBall(closest);
    showMessage("REBOUND!", 0.7);
  }
}

function checkPlayerContact() {
  if (ball.owner !== cpu) return;

  const distance = Math.abs(player.x - cpu.x);
  if (distance < 48 && player.blocking && player.stealCooldown <= 0) {
    attemptSteal(player);
  }

  if (cpu.blocking && ball.owner === player && distance < 40 && player.y < FLOOR - 45) {
    player.vy += 2;
  }
}

function finishGame() {
  gameState = "over";
  ui.gameOver.classList.remove("hidden");
  ui.result.textContent = score[0] > score[1] ? "YOU WIN!" :
    score[0] < score[1] ? "YOU LOSE!" : "DRAW!";
  ui.finalScore.textContent = score[0] + "  -  " + score[1];
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      color,
      size: 2 + Math.random() * 4
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}

function drawCourt() {
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, "#17384d");
  sky.addColorStop(1, "#315b6d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Arena lights and crowd silhouettes.
  for (let i = 0; i < 48; i++) {
    const x = i * 24;
    const y = 180 + Math.sin(i * 1.8) * 12;
    ctx.fillStyle = i % 3 === 0 ? "#426476" : "#294b5c";
    ctx.beginPath();
    ctx.arc(x + 8, y, 9 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x, y + 8, 17, 34);
  }

  // Arena lights.
  ctx.fillStyle = "#f9df9c";
  ctx.globalAlpha = 0.13;
  ctx.fillRect(70, 55, 180, 12);
  ctx.fillRect(850, 55, 180, 12);
  ctx.globalAlpha = 1;

  // Back wall panels.
  ctx.fillStyle = "#102d3d";
  ctx.fillRect(0, 220, W, 300);

  for (let x = 0; x < W; x += 75) {
    ctx.fillStyle = x % 150 === 0 ? "#1b4051" : "#173747";
    ctx.fillRect(x, 220, 2, 300);
  }

  // Court floor.
  const floor = ctx.createLinearGradient(0, FLOOR, 0, H);
  floor.addColorStop(0, "#e6a95f");
  floor.addColorStop(1, "#bd713e");
  ctx.fillStyle = floor;
  ctx.fillRect(0, FLOOR, W, H - FLOOR);

  // Floor boards.
  for (let x = 0; x < W; x += 85) {
    ctx.strokeStyle = "#9d5c35";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, FLOOR);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  ctx.strokeStyle = "#f7d09a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR);
  ctx.lineTo(W, FLOOR);
  ctx.stroke();

  // Center circle and markings.
  ctx.strokeStyle = "#f9d8a7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W / 2, FLOOR, 100, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2, FLOOR);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  // Key areas.
  ctx.beginPath();
  ctx.arc(95, FLOOR, 155, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(1005, FLOOR, 155, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  // Three point lines.
  ctx.beginPath();
  ctx.arc(95, FLOOR, 330, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(1005, FLOOR, 330, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();
}

function drawHoop(hoop, side) {
  ctx.save();

  const boardX = side === "left" ? hoop.x - 32 : hoop.x + 20;
  ctx.fillStyle = "#e9f2f5";
  ctx.strokeStyle = "#304c5c";
  ctx.lineWidth = 5;
  roundedRect(boardX, hoop.y - 60, 12, 110, 5);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#e7f0f4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hoop.x - 10, hoop.y);
  ctx.lineTo(hoop.x + 10, hoop.y);
  ctx.stroke();

  ctx.strokeStyle = "#ff7048";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(hoop.x, hoop.y + 2, 22, 7, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#f5f3e9";
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(hoop.x + i * 8, hoop.y + 6);
    ctx.lineTo(hoop.x + i * 5, hoop.y + 43);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(hoop.x - 19, hoop.y + 7);
  ctx.quadraticCurveTo(hoop.x, hoop.y + 51, hoop.x + 19, hoop.y + 7);
  ctx.stroke();

  ctx.restore();
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawPlayer(p) {
  const moving = Math.abs(p.vx) > 0.5;
  const run = moving ? Math.sin(p.anim) : 0;
  const jumpOffset = FLOOR - p.y;
  const centerX = p.x;
  const groundY = p.y;

  ctx.save();
  ctx.translate(centerX, groundY - jumpOffset);

  // Shadow.
  ctx.fillStyle = "#08121b55";
  ctx.beginPath();
  ctx.ellipse(0, 0, 34 - jumpOffset * 0.08, 8 - jumpOffset * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs.
  const legSwing = run * 13;
  ctx.lineCap = "round";
  ctx.lineWidth = 13;
  ctx.strokeStyle = "#e8e9ed";

  ctx.beginPath();
  ctx.moveTo(-10, -39);
  ctx.lineTo(-12 + legSwing, -12);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(10, -39);
  ctx.lineTo(12 - legSwing, -12);
  ctx.stroke();

  // Socks.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-12 + legSwing, -16);
  ctx.lineTo(-12 + legSwing, -7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12 - legSwing, -16);
  ctx.lineTo(12 - legSwing, -7);
  ctx.stroke();

  // Shoes.
  ctx.fillStyle = "#f8f8f5";
  roundedRect(-27 + legSwing, -12, 28, 11, 5);
  ctx.fill();
  roundedRect(1 - legSwing, -12, 28, 11, 5);
  ctx.fill();

  // Jersey and shorts.
  ctx.fillStyle = p.dark;
  roundedRect(-22, -65, 44, 29, 7);
  ctx.fill();

  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(-23, -103);
  ctx.lineTo(23, -103);
  ctx.lineTo(22, -60);
  ctx.lineTo(12, -56);
  ctx.lineTo(-12, -56);
  ctx.lineTo(-22, -60);
  ctx.closePath();
  ctx.fill();

  // Jersey trim.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-13, -100);
  ctx.lineTo(-13, -60);
  ctx.moveTo(13, -100);
  ctx.lineTo(13, -60);
  ctx.stroke();

  // Jersey number.
  ctx.fillStyle = "#fff";
  ctx.font = "bold 17px Arial";
  ctx.textAlign = "center";
  ctx.fillText(p === player ? "7" : "9", 0, -76);

  // Arms.
  const armSwing = moving ? run * 9 : 0;
  ctx.lineWidth = 12;
  ctx.strokeStyle = p.skin;

  ctx.beginPath();
  ctx.moveTo(-19, -94);
  ctx.lineTo(-28 + armSwing, -67);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(19, -94);
  ctx.lineTo(29 - armSwing, -70);
  ctx.stroke();

  // Head and neck.
  ctx.fillStyle = p.skin;
  roundedRect(-7, -112, 14, 14, 4);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, -126, 19, 0, Math.PI * 2);
  ctx.fill();

  // Hair.
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(0, -132, 19, Math.PI, Math.PI * 2);
  ctx.lineTo(18, -127);
  ctx.quadraticCurveTo(0, -141, -18, -126);
  ctx.closePath();
  ctx.fill();

  // Face.
  ctx.fillStyle = "#1d2026";
  ctx.beginPath();
  ctx.arc(p.direction * 7, -126, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#573b30";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.direction * 5, -119, 5, 0.1, 1.8);
  ctx.stroke();

  // Blocking pose.
  if (p.blocking) {
    ctx.strokeStyle = p.skin;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-19, -94);
    ctx.lineTo(-25, -130);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(19, -94);
    ctx.lineTo(25, -130);
    ctx.stroke();
  }

  // Name tag.
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText(p.name, 0, -155);

  // Shot power ring.
  if (p === player && p.charging && p.hasBall) {
    ctx.strokeStyle = "#ffcf56";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -128, 27 + p.shotCharge * 8, -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.shotCharge));
    ctx.stroke();
  }

  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.translate(ball.x, ball.y);

  ctx.fillStyle = "#f18b29";
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#542e18";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.moveTo(-12, -5);
  ctx.quadraticCurveTo(0, 0, 12, 5);
  ctx.moveTo(-4, -12);
  ctx.quadraticCurveTo(-1, 0, 4, 12);
  ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  // Scoreboard panel.
  ctx.fillStyle = "#081b2bdc";
  roundedRect(365, 18, 370, 83, 13);
  ctx.fill();
  ctx.strokeStyle = "#66859a";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#8faabd";
  ctx.font = "bold 11px Arial";
  ctx.fillText("STREET HOOPS", 550, 38);

  ctx.fillStyle = player.color;
  ctx.font = "bold 34px Arial";
  ctx.fillText(score[0], 455, 79);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 21px Arial";
  ctx.fillText(":", 550, 75);

  ctx.fillStyle = cpu.color;
  ctx.font = "bold 34px Arial";
  ctx.fillText(score[1], 645, 79);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px Arial";
  const seconds = Math.ceil(timeLeft);
  ctx.fillText(String(Math.floor(seconds / 60)).padStart(2, "0") + ":" +
    String(seconds % 60).padStart(2, "0"), 550, 96);

  // Super meter.
  ctx.fillStyle = "#0c1b28";
  roundedRect(28, 24, 185, 17, 7);
  ctx.fill();

  ctx.fillStyle = "#ffbd4a";
  roundedRect(30, 26, 181 * (player.super / 100), 13, 5);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("SUPER SHOT", 29, 17);

  // Shot meter.
  if (player.charging && player.hasBall) {
    ctx.fillStyle = "#081b2b";
    roundedRect(player.x - 42, player.y - 183, 84, 12, 5);
    ctx.fill();
    ctx.fillStyle = "#ffd05e";
    roundedRect(player.x - 40, player.y - 181,
      80 * player.shotCharge, 8, 4);
    ctx.fill();
  }

  if (messageTimer > 0) {
    ctx.globalAlpha = Math.min(1, messageTimer * 2);
    ctx.fillStyle = "#fff";
    ctx.font = "900 34px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;
    ctx.fillText(message, W / 2, 165);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function draw() {
  ctx.save();

  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake);
  }

  drawCourt();
  drawHoop(hoops.left, "left");
  drawHoop(hoops.right, "right");

  // Draw whichever player is farther back first.
  const ordered = [player, cpu].sort((a, b) => a.y - b.y);
  for (const p of ordered) drawPlayer(p);

  drawBall();
  drawParticles();
  drawHUD();

  ctx.restore();
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0);
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

resetPlayers();
requestAnimationFrame(loop);
