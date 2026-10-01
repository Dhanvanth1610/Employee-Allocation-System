// ============================================================
// Allocation console — pick a project, see employees ranked by
// skill match, and assign them with a role/percentage/date.
// ============================================================
requireAuth(["Manager", "Admin"]);
document.getElementById("user-chip").textContent = getUsername() + " · " + getRole();

let projects = [];
let currentProject = null;

function openModal(title, bodyHtml) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("modal-overlay").classList.add("open");
}
function closeModal() { document.getElementById("modal-overlay").classList.remove("open"); }
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});

async function init() {
  try {
    projects = await apiRequest("/projects/");
    document.getElementById("project-select").innerHTML =
      '<option value="">— choose a project —</option>' +
      projects.map((p) => `<option value="${p.id || p._id}">${p.project_name} (${p.status})</option>`).join("");
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById("project-select").addEventListener("change", async (e) => {
  const id = e.target.value;
  if (!id) {
    currentProject = null;
    document.getElementById("project-summary").textContent = "";
    document.getElementById("candidates-list").innerHTML = '<p class="empty-state">Select a project above to see candidates.</p>';
    document.querySelector("#current-alloc-table tbody").innerHTML = "";
    return;
  }
  currentProject = projects.find((p) => (p.id || p._id) === id);
  document.getElementById("project-summary").textContent =
    `${currentProject.required_skills.length} skill requirement(s) · Priority: ${currentProject.priority} · Status: ${currentProject.status}`;
  await loadCandidates(id);
  await loadCurrentAllocations(id);
});

async function loadCandidates(projectId) {
  document.getElementById("candidates-list").innerHTML = '<p class="empty-state">Loading candidates...</p>';
  try {
    const candidates = await apiRequest(`/projects/${projectId}/candidates?limit=15`);
    if (!candidates.length) {
      document.getElementById("candidates-list").innerHTML =
        '<p class="empty-state">No employees currently match this project\'s required skills. Add required skills to the project in the admin portal, or check employee skill records.</p>';
      return;
    }
    document.getElementById("candidates-list").innerHTML = candidates.map((c) => {
      const color = c.match_score >= 80 ? "#128C7E" : c.match_score >= 50 ? "#F2A541" : "#C0392B";
      return `
      <div style="display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid var(--border);">
        <div style="flex:1;">
          <strong>${c.employee.full_name}</strong>
          <div style="font-size:12px; color:var(--text-muted);">${c.employee.designation} · ${c.employee.availability_status}</div>
        </div>
        <div style="width:180px;">
          <div class="match-bar-track"><div class="match-bar-fill" style="width:${c.match_score}%; background:${color};"></div></div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">${c.match_score}% match</div>
        </div>
        <button class="btn-secondary btn-sm" onclick='openAssignForm(${JSON.stringify(c.employee.id || c.employee._id)}, "${c.employee.full_name.replace(/"/g, "")}", ${c.match_score})'>Assign</button>
      </div>`;
    }).join("");
  } catch (err) {
    showError(err.message);
  }
}

async function loadCurrentAllocations(projectId) {
  try {
    const [allocations, employees] = await Promise.all([
      apiRequest(`/allocations/?project_id=${projectId}`),
      apiRequest("/employees/"),
    ]);
    const rows = allocations.map((a) => {
      const emp = employees.find((e) => (e.id || e._id) === a.employee_id);
      const statusClass = a.status === "Active" ? "badge-green" : a.status === "Removed" ? "badge-red" : "badge-gray";
      return `<tr>
        <td>${emp ? emp.full_name : "—"}</td>
        <td>${a.role_in_project}</td>
        <td>${a.allocation_percentage}%</td>
        <td><span class="badge ${statusClass}">${a.status}</span></td>
      </tr>`;
    }).join("");
    document.querySelector("#current-alloc-table tbody").innerHTML = rows;
    document.getElementById("current-alloc-empty").style.display = allocations.length ? "none" : "block";
  } catch (err) {
    showError(err.message);
  }
}

function openAssignForm(employeeId, employeeName, matchScore) {
  openModal(`Assign ${employeeName}`, `
    <form id="assign-form">
      <label>Role on this project</label>
      <input id="assign-role" placeholder="e.g. Backend Developer" required>
      <div class="form-row">
        <div><label>Allocation %</label><input id="assign-pct" type="number" min="1" max="100" value="50" required></div>
        <div><label>Start date</label><input id="assign-start" type="date" required></div>
      </div>
      <div style="display:flex; gap:10px;">
        <button type="submit" class="btn-primary">Confirm assignment</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById("assign-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await apiRequest("/allocations/", {
        method: "POST",
        body: {
          employee_id: employeeId,
          project_id: currentProject.id || currentProject._id,
          role_in_project: document.getElementById("assign-role").value.trim(),
          allocation_percentage: parseInt(document.getElementById("assign-pct").value),
          match_score: matchScore,
          start_date: document.getElementById("assign-start").value,
        },
      });
      closeModal();
      const id = currentProject.id || currentProject._id;
      await loadCandidates(id);
      await loadCurrentAllocations(id);
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
    }
  });
}

init();
