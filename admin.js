// ============================================================
// Admin portal — all sections (dashboard, employees, projects,
// allocations, departments, skills, users) live in this one file.
// ============================================================
requireAuth(["Admin"]);
document.getElementById("user-chip").textContent = getUsername() + " · " + getRole();

// local caches, refreshed whenever their section loads — reused to build dropdowns
let cache = { departments: [], skills: [], employees: [], projects: [] };

// ---------------- navigation ----------------
document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
  item.addEventListener("click", () => showSection(item.dataset.section));
});

function showSection(name) {
  document.querySelectorAll(".nav-item[data-section]").forEach((i) => i.classList.toggle("active", i.dataset.section === name));
  document.querySelectorAll(".section-panel").forEach((p) => (p.style.display = "none"));
  document.getElementById("section-" + name).style.display = "block";
  document.getElementById("page-title").textContent = name.charAt(0).toUpperCase() + name.slice(1);
  hideError();
  const loaders = {
    dashboard: loadDashboard, employees: loadEmployees, projects: loadProjects,
    allocations: loadAllocations, departments: loadDepartments, skills: loadSkills, users: loadUsers,
  };
  loaders[name]();
}

// ---------------- modal helpers ----------------
function openModal(title, bodyHtml) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("modal-overlay").classList.add("open");
}
function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});

async function withSubmitGuard(formEl, fn) {
  const btn = formEl.querySelector("button[type=submit]");
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    await fn();
  } catch (err) {
    showError(err.message);
    btn.disabled = false; btn.textContent = original;
  }
}

function fmtDate(d) { return d ? d : "—"; }
function optionsHtml(items, valueKey, labelFn, selected) {
  return '<option value="">— none —</option>' + items.map((i) =>
    `<option value="${i[valueKey]}" ${selected === i[valueKey] ? "selected" : ""}>${labelFn(i)}</option>`
  ).join("");
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const stats = await apiRequest("/admin/stats");
    const cards = [
      ["Total employees", stats.total_employees],
      ["Available now", stats.available_employees],
      ["Departments", stats.total_departments],
      ["Total projects", stats.total_projects],
      ["Ongoing projects", stats.ongoing_projects],
      ["Active allocations", stats.active_allocations],
    ];
    document.getElementById("stat-grid").innerHTML = cards.map(([label, val]) => `
      <div class="stat-card"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>
    `).join("");
  } catch (err) { showError(err.message); }
}

// ============================================================
// DEPARTMENTS
// ============================================================
async function loadDepartments() {
  try {
    cache.departments = await apiRequest("/departments/");
    if (!cache.employees.length) cache.employees = await apiRequest("/employees/");
    const rows = cache.departments.map((d) => {
      const head = cache.employees.find((e) => e.id === d.department_head_id || e._id === d.department_head_id);
      return `<tr>
        <td>${d.department_name}</td>
        <td>${head ? head.full_name : "—"}</td>
        <td style="text-align:right;">
          <button class="btn-outline btn-sm" onclick="openDepartmentForm('${d.id || d._id}')">Edit</button>
          <button class="btn-danger btn-sm" onclick="deleteDepartment('${d.id || d._id}')">Delete</button>
        </td>
      </tr>`;
    }).join("");
    document.querySelector("#departments-table tbody").innerHTML = rows;
    document.getElementById("departments-empty").style.display = cache.departments.length ? "none" : "block";
  } catch (err) { showError(err.message); }
}

