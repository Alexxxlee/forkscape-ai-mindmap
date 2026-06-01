const STORAGE_KEY = "gemini-branch-mindmap:v1";
const SESSIONS_STORAGE = "gemini-branch-mindmap:sessions";
const ACTIVE_SESSION_STORAGE = "gemini-branch-mindmap:active-session";
const KEY_STORAGE = "gemini-branch-mindmap:api-key";
const MODEL_STORAGE = "gemini-branch-mindmap:model";
const DEFAULT_API_KEY = "";
const COMMON_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
];
const FALLBACK_MODELS = COMMON_MODELS;
const NODE_MIN_HEIGHT = 110;
const NODE_COLLAPSED_HEIGHT = NODE_MIN_HEIGHT * 2;
const ANSWER_COLLAPSE_DELAY = 5000;
const CANVAS_SIZE = 24000;
const CANVAS_ORIGIN_X = 11200;
const CANVAS_ORIGIN_Y = 10800;
const MIN_ZOOM = 0.42;
const OVERVIEW_MIN_ZOOM = 0.22;
const MAX_ZOOM = 1.6;

const state = {
  selectedId: "root",
  zoom: 1,
  mockMode: true,
  tree: createInitialTree(),
  sessions: [],
  activeSessionId: "",
  historyCollapsed: false,
  historySearchQuery: "",
  isPanning: false,
  isNodeDragging: false,
  suppressNextClick: false,
  positioned: [],
  collapsedNodeIds: new Set(),
  collapsedBranchIds: new Set(),
  pinnedNodeIds: new Set(),
  collapseTimers: new Map(),
  clickSelectTimer: 0,
  multiClickTimer: 0,
  hasPositionedViewport: false,
  minimapBounds: null,
  selectedGroupRootId: "",
  selectedGroupIds: new Set(),
  lastSpacePress: 0,
  lastMiddlePress: 0,
  blankPointerDown: false,
  panMoved: false,
};

