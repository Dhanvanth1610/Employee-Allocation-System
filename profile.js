// ============================================================
// Profile setup — lets the logged-in employee edit their own
// basic details and manage their own embedded skills array.
// ============================================================
requireAuth(["Employee", "Manager", "Admin"]);
document.getElementById("user-chip").textContent = getUsername() + " · " + getRole();

const LEVEL_LABELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced", 4: "Expert" };
let myEmployeeId = null;
let allSkills = [];
let myEmployee = null;

async function load() {
  try {
    const me = await getCurrentUser();
    if (!me.employee_id) {
      showError("This login account isn't linked to an employee record yet. Ask an admin to link it.");
      document.querySelectorAll("form").forEach((f) => f.querySelectorAll("input, select, button").forEach((el) => (el.disabled = true)));
      return;
    }
    myEmployeeId = me.employee_id;

    [myEmployee, allSkills] = await Promise.all([
      apiRequest(`/employees/${myEmployeeId}`),
      apiRequest("/skills/"),
    ]);

    document.getElementById("p-name").value = myEmployee.full_name;
    document.getElementById("p-phone").value = myEmployee.phone || "";
    document.getElementById("p-designation").value = myEmployee.designation;
    document.getElementById("p-status").value = myEmployee.availability_status;
    document.getElementById("p-exp").value = myEmployee.experience_years;

    document.getElementById("new-skill-id").innerHTML = allSkills
      .map((s) => `<option value="${s.id || s._id}">${s.skill_name}</option>`).join("");

    renderSkills();
  } catch (err) {
    showError(err.message);
  }
}

function renderSkills() {
  const chips = myEmployee.skills.map((s) => {
    const skill = allSkills.find((sk) => (sk.id || sk._id) === s.skill_id);
    return `<span class="skill-chip">${skill ? skill.skill_name : "Unknown"} — ${LEVEL_LABELS[s.proficiency_level]}${s.certified ? " ✓" : ""}
      <button onclick="removeSkill('${s.skill_id}')">✕</button></span>`;
  }).join("");
  document.getElementById("skills-list").innerHTML =
    chips || '<p class="empty-state">No skills added yet — use the form below to add your first one.</p>';
}

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    myEmployee = await apiRequest(`/employees/${myEmployeeId}`, {
      method: "PUT",
      body: {
        full_name: document.getElementById("p-name").value.trim(),
        phone: document.getElementById("p-phone").value.trim() || null,
        designation: document.getElementById("p-designation").value.trim(),
        availability_status: document.getElementById("p-status").value,
        experience_years: parseFloat(document.getElementById("p-exp").value) || 0,
      },
    });
    btn.textContent = "Saved ✓";
    setTimeout(() => (btn.textContent = "Save details"), 1500);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("add-skill-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const skillId = document.getElementById("new-skill-id").value;
    myEmployee = await apiRequest(`/employees/${myEmployeeId}/skills`, {
      method: "POST",
      body: {
        skill_id: skillId,
        proficiency_level: parseInt(document.getElementById("new-skill-level").value),
        years_in_skill: parseFloat(document.getElementById("new-skill-years").value) || 0,
        certified: document.getElementById("new-skill-cert").checked,
      },
    });
    renderSkills();
    e.target.reset();
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
  }
});

async function removeSkill(skillId) {
  try {
    myEmployee = await apiRequest(`/employees/${myEmployeeId}/skills/${skillId}`, { method: "DELETE" });
    renderSkills();
  } catch (err) {
    showError(err.message);
  }
}

load();
