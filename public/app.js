"use strict";

const COLORS = {
  black: "#111",
  ai: "#7c3aed",
};
const AI_PEN = "ai";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const state = {
  color: "black",
  width: 4,
  eraser: false,
  strokes: [],
  answers: [],
  active: null,
  activePointerId: null,
  activePointerType: null,
  nextId: 1,
};

let dpr = Math.max(1, window.devicePixelRatio || 1);

function resizeCanvas() {
  dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  redraw();
}

function clearScreen() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#fafaf7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawStroke(s) {
  if (!s.points.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (s.eraser) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = s.color;
  }

  if (s.points.length === 1) {
    const p = s.points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, (s.width * (p.p || 1)) / 2, 0, Math.PI * 2);
    ctx.fillStyle = s.eraser ? "rgba(0,0,0,1)" : s.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = 1; i < s.points.length; i++) {
    const a = s.points[i - 1];
    const b = s.points[i];
    const w = s.width * ((a.p + b.p) / 2 || 1);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAnswer(a) {
  if (!a.text) return;
  ctx.save();
  ctx.fillStyle = a.error ? "#c0392b" : "#222";
  const fontSize = a.fontSize || 22;
  const font = `${fontSize}px "Klee One", "Hiragino Maru Gothic ProN", system-ui, cursive`;
  ctx.font = font;
  ctx.textBaseline = "top";

  let cursorY = a.y;
  for (let li = 0; li < a.lines.length; li++) {
    const line = a.lines[li];
    let cursorX = a.x;
    for (let ci = 0; ci < line.chars.length; ci++) {
      const ch = line.chars[ci];
      const j = ch.jitter;
      ctx.save();
      ctx.translate(cursorX + j.dx, cursorY + j.dy);
      ctx.rotate(j.rot);
      ctx.fillText(ch.c, 0, 0);
      ctx.restore();
      cursorX += ch.w;
    }
    cursorY += fontSize * 1.4;
  }
  ctx.restore();
}

function redraw() {
  clearScreen();
  for (const s of state.strokes) drawStroke(s);
  for (const a of state.answers) drawAnswer(a);
  if (state.active) drawStroke(state.active);
}

function setStatus(text, isError = false) {
  if (!text) {
    statusEl.classList.add("hidden");
    statusEl.textContent = "";
    return;
  }
  statusEl.textContent = text;
  statusEl.classList.toggle("error", !!isError);
  statusEl.classList.remove("hidden");
}

function pointFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
  const p = 0.3 + pressure * 0.7;
  return { x: e.clientX - rect.left, y: e.clientY - rect.top, p };
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas) return;
  if (state.active && state.activePointerType === "pen" && e.pointerType !== "pen") return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);

  const pt = pointFromEvent(e);
  state.active = {
    id: state.nextId++,
    color: COLORS[state.color],
    colorName: state.color,
    width: state.width,
    eraser: state.eraser,
    points: [pt],
  };
  state.activePointerId = e.pointerId;
  state.activePointerType = e.pointerType;
});

canvas.addEventListener("pointermove", (e) => {
  if (!state.active || e.pointerId !== state.activePointerId) return;
  if (state.activePointerType === "pen" && e.pointerType !== "pen") return;
  e.preventDefault();
  const pt = pointFromEvent(e);
  const last = state.active.points[state.active.points.length - 1];
  const dx = pt.x - last.x;
  const dy = pt.y - last.y;
  if (dx * dx + dy * dy < 1) return;
  state.active.points.push(pt);
  redraw();
});

function endStroke(e) {
  if (!state.active || e.pointerId !== state.activePointerId) return;
  const finished = state.active;
  state.strokes.push(finished);
  state.active = null;
  state.activePointerId = null;
  state.activePointerType = null;
  redraw();
  maybeTriggerAI(finished);
}

canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);
canvas.addEventListener("pointerleave", endStroke);

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

document.querySelectorAll(".color-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.color = btn.dataset.color;
    state.eraser = false;
    document.querySelectorAll(".color-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document.getElementById("eraser-btn").classList.remove("active");
  });
});

document.querySelectorAll(".width-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.width = parseInt(btn.dataset.width, 10);
    document.querySelectorAll(".width-btn").forEach((b) => b.classList.toggle("active", b === btn));
  });
});

document.getElementById("eraser-btn").addEventListener("click", (e) => {
  state.eraser = !state.eraser;
  e.currentTarget.classList.toggle("active", state.eraser);
});

document.getElementById("clear-btn").addEventListener("click", () => {
  if (!state.strokes.length && !state.answers.length) return;
  if (!confirm("すべて消去します。よろしいですか？")) return;
  state.strokes = [];
  state.answers = [];
  redraw();
});