function openDepartmentForm(id) {
  const dept = id ? cache.departments.find((d) => (d.id || d._id) === id) : null;
  const employeeOptions = optionsHtml(cache.employees, "id", (e) => e.full_name, dept?.department_head_id);
  openModal(dept ? "Edit department" : "Add department", `
    <form id="dept-form">
      <label>Department name</label>
      <input id="dept-name" value="${dept ? dept.department_name : ""}" required>
      <label>Department head (optional)</label>
      <select id="dept-head">${employeeOptions}</select>
      <div style="display:flex; gap:10px; margin-top:6px;">
        <button type="submit" class="btn-primary">Save</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById("dept-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await withSubmitGuard(e.target, async () => {
      const payload = {
        department_name: document.getElementById("dept-name").value.trim(),
        department_head_id: document.getElementById("dept-head").value || null,
      };
      if (dept) await apiRequest(`/departments/${dept.id || dept._id}`, { method: "PUT", body: payload });
      else await apiRequest("/departments/", { method: "POST", body: payload });
      closeModal();
      loadDepartments();
    });
  });
}

async function deleteDepartment(id) {
  if (!confirm("Delete this department?")) return;
  try { await apiRequest(`/departments/${id}`, { method: "DELETE" }); loadDepartments(); }
  catch (err) { showError(err.message); }
}

// ============================================================
// SKILLS
// ============================================================
async function loadSkills() {
  try {
    cache.skills = await apiRequest("/skills/");
    const rows = cache.skills.map((s) => `<tr>
      <td>${s.skill_name}</td>
      <td><span class="badge badge-gray">${s.category}</span></td>
      <td style="color:var(--text-muted);">${s.description || "—"}</td>
      <td style="text-align:right;">
        <button class="btn-outline btn-sm" onclick="openSkillForm('${s.id || s._id}')">Edit</button>
        <button class="btn-danger btn-sm" onclick="deleteSkill('${s.id || s._id}')">Delete</button>
      </td>
    </tr>`).join("");
    document.querySelector("#skills-table tbody").innerHTML = rows;
    document.getElementById("skills-empty").style.display = cache.skills.length ? "none" : "block";
  } catch (err) { showError(err.message); }
}

function openSkillForm(id) {
  const skill = id ? cache.skills.find((s) => (s.id || s._id) === id) : null;
  const categories = ["Technical", "Soft Skill", "Domain", "Tool"];
  openModal(skill ? "Edit skill" : "Add skill", `
    <form id="skill-form">
      <label>Skill name</label>
      <input id="skill-name" value="${skill ? skill.skill_name : ""}" required>
      <label>Category</label>
      <select id="skill-category">
        ${categories.map((c) => `<option value="${c}" ${skill?.category === c ? "selected" : ""}>${c}</option>`).join("")}
      </select>
      <label>Description (optional)</label>
      <textarea id="skill-desc" rows="2">${skill?.description || ""}</textarea>
      <div style="display:flex; gap:10px;">
        <button type="submit" class="btn-primary">Save</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById("skill-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await withSubmitGuard(e.target, async () => {
      const payload = {
        skill_name: document.getElementById("skill-name").value.trim(),
        category: document.getElementById("skill-category").value,
        description: document.getElementById("skill-desc").value.trim() || null,
      };
      if (skill) await apiRequest(`/skills/${skill.id || skill._id}`, { method: "PUT", body: payload });
      else await apiRequest("/skills/", { method: "POST", body: payload });
      closeModal();
      loadSkills();
    });
  });
}

async function deleteSkill(id) {
  if (!confirm("Delete this skill? Employees and projects referencing it will keep the reference.")) return;
  try { await apiRequest(`/skills/${id}`, { method: "DELETE" }); loadSkills(); }
  catch (err) { showError(err.message); }
}

// ============================================================
// EMPLOYEES  (including embedded skills management)
// ============================================================
async function loadEmployees() {
  try {
    [cache.employees, cache.departments, cache.skills] = await Promise.all([
      apiRequest("/employees/"), apiRequest("/departments/"), apiRequest("/skills/"),
    ]);
    const rows = cache.employees.map((e) => {
      const id = e.id || e._id;
      const dept = cache.departments.find((d) => (d.id || d._id) === e.department_id);
      const statusClass = e.availability_status === "Available" ? "badge-green"
        : e.availability_status === "On Leave" ? "badge-red" : "badge-amber";
      return `<tr>
        <td>${e.full_name}</td>
        <td>${e.email}</td>
        <td>${e.designation}</td>
        <td>${dept ? dept.department_name : "—"}</td>
        <td><span class="badge ${statusClass}">${e.availability_status}</span></td>
        <td>${e.skills.length}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn-outline btn-sm" onclick="openEmployeeForm('${id}')">Edit</button>
          <button class="btn-secondary btn-sm" onclick="openSkillsManager('${id}')">Skills</button>
          <button class="btn-danger btn-sm" onclick="deleteEmployee('${id}')">Delete</button>
        </td>
      </tr>`;
    }).join("");
    document.querySelector("#employees-table tbody").innerHTML = rows;
    document.getElementById("employees-empty").style.display = cache.employees.length ? "none" : "block";
  } catch (err) { showError(err.message); }
}

