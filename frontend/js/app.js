// ============================================
// Expense Tracker — Frontend (Phase 2)
// Every feature here talks to the backend API from Phase 1.
// ============================================

const API_URL = "http://localhost:3000/api/expenses";
const ALLOWED_CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Other"];

// Bootstrap has ready-made badge colors - we just map each category to one.
const CATEGORY_BADGE_CLASS = {
  Food: "bg-success",
  Transport: "bg-primary",
  Bills: "bg-warning text-dark",
  Entertainment: "bg-info text-dark",
  Other: "bg-secondary",
};

// Keep the full list in memory so filtering doesn't need a new request.
let allExpenses = [];
// The list actually on screen right now (after filtering) - CSV export uses this.
let currentlyDisplayed = [];

// ---- Cached DOM elements ----
const alertZone = document.getElementById("alert-zone");
const loadingSpinner = document.getElementById("loading-spinner");
const emptyState = document.getElementById("empty-state");
const tbody = document.getElementById("expenses-tbody");
const filterSelect = document.getElementById("filter-category");

const summaryTotal = document.getElementById("summary-total");
const summaryCount = document.getElementById("summary-count");
const summaryHighest = document.getElementById("summary-highest");
const summaryHighestTitle = document.getElementById("summary-highest-title");

const addForm = document.getElementById("expense-form");
const submitBtn = document.getElementById("submit-btn");

const editModalEl = document.getElementById("edit-modal");
const editModal = new bootstrap.Modal(editModalEl);
const saveEditBtn = document.getElementById("save-edit-btn");

// ============================================
// Small helpers
// ============================================

function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

function showAlert(message, type = "danger") {
  alertZone.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function clearAlert() {
  alertZone.innerHTML = "";
}

function setFieldError(errorEl, inputEl, message) {
  if (message) {
    errorEl.textContent = message;
    inputEl.classList.add("is-invalid");
  } else {
    errorEl.textContent = "";
    inputEl.classList.remove("is-invalid");
  }
}

// ============================================
// Client-side validation
// Mirrors the rules the backend enforces, so the user gets
// instant feedback instead of waiting on a 400 response.
// ============================================
function validateExpenseInput({ title, amount, category, date }) {
  const errors = {};

  if (!title || title.trim().length === 0) {
    errors.title = "Title is required.";
  }

  const numericAmount = Number(amount);
  if (amount === "" || amount === null || isNaN(numericAmount) || numericAmount <= 0) {
    errors.amount = "Amount must be a number greater than 0.";
  }

  if (!ALLOWED_CATEGORIES.includes(category)) {
    errors.category = "Please choose a category.";
  }

  if (!date) {
    errors.date = "Date is required.";
  }

  return errors;
}

// ============================================
// Rendering
// ============================================

function renderSummary(expenses) {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  let highest = null;
  for (const e of expenses) {
    if (!highest || Number(e.amount) > Number(highest.amount)) {
      highest = e;
    }
  }

  summaryTotal.textContent = formatAmount(total);
  summaryCount.textContent = expenses.length;
  summaryHighest.textContent = formatAmount(highest ? highest.amount : 0);
  summaryHighestTitle.textContent = highest ? highest.title : "";
}

function renderTable(expenses) {
  tbody.innerHTML = "";

  if (expenses.length === 0) {
    emptyState.classList.remove("d-none");
    return;
  }
  emptyState.classList.add("d-none");

  for (const expense of expenses) {
    const badgeClass = CATEGORY_BADGE_CLASS[expense.category] || "bg-secondary";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(expense.title)}</td>
      <td>${formatAmount(expense.amount)}</td>
      <td><span class="badge ${badgeClass}">${expense.category}</span></td>
      <td>${expense.date}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary edit-btn" data-id="${expense.id}">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${expense.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// Prevents user-entered text (like an expense title) from being
// interpreted as HTML when we inject it with innerHTML.
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Summary cards always reflect ALL expenses, never the filtered list
// (this matches the Roadmap requirement explicitly).
function renderAll() {
  const selectedCategory = filterSelect.value;
  const filtered =
    selectedCategory === "All"
      ? allExpenses
      : allExpenses.filter((e) => e.category === selectedCategory);

  renderSummary(allExpenses);
  renderTable(filtered);
  currentlyDisplayed = filtered;
}

// ============================================
// API calls
// ============================================

async function loadExpenses() {
  loadingSpinner.classList.remove("d-none");
  tbody.innerHTML = "";
  emptyState.classList.add("d-none");
  clearAlert();

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("The server responded with an error.");
    }

    allExpenses = await response.json();
    renderAll();
  } catch (err) {
    console.error(err);
    showAlert(
      "Couldn't load your expenses. Make sure the server is running, then refresh the page."
    );
  } finally {
    loadingSpinner.classList.add("d-none");
  }
}

async function createExpense(data) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message || "Could not add the expense.");
  }

  return body;
}

async function updateExpense(id, data) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message || "Could not update the expense.");
  }

  return body;
}

async function deleteExpense(id) {
  const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message || "Could not delete the expense.");
  }

  return body;
}

