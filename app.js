"use strict";

const STORAGE_KEY = "simple-todolist:v1";
const PRIORITY_VALUES = ["high", "medium", "low"];
const STATUS_VALUES = ["active", "completed", "deleted"];
const PRIORITY_LABELS = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级"
};

const elements = {
  themeToggle: document.querySelector("#themeToggle"),
  themeColorMeta: document.querySelector("#themeColorMeta"),
  trashOpenButton: document.querySelector("#trashOpenButton"),
  trashCount: document.querySelector("#trashCount"),
  todayLabel: document.querySelector("#todayLabel"),
  activeCount: document.querySelector("#activeCount"),
  overdueCount: document.querySelector("#overdueCount"),
  highPriorityCount: document.querySelector("#highPriorityCount"),
  taskForm: document.querySelector("#taskForm"),
  taskTitle: document.querySelector("#taskTitle"),
  taskPriority: document.querySelector("#taskPriority"),
  taskDueDate: document.querySelector("#taskDueDate"),
  taskList: document.querySelector("#taskList"),
  activeSummary: document.querySelector("#activeSummary"),
  editDialog: document.querySelector("#editDialog"),
  editForm: document.querySelector("#editForm"),
  editTitle: document.querySelector("#editTitle"),
  editPriority: document.querySelector("#editPriority"),
  editDueDate: document.querySelector("#editDueDate"),
  editCloseButton: document.querySelector("#editCloseButton"),
  editCancelButton: document.querySelector("#editCancelButton"),
  trashDialog: document.querySelector("#trashDialog"),
  trashCloseButton: document.querySelector("#trashCloseButton"),
  completedTab: document.querySelector("#completedTab"),
  deletedTab: document.querySelector("#deletedTab"),
  completedCount: document.querySelector("#completedCount"),
  deletedCount: document.querySelector("#deletedCount"),
  trashList: document.querySelector("#trashList"),
  clearTrashButton: document.querySelector("#clearTrashButton"),
  toast: document.querySelector("#toast")
};

let state = loadState();
let editingTaskId = null;
let activeTrashTab = "completed";
let toastTimer = null;

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidDateString(value) {
  if (value === "") {
    return true;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function normalizeTask(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const title = typeof value.title === "string" ? value.title.trim().slice(0, 120) : "";
  if (!title) {
    return null;
  }

  const status = STATUS_VALUES.includes(value.status) ? value.status : "active";
  const priority = PRIORITY_VALUES.includes(value.priority) ? value.priority : "medium";
  const dueDate = isValidDateString(value.dueDate) ? value.dueDate : "";
  const createdAt = typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt))
    ? value.createdAt
    : new Date().toISOString();
  const movedAt = typeof value.movedAt === "string" && !Number.isNaN(Date.parse(value.movedAt))
    ? value.movedAt
    : (status === "active" ? null : createdAt);

  return {
    id: typeof value.id === "string" && value.id ? value.id : createId(),
    title,
    priority,
    dueDate,
    status,
    createdAt,
    movedAt
  };
}