const els = {
  shell: document.querySelector(".app-shell"),
  historyPanel: document.querySelector("#historyPanel"),
  historyList: document.querySelector("#historyList"),
  toggleHistory: document.querySelector("#toggleHistory"),
  newHistorySession: document.querySelector("#newHistorySession"),
  historySearch: document.querySelector("#historySearch"),
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
  exportMarkdown: document.querySelector("#exportMarkdown"),
  exportPng: document.querySelector("#exportPng"),
  exportSvg: document.querySelector("#exportSvg"),
  exportMermaid: document.querySelector("#exportMermaid"),
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
  els.historySearch.addEventListener("input", () => {
    state.historySearchQuery = els.historySearch.value.trim();
    renderHistory();
  });
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
  els.exportMarkdown.addEventListener("click", exportMarkdown);
  els.exportPng.addEventListener("click", exportPng);
  els.exportSvg.addEventListener("click", exportSvg);
  els.exportMermaid.addEventListener("click", exportMermaid);
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
  window.addEventListener("keydown", handleGlobalKeydown);
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
  resetBranchViewState();
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
  resetBranchViewState();
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
  if (els.historySearch.value !== state.historySearchQuery) {
    els.historySearch.value = state.historySearchQuery;
  }
  els.historyList.innerHTML = "";
  if (!state.sessions.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "还没有历史对话。";
    els.historyList.appendChild(empty);
    return;
  }

  const visibleSessions = state.sessions.filter(sessionMatchesHistorySearch);
  if (!visibleSessions.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "没有匹配的历史对话。";
    els.historyList.appendChild(empty);
    return;
  }

  visibleSessions.forEach((session) => {
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

function sessionMatchesHistorySearch(session) {
  const query = state.historySearchQuery.trim().toLowerCase();
  if (!query) return true;
  const searchable = [
    session.title || "",
    formatTime(session.updatedAt),
    collectNodeText(session.tree),
  ].join(" ").toLowerCase();
  return searchable.includes(query);
}

function collectNodeText(node) {
  if (!node) return "";
  return [node.text || "", ...(node.children || []).map(collectNodeText)].join(" ");
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
  const siblingGap = 34;
  const topInset = 46;

  measure(root, 0, null);
  place(root, 0, topInset);
  resolveNodeOverlaps(all, nodeWidth, siblingGap);

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
    const childHeights = getVisibleChildren(node).map((child) => measure(child, depth + 1, node.id));
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
    for (const child of getVisibleChildren(node)) {
      const childEntry = all.find((item) => item.node.id === child.id);
      place(child, depth + 1, childTop);
      childTop += childEntry.subtreeHeight + siblingGap;
    }
  }
}

function resolveNodeOverlaps(entries, nodeWidth, gap) {
  const sorted = [...entries].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i < sorted.length; i += 1) {
    const entry = sorted[i];
    let nextY = entry.y;
    for (let j = 0; j < i; j += 1) {
      const other = sorted[j];
      const overlapsX = entry.x < other.x + nodeWidth + gap && entry.x + nodeWidth + gap > other.x;
      const overlapsY = nextY < other.y + other.height + gap && nextY + entry.height + gap > other.y;
      if (overlapsX && overlapsY) nextY = other.y + other.height + gap;
    }
    if (nextY !== entry.y) {
      entry.y = nextY;
      if (Number.isFinite(entry.node.y)) entry.node.y = nextY;
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
    const isBranchCollapsed = state.collapsedBranchIds.has(node.id);
    card.classList.add(node.role);
    if (node.id === state.selectedId) card.classList.add("selected");
    if (state.selectedGroupIds.has(node.id)) card.classList.add("group-selected");
    if (isCollapsed) card.classList.add("collapsed");
    if (isBranchCollapsed) card.classList.add("branch-collapsed");
    if (node.loading) card.classList.add("loading");
    card.dataset.id = node.id;
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.setProperty("--node-full-height", `${Math.round(fullHeight)}px`);
    card.style.setProperty("--node-display-height", `${Math.round(displayHeight)}px`);
    card.querySelector(".node-role").textContent = roleLabel(node.role);
    const count = card.querySelector(".node-count");
    count.textContent = isBranchCollapsed ? `已收起 ${node.children.length} 分支` : `${node.children.length} 分支`;
    card.querySelector(".node-text").textContent = node.text;
    if (node.children.length) {
      const toggle = document.createElement("button");
      toggle.className = "branch-toggle";
      toggle.type = "button";
      toggle.textContent = isBranchCollapsed ? "展开" : "收起";
      toggle.title = isBranchCollapsed ? "展开后续分支" : "收起后续分支";
      toggle.setAttribute("aria-label", isBranchCollapsed ? "展开后续分支" : "收起后续分支");
      toggle.setAttribute("aria-expanded", String(!isBranchCollapsed));
      toggle.addEventListener("mousedown", (event) => event.stopPropagation());
      toggle.addEventListener("dblclick", (event) => event.stopPropagation());
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleBranch(node.id);
      });
      count.insertAdjacentElement("afterend", toggle);
    }
    card.addEventListener("mousedown", (event) => startNodeDrag(event, node, card));
    card.addEventListener("click", (event) => {
      if (state.suppressNextClick) {
        state.suppressNextClick = false;
        return;
      }
      if (event.detail >= 3) {
        cancelPendingNodeClicks();
        selectNodeGroup(node.id);
        render();
        return;
      }
      if (event.detail > 1) {
        return;
      }
      cancelPendingNodeClicks();
      clearNodeGroupSelection();
      state.selectedId = node.id;
      render();
    });
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      cancelPendingNodeClicks();
      clearNodeGroupSelection();
      toggleNodePinned(node.id);
      state.selectedId = node.id;
      render();
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

function getVisibleChildren(node) {
  if (!node || state.collapsedBranchIds.has(node.id)) return [];
  return node.children || [];
}

function toggleBranch(nodeId) {
  state.selectedId = nodeId;
  clearNodeGroupSelection();
  if (state.collapsedBranchIds.has(nodeId)) {
    state.collapsedBranchIds.delete(nodeId);
    setStatus("后续分支已展开。");
  } else {
    state.collapsedBranchIds.add(nodeId);
    setStatus("后续分支已收起。");
  }
  render();
}

function resetBranchViewState() {
  state.collapsedBranchIds.clear();
  clearNodeGroupSelection();
}

async function handleAsk() {
  const question = els.promptInput.value.trim();
  if (!question) {
    setStatus("先写一个问题，再让分支长出来。");
    els.promptInput.focus();
    return;
  }

  const parent = findNode(state.tree, state.selectedId) || state.tree;
  const isAnswerToCurrentQuestion = parent.role === "user";
  const answerParent = isAnswerToCurrentQuestion ? parent : null;
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

  if (answerParent) {
    answerParent.children.push(answerNode);
    state.collapsedBranchIds.delete(answerParent.id);
  } else {
    questionNode.children.push(answerNode);
    parent.children.push(questionNode);
    state.collapsedBranchIds.delete(parent.id);
  }
  state.selectedId = answerNode.id;
  els.promptInput.value = "";
  persist();
  render();
  setBusy(true);
  setStatus("正在生成回答...");

  try {
    const context = answerParent
      ? getPath(state.tree, answerParent.id).concat({
          id: makeId(),
          role: "user",
          text: question,
          createdAt: Date.now(),
          children: [],
        })
      : getPath(state.tree, parent.id).concat(questionNode);
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
      .filter((name) => COMMON_MODELS.includes(name));

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
  resetBranchViewState();
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
  downloadTextFile(JSON.stringify(state.tree, null, 2), `forkscape-${todayStamp()}.json`, "application/json");
  setStatus("对话树 JSON 已导出。");
}

function exportMarkdown() {
  const session = state.sessions.find((item) => item.id === state.activeSessionId);
  const title = session?.title || titleFromTree(state.tree) || "Forkscape 对话脑图";
  const markdown = treeToMarkdown(state.tree, title);
  downloadTextFile(markdown, `${toFileSlug(title)}-${todayStamp()}.md`, "text/markdown;charset=utf-8");
  setStatus("对话树 Markdown 已导出。");
}

async function exportPng() {
  const entries = state.positioned || [];
  if (!entries.length) {
    setStatus("没有可导出的对话框。");
    return;
  }
  if (document.fonts?.ready) await document.fonts.ready;

  const session = state.sessions.find((item) => item.id === state.activeSessionId);
  const title = session?.title || titleFromTree(state.tree) || "Forkscape 对话脑图";
  const canvas = renderTreeToCanvas(entries);
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus("PNG 导出失败。");
      return;
    }
    downloadBlob(blob, `${toFileSlug(title)}-${todayStamp()}.png`);
    setStatus("对话树 PNG 已导出。");
  }, "image/png");
}

