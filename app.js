const STORAGE_KEY = "gemini-branch-mindmap:v1";
const SESSIONS_STORAGE = "gemini-branch-mindmap:sessions";
const ACTIVE_SESSION_STORAGE = "gemini-branch-mindmap:active-session";
const KEY_STORAGE = "gemini-branch-mindmap:api-key";
const MODEL_STORAGE = "gemini-branch-mindmap:model";
const DEFAULT_API_KEY = "";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
const NODE_MIN_HEIGHT = 110;
const NODE_COLLAPSED_HEIGHT = NODE_MIN_HEIGHT * 2;
const ANSWER_COLLAPSE_DELAY = 5000;
const CANVAS_SIZE = 24000;
const CANVAS_ORIGIN_X = 11200;
const CANVAS_ORIGIN_Y = 10800;

const state = {
  selectedId: "root",
  zoom: 1,
  mockMode: true,
  tree: createInitialTree(),
  sessions: [],
  activeSessionId: "",
  historyCollapsed: false,
  isPanning: false,
  isNodeDragging: false,
  suppressNextClick: false,
  positioned: [],
  collapsedNodeIds: new Set(),
  pinnedNodeIds: new Set(),
  collapseTimers: new Map(),
  clickSelectTimer: 0,
  hasPositionedViewport: false,
  minimapBounds: null,
};

const els = {
  shell: document.querySelector(".app-shell"),
  historyPanel: document.querySelector("#historyPanel"),
  historyList: document.querySelector("#historyList"),
  toggleHistory: document.querySelector("#toggleHistory"),
  newHistorySession: document.querySelector("#newHistorySession"),
  mindmap: document.querySelector("#mindmap"),
  viewport: document.querySelector("#mindmapViewport"),
  linkLayer: document.querySelector("#linkLayer"),
  minimap: document.querySelector("#canvasMinimap"),
  minimapNodes: document.querySelector("#minimapNodes"),
  minimapViewport: document.querySelector("#minimapViewport"),
  template: document.querySelector("#nodeTemplate"),
  selectedType: document.querySelector("#selectedType"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedMeta: document.querySelector("#selectedMeta"),
  pathList: document.querySelector("#pathList"),
  promptInput: document.querySelector("#promptInput"),
  askButton: document.querySelector("#askButton"),
  statusText: document.querySelector("#statusText"),
  apiKey: document.querySelector("#apiKey"),
  saveKey: document.querySelector("#saveKey"),
  modelSelect: document.querySelector("#modelSelect"),
  toggleMock: document.querySelector("#toggleMock"),
  newTree: document.querySelector("#newTree"),
  seedExample: document.querySelector("#seedExample"),
  exportTree: document.querySelector("#exportTree"),
  importTree: document.querySelector("#importTree"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  resetView: document.querySelector("#resetView"),
};

init();

async function init() {
  bindEvents();
  await loadSessionStore();
  state.selectedId = state.tree.id;
  els.apiKey.value = getStored(KEY_STORAGE) || DEFAULT_API_KEY;
  setModelOptions(FALLBACK_MODELS, getStored(MODEL_STORAGE));
  state.mockMode = !els.apiKey.value;
  render();
  setStatus(state.mockMode ? "未保存 API Key 时会使用本地草稿回答。" : "Gemini 已准备好。");
  if (els.apiKey.value) refreshModels();
}

function bindEvents() {
  els.toggleHistory.addEventListener("click", toggleHistoryPanel);
  els.newHistorySession.addEventListener("click", createNewSession);
  els.askButton.addEventListener("click", handleAsk);
  els.saveKey.addEventListener("click", saveApiKey);
  els.modelSelect.addEventListener("change", () => {
    setStored(MODEL_STORAGE, els.modelSelect.value);
  });
  els.toggleMock.addEventListener("click", () => {
    state.mockMode = !state.mockMode;
    updateMockButton();
    setStatus(state.mockMode ? "已切换到本地草稿模式。" : "已切换到 Gemini API 模式。");
  });
  els.newTree.addEventListener("click", createNewSession);
  els.seedExample.addEventListener("click", seedExample);
  els.exportTree.addEventListener("click", exportTree);
  els.importTree.addEventListener("change", importTree);
  els.zoomIn.addEventListener("click", () => setZoom(state.zoom + 0.08));
  els.zoomOut.addEventListener("click", () => setZoom(state.zoom - 0.08));
  els.resetView.addEventListener("click", resetView);
  els.viewport.addEventListener("mousedown", startPan);
  els.viewport.addEventListener("scroll", renderMinimapViewport, { passive: true });
  els.viewport.addEventListener("wheel", handleWheelZoom, { passive: false });
  els.viewport.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp);
  els.minimap.addEventListener("mousedown", jumpToMinimapPoint);
  els.promptInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      handleAsk();
    }
  });
}

function createInitialTree() {
  return {
    id: "root",
    role: "root",
    text: "Gemini 对话",
    createdAt: Date.now(),
    children: [],
  };
}

