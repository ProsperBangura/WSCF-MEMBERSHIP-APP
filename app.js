// ====================================================================
// WSCF CORE APPLICATION ENGINE CODE
// ARCHITECTED BY PROSPER (PP STUDIO) | FIXED OPEN-ACCESS
// ====================================================================

// 1. DATABASE CONNECTIVITY KEYS
const SUPABASE_URL = "https://ouarjehpvugklgnmqrdj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YXJqZWhwdnVna2xnbm1xcmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTM1NjksImV4cCI6MjA5Nzk4OTU2OX0.9CU03BAJPTGt71dqn0Zl_XBTaTNLJ6uttfskfFLgmRU";

// 2. INITIALIZE THE CLOUD CLIENT STREAM
let _supabase = null;
try {
  _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error("Supabase client initialization failed:", err);
}

// 3. GLOBAL TERMINAL STATES (No emails needed, purely controlled by PINs)
let currentClearanceLevel = 1; // Starts at Tier 1 (Attendance / Open view) by default
let activeDivisionId = 1; // Fixed default ministry division
const ACTIVE_DIVISION_CODE = "HQ"; // Fixed ministry identifier for ID generation

// localStorage Keys
const LS_DEPT_MEMBERS_PREFIX = "wscf_dept_members_";
const LS_ATTENDANCE_HISTORY = "wscf_attendance_history";

// Handle email sign-in form submission
function handleEmailSignIn(e) {
  e.preventDefault();
  const emailInput = document.getElementById("login-email");
  const emailValue = emailInput ? emailInput.value.trim() : "";

  // Universal email bypass: only require non-empty input with '@' symbol
  const isNotEmpty = emailValue.length > 0;
  const hasAtSymbol = emailValue.includes("@");

  if (!isNotEmpty || !hasAtSymbol) {
    alert("Please enter a valid email address to continue.");
    return;
  }

  // Hide the login screen and reveal the main dashboard
  const loginScreen = document.getElementById("login-screen");
  if (loginScreen) loginScreen.style.display = "none";

  // Show the dashboard
  const dashboard = document.getElementById("dashboard-screen");
  if (dashboard) dashboard.style.display = "flex";

  // Initialize the workspace
  initializeWorkspaceDashboard();
}

// Automatically boot the open terminal on page load
window.addEventListener("DOMContentLoaded", async () => {
  initializeLocalStorageKeys();
  // Initialize dashboard data on page load (login screen stays visible until user submits)
  renderFirstTimeVisitors();
});

function initializeLocalStorageKeys() {
  const deptIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  deptIds.forEach((id) => {
    const key = LS_DEPT_MEMBERS_PREFIX + id;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify([]));
    }
  });
  if (!localStorage.getItem(LS_ATTENDANCE_HISTORY)) {
    localStorage.setItem(LS_ATTENDANCE_HISTORY, JSON.stringify([]));
  }
}

// ====================================================================
// 4. SECURITY ROUTING & PIN VERIFICATION LOGIC
// ====================================================================

// Verify Entered Passcodes Against Tier 2 Master Administrative Security Clearance
// HTML escape utility to prevent XSS when rendering user data
function escapeHtml(text) {
  const amp = '&' + 'amp;';
  const lt = '&' + 'lt;';
  const gt = '&' + 'gt;';
  const quot = '&' + 'quot;';
  const apos = '&' + '#039;';
  return (text || '')
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
}

function verifyTerminalKey() {
  const enteredCode = document
    .getElementById("terminal-pass-code")
    .value.trim();
  const errorDisplay = document.getElementById("security-error");
  errorDisplay.innerText = "";

  // Route Tier 2: Check against Master Administrative Code
  if (enteredCode === "11223344") {
    currentClearanceLevel = 2;
    initializeWorkspaceDashboard();
  } else if (enteredCode === "1111") {
    // If they enter 1111, take them back to standard attendance mode
    currentClearanceLevel = 1;
    initializeWorkspaceDashboard();
  } else {
    errorDisplay.innerText = "Invalid Authorization Key. Access Repelled.";
  }
}

// Initialize Dashboard Layout Panels Based on Active Clearance Level
async function initializeWorkspaceDashboard() {
  // Hide lockout screen and show the main dashboard layout
  if (document.getElementById("lockout-screen"))
    document.getElementById("lockout-screen").style.display = "none";
  document.getElementById("dashboard-screen").style.display = "flex";

  document.getElementById("active-branch-title").innerText =
    "WSCF MEMBERSHIP SYSTEM";
  const badge = document.getElementById("terminal-clearance-badge");

  if (currentClearanceLevel === 1) {
    badge.innerText = "Clearance: Standard Operator (Master Sections Locked)";
    badge.style.borderColor = "#10b981";
    badge.style.color = "#10b981";

    // Show open attendance panel, lock out master tabs entirely
    document.getElementById("tier1-attendance-panel").style.display = "block";
    document.getElementById("pastoral-care-alerts-panel").style.display =
      "none";
    document.getElementById("tier2-master-panel").style.display = "none";
    // Initialize attendance UI with today's date badge
    updateDateBadge();
    renderAttendanceHistory();
  } else if (currentClearanceLevel === 2) {
    badge.innerText = "Clearance: Master Admin (Full Oversight Unlocked)";
    badge.style.borderColor = "#3b82f6";
    badge.style.color = "#3b82f6";

    // Show master panels and pastoral care alerts, switch cleanly to registration window
    document.getElementById("tier1-attendance-panel").style.display = "none";
    document.getElementById("pastoral-care-alerts-panel").style.display =
      "block";
    document.getElementById("tier2-master-panel").style.display = "block";
    await loadPastoralCareAlerts();
    switchAdminTab("registration-window");
    await loadAllMasterLedgerData();
  }
}

// ====================================================================
// 5. SECURITY ROUTING & PIN VERIFICATION LOGIC
// ====================================================================
let localUploadedPhotoBase64 = null;

function previewProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    localUploadedPhotoBase64 = e.target.result;
    const box = document.getElementById("photo-preview-label");
    box.style.backgroundImage = `url('${localUploadedPhotoBase64}')`;
    box.innerHTML = "";
  };
  reader.readAsDataURL(file);
}