function exportSvg() {
  const entries = state.positioned || [];
  if (!entries.length) {
    setStatus("没有可导出的对话框。");
    return;
  }
  const session = state.sessions.find((item) => item.id === state.activeSessionId);
  const title = session?.title || titleFromTree(state.tree) || "Forkscape 对话脑图";
  const svg = renderTreeToSvg(entries, title);
  downloadTextFile(svg, `${toFileSlug(title)}-${todayStamp()}.svg`, "image/svg+xml;charset=utf-8");
  setStatus("对话树 SVG 已导出。");
}

function exportMermaid() {
  const session = state.sessions.find((item) => item.id === state.activeSessionId);
  const title = session?.title || titleFromTree(state.tree) || "Forkscape 对话脑图";
  const mermaid = treeToMermaid(state.tree, title);
  downloadTextFile(mermaid, `${toFileSlug(title)}-${todayStamp()}.mmd`, "text/plain;charset=utf-8");
  setStatus("对话树 Mermaid 已导出。");
}

function renderTreeToCanvas(entries) {
  const nodeWidth = 252;
  const padding = 180;
  const minX = Math.min(...entries.map((entry) => entry.x));
  const minY = Math.min(...entries.map((entry) => entry.y));
  const maxX = Math.max(...entries.map((entry) => entry.x + nodeWidth));
  const maxY = Math.max(...entries.map((entry) => entry.y + entry.height));
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);
  const scale = Math.min(2, 3200 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.translate(padding - minX, padding - minY);

  drawPngBackground(ctx, minX - padding, minY - padding, width, height);
  drawPngLinks(ctx, entries, nodeWidth);
  entries.forEach((entry) => drawPngNode(ctx, entry, nodeWidth));
  return canvas;
}