async function loadSessionStore() {
  const fallbackTree = loadTree();
  let store = null;

  try {
    const response = await fetch("/api/sessions");
    if (response.ok) store = await response.json();
  } catch {
    store = null;
  }

  if (!store) {
    try {
      store = JSON.parse(getStored(SESSIONS_STORAGE));
    } catch {
      store = null;
    }
  }

  state.sessions = Array.isArray(store?.sessions) ? store.sessions : [];
  state.activeSessionId = store?.activeSessionId || getStored(ACTIVE_SESSION_STORAGE) || "";

  if (!state.sessions.length) {
    const session = createSession(fallbackTree);
    state.sessions = [session];
    state.activeSessionId = session.id;
  }

  const active = state.sessions.find((session) => session.id === state.activeSessionId) || state.sessions[0];
  state.activeSessionId = active.id;
  state.tree = active.tree || createInitialTree();
  shiftLegacyNodePositions(state.tree);
}

function createSession(tree = createInitialTree()) {
  const now = Date.now();
  return {
    id: makeId(),
    title: titleFromTree(tree),
    isTitleCustom: false,
    createdAt: now,
    updatedAt: now,
    tree,
  };
}

function createNewSession() {
  const session = createSession();
  state.sessions.push(session);
  state.activeSessionId = session.id;
  state.tree = session.tree;
  state.selectedId = state.tree.id;
  state.zoom = 1;
  state.hasPositionedViewport = false;
  persist();
  render();
  setStatus("已创建新的历史会话。");
}

function activateSession(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  state.activeSessionId = session.id;
  state.tree = session.tree || createInitialTree();
  shiftLegacyNodePositions(state.tree);
  state.selectedId = state.tree.id;
  state.hasPositionedViewport = false;
  persist(false);
  render();
}

function updateActiveSession() {
  let session = state.sessions.find((item) => item.id === state.activeSessionId);
  if (!session) {
    session = createSession(state.tree);
    state.sessions.unshift(session);
    state.activeSessionId = session.id;
  }
  session.tree = state.tree;
  if (!session.isTitleCustom) session.title = titleFromTree(state.tree);
  session.updatedAt = Date.now();
}

function titleFromTree(tree) {
  const firstQuestion = tree.children?.find((child) => child.role === "user")?.text;
  return truncate(firstQuestion || tree.text || "新的对话", 32);
}

function loadTree() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.id && Array.isArray(saved.children)) return saved;
  } catch {
    removeStored(STORAGE_KEY);
  }
  return createInitialTree();
}

function persist(shouldUpdateActiveSession = true) {
  if (shouldUpdateActiveSession) updateActiveSession();
  setStored(STORAGE_KEY, JSON.stringify(state.tree));
  setStored(ACTIVE_SESSION_STORAGE, state.activeSessionId);
  setStored(SESSIONS_STORAGE, JSON.stringify({ activeSessionId: state.activeSessionId, sessions: state.sessions }));
  saveSessionStore();
}

function saveSessionStore() {
  fetch("/api/sessions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeSessionId: state.activeSessionId, sessions: state.sessions }),
  }).catch(() => {});
}

function render() {
  prepareCollapsedAnswers(state.tree);
  const positioned = layoutTree(state.tree);
  state.positioned = positioned;
  renderNodes(positioned);
  renderLinks(positioned);
  renderMinimap(positioned);
  renderSelection();
  renderHistory();
  updateMockButton();
  ensureViewportPosition();
}