async function submitMemberForm(e) {
  e.preventDefault();

  try {
    const firstName =
      document.getElementById("first-name")?.value?.trim() || "";
    const lastName = document.getElementById("last-name")?.value?.trim() || "";
    const fullAddress =
      document.getElementById("full-address")?.value?.trim() || "";
    const dob = document.getElementById("dob")?.value || "";
    const gender = document.getElementById("gender")?.value || "";
    const primaryPhone = document.getElementById("phone1")?.value?.trim() || "";
    const secondaryPhone =
      document.getElementById("phone2")?.value?.trim() || "";
    const email = document.getElementById("email")?.value?.trim() || "";
    const occupation =
      document.getElementById("occupation")?.value?.trim() || "";
    const maritalStatus =
      document.getElementById("marital-status")?.value || "Single";
    const nationality =
      document.getElementById("nationality")?.value?.trim() || "";
    const emergencyName =
      document.getElementById("emergency-name")?.value?.trim() || "";
    const emergencyPhone =
      document.getElementById("emergency-phone")?.value?.trim() || "";
    const wantToJoinDept =
      document.getElementById("want-join-dept-select")?.value || "";
    const baptized = document.getElementById("baptized-select")?.value || "No";

    const mediaWing = document.getElementById("wingMediaTeam")
      ? document.getElementById("wingMediaTeam").checked
      : false;
    const youthWing = document.getElementById("wingYouth")
      ? document.getElementById("wingYouth").checked
      : false;
    const teensWing = document.getElementById("wingTeens")
      ? document.getElementById("wingTeens").checked
      : false;
    const yaWing = document.getElementById("wingYoungAdult")
      ? document.getElementById("wingYoungAdult").checked
      : false;

    const departments = [];
    document
      .querySelectorAll('input[name="dept-group"]:checked')
      .forEach((cb) => departments.push(cb.value));

    const photoInput = document.getElementById("photo-input-file");
    let photoData = null;
    if (photoInput && photoInput.files && photoInput.files[0]) {
      photoData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(photoInput.files[0]);
      });
    }

    const membersRaw = localStorage.getItem("wscf_members");
    const members = membersRaw ? JSON.parse(membersRaw) : [];
    const local_id =
      members.length > 0
        ? Math.max(...members.map((m) => m.local_id || 0)) + 1
        : 1;
    const memberIdCode = `WSCF-HQ-${String(local_id).padStart(3, "0")}`;

    const newMember = {
      local_id,
      member_id_code: memberIdCode,
      first_name: firstName,
      last_name: lastName,
      phone: primaryPhone,
      name: `${firstName} ${lastName}`.trim() || "",
      contact_number_1: primaryPhone,
      contact_number_2: secondaryPhone,
      full_address: fullAddress,
      date_of_birth: dob,
      gender: gender,
      email: email,
      occupation: occupation,
      marital_status: maritalStatus,
      nationality: nationality,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      want_to_join_department: wantToJoinDept,
      baptized: baptized,
      departments: departments,
      wings: {
        media: mediaWing,
        youth: youthWing,
        teens: teensWing,
        youngAdult: yaWing,
      },
      photo_data: photoData,
    };

    members.push(newMember);
    localStorage.setItem("wscf_members", JSON.stringify(members));

    alert("Profile Saved Successfully!");
    clearRegistryFormFields();
    loadAllMasterLedgerData();
    await refreshFinancialAnalytics();
  } catch (error) {
    console.error("Critical Save Error:", error);
    alert("An error occurred while saving the profile. Please try again.");
  }
}

// ====================================================================
// 6. AT-RISK MEMBERSHIP MONITORING (PASTORAL CARE ALERTS)
// ====================================================================

async function loadPastoralCareAlerts() {
  try {
    const container = document.getElementById("pastoral-alerts-container");
    container.innerHTML =
      '<p class="text-muted">Scanning attendance records for at-risk members...</p>';

    // Fetch all attendance records for the current ministry division
    const { data: attendanceRecords, error } = await _supabase
      .from("attendance_records")
      .select("*")
      .eq("division_id", activeDivisionId)
      .order("service_date", { ascending: false });

    if (error) throw error;

    if (!attendanceRecords || attendanceRecords.length === 0) {
      container.innerHTML =
        '<p class="text-muted">No attendance records found for this ministry division.</p>';
      return;
    }

    // Group records by member and analyze absences
    const memberAttendanceMap = new Map();

    for (const record of attendanceRecords) {
      if (!memberAttendanceMap.has(record.member_id)) {
        memberAttendanceMap.set(record.member_id, []);
      }
      memberAttendanceMap.get(record.member_id).push(record);
    }

    // Find members with 3+ consecutive absences
    const atRiskMembers = [];

    for (const [memberId, records] of memberAttendanceMap.entries()) {
      // Sort records by date (most recent first)
      records.sort(
        (a, b) => new Date(b.service_date) - new Date(a.service_date),
      );

      // Get unique service dates
      const uniqueDates = [...new Set(records.map((r) => r.service_date))];

      // Check for 3 consecutive absences
      let consecutiveAbsences = 0;
      let foundConsecutive = false;

      for (let i = 0; i < uniqueDates.length - 2; i++) {
        const date1 = new Date(uniqueDates[i]);
        const date2 = new Date(uniqueDates[i + 1]);
        const date3 = new Date(uniqueDates[i + 2]);

        // Check if dates are consecutive (approximately weekly)
        const diff1 = (date1 - date2) / (1000 * 60 * 60 * 24);
        const diff2 = (date2 - date3) / (1000 * 60 * 60 * 24);

        // If roughly 7 days apart (weekly services), check for absences
        if (diff1 >= 5 && diff1 <= 9 && diff2 >= 5 && diff2 <= 9) {
          const presentCount1 = records.filter(
            (r) => r.service_date === uniqueDates[i] && r.is_present,
          ).length;
          const presentCount2 = records.filter(
            (r) => r.service_date === uniqueDates[i + 1] && r.is_present,
          ).length;
          const presentCount3 = records.filter(
            (r) => r.service_date === uniqueDates[i + 2] && r.is_present,
          ).length;

          if (
            presentCount1 === 0 &&
            presentCount2 === 0 &&
            presentCount3 === 0
          ) {
            foundConsecutive = true;
            break;
          }
        }
      }

      if (foundConsecutive) {
        // Get member details
        const { data: member, error: memberError } = await _supabase
          .from("members")
          .select("first_name, last_name, member_id_code, contact_number_1")
          .eq("id", memberId)
          .single();

        if (member && !memberError) {
          atRiskMembers.push({
            ...member,
            member_id: memberId,
            absence_count: 3,
          });
        }
      }
    }

    // Render alert cards
    if (atRiskMembers.length === 0) {
      container.innerHTML =
        '<p class="text-muted">No at-risk members detected. All members have acceptable attendance patterns.</p>';
      return;
    }

    container.innerHTML = atRiskMembers
      .map(
        (m) => `
            <div class="alert-card">
                <div class="alert-avatar">⚠️</div>
                <div class="alert-details">
                    <div class="alert-title">${m.first_name} ${m.last_name}</div>
                    <div class="alert-sub">
                        <span><strong>ID:</strong> ${m.member_id_code}</span>
                    </div>
                    <div class="alert-sub">
                        <span><strong>Contact:</strong> ${m.contact_number_1}</span>
                    </div>
                    <div class="alert-sub">
                        <span class="alert-badge">3+ Consecutive Absences</span>
                    </div>
                </div>
            </div>
        `,
      )
      .join("");
  } catch (error) {
    console.error("Failed to load pastoral care alerts:", error.message);
    document.getElementById("pastoral-alerts-container").innerHTML =
      '<p class="text-muted">No recent system alerts.</p>';
  }
}

// ====================================================================
// 7. FINANCIAL ANALYTICS & REVENUE AGGREGATION
// ====================================================================