function strokeBoundingBox(s) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function isClosedLoop(s) {
  if (s.points.length < 8) return false;
  const bb = strokeBoundingBox(s);
  const L = Math.hypot(bb.w, bb.h);
  if (L < 80) return false;
  const p0 = s.points[0];
  const pn = s.points[s.points.length - 1];
  const d = Math.hypot(p0.x - pn.x, p0.y - pn.y);
  return d < Math.max(40, L * 0.25);
}

async function maybeTriggerAI(stroke) {
  if (stroke.eraser) return;
  if (stroke.colorName !== AI_PEN) return;
  if (!isClosedLoop(stroke)) return;
  if (stroke.answeredAt) return;
  stroke.answeredAt = Date.now();

  const bb = strokeBoundingBox(stroke);
  const pad = 12;
  const x = Math.max(0, bb.minX - pad);
  const y = Math.max(0, bb.minY - pad);
  const w = Math.min(window.innerWidth - x, bb.w + pad * 2);
  const h = Math.min(window.innerHeight - y, bb.h + pad * 2);

  const off = document.createElement("canvas");
  off.width = Math.floor(w * dpr);
  off.height = Math.floor(h * dpr);
  const octx = off.getContext("2d");
  octx.fillStyle = "#fafaf7";
  octx.fillRect(0, 0, off.width, off.height);
  octx.scale(dpr, dpr);
  octx.translate(-x, -y);
  for (const s of state.strokes) {
    drawStrokeTo(octx, s);
  }

  const dataUrl = off.toDataURL("image/png");

  setStatus("Claude に問い合わせ中…");
  try {
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const answer = (json.answer || "").trim();
    if (!answer) throw new Error("回答が空でした");
    addAnswer(stroke, bb, answer, false);
    setStatus("");
  } catch (err) {
    console.error(err);
    addAnswer(stroke, bb, "エラー: " + (err.message || err), true);
    setStatus("エラー: " + (err.message || err), true);
    setTimeout(() => setStatus(""), 4000);
  }
}

function drawStrokeTo(targetCtx, s) {
  if (!s.points.length) return;
  targetCtx.save();
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  if (s.eraser) {
    targetCtx.globalCompositeOperation = "destination-out";
    targetCtx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    targetCtx.globalCompositeOperation = "source-over";
    targetCtx.strokeStyle = s.color;
  }
  if (s.points.length === 1) {
    const p = s.points[0];
    targetCtx.beginPath();
    targetCtx.arc(p.x, p.y, (s.width * (p.p || 1)) / 2, 0, Math.PI * 2);
    targetCtx.fillStyle = s.eraser ? "rgba(0,0,0,1)" : s.color;
    targetCtx.fill();
    targetCtx.restore();
    return;
  }
  for (let i = 1; i < s.points.length; i++) {
    const a = s.points[i - 1];
    const b = s.points[i];
    targetCtx.lineWidth = s.width * ((a.p + b.p) / 2 || 1);
    targetCtx.beginPath();
    targetCtx.moveTo(a.x, a.y);
    targetCtx.lineTo(b.x, b.y);
    targetCtx.stroke();
  }
  targetCtx.restore();
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function layoutHandwriting(text, maxWidth, fontSize) {
  ctx.save();
  ctx.font = `${fontSize}px "Klee One", "Hiragino Maru Gothic ProN", system-ui, cursive`;
  const rng = mulberry32(0xc0ffee);
  const lines = [];
  const paragraphs = text.split(/\n/);
  for (const para of paragraphs) {
    let line = { chars: [], width: 0 };
    const charsArr = Array.from(para);
    for (const c of charsArr) {
      const m = ctx.measureText(c);
      const w = m.width;
      if (line.width + w > maxWidth && line.chars.length > 0) {
        lines.push(line);
        line = { chars: [], width: 0 };
      }
      const jitter = {
        dx: (rng() - 0.5) * 1.6,
        dy: (rng() - 0.5) * 1.6,
        rot: (rng() - 0.5) * (Math.PI / 90) * 4,
      };
      line.chars.push({ c, w, jitter });
      line.width += w;
    }
    lines.push(line);
  }
  ctx.restore();
  return lines;
}

function addAnswer(stroke, bb, text, isError) {
  const fontSize = 22;
  const maxWidth = Math.max(160, bb.w + 40);
  const lines = layoutHandwriting(text, maxWidth, fontSize);
  const x = bb.minX;
  const y = bb.maxY + 16;
  state.answers.push({
    ownerStrokeId: stroke.id,
    text,
    lines,
    x,
    y,
    width: maxWidth,
    fontSize,
    error: !!isError,
  });
  redraw();
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => redraw());
}