function renderHistory() {
  els.shell.classList.toggle("history-collapsed", state.historyCollapsed);
  els.historyList.innerHTML = "";
  if (!state.sessions.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "还没有历史对话。";
    els.historyList.appendChild(empty);
    return;
  }

  state.sessions.forEach((session) => {
    const item = document.createElement("button");
    item.className = `history-item${session.id === state.activeSessionId ? " active" : ""}`;
    if (session.id === state.dragHistorySessionId) item.classList.add("dragging");
    item.type = "button";
    item.draggable = true;
    item.dataset.sessionId = session.id;
    item.innerHTML = `
      <span class="history-item-title">${escapeHTML(session.title || "新的对话")}</span>
      <span class="history-item-meta">${formatTime(session.updatedAt)} · ${countNodes(session.tree)} 节点</span>
    `;
    const main = document.createElement("span");
    main.className = "history-item-main";
    while (item.firstChild) main.appendChild(item.firstChild);
    item.appendChild(main);
    const actions = document.createElement("span");
    actions.className = "history-item-actions";
    actions.setAttribute("aria-label", "会话操作");
    actions.innerHTML = `
      <span class="history-action" role="button" tabindex="0" data-action="rename" title="重命名会话" aria-label="重命名会话">✎</span>
      <span class="history-action danger" role="button" tabindex="0" data-action="delete" title="删除会话" aria-label="删除会话">×</span>
    `;
    item.appendChild(actions);
    item.addEventListener("click", (event) => {
      const action = getHistoryAction(event.target);
      if (action === "rename") {
        renameSession(session.id);
        return;
      }
      if (action === "delete") {
        deleteSession(session.id);
        return;
      }
      activateSession(session.id);
    });
    item.addEventListener("keydown", (event) => {
      const action = getHistoryAction(event.target);
      if (!action || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      if (action === "rename") renameSession(session.id);
      if (action === "delete") deleteSession(session.id);
    });
    item.addEventListener("dragstart", (event) => startHistoryDrag(event, session.id));
    item.addEventListener("dragover", (event) => dragOverHistory(event, session.id));
    item.addEventListener("drop", (event) => dropHistorySession(event, session.id));
    item.addEventListener("dragend", clearHistoryDragState);
    els.historyList.appendChild(item);
  });
}

function getHistoryAction(target) {
  if (!(target instanceof Element)) return "";
  return target.closest("[data-action]")?.dataset.action || "";
}

function renameSession(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const nextTitle = prompt("重命名这个会话", session.title || titleFromTree(session.tree));
  if (nextTitle === null) return;
  const cleanTitle = nextTitle.trim();
  if (!cleanTitle) {
    setStatus("会话名称没有修改。");
    return;
  }
  session.title = truncate(cleanTitle, 48);
  session.isTitleCustom = true;
  session.updatedAt = Date.now();
  persist(false);
  renderHistory();
  setStatus("会话已重命名。");
}

function deleteSession(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (!confirm(`删除“${session.title || "这个会话"}”？`)) return;

  state.sessions = state.sessions.filter((item) => item.id !== sessionId);
  if (!state.sessions.length) {
    const replacement = createSession();
    state.sessions = [replacement];
    state.activeSessionId = replacement.id;
    state.tree = replacement.tree;
  } else if (state.activeSessionId === sessionId) {
    const nextSession = state.sessions[0];
    state.activeSessionId = nextSession.id;
    state.tree = nextSession.tree || createInitialTree();
    shiftLegacyNodePositions(state.tree);
  }
  state.selectedId = state.tree.id;
  state.hasPositionedViewport = false;
  persist(false);
  render();
  setStatus("会话已删除。");
}

function startHistoryDrag(event, sessionId) {
  if (getHistoryAction(event.target)) {
    event.preventDefault();
    return;
  }
  state.dragHistorySessionId = sessionId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", sessionId);
  event.currentTarget.classList.add("dragging");
}

function dragOverHistory(event, sessionId) {
  if (!state.dragHistorySessionId || state.dragHistorySessionId === sessionId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  moveHistorySessionDuringDrag(event, sessionId);
}

function dropHistorySession(event, targetSessionId) {
  event.preventDefault();
  const sourceSessionId = state.dragHistorySessionId || event.dataTransfer.getData("text/plain");
  if (sourceSessionId && sourceSessionId !== targetSessionId) moveHistorySessionDuringDrag(event, targetSessionId);
  clearHistoryDragState();
  persist(false);
  renderHistory();
  setStatus("历史顺序已更新。");
}

function moveHistorySessionDuringDrag(event, targetSessionId) {
  const sourceSessionId = state.dragHistorySessionId;
  const sourceIndex = state.sessions.findIndex((session) => session.id === sourceSessionId);
  const targetIndex = state.sessions.findIndex((session) => session.id === targetSessionId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const shouldPlaceAfter = event.clientY > rect.top + rect.height / 2;
  const beforeRects = getHistoryItemRects();
  const [movedSession] = state.sessions.splice(sourceIndex, 1);
  const nextTargetIndex = state.sessions.findIndex((session) => session.id === targetSessionId);
  const insertIndex = nextTargetIndex + (shouldPlaceAfter ? 1 : 0);
  if (sourceIndex === insertIndex) {
    state.sessions.splice(sourceIndex, 0, movedSession);
    return;
  }
  state.sessions.splice(insertIndex, 0, movedSession);
  renderHistory();
  animateHistoryReorder(beforeRects);
}

function clearHistoryDragState() {
  state.dragHistorySessionId = "";
  els.historyList.querySelectorAll(".history-item").forEach((item) => {
    item.classList.remove("dragging");
  });
}

function getHistoryItemRects() {
  return new Map([...els.historyList.querySelectorAll(".history-item")].map((item) => [
    item.dataset.sessionId,
    item.getBoundingClientRect(),
  ]));
}

function animateHistoryReorder(beforeRects) {
  els.historyList.querySelectorAll(".history-item").forEach((item) => {
    const before = beforeRects.get(item.dataset.sessionId);
    if (!before) return;
    const after = item.getBoundingClientRect();
    const dy = before.top - after.top;
    if (!dy) return;
    item.animate([
      { transform: `translateY(${dy}px)` },
      { transform: "translateY(0)" },
    ], {
      duration: 180,
      easing: "cubic-bezier(.2, .8, .2, 1)",
    });
  });
}

function toggleHistoryPanel() {
  state.historyCollapsed = !state.historyCollapsed;
  renderHistory();
}

function layoutTree(root) {
  const all = [];
  const nodeWidth = 252;
  const levelGap = 118;
  const siblingGap = 26;
  const topInset = 46;

  measure(root, 0, null);
  place(root, 0, topInset);

  els.mindmap.style.width = `${CANVAS_SIZE}px`;
  els.mindmap.style.height = `${CANVAS_SIZE}px`;
  els.linkLayer.setAttribute("width", CANVAS_SIZE);
  els.linkLayer.setAttribute("height", CANVAS_SIZE);
  els.linkLayer.style.width = `${CANVAS_SIZE}px`;
  els.linkLayer.style.height = `${CANVAS_SIZE}px`;
  return all;

  function measure(node, depth, parentId) {
    const height = getNodeDisplayHeight(node);
    const entry = { node, depth, parentId, x: 0, y: 0, height, subtreeHeight: height };
    all.push(entry);
    const childHeights = node.children.map((child) => measure(child, depth + 1, node.id));
    if (childHeights.length) {
      entry.subtreeHeight = Math.max(height, childHeights.reduce((sum, value) => sum + value, 0) + siblingGap * (childHeights.length - 1));
    }
    return entry.subtreeHeight;
  }

  function place(node, depth, top) {
    const entry = all.find((item) => item.node.id === node.id);
    const baseX = CANVAS_ORIGIN_X + depth * (nodeWidth + levelGap);
    const baseY = CANVAS_ORIGIN_Y + top + (entry.subtreeHeight - entry.height) / 2;
    entry.x = Number.isFinite(node.x) ? node.x : baseX;
    entry.y = Number.isFinite(node.y) ? node.y : baseY;

    let childTop = top;
    for (const child of node.children) {
      const childEntry = all.find((item) => item.node.id === child.id);
      place(child, depth + 1, childTop);
      childTop += childEntry.subtreeHeight + siblingGap;
    }
  }
}

function renderNodes(positioned) {
  els.mindmap.replaceChildren(els.linkLayer);
  positioned.forEach(({ node, x, y }) => {
    const fragment = els.template.content.cloneNode(true);
    const card = fragment.querySelector(".node-card");
    const fullHeight = estimateNodeHeight(node.text);
    const displayHeight = getNodeDisplayHeight(node);
    const isCollapsed = isNodeCollapsed(node);
    card.classList.add(node.role);
    if (node.id === state.selectedId) card.classList.add("selected");
    if (isCollapsed) card.classList.add("collapsed");
    if (node.loading) card.classList.add("loading");
    card.dataset.id = node.id;
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.setProperty("--node-full-height", `${Math.round(fullHeight)}px`);
    card.style.setProperty("--node-display-height", `${Math.round(displayHeight)}px`);
    card.querySelector(".node-role").textContent = roleLabel(node.role);
    card.querySelector(".node-count").textContent = `${node.children.length} 分支`;
    card.querySelector(".node-text").textContent = node.text;
    card.addEventListener("mousedown", (event) => startNodeDrag(event, node, card));
    card.addEventListener("click", (event) => {
      if (state.suppressNextClick) {
        state.suppressNextClick = false;
        return;
      }
      if (event.detail >= 2) {
        cancelPendingSelection();
        toggleNodePinned(node.id);
        state.selectedId = node.id;
        render();
        return;
      }
      if (state.clickSelectTimer) clearTimeout(state.clickSelectTimer);
      state.clickSelectTimer = setTimeout(() => {
        state.clickSelectTimer = 0;
        state.selectedId = node.id;
        render();
      }, 320);
    });
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      cancelPendingSelection();
    });
    els.mindmap.appendChild(fragment);
  });
  applyZoom();
}

function renderLinks(positioned) {
  const byId = new Map(positioned.map((entry) => [entry.node.id, entry]));
  els.linkLayer.innerHTML = "";
  positioned.forEach((entry) => {
    if (!entry.parentId) return;
    const parent = byId.get(entry.parentId);
    const startX = parent.x + 252;
    const startY = parent.y + parent.height / 2;
    const endX = entry.x;
    const endY = entry.y + entry.height / 2;
    const mid = startX + (endX - startX) * 0.5;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "link-path");
    path.setAttribute("d", `M ${startX} ${startY} C ${mid} ${startY}, ${mid} ${endY}, ${endX} ${endY}`);
    els.linkLayer.appendChild(path);
  });
}