async function refreshFinancialAnalytics() {
  try {
    // If date elements fail or are empty, bypass date check and get ALL records
    let startDateInput = "";
    let endDateInput = "";

    const startEl = document.getElementById("analytics-start-date");
    const endEl = document.getElementById("analytics-end-date");

    // Safely get date values - if any error occurs, keep strings empty
    try {
      if (startEl && startEl.value) {
        startDateInput = startEl.value;
      }
      if (endEl && endEl.value) {
        endDateInput = endEl.value;
      }
    } catch (dateError) {
      // If date parsing fails, continue with empty dates (will fetch all records)
      console.warn("Date input error, fetching all records:", dateError);
    }

    let query = _supabase
      .from("financial_logs")
      .select("amount, contribution_type, date_logged")
      .eq("division_id", activeDivisionId);

    // Apply date filters only if valid dates are provided
    if (startDateInput && startDateInput.trim() !== "") {
      query = query.gte("date_logged", startDateInput.trim());
    }
    if (endDateInput && endDateInput.trim() !== "") {
      query = query.lte("date_logged", endDateInput.trim());
    }

    const { data: logs, error } = await query;

    if (error) {
      console.warn("Supabase financial analytics query failed, using localStorage only:", error.message);
    }

    // Merge cloud logs with local localStorage records for complete analytics
    const localRecordsRaw = localStorage.getItem("wscf_financial_records");
    const localRecords = localRecordsRaw ? JSON.parse(localRecordsRaw) : [];

    // Combine Supabase and localStorage data
    const allRecords = [...(logs || []), ...localRecords];

    // Apply the same date filter to localStorage records if date filters are active
    let filteredRecords = allRecords;
    if (startDateInput && startDateInput.trim() !== "") {
      filteredRecords = filteredRecords.filter((r) => {
        const recordDate = r.date_logged;
        return recordDate && recordDate >= startDateInput.trim();
      });
    }
    if (endDateInput && endDateInput.trim() !== "") {
      filteredRecords = filteredRecords.filter((r) => {
        const recordDate = r.date_logged;
        return recordDate && recordDate <= endDateInput.trim();
      });
    }

    // Calculate metrics with defensive numeric parsing
    const metrics = filteredRecords.reduce(
      (acc, record) => {
        const numericValue =
          parseFloat(String(record.amount || 0).replace(/[^0-9.]/g, "")) || 0;

        if (record.contribution_type === "Tithe") {
          acc.totalTithes += numericValue;
        } else if (record.contribution_type === "Welfare Contribution") {
          acc.totalWelfare += numericValue;
        }

        acc.grandTotal += numericValue;
        return acc;
      },
      {
        totalTithes: 0,
        totalWelfare: 0,
        grandTotal: 0,
      },
    );

    // Update UI
    document.getElementById("total-tithes-value").innerText =
      `Le ${metrics.totalTithes.toFixed(2)}`;
    document.getElementById("total-welfare-value").innerText =
      `Le ${metrics.totalWelfare.toFixed(2)}`;
    document.getElementById("total-consolidated-value").innerText =
      `Le ${metrics.grandTotal.toFixed(2)}`;
  } catch (error) {
    console.error("Failed to refresh financial analytics:", error.message);
    const errorDisplay = document.getElementById("total-tithes-value");
    if (errorDisplay) errorDisplay.innerText = "Le 0.00";
    const errorDisplay2 = document.getElementById("total-welfare-value");
    if (errorDisplay2) errorDisplay2.innerText = "Le 0.00";
    const errorDisplay3 = document.getElementById("total-consolidated-value");
    if (errorDisplay3) errorDisplay3.innerText = "Le 0.00";
  }
}

// ====================================================================
// 8. NEW 3-STEP ATTENDANCE SYSTEM (Roster, Grid, Save)
// ====================================================================

// Return to Standard Attendance Terminal (Clearance Level 1)
async function returnToAttendanceTerminal() {
  currentClearanceLevel = 1;

  // Clear master admin panels
  document.getElementById("tier2-master-panel").style.display = "none";
  document.getElementById("pastoral-care-alerts-panel").style.display = "none";

  // Show primary attendance panel
  document.getElementById("tier1-attendance-panel").style.display = "block";

  // Reset badge
  const badge = document.getElementById("terminal-clearance-badge");
  badge.innerText = "Clearance: Standard Operator (Master Sections Locked)";
  badge.style.borderColor = "#10b981";
  badge.style.color = "#10b981";

  // Re-initialize attendance UI
  updateDateBadge();
  renderAttendanceHistory();
}

// Normalize department name for resilient comparison (handles underscores, spaces, casing, & vs and)
function normalizeDeptName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, ' ')  // replace underscores, hyphens, spaces with single space
    .replace(/&/g, 'and')        // normalize & to "and"
    .trim();
}

// STEP 1: Get filtered members from wscf_members registry by department (wing)
function getMembersByDepartment(departmentName) {
  const membersRaw = localStorage.getItem("wscf_members");
  if (!membersRaw) return [];
  const members = JSON.parse(membersRaw);
  if (!Array.isArray(members)) return [];

  // Normalize department name for comparison (handles underscores, spaces, casing)
  const dept = normalizeDeptName(departmentName);

  return members.filter((m) => {
    // Check in departments array (handles both "youth_fellowship" and "Youth Fellowship" formats)
    const inDepts = (m.departments || []).some(
      (d) => normalizeDeptName(d) === dept
    );
    // Check in wings object
    const inWings = m.wings && Object.entries(m.wings).some(
      ([key, val]) => val === true && normalizeDeptName(convertWingKeyToDeptName(key)) === dept
    );
    return inDepts || inWings;
  });
}

// Helper to map wing keys back to dropdown names
function convertWingKeyToDeptName(key) {
  const wingMap = {
    media: "Media & IT Team",
    youth: "Youth Fellowship",
    teens: "Teens Fellowship",
    youngAdult: "Young Adult Fellowship"
  };
  return wingMap[key] || key;
}

// Update the date badge with today's date
function updateDateBadge() {
  const badge = document.getElementById("attendance-date-badge");
  if (badge) {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    badge.textContent = `📅 ${today}`;
  }
}

// Get today's date string
function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