function loadState() {
  const fallback = {
    theme: getSystemTheme(),
    tasks: []
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    return {
      theme: ["light", "dark"].includes(parsed.theme) ? parsed.theme : fallback.theme,
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.map(normalizeTask).filter(Boolean)
        : []
    };
  } catch (error) {
    console.warn("无法读取本地 Todolist 数据，将使用空列表。", error);
    return fallback;
  }
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("无法保存 Todolist 数据。", error);
    showToast("本地保存失败，请检查浏览器存储设置");
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeColorMeta.setAttribute("content", theme === "dark" ? "#0d111a" : "#f3f6fb");
  elements.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "切换到浅色模式" : "切换到深色模式"
  );
  elements.themeToggle.title = theme === "dark" ? "切换到浅色模式" : "切换到深色模式";
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(state.theme);
  saveState();
}

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateFromISO(value) {
  if (!isValidDateString(value) || value === "") {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getRelativeDateLabel(value) {
  const date = getDateFromISO(value);
  if (!date) {
    return "";
  }

  const today = getDateFromISO(getTodayISO());
  const difference = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (difference === 0) {
    return "今天";
  }

  if (difference === 1) {
    return "明天";
  }

  if (difference === -1) {
    return "昨天";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function formatMovedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function compareTasks(first, second) {
  const priorityDifference = PRIORITY_VALUES.indexOf(first.priority) - PRIORITY_VALUES.indexOf(second.priority);
  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  if (first.dueDate !== second.dueDate) {
    if (!first.dueDate) {
      return 1;
    }

    if (!second.dueDate) {
      return -1;
    }

    return first.dueDate.localeCompare(second.dueDate);
  }

  return second.createdAt.localeCompare(first.createdAt);
}

function createEmptyState(type) {
  const empty = document.createElement("div");
  empty.className = "empty-state";

  const content = document.createElement("div");
  content.innerHTML = `
    <span class="empty-state-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        ${type === "trash"
          ? '<path d="M5 7h14M9 7V4.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8V7m1.5 0-.6 12.1a1.8 1.8 0 0 1-1.8 1.7H8.9a1.8 1.8 0 0 1-1.8-1.7L6.5 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<path d="m7.5 6.5 4.5 4.5 4.5-4.5M12 11V3m7 9a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'}
      </svg>
    </span>
  `;

  const title = document.createElement("h3");
  const description = document.createElement("p");

  if (type === "trash") {
    title.textContent = "这里空空如也";
    description.textContent = "完成或删除的任务会暂时出现在这里。";
  } else {
    title.textContent = "现在没有待办";
    description.textContent = "把想做的事情写下来，从第一件小事开始。";
  }

  content.append(title, description);
  empty.append(content);
  return empty;
}

function createPriorityPill(priority) {
  const pill = document.createElement("span");
  pill.className = `priority-pill priority-${priority}`;
  pill.textContent = PRIORITY_LABELS[priority];
  return pill;
}

function createDueDatePill(task) {
  if (!task.dueDate) {
    return null;
  }

  const today = getTodayISO();
  const pill = document.createElement("span");
  pill.className = "date-pill";
  if (task.dueDate < today) {
    pill.classList.add("is-overdue");
  } else if (task.dueDate === today) {
    pill.classList.add("is-today");
  }

  const label = task.dueDate < today
    ? `已逾期 · ${getRelativeDateLabel(task.dueDate)}`
    : getRelativeDateLabel(task.dueDate);

  pill.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="1.7"/>
      <path d="M8 3.5v4M16 3.5v4M4 10h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>
  `;
  pill.append(document.createTextNode(label));
  return pill;
}

function createActionButton(action, label, iconMarkup, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `task-action${danger ? " is-danger" : ""}`;
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${iconMarkup}</svg>`;
  return button;
}

function createTaskElement(task) {
  const item = document.createElement("article");
  item.className = "task-item";
  item.dataset.id = task.id;
  item.setAttribute("role", "listitem");

  if (task.dueDate && task.dueDate < getTodayISO()) {
    item.classList.add("is-overdue");
  }

  const completeButton = document.createElement("button");
  completeButton.type = "button";
  completeButton.className = "complete-button";
  completeButton.dataset.action = "complete";
  completeButton.setAttribute("aria-label", `完成任务：${task.title}`);
  completeButton.title = "标记为已完成";
  completeButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6.5 12.5 3.4 3.4 7.6-8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(createPriorityPill(task.priority));

  const dueDatePill = createDueDatePill(task);
  if (dueDatePill) {
    meta.append(dueDatePill);
  }

  main.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    createActionButton(
      "edit",
      `编辑任务：${task.title}`,
      '<path d="m14.5 5.5 4 4M5 19l3.9-.8L19 7.1a1.4 1.4 0 0 0 0-2l-.1-.1a1.4 1.4 0 0 0-2 0L5.8 16.1 5 19Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    createActionButton(
      "delete",
      `删除任务：${task.title}`,
      '<path d="M5 7h14M9 7V4.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8V7m1.5 0-.6 12.1a1.8 1.8 0 0 1-1.8 1.7H8.9a1.8 1.8 0 0 1-1.8-1.7L6.5 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
      true
    )
  );

  item.append(completeButton, main, actions);
  return item;
}

function renderTasks() {
  const activeTasks = state.tasks
    .filter((task) => task.status === "active")
    .sort(compareTasks);

  const overdueTasks = activeTasks.filter((task) => task.dueDate && task.dueDate < getTodayISO());
  const highPriorityTasks = activeTasks.filter((task) => task.priority === "high");
  const trashTasks = state.tasks.filter((task) => task.status !== "active");

  elements.activeCount.textContent = String(activeTasks.length);
  elements.overdueCount.textContent = String(overdueTasks.length);
  elements.highPriorityCount.textContent = String(highPriorityTasks.length);
  elements.trashCount.textContent = String(trashTasks.length);
  elements.activeSummary.textContent = activeTasks.length === 0
    ? "目前没有待办"
    : `共 ${activeTasks.length} 项待完成`;

  elements.taskList.replaceChildren();
  if (activeTasks.length === 0) {
    elements.taskList.append(createEmptyState("tasks"));
    return;
  }

  activeTasks.forEach((task) => elements.taskList.append(createTaskElement(task)));
}

function updateTodayLabel() {
  elements.todayLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date());
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2200);
}

function addTask(event) {
  event.preventDefault();
  const title = elements.taskTitle.value.trim();

  if (!title) {
    elements.taskTitle.setCustomValidity("请输入任务名称");
    elements.taskTitle.reportValidity();
    elements.taskTitle.focus();
    return;
  }

  elements.taskTitle.setCustomValidity("");
  state.tasks.unshift({
    id: createId(),
    title: title.slice(0, 120),
    priority: PRIORITY_VALUES.includes(elements.taskPriority.value)
      ? elements.taskPriority.value
      : "medium",
    dueDate: isValidDateString(elements.taskDueDate.value) ? elements.taskDueDate.value : "",
    status: "active",
    createdAt: new Date().toISOString(),
    movedAt: null
  });

  saveState();
  elements.taskForm.reset();
  elements.taskPriority.value = "medium";
  renderTasks();
  elements.taskTitle.focus();
  showToast("任务已添加");
}

function openEditDialog(taskId) {
  const task = state.tasks.find((item) => item.id === taskId && item.status === "active");
  if (!task) {
    return;
  }

  editingTaskId = task.id;
  elements.editTitle.value = task.title;
  elements.editPriority.value = task.priority;
  elements.editDueDate.value = task.dueDate;
  elements.editTitle.setCustomValidity("");
  elements.editDialog.showModal();
  window.setTimeout(() => elements.editTitle.focus(), 0);
}

function closeEditDialog() {
  editingTaskId = null;
  elements.editDialog.close();
}

function saveEditedTask(event) {
  event.preventDefault();
  const title = elements.editTitle.value.trim();

  if (!title) {
    elements.editTitle.setCustomValidity("请输入任务名称");
    elements.editTitle.reportValidity();
    elements.editTitle.focus();
    return;
  }

  const task = state.tasks.find((item) => item.id === editingTaskId && item.status === "active");
  if (!task) {
    closeEditDialog();
    return;
  }

  task.title = title.slice(0, 120);
  task.priority = PRIORITY_VALUES.includes(elements.editPriority.value)
    ? elements.editPriority.value
    : "medium";
  task.dueDate = isValidDateString(elements.editDueDate.value) ? elements.editDueDate.value : "";

  saveState();
  closeEditDialog();
  renderTasks();
  showToast("任务已更新");
}

function moveTaskToTrash(taskId, status) {
  const task = state.tasks.find((item) => item.id === taskId && item.status === "active");
  if (!task) {
    return;
  }

  task.status = status;
  task.movedAt = new Date().toISOString();
  saveState();
  renderTasks();
  showToast(status === "completed" ? "任务已完成，并移入回收站" : "任务已移入回收站");
}

function handleTaskListClick(event) {
  const button = event.target.closest("[data-action]");
  const item = event.target.closest(".task-item[data-id]");
  if (!button || !item) {
    return;
  }

  const taskId = item.dataset.id;
  const action = button.dataset.action;

  if (action === "complete") {
    moveTaskToTrash(taskId, "completed");
  } else if (action === "delete") {
    moveTaskToTrash(taskId, "deleted");
  } else if (action === "edit") {
    openEditDialog(taskId);
  }
}

function createTrashElement(task) {
  const item = document.createElement("article");
  item.className = "task-item trash-item";
  item.dataset.id = task.id;
  item.setAttribute("role", "listitem");

  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(createPriorityPill(task.priority));

  const reason = document.createElement("span");
  reason.className = "trash-reason";
  const reasonText = task.status === "completed" ? "已完成" : "已删除";
  const movedText = task.movedAt ? ` · ${formatMovedAt(task.movedAt)}` : "";
  reason.textContent = `${reasonText}${movedText}`;
  meta.append(reason);

  const dueDatePill = createDueDatePill(task);
  if (dueDatePill) {
    meta.append(dueDatePill);
  }

  main.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const restoreButton = document.createElement("button");
  restoreButton.type = "button";
  restoreButton.className = "restore-button";
  restoreButton.dataset.action = "restore";
  restoreButton.textContent = "恢复";
  restoreButton.setAttribute("aria-label", `恢复任务：${task.title}`);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "permanent-delete-button";
  deleteButton.dataset.action = "permanent-delete";
  deleteButton.textContent = "永久删除";
  deleteButton.setAttribute("aria-label", `永久删除任务：${task.title}`);

  actions.append(restoreButton, deleteButton);
  item.append(main, actions);
  return item;
}

function renderTrash() {
  const completedTasks = state.tasks.filter((task) => task.status === "completed");
  const deletedTasks = state.tasks.filter((task) => task.status === "deleted");
  const visibleTasks = (activeTrashTab === "completed" ? completedTasks : deletedTasks)
    .sort((first, second) => String(second.movedAt).localeCompare(String(first.movedAt)));

  elements.completedCount.textContent = String(completedTasks.length);
  elements.deletedCount.textContent = String(deletedTasks.length);
  elements.clearTrashButton.disabled = visibleTasks.length === 0;
  elements.clearTrashButton.textContent = activeTrashTab === "completed"
    ? "清空已完成"
    : "清空已删除";

  [elements.completedTab, elements.deletedTab].forEach((tab) => {
    const isActive = tab.dataset.trashTab === activeTrashTab;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });

  elements.trashList.replaceChildren();
  if (visibleTasks.length === 0) {
    elements.trashList.append(createEmptyState("trash"));
    return;
  }

  visibleTasks.forEach((task) => elements.trashList.append(createTrashElement(task)));
}

function openTrashDialog() {
  renderTrash();
  elements.trashDialog.showModal();
  window.setTimeout(() => elements.completedTab.focus(), 0);
}

function switchTrashTab(tabName) {
  if (!["completed", "deleted"].includes(tabName) || tabName === activeTrashTab) {
    return;
  }

  activeTrashTab = tabName;
  renderTrash();
}

function restoreTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId && item.status !== "active");
  if (!task) {
    return;
  }

  task.status = "active";
  task.movedAt = null;
  saveState();
  renderTasks();
  renderTrash();
  showToast("任务已恢复到待办列表");
}

function permanentlyDeleteTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId && item.status !== "active");
  if (!task) {
    return;
  }

  if (!window.confirm(`确定永久删除“${task.title}”吗？此操作无法撤销。`)) {
    return;
  }

  state.tasks = state.tasks.filter((item) => item.id !== taskId);
  saveState();
  renderTasks();
  renderTrash();
  showToast("任务已永久删除");
}

function clearCurrentTrashTab() {
  const label = activeTrashTab === "completed" ? "已完成的" : "已删除的";
  const count = state.tasks.filter((task) => task.status === activeTrashTab).length;
  if (count === 0) {
    return;
  }

  if (!window.confirm(`确定清空 ${count} 项${label}任务吗？此操作无法撤销。`)) {
    return;
  }

  state.tasks = state.tasks.filter((task) => task.status !== activeTrashTab);
  saveState();
  renderTasks();
  renderTrash();
  showToast("当前分类已清空");
}

function handleTrashListClick(event) {
  const button = event.target.closest("[data-action]");
  const item = event.target.closest(".trash-item[data-id]");
  if (!button || !item) {
    return;
  }

  if (button.dataset.action === "restore") {
    restoreTask(item.dataset.id);
  } else if (button.dataset.action === "permanent-delete") {
    permanentlyDeleteTask(item.dataset.id);
  }
}