function getExportBounds(entries, nodeWidth = 252, padding = 180) {
  const minX = Math.min(...entries.map((entry) => entry.x));
  const minY = Math.min(...entries.map((entry) => entry.y));
  const maxX = Math.max(...entries.map((entry) => entry.x + nodeWidth));
  const maxY = Math.max(...entries.map((entry) => entry.y + entry.height));
  return {
    minX,
    minY,
    maxX,
    maxY,
    padding,
    width: Math.ceil(maxX - minX + padding * 2),
    height: Math.ceil(maxY - minY + padding * 2),
    offsetX: padding - minX,
    offsetY: padding - minY,
  };
}

function renderTreeToSvg(entries, title) {
  const nodeWidth = 252;
  const bounds = getExportBounds(entries, nodeWidth, 180);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}" role="img" aria-label="${escapeXML(title)}">`,
    "<defs>",
    '<pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">',
    '<path d="M 44 0 L 0 0 0 44" fill="none" stroke="rgba(23,92,136,.10)" stroke-width="1"/>',
    "</pattern>",
    '<filter id="cardShadow" x="-10%" y="-10%" width="130%" height="130%">',
    '<feDropShadow dx="9" dy="9" stdDeviation="0" flood-color="rgba(23,23,23,.12)"/>',
    "</filter>",
    "</defs>",
    `<rect width="${bounds.width}" height="${bounds.height}" fill="#f4eddf"/>`,
    `<rect width="${bounds.width}" height="${bounds.height}" fill="url(#grid)"/>`,
    '<g font-family="Microsoft YaHei, PingFang SC, Arial, sans-serif">',
  ];
  parts.push(svgLinks(entries, bounds, nodeWidth));
  entries.forEach((entry) => parts.push(svgNode(entry, bounds, nodeWidth)));
  parts.push("</g>", "</svg>");
  return parts.join("\n");
}

function svgLinks(entries, bounds, nodeWidth) {
  const byId = new Map(entries.map((entry) => [entry.node.id, entry]));
  return entries.map((entry) => {
    if (!entry.parentId) return "";
    const parent = byId.get(entry.parentId);
    if (!parent) return "";
    const startX = parent.x + nodeWidth + bounds.offsetX;
    const startY = parent.y + parent.height / 2 + bounds.offsetY;
    const endX = entry.x + bounds.offsetX;
    const endY = entry.y + entry.height / 2 + bounds.offsetY;
    const mid = startX + (endX - startX) * 0.5;
    return `<path d="M ${startX} ${startY} C ${mid} ${startY}, ${mid} ${endY}, ${endX} ${endY}" fill="none" stroke="rgba(78,69,54,.48)" stroke-width="2.5" stroke-linecap="round"/>`;
  }).join("\n");
}

function svgNode(entry, bounds, nodeWidth) {
  const { node, height } = entry;
  const x = entry.x + bounds.offsetX;
  const y = entry.y + bounds.offsetY;
  const colors = {
    root: { bg: "#171717", ink: "#fffaf0", meta: "#fffaf0" },
    user: { bg: "#e8f1f4", ink: "#171717", meta: "#6f6557" },
    model: { bg: "#fff8dc", ink: "#171717", meta: "#6f6557" },
  };
  const theme = colors[node.role] || colors.model;
  const textLines = wrapSvgText(String(node.text || ""), 24).slice(0, Math.max(1, Math.floor((height - 68) / 21)));
  const hasMore = wrapSvgText(String(node.text || ""), 24).length > textLines.length;
  const text = textLines.map((line, index) => {
    const value = index === textLines.length - 1 && hasMore ? `${line.slice(0, Math.max(0, line.length - 1))}…` : line;
    return `<tspan x="${x + 15}" y="${y + 58 + index * 21}">${escapeXML(value)}</tspan>`;
  }).join("");
  return `
<g filter="url(#cardShadow)">
  <rect x="${x}" y="${y}" width="${nodeWidth}" height="${height}" rx="8" fill="${theme.bg}" stroke="#171717" stroke-width="1.5"/>
  ${svgPill(roleLabel(node.role), x + 15, y + 14, theme.ink)}
  ${svgPill(`${node.children.length} 分支`, x + nodeWidth - 72, y + 14, theme.meta)}
  <text fill="${theme.ink}" font-size="14" dominant-baseline="text-before-edge">${text}</text>
</g>`;
}