function renderMinimap(positioned) {
  state.minimapBounds = getMinimapBounds(positioned);
  const fragment = document.createDocumentFragment();
  positioned.forEach((entry) => {
    const block = document.createElement("span");
    block.className = `minimap-node ${entry.node.role}${entry.node.id === state.selectedId ? " selected" : ""}`;
    const topLeft = toMinimapPercent(entry.x, entry.y);
    const bottomRight = toMinimapPercent(entry.x + 252, entry.y + entry.height);
    block.style.left = `${topLeft.x}%`;
    block.style.top = `${topLeft.y}%`;
    block.style.width = `${clamp(bottomRight.x - topLeft.x, 3, 100)}%`;
    block.style.height = `${clamp(bottomRight.y - topLeft.y, 3, 100)}%`;
    fragment.appendChild(block);
  });
  els.minimapNodes.replaceChildren(fragment);
  renderMinimapViewport();
}

function renderMinimapViewport() {
  if (!els.minimapViewport || !state.minimapBounds) return;
  const viewportLeft = els.viewport.scrollLeft / state.zoom;
  const viewportTop = els.viewport.scrollTop / state.zoom;
  const topLeft = toMinimapPercent(viewportLeft, viewportTop);
  const bottomRight = toMinimapPercent(
    viewportLeft + els.viewport.clientWidth / state.zoom,
    viewportTop + els.viewport.clientHeight / state.zoom,
  );
  const left = clamp(Math.min(topLeft.x, bottomRight.x), 0, 100);
  const top = clamp(Math.min(topLeft.y, bottomRight.y), 0, 100);
  const width = clamp(Math.abs(bottomRight.x - topLeft.x), 4, 100 - left);
  const height = clamp(Math.abs(bottomRight.y - topLeft.y), 4, 100 - top);
  els.minimapViewport.style.left = `${left}%`;
  els.minimapViewport.style.top = `${top}%`;
  els.minimapViewport.style.width = `${width}%`;
  els.minimapViewport.style.height = `${height}%`;
}

