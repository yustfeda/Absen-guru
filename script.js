// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// Global variables from Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyA8UgsEb5VO5NRoP9L6mxXKsSBEoqpt6d4",
    authDomain: "absenguru-e4427.firebaseapp.com",
    databaseURL: "https://absenguru-e4427-default-rtdb.firebaseio.com",
    projectId: "absenguru-e4427",
    storageBucket: "absenguru-e4427.firebasestorage.app",
    messagingSenderId: "552477530759",
    appId: "1:552477530759:web:d1830bf9e23b7c14963622"
};

// Global application state
let db, auth, userId;
let teachersData = {};
let attendanceData = {};
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Initialize Firebase and Auth
const app = initializeApp(firebaseConfig);
db = getDatabase(app);
auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        loadData();
    } else {
        signInAnonymously(auth).then(userCredential => {
            userId = userCredential.user.uid;
            loadData();
        }).catch(error => {
            console.error("Firebase Auth Error:", error);
        });
    }
});

// Helper function to show and hide pages with active link styling
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(`${pageId}-page`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
    if(activeLink) {
        activeLink.classList.add('active');
    }

    const navLinks = document.querySelector('.nav-links');
    if (navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
    }
}

// Helper function to generate a secure PIN based on time
function getHourlyPin(subjectId) {
    const now = new Date();
    const hour = now.getHours();
    const seed = `${subjectId}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return String(Math.abs(hash) % 9000 + 1000);
}

// Firebase data loading
function loadData() {
    onValue(ref(db, `artifacts/${appId}/teachers`), (snapshot) => {
        teachersData = snapshot.val() || {};
        populateTeachersDropdown();
        renderTeacherList();
        renderAttendanceTable();
    });

    onValue(ref(db, `artifacts/${appId}/attendance`), (snapshot) => {
        attendanceData = snapshot.val() || {};
        renderAttendanceTable();
    });
}

// Teacher Management (Admin)
function addSubjectInput() {
    const container = document.getElementById('subjects-container');
    const newDiv = document.createElement('div');
    newDiv.className = 'subject-input-group flex items-center space-x-2';
    newDiv.innerHTML = `
        <input type="text" placeholder="Nama Mata Pelajaran" class="subject-name w-1/2 form-input">
        <input type="text" placeholder="Singkatan" class="subject-abbr w-1/4 form-input">
        <i class="fas fa-trash-alt text-red-500 cursor-pointer hover:text-red-700 transition-colors" onclick="removeSubject(this)"></i>
    `;
    container.appendChild(newDiv);
}
window.addSubjectInput = addSubjectInput;

function removeSubject(element) {
    element.closest('.subject-input-group').remove();
}
window.removeSubject = removeSubject;

document.getElementById('guru-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const guruName = document.getElementById('guru-name').value.trim();
    if (!guruName) return;

    const subjects = {};
    document.querySelectorAll('.subject-input-group').forEach(div => {
        const subjectName = div.querySelector('.subject-name').value.trim();
        const subjectAbbr = div.querySelector('.subject-abbr').value.trim();
        if (subjectName && subjectAbbr) {
            const subjectId = subjectName.replace(/\s/g, '');
            subjects[subjectId] = {
                name: subjectName,
                abbreviation: subjectAbbr
            };
        }
    });

    const newGuruRef = push(ref(db, `artifacts/${appId}/teachers`));
    await set(newGuruRef, {
        name: guruName,
        subjects: subjects
    });
    document.getElementById('guru-form').reset();
    document.querySelectorAll('.subject-input-group:not(:first-child)').forEach(el => el.remove());
});

function renderTeacherList() {
    const list = document.getElementById('teachers-list');
    list.innerHTML = '';
    for (const teacherId in teachersData) {
        const teacher = teachersData[teacherId];
        const div = document.createElement('div');
        div.className = 'bg-bg-light p-4 rounded-xl flex justify-between items-center shadow-md border border-secondary-blue';
        div.innerHTML = `
            <div>
                <p class="font-semibold text-text-dark font-poppins">${teacher.name}</p>
                <p class="text-sm text-text-dark opacity-70 font-poppins">${Object.values(teacher.subjects || {}).map(s => s.name).join(', ')}</p>
            </div>
            <div>
                <button class="text-red-500 hover:text-red-700 transition-colors" onclick="deleteTeacher('${teacherId}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        list.appendChild(div);
    }
}