function svgPill(text, x, y, color) {
  const width = Math.max(42, estimateSvgTextWidth(text, 11, 800) + 16);
  return `
  <rect x="${x}" y="${y}" width="${width}" height="22" rx="11" fill="transparent" stroke="${color}" stroke-width="1"/>
  <text x="${x + 8}" y="${y + 14}" fill="${color}" font-size="11" font-weight="800">${escapeXML(text)}</text>`;
}

function wrapSvgText(text, maxWeight) {
  const lines = [];
  String(text || "").split("\n").forEach((paragraph) => {
    let line = "";
    let weight = 0;
    [...paragraph].forEach((char) => {
      const charWeight = char.charCodeAt(0) > 255 ? 1.75 : 1;
      if (line && weight + charWeight > maxWeight) {
        lines.push(line);
        line = char;
        weight = charWeight;
      } else {
        line += char;
        weight += charWeight;
      }
    });
    lines.push(line || " ");
  });
  return lines;
}

function estimateSvgTextWidth(text, fontSize, fontWeight = 400) {
  const weightBoost = fontWeight >= 700 ? 0.66 : 0.58;
  return [...String(text)].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? fontSize : fontSize * weightBoost), 0);
}

function drawPngBackground(ctx, x, y, width, height) {
  ctx.fillStyle = "#f4eddf";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(23, 92, 136, .10)";
  ctx.lineWidth = 1;
  const step = 44;
  const startX = Math.floor(x / step) * step;
  const startY = Math.floor(y / step) * step;
  for (let gridX = startX; gridX <= x + width; gridX += step) {
    ctx.beginPath();
    ctx.moveTo(gridX, y);
    ctx.lineTo(gridX, y + height);
    ctx.stroke();
  }
  for (let gridY = startY; gridY <= y + height; gridY += step) {
    ctx.beginPath();
    ctx.moveTo(x, gridY);
    ctx.lineTo(x + width, gridY);
    ctx.stroke();
  }
}

function drawPngLinks(ctx, entries, nodeWidth) {
  const byId = new Map(entries.map((entry) => [entry.node.id, entry]));
  ctx.strokeStyle = "rgba(78, 69, 54, .48)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  entries.forEach((entry) => {
    if (!entry.parentId) return;
    const parent = byId.get(entry.parentId);
    if (!parent) return;
    const startX = parent.x + nodeWidth;
    const startY = parent.y + parent.height / 2;
    const endX = entry.x;
    const endY = entry.y + entry.height / 2;
    const mid = startX + (endX - startX) * 0.5;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(mid, startY, mid, endY, endX, endY);
    ctx.stroke();
  });
}

function drawPngNode(ctx, entry, nodeWidth) {
  const { node, x, y, height } = entry;
  const colors = {
    root: { bg: "#171717", ink: "#fffaf0", meta: "#fffaf0" },
    user: { bg: "#e8f1f4", ink: "#171717", meta: "#6f6557" },
    model: { bg: "#fff8dc", ink: "#171717", meta: "#6f6557" },
  };
  const theme = colors[node.role] || colors.model;
  ctx.save();
  ctx.shadowColor = "rgba(23, 23, 23, .12)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 9;
  ctx.shadowOffsetY = 9;
  roundedRect(ctx, x, y, nodeWidth, height, 8);
  ctx.fillStyle = theme.bg;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#171717";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawPngPill(ctx, roleLabel(node.role), x + 15, y + 14, theme.ink);
  drawPngPill(ctx, `${node.children.length} 分支`, x + nodeWidth - 72, y + 14, theme.meta);

  ctx.fillStyle = theme.ink;
  ctx.font = '14px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
  ctx.textBaseline = "top";
  const lines = wrapCanvasText(ctx, String(node.text || ""), nodeWidth - 30);
  const maxLines = Math.max(1, Math.floor((height - 68) / 21));
  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(index === maxLines - 1 && lines.length > maxLines ? `${line.slice(0, Math.max(0, line.length - 1))}…` : line, x + 15, y + 58 + index * 21);
  });
  ctx.restore();
}