function getMinimapBounds(positioned) {
  if (!positioned.length) {
    return { minX: CANVAS_ORIGIN_X - 400, minY: CANVAS_ORIGIN_Y - 400, width: 800, height: 800 };
  }
  const padding = 220;
  const minX = Math.min(...positioned.map((entry) => entry.x)) - padding;
  const minY = Math.min(...positioned.map((entry) => entry.y)) - padding;
  const maxX = Math.max(...positioned.map((entry) => entry.x + 252)) + padding;
  const maxY = Math.max(...positioned.map((entry) => entry.y + entry.height)) + padding;
  return {
    minX,
    minY,
    width: Math.max(640, maxX - minX),
    height: Math.max(640, maxY - minY),
  };
}

function toMinimapPercent(canvasX, canvasY) {
  const bounds = state.minimapBounds || getMinimapBounds(state.positioned);
  return {
    x: clamp(((canvasX - bounds.minX) / bounds.width) * 100, 0, 100),
    y: clamp(((canvasY - bounds.minY) / bounds.height) * 100, 0, 100),
  };
}

function fromMinimapPercent(percentX, percentY) {
  const bounds = state.minimapBounds || getMinimapBounds(state.positioned);
  return {
    x: bounds.minX + bounds.width * percentX,
    y: bounds.minY + bounds.height * percentY,
  };
}

function renderSelection() {
  const node = findNode(state.tree, state.selectedId) || state.tree;
  const path = getPath(state.tree, node.id);
  els.selectedType.textContent = roleLabel(node.role);
  els.selectedTitle.textContent = truncate(node.text, 54);
  els.selectedMeta.textContent = node.role === "model"
    ? "从这个回答继续追问，会在它下面创建一个新的问题和回答分支。"
    : "也可以从问题节点继续发散，适合补充约束或换一个方向问。";
  els.pathList.innerHTML = "";
  path.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${roleLabel(item.role)}</strong>${escapeHTML(truncate(item.text, 120))}`;
    els.pathList.appendChild(li);
  });
}

async function handleAsk() {
  const question = els.promptInput.value.trim();
  if (!question) {
    setStatus("先写一个问题，再让分支长出来。");
    els.promptInput.focus();
    return;
  }

  const parent = findNode(state.tree, state.selectedId) || state.tree;
  const questionNode = {
    id: makeId(),
    role: "user",
    text: question,
    createdAt: Date.now(),
    children: [],
  };
  const answerNode = {
    id: makeId(),
    role: "model",
    text: "Gemini 正在思考...",
    createdAt: Date.now(),
    loading: true,
    children: [],
  };

  questionNode.children.push(answerNode);
  parent.children.push(questionNode);
  state.selectedId = answerNode.id;
  els.promptInput.value = "";
  persist();
  render();
  setBusy(true);
  setStatus("正在生成回答...");

  try {
    const context = getPath(state.tree, parent.id).concat(questionNode);
    const answer = state.mockMode ? await makeLocalDraft(question, context) : await askGemini(question, context);
    answerNode.text = answer;
    answerNode.loading = false;
    scheduleAnswerCollapse(answerNode.id);
    setStatus(state.mockMode ? "本地草稿已生成，可继续分叉追问。" : "Gemini 回答已加入脑图。");
  } catch (error) {
    answerNode.text = `请求失败：${error.message}`;
    answerNode.loading = false;
    setStatus("请求失败，已把错误信息保留在节点里。");
  } finally {
    setBusy(false);
    persist();
    render();
  }
}

async function askGemini(question, context) {
  const apiKey = els.apiKey.value.trim() || getStored(KEY_STORAGE);
  if (!apiKey) {
    throw new Error("缺少 Gemini API Key，或切换到本地草稿模式。");
  }
  const model = els.modelSelect.value;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = context
    .filter((item) => item.role !== "root")
    .map((item) => ({
      role: item.role === "model" ? "model" : "user",
      parts: [{ text: item.text }],
    }));

  if (!contents.length || contents.at(-1).parts[0].text !== question) {
    contents.push({ role: "user", parts: [{ text: question }] });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1400,
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini API ${response.status}`);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n").trim();
  if (!text) throw new Error("Gemini 没有返回文本。");
  return text;
}