// STEP 2: Render attendance grid for selected department
function renderAttendanceGrid() {
  const deptSelect = document.getElementById("attendance-dept-select");
  const container = document.getElementById("attendance-grid-container");
  const deptName = deptSelect.value;

  // Clear previous grid
  container.innerHTML = "";

  if (!deptName) {
    container.innerHTML = '<p class="text-muted">Select a department above to load the attendance roster.</p>';
    return;
  }

  // Check if today already has a saved log for this wing
  const today = getTodayDateString();
  const history = getAttendanceHistory();
  const existingLog = history.find(h => h.date === today && h.wing === deptName);

  // Get members from registry
  const members = getMembersByDepartment(deptName);

  if (!members || members.length === 0) {
    container.innerHTML = `<p class="text-muted">No members registered under "${escapeHtml(deptName)}" in the Member Registry.</p>`;
    return;
  }

  // Build grid table
  let gridHtml = `<table class="attendance-grid">
    <thead>
      <tr>
        <th>#</th>
        <th>Member ID</th>
        <th>Member Name</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>`;

  members.forEach((m, idx) => {
    const memberId = m.member_id_code || "N/A";
    const memberName = `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Unknown";

    // If existing log found for today, restore saved status
    let savedStatus = "Present"; // default
    if (existingLog && existingLog.records) {
      const saved = existingLog.records.find(r => r.memberId === memberId);
      if (saved) {
        savedStatus = saved.status;
      }
    }

    gridHtml += `<tr data-member-id="${escapeHtml(memberId)}">
      <td>${idx + 1}</td>
      <td>${escapeHtml(memberId)}</td>
      <td>${escapeHtml(memberName)}</td>
      <td>
        <div class="status-toggle-group">
          <button type="button" class="status-btn ${savedStatus === "Present" ? "active-present" : ""}" onclick="setMemberStatus(this, 'Present')">✅ Present</button>
          <button type="button" class="status-btn ${savedStatus === "Absent" ? "active-absent" : ""}" onclick="setMemberStatus(this, 'Absent')">❌ Absent</button>
          <button type="button" class="status-btn ${savedStatus === "Excused" ? "active-excused" : ""}" onclick="setMemberStatus(this, 'Excused')">⚠️ Excused</button>
        </div>
      </td>
    </tr>`;
  });

  gridHtml += `</tbody></table>`;
  container.innerHTML = gridHtml;
}

// Handle status toggle button clicks
function setMemberStatus(btn, status) {
  const group = btn.closest(".status-toggle-group");
  if (!group) return;

  // Deactivate all buttons in the group
  group.querySelectorAll(".status-btn").forEach(b => {
    b.className = "status-btn";
  });

  // Activate the clicked button with appropriate class
  const activeClass = status === "Present" ? "active-present" : status === "Absent" ? "active-absent" : "active-excused";
  btn.classList.add(activeClass);
}

// STEP 3: Save attendance log
function saveAttendance() {
  const deptSelect = document.getElementById("attendance-dept-select");
  const deptName = deptSelect.value;

  if (!deptName) {
    alert("Please select a department first.");
    return;
  }

  const grid = document.querySelector("#attendance-grid-container .attendance-grid");
  if (!grid) {
    alert("No attendance grid loaded. Select a department with registered members.");
    return;
  }

  const rows = grid.querySelectorAll("tbody tr");
  if (rows.length === 0) {
    alert("No members found in the grid.");
    return;
  }

  const today = getTodayDateString();

  // Loop through rows and gather status
  const records = [];
  rows.forEach(row => {
    const memberId = row.getAttribute("data-member-id") || "N/A";
    const nameCell = row.cells[2];
    const memberName = nameCell ? nameCell.textContent.trim() : "Unknown";

    // Find active status button
    const activeBtn = row.querySelector(".status-btn.active-present, .status-btn.active-absent, .status-btn.active-excused");
    const status = activeBtn ? activeBtn.textContent.trim().replace(/[✅❌⚠️]/g, "").trim() : "Present";

    records.push({ memberId, name: memberName, status });
  });

  // Create log object
  const logEntry = {
    date: today,
    wing: deptName,
    records: records
  };

  // Get existing history and remove any existing entry for today+wing (replace)
  const history = getAttendanceHistory();
  const filtered = history.filter(h => !(h.date === today && h.wing === deptName));
  filtered.push(logEntry);
  localStorage.setItem(LS_ATTENDANCE_HISTORY, JSON.stringify(filtered));

  // Refresh history display
  renderAttendanceHistory();

  // Provide summary
  const present = records.filter(r => r.status === "Present").length;
  const absent = records.filter(r => r.status === "Absent").length;
  const excused = records.filter(r => r.status === "Excused").length;
  alert(
    `✅ Attendance saved for ${deptName} on ${today}.\n` +
    `Present: ${present} | Absent: ${absent} | Excused: ${excused}`
  );
}

// Get attendance history from localStorage
function getAttendanceHistory() {
  const raw = localStorage.getItem(LS_ATTENDANCE_HISTORY);
  return raw ? JSON.parse(raw) : [];
}

// Render attendance history logs
function renderAttendanceHistory() {
  const container = document.getElementById("attendance-history-list");
  if (!container) return;

  const history = getAttendanceHistory();

  if (!history || history.length === 0) {
    container.innerHTML = '<p class="text-muted">No attendance logs saved yet.</p>';
    return;
  }

  // Show newest first
  const sorted = [...history].reverse();

  container.innerHTML = sorted.map(h => {
    const present = (h.records || []).filter(r => r.status === "Present").length;
    const absent = (h.records || []).filter(r => r.status === "Absent").length;
    const excused = (h.records || []).filter(r => r.status === "Excused").length;
    const total = (h.records || []).length;

    return `
      <div class="history-log-card">
        <span class="log-date">📅 ${escapeHtml(h.date)}</span>
        <span class="log-wing">${escapeHtml(h.wing)}</span>
        <div class="log-summary">
          <span class="log-present-count">✅ ${present}</span>
          <span class="log-absent-count">❌ ${absent}</span>
          <span class="log-excused-count">⚠️ ${excused}</span>
          <span style="color:var(--text-muted);">👥 ${total}</span>
        </div>
      </div>
    `;
  }).join("");
}

function loadNonWorkersPanelRegistry() {
  const container = document.getElementById("non-workers-container");
  const membersRaw = localStorage.getItem("wscf_members");
  const members = membersRaw ? JSON.parse(membersRaw) : [];
  const nonWorkers = members.filter((m) => m.want_to_join_department === "No");

  if (!nonWorkers || nonWorkers.length === 0) {
    container.innerHTML =
      "<p>No unassigned non-workers logged at this ministry location.</p>";
    return;
  }

  container.innerHTML = nonWorkers
    .map(
      (m) => `
        <div class="record-card">
            <div class="record-avatar" style="background-image: url('${m.photo_data || ""}')">${m.photo_data ? "" : "👤"}</div>
            <div class="record-details">
                <div class="record-title">${m.first_name} ${m.last_name}</div>
                <div class="record-sub">
                    <span>ID: ${m.member_id_code}</span> | <span>Contact: ${m.contact_number_1}</span>
                </div>
                <div class="record-sub"><span class="record-tag-pill">Welfare Monitoring</span></div>
            </div>
        </div>
    `,
    )
    .join("");
}

// ====================================================================
// 9. VISITOR LOGS TERMINAL (FIRST-TIME VISITORS)
// ====================================================================
async function submitVisitorForm(e) {
  e.preventDefault();
  const payload = {
    division_id: activeDivisionId,
    full_name: document.getElementById("v-name").value.trim(),
    phone_number: document.getElementById("v-phone").value.trim(),
    invited_by: document.getElementById("v-invited").value.trim() || null,
    remarks_prayer_request:
      document.getElementById("v-remarks").value.trim() || null,
    date_of_visit: new Date().toISOString().split("T")[0],
  };

  // Try Supabase insert, but continue even if it fails
  try {
    await _supabase.from("visitors").insert(payload);
  } catch (supabaseError) {
    console.warn("Supabase visitor insert failed, saving locally only:", supabaseError.message);
  }

  // Always save to localStorage regardless of Supabase success
  const visitorsRaw = localStorage.getItem("wscf_first_time_visitors");
  const visitors = visitorsRaw ? JSON.parse(visitorsRaw) : [];
  visitors.unshift({
    full_name: payload.full_name,
    phone_number: payload.phone_number,
    invited_by: payload.invited_by,
    remarks_prayer_request: payload.remarks_prayer_request,
    date_of_visit: payload.date_of_visit,
  });
  localStorage.setItem("wscf_first_time_visitors", JSON.stringify(visitors));

  alert(
    "First-Time Visitor profile logged successfully for tracking follow-up.",
  );
  document.getElementById("visitor-form").reset();
  loadVisitorLedgerRecords();
}

async function loadVisitorLedgerRecords() {
  const box = document.getElementById("visitor-ledger-container");
  
  // Try to get visitors from Supabase
  let supabaseVisitors = [];
  try {
    const { data: visitors, error } = await _supabase
      .from("visitors")
      .select("*")
      .eq("division_id", activeDivisionId)
      .order("id", { ascending: false });
    
    if (!error && visitors) {
      supabaseVisitors = visitors;
    }
  } catch (supabaseError) {
    console.warn("Supabase visitor query failed, using localStorage only:", supabaseError.message);
  }

  // Also get visitors from localStorage
  const visitorsRaw = localStorage.getItem("wscf_first_time_visitors");
  let localVisitors = [];
  try {
    localVisitors = visitorsRaw ? JSON.parse(visitorsRaw) : [];
    if (!Array.isArray(localVisitors)) localVisitors = [];
  } catch (err) {
    localVisitors = [];
  }

  // Merge: use localStorage data as primary source (includes entries even if Supabase failed),
  // but also include Supabase entries that might not be in localStorage
  const supabaseNames = new Set(supabaseVisitors.map(v => v.full_name));
  const localNames = new Set(localVisitors.map(v => v.full_name));
  
  // Combine: start with localStorage entries, then add Supabase-only entries
  const mergedVisitors = [...localVisitors];
  for (const sv of supabaseVisitors) {
    if (!localNames.has(sv.full_name)) {
      mergedVisitors.push({
        full_name: sv.full_name,
        phone_number: sv.phone_number,
        invited_by: sv.invited_by,
        remarks_prayer_request: sv.remarks_prayer_request,
        date_of_visit: sv.date_of_visit,
      });
    }
  }

  if (!mergedVisitors || mergedVisitors.length === 0) {
    box.innerHTML =
      "<p class='text-muted'>No visitor entries tracking for this ministry division service cycle.</p>";
  } else {
    box.innerHTML = mergedVisitors
      .map(
        (v) => `
          <div class="record-card">
              <div class="record-details">
                  <div class="record-title">${escapeHtml(v.full_name)}</div>
                  <div class="record-sub"><span>Phone: ${escapeHtml(v.phone_number)}</span></div>
                  <div class="record-sub"><span>Invited By: ${escapeHtml(v.invited_by || "Walk-in")}</span></div>
                  <div class="record-sub" style="color:var(--text-main); font-style:italic;">"${escapeHtml(v.remarks_prayer_request || "No prayer note recorded.")}"</div>
              </div>
          </div>
      `,
      )
      .join("");
  }

  renderFirstTimeVisitors();
}

function renderFirstTimeVisitors() {
  const container = document.getElementById("visitorsListContainer");
  if (!container) return;

  try {
    const visitorsRaw = localStorage.getItem("wscf_first_time_visitors");
    let visitors = [];
    try {
      visitors = visitorsRaw ? JSON.parse(visitorsRaw) : [];
      if (!Array.isArray(visitors)) visitors = [];
    } catch (err) {
      visitors = [];
    }

    if (!visitors || visitors.length === 0) {
      container.innerHTML =
        "<p class='text-muted'>No visitor profiles logged for this session.</p>";
      return;
    }

    container.innerHTML = visitors
      .map(
        (v) => `
          <div class="visitor-record-card">
              <div class="visitor-card-header">
                  <div class="visitor-name">${escapeHtml(v.full_name)}</div>
                  <span class="visitor-date-badge">${escapeHtml(v.date_of_visit || "")}</span>
              </div>
              <div class="visitor-info-row">
                  <strong>Phone:</strong> ${escapeHtml(v.phone_number)}
              </div>
              <div class="visitor-info-row">
                  <strong>Invited By:</strong> ${escapeHtml(v.invited_by || "Walk-in")}
              </div>
              ${
                v.remarks_prayer_request
                  ? `
              <div class="visitor-remarks">
                  <strong>Prayer Requests / Notes:</strong> ${escapeHtml(v.remarks_prayer_request)}
              </div>`
                  : ""
              }
          </div>
      `,
      )
      .join("");
  } catch (error) {
    console.error("Failed to render first-time visitors:", error.message);
    container.innerHTML =
      "<p class='text-muted'>No visitor profiles logged for this session.</p>";
  }
}

// ====================================================================
// 10. INDIVIDUAL FINANCIAL LOGS TERMINAL (TITHES)
// ====================================================================
async function submitFinancialLog(e) {
  e.preventDefault();
  const memberId = document.getElementById("financial-member-select").value;

  // Build payload
  const payload = {
    division_id: activeDivisionId,
    member_id: memberId,
    amount: parseFloat(document.getElementById("fin-amount").value),
    contribution_type: document.getElementById("fin-type").value,
  };

  // Try Supabase insert, but continue even if it fails
  try {
    await _supabase.from("financial_logs").insert(payload);
  } catch (supabaseError) {
    console.warn("Supabase financial insert failed, saving locally only:", supabaseError.message);
  }

  // Always save to localStorage regardless of Supabase success
  const membersRaw = localStorage.getItem("wscf_members");
  const members = membersRaw ? JSON.parse(membersRaw) : [];
  const member = members.find((m) => m.local_id == memberId);
  const localRecord = {
    contributor_name: member
      ? `${member.first_name} ${member.last_name}`
      : "Unknown Member",
    contributor_id: member ? member.member_id_code : "N/A",
    amount: payload.amount,
    contribution_type: payload.contribution_type,
    date_logged: new Date().toISOString().split("T")[0],
  };

  const recordsRaw = localStorage.getItem("wscf_financial_records");
  const records = recordsRaw ? JSON.parse(recordsRaw) : [];
  records.unshift(localRecord);
  localStorage.setItem("wscf_financial_records", JSON.stringify(records));

  alert("Financial contribution log successfully audited and vaulted.");
  document.getElementById("financial-form").reset();
  loadFinancialLedgerRecords();
  renderFinancialLedger();
  await refreshFinancialAnalytics();
}

async function loadFinancialLedgerRecords() {
  const box = document.getElementById("financial-ledger-container");
  
  // Try to get logs from Supabase
  let supabaseLogs = [];
  try {
    const { data: logs, error } = await _supabase
      .from("financial_logs")
      .select(
        `id, amount, contribution_type, date_logged, members(first_name, last_name, member_id_code)`,
      )
      .eq("division_id", activeDivisionId)
      .order("id", { ascending: false });
    
    if (!error && logs) {
      supabaseLogs = logs;
    }
  } catch (supabaseError) {
    console.warn("Supabase financial query failed, using localStorage only:", supabaseError.message);
  }

  // Also get financial records from localStorage
  const recordsRaw = localStorage.getItem("wscf_financial_records");
  const records = recordsRaw ? JSON.parse(recordsRaw) : [];

  // If we have either Supabase data OR localStorage data, show them
  if ((!supabaseLogs || supabaseLogs.length === 0) && (!records || records.length === 0)) {
    box.innerHTML =
      "<p class='text-muted'>No payment entries logged in this terminal cycle.</p>";
    return;
  }

  // Render Supabase records first (they have IDs and can be deleted)
  let html = "";
  
  if (supabaseLogs && supabaseLogs.length > 0) {
    html += supabaseLogs
      .map(
        (l) => `
        <div class="record-card">
            <div class="record-details">
                <div class="record-title">${l.members ? l.members.first_name + " " + l.members.last_name : "Deleted Member"}</div>
                <div class="record-sub"><span>Code: ${l.members ? l.members.member_id_code : "N/A"}</span> | <span>Type: ${l.contribution_type}</span></div>
                <div class="record-sub"><span class="record-tag-pill" style="color:var(--accent-success)">Le: ${l.amount}</span></div>
            </div>
            <div class="record-actions-cluster">
                <button class="rec-btn delete" onclick="deleteFinancialRecord(${l.id})">Delete</button>
            </div>
        </div>
    `,
      )
      .join("");
  }

  // Render localStorage records (no delete button since they have no Supabase ID)
  if (records && records.length > 0) {
    html += records
      .map(
        (r) => `
        <div class="record-card">
            <div class="record-details">
                <div class="record-title">${escapeHtml(r.contributor_name || "Unknown Member")}</div>
                <div class="record-sub"><span>Code: ${escapeHtml(r.contributor_id || "N/A")}</span> | <span>Type: ${escapeHtml(r.contribution_type)}</span></div>
                <div class="record-sub"><span class="record-tag-pill" style="color:var(--accent-success)">Le: ${r.amount}</span></div>
            </div>
        </div>
    `,
      )
      .join("");
  }

  box.innerHTML = html;
  renderFinancialLedger();
}

function renderFinancialLedger() {
  const tbody = document.getElementById("financeLedgerTableBody");
  const searchInput = document.getElementById("financeSearchInput");
  if (!tbody) return;

  const recordsRaw = localStorage.getItem("wscf_financial_records");
  const records = recordsRaw ? JSON.parse(recordsRaw) : [];
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filtered = query
    ? records.filter((r) => {
        const name = (r.contributor_name || "").toLowerCase();
        const code = (r.contributor_id || "").toLowerCase();
        const category = (r.contribution_type || "").toLowerCase();
        return (
          name.includes(query) ||
          code.includes(query) ||
          category.includes(query)
        );
      })
    : records;

  if (!filtered || filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-muted">No contributions logged yet.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (r) => `
        <tr>
          <td>${escapeHtml(r.contributor_name || "Unknown")} <span style="color:var(--text-muted); font-size:0.8rem;">(${escapeHtml(r.contributor_id || "N/A")})</span></td>
          <td style="font-weight:700; color:var(--accent-success);">Le ${parseFloat(r.amount || 0).toFixed(2)}</td>
          <td><span class="record-tag-pill">${escapeHtml(r.contribution_type || "N/A")}</span></td>
          <td style="color:var(--text-muted);">${escapeHtml(r.date_logged || "")}</td>
        </tr>
      `,
    )
    .join("");
}

// Register live search filter for financial ledger
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("financeSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", renderFinancialLedger);
  }

  // Bind change event listeners to date inputs for instant recalculation
  const startDateInput = document.getElementById("analytics-start-date");
  const endDateInput = document.getElementById("analytics-end-date");
  if (startDateInput) {
    startDateInput.addEventListener("change", refreshFinancialAnalytics);
  }
  if (endDateInput) {
    endDateInput.addEventListener("change", refreshFinancialAnalytics);
  }
});

// Initialize ledger on load
renderFinancialLedger();

async function deleteFinancialRecord(id) {
  if (!confirm("Are you sure you want to permanently erase this transaction?"))
    return;
  await _supabase.from("financial_logs").delete().eq("id", id);
  loadFinancialLedgerRecords();
}

// ====================================================================
// 12. PRIMARY UTILITY REFRESH HANDLERS
// ====================================================================
async function loadAllMasterLedgerData() {
  try {
    await loadPrimaryMembershipRegistryLedger();
    await loadNonWorkersPanelRegistry();
    await loadVisitorLedgerRecords();
    await loadFinancialLedgerRecords();
    await populateDropdownSelectionSelectors();
    await refreshFinancialAnalytics();
  } catch (error) {
    console.error("Failed to load master ledger data:", error.message);
  }
}

function loadPrimaryMembershipRegistryLedger() {
  const box = document.getElementById("master-ledger-container");
  const membersRaw = localStorage.getItem("wscf_members");
  const members = membersRaw ? JSON.parse(membersRaw) : [];

  if (!members || members.length === 0) {
    box.innerHTML =
      "<p class='text-muted'>No member card files compiled in storage.</p>";
    return;
  }

  const sorted = [...members].sort((a, b) => b.local_id - a.local_id);
  box.innerHTML = sorted
    .map(
      (m) => `
        <div class="record-card">
            <div class="record-avatar" style="background-image: url('${m.photo_data || ""}')">${m.photo_data ? "" : "👤"}</div>
            <div class="record-details">
                <div class="record-title">${m.first_name} ${m.last_name}</div>
                <div class="record-sub"><span>ID: ${m.member_id_code}</span> | <span>Contact: ${m.contact_number_1}</span></div>
                <div class="record-sub"><span>Baptized: ${m.baptized}</span> | <span>Marital: ${m.marital_status}</span></div>
            </div>
            <div class="record-actions-cluster">
                <button class="rec-btn view" onclick="openMemberDetailModal(${m.local_id})">View / Edit</button>
                <button class="rec-btn delete" onclick="deleteMemberProfileCard(${m.local_id})">Delete</button>
            </div>
        </div>
    `,
    )
    .join("");
}

function deleteMemberProfileCard(id) {
  if (
    !confirm(
      "CRITICAL WARNING: Erasing this member profile card completely purges all associated system records. Proceed?",
    )
  )
    return;
  const membersRaw = localStorage.getItem("wscf_members");
  const members = membersRaw ? JSON.parse(membersRaw) : [];
  const filtered = members.filter((m) => m.local_id !== id);
  localStorage.setItem("wscf_members", JSON.stringify(filtered));
  loadAllMasterLedgerData();
}

function openMemberDetailModal(id) {
  const membersRaw = localStorage.getItem("wscf_members");
  const members = membersRaw ? JSON.parse(membersRaw) : [];
  const m = members.find((m) => m.local_id === id);
  if (!m) return;

  document.getElementById("modalMemberName").innerText =
    `${m.first_name} ${m.last_name}`;
  document.getElementById("modalMemberId").innerText = m.member_id_code;
  document.getElementById("modalFirstName").value = m.first_name || "";
  document.getElementById("modalLastName").value = m.last_name || "";
  document.getElementById("modalPhone1").value = m.contact_number_1 || "";
  document.getElementById("modalPhone2").value = m.contact_number_2 || "";
  document.getElementById("modalBaptized").value = m.baptized || "No";
  document.getElementById("modalMarital").value = m.marital_status || "Single";

  const profilePic = document.getElementById("modalProfilePic");
  if (m.photo_data) {
    profilePic.style.backgroundImage = `url('${m.photo_data}')`;
    profilePic.innerText = "";
  } else {
    profilePic.style.backgroundImage = "none";
    profilePic.innerText = "👤";
  }

  const checkboxes = document.querySelectorAll(
    'input[name="modal-dept-group"]',
  );
  checkboxes.forEach((cb) => {
    cb.checked = (m.departments || []).includes(cb.value);
  });

  const modal = document.getElementById("memberDetailModal");
  modal.style.display = "flex";
  modal.dataset.memberId = id;
}

function closeMemberDetailModal() {
  document.getElementById("memberDetailModal").style.display = "none";
}

function saveMemberProfileChanges(e) {
  e.preventDefault();

  const modal = document.getElementById("memberDetailModal");
  const id = parseInt(modal.dataset.memberId, 10);

  const membersRaw = localStorage.getItem("wscf_members");
  const members = membersRaw ? JSON.parse(membersRaw) : [];
  const index = members.findIndex((m) => m.local_id === id);
  if (index === -1) return;

  const tickedDepts = [];
  const checkboxes = document.querySelectorAll(
    'input[name="modal-dept-group"]:checked',
  );
  checkboxes.forEach((cb) => tickedDepts.push(cb.value));

  members[index].first_name = document
    .getElementById("modalFirstName")
    .value.trim();
  members[index].last_name = document
    .getElementById("modalLastName")
    .value.trim();
  members[index].contact_number_1 = document
    .getElementById("modalPhone1")
    .value.trim();
  members[index].contact_number_2 = document
    .getElementById("modalPhone2")
    .value.trim();
  members[index].baptized = document.getElementById("modalBaptized").value;
  members[index].marital_status = document.getElementById("modalMarital").value;
  members[index].departments = tickedDepts;

  localStorage.setItem("wscf_members", JSON.stringify(members));

  closeMemberDetailModal();
  loadAllMasterLedgerData();
  alert("Member profile updated successfully.");
}

function populateDropdownSelectionSelectors() {
  const finSelect = document.getElementById("financial-member-select");
  const prntSelect = document.getElementById("print-member-selector");

  const membersRaw = localStorage.getItem("wscf_members");
  const members = membersRaw ? JSON.parse(membersRaw) : [];
  if (!members || members.length === 0) return;

  const itemsHTML = members
    .map(
      (m) =>
        `<option value="${m.local_id}">${m.member_id_code} - ${m.first_name} ${m.last_name}</option>`,
    )
    .join("");

  if (finSelect) finSelect.innerHTML = itemsHTML;
  if (prntSelect) prntSelect.innerHTML = itemsHTML;
}

// ====================================================================
// 11. HARDWARE DIRECT-TO-PRINT CONFIGURATION LOGIC
// ====================================================================
async function triggerProfilePrint() {
  const memberId = document.getElementById("print-member-selector").value;
  if (!memberId) return;

  const membersRaw = localStorage.getItem("wscf_members");
  const members = membersRaw ? JSON.parse(membersRaw) : [];
  const m = members.find((m) => m.local_id === parseInt(memberId));
  if (!m) return;
  const canvas = document.getElementById("print-hardware-canvas");

  canvas.innerHTML = `
        <div class="print-document-header">
            <div class="print-title-block">
                <h1>WSCF Membership Ledger Profile Card</h1>
                <p>Ministry Division Code File: ${m.member_id_code}</p>
            </div>
        </div>
        <div class="print-data-grid">
            <div class="print-data-item"><strong>First Name</strong>${m.first_name}</div>
            <div class="print-data-item"><strong>Last Name</strong>${m.last_name}</div>
            <div class="print-data-item"><strong>Date of Birth</strong>${m.date_of_birth}</div>
            <div class="print-data-item"><strong>Gender</strong>${m.gender}</div>
            <div class="print-data-item"><strong>Primary Contact Number</strong>${m.contact_number_1}</div>
            <div class="print-full-width print-data-item"><strong>Residential Address</strong>${m.full_address}</div>
            <div class="print-data-item"><strong>Emergency Contact Person</strong>${m.emergency_contact_name}</div>
            <div class="print-data-item"><strong>Emergency Phone Line</strong>${m.emergency_contact_phone}</div>
        </div>
        <div class="print-hardware-footer">
            <span>System Document - Printed via WSCF Core Terminal</span>
            <span class="print-signature-stamp">Powered by PP Studio</span>
        </div>
    `;
  window.print();
}

async function triggerDepartmentRollPrint() {
  const deptName = document.getElementById("print-dept-selector").value;
  const canvas = document.getElementById("print-hardware-canvas");

  const { data: dRow } = await _supabase
    .from("departments")
    .select("id")
    .eq("dept_name", deptName)
    .single();
  if (!dRow) return;

  const { data: workers } = await _supabase
    .from("member_departments")
    .select("members(member_id_code, first_name, last_name)")
    .eq("department_id", dRow.id);

  let tableRows =
    workers && workers.length > 0
      ? workers
          .map(
            (w, idx) =>
              `<tr><td>${idx + 1}</td><td>${w.members.member_id_code}</td><td>${w.members.first_name} ${w.members.last_name}</td><td>[  ] Present</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="4" style="text-align:center;">No workers currently registered.</td></tr>`;

  canvas.innerHTML = `
        <div class="print-document-header">
            <div class="print-title-block">
                <h1>WSCF Departmental Physical Roll Sheet</h1>
                <p>Wing: ${deptName}</p>
            </div>
        </div>
        <table class="print-table">
            <thead>
                <tr><th>#</th><th>Member ID</th><th>Worker Full Name</th><th>Attendance Box Mark</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
        <div class="print-hardware-footer">
            <span>System Roll - Printed via WSCF Core Terminal</span>
            <span class="print-signature-stamp">Powered by PP Studio</span>
        </div>
    `;
  window.print();
}

async function triggerVisitorListPrint() {
  const canvas = document.getElementById("print-hardware-canvas");
  
  // Attempt to get visitors from Supabase
  let supabaseVisitors = [];
  try {
    const { data: visitors, error } = await _supabase
      .from("visitors")
      .select("*")
      .eq("division_id", activeDivisionId);
    if (!error && visitors) {
      supabaseVisitors = visitors;
    }
  } catch (supabaseError) {
    console.warn("Supabase visitor print query failed, using localStorage:", supabaseError.message);
  }

  // Also get visitors from localStorage
  const visitorsRaw = localStorage.getItem("wscf_first_time_visitors");
  let localVisitors = [];
  try {
    localVisitors = visitorsRaw ? JSON.parse(visitorsRaw) : [];
    if (!Array.isArray(localVisitors)) localVisitors = [];
  } catch (err) {
    localVisitors = [];
  }

  // Merge both sources for print
  const supabaseNames = new Set(supabaseVisitors.map(v => v.full_name));
  const localNames = new Set(localVisitors.map(v => v.full_name));
  
  const mergedVisitors = [...localVisitors];
  for (const sv of supabaseVisitors) {
    if (!localNames.has(sv.full_name)) {
      mergedVisitors.push({
        full_name: sv.full_name,
        phone_number: sv.phone_number,
        invited_by: sv.invited_by,
      });
    }
  }

  let tableRows =
    mergedVisitors && mergedVisitors.length > 0
      ? mergedVisitors
          .map(
            (v, idx) =>
              `<tr><td>${idx + 1}</td><td>${escapeHtml(v.full_name)}</td><td>${escapeHtml(v.phone_number)}</td><td>${escapeHtml(v.invited_by || "Walk-in")}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="4" style="text-align:center;">No visitor tracking cards logged.</td></tr>`;

  canvas.innerHTML = `
        <div class="print-document-header">
            <div class="print-title-block">
                <h1>WSCF First-Time Visitor Care Ledger</h1>
            </div>
        </div>
        <table class="print-table">
            <thead>
                <tr><th>#</th><th>Visitor Name</th><th>Telephone Line</th><th>Invited By</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
    `;
  window.print();
}

async function triggerFinancialStatementPrint() {
  const canvas = document.getElementById("print-hardware-canvas");
  
  // Attempt to get logs from Supabase
  let supabaseLogs = [];
  try {
    const { data: logs, error } = await _supabase
      .from("financial_logs")
      .select(
        `amount, contribution_type, date_logged, members(first_name, last_name, member_id_code)`,
      )
      .eq("division_id", activeDivisionId);
    if (!error && logs) {
      supabaseLogs = logs;
    }
  } catch (supabaseError) {
    console.warn("Supabase financial print query failed, using localStorage:", supabaseError.message);
  }

  // Also get financial records from localStorage
  const recordsRaw = localStorage.getItem("wscf_financial_records");
  const localRecords = recordsRaw ? JSON.parse(recordsRaw) : [];

  // Combine both sources for the print
  let allEntries = [];

  // Add Supabase entries
  if (supabaseLogs && supabaseLogs.length > 0) {
    supabaseLogs.forEach(l => {
      allEntries.push({
        contributor_id: l.members ? l.members.member_id_code : "N/A",
        contributor_name: l.members ? l.members.first_name + " " + l.members.last_name : "N/A",
        contribution_type: l.contribution_type,
        amount: l.amount,
      });
    });
  }

  // Add localStorage entries
  if (localRecords && localRecords.length > 0) {
    localRecords.forEach(r => {
      allEntries.push({
        contributor_id: r.contributor_id || "N/A",
        contributor_name: r.contributor_name || "Unknown Member",
        contribution_type: r.contribution_type,
        amount: r.amount,
      });
    });
  }

  let runningTotal = 0;
  let tableRows =
    allEntries && allEntries.length > 0
      ? allEntries
          .map((l, idx) => {
            const amt = parseFloat(l.amount) || 0;
            runningTotal += amt;
            return `<tr><td>${idx + 1}</td><td>${escapeHtml(l.contributor_id)}</td><td>${escapeHtml(l.contributor_name)}</td><td>${escapeHtml(l.contribution_type)}</td><td style="text-align:right;">Le ${amt.toFixed(2)}</td></tr>`;
          })
          .join("")
      : `<tr><td colspan="5" style="text-align:center;">No ledger contribution rows logged.</td></tr>`;

  canvas.innerHTML = `
        <div class="print-document-header">
            <div class="print-title-block">
                <h1>WSCF Financial Contribution Ledger Voucher</h1>
            </div>
        </div>
        <table class="print-table">
            <thead>
                <tr><th>#</th><th>Member ID</th><th>Contributor Identity</th><th>Type</th><th style="text-align:right;">Amount</th></tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr style="font-weight:700;"><td colspan="4" style="text-align:right;">Total:</td><td style="text-align:right;">Le ${runningTotal.toFixed(2)}</td></tr>
            </tbody>
        </table>
    `;
  window.print();
}

// ====================================================================
// 12. GRAPHICAL USER INTERFACE TAB LINK IMPLEMENTATION
// ====================================================================
function switchAdminTab(targetPaneId) {
  const panes = document.querySelectorAll(".tab-content-pane");
  panes.forEach((p) => (p.style.display = "none"));

  const links = document.querySelectorAll(".nav-tab-link");
  links.forEach((l) => l.classList.remove("active"));

  document.getElementById(targetPaneId).style.display = "block";
  if (window.event && window.event.currentTarget)
    window.event.currentTarget.classList.add("active");

  if (targetPaneId === "non-workers-window") loadNonWorkersPanelRegistry();
  if (targetPaneId === "visitors-window") loadVisitorLedgerRecords();
  if (targetPaneId === "financial-window") {
    loadFinancialLedgerRecords();
    refreshFinancialAnalytics();
  }
}

// Lock Station: prompt for PIN before returning to lockout screen
function relockTerminalWindow() {
  document.getElementById("dashboard-screen").style.display = "none";
  document.getElementById("lockout-screen").style.display = "flex";
  const pinInput = document.getElementById("terminal-pass-code");
  pinInput.value = "";
  pinInput.focus();
}

// Trigger Admin Security Prompt to Switch over into Master Mode
function signOutTerminal() {
  document.getElementById("dashboard-screen").style.display = "none";
  document.getElementById("lockout-screen").style.display = "flex";
  document.getElementById("terminal-pass-code").value = "";
  document.getElementById("terminal-pass-code").focus();
}

function exitTerminal() {
  // Clear any active session data or temporary states
  currentClearanceLevel = 1;
  localUploadedPhotoBase64 = null;

  // Clear the email input field from the login gateway
  const loginEmailInput = document.getElementById("login-email");
  if (loginEmailInput) loginEmailInput.value = "";

  // Hide the main dashboard container entirely
  const dashboard = document.getElementById("dashboard-screen");
  if (dashboard) dashboard.style.display = "none";

  // Bring back the full-screen 'WSCF Terminal' gateway modal overlay
  const loginScreen = document.getElementById("login-screen");
  if (loginScreen) loginScreen.style.display = "flex";
}

function clearRegistryFormFields() {
  document.getElementById("member-form").reset();
  localUploadedPhotoBase64 = null;
  const box = document.getElementById("photo-preview-label");
  box.style.backgroundImage = "none";
  box.innerHTML = `<span class="upload-icon">📷</span><span>Upload Member Photo</span>`;
}

// ====================================================================
// PWA SERVICE WORKER REGISTRATION
// ====================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((registration) => {
        console.log('[App] Service Worker registered successfully:', registration.scope);
        
        // Check for updates on page navigation
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              console.log('[App] New version available. Please refresh.');
              if (confirm('A new version of WSCF Terminal is available. Reload to update?')) {
                newWorker.postMessage({ action: 'skipWaiting' });
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error('[App] Service Worker registration failed:', error);
      });

    // Handle controller change (new SW takes over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
} else {
  console.log('[App] Service Workers not supported in this browser.');
}