function drawPngPill(ctx, text, x, y, color) {
  ctx.save();
  ctx.font = '800 11px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
  const width = Math.max(42, ctx.measureText(text).width + 16);
  roundedRect(ctx, x, y, width, 22, 11);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 8, y + 11);
  ctx.restore();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const lines = [];
  String(text || "").split("\n").forEach((paragraph) => {
    let line = "";
    [...paragraph].forEach((char) => {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    });
    lines.push(line || " ");
  });
  return lines;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function downloadTextFile(content, filename, type) {
  const blob = new Blob([content], { type });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function treeToMarkdown(root, title) {
  const lines = [
    `# ${title}`,
    "",
    `导出时间：${new Date().toLocaleString()}`,
    "",
  ];
  (root.children || []).forEach((child) => appendNodeMarkdown(child, 2, lines));
  return `${lines.join("\n").trim()}\n`;
}

function treeToMermaid(root, title) {
  const lines = [
    "---",
    `title: ${sanitizeMermaidTitle(title)}`,
    "---",
    "flowchart LR",
  ];
  appendMermaidNode(root, lines, new Set());
  lines.push(
    "classDef root fill:#171717,color:#fffaf0,stroke:#171717,stroke-width:1px;",
    "classDef user fill:#e8f1f4,color:#171717,stroke:#171717,stroke-width:1px;",
    "classDef model fill:#fff8dc,color:#171717,stroke:#171717,stroke-width:1px;",
  );
  return `${lines.join("\n")}\n`;
}

function appendMermaidNode(node, lines, seen) {
  if (!node || seen.has(node.id)) return;
  seen.add(node.id);
  const id = mermaidNodeId(node.id);
  lines.push(`  ${id}["${escapeMermaidLabel(mermaidNodeLabel(node))}"]`);
  lines.push(`  class ${id} ${node.role || "model"};`);
  (node.children || []).forEach((child) => {
    const childId = mermaidNodeId(child.id);
    lines.push(`  ${id} --> ${childId}`);
    appendMermaidNode(child, lines, seen);
  });
}

function mermaidNodeLabel(node) {
  return `${roleLabel(node.role)}: ${truncate(String(node.text || "").replace(/\s+/g, " ").trim() || "空内容", 72)}`;
}

function mermaidNodeId(id) {
  return `n${String(id).replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function escapeMermaidLabel(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\[/g, "(").replace(/\]/g, ")");
}

function sanitizeMermaidTitle(value) {
  return String(value || "Forkscape 对话脑图").replace(/[\r\n]+/g, " ").trim();
}

function appendNodeMarkdown(node, level, lines) {
  const heading = "#".repeat(Math.min(level, 6));
  lines.push(`${heading} ${roleLabel(node.role)}`);
  lines.push("");
  lines.push(String(node.text || "").trim() || "（空内容）");
  lines.push("");
  (node.children || []).forEach((child) => appendNodeMarkdown(child, level + 1, lines));
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function toFileSlug(value) {
  const slug = String(value || "forkscape")
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);
  return slug || "forkscape";
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
      resetBranchViewState();
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
  state.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  applyZoom();
}

function resetView() {
  state.zoom = 1;
  applyZoom();
  scrollToCanvasOrigin("smooth");
}

function showAllConversationCards() {
  state.isPanning = false;
  els.viewport.classList.remove("dragging");
  state.collapsedBranchIds.clear();
  clearNodeGroupSelection();
  render();
  requestAnimationFrame(() => fitPositionedNodesInView("smooth"));
  setStatus("已显示所有对话框。");
}

function fitPositionedNodesInView(behavior = "smooth") {
  const entries = state.positioned || [];
  if (!entries.length) {
    resetView();
    return;
  }
  const padding = 120;
  const minX = Math.min(...entries.map((entry) => entry.x));
  const minY = Math.min(...entries.map((entry) => entry.y));
  const maxX = Math.max(...entries.map((entry) => entry.x + 252));
  const maxY = Math.max(...entries.map((entry) => entry.y + entry.height));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const targetWidth = contentWidth + padding * 2;
  const targetHeight = contentHeight + padding * 2;
  const nextZoom = clamp(
    Math.min(
      els.viewport.clientWidth / targetWidth,
      els.viewport.clientHeight / targetHeight,
    ),
    OVERVIEW_MIN_ZOOM,
    1.12,
  );
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  state.zoom = nextZoom;
  applyZoom();
  els.viewport.scrollTo({
    left: Math.max(0, centerX * nextZoom - els.viewport.clientWidth / 2),
    top: Math.max(0, centerY * nextZoom - els.viewport.clientHeight / 2),
    behavior,
  });
  requestAnimationFrame(renderMinimapViewport);
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
  if (event.target.closest(".canvas-minimap, .canvas-help")) return;
  if (event.button === 1 && isMiddleDoublePress()) {
    event.preventDefault();
    showAllConversationCards();
    return;
  }
  if (event.target.closest(".node-card")) return;
  if (event.button !== 0 && event.button !== 1) return;
  event.preventDefault();
  state.isPanning = true;
  state.blankPointerDown = event.button === 0;
  state.panMoved = false;
  state.panStartX = event.clientX;
  state.panStartY = event.clientY;
  state.panStartLeft = els.viewport.scrollLeft;
  state.panStartTop = els.viewport.scrollTop;
  els.viewport.classList.add("dragging");
}

function isMiddleDoublePress() {
  const now = Date.now();
  const isDouble = now - state.lastMiddlePress < 360;
  state.lastMiddlePress = now;
  return isDouble;
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
  if (Math.abs(event.clientX - state.panStartX) > 3 || Math.abs(event.clientY - state.panStartY) > 3) {
    state.panMoved = true;
  }
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
  const shouldCancelSelection = state.blankPointerDown && !state.panMoved;
  state.isPanning = false;
  state.blankPointerDown = false;
  state.panMoved = false;
  els.viewport.classList.remove("dragging");
  if (shouldCancelSelection) cancelNodeSelection("quiet");
}

function startNodeDrag(event, node, card) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const entry = state.positioned.find((item) => item.node.id === node.id);
  const draggedIds = state.selectedGroupIds.has(node.id) ? [...state.selectedGroupIds] : [node.id];
  state.isNodeDragging = true;
  state.dragNode = node;
  state.dragCard = card;
  state.dragNodeIds = draggedIds;
  state.dragGroupStart = new Map(draggedIds.map((id) => {
    const groupNode = findNode(state.tree, id);
    const groupEntry = state.positioned.find((item) => item.node.id === id);
    return [id, {
      node: groupNode,
      x: groupEntry?.x ?? groupNode?.x ?? 0,
      y: groupEntry?.y ?? groupNode?.y ?? 0,
    }];
  }).filter(([, item]) => item.node));
  state.dragStartX = event.clientX;
  state.dragStartY = event.clientY;
  state.dragNodeStartX = entry?.x ?? node.x ?? 0;
  state.dragNodeStartY = entry?.y ?? node.y ?? 0;
  state.dragMoved = false;
  card.classList.add("dragging");
  if (draggedIds.length > 1) {
    draggedIds.forEach((id) => {
      getNodeCardElement(id)?.classList.add("dragging");
    });
  }
}

function dragNode(event) {
  event.preventDefault();
  const dx = (event.clientX - state.dragStartX) / state.zoom;
  const dy = (event.clientY - state.dragStartY) / state.zoom;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.dragMoved = true;
  state.dragGroupStart.forEach((start, id) => {
    const nextX = clamp(start.x + dx, 0, CANVAS_SIZE - 320);
    const nextY = clamp(start.y + dy, 0, CANVAS_SIZE - 320);
    start.node.x = nextX;
    start.node.y = nextY;
    const card = getNodeCardElement(id);
    if (card) {
      card.style.left = `${nextX}px`;
      card.style.top = `${nextY}px`;
    }
    const entry = state.positioned.find((item) => item.node.id === id);
    if (entry) {
      entry.x = nextX;
      entry.y = nextY;
    }
  });
  renderLinks(state.positioned);
  renderMinimap(state.positioned);
}

function stopNodeDrag() {
  if (!state.isNodeDragging) return;
  state.dragCard?.classList.remove("dragging");
  (state.dragNodeIds || []).forEach((id) => {
    getNodeCardElement(id)?.classList.remove("dragging");
  });
  state.isNodeDragging = false;
  state.dragNodeIds = [];
  state.dragGroupStart = new Map();
  state.suppressNextClick = state.dragMoved;
  persist();
}

function getNodeCardElement(nodeId) {
  return [...els.mindmap.querySelectorAll(".node-card")].find((card) => card.dataset.id === nodeId);
}

function handleWheelZoom(event) {
  event.preventDefault();
  const oldZoom = state.zoom;
  const direction = event.deltaY > 0 ? -1 : 1;
  const nextZoom = clamp(oldZoom + direction * 0.08, MIN_ZOOM, MAX_ZOOM);
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

function cancelPendingNodeClicks() {
  cancelPendingSelection();
  if (!state.multiClickTimer) return;
  clearTimeout(state.multiClickTimer);
  state.multiClickTimer = 0;
}

function selectNodeGroup(nodeId) {
  const node = findNode(state.tree, nodeId);
  if (!node) return;
  state.selectedId = nodeId;
  state.selectedGroupRootId = nodeId;
  state.selectedGroupIds = new Set(collectSubtreeIds(node));
}

function clearNodeGroupSelection() {
  state.selectedGroupRootId = "";
  state.selectedGroupIds.clear();
}

function collectSubtreeIds(node) {
  return [node.id].concat((node.children || []).flatMap(collectSubtreeIds));
}

function handleGlobalKeydown(event) {
  if ((event.key === " " || event.code === "Space") && !event.target?.closest?.("input, textarea, select")) {
    event.preventDefault();
    const now = Date.now();
    if (now - state.lastSpacePress < 420) {
      state.lastSpacePress = 0;
      autoArrangeSelectedNodes();
      return;
    }
    state.lastSpacePress = now;
    return;
  }
  if (event.key === "Escape") {
    if (event.target?.closest?.("input, textarea, select")) return;
    event.preventDefault();
    cancelNodeSelection();
    return;
  }
  if (event.key !== "Delete" || !state.selectedGroupIds.size) return;
  if (event.target?.closest?.("input, textarea, select")) return;
  event.preventDefault();
  deleteSelectedNodeGroup();
}

function autoArrangeSelectedNodes() {
  const rootId = state.selectedGroupRootId || state.selectedId || state.tree.id;
  const node = findNode(state.tree, rootId);
  if (!node) return;
  clearManualPositions(node);
  state.selectedGroupRootId = rootId;
  state.selectedGroupIds = new Set(collectSubtreeIds(node));
  persist();
  render();
  setStatus("已自动整理选中的对话框。");
}

function clearManualPositions(node) {
  delete node.x;
  delete node.y;
  (node.children || []).forEach(clearManualPositions);
}

function cancelNodeSelection(mode = "status") {
  cancelPendingNodeClicks();
  clearNodeGroupSelection();
  state.selectedId = "";
  render();
  if (mode !== "quiet") setStatus("已取消选中。");
}

function deleteSelectedNodeGroup() {
  if (!state.selectedGroupRootId || state.selectedGroupRootId === state.tree.id) {
    setStatus("根节点不能删除。");
    return;
  }
  if (!removeNodeById(state.tree, state.selectedGroupRootId)) return;
  clearNodeGroupSelection();
  state.selectedId = state.tree.id;
  persist();
  render();
  setStatus("已删除选中的对话框。");
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

function removeNodeById(node, id) {
  const index = node.children.findIndex((child) => child.id === id);
  if (index >= 0) {
    node.children.splice(index, 1);
    return true;
  }
  return node.children.some((child) => removeNodeById(child, id));
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

function escapeXML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
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