async function makeLocalDraft(question, context) {
  await new Promise((resolve) => setTimeout(resolve, 520));
  const parent = context.at(-2);
  const angle = parent && parent.role !== "root" ? `我会沿着「${truncate(parent.text, 30)}」这个分支继续。` : "这是这棵对话树的第一条分支。";
  return `${angle}\n\n针对「${question}」，可以先拆成三个方向：\n1. 明确目标和约束，避免问题继续发散。\n2. 列出可执行方案，并把每个方案挂成独立分支。\n3. 选中最有价值的回答节点继续追问细节。\n\n保存 Gemini API Key 后，这里会替换为真实 Gemini 回答。`;
}

function saveApiKey() {
  const key = els.apiKey.value.trim();
  if (!key) {
    removeStored(KEY_STORAGE);
    state.mockMode = true;
    updateMockButton();
    setStatus("已清空 API Key，并切换到本地草稿模式。");
    return;
  }
  setStored(KEY_STORAGE, key);
  state.mockMode = false;
  updateMockButton();
  setStatus("API Key 已保存在本机浏览器。");
  refreshModels();
}

function updateMockButton() {
  els.toggleMock.setAttribute("aria-pressed", String(state.mockMode));
  els.toggleMock.textContent = state.mockMode ? "本地草稿开" : "Gemini API";
  els.askButton.textContent = state.mockMode ? "生成本地草稿" : "发送到 Gemini";
}

async function refreshModels() {
  const apiKey = els.apiKey.value.trim() || getStored(KEY_STORAGE);
  if (!apiKey) return;
  const previous = els.modelSelect.value || getStored(MODEL_STORAGE);
  els.modelSelect.disabled = true;
  setStatus("正在检查这个 API Key 可用的 Gemini 模型...");

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `Gemini API ${response.status}`);

    const models = (data.models || [])
      .filter((model) => (model.supportedGenerationMethods || []).includes("generateContent"))
      .map((model) => model.name.replace(/^models\//, ""))
      .filter((name) => name.startsWith("gemini-"))
      .filter((name) => !/(embedding|aqa|tts|image|vision|robotics|computer-use|customtools)/i.test(name));

    if (!models.length) throw new Error("没有找到支持文本对话的 generateContent 模型。");
    setModelOptions(sortModels([...new Set(models)]), previous);
    setStored(MODEL_STORAGE, els.modelSelect.value);
    setStatus(`已加载 ${models.length} 个可用模型。`);
  } catch (error) {
    setModelOptions(FALLBACK_MODELS, previous);
    setStatus(`模型列表刷新失败：${error.message}`);
  } finally {
    els.modelSelect.disabled = false;
  }
}

function setModelOptions(models, selectedModel) {
  const selection = models.includes(selectedModel) ? selectedModel : models[0];
  els.modelSelect.replaceChildren(...models.map((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    return option;
  }));
  els.modelSelect.value = selection;
}

function sortModels(models) {
  const rank = (name) => {
    if (name.includes("3.1-pro")) return 0;
    if (name.includes("3.1-flash")) return 1;
    if (name.includes("3-pro")) return 2;
    if (name.includes("3-flash")) return 3;
    if (name.includes("2.5-flash") && !name.includes("lite")) return 4;
    if (name.includes("2.5-pro")) return 5;
    if (name.includes("2.5-flash-lite")) return 6;
    if (name.includes("2.0-flash")) return 7;
    return 10;
  };
  return models.sort((a, b) => rank(a) - rank(b) || b.localeCompare(a));
}

function resetTree() {
  state.tree = createInitialTree();
  state.selectedId = state.tree.id;
  state.hasPositionedViewport = false;
  persist();
  render();
  setStatus("已经开启一棵新的对话树。");
}

function seedExample() {
  state.tree = {
    id: "root",
    role: "root",
    text: "Gemini 对话",
    createdAt: Date.now(),
    children: [
      branch("如何设计一个分支式 Gemini 对话工具？", "核心是把每一次追问绑定到被点击的回答节点，而不是只追加到线性聊天末尾。界面上用树状布局展示上下文路径，数据上用 children 数组保存分支。", [
        branch("如果分支很多，怎么保持可读？", "可以使用缩放、当前路径高亮、折叠非活跃分支、以及按主题给节点加标签。"),
        branch("真实 API 应该怎样接入？", "前端可以用用户自己的 Gemini API Key 直接请求生成接口；生产环境更推荐放到后端代理，避免 Key 暴露。"),
      ]),
      branch("怎样导入已有 Gemini 对话？", "最稳妥的第一版是支持 JSON 导入；后续可以增加粘贴文本解析，把问答自动切成节点。"),
    ],
  };
  state.selectedId = state.tree.children[0].children[0].id;
  state.hasPositionedViewport = false;
  persist();
  render();
  setStatus("示例树已载入，可以点击任意回答继续发散。");
}