// ============================================
// Event: Add expense form
// ============================================

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();

  const titleInput = document.getElementById("input-title");
  const amountInput = document.getElementById("input-amount");
  const categoryInput = document.getElementById("input-category");
  const dateInput = document.getElementById("input-date");

  const data = {
    title: titleInput.value.trim(),
    amount: amountInput.value,
    category: categoryInput.value,
    date: dateInput.value,
  };

  const errors = validateExpenseInput(data);

  setFieldError(document.getElementById("error-title"), titleInput, errors.title);
  setFieldError(document.getElementById("error-amount"), amountInput, errors.amount);
  setFieldError(document.getElementById("error-category"), categoryInput, errors.category);
  setFieldError(document.getElementById("error-date"), dateInput, errors.date);

  if (Object.keys(errors).length > 0) {
    return; // stop here, don't call the API with bad data
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Adding…";

  try {
    await createExpense({ ...data, amount: Number(data.amount) });
    addForm.reset();
    await loadExpenses(); // ask the server for the truth again
  } catch (err) {
    console.error(err);
    showAlert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add expense";
  }
});

// ============================================
// Event: Filter dropdown
// ============================================

filterSelect.addEventListener("change", () => {
  renderAll();
});

// ============================================
// Event: Table row buttons (edit / delete)
// Using event delegation since rows are created dynamically.
// ============================================

tbody.addEventListener("click", async (event) => {
  const editBtn = event.target.closest(".edit-btn");
  const deleteBtn = event.target.closest(".delete-btn");

  if (editBtn) {
    openEditModal(editBtn.dataset.id);
  }

  if (deleteBtn) {
    await handleDelete(deleteBtn.dataset.id);
  }
});

async function handleDelete(id) {
  const confirmed = confirm("Delete this expense? This can't be undone.");
  if (!confirmed) return;

  clearAlert();
  try {
    await deleteExpense(id);
    await loadExpenses();
  } catch (err) {
    console.error(err);
    showAlert(err.message);
  }
}

// ============================================
// Edit modal
// ============================================

function openEditModal(id) {
  const expense = allExpenses.find((e) => String(e.id) === String(id));
  if (!expense) return;

  document.getElementById("edit-id").value = expense.id;
  document.getElementById("edit-title").value = expense.title;
  document.getElementById("edit-amount").value = expense.amount;
  document.getElementById("edit-category").value = expense.category;
  document.getElementById("edit-date").value = expense.date;

  // clear any leftover validation state from a previous open
  ["title", "amount", "category", "date"].forEach((field) => {
    const input = document.getElementById(`edit-${field}`);
    const error = document.getElementById(`edit-error-${field}`);
    setFieldError(error, input, null);
  });

  editModal.show();
}

saveEditBtn.addEventListener("click", async () => {
  const id = document.getElementById("edit-id").value;

  const titleInput = document.getElementById("edit-title");
  const amountInput = document.getElementById("edit-amount");
  const categoryInput = document.getElementById("edit-category");
  const dateInput = document.getElementById("edit-date");

  const data = {
    title: titleInput.value.trim(),
    amount: amountInput.value,
    category: categoryInput.value,
    date: dateInput.value,
  };

  const errors = validateExpenseInput(data);

  setFieldError(document.getElementById("edit-error-title"), titleInput, errors.title);
  setFieldError(document.getElementById("edit-error-amount"), amountInput, errors.amount);
  setFieldError(document.getElementById("edit-error-category"), categoryInput, errors.category);
  setFieldError(document.getElementById("edit-error-date"), dateInput, errors.date);

  if (Object.keys(errors).length > 0) {
    return;
  }

  saveEditBtn.disabled = true;
  saveEditBtn.textContent = "Saving…";

  try {
    await updateExpense(id, { ...data, amount: Number(data.amount) });
    editModal.hide();
    await loadExpenses();
  } catch (err) {
    console.error(err);
    showAlert(err.message);
  } finally {
    saveEditBtn.disabled = false;
    saveEditBtn.textContent = "Save changes";
  }
});

// ============================================
// BONUS: Export to CSV
// Turns the array of expenses into CSV text, then triggers a real
// file download using a Blob - no external library needed.
// ============================================

function csvEscape(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function expensesToCsv(expenses) {
  const header = ["Title", "Amount", "Category", "Date"];
  const rows = expenses.map((e) => [
    csvEscape(e.title),
    csvEscape(e.amount),
    csvEscape(e.category),
    csvEscape(e.date),
  ]);

  return [header, ...rows].map((row) => row.join(",")).join("\n");
}

function downloadCsv(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

document.getElementById("export-csv-btn").addEventListener("click", () => {
  if (currentlyDisplayed.length === 0) {
    showAlert("There's nothing to export yet.", "warning");
    return;
  }

  const csvText = expensesToCsv(currentlyDisplayed);
  const today = new Date().toISOString().slice(0, 10);
  downloadCsv(csvText, `expenses-${today}.csv`);
});

// ============================================
// Initial load
// ============================================

loadExpenses();