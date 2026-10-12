(() => {
  "use strict";

  const CATEGORIES = {
    expense: ["Food & dining", "Housing", "Transport", "Utilities", "Health", "Shopping", "Entertainment", "Other"],
    income: ["Salary", "Freelance", "Investment", "Other"]
  };
  const CATEGORY_ICONS = {
    "Food & dining": "⌁", Housing: "⌂", Transport: "↗", Utilities: "ϟ", Health: "+",
    Shopping: "◇", Entertainment: "♫", Other: "◦", Salary: "↙", Freelance: "✳", Investment: "▥"
  };
  const CATEGORY_COLORS = ["#4778b5", "#d5a448", "#8292a8", "#8b79b7", "#58a0b3", "#b28d5d", "#7c9baa", "#a0a9b5"];
  const STORAGE_KEY = "northstar-finance-v1";
  const AUTH_KEY = "northstar-auth-v1";
  const DEFAULT_BUDGETS = { "Food & dining": 600, Housing: 1400, Transport: 250, Utilities: 180, Health: 150, Shopping: 250, Entertainment: 120, Other: 150 };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const money = (value, digits = 2) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0);
  const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const parseDate = (value) => {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  };
  const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (date, options = { month: "short" }) => new Intl.DateTimeFormat(undefined, options).format(date);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  function demoData() {
    const now = new Date();
    const tx = [];
    const add = (offset, description, category, amount, type) => {
      const lastDay = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0).getDate();
      const maxDay = offset === 0 ? now.getDate() : lastDay;
      const date = new Date(now.getFullYear(), now.getMonth() + offset, Math.min(4 + (tx.length * 3) % 24, maxDay));
      tx.push({ id: uid(), date: dateString(date), description, category, amount, type, note: "" });
    };
    [
      [-2, "Monthly salary", "Salary", 5200, "income"], [-2, "Apartment rent", "Housing", 1350, "expense"], [-2, "Market & groceries", "Food & dining", 184.32, "expense"], [-2, "Electric bill", "Utilities", 86.5, "expense"], [-2, "Train pass", "Transport", 72, "expense"],
      [-1, "Monthly salary", "Salary", 5200, "income"], [-1, "Apartment rent", "Housing", 1350, "expense"], [-1, "Sunday brunch", "Food & dining", 58.4, "expense"], [-1, "Internet bill", "Utilities", 65, "expense"], [-1, "Gym membership", "Health", 48, "expense"], [-1, "Books & supplies", "Shopping", 74.9, "expense"],
      [0, "Monthly salary", "Salary", 5200, "income"], [0, "Apartment rent", "Housing", 1350, "expense"], [0, "Weekly groceries", "Food & dining", 126.75, "expense"], [0, "Coffee shop", "Food & dining", 18.6, "expense"], [0, "Gas & transit", "Transport", 64.2, "expense"], [0, "Streaming plan", "Entertainment", 15.99, "expense"], [0, "Electric bill", "Utilities", 92, "expense"]
    ].forEach((row) => add(...row));
    return {
      transactions: tx,
      budgets: { ...DEFAULT_BUDGETS },
      monthlyBudget: 3200,
      goals: [{ id: uid(), name: "Emergency fund", target: 5000, saved: 1850, deadline: dateString(new Date(now.getFullYear(), now.getMonth() + 8, Math.min(now.getDate(), 28))) }],
      recurring: [
        { id: uid(), name: "Apartment rent", amount: 1350, category: "Housing", nextDate: dateString(new Date(now.getFullYear(), now.getMonth() + 1, 1)) },
        { id: uid(), name: "Internet", amount: 65, category: "Utilities", nextDate: dateString(new Date(now.getFullYear(), now.getMonth() + 1, 8)) },
        { id: uid(), name: "Streaming", amount: 15.99, category: "Entertainment", nextDate: dateString(new Date(now.getFullYear(), now.getMonth() + 1, 15)) },
        { id: uid(), name: "Gym membership", amount: 48, category: "Health", nextDate: dateString(new Date(now.getFullYear(), now.getMonth() + 1, 21)) }
      ]
    };
  }

  let auth = null;
  let activeUser = { email: "demo@moneyflow.app", name: "Alex Morgan" };
  let isDemo = true;
  let data = demoData();
  let authMode = "login";
  let selectedMonths = 6;
  let lastFiltered = [];
  let toastTimer;

  function storageKey(email) {
    return `${STORAGE_KEY}:${email.trim().toLowerCase()}`;
  }

  function readJson(key, fallback) {
    try {
      const result = localStorage.getItem(key);
      return result ? JSON.parse(result) : fallback;
    } catch (error) {
      console.error("Could not read saved finance data.", error);
      return fallback;
    }
  }

  function saveData() {
    if (isDemo) return;
    try {
      localStorage.setItem(storageKey(activeUser.email), JSON.stringify(data));
    } catch (error) {
      console.error("Could not save finance data.", error);
      showToast("Could not save changes in this browser.", true);
    }
  }

  function loadAccount(email, name) {
    activeUser = { email, name: name || email.split("@")[0] };
    const saved = readJson(storageKey(email), null);
    data = saved && Array.isArray(saved.transactions)
      ? { transactions: saved.transactions, budgets: { ...DEFAULT_BUDGETS, ...saved.budgets }, monthlyBudget: Number(saved.monthlyBudget) || 3200, goals: Array.isArray(saved.goals) ? saved.goals : [], recurring: Array.isArray(saved.recurring) ? saved.recurring : [] }
      : { transactions: [], budgets: { ...DEFAULT_BUDGETS }, monthlyBudget: 3200, goals: [], recurring: [] };
    isDemo = false;
    try {
      auth = { email: email.toLowerCase(), name: activeUser.name };
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    } catch (error) {
      console.error("Could not persist the local session.", error);
      showToast("Signed in for this session, but could not save your session.", true);
    }
    $("#app-shell").classList.remove("hidden");
    updateProfile();
    render();
  }

  function updateProfile() {
    const first = activeUser.name.trim().split(/\s+/)[0] || "there";
    $("#welcome-name").textContent = first;
    $("#profile-name").textContent = activeUser.name;
    $("#profile-email").textContent = isDemo ? "Demo workspace" : activeUser.email;
    $("#profile-avatar").textContent = first.charAt(0).toUpperCase();
    $("#logout-action").classList.toggle("hidden", isDemo);
    $("#auth-action").textContent = isDemo ? "Sign in / create account" : "Switch account";
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parseDate(value));
  }

  function total(type, transactions = data.transactions) {
    return transactions.filter((item) => item.type === type).reduce((sum, item) => sum + Number(item.amount), 0);
  }

  function thisMonthTransactions(offset = 0) {
    const date = new Date();
    const month = new Date(date.getFullYear(), date.getMonth() + offset, 1);
    const key = monthKey(month);
    return data.transactions.filter((item) => item.date.startsWith(key));
  }

  function render() {
    updateProfile();
    renderStats();
    renderCharts();
    renderBudgets();
    renderGoals();
    renderRecurring();
    renderTransactions();
    renderInsight();
    $("#month-label").textContent = monthLabel(new Date(), { month: "long", year: "numeric" });
    updateCategoryOptions($("#transaction-type").value);
    renderCategoryFilterOptions();
  }

  function setTrend(element, current, previous, inverse = false) {
    const change = previous ? ((current - previous) / previous) * 100 : current ? 100 : 0;
    const positive = inverse ? change < 0 : change > 0;
    element.className = `trend-chip ${change === 0 ? "neutral" : positive ? "positive" : "negative"}`;
    element.textContent = `${change > 0 ? "↗" : change < 0 ? "↘" : "—"} ${Math.abs(change).toFixed(1)}%`;
  }

  function renderStats() {
    const nowIncome = total("income", thisMonthTransactions());
    const nowExpense = total("expense", thisMonthTransactions());
    const prevIncome = total("income", thisMonthTransactions(-1));
    const prevExpense = total("expense", thisMonthTransactions(-1));
    const balance = total("income") - total("expense");
    const savings = nowIncome ? ((nowIncome - nowExpense) / nowIncome) * 100 : 0;
    $("#total-balance").textContent = money(balance);
    $("#month-income").textContent = money(nowIncome);
    $("#month-expenses").textContent = money(nowExpense);
    $("#savings-rate").textContent = `${Math.round(savings)}%`;
    setTrend($("#balance-trend"), nowIncome - nowExpense, prevIncome - prevExpense);
    setTrend($("#income-trend"), nowIncome, prevIncome);
    setTrend($("#expense-trend"), nowExpense, prevExpense, true);
    $("#savings-trend").textContent = savings >= 20 ? "Looking good" : savings > 0 ? "Room to grow" : "Keep an eye on it";
    $("#savings-trend").className = `trend-chip ${savings >= 20 ? "positive" : savings > 0 ? "neutral" : "negative"}`;
  }

  function renderCharts() {
    drawCashflow();
    drawCategories();
    drawExpenseTrend();
  }

  function canvasContext(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    const context = canvas.getContext("2d");
    context.setTransform(scale, 0, 0, scale, 0, 0);
    return { context, width: rect.width, height: rect.height };
  }

  let chartPoints = [];
  function drawCashflow() {
    const canvas = $("#cashflow-chart");
    const surface = canvasContext(canvas);
    if (!surface) return;
    const { context: ctx, width, height } = surface;
    const months = [];
    const now = new Date();
    for (let i = selectedMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(date);
      const transactions = data.transactions.filter((item) => item.date.startsWith(key));
      months.push({ label: monthLabel(date), income: total("income", transactions), expense: total("expense", transactions) });
    }
    const max = Math.max(1000, ...months.flatMap((item) => [item.income, item.expense])) * 1.18;
    const pad = { top: 13, right: 8, bottom: 28, left: width < 390 ? 40 : 48 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const grid = getComputedStyle(document.documentElement).getPropertyValue("--line").trim() || "#eceeec";
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#858b89";
    ctx.clearRect(0, 0, width, height);
    ctx.font = "9px 'DM Sans', sans-serif";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + chartH * i / 3;
      ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      const value = Math.round(max * (1 - i / 3) / 1000);
      ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(value ? `$${value}k` : "$0", pad.left - 8, y);
    }
    chartPoints = [];
    const step = chartW / months.length;
    const barWidth = Math.max(5, Math.min(13, step * .21));
    months.forEach((item, index) => {
      const center = pad.left + step * (index + .5);
      const values = [item.income, item.expense];
      const colors = [
        getComputedStyle(document.documentElement).getPropertyValue("--chart-green").trim() || "#43846c",
        getComputedStyle(document.documentElement).getPropertyValue("--chart-blue").trim() || "#5787be"
      ];
      values.forEach((value, series) => {
        const barHeight = Math.max(2, chartH * value / max);
        const x = center + (series === 0 ? -barWidth - 2 : 2);
        const y = pad.top + chartH - barHeight;
        ctx.fillStyle = colors[series];
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
        else ctx.rect(x, y, barWidth, barHeight);
        ctx.fill();
        chartPoints.push({ x: center, left: center - step / 2, right: center + step / 2, income: item.income, expense: item.expense, label: item.label });
      });
      ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.fillText(item.label, center, height - 12);
    });
  }

  function drawCategories() {
    const surface = canvasContext($("#category-chart"));
    if (!surface) return;
    const { context: ctx, width, height } = surface;
    const entries = Object.entries(thisMonthTransactions().filter((item) => item.type === "expense").reduce((group, item) => {
      group[item.category] = (group[item.category] || 0) + Number(item.amount);
      return group;
    }, {})).sort((a, b) => b[1] - a[1]);
    const totalAmount = entries.reduce((sum, [, amount]) => sum + amount, 0);
    $("#donut-total").textContent = money(totalAmount, 0);
    const cx = width / 2, cy = height / 2, radius = Math.min(width, height) * .42;
    const dark = document.documentElement.dataset.theme === "dark";
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 12; ctx.lineCap = "round";
    if (!totalAmount) {
      ctx.strokeStyle = dark ? "#343d38" : "#edf0ed"; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    } else {
      let angle = -Math.PI / 2;
      entries.forEach(([, amount], i) => {
        const extent = amount / totalAmount * Math.PI * 2;
        ctx.strokeStyle = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
        ctx.beginPath(); ctx.arc(cx, cy, radius, angle + .025, angle + extent - .025); ctx.stroke();
        angle += extent;
      });
    }
    $("#category-legend").innerHTML = entries.length ? entries.slice(0, 6).map(([name, amount], i) => `<div class="category-item"><i style="background:${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}"></i><span>${escapeHtml(name)}</span><strong>${Math.round(amount / totalAmount * 100)}%</strong></div>`).join("") : `<div class="recurring-empty">No expenses recorded this month yet.</div>`;
    renderSpendingAnalysis(entries);
  }

  function drawExpenseTrend() {
    const surface = canvasContext($("#expense-trend-chart"));
    if (!surface) return;
    const { context: ctx, width, height } = surface;
    const now = new Date();
    const months = [];
    for (let i = selectedMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(date);
      const expenses = data.transactions.filter((item) => item.type === "expense" && item.date.startsWith(key));
      months.push({ label: monthLabel(date), amount: total("expense", expenses) });
    }
    const max = Math.max(100, ...months.map((month) => month.amount)) * 1.2;
    const pad = { top: 14, right: 14, bottom: 27, left: width < 390 ? 39 : 48 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const grid = getComputedStyle(document.documentElement).getPropertyValue("--line").trim() || "#eceeec";
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#858b89";
    ctx.clearRect(0, 0, width, height);
    ctx.font = "9px 'DM Sans', sans-serif";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + chartH * i / 3;
      ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      const amount = Math.round(max * (1 - i / 3) / 100) * 100;
      ctx.fillStyle = muted; ctx.textAlign = "right";
      ctx.fillText(amount >= 1000 ? `$${(amount / 1000).toFixed(amount % 1000 ? 1 : 0)}k` : `$${amount}`, pad.left - 7, y);
    }
    const points = months.map((month, index) => ({
      x: pad.left + (months.length === 1 ? chartW / 2 : chartW * index / (months.length - 1)),
      y: pad.top + chartH - chartH * month.amount / max,
      ...month
    }));
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    const trendColor = getComputedStyle(document.documentElement).getPropertyValue("--chart-blue").trim() || "#5787be";
    ctx.strokeStyle = trendColor; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
    const fill = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    fill.addColorStop(0, `${trendColor}33`);
    fill.addColorStop(1, `${trendColor}00`);
    ctx.lineTo(points[points.length - 1].x, height - pad.bottom);
    ctx.lineTo(points[0].x, height - pad.bottom);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    points.forEach((point) => {
      ctx.beginPath(); ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = trendColor; ctx.fill();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#fff";
      ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.fillText(point.label, point.x, height - 11);
    });
  }

  function renderSpendingAnalysis(entries) {
    const current = new Date();
    const previous = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    const elapsedDays = current.getDate();
    const sumMonthToDay = (date, days) => {
      const key = monthKey(date);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const endDay = Math.min(days, lastDay);
      return total("expense", data.transactions.filter((item) => item.date.startsWith(key) && Number(item.date.slice(8, 10)) <= endDay));
    };
    const currentTotal = sumMonthToDay(current, elapsedDays);
    const previousTotal = sumMonthToDay(previous, elapsedDays);
    $("#comparison-current").textContent = money(currentTotal, 0);
    $("#comparison-previous").textContent = money(previousTotal, 0);
    const delta = previousTotal ? ((currentTotal - previousTotal) / previousTotal) * 100 : currentTotal ? 100 : 0;
    const comparison = $("#comparison-change");
    comparison.className = `comparison-change ${delta === 0 ? "neutral" : delta < 0 ? "positive" : "negative"}`;
    comparison.textContent = previousTotal
      ? `${delta > 0 ? "↑" : delta < 0 ? "↓" : "—"} ${Math.abs(delta).toFixed(1)}% ${delta > 0 ? "more" : delta < 0 ? "less" : "change"} than the same period last month`
      : "No expenses recorded in the comparison period last month.";
    $("#category-ranking").innerHTML = entries.length
      ? entries.slice(0, 4).map(([name, amount], index) => `<div class="ranking-row"><span class="ranking-index">${String(index + 1).padStart(2, "0")}</span><span class="ranking-name"><span>${escapeHtml(name)}</span><i><b style="width:${Math.max(4, amount / entries[0][1] * 100)}%;background:${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}"></b></i></span><strong>${money(amount, 0)}</strong></div>`).join("")
      : `<p class="recurring-empty">Add expenses to see your highest-spending categories.</p>`;
    $("#trend-period-label").textContent = `Last ${selectedMonths} months`;
  }

  function renderBudgets() {
    const expenses = thisMonthTransactions().filter((item) => item.type === "expense");
    const spent = expenses.reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + Number(item.amount);
      return result;
    }, {});
    const names = Object.keys(data.budgets).filter((category) => Number(data.budgets[category]) > 0);
    const rows = names.map((category) => {
      const limit = Number(data.budgets[category]);
      const amount = spent[category] || 0;
      const ratio = limit ? amount / limit : 0;
      return { category, limit, amount, ratio };
    });
    $("#budget-list").innerHTML = rows.slice(0, 8).map(({ category, limit, amount, ratio }) => `<div class="budget-row"><div class="budget-row-top"><span>${escapeHtml(category)}</span><span><strong>${money(amount, 0)}</strong> / ${money(limit, 0)}</span></div><div class="progress-track" role="progressbar" aria-valuenow="${Math.min(100, Math.round(ratio * 100))}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(category)} budget"><div class="progress-fill ${ratio >= 1 ? "over" : ratio >= .8 ? "warning" : ""}" style="width:${Math.min(100, ratio * 100)}%"></div></div><div class="budget-remaining">${ratio >= 1 ? `${money(amount - limit, 0)} over` : `${money(limit - amount, 0)} remaining`}</div></div>`).join("") || `<p class="recurring-empty">Set a budget to start planning your month.</p>`;
    const monthlySpent = total("expense", expenses);
    const monthlyLimit = Number(data.monthlyBudget) || 0;
    const monthlyRatio = monthlyLimit ? monthlySpent / monthlyLimit : 0;
    $("#monthly-budget-values").textContent = `${money(monthlySpent, 0)} / ${money(monthlyLimit, 0)}`;
    $("#monthly-budget-remaining").textContent = money(Math.abs(monthlyLimit - monthlySpent), 0);
    $("#monthly-budget-status").textContent = monthlyRatio > 1 ? "Over budget by" : "Remaining";
    $("#monthly-budget-fill").style.width = `${Math.min(100, monthlyRatio * 100)}%`;
    $("#monthly-budget-fill").className = `progress-fill ${monthlyRatio >= 1 ? "over" : monthlyRatio >= .8 ? "warning" : ""}`;
    $("#monthly-budget-progress").setAttribute("aria-valuenow", String(Math.min(100, Math.round(monthlyRatio * 100))));
    const alerts = rows.filter((item) => item.ratio >= .8).sort((a, b) => b.ratio - a.ratio);
    if (monthlyRatio >= .8) alerts.unshift({ category: "Overall monthly budget", ratio: monthlyRatio, amount: monthlySpent, limit: monthlyLimit });
    $("#budget-alert").classList.toggle("hidden", alerts.length === 0);
    $("#budget-alert").classList.toggle("critical", alerts.length > 0 && alerts[0].ratio >= 1);
    $("#budget-nav-count").textContent = alerts.length ? alerts.length : "";
    if (alerts.length) {
      const top = alerts[0];
      $("#budget-alert-copy").textContent = top.ratio >= 1
        ? `${top.category} is ${money(top.amount - top.limit, 0)} over its monthly limit.`
        : `${top.category} is ${Math.round(top.ratio * 100)}% of its monthly limit.`;
    }
  }

  function openBudgetModal() {
    $("#budget-form").reset();
    $("#budget-type").value = "monthly";
    $("#budget-category").innerHTML = Object.keys(data.budgets).map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    $("#budget-amount").value = data.monthlyBudget || 3200;
    $("#budget-category-field").classList.add("hidden");
    openModal("budget-modal");
  }

  function openGoalModal(goal = null) {
    $("#goal-form").reset();
    $("#goal-id").value = goal ? goal.id : "";
    $("#goal-name").value = goal ? goal.name : "";
    $("#goal-target").value = goal ? goal.target : "";
    $("#goal-saved").value = goal ? goal.saved : 0;
    const today = new Date();
    const targetMonth = new Date(today.getFullYear(), today.getMonth() + 6, 1);
    const targetDay = Math.min(today.getDate(), new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate());
    $("#goal-deadline").value = goal ? goal.deadline : dateString(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), targetDay));
    $("#goal-modal-title").textContent = goal ? "Update savings goal" : "Create a savings goal";
    openModal("goal-modal");
  }

  function renderGoals() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysPerMonth = 30.4375;
    $("#goal-list").innerHTML = data.goals.length ? data.goals.map((goal) => {
      const remaining = Math.max(0, Number(goal.target) - Number(goal.saved));
      const ratio = goal.target > 0 ? Math.min(1, Number(goal.saved) / Number(goal.target)) : 0;
      const deadline = parseDate(goal.deadline);
      const months = Math.max(1, Math.ceil(Math.max(0, deadline - today) / (daysPerMonth * 86400000)));
      const monthly = remaining / months;
      const complete = remaining === 0;
      const overdue = !complete && deadline < today;
      return `<div class="goal-item"><div class="goal-top"><span class="goal-icon">✳</span><span class="goal-name"><strong>${escapeHtml(goal.name)}</strong><small>${complete ? "Goal reached!" : overdue ? `Past target date · ${money(remaining, 0)} to go` : `Target ${escapeHtml(formatDate(goal.deadline))}`}</small></span><button class="goal-menu" type="button" aria-label="Edit ${escapeHtml(goal.name)}" data-edit-goal="${escapeHtml(goal.id)}">✎</button></div><div class="goal-progress"><div class="progress-track" role="progressbar" aria-valuenow="${Math.round(ratio * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(goal.name)} savings progress"><div class="progress-fill" style="width:${ratio * 100}%"></div></div><strong>${Math.round(ratio * 100)}%</strong></div><div class="goal-details"><span>${money(goal.saved, 0)} saved <i>·</i> ${money(goal.target, 0)} goal</span><span>${complete ? "Complete" : overdue ? "Monthly plan paused" : `${money(monthly, 0)}/mo needed`}</span></div></div>`;
    }).join("") : `<div class="goals-empty"><span>✳</span><strong>Start with a goal</strong><p>Plan your next big purchase or build up your savings.</p><button class="text-button" type="button" data-create-goal>Create a savings goal →</button></div>`;
  }

  function renderRecurring() {
    const items = [...data.recurring].sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    const icons = { Housing: "⌂", Utilities: "ϟ", Entertainment: "♫", Health: "+", "Food & dining": "⌁", Transport: "↗" };
    $("#recurring-list").innerHTML = items.length ? items.slice(0, 5).map((item) => {
      const due = parseDate(item.nextDate);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const days = Math.round((due - today) / 86400000);
      const dueText = days < 0 ? "Overdue" : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due ${formatDate(item.nextDate)}`;
      return `<div class="recurring-item"><span class="recurring-icon">${icons[item.category] || "↻"}</span><span class="recurring-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(dueText)}</small></span><span class="recurring-price"><strong>${money(item.amount)}</strong><button type="button" data-pay-recurring="${escapeHtml(item.id)}">Mark paid</button></span></div>`;
    }).join("") : `<p class="recurring-empty">No upcoming bills. Add a recurring payment to keep track.</p>`;
    $("#recurring-total").textContent = money(items.reduce((sum, item) => sum + Number(item.amount), 0));
  }

  function renderInsight() {
    const current = thisMonthTransactions();
    const previous = thisMonthTransactions(-1);
    const spentNow = total("expense", current);
    const spentLast = total("expense", previous);
    const categoryTotals = current.filter((item) => item.type === "expense").reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + Number(item.amount);
      return result;
    }, {});
    const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    let insight = "Add a few transactions to uncover a spending insight.";
    if (top) {
      if (spentLast && spentNow < spentLast) insight = `You've spent ${Math.round((1 - spentNow / spentLast) * 100)}% less than last month. ${top[0]} is your biggest category so far.`;
      else if (spentLast && spentNow > spentLast) insight = `Your spending is up ${Math.round((spentNow / spentLast - 1) * 100)}% vs. last month. ${top[0]} is your biggest category.`;
      else insight = `${top[0]} is your biggest expense category at ${money(top[1], 0)} this month.`;
    }
    $("#insight-copy").textContent = insight;
  }

  function renderCategoryFilterOptions() {
    const select = $("#category-filter");
    const previous = select.value || "all";
    const categories = [...new Set(data.transactions.map((item) => item.category))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = `<option value="all">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
    if (categories.includes(previous)) select.value = previous;
  }

  function updateCategoryOptions(type) {
    const select = $("#transaction-category");
    if (!select) return;
    const current = select.value;
    select.innerHTML = CATEGORIES[type].map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    if (CATEGORIES[type].includes(current)) select.value = current;
  }

  function getFilteredTransactions() {
    const query = $("#search-filter").value.trim().toLowerCase();
    const type = $("#type-filter").value;
    const category = $("#category-filter").value;
    const from = $("#date-from").value;
    const to = $("#date-to").value;
    const min = $("#amount-min").value === "" ? null : Number($("#amount-min").value);
    const max = $("#amount-max").value === "" ? null : Number($("#amount-max").value);
    return [...data.transactions].filter((item) => {
      const matchesQuery = !query || `${item.description} ${item.category} ${item.note || ""}`.toLowerCase().includes(query);
      return matchesQuery && (type === "all" || item.type === type) && (category === "all" || item.category === category)
        && (!from || item.date >= from) && (!to || item.date <= to)
        && (min === null || Number(item.amount) >= min) && (max === null || Number(item.amount) <= max);
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  function renderTransactions() {
    lastFiltered = getFilteredTransactions();
    const visible = lastFiltered.slice(0, 8);
    const tbody = $("#transaction-list");
    tbody.innerHTML = visible.map((item) => {
      const income = item.type === "income";
      const icon = CATEGORY_ICONS[item.category] || (income ? "↙" : "◦");
      return `<tr><td><div class="transaction-cell"><span class="transaction-icon ${income ? "" : "expense-icon-cell"}">${icon}</span><span><span class="transaction-title">${escapeHtml(item.description)}</span>${item.note ? `<span class="transaction-note">${escapeHtml(item.note)}</span>` : ""}</span></div></td><td>${escapeHtml(formatDate(item.date))}</td><td><span class="category-pill">${escapeHtml(item.category)}</span></td><td class="amount ${item.type}">${income ? "+" : "−"}${money(item.amount)}</td><td><div class="row-actions"><button type="button" aria-label="Edit ${escapeHtml(item.description)}" data-edit-transaction="${escapeHtml(item.id)}">✎</button><button type="button" aria-label="Delete ${escapeHtml(item.description)}" data-delete-transaction="${escapeHtml(item.id)}">×</button></div></td></tr>`;
    }).join("");
    $("#transaction-count").textContent = lastFiltered.length > visible.length ? `Showing ${visible.length} of ${lastFiltered.length} transactions` : `Showing ${lastFiltered.length} transaction${lastFiltered.length === 1 ? "" : "s"}`;
    $("#empty-transactions").classList.toggle("hidden", lastFiltered.length > 0);
    $(".transaction-table").classList.toggle("hidden", lastFiltered.length === 0);
  }

  function showToast(message, error = false) {
    const toast = document.createElement("div");
    toast.className = `toast${error ? " error" : ""}`;
    toast.textContent = message;
    $("#toast-region").append(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("hidden");
    const field = modal.querySelector("input:not([type=hidden]), select");
    if (field) window.setTimeout(() => field.focus(), 20);
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
  }

  function openTransaction(transaction) {
    const form = $("#transaction-form");
    form.reset();
    $("#transaction-id").value = transaction ? transaction.id : "";
    $("#transaction-type").value = transaction ? transaction.type : "expense";
    updateCategoryOptions($("#transaction-type").value);
    $("#transaction-amount").value = transaction ? transaction.amount : "";
    $("#transaction-description").value = transaction ? transaction.description : "";
    $("#transaction-category").value = transaction ? transaction.category : CATEGORIES[$("#transaction-type").value][0];
    $("#transaction-date").value = transaction ? transaction.date : dateString(new Date());
    $("#transaction-note").value = transaction ? transaction.note || "" : "";
    $("#transaction-modal-title").textContent = transaction ? "Edit transaction" : "Add transaction";
    openModal("transaction-modal");
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    if (!lastFiltered.length) {
      showToast("There are no transactions to export.", true);
      return;
    }
    const rows = [["Date", "Description", "Type", "Category", "Amount", "Note"], ...lastFiltered.map((item) => [item.date, item.description, item.type, item.category, Number(item.amount).toFixed(2), item.note || ""])];
    const content = `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `financial-report-transactions-${dateString(new Date())}.csv`;
    document.body.append(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${lastFiltered.length} transaction${lastFiltered.length === 1 ? "" : "s"}.`);
  }

  async function derivePassword(password, salt) {
    if (!globalThis.crypto?.subtle) throw new Error("Secure browser cryptography is unavailable. Open this page on localhost or in a modern browser.");
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, key, 256);
    return [...new Uint8Array(bits)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  function openAuth(mode = "login") {
    authMode = mode;
    $("#auth-form").reset();
    $("#auth-error").classList.add("hidden");
    $("#auth-title").textContent = mode === "login" ? "Welcome back" : "Create your account";
    $("#auth-intro").textContent = mode === "login" ? "Sign in to your local Financial Report workspace." : "Your finance workspace stays in this browser.";
    $("#auth-name-field").classList.toggle("hidden", mode !== "register");
    $("#auth-name").required = mode === "register";
    $("#auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("#auth-password").minLength = mode === "login" ? 1 : 8;
    $("#auth-mode-toggle").textContent = mode === "login" ? "Create account" : "Back to sign in";
    $("#auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
    openModal("auth-modal");
  }

  function showAuthError(message) {
    $("#auth-error").textContent = message;
    $("#auth-error").classList.remove("hidden");
  }

  async function submitAuth(event) {
    event.preventDefault();
    const email = $("#auth-email").value.trim().toLowerCase();
    const password = $("#auth-password").value;
    $("#auth-error").classList.add("hidden");
    const users = readJson("northstar-users-v1", {});
    try {
      if (authMode === "register") {
        if (password.length < 8) return showAuthError("Use a password with at least 8 characters.");
        if (users[email]) return showAuthError("An account with this email already exists in this browser.");
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await derivePassword(password, salt);
        const name = $("#auth-name").value.trim() || email.split("@")[0];
        users[email] = { name, salt: [...salt], hash };
        localStorage.setItem("northstar-users-v1", JSON.stringify(users));
        loadAccount(email, name);
        $("#auth-modal").classList.remove("auth-gate");
        closeModal($("#auth-modal"));
        showToast("Your local workspace is ready.");
      } else {
        const user = users[email];
        if (!user) return showAuthError("No local account found for that email. Create an account in this browser first.");
        const hash = await derivePassword(password, new Uint8Array(user.salt));
        if (hash !== user.hash) return showAuthError("That email and password do not match.");
        loadAccount(email, user.name);
        $("#auth-modal").classList.remove("auth-gate");
        closeModal($("#auth-modal"));
        showToast("Signed in to your local workspace.");
      }
    } catch (error) {
      console.error("Local authentication failed.", error);
      showAuthError(error instanceof Error ? error.message : "Could not complete sign in.");
    }
  }

  function logout() {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (error) {
      console.error("Could not clear the local session.", error);
    }
    auth = null;
    isDemo = true;
    activeUser = { email: "demo@moneyflow.app", name: "Alex Morgan" };
    data = demoData();
    $("#app-shell").classList.add("hidden");
    $("#auth-modal").classList.add("auth-gate");
    $("#profile-menu").classList.add("hidden");
    $("#profile-button").setAttribute("aria-expanded", "false");
    openAuth("login");
  }

  function addRecurringPayment(id) {
    const item = data.recurring.find((entry) => entry.id === id);
    if (!item) return;
    data.transactions.push({ id: uid(), date: dateString(new Date()), description: item.name, category: item.category, amount: Number(item.amount), type: "expense", note: "Recurring payment" });
    const next = parseDate(item.nextDate);
    const targetDay = next.getDate();
    next.setMonth(next.getMonth() + 1);
    if (next.getDate() < targetDay) next.setDate(0);
    item.nextDate = dateString(next);
    saveData(); render();
    showToast(`${item.name} marked paid and added to transactions.`);
  }

  function bindEvents() {
    $("#add-transaction").addEventListener("click", () => openTransaction(null));
    $("#transaction-type").addEventListener("change", (event) => updateCategoryOptions(event.target.value));
    $("#transaction-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const id = $("#transaction-id").value;
      const amount = Number($("#transaction-amount").value);
      if (!Number.isFinite(amount) || amount <= 0) return showToast("Enter an amount greater than zero.", true);
      const item = {
        id: id || uid(), type: $("#transaction-type").value, amount,
        description: $("#transaction-description").value.trim(), category: $("#transaction-category").value,
        date: $("#transaction-date").value, note: $("#transaction-note").value.trim()
      };
      if (id) data.transactions = data.transactions.map((entry) => entry.id === id ? item : entry);
      else data.transactions.push(item);
      saveData(); closeModal($("#transaction-modal")); render();
      showToast(id ? "Transaction updated." : "Transaction added.");
    });
    $("#transaction-list").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-transaction]");
      const remove = event.target.closest("[data-delete-transaction]");
      if (edit) {
        const item = data.transactions.find((entry) => entry.id === edit.dataset.editTransaction);
        if (item) openTransaction(item);
      } else if (remove) {
        const item = data.transactions.find((entry) => entry.id === remove.dataset.deleteTransaction);
        if (item && window.confirm(`Delete "${item.description}"?`)) {
          data.transactions = data.transactions.filter((entry) => entry.id !== item.id);
          saveData(); render(); showToast("Transaction deleted.");
        }
      }
    });
    ["search-filter", "type-filter", "category-filter", "date-from", "date-to", "amount-min", "amount-max"].forEach((id) => {
      $(`#${id}`).addEventListener(id === "search-filter" ? "input" : "change", renderTransactions);
    });
    $("#advanced-filter-toggle").addEventListener("click", () => {
      const filters = $("#advanced-filters");
      filters.classList.toggle("hidden");
      $("#advanced-filter-toggle").setAttribute("aria-expanded", String(!filters.classList.contains("hidden")));
    });
    $("#clear-filters").addEventListener("click", () => {
      $("#date-from").value = ""; $("#date-to").value = ""; $("#amount-min").value = ""; $("#amount-max").value = "";
      $("#search-filter").value = ""; $("#type-filter").value = "all"; $("#category-filter").value = "all"; renderTransactions();
    });
    $("#export-csv").addEventListener("click", exportCsv);
    $("#view-all").addEventListener("click", () => {
      $("#search-filter").value = ""; $("#type-filter").value = "all"; $("#category-filter").value = "all";
      $("#date-from").value = ""; $("#date-to").value = ""; $("#amount-min").value = ""; $("#amount-max").value = "";
      renderTransactions(); $("#transaction-list").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    $("#chart-period").addEventListener("change", (event) => {
      selectedMonths = Number(event.target.value);
      drawCashflow(); drawExpenseTrend();
      $("#trend-period-label").textContent = `Last ${selectedMonths} months`;
    });
    $("#cashflow-chart").addEventListener("mousemove", (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const point = chartPoints.find((entry) => x >= entry.left && x <= entry.right);
      const tooltip = $("#chart-tooltip");
      if (!point) return tooltip.classList.add("hidden");
      tooltip.innerHTML = `<strong>${escapeHtml(point.label)}</strong><br>Income ${money(point.income)} · Expenses ${money(point.expense)}`;
      tooltip.style.left = `${Math.max(3, Math.min(rect.width - 195, x + 10))}px`;
      tooltip.style.top = "5px"; tooltip.classList.remove("hidden");
    });
    $("#cashflow-chart").addEventListener("mouseleave", () => $("#chart-tooltip").classList.add("hidden"));
    $("#edit-budgets").addEventListener("click", openBudgetModal);
    $("#budget-type").addEventListener("change", (event) => {
      const categoryMode = event.target.value === "category";
      $("#budget-category-field").classList.toggle("hidden", !categoryMode);
      $("#budget-amount").value = categoryMode ? data.budgets[$("#budget-category").value] || "" : data.monthlyBudget || "";
    });
    $("#budget-category").addEventListener("change", (event) => {
      if ($("#budget-type").value === "category") $("#budget-amount").value = data.budgets[event.target.value] || "";
    });
    $("#budget-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const amount = Number($("#budget-amount").value);
      if (!Number.isFinite(amount) || amount <= 0) return showToast("Enter a budget greater than zero.", true);
      if ($("#budget-type").value === "monthly") {
        data.monthlyBudget = amount;
        showToast("Overall monthly budget updated.");
      } else {
        const category = $("#budget-category").value;
        data.budgets[category] = amount;
        showToast(`${category} budget updated.`);
      }
      saveData(); closeModal($("#budget-modal")); render();
    });
    $("#add-goal").addEventListener("click", () => openGoalModal());
    $("#goal-list").addEventListener("click", (event) => {
      if (event.target.closest("[data-create-goal]")) return openGoalModal();
      const button = event.target.closest("[data-edit-goal]");
      if (!button) return;
      const goal = data.goals.find((item) => item.id === button.dataset.editGoal);
      if (goal) openGoalModal(goal);
    });
    $("#goal-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const target = Number($("#goal-target").value);
      const saved = Number($("#goal-saved").value);
      if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(saved) || saved < 0 || saved > target) {
        return showToast("Saved amount must be between zero and the target amount.", true);
      }
      const id = $("#goal-id").value;
      const goal = { id: id || uid(), name: $("#goal-name").value.trim(), target, saved, deadline: $("#goal-deadline").value };
      if (id) data.goals = data.goals.map((item) => item.id === id ? goal : item);
      else data.goals.push(goal);
      saveData(); closeModal($("#goal-modal")); render();
      showToast(id ? "Savings goal updated." : "Savings goal created.");
    });
    $("#add-recurring").addEventListener("click", () => {
      $("#recurring-form").reset();
      $("#recurring-date").value = dateString(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
      $("#recurring-category").innerHTML = CATEGORIES.expense.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
      openModal("recurring-modal");
    });
    $("#recurring-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const amount = Number($("#recurring-amount").value);
      if (!Number.isFinite(amount) || amount <= 0) return showToast("Enter an amount greater than zero.", true);
      data.recurring.push({ id: uid(), name: $("#recurring-name").value.trim(), amount, category: $("#recurring-category").value, nextDate: $("#recurring-date").value });
      saveData(); closeModal($("#recurring-modal")); render(); showToast("Recurring bill added.");
    });
    $("#recurring-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-pay-recurring]");
      if (button) addRecurringPayment(button.dataset.payRecurring);
    });
    $("#profile-button").addEventListener("click", () => {
      const menu = $("#profile-menu");
      menu.classList.toggle("hidden");
      $("#profile-button").setAttribute("aria-expanded", String(!menu.classList.contains("hidden")));
    });
    $("#auth-action").addEventListener("click", () => { $("#profile-menu").classList.add("hidden"); openAuth("login"); });
    $("#logout-action").addEventListener("click", logout);
    $("#auth-mode-toggle").addEventListener("click", () => openAuth(authMode === "login" ? "register" : "login"));
    $("#auth-form").addEventListener("submit", submitAuth);
    $("#theme-toggle").addEventListener("click", () => {
      const dark = document.documentElement.dataset.theme !== "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      localStorage.setItem("northstar-theme-v1", dark ? "dark" : "light");
      $("#theme-toggle").setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
      $("#theme-icon").textContent = dark ? "☀" : "☾";
      drawCategories(); drawCashflow(); drawExpenseTrend();
    });
    $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop"))));
    $$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal(backdrop);
    }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") $$(".modal-backdrop:not(.hidden)").forEach(closeModal);
    });
    $("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("mobile-open"));
    $$(".nav-link").forEach((link) => link.addEventListener("click", () => {
      $$(".nav-link").forEach((item) => item.classList.toggle("active", item === link));
      $(".sidebar").classList.remove("mobile-open");
    }));
    window.addEventListener("resize", renderCharts);
  }

  function initialize() {
    const savedTheme = readJson(AUTH_KEY, null);
    const theme = localStorage.getItem("northstar-theme-v1");
    const darkTheme = theme !== "light";
    document.documentElement.dataset.theme = darkTheme ? "dark" : "light";
    $("#theme-icon").textContent = darkTheme ? "☀" : "☾";
    $("#theme-toggle").setAttribute("aria-label", `Switch to ${darkTheme ? "light" : "dark"} mode`);
    let hasSession = false;
    if (savedTheme?.email) {
      auth = savedTheme;
      const users = readJson("northstar-users-v1", {});
      if (users[auth.email]) {
        hasSession = true;
        activeUser = { email: auth.email, name: users[auth.email].name };
        isDemo = false;
        const saved = readJson(storageKey(auth.email), null);
        if (saved && Array.isArray(saved.transactions)) data = { transactions: saved.transactions, budgets: { ...DEFAULT_BUDGETS, ...saved.budgets }, monthlyBudget: Number(saved.monthlyBudget) || 3200, goals: Array.isArray(saved.goals) ? saved.goals : [], recurring: Array.isArray(saved.recurring) ? saved.recurring : [] };
      }
    }
    bindEvents();
    if (hasSession) {
      $("#app-shell").classList.remove("hidden");
      render();
    } else {
      $("#auth-modal").classList.add("auth-gate");
      openAuth("login");
    }
  }

  initialize();
})();