function handleTrashTabClick(event) {
  const tab = event.target.closest("[data-trash-tab]");
  if (tab) {
    switchTrashTab(tab.dataset.trashTab);
  }
}

function handleTrashTabKeyboard(event) {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
    return;
  }

  event.preventDefault();
  const tabs = [elements.completedTab, elements.deletedTab];
  const currentIndex = tabs.indexOf(document.activeElement);
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  tabs[nextIndex].focus();
  switchTrashTab(tabs[nextIndex].dataset.trashTab);
}

function closeDialogFromBackdrop(event) {
  if (event.target === event.currentTarget) {
    event.currentTarget.close();
  }
}

function initialize() {
  applyTheme(state.theme);
  updateTodayLabel();
  renderTasks();
  renderTrash();

  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.taskForm.addEventListener("submit", addTask);
  elements.taskTitle.addEventListener("input", () => elements.taskTitle.setCustomValidity(""));
  elements.taskList.addEventListener("click", handleTaskListClick);

  elements.editForm.addEventListener("submit", saveEditedTask);
  elements.editTitle.addEventListener("input", () => elements.editTitle.setCustomValidity(""));
  elements.editCloseButton.addEventListener("click", closeEditDialog);
  elements.editCancelButton.addEventListener("click", closeEditDialog);
  elements.editDialog.addEventListener("click", closeDialogFromBackdrop);

  elements.trashOpenButton.addEventListener("click", openTrashDialog);
  elements.trashCloseButton.addEventListener("click", () => elements.trashDialog.close());
  elements.trashDialog.addEventListener("click", closeDialogFromBackdrop);
  elements.completedTab.addEventListener("click", handleTrashTabClick);
  elements.deletedTab.addEventListener("click", handleTrashTabClick);
  elements.completedTab.addEventListener("keydown", handleTrashTabKeyboard);
  elements.deletedTab.addEventListener("keydown", handleTrashTabKeyboard);
  elements.trashList.addEventListener("click", handleTrashListClick);
  elements.clearTrashButton.addEventListener("click", clearCurrentTrashTab);
}

initialize();