function branch(question, answer, children = []) {
  const questionNode = {
    id: makeId(),
    role: "user",
    text: question,
    createdAt: Date.now(),
    children: [],
  };
  const answerNode = {
    id: makeId(),
    role: "model",
    text: answer,
    createdAt: Date.now(),
    children,
  };
  questionNode.children.push(answerNode);
  return questionNode;
}

function exportTree() {
  const blob = new Blob([JSON.stringify(state.tree, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gemini-branches-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("对话树 JSON 已导出。");
}

function importTree(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.id || !Array.isArray(imported.children)) throw new Error("JSON 结构不符合对话树格式。");
      state.tree = imported;
      shiftLegacyNodePositions(state.tree);
      state.selectedId = imported.id;
      state.hasPositionedViewport = false;
      persist();
      render();
      setStatus("对话树已导入。");
    } catch (error) {
      setStatus(`导入失败：${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function setZoom(nextZoom) {
  state.zoom = Math.min(1.6, Math.max(0.42, nextZoom));
  applyZoom();
}

function resetView() {
  state.zoom = 1;
  applyZoom();
  scrollToCanvasOrigin("smooth");
}

function applyZoom() {
  const transform = `scale(${state.zoom})`;
  els.mindmap.style.transform = transform;
  renderMinimapViewport();
}

function ensureViewportPosition() {
  if (state.hasPositionedViewport) return;
  state.hasPositionedViewport = true;
  requestAnimationFrame(() => scrollToCanvasOrigin("auto"));
}

function scrollToCanvasOrigin(behavior = "auto") {
  els.viewport.scrollTo({
    left: Math.max(0, CANVAS_ORIGIN_X * state.zoom - 120),
    top: Math.max(0, CANVAS_ORIGIN_Y * state.zoom - 170),
    behavior,
  });
  requestAnimationFrame(renderMinimapViewport);
}

function jumpToMinimapPoint(event) {
  event.preventDefault();
  const rect = els.minimap.getBoundingClientRect();
  const target = fromMinimapPercent(
    clamp((event.clientX - rect.left) / rect.width, 0, 1),
    clamp((event.clientY - rect.top) / rect.height, 0, 1),
  );
  els.viewport.scrollTo({
    left: clamp(target.x * state.zoom - els.viewport.clientWidth / 2, 0, CANVAS_SIZE * state.zoom),
    top: clamp(target.y * state.zoom - els.viewport.clientHeight / 2, 0, CANVAS_SIZE * state.zoom),
    behavior: "smooth",
  });
}

function startPan(event) {
  if (event.target.closest(".node-card")) return;
  if (event.button !== 0 && event.button !== 1) return;
  event.preventDefault();
  state.isPanning = true;
  state.panStartX = event.clientX;
  state.panStartY = event.clientY;
  state.panStartLeft = els.viewport.scrollLeft;
  state.panStartTop = els.viewport.scrollTop;
  els.viewport.classList.add("dragging");
}

function handlePointerMove(event) {
  if (state.isNodeDragging) {
    dragNode(event);
    return;
  }
  panCanvas(event);
}

function panCanvas(event) {
  if (!state.isPanning) return;
  event.preventDefault();
  els.viewport.scrollLeft = state.panStartLeft - (event.clientX - state.panStartX);
  els.viewport.scrollTop = state.panStartTop - (event.clientY - state.panStartY);
  renderMinimapViewport();
}

function handlePointerUp() {
  stopNodeDrag();
  stopPan();
}

function stopPan() {
  if (!state.isPanning) return;
  state.isPanning = false;
  els.viewport.classList.remove("dragging");
}

function startNodeDrag(event, node, card) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const entry = state.positioned.find((item) => item.node.id === node.id);
  state.isNodeDragging = true;
  state.dragNode = node;
  state.dragCard = card;
  state.dragStartX = event.clientX;
  state.dragStartY = event.clientY;
  state.dragNodeStartX = entry?.x ?? node.x ?? 0;
  state.dragNodeStartY = entry?.y ?? node.y ?? 0;
  state.dragMoved = false;
  card.classList.add("dragging");
}

function dragNode(event) {
  event.preventDefault();
  const dx = (event.clientX - state.dragStartX) / state.zoom;
  const dy = (event.clientY - state.dragStartY) / state.zoom;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.dragMoved = true;
  state.dragNode.x = clamp(state.dragNodeStartX + dx, 0, CANVAS_SIZE - 320);
  state.dragNode.y = clamp(state.dragNodeStartY + dy, 0, CANVAS_SIZE - 320);
  state.dragCard.style.left = `${state.dragNode.x}px`;
  state.dragCard.style.top = `${state.dragNode.y}px`;
  const entry = state.positioned.find((item) => item.node.id === state.dragNode.id);
  if (entry) {
    entry.x = state.dragNode.x;
    entry.y = state.dragNode.y;
    renderLinks(state.positioned);
    renderMinimap(state.positioned);
  }
}

function stopNodeDrag() {
  if (!state.isNodeDragging) return;
  state.dragCard?.classList.remove("dragging");
  state.isNodeDragging = false;
  state.suppressNextClick = state.dragMoved;
  persist();
}

function handleWheelZoom(event) {
  event.preventDefault();
  const oldZoom = state.zoom;
  const direction = event.deltaY > 0 ? -1 : 1;
  const nextZoom = Math.min(1.6, Math.max(0.42, oldZoom + direction * 0.08));
  if (nextZoom === oldZoom) return;

  const rect = els.viewport.getBoundingClientRect();
  const beforeX = (els.viewport.scrollLeft + event.clientX - rect.left) / oldZoom;
  const beforeY = (els.viewport.scrollTop + event.clientY - rect.top) / oldZoom;
  state.zoom = nextZoom;
  applyZoom();
  els.viewport.scrollLeft = beforeX * nextZoom - (event.clientX - rect.left);
  els.viewport.scrollTop = beforeY * nextZoom - (event.clientY - rect.top);
  renderMinimapViewport();
}

function estimateNodeHeight(text) {
  const plain = String(text || "");
  const lineCount = plain.split("\n").reduce((sum, line) => {
    const weightedLength = [...line].reduce((count, char) => count + (char.charCodeAt(0) > 255 ? 1.75 : 1), 0);
    return sum + Math.max(1, Math.ceil(weightedLength / 24));
  }, 0);
  return Math.max(NODE_MIN_HEIGHT, 70 + lineCount * 22);
}

function getNodeDisplayHeight(node) {
  const fullHeight = estimateNodeHeight(node.text);
  return isNodeCollapsed(node) ? Math.min(fullHeight, NODE_COLLAPSED_HEIGHT) : fullHeight;
}

function isNodeCollapsed(node) {
  if (!node || node.loading) return false;
  if (state.pinnedNodeIds.has(node.id)) return false;
  return state.collapsedNodeIds.has(node.id) && estimateNodeHeight(node.text) > NODE_COLLAPSED_HEIGHT;
}

function scheduleAnswerCollapse(nodeId) {
  state.collapsedNodeIds.delete(nodeId);
  if (state.collapseTimers.has(nodeId)) clearTimeout(state.collapseTimers.get(nodeId));
  const timer = setTimeout(() => {
    state.collapseTimers.delete(nodeId);
    if (state.pinnedNodeIds.has(nodeId)) return;
    state.collapsedNodeIds.add(nodeId);
    render();
  }, ANSWER_COLLAPSE_DELAY);
  state.collapseTimers.set(nodeId, timer);
}

function pinNodeOpen(nodeId) {
  state.pinnedNodeIds.add(nodeId);
  state.collapsedNodeIds.delete(nodeId);
  if (state.collapseTimers.has(nodeId)) {
    clearTimeout(state.collapseTimers.get(nodeId));
    state.collapseTimers.delete(nodeId);
  }
}

function toggleNodePinned(nodeId) {
  if (state.pinnedNodeIds.has(nodeId)) {
    state.pinnedNodeIds.delete(nodeId);
    const node = findNode(state.tree, nodeId);
    if (node && estimateNodeHeight(node.text) > NODE_COLLAPSED_HEIGHT) {
      state.collapsedNodeIds.add(nodeId);
    }
    return;
  }
  pinNodeOpen(nodeId);
}

function cancelPendingSelection() {
  if (!state.clickSelectTimer) return;
  clearTimeout(state.clickSelectTimer);
  state.clickSelectTimer = 0;
}

function prepareCollapsedAnswers(node) {
  if (!node) return;
  if (
    node.role === "model" &&
    !node.loading &&
    !state.pinnedNodeIds.has(node.id) &&
    !state.collapseTimers.has(node.id) &&
    estimateNodeHeight(node.text) > NODE_COLLAPSED_HEIGHT
  ) {
    state.collapsedNodeIds.add(node.id);
  }
  (node.children || []).forEach(prepareCollapsedAnswers);
}

function shiftLegacyNodePositions(node) {
  if (!node) return;
  if (Number.isFinite(node.x) && node.x < CANVAS_ORIGIN_X / 2) {
    node.x += CANVAS_ORIGIN_X;
  }
  if (Number.isFinite(node.y) && node.y < CANVAS_ORIGIN_Y / 2) {
    node.y += CANVAS_ORIGIN_Y;
  }
  (node.children || []).forEach(shiftLegacyNodePositions);
}

function setBusy(isBusy) {
  els.askButton.disabled = isBusy;
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function roleLabel(role) {
  return {
    root: "ROOT",
    user: "QUESTION",
    model: "GEMINI",
  }[role] || role.toUpperCase();
}

function findNode(node, id) {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function getPath(root, id, trail = []) {
  const nextTrail = trail.concat(root);
  if (root.id === id) return nextTrail;
  for (const child of root.children) {
    const found = getPath(child, id, nextTrail);
    if (found.length) return found;
  }
  return [];
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function countNodes(node) {
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}

function formatTime(timestamp) {
  if (!timestamp) return "刚刚";
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return "";
  }
}

function setStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}

function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    return false;
  }
  return true;
}
