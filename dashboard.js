// ============================================================
// Employee dashboard — read-only summary of my profile, skills,
// and current project allocations.
// ============================================================
requireAuth(["Employee", "Manager", "Admin"]);
document.getElementById("user-chip").textContent = getUsername() + " · " + getRole();

const LEVEL_LABELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced", 4: "Expert" };

async function load() {
  try {
    const me = await getCurrentUser();
    if (!me.employee_id) {
      showError("This login account isn't linked to an employee record yet. Ask an admin to link it.");
      return;
    }

    const [employee, skills, allocations] = await Promise.all([
      apiRequest(`/employees/${me.employee_id}`),
      apiRequest("/skills/"),
      apiRequest(`/allocations/?employee_id=${me.employee_id}`),
    ]);

    document.getElementById("page-title").textContent = "Hi, " + employee.full_name.split(" ")[0];
    document.getElementById("profile-designation").textContent = employee.designation;
    document.getElementById("profile-dept").textContent = employee.employment_type + " · joined " + employee.date_of_joining;
    document.getElementById("profile-status").textContent = employee.availability_status;
    document.getElementById("profile-exp").textContent = employee.experience_years;
    document.getElementById("profile-skill-count").textContent = employee.skills.length;

    const activeAllocations = allocations.filter((a) => a.status === "Active");
    document.getElementById("profile-alloc-count").textContent = activeAllocations.length;

    // ---- skills ----
    const skillsHtml = employee.skills.map((s) => {
      const skill = skills.find((sk) => (sk.id || sk._id) === s.skill_id);
      return `<span class="skill-chip">${skill ? skill.skill_name : "Unknown"} — ${LEVEL_LABELS[s.proficiency_level]}${s.certified ? " ✓" : ""}</span>`;
    }).join("");
    document.getElementById("skills-list").innerHTML =
      skillsHtml || '<p class="empty-state">No skills logged yet — head to "Manage skills" to add some.</p>';

    // ---- allocations / projects ----
    if (allocations.length) {
      const projects = await apiRequest("/projects/");
      const rows = allocations.map((a) => {
        const proj = projects.find((p) => (p.id || p._id) === a.project_id);
        const statusClass = a.status === "Active" ? "badge-green" : a.status === "Removed" ? "badge-red" : "badge-gray";
        return `<tr>
          <td>${proj ? proj.project_name : "—"}</td>
          <td>${a.role_in_project}</td>
          <td>${a.allocation_percentage}%</td>
          <td><span class="badge ${statusClass}">${a.status}</span></td>
        </tr>`;
      }).join("");
      document.querySelector("#alloc-table tbody").innerHTML = rows;
    } else {
      document.getElementById("alloc-empty").style.display = "block";
    }
  } catch (err) {
    showError(err.message);
  }
}

load();