function deleteTeacher(teacherId) {
    if (confirm('Apakah Anda yakin ingin menghapus guru ini?')) {
        set(ref(db, `artifacts/${appId}/teachers/${teacherId}`), null);
    }
}
window.deleteTeacher = deleteTeacher;

// Attendance Logic
function populateTeachersDropdown() {
    const select = document.getElementById('teacher-select');
    select.innerHTML = '<option value="">Pilih Guru</option>';
    for (const teacherId in teachersData) {
        const option = document.createElement('option');
        option.value = teacherId;
        option.textContent = teachersData[teacherId].name;
        select.appendChild(option);
    }
}

document.getElementById('teacher-select').addEventListener('change', (e) => {
    const teacherId = e.target.value;
    const subjectSelect = document.getElementById('subject-select');
    const absenBtn = document.getElementById('absen-btn');
    
    subjectSelect.innerHTML = '<option value="">Pilih Mata Pelajaran</option>';
    subjectSelect.disabled = true;
    absenBtn.disabled = true;

    if (teacherId) {
        const teacher = teachersData[teacherId];
        for (const subjectId in teacher.subjects) {
            const option = document.createElement('option');
            option.value = subjectId;
            option.textContent = teacher.subjects[subjectId].name;
            subjectSelect.appendChild(option);
        }
        subjectSelect.disabled = false;
    }
});

document.getElementById('subject-select').addEventListener('change', (e) => {
    document.getElementById('absen-btn').disabled = !e.target.value;
});

function showPinModal() {
    document.getElementById('pin-modal').classList.remove('hidden');
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-error-msg').classList.add('hidden');
}

function hidePinModal() {
    document.getElementById('pin-modal').classList.add('hidden');
}
window.hidePinModal = hidePinModal;

document.getElementById('absen-btn').addEventListener('click', () => {
    const teacherId = document.getElementById('teacher-select').value;
    const subjectId = document.getElementById('subject-select').value;
    if (!teacherId || !subjectId) return;
    
    const teacherName = teachersData[teacherId].name;
    const subjectName = teachersData[teacherId].subjects[subjectId].name;
    
    document.getElementById('pin-subject-name').textContent = `${teacherName} | ${subjectName}`;
    showPinModal();
});

document.getElementById('submit-pin-btn').addEventListener('click', async () => {
    const teacherId = document.getElementById('teacher-select').value;
    const subjectId = document.getElementById('subject-select').value;
    const pinInput = document.getElementById('pin-input').value;
    
    if (pinInput.length !== 4) {
        document.getElementById('pin-error-msg').classList.remove('hidden');
        return;
    }

    const expectedPin = getHourlyPin(subjectId);

    if (pinInput === expectedPin) {
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toTimeString().slice(0, 5);
        const attendanceRef = ref(db, `artifacts/${appId}/attendance/${date}/${teacherId}`);
        
        await update(attendanceRef, { [subjectId]: time });
        
        hidePinModal();
        showPage('home');
        console.log('Absen berhasil!'); 
        document.getElementById('teacher-select').value = '';
        document.getElementById('subject-select').value = '';
        document.getElementById('subject-select').disabled = true;
        document.getElementById('absen-btn').disabled = true;
    } else {
        document.getElementById('pin-error-msg').classList.remove('hidden');
    }
});

// Admin Login and View Logic
document.getElementById('login-btn').addEventListener('click', () => {
    const password = document.getElementById('admin-password').value;
    if (password === 'passwordadmin123') { 
        document.getElementById('admin-login-form').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        document.getElementById('admin-title').textContent = 'Dashboard Admin';
        showAdminView('data-guru');
    } else {
        document.getElementById('login-error-msg').classList.remove('hidden');
    }
});