function openEmployeeForm(id) {
  const emp = id ? cache.employees.find((e) => (e.id || e._id) === id) : null;
  const deptOptions = optionsHtml(cache.departments, "id", (d) => d.department_name, emp?.department_id);
  const statuses = ["Available", "Partially Allocated", "Fully Allocated", "On Leave"];
  const types = ["Full-time", "Contract", "Intern"];
  openModal(emp ? "Edit employee" : "Add employee", `
    <form id="emp-form">
      <label>Full name</label>
      <input id="emp-name" value="${emp ? emp.full_name : ""}" required>
      <label>Email</label>
      <input id="emp-email" type="email" value="${emp ? emp.email : ""}" ${emp ? "disabled" : ""} required>
      <div class="form-row">
        <div><label>Designation</label><input id="emp-designation" value="${emp ? emp.designation : ""}" required></div>
        <div><label>Department</label><select id="emp-dept">${deptOptions}</select></div>
      </div>
      <div class="form-row">
        <div><label>Employment type</label><select id="emp-type">${types.map((t) => `<option ${emp?.employment_type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div><label>Date of joining</label><input id="emp-doj" type="date" value="${emp ? emp.date_of_joining : ""}" ${emp ? "disabled" : ""} required></div>
      </div>
      <div class="form-row">
        <div><label>Experience (years)</label><input id="emp-exp" type="number" step="0.5" min="0" value="${emp ? emp.experience_years : 0}"></div>
        <div><label>Availability</label><select id="emp-status">${statuses.map((s) => `<option ${emp?.availability_status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <div style="display:flex; gap:10px;">
        <button type="submit" class="btn-primary">Save</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById("emp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await withSubmitGuard(e.target, async () => {
      const common = {
        full_name: document.getElementById("emp-name").value.trim(),
        designation: document.getElementById("emp-designation").value.trim(),
        department_id: document.getElementById("emp-dept").value || null,
        employment_type: document.getElementById("emp-type").value,
        experience_years: parseFloat(document.getElementById("emp-exp").value) || 0,
        availability_status: document.getElementById("emp-status").value,
      };
      if (emp) {
        await apiRequest(`/employees/${emp.id || emp._id}`, { method: "PUT", body: common });
      } else {
        await apiRequest("/employees/", {
          method: "POST",
          body: { ...common, email: document.getElementById("emp-email").value.trim(),
                   date_of_joining: document.getElementById("emp-doj").value, skills: [] },
        });
      }
      closeModal();
      loadEmployees();
    });
  });
}

async function deleteEmployee(id) {
  if (!confirm("Delete this employee? This cannot be undone.")) return;
  try { await apiRequest(`/employees/${id}`, { method: "DELETE" }); loadEmployees(); }
  catch (err) { showError(err.message); }
}

function openSkillsManager(employeeId) {
  const emp = cache.employees.find((e) => (e.id || e._id) === employeeId);
  renderSkillsManager(emp);
}

function renderSkillsManager(emp) {
  const empId = emp.id || emp._id;
  const levels = { 1: "Beginner", 2: "Intermediate", 3: "Advanced", 4: "Expert" };
  const chips = emp.skills.map((s) => {
    const skill = cache.skills.find((sk) => (sk.id || sk._id) === s.skill_id);
    return `<span class="skill-chip">${skill ? skill.skill_name : "Unknown"} — ${levels[s.proficiency_level]}
      <button onclick="removeEmployeeSkill('${empId}', '${s.skill_id}')">✕</button></span>`;
  }).join("") || '<p class="empty-state" style="padding:8px 0;">No skills added yet.</p>';

  const skillOptions = optionsHtml(cache.skills, "id", (s) => s.skill_name, null);

  openModal(`Manage skills — ${emp.full_name}`, `
    <div style="margin-bottom:16px;">${chips}</div>
    <form id="add-skill-form">
      <label>Skill</label>
      <select id="new-skill-id" required>${skillOptions}</select>
      <div class="form-row">
        <div>
          <label>Proficiency</label>
          <select id="new-skill-level">
            <option value="1">Beginner</option><option value="2">Intermediate</option>
            <option value="3" selected>Advanced</option><option value="4">Expert</option>
          </select>
        </div>
        <div><label>Years</label><input id="new-skill-years" type="number" step="0.5" min="0" value="0"></div>
      </div>
      <label><input type="checkbox" id="new-skill-cert" style="width:auto; display:inline-block; margin-right:6px;">Certified</label>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button type="submit" class="btn-primary">+ Add skill</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Close</button>
      </div>
    </form>
  `);

  document.getElementById("add-skill-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await withSubmitGuard(e.target, async () => {
      const skillId = document.getElementById("new-skill-id").value;
      if (!skillId) throw new Error("Pick a skill first");
      const payload = {
        skill_id: skillId,
        proficiency_level: parseInt(document.getElementById("new-skill-level").value),
        years_in_skill: parseFloat(document.getElementById("new-skill-years").value) || 0,
        certified: document.getElementById("new-skill-cert").checked,
      };
      const updated = await apiRequest(`/employees/${empId}/skills`, { method: "POST", body: payload });
      const idx = cache.employees.findIndex((e) => (e.id || e._id) === empId);
      cache.employees[idx] = updated;
      renderSkillsManager(updated);
      loadEmployees();
    });
  });
}

async function removeEmployeeSkill(empId, skillId) {
  try {
    const updated = await apiRequest(`/employees/${empId}/skills/${skillId}`, { method: "DELETE" });
    const idx = cache.employees.findIndex((e) => (e.id || e._id) === empId);
    cache.employees[idx] = updated;
    renderSkillsManager(updated);
    loadEmployees();
  } catch (err) { showError(err.message); }
}

// ============================================================
// PROJECTS  (including embedded required_skills management)
// ============================================================
async function loadProjects() {
  try {
    [cache.projects, cache.employees, cache.skills] = await Promise.all([
      apiRequest("/projects/"), apiRequest("/employees/"), apiRequest("/skills/"),
    ]);
    const rows = cache.projects.map((p) => {
      const id = p.id || p._id;
      const statusClass = p.status === "Ongoing" ? "badge-green" : p.status === "Cancelled" ? "badge-red" : "badge-amber";
      return `<tr>
        <td>${p.project_name}</td>
        <td>${p.client_name || "—"}</td>
        <td><span class="badge ${statusClass}">${p.status}</span></td>
        <td>${p.priority}</td>
        <td>${p.required_skills.length}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn-outline btn-sm" onclick="openProjectForm('${id}')">Edit</button>
          <button class="btn-secondary btn-sm" onclick="openRequiredSkillsManager('${id}')">Skills</button>
          <button class="btn-secondary btn-sm" onclick="viewCandidates('${id}')">Candidates</button>
          <button class="btn-danger btn-sm" onclick="deleteProject('${id}')">Delete</button>
        </td>
      </tr>`;
    }).join("");
    document.querySelector("#projects-table tbody").innerHTML = rows;
    document.getElementById("projects-empty").style.display = cache.projects.length ? "none" : "block";
  } catch (err) { showError(err.message); }
}

function openProjectForm(id) {
  const proj = id ? cache.projects.find((p) => (p.id || p._id) === id) : null;
  const managerOptions = optionsHtml(cache.employees, "id", (e) => e.full_name, proj?.project_manager_id);
  const statuses = ["Planning", "Ongoing", "On-Hold", "Completed", "Cancelled"];
  const priorities = ["Low", "Medium", "High", "Critical"];
  openModal(proj ? "Edit project" : "Add project", `
    <form id="proj-form">
      <label>Project name</label>
      <input id="proj-name" value="${proj ? proj.project_name : ""}" required>
      <div class="form-row">
        <div><label>Client</label><input id="proj-client" value="${proj?.client_name || ""}"></div>
        <div><label>Priority</label><select id="proj-priority">${priorities.map((p) => `<option ${proj?.priority === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
      </div>
      <label>Description</label>
      <textarea id="proj-desc" rows="2">${proj?.description || ""}</textarea>
      <div class="form-row">
        <div><label>Start date</label><input id="proj-start" type="date" value="${proj ? proj.start_date : ""}" ${proj ? "disabled" : ""} required></div>
        <div><label>Status</label><select id="proj-status">${statuses.map((s) => `<option ${proj?.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <label>Project manager</label>
      <select id="proj-manager">${managerOptions}</select>
      <div style="display:flex; gap:10px;">
        <button type="submit" class="btn-primary">Save</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById("proj-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await withSubmitGuard(e.target, async () => {
      const common = {
        project_name: document.getElementById("proj-name").value.trim(),
        client_name: document.getElementById("proj-client").value.trim() || null,
        description: document.getElementById("proj-desc").value.trim() || null,
        priority: document.getElementById("proj-priority").value,
        status: document.getElementById("proj-status").value,
        project_manager_id: document.getElementById("proj-manager").value || null,
      };
      if (proj) await apiRequest(`/projects/${proj.id || proj._id}`, { method: "PUT", body: common });
      else await apiRequest("/projects/", { method: "POST", body: { ...common, start_date: document.getElementById("proj-start").value, required_skills: [] } });
      closeModal();
      loadProjects();
    });
  });
}

async function deleteProject(id) {
  if (!confirm("Delete this project? Its allocations will remain but point to a missing project.")) return;
  try { await apiRequest(`/projects/${id}`, { method: "DELETE" }); loadProjects(); }
  catch (err) { showError(err.message); }
}

function openRequiredSkillsManager(projectId) {
  const proj = cache.projects.find((p) => (p.id || p._id) === projectId);
  renderRequiredSkillsManager(proj);
}

function renderRequiredSkillsManager(proj) {
  const projId = proj.id || proj._id;
  const levels = { 1: "Beginner", 2: "Intermediate", 3: "Advanced", 4: "Expert" };
  const chips = proj.required_skills.map((rs, idx) => {
    const skill = cache.skills.find((sk) => (sk.id || sk._id) === rs.skill_id);
    return `<span class="skill-chip">${skill ? skill.skill_name : "Unknown"} — ${levels[rs.required_level]} · needs ${rs.headcount_needed}
      <button onclick="removeRequiredSkill('${projId}', ${idx})">✕</button></span>`;
  }).join("") || '<p class="empty-state" style="padding:8px 0;">No required skills set yet.</p>';

  const skillOptions = optionsHtml(cache.skills, "id", (s) => s.skill_name, null);

  openModal(`Required skills — ${proj.project_name}`, `
    <div style="margin-bottom:16px;">${chips}</div>
    <form id="add-req-skill-form">
      <label>Skill</label>
      <select id="new-req-skill-id" required>${skillOptions}</select>
      <div class="form-row">
        <div>
          <label>Required level</label>
          <select id="new-req-level">
            <option value="1">Beginner</option><option value="2">Intermediate</option>
            <option value="3" selected>Advanced</option><option value="4">Expert</option>
          </select>
        </div>
        <div><label>Headcount needed</label><input id="new-req-headcount" type="number" min="1" value="1"></div>
      </div>
      <div style="display:flex; gap:10px; margin-top:6px;">
        <button type="submit" class="btn-primary">+ Add requirement</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Close</button>
      </div>
    </form>
  `);

  document.getElementById("add-req-skill-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await withSubmitGuard(e.target, async () => {
      const skillId = document.getElementById("new-req-skill-id").value;
      if (!skillId) throw new Error("Pick a skill first");
      const newList = proj.required_skills.map((rs) => ({
        skill_id: rs.skill_id, required_level: rs.required_level, headcount_needed: rs.headcount_needed,
      }));
      newList.push({
        skill_id: skillId,
        required_level: parseInt(document.getElementById("new-req-level").value),
        headcount_needed: parseInt(document.getElementById("new-req-headcount").value) || 1,
      });
      const updated = await apiRequest(`/projects/${projId}/required-skills`, { method: "PUT", body: newList });
      const idx = cache.projects.findIndex((p) => (p.id || p._id) === projId);
      cache.projects[idx] = updated;
      renderRequiredSkillsManager(updated);
      loadProjects();
    });
  });
}

async function removeRequiredSkill(projId, indexToRemove) {
  try {
    const proj = cache.projects.find((p) => (p.id || p._id) === projId);
    const newList = proj.required_skills
      .filter((_, idx) => idx !== indexToRemove)
      .map((rs) => ({ skill_id: rs.skill_id, required_level: rs.required_level, headcount_needed: rs.headcount_needed }));
    const updated = await apiRequest(`/projects/${projId}/required-skills`, { method: "PUT", body: newList });
    const idx = cache.projects.findIndex((p) => (p.id || p._id) === projId);
    cache.projects[idx] = updated;
    renderRequiredSkillsManager(updated);
    loadProjects();
  } catch (err) { showError(err.message); }
}

async function viewCandidates(projectId) {
  const proj = cache.projects.find((p) => (p.id || p._id) === projectId);
  try {
    const candidates = await apiRequest(`/projects/${projectId}/candidates`);
    const rows = candidates.length ? candidates.map((c) => `
      <div class="flex-between" style="padding:10px 0; border-bottom:1px solid var(--border);">
        <div>
          <strong>${c.employee.full_name}</strong><br>
          <span style="font-size:12px; color:var(--text-muted);">${c.employee.designation}</span>
        </div>
        <span class="badge ${c.match_score >= 80 ? "badge-green" : c.match_score >= 50 ? "badge-amber" : "badge-red"}">${c.match_score}% match</span>
      </div>
    `).join("") : '<p class="empty-state">No employees currently match this project\'s required skills.</p>';

    openModal(`Candidates — ${proj.project_name}`, `
      ${rows}
      <button type="button" class="btn-outline" style="margin-top:14px;" onclick="closeModal()">Close</button>
    `);
  } catch (err) { showError(err.message); }
}

// ============================================================
// ALLOCATIONS
// ============================================================
async function loadAllocations() {
  try {
    [cache.employees, cache.projects] = await Promise.all([apiRequest("/employees/"), apiRequest("/projects/")]);
    const allocations = await apiRequest("/allocations/");
    const rows = allocations.map((a) => {
      const id = a.id || a._id;
      const emp = cache.employees.find((e) => (e.id || e._id) === a.employee_id);
      const proj = cache.projects.find((p) => (p.id || p._id) === a.project_id);
      const statusClass = a.status === "Active" ? "badge-green" : a.status === "Removed" ? "badge-red" : "badge-gray";
      return `<tr>
        <td>${emp ? emp.full_name : "—"}</td>
        <td>${proj ? proj.project_name : "—"}</td>
        <td>${a.role_in_project}</td>
        <td>${a.allocation_percentage}%</td>
        <td>${a.match_score != null ? a.match_score + "%" : "—"}</td>
        <td><span class="badge ${statusClass}">${a.status}</span></td>
        <td style="text-align:right;">
          <button class="btn-outline btn-sm" onclick="cycleAllocationStatus('${id}', '${a.status}')">Update status</button>
          <button class="btn-danger btn-sm" onclick="deleteAllocation('${id}')">Delete</button>
        </td>
      </tr>`;
    }).join("");
    document.querySelector("#allocations-table tbody").innerHTML = rows;
    document.getElementById("allocations-empty").style.display = allocations.length ? "none" : "block";
  } catch (err) { showError(err.message); }
}

function openAllocationForm() {
  const empOptions = optionsHtml(cache.employees, "id", (e) => `${e.full_name} (${e.designation})`, null);
  const projOptions = optionsHtml(cache.projects, "id", (p) => p.project_name, null);
  openModal("New allocation", `
    <form id="alloc-form">
      <label>Employee</label>
      <select id="alloc-emp" required>${empOptions}</select>
      <label>Project</label>
      <select id="alloc-proj" required>${projOptions}</select>
      <label>Role on this project</label>
      <input id="alloc-role" placeholder="e.g. Backend Developer" required>
      <div class="form-row">
        <div><label>Allocation %</label><input id="alloc-pct" type="number" min="1" max="100" value="50" required></div>
        <div><label>Start date</label><input id="alloc-start" type="date" required></div>
      </div>
      <div style="display:flex; gap:10px;">
        <button type="submit" class="btn-primary">Create</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById("alloc-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await withSubmitGuard(e.target, async () => {
      const empId = document.getElementById("alloc-emp").value;
      const projId = document.getElementById("alloc-proj").value;
      if (!empId || !projId) throw new Error("Pick both an employee and a project");
      await apiRequest("/allocations/", {
        method: "POST",
        body: {
          employee_id: empId, project_id: projId,
          role_in_project: document.getElementById("alloc-role").value.trim(),
          allocation_percentage: parseInt(document.getElementById("alloc-pct").value),
          start_date: document.getElementById("alloc-start").value,
        },
      });
      closeModal();
      loadAllocations();
    });
  });
}

async function cycleAllocationStatus(id, currentStatus) {
  const next = { Active: "Completed", Completed: "Removed", Removed: "Active" }[currentStatus];
  try { await apiRequest(`/allocations/${id}`, { method: "PUT", body: { status: next } }); loadAllocations(); }
  catch (err) { showError(err.message); }
}

async function deleteAllocation(id) {
  if (!confirm("Delete this allocation?")) return;
  try { await apiRequest(`/allocations/${id}`, { method: "DELETE" }); loadAllocations(); }
  catch (err) { showError(err.message); }
}

// ============================================================
// USERS (login accounts)
// ============================================================
async function loadUsers() {
  try {
    const users = await apiRequest("/admin/users");
    if (!cache.employees.length) cache.employees = await apiRequest("/employees/");
    const rows = users.map((u) => {
      const id = u.id || u._id;
      const emp = cache.employees.find((e) => (e.id || e._id) === u.employee_id);
      return `<tr>
        <td>${u.username}</td>
        <td><span class="badge badge-gray">${u.role}</span></td>
        <td>${emp ? emp.full_name : "—"}</td>
        <td style="color:var(--text-muted);">${u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
        <td style="text-align:right;"><button class="btn-danger btn-sm" onclick="deleteUser('${id}')">Delete</button></td>
      </tr>`;
    }).join("");
    document.querySelector("#users-table tbody").innerHTML = rows;
    document.getElementById("users-empty").style.display = users.length ? "none" : "block";
  } catch (err) { showError(err.message); }
}

function openUserForm() {
  const empOptions = optionsHtml(cache.employees, "id", (e) => `${e.full_name} (${e.email})`, null);
  openModal("Add login account", `
    <form id="user-form">
      <label>Username</label>
      <input id="user-username" required>
      <label>Password</label>
      <input id="user-password" type="password" required minlength="6">
      <label>Role</label>
      <select id="user-role">
        <option value="Employee" selected>Employee</option>
        <option value="Manager">Manager</option>
        <option value="Admin">Admin</option>
      </select>
      <label>Linked employee (optional, for Employee/Manager roles)</label>
      <select id="user-employee">${empOptions}</select>
      <div style="display:flex; gap:10px;">
        <button type="submit" class="btn-primary">Create account</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await withSubmitGuard(e.target, async () => {
      await apiRequest("/auth/register", {
        method: "POST",
        body: {
          username: document.getElementById("user-username").value.trim(),
          password: document.getElementById("user-password").value,
          role: document.getElementById("user-role").value,
          employee_id: document.getElementById("user-employee").value || null,
        },
      });
      closeModal();
      loadUsers();
    });
  });
}

async function deleteUser(id) {
  if (!confirm("Delete this login account? The employee record itself is not affected.")) return;
  try { await apiRequest(`/admin/users/${id}`, { method: "DELETE" }); loadUsers(); }
  catch (err) { showError(err.message); }
}

// ---------------- boot ----------------
loadDashboard();