function showAdminView(view) {
    document.querySelectorAll('.admin-view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`${view}-view`).classList.remove('hidden');
    document.querySelector(`[data-admin-view="${view}"]`).classList.add('active');
    
    if (view === 'rekap-absen') {
        populateMonthDropdown();
        renderAttendanceTable();
    }
}

document.querySelectorAll('[data-admin-view]').forEach(btn => {
    btn.addEventListener('click', (e) => showAdminView(e.target.dataset.adminView));
});

// Attendance Report & Download Logic
const subjectColors = {
    'Matematika': '#007BFF',
    'Fisika': '#28A745',
    'Kimia': '#DC3545',
    'Biologi': '#17A2B8',
    'Sejarah': '#6C757D',
    'Geografi': '#FFC107',
    'Ekonomi': '#6610F2',
    'Bahasa Indonesia': '#FD7E14',
    'Bahasa Inggris': '#20C997',
    'Sosiologi': '#6F42C1'
};

function getSubjectColor(subjectName) {
    return subjectColors[subjectName] || '#6C757D'; // Default color if not found
}

function getDatesInMonth(year, month) {
    const date = new Date(year, month, 1);
    const dates = [];
    while (date.getMonth() === month) {
        dates.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return dates;
}

function populateMonthDropdown() {
    const monthSelect = document.getElementById('month-select');
    const now = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    monthSelect.innerHTML = months.map((m, i) => `<option value="${i}" ${i === now.getMonth() ? 'selected' : ''}>${m} ${now.getFullYear()}</option>`).join('');
    monthSelect.addEventListener('change', (e) => {
        currentMonth = parseInt(e.target.value);
        currentYear = now.getFullYear();
        renderAttendanceTable();
    });
}

function renderAttendanceTable() {
    const tableHeaderRow = document.getElementById('table-header-row');
    const tableBody = document.getElementById('attendance-table-body');
    tableBody.innerHTML = '';
    
    const dates = getDatesInMonth(currentYear, currentMonth);
    
    tableHeaderRow.innerHTML = '<th class="py-3 px-4 text-left font-semibold">Nama Guru</th>' +
        dates.map(date => `<th class="py-3 px-2 text-center font-semibold">${date.getDate()}</th>`).join('');

    for (const teacherId in teachersData) {
        const teacher = teachersData[teacherId];
        const row = document.createElement('tr');
        row.className = 'border-b border-secondary-blue table-row-hover transition-colors duration-200';
        row.innerHTML = `<td class="py-3 px-4 font-medium whitespace-nowrap">${teacher.name}</td>`;
        
        dates.forEach(date => {
            const dateString = date.toISOString().slice(0, 10);
            const dailyAttendance = (attendanceData[dateString] || {})[teacherId] || {};
            
            let subjectHtml = '';
            for (const subjectId in dailyAttendance) {
                const subject = teacher.subjects[subjectId];
                if (subject && subject.abbreviation) {
                    const color = getSubjectColor(subject.name);
                    subjectHtml += `<span class="subject-abbreviation" style="background-color: ${color};">${subject.abbreviation}</span>`;
                }
            }
            row.innerHTML += `<td class="py-3 px-2 text-center">${subjectHtml}</td>`;
        });
        tableBody.appendChild(row);
    }
}

document.getElementById('download-btn').addEventListener('click', () => {
    const dates = getDatesInMonth(currentYear, currentMonth);
    const headers = ["Nama Guru"].concat(dates.map(d => d.getDate()));
    const data = [];
    
    for (const teacherId in teachersData) {
        const teacher = teachersData[teacherId];
        const row = { "Nama Guru": teacher.name };
        dates.forEach(date => {
            const dateString = date.toISOString().slice(0, 10);
            const dailyAttendance = (attendanceData[dateString] || {})[teacherId] || {};
            const attendedSubjects = Object.keys(dailyAttendance).map(subjectId => (teacher.subjects[subjectId] || {}).abbreviation).join(', ');
            row[date.getDate()] = attendedSubjects;
        });
        data.push(row);
    }
    
    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absen");
    
    XLSX.writeFile(workbook, `Rekap_Absen_${currentYear}-${currentMonth + 1}.xlsx`);
});

// Event listeners for page navigation
document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(e.target.dataset.page);
    });
});

document.querySelector('.hamburger-menu').addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('active');
});

// Initial page load
document.addEventListener('DOMContentLoaded', () => {
    showPage('home');
});
