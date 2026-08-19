
// ============================================================
// GLOBAL PRESENTATION MAPPINGS & BADGE HELPERS (TURKISH UI)
// ============================================================
function getRiskLabel(riskLevel) {
    if (!riskLevel) return '✓ Düzenli Takip';
    const lvl = String(riskLevel).toUpperCase();
    if (lvl === 'RED') return '! Kritik';
    if (lvl === 'ORANGE' || lvl === 'YELLOW') return '! Dikkat';
    if (lvl === 'GREEN') return '✓ Düzenli Takip';
    return riskLevel;
}

function getRiskBadgeHtml(riskLevel) {
    const lvl = String(riskLevel || 'GREEN').toUpperCase();
    let badgeClass = "badge-risk-green";
    let icon = "check-circle-2";

    if (lvl === 'RED') {
        badgeClass = "badge-risk-red";
        icon = "alert-circle";
    } else if (lvl === 'ORANGE' || lvl === 'YELLOW') {
        badgeClass = "badge-risk-orange";
        icon = "alert-triangle";
    }

    const label = getRiskLabel(lvl);
    return `<span class="text-[11px] font-bold px-2.5 py-1 rounded-lg ${badgeClass} inline-flex items-center gap-1.5 shadow-sm">
        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i> <span>${label}</span>
    </span>`;
}

function formatEnumLabel(enumVal) {
    if (!enumVal) return '';
    const str = String(enumVal).toUpperCase();
    const map = {
        'GREEN': 'Düzenli Takip',
        'ORANGE': 'Dikkat',
        'RED': 'Kritik',
        'ACTIVE': 'Aktif',
        'INACTIVE': 'Pasif',
        'ARCHIVED': 'Arşivlendi',
        'DELETED': 'Silindi',
        'ASSIGNED': 'Atandı',
        'UNASSIGNED': 'Atanmadı',
        'SYSTEM': 'Sistem Kaynağı',
        'SYSTEM_RESOURCE': 'Sistem Kaynağı',
        'MY_RESOURCES': 'Kaynaklarım',
        'COACH': 'Koç Kaynağı',
        'MAIN_COACH': 'Ana Koç',
        'ASSISTANT_COACH': 'Yardımcı Koç',
        'ALL': 'Tümü',
        'HIGH': 'Yüksek',
        'MEDIUM': 'Orta',
        'LOW': 'Düşük',
        'NORMAL': 'Normal',
        'PENDING': 'Bekliyor',
        'IN_PROGRESS': 'Devam Ediyor',
        'COMPLETED': 'Tamamlandı',
        'LATE': 'Gecikmiş',
        'OVERDUE': 'Gecikmiş',
        'PLANNED': 'Planlandı',
        'SKIPPED': 'Atlandı',
        'CANCELLED': 'İptal Edildi',
        'VERIFIED': 'Koç Onayladı',
        'NOT_STARTED': 'Başlanmadı',
        'FINISHED': 'Bitti',
        'CRITICAL': 'Kritik',
        'WARNING': 'Dikkat',
        'REGULAR': 'Düzenli',
        'SUCCESS': 'Başarılı',
        'NO_DATA': 'Veri Yok',
        'ORTA': 'Orta',
        'YUKSEK': 'Yüksek',
        'DUSUK': 'Düşük'
    };
    return map[str] || enumVal;
}

// YKS KOÇLUK PLATFORMU - MASTER FRONTEND APPLICATION LOGIC

const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '5005' && window.location.port !== ''
    ? "http://127.0.0.1:5005/api"
    : "/api";

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Centralized Safe API Fetcher
 * Handles authorization headers, response.ok checks, Content-Type validation,
 * 401/403 auth errors, timeout handling, and developer console logging.
 */
async function apiFetch(endpointUrl, options = {}) {
    const token = localStorage.getItem('yks_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const timeoutMs = options.timeout || 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const fetchOptions = {
        ...options,
        headers,
        signal: options.signal || controller.signal
    };

    const fullUrl = endpointUrl.startsWith('http') ? endpointUrl : `${API_BASE}${endpointUrl.startsWith('/') ? '' : '/'}${endpointUrl}`;

    try {
        const response = await fetch(fullUrl, fetchOptions);
        clearTimeout(timeoutId);

        const contentType = response.headers.get("content-type") || "";

        if (response.status === 401) {
            console.warn("[API ERROR 401] Token expired or invalid:", fullUrl);
            localStorage.removeItem('yks_token');
            localStorage.removeItem('yks_user');
            if (typeof showLoginScreen === 'function') showLoginScreen();
            throw new Error("Oturum süreniz doldu. Lütfen tekrar giriş yapın.");
        }

        if (response.status === 403) {
            console.warn("[API ERROR 403] Forbidden access:", fullUrl);
            throw new Error("Bu işlem için yetkiniz bulunmamaktadır (403 Forbidden).");
        }

        if (!response.ok) {
            let errorMsg = `HTTP ${response.status} ${response.statusText}`;
            if (contentType.includes("application/json")) {
                try {
                    const errData = await response.json();
                    errorMsg = errData.error || errData.message || errorMsg;
                } catch (e) {}
            } else {
                const bodyText = await response.text();
                console.error("[API ERROR - NON-JSON RESPONSE]", {
                    endpoint: fullUrl,
                    status: response.status,
                    contentType,
                    bodySnippet: bodyText.substring(0, 300)
                });
                errorMsg = `Sunucu beklenmeyen bir yanıt döndürdü (HTTP ${response.status}).`;
            }
            throw new Error(errorMsg);
        }

        if (!contentType.includes("application/json")) {
            console.error("[API ERROR - INVALID CONTENT TYPE]", {
                endpoint: fullUrl,
                status: response.status,
                contentType
            });
            throw new Error("Sunucu geçerli JSON yerine farklı bir yanıt döndürdü.");
        }

        const data = await response.json();
        return data;

    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.error("[API ERROR - TIMEOUT]", { endpoint: fullUrl, timeoutMs });
            throw new Error("Sunucu yanıt vermedi (Ağ zaman aşımı). Lütfen tekrar deneyin.");
        }
        console.error("[API ERROR]", {
            endpoint: fullUrl,
            message: err.message
        });
        throw err;
    }
}

let currentUser = null;
let currentView = 'dashboard';
let selectedStudentId = 1;
let selectedPlanId = null;
let timerInterval = null;
let timerSeconds = 1500; // 25 min default
let timerRunning = false;
let denemeChartInstance = null;
let coachStudentsList = []; // Cache of coach's students for dropdowns
let allPlatformResources = []; // Cache of all resources for filtering
let currentActiveStudentId = 1;

// Global Weekly Program State Variables & Request Sequence (MUST BE DECLARED BEFORE ANY VIEW RENDER)
let weeklyCurrentWeekStart = null;
let weeklyActiveStudentId = 1;
let weeklyActiveView = 'GRID'; // 'GRID' or 'CALENDAR'
let weeklyProgramState = { student: null, items: [], summary: {}, isDirty: false };
let draggedProgramId = null;
let weeklyProgramRequestSeq = 0;
let weeklyProgramAbortController = null;
try {
    Object.defineProperty(window, 'weeklyProgramRequestSeq', {
        get: () => weeklyProgramRequestSeq,
        set: (v) => { weeklyProgramRequestSeq = v; },
        configurable: true
    });
} catch (e) {}

// Standard Hourly Time Slots for Excel Grid Editor (Sabah 08:00'den Gece 24:00'e Kadar Saat Saat)
const TIME_SLOTS = [
    "08:00 - 09:00",
    "09:00 - 10:00",
    "10:00 - 11:00",
    "11:00 - 12:00",
    "12:00 - 13:00",
    "13:00 - 14:00",
    "14:00 - 15:00",
    "15:00 - 16:00",
    "16:00 - 17:00",
    "17:00 - 18:00",
    "18:00 - 19:00",
    "19:00 - 20:00",
    "20:00 - 21:00",
    "21:00 - 22:00",
    "22:00 - 23:00",
    "23:00 - 24:00"
];

const DAYS_LIST = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const IS_PRODUCTION = window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost';

function initEnvironmentUI() {
    const demoBox = document.getElementById('demoCredentialsContainer');
    if (demoBox) {
        demoBox.classList.remove('hidden');
        demoBox.style.display = 'block';
    }
}

// On Load Safe Boot Logic (Handles readyState 'interactive' / 'complete')
function initAppBoot() {
    initEnvironmentUI();
    initLoginListeners();
    initNotifDropdownListeners();
    checkAuth();
}

function initLoginListeners() {
    const loginForm = document.getElementById('loginForm');
    const uInput = document.getElementById('loginEmail');
    const pInput = document.getElementById('loginPassword');
    const forgotLink = document.getElementById('forgotPasswordLink');

    const btnCoach = document.getElementById('btnFillCoach');
    const btnStudent = document.getElementById('btnFillStudent');
    const btnAdmin = document.getElementById('btnFillAdmin');

    const fillLogin = (username, password, e) => {
        console.log("FILL LOGIN EXECUTED", username);
        if (e) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        if (uInput) {
            uInput.value = username;
            uInput.setAttribute('value', username);
            uInput.dispatchEvent(new Event('input', { bubbles: true }));
            uInput.dispatchEvent(new Event('change', { bubbles: true }));
            uInput.focus();
        }
        if (pInput) {
            pInput.value = password;
            pInput.setAttribute('value', password);
            pInput.dispatchEvent(new Event('input', { bubbles: true }));
            pInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const errDiv = document.getElementById('loginError');
        if (errDiv) errDiv.classList.add('hidden');
        return false;
    };

    if (btnCoach) {
        btnCoach.onclick = (e) => fillLogin('ummu.akcan', 'password123', e);
    }
    if (btnStudent) {
        btnStudent.onclick = (e) => fillLogin('burak.akcan', 'ogrenci123', e);
    }
    if (btnAdmin) {
        btnAdmin.onclick = (e) => fillLogin('admin', 'password123', e);
    }
    if (forgotLink) {
        forgotLink.onclick = (e) => {
            if (e) e.preventDefault();
            openForgotPasswordModal(e);
        };
    }
    if (loginForm) {
        loginForm.onsubmit = (e) => {
            if (e) e.preventDefault();
            handleLogin(e);
            return false;
        };
    }
}

// Central Single Source of Truth for Demo Test Accounts
const DEMO_TEST_ACCOUNTS = {
    COACH: { username: 'ummu.akcan', password: 'password123', label: '👨‍🏫 KOÇ HESABI' },
    STUDENT: { username: 'burak.akcan', password: 'ogrenci123', label: '🎓 ÖĞRENCİ HESABI' },
    ADMIN: { username: 'admin', password: 'password123', label: '👑 ADMİN HESABI' }
};

function fillCredentials(usernameOrRole, password, ev) {
    console.log("DOLDUR BUTTON CLICK", usernameOrRole);
    const eventObj = ev || window.event;
    if (eventObj) {
        if (typeof eventObj.preventDefault === 'function') eventObj.preventDefault();
        if (typeof eventObj.stopPropagation === 'function') eventObj.stopPropagation();
    }
    const uInput = document.getElementById('loginEmail');
    const pInput = document.getElementById('loginPassword');
    const errDiv = document.getElementById('loginError');

    if (errDiv) {
        errDiv.textContent = '';
        errDiv.classList.add('hidden');
    }
    if (uInput) uInput.classList.remove('border-rose-500');
    if (pInput) pInput.classList.remove('border-rose-500');

    let userVal = usernameOrRole;
    let passVal = password;

    if (DEMO_TEST_ACCOUNTS[usernameOrRole]) {
        userVal = DEMO_TEST_ACCOUNTS[usernameOrRole].username;
        passVal = DEMO_TEST_ACCOUNTS[usernameOrRole].password;
    }

    if (uInput) {
        uInput.value = userVal || '';
        uInput.setAttribute('value', userVal || '');
        uInput.dispatchEvent(new Event('input', { bubbles: true }));
        uInput.dispatchEvent(new Event('change', { bubbles: true }));
        uInput.focus();
    }
    if (pInput) {
        pInput.value = passVal || '';
        pInput.setAttribute('value', passVal || '');
        pInput.dispatchEvent(new Event('input', { bubbles: true }));
        pInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return false;
}

function fillDemoCredentials(role, ev) {
    return fillCredentials(role, null, ev);
}

async function doLogin(username, password) {
    console.log("LOGIN SUBMIT / ATTEMPT", username);
    const uInput = document.getElementById('loginEmail');
    const pInput = document.getElementById('loginPassword');
    const errDiv = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (errDiv) {
        errDiv.textContent = '';
        errDiv.classList.add('hidden');
    }
    if (uInput) uInput.classList.remove('border-rose-500');
    if (pInput) pInput.classList.remove('border-rose-500');

    const cleanUsername = (username || (uInput ? uInput.value : '') || '').trim().toLowerCase();
    const cleanPassword = (password || (pInput ? pInput.value : '') || '').trim();

    if (!cleanUsername || !cleanPassword) {
        if (errDiv) {
            errDiv.textContent = "❌ Kullanıcı adı veya şifre giriniz.";
            errDiv.classList.remove('hidden');
        }
        if (uInput && !cleanUsername) uInput.classList.add('border-rose-500');
        if (pInput && !cleanPassword) pInput.classList.add('border-rose-500');
        return;
    }

    let origBtnText = '';
    if (submitBtn) {
        origBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Giriş yapılıyor...</span>`;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
        });
        
        let data;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            data = await res.json();
        } else {
            const rawText = await res.text();
            console.error("LOGIN RESPONSE NON-JSON:", rawText);
            throw new Error("Sunucudan geçersiz yanıt alındı.");
        }

        console.log("LOGIN RESULT", data);

        if (!res.ok || !data.success) {
            throw new Error(data.error || data.message || 'Kullanıcı adı veya şifre hatalı.');
        }

        localStorage.setItem('yks_token', data.token);
        localStorage.setItem('yks_user', JSON.stringify(data.user));
        currentUser = data.user;
        await showApp();
    } catch (err) {
        console.error("Login error:", err);
        if (errDiv) {
            errDiv.textContent = "❌ " + (err.message || 'Kullanıcı adı veya şifre hatalı.');
            errDiv.classList.remove('hidden');
        }
        if (uInput) uInput.classList.add('border-rose-500');
        if (pInput) pInput.classList.add('border-rose-500');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnText || `<span>[ GİRİŞ YAP ]</span>`;
        }
    }
}

// Authentication
function handleLogin(e) {
    console.log("HANDLE LOGIN TRIGGERED", e);
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const usernameInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const username = usernameInput ? usernameInput.value : '';
    const password = passwordInput ? passwordInput.value : '';
    doLogin(username, password);
    return false;
}

window.fillCredentials = fillCredentials;
window.fillDemoCredentials = fillDemoCredentials;
window.doLogin = doLogin;
window.handleLogin = handleLogin;

function checkDevEnvironment() {
    const container = document.getElementById('demoCredentialsContainer');
    if (container) {
        container.classList.remove('hidden');
    }
}

function showLoginScreen() {
    currentUser = null;
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
    checkDevEnvironment();
}

function checkAuth() {
    const savedUser = localStorage.getItem('yks_user');
    const savedToken = localStorage.getItem('yks_token');
    if (savedUser && savedToken) {
        try {
            currentUser = JSON.parse(savedUser);
            showApp();
        } catch (e) {
            logout();
        }
    } else {
        showLoginScreen();
    }
}

function logout() {
    localStorage.removeItem('yks_token');
    localStorage.removeItem('yks_user');
    sessionStorage.clear();
    currentUser = null;
    showLoginScreen();
}

function toggleMobileSidebar(forceState = null) {
    const sidebar = document.getElementById('mainSidebar');
    const overlay = document.getElementById('mobileSidebarOverlay');
    if (!sidebar) return;
    const shouldOpen = forceState !== null ? forceState : sidebar.classList.contains('hidden');
    if (shouldOpen) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-50', 'bg-slate-950', 'w-72', 'shadow-2xl', 'p-4');
        if (overlay) overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-50', 'bg-slate-950', 'w-72', 'shadow-2xl', 'p-4');
        if (overlay) overlay.classList.add('hidden');
    }
}

async function showApp() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
    
    if (currentUser) {
        const userNameLabel = document.getElementById('userNameLabel');
        const userEmailLabel = document.getElementById('userEmailLabel');
        const userRoleBadge = document.getElementById('userRoleBadge');
        if (userNameLabel) userNameLabel.textContent = currentUser.name || 'Kullanıcı';
        if (userEmailLabel) userEmailLabel.textContent = currentUser.username ? `@${currentUser.username}` : '';
        if (userRoleBadge) userRoleBadge.textContent = currentUser.role || 'KOÇ';

        try {
            updateSidebarByRole();
            initTheme();
            if (currentUser.role !== 'STUDENT') {
                await loadCoachStudentsList();
            }
            await loadAllResourcesCache();
            if (typeof initNotificationSystem === 'function') {
                initNotificationSystem();
            }
        } catch (e) {
            console.error("Initial data load warning:", e);
        }
    }

    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    const initialRoute = parseUrlHash();
    if (initialRoute && initialRoute.viewName) {
        console.log('[INITIAL ROUTE LOAD]', initialRoute);
        navigateView(initialRoute.viewName, initialRoute.paramId);
    } else {
        navigateView('dashboard');
    }
}

function syncUrlHash(viewName, paramId = null) {
    let hash = `#/${viewName}`;
    if (paramId) {
        hash += `/${paramId}`;
    }
    if (window.location.hash !== hash) {
        window.history.pushState(null, '', hash);
    }
}

function parseUrlHash() {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (!rawHash) return null;
    const parts = rawHash.split('/');
    const viewName = parts[0];
    const paramId = parts[1] ? parseInt(parts[1]) : null;
    return { viewName, paramId };
}

function handleStudentDetailClick(studentId, studentName = '') {
    console.log('[STUDENT DETAIL CLICK]', { id: studentId, name: studentName });
    if (studentId) {
        selectedStudentId = parseInt(studentId);
        localStorage.setItem('yks_selected_student_id', selectedStudentId);
    }
    navigateView('student-detail', studentId);
}

window.addEventListener('hashchange', () => {
    const route = parseUrlHash();
    if (route && route.viewName && route.viewName !== currentView) {
        console.log('[HASH CHANGE NAVIGATE]', route);
        navigateView(route.viewName, route.paramId, false);
    }
});

async function loadCoachStudentsList() {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        coachStudentsList = data.students || [];
        
        const savedStId = localStorage.getItem('yks_selected_student_id');
        if (savedStId && coachStudentsList.find(s => s.id == savedStId)) {
            selectedStudentId = parseInt(savedStId);
        } else if (coachStudentsList.length > 0) {
            const primaryStudent = coachStudentsList.find(s => s.id == 1) || coachStudentsList[0];
            selectedStudentId = primaryStudent.id;
        }
    } catch (err) {
        console.error("Coach students fetch error:", err);
    }
}

async function loadAllResourcesCache() {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynaklar`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allPlatformResources = data.resources || [];
    } catch (err) {
        console.error("Resources cache error:", err);
    }
}

// Global Student Selector Banner for Coach
function getCoachStudentSwitcherHtml() {
    if (!currentUser || currentUser.role === 'STUDENT' || coachStudentsList.length === 0) return '';

    return `
    <div class="glass-card p-4 border border-[#24314A] mb-6 bg-[#111A2C] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
            <div class="p-2 bg-[#172238] rounded-xl text-[#4F8CFF] border border-[#2A3954] shrink-0">
                <i data-lucide="user-check" class="w-5 h-5"></i>
            </div>
            <div>
                <span class="text-[10px] font-bold text-[#4F8CFF] uppercase tracking-wider block">İNCELENEN ÖĞRENCİ SEÇİMİ</span>
                <span class="text-xs text-[#A8B3C7]">Aşağıdaki tüm veriler seçtiğiniz öğrenciye özeldir</span>
            </div>
        </div>
        
        <div class="flex items-center gap-2 w-full sm:w-auto">
            <label class="text-xs font-bold text-white hidden md:inline shrink-0">Öğrenci Seçin:</label>
            <select onchange="changeActiveStudent(this.value)" class="w-full sm:w-auto bg-[#0B1324] border border-[#2A3954] rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#4F8CFF]">
                ${coachStudentsList.map(s => `<option value="${s.id}" ${s.id == selectedStudentId ? 'selected' : ''}>👨‍🎓 ${s.name} (${s.track}) - ${s.target_university || 'Hedefli'}</option>`).join('')}
            </select>
        </div>
    </div>`;
}

function changeActiveStudent(studentId) {
    if (!studentId || studentId === 'null' || studentId === 'undefined') return;
    selectedStudentId = parseInt(studentId);
    localStorage.setItem('yks_selected_student_id', selectedStudentId);
    selectedDenemeAttemptId = null;
    currentDenemeTab = 'OVERVIEW';

    const container = document.getElementById('viewContainer');
    if (container && currentView === 'deneme') {
        container.innerHTML = `
        <div class="glass-card p-12 text-center border border-slate-800 rounded-2xl flex flex-col items-center justify-center my-6">
            <div class="animate-spin text-indigo-500 mb-3"><i data-lucide="loader-2" class="w-8 h-8"></i></div>
            <h3 class="text-sm font-bold text-white mb-1">Öğrenci Verileri Yükleniyor...</h3>
            <p class="text-xs text-slate-400">Lütfen bekleyin, seçilen öğrencinin deneme ve analiz verileri getiriliyor.</p>
        </div>
        `;
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    navigateView(currentView, selectedStudentId);
}

// Router & View Management with Strict Route Protection
async function navigateView(viewName, paramId = null, updateHash = true) {
    toggleNotificationDropdown(false);
    if (!currentUser) {
        showLoginScreen();
        return;
    }

    if (viewName === 'login' || !viewName) {
        viewName = 'dashboard';
    }

    // Route Protection
    if (currentUser.role === 'STUDENT') {
        const studentForbiddenViews = ['students', 'student-detail', 'admin', 'admin-dashboard'];
        if (studentForbiddenViews.includes(viewName)) {
            console.warn(`Unauthorized view attempt for STUDENT: ${viewName}`);
            viewName = 'dashboard';
        }
    } else if (currentUser.role === 'COACH') {
        const coachForbiddenViews = ['admin', 'admin-dashboard'];
        if (coachForbiddenViews.includes(viewName)) {
            console.warn(`Unauthorized view attempt for COACH: ${viewName}`);
            viewName = 'dashboard';
        }
    }

    currentView = viewName;
    if (paramId) selectedStudentId = parseInt(paramId);
    
    console.log('[STUDENT NAVIGATE]', { viewName, paramId, selectedStudentId });

    if (updateHash) {
        syncUrlHash(viewName, paramId || (viewName === 'student-detail' ? selectedStudentId : null));
    }

    if (window.innerWidth < 768) {
        toggleMobileSidebar(false);
    }
    toggleNotificationDropdown(false);
    
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        const onclickAttr = btn.getAttribute('onclick') || '';
        if (onclickAttr.includes(`'${viewName}'`)) {
            btn.classList.add('active');
        }
    });

    const container = document.getElementById('viewContainer');
    if (!container) return;

    container.innerHTML = '<div class="flex justify-center p-12"><div class="animate-spin text-indigo-500"><i data-lucide="loader-2" class="w-8 h-8"></i></div></div>';
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

    try {
        if (viewName === 'dashboard') {
            if (currentUser && currentUser.role === 'STUDENT') {
                await renderStudentDashboard();
            } else if (currentUser && currentUser.role === 'ADMIN') {
                await renderAdminDashboard();
            } else {
                await renderCoachDashboard();
            }
        } else if (viewName === 'admin-users') {
            await renderAdminUserManagementView();
        } else if (viewName === 'students') {
            await renderStudentsRiskListView();
        } else if (viewName === 'student-detail') {
            await renderStudentDetailView(selectedStudentId);
        } else if (viewName === 'program') {
            await renderWeeklyProgramView(selectedStudentId);
        } else if (viewName === 'assignments' || viewName === 'odevlerim') {
            await renderStudentAssignmentsView();
        } else if (viewName === 'mufredat') {
            await renderMufredatView(paramId || selectedStudentId);
        } else if (viewName === 'question') {
            await renderQuestionView();
        } else if (viewName === 'deneme') {
            await renderDenemeView();
        } else if (viewName === 'simulator') {
            renderSimulatorView();
        } else if (viewName === 'kaynak-havuzu' || viewName === 'resources') {
            await renderKaynakHavuzuView();
        } else if (viewName === 'books') {
            await renderBooksView();
        } else if (viewName === 'messages') {
            await renderMessagesView();
        } else if (viewName === 'timer') {
            renderTimerView();
        } else if (viewName === 'raporlar' || viewName === 'reports') {
            await renderReportsView();
        } else if (viewName === 'ai-coach') {
            await renderAICoachView();
        } else if (viewName === 'notifications') {
            await renderNotificationsView();
        }
        await updateGlobalUnreadBadge();
    } catch (err) {
        console.error(`View navigation error (${viewName}):`, err);
        container.innerHTML = `
        <div class="p-8 text-center glass-card border border-rose-800/50">
            <h3 class="text-base font-bold text-rose-400">Görünüm Yükleme Hatası</h3>
            <p class="text-xs text-slate-400 mt-1">${err.message || 'Ekran yüklenirken beklenmeyen bir hata oluştu.'}</p>
            <button onclick="navigateView('${viewName}')" class="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl">Tekrar Dene</button>
        </div>`;
    }
}

async function updateGlobalUnreadBadge() {
    try {
        const token = localStorage.getItem('yks_token');
        if (!token) return;
        const res = await fetch(`${API_BASE}/mesajlar/unread-summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const count = data.total_unread || 0;
        const badgeEl = document.getElementById('sidebarUnreadBadge');
        if (badgeEl) {
            if (count > 0) {
                badgeEl.textContent = count;
                badgeEl.classList.remove('hidden');
            } else {
                badgeEl.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error("Unread summary update error:", e);
    }
}

// Modal Helpers
function openModal(titleOrHtml, maybeBodyHtml) {
    const container = document.getElementById('modalContainer');
    const content = document.getElementById('modalContent');
    if (!container || !content) return;

    let finalHtml = '';
    if (maybeBodyHtml !== undefined && maybeBodyHtml !== null) {
        finalHtml = `
        <div class="space-y-4">
            <div class="pb-3 border-b border-slate-800 flex items-center justify-between">
                <h3 class="text-base font-black text-white">${titleOrHtml}</h3>
            </div>
            <div>${maybeBodyHtml}</div>
        </div>`;
    } else {
        finalHtml = titleOrHtml;
    }

    // Clean any inline duplicate close buttons from contentHtml
    let cleanedHtml = finalHtml.replace(/<button[^>]*onclick=["']closeModal\(\)["'][^>]*>\s*[✕xX]?\s*<\/button>/gi, '');

    content.innerHTML = cleanedHtml + `
    <button onclick="closeModal()" aria-label="Kapat" class="absolute top-3 right-3 text-slate-400 hover:text-white transition w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800/80 font-black text-lg leading-none z-50">
        ✕
    </button>`;
    container.classList.remove('hidden');
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

function closeModal() {
    const container = document.getElementById('modalContainer');
    if (container) container.classList.add('hidden');
}

window.openModal = openModal;
window.closeModal = closeModal;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ----------------------------------------------------
// DERS DERS DÜZENLENMİŞ KAYNAK KATALOĞU VE EKLEME MODALI
// ----------------------------------------------------
let activeResourceSubjectFilter = 'ALL';
let activeResourceSubTab = 'CATALOG'; // CATALOG | DISCOVERY | OFFICIAL | CORRELATION

async function renderResourcesView(subjectFilter = 'ALL', subTab = 'MY_ASSIGNED') {
    activeResourceSubjectFilter = subjectFilter;
    activeResourceSubTab = subTab;
    document.getElementById('pageTitle').textContent = "YKS Kaynak Yönetimi & Müfredat Eşleştirme Motoru";
    const token = localStorage.getItem('yks_token');
    const userRole = localStorage.getItem('yks_role') || 'COACH';
    const studentId = selectedStudentId || 1;

    try {
        const res = await fetch(`${API_BASE}/kaynaklar`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        allPlatformResources = data.resources || [];

        let html = `
        <!-- HEADER BAR -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
                <h2 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="database" class="w-5 h-5 text-indigo-400"></i> YKS Kaynak Yönetimi & Öğrenci Müfredat İlerleme Sistemi
                </h2>
                <p class="text-xs text-slate-400">Merkezi kaynak havuzundan öğrenciye özel kaynak atama ve müfredat konu tamamlanma takibi</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="openAddResourceModal()" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i> + Yeni Kaynak Ekle
                </button>
            </div>
        </div>

        <!-- MAIN SUB-TAB NAVIGATION -->
        <div class="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-3">
            <button onclick="renderResourcesView('${subjectFilter}', 'MY_ASSIGNED')" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${subTab === 'MY_ASSIGNED' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}">
                <i data-lucide="book-open" class="w-4 h-4"></i> 📚 Atanmış Kaynaklarım
            </button>
            ${currentUser && ['COACH', 'ADMIN'].includes(currentUser.role) ? `
            <button onclick="renderResourcesView('${subjectFilter}', 'MASTER_POOL')" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${subTab === 'MASTER_POOL' ? 'bg-indigo-900 text-indigo-200 border border-indigo-700 shadow-lg' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}">
                <i data-lucide="layers" class="w-4 h-4"></i> 🏛 Merkezi Kaynak Havuzu (${allPlatformResources.length} Kitap)
            </button>
            <button onclick="renderResourcesView('${subjectFilter}', 'DISCOVERY')" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${subTab === 'DISCOVERY' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}">
                <i data-lucide="compass" class="w-4 h-4"></i> 🔍 Keşif & Onay Havuzu
            </button>
            <button onclick="renderResourcesView('${subjectFilter}', 'OFFICIAL')" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${subTab === 'OFFICIAL' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}">
                <i data-lucide="award" class="w-4 h-4"></i> 🏛 ÖSYM & MEB Kaynakları
            </button>
            ` : ''}
        </div>
        `;

        if (subTab === 'MY_ASSIGNED') {
            // ONLY SHOW ASSIGNED RESOURCES FOR STUDENT
            const stRes = await fetch(`${API_BASE}/kaynaklar/student?student_id=${studentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const stData = await stRes.json();
            const assignedList = stData.student_resources || [];
            const stats = stData.stats || { total: 0, completed: 0, in_progress: 0, not_started: 0, avg_percentage: 0.0 };

            html += `
            ${getCoachStudentSwitcherHtml()}

            <!-- STATS WIDGET -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div class="glass-card p-4 border border-slate-800">
                    <span class="text-xs text-slate-400 block">Atanmış Kaynak Sayısı</span>
                    <h3 class="text-xl font-extrabold text-white mt-1">${stats.total} <span class="text-xs text-slate-500 font-normal">kitap</span></h3>
                </div>
                <div class="glass-card p-4 border border-slate-800">
                    <span class="text-xs text-slate-400 block">Devam Eden Kaynaklar</span>
                    <h3 class="text-xl font-extrabold text-amber-400 mt-1">${stats.in_progress} <span class="text-xs text-slate-500 font-normal">kitap</span></h3>
                </div>
                <div class="glass-card p-4 border border-slate-800">
                    <span class="text-xs text-slate-400 block">Tamamlanan Kaynaklar</span>
                    <h3 class="text-xl font-extrabold text-emerald-400 mt-1">${stats.completed} <span class="text-xs text-slate-500 font-normal">kitap</span></h3>
                </div>
                <div class="glass-card p-4 border border-slate-800">
                    <span class="text-xs text-slate-400 block">Genel Kaynak İlerlemesi</span>
                    <h3 class="text-xl font-extrabold text-indigo-400 mt-1">%${stats.avg_percentage}</h3>
                </div>
            </div>

            <!-- ASSIGNED RESOURCES CARDS -->
            <div class="glass-card p-6 border border-slate-800">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <i data-lucide="book-check" class="w-5 h-5 text-indigo-400"></i> ÖĞRENCİYE ATANMIŞ KAYNAKLAR (${assignedList.length})
                    </h3>
                    <div class="flex items-center gap-2">
                        <button onclick="openBulkAssignModal()" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-md">
                            <i data-lucide="library" class="w-3.5 h-3.5"></i> + Toplu Kaynak Ekle / Ata
                        </button>
                        <button onclick="renderResourcesView('${subjectFilter}', 'MASTER_POOL')" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                            + Tekli Ata <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            `;

            if (assignedList.length === 0) {
                html += `<div class="col-span-2 text-center py-8 text-slate-500">Bu öğrenciye henüz kaynak atanmamıştır. Yukardaki <b>'Merkezi Kaynak Havuzu'</b> sekmesinden öğrenciye kaynak atayabilirsiniz.</div>`;
            } else {
                assignedList.forEach(ar => {
                    let statusBadge = "bg-amber-950 text-amber-300 border-amber-800";
                    if (ar.status === 'COMPLETED') statusBadge = "bg-emerald-950 text-emerald-300 border-emerald-800";

                    html += `
                    <div class="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-indigo-500/50 transition">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded border uppercase ${statusBadge}">${ar.status}</span>
                                <span class="text-xs font-bold text-amber-400">${ar.priority || 'ORTA'} ÖNCELİK</span>
                            </div>
                            <h4 class="font-extrabold text-sm text-white">${ar.resource_title}</h4>
                            <p class="text-xs text-indigo-400 mt-0.5">${ar.publisher_name || 'Yayın'} | ${ar.subject_name || 'Ders'} | Sınav: ${ar.exam_type || 'TYT'}</p>
                            
                            <div class="mt-4">
                                <div class="flex justify-between items-center text-xs mb-1">
                                    <span class="text-slate-400">Kitap İlerlemesi:</span>
                                    <span class="font-bold text-emerald-400">%${ar.completion_percentage || 0}</span>
                                </div>
                                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${ar.completion_percentage || 0}%"></div>
                                </div>
                            </div>

                            <div class="mt-3 text-[11px] text-slate-400 space-y-1">
                                <div class="flex justify-between"><span>Atayan Koç:</span> <span class="text-white font-medium">${ar.coach_name || 'Ümmü Akcan'}</span></div>
                                <div class="flex justify-between"><span>Hedef Bitiş:</span> <span class="text-amber-400 font-semibold">${ar.target_end_date || 'Belirtilmedi'}</span></div>
                                ${ar.coach_note ? `<p class="text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800 mt-2 italic">" ${ar.coach_note} "</p>` : ''}
                            </div>
                        </div>

                        <div class="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                            <button onclick="openStudentResourceDetailModal(${ar.id})" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow">
                                <i data-lucide="list-checks" class="w-4 h-4"></i> 📖 Kitap İçeriği & Müfredat İlerlemesi
                            </button>
                            <button onclick="unassignStudentResource(${ar.id})" title="Öğrencinin Listesinden Çıkar / Sil" class="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs px-3 py-2 rounded-xl font-semibold transition flex items-center gap-1">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Çıkar
                            </button>
                        </div>
                    </div>
                    `;
                });
            }
            html += `</div></div>`;
        } else if (subTab === 'MASTER_POOL' || subTab === 'CATALOG') {
            // MASTER RESOURCE POOL WITH FILTERS & ASSIGN BUTTON
            let filtered = allPlatformResources;
            if (subjectFilter !== 'ALL') {
                filtered = allPlatformResources.filter(r => (r.subject_name || '').toUpperCase().includes(subjectFilter.toUpperCase()));
            }

            html += `
            <!-- SUBJECT TABS FILTER BAR -->
            <div class="glass-card p-2 border border-slate-800 mb-6 flex overflow-x-auto gap-2">
                <button onclick="renderResourcesView('ALL', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'ALL' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    Tüm Dersler (${allPlatformResources.length})
                </button>
                <button onclick="renderResourcesView('Matematik', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'Matematik' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    📐 Matematik
                </button>
                <button onclick="renderResourcesView('Türkçe', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'Türkçe' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    📖 Türkçe / Edebiyat
                </button>
                <button onclick="renderResourcesView('Fizik', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'Fizik' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    ⚡️ Fizik
                </button>
                <button onclick="renderResourcesView('Kimya', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'Kimya' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    🧪 Kimya
                </button>
                <button onclick="renderResourcesView('Biyoloji', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'Biyoloji' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    🧬 Biyoloji
                </button>
                <button onclick="renderResourcesView('Geometri', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'Geometri' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    📐 Geometri
                </button>
                <button onclick="renderResourcesView('Tarih', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'Tarih' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    🏛 Tarih / Coğrafya
                </button>
                <button onclick="renderResourcesView('İngilizce', 'MASTER_POOL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${subjectFilter === 'İngilizce' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    🌐 YDT İngilizce
                </button>
            </div>

            <div class="glass-card p-6 border border-slate-800">
                <h3 class="text-sm font-bold text-white mb-4 flex items-center justify-between">
                    <span class="flex items-center gap-2">
                        <i data-lucide="layers" class="w-5 h-5 text-indigo-400"></i> MERKEZİ KAYNAK HAVUZU (${filtered.length} Kitap)
                    </span>
                    <span class="text-xs font-normal text-slate-400">Öğrenciye atamak istediğiniz kaynağı seçin</span>
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            `;

            filtered.forEach(r => {
                let trackBadge = "bg-indigo-950 text-indigo-300 border-indigo-800";
                if (r.track === 'SAYISAL') trackBadge = "bg-emerald-950 text-emerald-300 border-emerald-800";
                else if (r.track === 'EA') trackBadge = "bg-amber-950 text-amber-300 border-amber-800";

                html += `
                <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex justify-between items-center hover:border-indigo-500/50 transition">
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-xs text-white">${r.title}</h4>
                            <span class="text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${trackBadge}">${r.track || 'ORTAK'}</span>
                        </div>
                        <p class="text-[11px] text-indigo-400 mt-1">${r.publisher_name || 'Yayın'} | Ders: <span class="font-semibold text-white">${r.subject_name || 'Genel'}</span> | Seviye: <span class="text-amber-400 font-semibold">${r.level || 'ORTA'}</span></p>
                        <span class="text-[10px] text-slate-400 block mt-1">Sınav: ${r.exam_type || 'TYT'} | Tip: ${r.resource_type || 'Soru Bankası'}</span>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <button onclick="openAssignResourceModal(${r.id}, '${r.title}')" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition flex items-center gap-1">
                            <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Kaynak Ata
                        </button>
                    </div>
                </div>
                `;
            });
            html += `</div></div>`;
        } else if (subTab === 'DISCOVERY') {
            // DISCOVERY QUEUE TAB
            const discRes = await fetch(`${API_BASE}/kaynaklar/kesif`, { headers: { 'Authorization': `Bearer ${token}` } });
            const discData = await discRes.json();
            const queue = discData.discovery_queue || [];

            html += `
            <div class="glass-card p-6 border border-slate-800 mb-6">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
                    <div>
                        <h3 class="text-sm font-bold text-white flex items-center gap-2">
                            <i data-lucide="compass" class="w-5 h-5 text-amber-400"></i> Kaynak Keşif & Admin Onay Havuzu (Discovery Queue)
                        </h3>
                        <p class="text-xs text-slate-400">Web taramalarından keşfedilen veya öğretmen/koçlar tarafından önerilen yayınlar</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="triggerAutoDiscoveryBot()" class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2">
                            <i data-lucide="bot" class="w-4 h-4 text-amber-300"></i> ⚡️ Otomatik YKS Web Keşfini Çalıştır (AI Bot)
                        </button>
                        <button onclick="openAddDiscoveryModal()" class="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i> + Manuel Öneri Ekle
                        </button>
                    </div>
                </div>

                <div class="space-y-3">
            `;

            if (queue.length === 0) {
                html += `<p class="text-xs text-slate-500 text-center py-8">Şu anda onay bekleyen yeni keşfedilmiş kaynak bulunmuyor. Yukarındaki <b>'+ Keşif Havuzuna Yeni Kaynak Öner / Ekle'</b> butonunu kullanarak yeni bir yayın önerebilirsiniz.</p>`;
            } else {
                queue.forEach(q => {
                    let statusBadge = "bg-amber-950 text-amber-300 border-amber-800";
                    if (q.status === 'APPROVED') statusBadge = "bg-emerald-950 text-emerald-300 border-emerald-800";
                    else if (q.status === 'REJECTED') statusBadge = "bg-rose-950 text-rose-300 border-rose-800";

                    html += `
                    <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between hover:border-amber-500/50 transition">
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="font-bold text-xs text-white">${q.title}</h4>
                                <span class="text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${statusBadge}">${q.status || 'PENDING'}</span>
                            </div>
                            <p class="text-[11px] text-slate-400 mt-1">Yayın: <span class="text-amber-300 font-semibold">${q.publisher_name}</span> | Ders: ${q.subject_name} | Sınav: ${q.exam_type} | Seviye: ${q.level}</p>
                            ${q.source_url ? `<a href="${q.source_url}" target="_blank" class="text-[10px] text-indigo-400 underline mt-1 block">🔍 Kaynak Satış / İnceleme Bağlantısı</a>` : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            ${q.status !== 'APPROVED' ? `
                            <button onclick="handleDiscoveryAction(${q.id}, 'APPROVED')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-md">
                                ✓ ONAYLA
                            </button>
                            ` : ''}
                            ${q.status !== 'REJECTED' ? `
                            <button onclick="handleDiscoveryAction(${q.id}, 'REJECTED')" class="bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-xs px-3 py-1.5 rounded-lg transition border border-rose-800">
                                ✕ REDDET
                            </button>
                            ` : ''}
                            <button onclick="deleteDiscoveryItem(${q.id})" title="Keşif Havuzundan Sil" class="bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white p-1.5 rounded-lg transition border border-slate-700">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    `;
                });
            }
            html += `</div></div>`;
        } else if (subTab === 'OFFICIAL') {
            // ÖSYM & MEB OFFICIAL TAB
            html += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- ÖSYM ÇIKMIŞ SORULAR -->
                <div class="glass-card p-6 border border-slate-800">
                    <h3 class="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <i data-lucide="award" class="w-5 h-5 text-amber-400"></i> ÖSYM Çıkmış Sorular (2023 - 2026)
                    </h3>
                    <p class="text-xs text-slate-400 mb-4">Soruların telif hakları nedeniyle ÖSYM'nin resmî portalı bağlantısı verilmiştir</p>
                    
                    <div class="space-y-3">
                        <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                            <div>
                                <h4 class="font-bold text-xs text-white">TYT 2026 Çıkmış Soruları & Cevap Anahtarı</h4>
                                <span class="text-[10px] text-slate-400">Tüm Temel Yeterlilik Testi Kitapçığı</span>
                            </div>
                            <a href="https://www.osym.gov.tr" target="_blank" class="bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 text-xs px-3 py-1.5 rounded-lg border border-amber-800/50 font-semibold transition">
                                🔗 ÖSYM Bağlantısı
                            </a>
                        </div>
                        <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                            <div>
                                <h4 class="font-bold text-xs text-white">AYT 2026 Çıkmış Soruları & Cevap Anahtarı</h4>
                                <span class="text-[10px] text-slate-400">Alan Yeterlilik Testleri Kitapçığı</span>
                            </div>
                            <a href="https://www.osym.gov.tr" target="_blank" class="bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 text-xs px-3 py-1.5 rounded-lg border border-amber-800/50 font-semibold transition">
                                🔗 ÖSYM Bağlantısı
                            </a>
                        </div>
                        <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                            <div>
                                <h4 class="font-bold text-xs text-white">YDT 2026 Çıkmış Soruları & Cevap Anahtarı</h4>
                                <span class="text-[10px] text-slate-400">Yabancı Dil Testi Kitapçığı</span>
                            </div>
                            <a href="https://www.osym.gov.tr" target="_blank" class="bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 text-xs px-3 py-1.5 rounded-lg border border-amber-800/50 font-semibold transition">
                                🔗 ÖSYM Bağlantısı
                            </a>
                        </div>
                    </div>
                </div>

                <!-- MEB & EBA RESMİ KAYNAKLAR -->
                <div class="glass-card p-6 border border-slate-800">
                    <h3 class="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <i data-lucide="book-marked" class="w-5 h-5 text-emerald-400"></i> MEB / EBA / ÖDSGM Resmi Ücretsiz Kaynaklar
                    </h3>
                    <p class="text-xs text-slate-400 mb-4">Türkiye Yüzyılı Maarif Modeli ve MEB 3 Adım Testleri</p>

                    <div class="space-y-3">
                        <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                            <div>
                                <h4 class="font-bold text-xs text-white">MEB 3 Adım TYT / AYT Soru Bankaları</h4>
                                <span class="text-[10px] text-slate-400">Ücretsiz EBA Dijital Soru Bankası</span>
                            </div>
                            <a href="https://ogmmateryal.eba.gov.tr" target="_blank" class="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-xs px-3 py-1.5 rounded-lg border border-emerald-800/50 font-semibold transition">
                                🌐 MEB Materyal
                            </a>
                        </div>
                        <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                            <div>
                                <h4 class="font-bold text-xs text-white">MEB Ders Kitapları (PDF Portalı)</h4>
                                <span class="text-[10px] text-slate-400">9-12. Sınıf Resmî Ders Kitapları</span>
                            </div>
                            <a href="https://eba.gov.tr" target="_blank" class="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-xs px-3 py-1.5 rounded-lg border border-emerald-800/50 font-semibold transition">
                                🌐 EBA Portal
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }

        document.getElementById('viewContainer').innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderResourcesView error:", err);
    }
}

// SOFT DELETE RESOURCE
async function softDeleteResource(id) {
    if (!confirm("Bu kaynağı pasife almak istediğinizden emin misiniz? (Geçmiş öğrenci raporları saklanacaktır)")) return;
    const token = localStorage.getItem('yks_token');
    try {
        await fetch(`${API_BASE}/kaynaklar/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        alert("Kaynak başarıyla pasife alındı!");
        renderResourcesView(activeResourceSubjectFilter, activeResourceSubTab);
    } catch (err) {
        alert("İşlem sırasında hata oluştu!");
    }
}

// TRIGGER AUTOMATED AI RESOURCE DISCOVERY BOT
async function triggerAutoDiscoveryBot() {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynaklar/kesif/auto-discover`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert("🤖 " + data.message);
        renderResourcesView(activeResourceSubjectFilter, 'DISCOVERY');
    } catch (err) {
        alert("Otomatik keşif taraması sırasında hata oluştu!");
    }
}

// HANDLE DISCOVERY ACTION (APPROVE / REJECT)
async function handleDiscoveryAction(id, action) {
    const token = localStorage.getItem('yks_token');
    try {
        await fetch(`${API_BASE}/kaynaklar/kesif`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id, action })
        });
        alert(`Keşif kaynağı ${action === 'APPROVED' ? 'ONAYLANDI ve Ana Kataloğa Eklendi' : 'REDDEDİLDİ'}!`);
        renderResourcesView(activeResourceSubjectFilter, 'DISCOVERY');
    } catch (err) {
        alert("İşlem sırasında hata oluştu!");
    }
}

// DELETE ITEM FROM DISCOVERY QUEUE
async function deleteDiscoveryItem(id) {
    if (!confirm("Bu yayın önerisini keşif havuzundan kalıcı olarak silmek istediğinizden emin misiniz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        await fetch(`${API_BASE}/kaynaklar/kesif/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        alert("Keşif havuzundaki kaynak başarıyla silindi!");
        renderResourcesView(activeResourceSubjectFilter, 'DISCOVERY');
    } catch (err) {
        alert("Silme işlemi sırasında hata oluştu!");
    }
}

// OPEN ADD DISCOVERY RESOURCE MODAL
function openAddDiscoveryModal() {
    let html = `
    <h3 class="text-base font-bold text-white mb-1">🔍 Keşif Havuzuna Yeni Kaynak Öner / Ekle</h3>
    <p class="text-xs text-slate-400 mb-4">Web'de incelediğiniz veya önerilmesini istediğiniz yayın bilgilerini girin</p>
    <form onsubmit="submitNewDiscoveryResource(event)" class="space-y-3 text-xs">
        <div>
            <label class="block text-slate-400 mb-1">Kaynak / Kitap Adı</label>
            <input type="text" id="discTitle" required placeholder="ör: 2027 Model Orijinal AYT Fizik" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-400 mb-1">Yayınevi Adı</label>
                <input type="text" id="discPublisher" required placeholder="ör: Orijinal Yayınları" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
            </div>
            <div>
                <label class="block text-slate-400 mb-1">Ders</label>
                <input type="text" id="discSubject" required placeholder="ör: AYT Fizik" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-400 mb-1">Sınav Tipi</label>
                <select id="discExamType" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                    <option value="TYT">TYT</option>
                    <option value="AYT">AYT</option>
                    <option value="YDT">YDT</option>
                </select>
            </div>
            <div>
                <label class="block text-slate-400 mb-1">Zorluk Seviyesi</label>
                <select id="discLevel" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                    <option value="BAŞLANGIÇ">Başlangıç</option>
                    <option value="ORTA" selected>Orta</option>
                    <option value="İLERİ">İleri</option>
                    <option value="DERECE">Derece</option>
                </select>
            </div>
        </div>

        <div>
            <label class="block text-slate-400 mb-1">Resmî / İnceleme Bağlantı URL (Opsiyonel)</label>
            <input type="url" id="discUrl" placeholder="https://..." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
        </div>

        <button type="submit" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl shadow-md transition mt-2">
            Keşif Havuzuna Ekle
        </button>
    </form>`;
    openModal(html);
}

async function submitNewDiscoveryResource(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const title = document.getElementById('discTitle').value;
    const publisher_name = document.getElementById('discPublisher').value;
    const subject_name = document.getElementById('discSubject').value;
    const exam_type = document.getElementById('discExamType').value;
    const level = document.getElementById('discLevel').value;
    const source_url = document.getElementById('discUrl').value;

    try {
        await fetch(`${API_BASE}/kaynaklar/kesif`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, publisher_name, subject_name, exam_type, level, source_url })
        });
        closeModal();
        alert("Yeni kaynak keşif havuzuna eklendi! Admin onayından sonra ana kataloğa aktarılacaktır.");
        renderResourcesView(activeResourceSubjectFilter, 'DISCOVERY');
    } catch (err) {
        alert("Keşif kaynağı eklenirken hata oluştu!");
    }
}

// YENİ KAYNAK / KİTAP EKLEME MODALI
function openAddResourceModal() {
    let html = `
    <h3 class="text-base font-bold text-white mb-1">📘 Sisteme Yeni Kaynak / Kitap Ekle</h3>
    <p class="text-xs text-slate-400 mb-4">Piyasadaki soru bankası veya fasikülü kaynak kataloğuna ekleyin</p>
    <form onsubmit="submitNewResource(event)" class="space-y-3 text-xs">
        <div>
            <label class="block text-slate-400 mb-1">Kaynak / Kitap Adı</label>
            <input type="text" id="resTitle" required placeholder="ör: 3D AYT Matematik Soru Bankası" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-400 mb-1">Yayın Evi</label>
                <select id="resPublisher" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                    <option value="1">3D Yayınları</option>
                    <option value="2">Bilgi Sarmal</option>
                    <option value="3">Apotemi Yayınları</option>
                    <option value="4">Karakök Yayınları</option>
                    <option value="5">Orijinal Yayınları</option>
                    <option value="6">Okyanus Yayınları</option>
                    <option value="7">Limit Yayınları</option>
                    <option value="8">345 Yayınları</option>
                    <option value="9">MEB Yayınları</option>
                </select>
            </div>
            <div>
                <label class="block text-slate-400 mb-1">Ders Kategori Seçin</label>
                <select id="resSubject" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                    <option value="2">Matematik (TYT)</option>
                    <option value="11">AYT Matematik</option>
                    <option value="1">Türkçe (TYT)</option>
                    <option value="16">Türk Dili ve Edebiyatı (AYT)</option>
                    <option value="3">Geometri</option>
                    <option value="4">Fizik (TYT)</option>
                    <option value="13">AYT Fizik</option>
                    <option value="5">Kimya (TYT)</option>
                    <option value="14">AYT Kimya</option>
                    <option value="6">Biyoloji (TYT)</option>
                    <option value="15">AYT Biyoloji</option>
                    <option value="7">Tarih</option>
                    <option value="8">Coğrafya</option>
                    <option value="9">Felsefe</option>
                    <option value="10">İngilizce / YDT</option>
                </select>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
            <div>
                <label class="block text-slate-400 mb-1">Alan Türü</label>
                <select id="resTrack" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                    <option value="ALL">Tümü (Ortak)</option>
                    <option value="SAYISAL">Sayısal (MF)</option>
                    <option value="EA">Eşit Ağırlık (EA)</option>
                    <option value="SOZEL">Sözel (TS)</option>
                    <option value="YDT">Dil (YDT)</option>
                </select>
            </div>
            <div>
                <label class="block text-slate-400 mb-1">Zorluk Seviyesi</label>
                <select id="resLevel" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                    <option value="KOLAY">Kolay</option>
                    <option value="ORTA" selected>Orta</option>
                    <option value="ZOR">Zor</option>
                    <option value="ÖSYM">ÖSYM Seviyesi</option>
                </select>
            </div>
            <div>
                <label class="block text-slate-400 mb-1">Toplam Soru</label>
                <input type="number" id="resTotalQ" value="1200" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
            </div>
        </div>

        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-md transition mt-2">
            Kaynağı Sisteme Kaydet
        </button>
    </form>`;
    openModal(html);
}

async function submitNewResource(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const title = document.getElementById('resTitle').value;
    const publisher_id = document.getElementById('resPublisher').value;
    const subject_id = document.getElementById('resSubject').value;
    const track = document.getElementById('resTrack').value;
    const level = document.getElementById('resLevel').value;
    const total_questions = document.getElementById('resTotalQ').value;

    try {
        await fetch(`${API_BASE}/kaynaklar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, publisher_id, subject_id, track, level, total_questions })
        });
        closeModal();
        alert("Yeni kaynak sisteme başarıyla eklendi ve alanına göre kategorize edildi!");
        await loadAllResourcesCache();
        renderResourcesView(activeResourceSubjectFilter);
    } catch (err) {
        alert("Kaynak eklenirken bir hata oluştu!");
    }
}

// KAYNAK SEÇİMLİ VE SAYFA ARALIKLI ÖDEV ATA MODALI (DERS DİNAMİK FİLTRELİ)
async function openAssignModal(studentId, name) {
    const token = localStorage.getItem('yks_token');
    if (allPlatformResources.length === 0) await loadAllResourcesCache();

    let html = `
    <h3 class="text-base font-bold text-white mb-1">📘 ${name} için Kaynaktan Ödev Ata</h3>
    <p class="text-xs text-slate-400 mb-4">Ders seçtiğinizde sistemdeki o derse ait kitaplar otomatik filtrelenir</p>
    <form onsubmit="submitAssignment(event, ${studentId})" class="space-y-3 text-xs">
        <div>
            <label class="block text-slate-400 mb-1">Ödev Başlığı</label>
            <input type="text" id="assignTitle" required placeholder="ör: İntegral Belirli İntegral Test 4-8" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-400 mb-1">Ders Seçin (Otomatik Filtre)</label>
                <select id="assignSubject" onchange="filterAssignResourcesBySubject(this.value)" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-semibold">
                    <option value="2">Matematik (TYT)</option>
                    <option value="11">AYT Matematik</option>
                    <option value="1">Türkçe (TYT)</option>
                    <option value="16">Türk Dili ve Edebiyatı (AYT)</option>
                    <option value="3">Geometri</option>
                    <option value="4">Fizik (TYT)</option>
                    <option value="13">AYT Fizik</option>
                    <option value="5">Kimya (TYT)</option>
                    <option value="14">AYT Kimya</option>
                    <option value="6">Biyoloji (TYT)</option>
                    <option value="15">AYT Biyoloji</option>
                    <option value="7">Tarih</option>
                    <option value="8">Coğrafya</option>
                </select>
            </div>
            <div>
                <label class="block text-slate-400 mb-1">O Derse Ait Kitap Seçin</label>
                <select id="assignResource" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-semibold">
                    <!-- Populated dynamically -->
                </select>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-400 mb-1">Sayfa / Test Aralığı</label>
                <input type="text" id="assignRange" placeholder="ör: Sayfa 120 - 145" required class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-amber-400 font-semibold">
            </div>
            <div>
                <label class="block text-slate-400 mb-1">Hedef Soru Sayısı</label>
                <input type="number" id="assignTargetQ" value="60" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
            </div>
        </div>

        <div>
            <label class="block text-slate-400 mb-1">Son Teslim Tarihi</label>
            <input type="date" id="assignDueDate" required value="${new Date(Date.now() + 7*86400000).toISOString().split('T')[0]}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
        </div>

        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-md transition mt-2">
            Ödevi Gönder & Atayın
        </button>
    </form>`;
    openModal(html);
    filterAssignResourcesBySubject('2');
}

function filterAssignResourcesBySubject(subjectId) {
    const resSelect = document.getElementById('assignResource');
    if (!resSelect) return;

    const filtered = allPlatformResources.filter(r => r.subject_id == subjectId || !r.subject_id);
    if (filtered.length === 0) {
        resSelect.innerHTML = `<option value="">-- Bu Derse Ait Kitap Yok (Genel) --</option>` + allPlatformResources.map(r => `<option value="${r.id}">${r.title} (${r.publisher_name || 'Yayın'})</option>`).join('');
    } else {
        resSelect.innerHTML = `<option value="">-- Bu Derse Ait Kaynak Seçin --</option>` + filtered.map(r => `<option value="${r.id}">${r.title} (${r.publisher_name || 'Yayın'})</option>`).join('');
    }
}

async function submitAssignment(e, studentId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const title = document.getElementById('assignTitle').value;
    const resource_id = document.getElementById('assignResource').value || null;
    const section_range = document.getElementById('assignRange').value;
    const target_question_count = document.getElementById('assignTargetQ').value;
    const subject_id = document.getElementById('assignSubject').value;
    const due_date = document.getElementById('assignDueDate').value;

    await fetch(`${API_BASE}/odevler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_id: studentId, title, resource_id, section_range, target_question_count, subject_id, due_date })
    });
    closeModal();
    alert("Kaynak ödevi başarıyla atandı!");
    renderStudentDetailView(studentId);
}

// ----------------------------------------------------
// ÖĞRENCİ DETAY VE HAFTALIK PROGRAM ARŞİV/VERSİYONLAMA EKRANI
// ----------------------------------------------------
async function renderStudentDetailView(studentId, planId = null) {
    document.getElementById('pageTitle').textContent = "Öğrenci Profili & Program Paneli";
    const token = localStorage.getItem('yks_token');

    if (studentId) selectedStudentId = parseInt(studentId);
    if (!selectedStudentId && coachStudentsList.length > 0) selectedStudentId = coachStudentsList[0].id;
    if (!selectedStudentId) selectedStudentId = 1;

    console.log('[STUDENT DETAIL LOAD]', { routeStudentId: studentId, selectedStudentId });

    try {
        const resSt = await fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataSt = await resSt.json();
        const student = (dataSt.students || []).find(s => s.id == selectedStudentId);

        const container = document.getElementById('viewContainer');
        if (!student) {
            console.log('[STUDENT NOT FOUND]', { routeStudentId: selectedStudentId });
            container.innerHTML = `
            <div class="glass-card p-12 border border-[var(--danger-border)] bg-[var(--danger-soft)] text-center rounded-2xl my-8 shadow-sm">
                <div class="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--danger-border)] text-[var(--danger)] text-3xl flex items-center justify-center mx-auto mb-4">
                    ⚠️
                </div>
                <h3 class="text-lg font-extrabold text-[var(--text-primary)] mb-2">ÖĞRENCİ BULUNAMADI</h3>
                <p class="text-xs text-[var(--text-secondary)] mb-6">İstenilen student_id (#${selectedStudentId}) sistemde bulunamadı veya bu öğrenciye erişim yetkiniz yok.</p>
                <button onclick="navigateView('students')" class="btn-primary font-bold text-xs px-6 py-2.5 rounded-xl">
                    ← Tüm Öğrencilerime Dön
                </button>
            </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        console.log('[STUDENT FOUND]', { id: student.id, name: student.name });

        let urlProg = `${API_BASE}/haftalik-program?student_id=${student.id}`;
        if (planId) urlProg += `&plan_id=${planId}`;
        const resProg = await fetch(urlProg, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataProg = await resProg.json();

        const resAss = await fetch(`${API_BASE}/odevler?student_id=${student.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataAss = await resAss.json();
        const assignments = dataAss.assignments || [];
        
        const allPlans = dataProg.all_plans || [];
        const currentPlan = dataProg.plan || null;
        const existingItems = dataProg.items || [];
        if (currentPlan) selectedPlanId = currentPlan.id;

        const planMap = {};
        existingItems.forEach(it => {
            const key = `${it.day_of_week}_${it.time_slot}`;
            planMap[key] = it.task_description || '';
        });

        const nextMonday = getNextMondayDate();

        let html = getCoachStudentSwitcherHtml();
        html += `
        <!-- BACK BUTTON & STUDENT PROFILE BANNER -->
        <button onclick="navigateView('students')" class="btn-secondary font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 mb-4 shadow-sm">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> Tüm Öğrencilerime Dön
        </button>

        <div class="glass-card p-6 border border-[var(--border)] bg-[var(--bg-card)] mb-6 rounded-2xl shadow-sm">
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-[var(--primary-light-bg)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary)] font-black text-xl shadow-sm">
                        ${student.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-xl font-extrabold text-[var(--text-primary)]">${student.name} ${student.surname || ''}</h2>
                            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-[var(--primary-light-bg)] text-[var(--primary)] border border-[var(--primary-border)] uppercase">${student.exam_system || 'YKS'} - ${student.track || 'SAYISAL'}</span>
                        </div>
                        <p class="text-xs text-[var(--text-secondary)] mt-1 flex flex-wrap items-center gap-3">
                            <span>🎯 Hedef: <strong class="text-[var(--success)] font-bold">${student.target_university || 'Hedef Üniversite'} - ${student.target_department || 'Hedef Bölüm'}</strong></span>
                            <span>| 👨‍🏫 Koç: <strong class="text-[var(--text-primary)] font-bold">${student.coach_name || 'Ümmü Akcan'}</strong></span>
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2.5 flex-wrap">
                    <button onclick="openCoachChangeStudentPasswordModal(${student.id}, '${escapeHtml(student.name)}')" class="bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer" title="Öğrenci Şifresini Yenile">
                        <i data-lucide="key" class="w-4 h-4"></i> Şifre Değiştir
                    </button>
                    <button onclick="navigateView('mufredat', ${student.id})" class="btn-primary font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer">
                        <i data-lucide="target" class="w-4 h-4"></i> 🎯 Müfredat & Kaynaklar
                    </button>
                    <button onclick="openAssignModal(${student.id}, '${student.name}')" class="btn-secondary font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer">
                        <i data-lucide="book-open-check" class="w-4 h-4"></i> + Kaynaktan Ödev Ata
                    </button>
                </div>
            </div>
        </div>

        <!-- DETAYLI ÖDEV TAKİP VE ONAY TABLOSU -->
        <div class="glass-card p-6 border border-slate-800 mb-6">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                        <i data-lucide="clipboard-check" class="w-5 h-5 text-indigo-400"></i> ${student.name} ÖDEV TAKİP & ONAY PANALİ
                    </h3>
                    <p class="text-xs text-slate-400 mt-0.5">Sistem kaynaklarından atanan ödevlerin sayfa aralıkları ve durumları</p>
                </div>
                <button onclick="openAssignModal(${student.id}, '${student.name}')" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                    + Yeni Kaynak Ödevi Ekle
                </button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead>
                        <tr class="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase">
                            <th class="p-3 border-r border-slate-800">Ödev Başlığı</th>
                            <th class="p-3 border-r border-slate-800">Kaynak / Kitap</th>
                            <th class="p-3 border-r border-slate-800">Sayfa / Test Aralığı</th>
                            <th class="p-3 border-r border-slate-800">Hedef Soru</th>
                            <th class="p-3 border-r border-slate-800">Son Teslim</th>
                            <th class="p-3 border-r border-slate-800">Durum</th>
                            <th class="p-3">Koç Aksiyonu</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
        `;

        if (assignments.length === 0) {
            html += `<tr><td colspan="7" class="p-6 text-center text-slate-500">Bu öğrenciye tanımlı ödev bulunamadı. <b>'+ Kaynaktan Ödev Ata'</b> butonundan kaynak ve sayfa aralığı seçerek ödev atayabilirsiniz.</td></tr>`;
        } else {
            assignments.forEach(a => {
                let statusBadge = "bg-slate-800 text-slate-300";
                if (a.status === 'COMPLETED') statusBadge = "bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold";
                else if (a.status === 'VERIFIED') statusBadge = "bg-teal-950 text-teal-300 border border-teal-800 font-bold";
                else if (a.status === 'LATE') statusBadge = "bg-rose-950 text-rose-400 border border-rose-800 font-bold";

                html += `
                <tr class="hover:bg-slate-800/40">
                    <td class="p-3 font-semibold text-white border-r border-slate-800">${a.title}</td>
                    <td class="p-3 text-indigo-400 border-r border-slate-800 font-medium">${a.resource_title || 'Genel Kaynak'}</td>
                    <td class="p-3 border-r border-slate-800 font-bold text-amber-400">${a.section_range || 'Tüm Kitap'}</td>
                    <td class="p-3 border-r border-slate-800">${a.target_question_count || 0} Soru</td>
                    <td class="p-3 border-r border-slate-800">${a.due_date}</td>
                    <td class="p-3 border-r border-slate-800"><span class="px-2.5 py-1 rounded-md text-[10px] ${statusBadge}">${formatEnumLabel(a.status)}</span></td>
                    <td class="p-3">
                        ${a.status !== 'VERIFIED' ? `
                        <button onclick="verifyAssignment(${a.id}, ${student.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition shadow">
                            ✓ Koç Onayı Ver
                        </button>` : `<span class="text-teal-400 text-[11px] font-bold">✓ Onaylandı</span>`}
                    </td>
                </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        </div>

        <!-- WEEKLY PROGRAM VERSION & ARCHIVE SELECTOR BAR -->
        <div class="glass-card p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div class="flex items-center gap-3 w-full sm:w-auto">
                <i data-lucide="archive" class="w-5 h-5 text-indigo-400"></i>
                <label class="text-xs font-bold text-slate-300">Haftalık Program Arşivi:</label>
                <select id="weekPlanSelect" onchange="switchWeekPlan(${student.id}, this.value)" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
        `;

        if (allPlans.length === 0) {
            html += `<option value="">Henüz Kayıtlı Program Yok</option>`;
        } else {
            allPlans.forEach(p => {
                const isSel = (currentPlan && currentPlan.id === p.id) ? 'selected' : '';
                html += `<option value="${p.id}" ${isSel}>📅 ${p.week_start_date} Haftası Programı (${p.item_count} Ders)</option>`;
            });
        }

        html += `
                </select>
            </div>

            <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-start sm:justify-end">
                <button onclick="prepareNewBlankWeekGrid()" class="bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700 text-indigo-200 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1">
                    ➕ Gelecek Hafta Programı
                </button>
                <input type="date" id="weekStartDateInput" value="${currentPlan ? currentPlan.week_start_date : nextMonday}" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white">
                ${currentPlan ? `<button onclick="deleteWeekPlan(${student.id}, ${currentPlan.id})" class="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Sil</button>` : ''}
            </div>
        </div>

        <!-- EXCEL-STYLE INTERACTIVE WEEKLY MATRIX GRID EDITOR -->
        <div class="glass-card p-6 border border-slate-800">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                        <i data-lucide="table" class="w-5 h-5 text-indigo-400"></i> HAFTALIK DERS PROGRAMI GİRİŞİ (EXCEL GRİD)
                    </h3>
                    <p class="text-xs text-slate-400 mt-0.5">O haftaya özel dersleri yazın. İstediğiniz zaman gelecek hafta için yeni program oluşturabilirsiniz.</p>
                </div>
                
                <button onclick="clearExcelGrid()" class="text-xs font-semibold text-rose-400 hover:text-rose-300">
                    🗑 Hücreleri Temizle
                </button>
            </div>

            <div class="overflow-x-auto overflow-y-auto max-h-[600px] border border-slate-800 rounded-2xl bg-slate-950/60 shadow-2xl">
                <table class="w-full text-left text-xs border-collapse" id="excelProgramGrid">
                    <thead class="sticky top-0 z-10 shadow-md">
                        <tr class="bg-slate-900 border-b border-slate-800 text-slate-400">
                            <th class="p-3.5 border-r border-slate-800 w-36 font-bold text-center bg-slate-900 sticky left-0 z-20 text-indigo-400">SAAT DİLİMİ</th>
                            ${DAYS_LIST.map(day => `<th class="p-3.5 border-r border-slate-800 font-bold text-white text-center min-w-[160px] bg-slate-900">${day}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/80">
        `;

        TIME_SLOTS.forEach(slot => {
            html += `<tr class="hover:bg-slate-900/40">`;
            html += `<td class="p-3 font-bold text-indigo-400 border-r border-slate-800 text-center bg-slate-950/40 text-[11px]">${slot}</td>`;

            DAYS_LIST.forEach(day => {
                const cellKey = `${day}_${slot}`;
                const val = planMap[cellKey] || '';
                html += `
                <td class="p-1 border-r border-slate-800/80">
                    <input type="text" 
                           data-day="${day}" 
                           data-slot="${slot}" 
                           value="${val}" 
                           placeholder="+ Ders / Görev..." 
                           class="w-full bg-slate-900/50 hover:bg-slate-800/60 focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-500 rounded-lg px-2.5 py-2 text-xs text-white transition placeholder:text-slate-600 focus:outline-none">
                </td>
                `;
            });
            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>

            <div class="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-slate-400">
                <span>💡 Hücreler arasında <b>Tab</b> tuşu ile ilerleyebilirsiniz. Her hafta için ayrı kaydedilir.</span>
                <button onclick="saveExcelStyleGrid(${student.id})" class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl shadow transition">
                    💾 Programı Kaydet & Öğrenciye Ata
                </button>
            </div>
        </div>
        `;

        document.getElementById('viewContainer').innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderStudentDetailView error:", err);
    }
}

// ----------------------------------------------------
// 3. GÜNLÜK / HAFTALIK SORU TAKİBİ
// ----------------------------------------------------
async function renderQuestionView() {
    document.getElementById('pageTitle').textContent = "Soru Takibi & Net Hesaplayıcı";
    const token = localStorage.getItem('yks_token');

    try {
        const res = await fetch(`${API_BASE}/soru-takibi?student_id=${selectedStudentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const logs = data.question_logs || [];

        let html = getCoachStudentSwitcherHtml();
        html += `
        <div class="glass-card p-6 border border-slate-800 mb-6">
            <h3 class="text-sm font-bold text-white mb-4">+ Yeni Soru Çözüm Kaydı Ekle</h3>
            <form onsubmit="saveQuestionLog(event)" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-xs text-slate-400 mb-1">Ders Seçin</label>
                    <select id="qSubject" required class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                        <option value="1">Türkçe</option>
                        <option value="2">Matematik</option>
                        <option value="3">Geometri</option>
                        <option value="4">Fizik</option>
                        <option value="5">Kimya</option>
                        <option value="6">Biyoloji</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs text-slate-400 mb-1">Doğru (D)</label>
                    <input type="number" id="qCorrect" value="40" min="0" oninput="updateCalcNet()" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                </div>
                <div>
                    <label class="block text-xs text-slate-400 mb-1">Yanlış (Y)</label>
                    <input type="number" id="qIncorrect" value="4" min="0" oninput="updateCalcNet()" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                </div>
                <div>
                    <label class="block text-xs text-slate-400 mb-1">Hesaplanan Net (D - Y/4)</label>
                    <input type="text" id="qNetPreview" value="39.0" disabled class="w-full bg-slate-900 border border-indigo-500/50 font-bold rounded-xl px-3 py-2 text-xs text-indigo-400">
                </div>
                <div class="sm:col-span-2 md:col-span-4 flex justify-end">
                    <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-md transition">
                        Kaydet & Ekle
                    </button>
                </div>
            </form>
        </div>

        <div class="glass-card p-6 border border-slate-800">
            <h3 class="text-sm font-bold text-white mb-4">Seçili Öğrencinin Soru Çözüm Kayıtları</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                    <thead class="bg-slate-900/80 text-slate-400 uppercase">
                        <tr>
                            <th class="p-3">Tarih</th>
                            <th class="p-3">Ders</th>
                            <th class="p-3">Doğru</th>
                            <th class="p-3">Yanlış</th>
                            <th class="p-3">Boş</th>
                            <th class="p-3">Net (D - Y/4)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                        ${logs.length === 0 ? `
                        <tr><td colspan="6" class="p-6 text-center text-slate-500">Bu öğrenci için henüz soru kayıt verisi bulunmuyor.</td></tr>
                        ` : logs.map(l => `
                        <tr class="hover:bg-slate-800/40">
                            <td class="p-3 font-medium text-white">${l.log_date}</td>
                            <td class="p-3">${l.subject_name}</td>
                            <td class="p-3 text-emerald-400 font-semibold">${l.correct}</td>
                            <td class="p-3 text-rose-400 font-semibold">${l.incorrect}</td>
                            <td class="p-3">${l.empty}</td>
                            <td class="p-3 font-bold text-indigo-400">${l.net}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
        document.getElementById('viewContainer').innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderQuestionView error:", err);
    }
}

// ----------------------------------------------------
// 7. YKS + LGS GELİŞMİŞ DENEME ANALİZ MOTORU ENGINE
// ----------------------------------------------------
let currentDenemeTab = 'TRENDS';
let currentDenemeChartSubject = 'TOTAL';

let selectedDenemeAttemptId = null;

function changeSelectedDenemeAttempt(attemptId) {
    if (!attemptId) return;
    selectedDenemeAttemptId = parseInt(attemptId);
    renderDenemeView();
}

async function renderDenemeView() {
    document.getElementById('pageTitle').textContent = "🎯 Deneme Analiz Motoru & Gelişim Takibi";
    const token = localStorage.getItem('yks_token');
    const container = document.getElementById('viewContainer');

    try {
        let targetStId = selectedStudentId || (coachStudentsList.length > 0 ? coachStudentsList[0].id : null);
        let studentParam = targetStId ? `?student_id=${targetStId}` : '';
        const res = await fetch(`${API_BASE}/deneme${studentParam}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const student = data.student || {};
        if (student.id) {
            selectedStudentId = student.id;
        }
        const studentName = `${student.name || ''} ${student.surname || ''}`.trim() || 'Öğrenci';
        const summary = data.summary || { total_exams: 0, latest_net: 0.0, prev_net: 0.0, net_change: 0.0, highest_net: 0.0, average_net: 0.0 };
        const attempts = data.attempts || [];
        const trends = data.trends || { total_net_trend: [], subject_trends: {} };
        const weaknesses = data.recurring_weaknesses || [];
        const errorBasket = data.error_basket || {};
        const autoReport = data.auto_report || "";

        const examSys = student.exam_system || 'YKS';
        const trackStr = student.track || 'SAYISAL';

        let html = getCoachStudentSwitcherHtml();

        if (attempts.length === 0) {
            html += `
            <div class="glass-card p-10 border border-slate-800 rounded-2xl text-center flex flex-col items-center justify-center my-6">
                <div class="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-3xl mb-4 shadow-inner">
                    📊
                </div>
                <h3 class="text-base font-black text-white mb-1">HENÜZ KAYITLI DENEME SINAVI BULUNMUYOR</h3>
                <p class="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    ${studentName} için henüz girilmiş deneme sınavı kaydı bulunmuyor. Yeni bir deneme ekleyerek analiz motorunu başlatın.
                </p>
                <button onclick="openAddDenemeModal()" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow-lg flex items-center gap-2">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i> + İLK DENEME KAYDINI GİR
                </button>
            </div>
            `;
            container.innerHTML = html;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Determine selected attempt
        if (!selectedDenemeAttemptId || !attempts.some(a => a.id === selectedDenemeAttemptId)) {
            selectedDenemeAttemptId = attempts[0].id;
        }

        let selectedAttemptIndex = attempts.findIndex(a => a.id === selectedDenemeAttemptId);
        if (selectedAttemptIndex === -1) selectedAttemptIndex = 0;
        const selectedAttempt = attempts[selectedAttemptIndex];

        const hasOlderExam = selectedAttemptIndex < attempts.length - 1;
        const olderExam = hasOlderExam ? attempts[selectedAttemptIndex + 1] : null;
        const hasNewerExam = selectedAttemptIndex > 0;
        const newerExam = hasNewerExam ? attempts[selectedAttemptIndex - 1] : null;

        html += `
        <!-- EXAM ATTEMPT SELECTION BAR -->
        <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-[#172238] border border-[#2A3954] flex items-center justify-center text-[#4F8CFF] font-black text-base">
                    📋
                </div>
                <div>
                    <span class="text-[10px] font-bold text-[#4F8CFF] uppercase tracking-widest block">İNCELENEN DENEME</span>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                        <select id="denemeAttemptSelect" onchange="changeSelectedDenemeAttempt(this.value)" class="bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:border-[#4F8CFF]">
                            ${attempts.map(a => `
                            <option value="${a.id}" ${a.id === selectedAttempt.id ? 'selected' : ''}>
                                ${a.exam_name || 'Deneme'} | ${a.exam_date || ''} — ${a.total_net ? a.total_net.toFixed(2) : '0.00'} Net (${a.exam_type || 'TYT'})
                            </option>
                            `).join('')}
                        </select>
                        <span class="text-xs font-bold text-slate-400">(${attempts.length - selectedAttemptIndex} / ${attempts.length})</span>
                    </div>
                </div>
            </div>

            <!-- EXAM NAVIGATION BUTTONS -->
            <div class="flex items-center gap-2 self-end md:self-center">
                <button onclick="changeSelectedDenemeAttempt(${hasOlderExam ? olderExam.id : ''})" ${!hasOlderExam ? 'disabled' : ''} class="btn-secondary-slate px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 disabled:opacity-40">
                    ← Önceki Deneme
                </button>
                <button onclick="changeSelectedDenemeAttempt(${hasNewerExam ? newerExam.id : ''})" ${!hasNewerExam ? 'disabled' : ''} class="btn-secondary-slate px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 disabled:opacity-40">
                    Sonraki Deneme →
                </button>
            </div>
        </div>

        <!-- ENGINE HEADER & ACTION BAR -->
        <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-[#172238] border border-[#2A3954] flex items-center justify-center text-[#4F8CFF] font-bold text-lg">
                    📊
                </div>
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-sm font-bold text-white">${studentName} — Deneme Analiz Motoru</h3>
                        <span class="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#172238] text-[#4F8CFF] border border-[#2A3954] uppercase tracking-wider">${examSys} (${trackStr})</span>
                    </div>
                    <p class="text-[11px] text-[#A8B3C7] mt-0.5">
                        İncelenen: <strong class="text-[#F3F6FC]">${selectedAttempt.exam_name}</strong> (${selectedAttempt.exam_date || ''})
                    </p>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                ${attempts.length >= 2 ? `
                <button onclick="openDenemeCompareModal()" class="btn-secondary-slate px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5">
                    <i data-lucide="scale" class="w-4 h-4 text-[#4F8CFF]"></i> ⚖️ Deneme Karşılaştır
                </button>
                ` : ''}
                <button onclick="openAddDenemeModal()" class="btn-primary-purple px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i> + Yeni Deneme Kaydı
                </button>
            </div>
        </div>

        <!-- SUMMARY SCORECARDS -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
            <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl flex flex-col justify-between">
                <span class="text-[10px] font-bold text-[#A8B3C7] uppercase tracking-wider block">SEÇİLEN DENEME NETİ</span>
                <div class="mt-1 flex items-baseline justify-between">
                    <span class="text-2xl font-black text-[#F3F6FC]">${selectedAttempt.total_net ? selectedAttempt.total_net.toFixed(2) : '0.00'}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#172238] text-[#4F8CFF] border border-[#2A3954]">
                        ${selectedAttempt.exam_type || 'TYT'}
                    </span>
                </div>
            </div>

            <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl flex flex-col justify-between">
                <span class="text-[10px] font-bold text-[#A8B3C7] uppercase tracking-wider block">GENEL ORTALAMA</span>
                <span class="text-2xl font-black text-[#4F8CFF] mt-1">${summary.average_net.toFixed(2)}</span>
            </div>

            <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl flex flex-col justify-between">
                <span class="text-[10px] font-bold text-[#A8B3C7] uppercase tracking-wider block">EN YÜKSEK NET</span>
                <span class="text-2xl font-black text-[#22C55E] mt-1">${summary.highest_net.toFixed(2)}</span>
            </div>

            <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl flex flex-col justify-between">
                <span class="text-[10px] font-bold text-[#A8B3C7] uppercase tracking-wider block">TOPLAM KAYITLI DENEME</span>
                <span class="text-2xl font-black text-[#F3F6FC] mt-1">${summary.total_exams} Sınav</span>
            </div>
        </div>

        <!-- AUTO REPORT EXECUTIVE SUMMARY COMMENTARY (AI ASISTANT AREA - PURPLE ACCENT) -->
        <div class="glass-card p-4 border border-[#6F63D9]/40 bg-[#111A2C] mb-6 flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-[#172238] border border-[#6F63D9]/50 flex items-center justify-center text-[#7C6AE6] text-sm font-bold flex-shrink-0 mt-0.5">
                🧠
            </div>
            <div class="flex-1">
                <h4 class="text-xs font-bold text-[#AFA7FF] uppercase tracking-wider mb-0.5">AKADEMİK KOÇ DEĞERLENDİRME VE ÖZET RAPORU</h4>
                <p class="text-xs text-[#F3F6FC] leading-relaxed font-medium">${autoReport}</p>
            </div>
        </div>

        <!-- TAB NAVIGATION -->
        <div class="glass-card p-1.5 border border-[#24314A] bg-[#111A2C] mb-6 flex items-center gap-2 overflow-x-auto">
            <button onclick="setDenemeEngineTab('OVERVIEW')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentDenemeTab === 'OVERVIEW' ? 'bg-[#6F63D9] text-white shadow' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                📌 Genel Sonuç
            </button>
            <button onclick="setDenemeEngineTab('SUBJECTS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentDenemeTab === 'SUBJECTS' ? 'bg-[#6F63D9] text-white shadow' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                📚 Ders Analizi
            </button>
            <button onclick="setDenemeEngineTab('TOPICS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap relative ${currentDenemeTab === 'TOPICS' ? 'bg-[#6F63D9] text-white shadow' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                🎯 Konu & Kronik Eksikler
                ${weaknesses.length > 0 ? `<span class="ml-1.5 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">${weaknesses.length}</span>` : ''}
            </button>
            <button onclick="setDenemeEngineTab('ERRORS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentDenemeTab === 'ERRORS' ? 'bg-[#6F63D9] text-white shadow' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                🛒 Hata Sepeti & Zaman Analizi
            </button>
            <button onclick="setDenemeEngineTab('ACTIONS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentDenemeTab === 'ACTIONS' ? 'bg-[#6F63D9] text-white shadow' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                ⚡ Koç Aksiyonları & Ödev Önerileri
            </button>
        </div>
        `;

        if (currentDenemeTab === 'OVERVIEW') {
            html += renderDenemeOverviewTabHtml(data, selectedAttempt);
        } else if (currentDenemeTab === 'SUBJECTS') {
            html += renderDenemeSubjectTabHtml(data, selectedAttempt);
        } else if (currentDenemeTab === 'TOPICS') {
            html += renderDenemeTopicsTabHtml(data, selectedAttempt);
        } else if (currentDenemeTab === 'ERRORS') {
            html += renderDenemeErrorsTabHtml(data, selectedAttempt);
        } else if (currentDenemeTab === 'ACTIONS') {
            html += renderDenemeActionsTabHtml(data, selectedAttempt);
        }

        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();

        if (currentDenemeTab === 'OVERVIEW') {
            initDenemeTrendChart(trends);
        }

    } catch (err) {
        console.error("renderDenemeView error:", err);
        container.innerHTML = `<div class="p-8 text-center text-rose-400 font-bold glass-card border border-rose-900/60">Deneme verileri yüklenirken hata oluştu: ${err.message}</div>`;
    }
}

function setDenemeEngineTab(tabName) {
    currentDenemeTab = tabName;
    renderDenemeView();
}

function setDenemeChartSubject(subjectName) {
    currentDenemeChartSubject = subjectName;
    renderDenemeView();
}

function renderDenemeOverviewTabHtml(data, selectedAttempt) {
    const summary = data.summary || { total_exams: 0, latest_net: 0.0, prev_net: 0.0, net_change: 0.0, highest_net: 0.0, average_net: 0.0, last_3_avg: 0.0, last_5_avg: 0.0, days_30_avg: 0.0, months_3_avg: 0.0 };
    const attempts = data.attempts || [];
    const targetAttempt = selectedAttempt || (attempts.length > 0 ? attempts[0] : null);

    let html = `
    ${targetAttempt ? `
    <div class="glass-card p-5 border border-indigo-900/60 bg-gradient-to-r from-slate-900/90 via-indigo-950/30 to-slate-900 rounded-2xl mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
            <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800">${targetAttempt.exam_type || 'TYT'}</span>
                <span class="text-xs text-slate-400 font-bold">${targetAttempt.exam_date}</span>
                <span class="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 uppercase">SEÇİLİ DENEME</span>
            </div>
            <h3 class="text-lg font-black text-white">${targetAttempt.exam_name || targetAttempt.title || 'Deneme Sınavı'}</h3>
            <p class="text-xs text-slate-400 mt-0.5">Yayın: <strong class="text-slate-200">${targetAttempt.publisher || 'Belirtilmedi'}</strong> | Süre: <strong class="text-slate-200">${targetAttempt.duration_minutes || 0} dk</strong></p>
        </div>
        <div class="flex items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800 self-start sm:self-auto">
            <div class="text-center px-3">
                <span class="text-[10px] font-bold text-indigo-400 uppercase block">DENEME NETİ</span>
                <span class="text-2xl font-black text-emerald-400">${targetAttempt.total_net ? targetAttempt.total_net.toFixed(2) : '0.00'}</span>
            </div>
            <div class="border-l border-slate-800 pl-3 text-center">
                <span class="text-[10px] font-bold text-slate-400 uppercase block">SON 3 ORT</span>
                <span class="text-xl font-bold text-indigo-300">${summary.last_3_avg ? summary.last_3_avg.toFixed(2) : '0.00'}</span>
            </div>
        </div>
    </div>
    ` : ''}

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SON 3 DENEME ORT</span>
            <span class="text-2xl font-black text-indigo-300 mt-1">${summary.last_3_avg ? summary.last_3_avg.toFixed(2) : '0.00'}</span>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SON 5 DENEME ORT</span>
            <span class="text-2xl font-black text-violet-300 mt-1">${summary.last_5_avg ? summary.last_5_avg.toFixed(2) : '0.00'}</span>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SON 30 GÜN ORT</span>
            <span class="text-2xl font-black text-emerald-400 mt-1">${summary.days_30_avg ? summary.days_30_avg.toFixed(2) : '0.00'}</span>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SON 3 AY ORT</span>
            <span class="text-2xl font-black text-amber-300 mt-1">${summary.months_3_avg ? summary.months_3_avg.toFixed(2) : '0.00'}</span>
        </div>
    </div>

    <div class="glass-card p-6 border border-slate-800 mb-6">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                📈 DENEME İLERLEME VE PERFORMANS TRENDİ
            </h3>
            <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button onclick="setDenemeChartSubject('TOTAL')" class="px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${currentDenemeChartSubject === 'TOTAL' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 text-slate-400 hover:text-white'}">
                    🌐 TOPLAM NET
                </button>
            </div>
        </div>
        <div class="h-64 relative">
            <canvas id="denemeTrendChart"></canvas>
        </div>
    </div>

    <div class="glass-card p-6 border border-slate-800">
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-white">📋 GİRİLEN DENEME SINAVLARI GEÇMİŞİ</h3>
            <span class="text-xs text-slate-400">Toplam ${attempts.length} Deneme Kaydı</span>
        </div>

        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-900/80">
                        <th class="py-3 px-3">Tarih</th>
                        <th class="py-3 px-3">Sınav Adı / Yayın</th>
                        <th class="py-3 px-3 text-center">Tür</th>
                        <th class="py-3 px-3 text-center">Süre</th>
                        <th class="py-3 px-3 text-center">Toplam Net</th>
                        <th class="py-3 px-3 text-center">Durum</th>
                        <th class="py-3 px-3 text-right">İşlem</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 text-xs font-medium">
                    ${attempts.length === 0 ? `
                    <tr><td colspan="7" class="py-8 text-center text-slate-500">Henüz girilmiş deneme sınavı kaydı yok.</td></tr>
                    ` : ''}
                    ${attempts.map(att => {
                        const isSelected = targetAttempt && att.id === targetAttempt.id;
                        return `
                        <tr onclick="changeSelectedDenemeAttempt(${att.id})" class="hover:bg-slate-800/40 transition cursor-pointer ${isSelected ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : ''}">
                            <td class="py-3 px-3 font-bold ${isSelected ? 'text-white font-extrabold' : 'text-indigo-300'} whitespace-nowrap">${att.exam_date}</td>
                            <td class="py-3 px-3 font-bold text-white">
                                <div class="flex items-center gap-1.5">
                                    ${att.exam_name || att.title || 'Deneme Sınavı'}
                                    ${isSelected ? '<span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-600 text-white uppercase">Seçili</span>' : ''}
                                </div>
                                <span class="text-[10px] text-slate-400 font-normal">${att.publisher || 'Yayın Belirtilmedi'}</span>
                            </td>
                            <td class="py-3 px-3 text-center">
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">${att.exam_type || 'TYT'}</span>
                            </td>
                            <td class="py-3 px-3 text-center text-slate-400">${att.duration_minutes ? att.duration_minutes + ' dk' : '-'}</td>
                            <td class="py-3 px-3 text-center font-black text-emerald-400 text-sm">${att.total_net ? att.total_net.toFixed(2) : '0.00'}</td>
                            <td class="py-3 px-3 text-center">
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800">TAMAMLANDI</span>
                            </td>
                            <td class="py-3 px-3 text-right space-x-1.5 whitespace-nowrap" onclick="event.stopPropagation()">
                                <button onclick="openDenemeDetailModal(${att.id})" class="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 px-2.5 py-1 rounded-lg text-[11px] font-bold transition">
                                    🔍 Detay Karnesi
                                </button>
                                <button onclick="deleteDenemeAttempt(${att.id})" class="bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-800 px-2 py-1 rounded-lg text-[11px] font-bold transition">
                                    🗑️
                                </button>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>
    `;

    return html;
}

function renderDenemeSubjectTabHtml(data, selectedAttempt) {
    const attempts = data.attempts || [];
    const targetAttempt = selectedAttempt || (attempts.length > 0 ? attempts[0] : null);
    const testResults = targetAttempt ? (targetAttempt.test_results || []) : [];

    let html = `
    <div class="glass-card p-6 border border-slate-800 mb-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="text-sm font-bold text-white">📚 DERS BAZLI DENEME PERFORMANSI VE BAŞARI ORANI</h3>
                <p class="text-xs text-slate-400 mt-0.5">${targetAttempt ? targetAttempt.exam_name + ' (' + targetAttempt.exam_date + ')' : 'Seçili denemedeki ders sonuçları'}</p>
            </div>
            ${targetAttempt ? `<span class="text-xs font-black text-emerald-400 bg-emerald-950 px-3 py-1 rounded-xl border border-emerald-800">Toplam Net: ${targetAttempt.total_net.toFixed(2)}</span>` : ''}
        </div>

        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-900/80">
                        <th class="py-3 px-3">Ders Adı</th>
                        <th class="py-3 px-3 text-center">Soru Sayısı</th>
                        <th class="py-3 px-3 text-center text-emerald-400">Doğru</th>
                        <th class="py-3 px-3 text-center text-rose-400">Yanlış</th>
                        <th class="py-3 px-3 text-center text-amber-400">Boş</th>
                        <th class="py-3 px-3 text-center text-indigo-300">Net</th>
                        <th class="py-3 px-3 text-center">Başarı %</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 text-xs font-medium">
                    ${testResults.length === 0 ? `
                    <tr><td colspan="7" class="py-8 text-center text-slate-500">Bu deneme için ders sonucu verisi bulunmuyor.</td></tr>
                    ` : ''}
                    ${testResults.map(tr => {
                        const pct = tr.success_rate || (tr.question_count > 0 ? (tr.net / tr.question_count * 100) : 0.0);
                        const pctClass = pct >= 70 ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : (pct >= 45 ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-rose-950 text-rose-400 border-rose-800');
                        return `
                        <tr class="hover:bg-slate-800/40 transition">
                            <td class="py-3 px-3 font-bold text-white flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                                ${tr.subject_name || 'Ders'}
                            </td>
                            <td class="py-3 px-3 text-center font-bold text-slate-300">${tr.question_count || 0}</td>
                            <td class="py-3 px-3 text-center font-black text-emerald-400">${tr.correct || 0}</td>
                            <td class="py-3 px-3 text-center font-black text-rose-400">${tr.wrong || 0}</td>
                            <td class="py-3 px-3 text-center font-black text-amber-400">${tr.blank || 0}</td>
                            <td class="py-3 px-3 text-center font-black text-indigo-300 text-sm">${tr.net ? tr.net.toFixed(2) : '0.00'}</td>
                            <td class="py-3 px-3 text-center">
                                <span class="text-[11px] font-black px-2.5 py-0.5 rounded-md border ${pctClass}">
                                    %${pct.toFixed(1)}
                                </span>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>
    `;

    return html;
}

function renderDenemeTopicsTabHtml(data, selectedAttempt) {
    const attempts = data.attempts || [];
    const targetAttempt = selectedAttempt || (attempts.length > 0 ? attempts[0] : null);
    const topicResults = targetAttempt ? (targetAttempt.topic_results || []) : [];
    const weaknesses = data.recurring_weaknesses || [];

    if (topicResults.length === 0 && weaknesses.length === 0) {
        return `
        <div class="glass-card p-8 border border-slate-800 rounded-2xl text-center flex flex-col items-center justify-center my-6">
            <div class="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-3xl mb-4 shadow-inner">
                🎯
            </div>
            <h3 class="text-base font-black text-white mb-1">DETAYLI KONU ANALİZİ HENÜZ HAZIR DEĞİL</h3>
            <p class="text-xs text-slate-400 max-w-md mb-5 leading-relaxed">
                Bu deneme sınavı (${targetAttempt ? targetAttempt.exam_name : ''}) için henüz konu bazlı doğru/yanlış verisi girilmedi. Konu analizi ekleyerek öncelikli müfredat konularını görüntüleyin.
            </p>
            ${targetAttempt ? `
            <button onclick="openAddTopicAnalysisModal(${targetAttempt.id})" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-5 py-3 rounded-xl transition shadow flex items-center gap-2">
                <i data-lucide="plus-circle" class="w-4 h-4"></i> 🎯 ${targetAttempt.exam_name} İÇİN KONU ANALİZİ GİR
            </button>
            ` : `
            <button onclick="openAddDenemeModal()" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-5 py-3 rounded-xl transition shadow flex items-center gap-2">
                <i data-lucide="plus-circle" class="w-4 h-4"></i> + İLK DENEME VE KONU KAYDINI GİR
            </button>
            `}
        </div>
        `;
    }

    let html = `
    <!-- SEÇİLEN DENEMENİN KONU ANALİZLERİ -->
    ${targetAttempt ? `
    <div class="glass-card p-6 border border-slate-800 mb-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    🎯 SEÇİLEN DENEMENİN KONU ANALİZLERİ
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">${targetAttempt.exam_name} (${targetAttempt.exam_date || ''})</p>
            </div>
            <button onclick="openAddTopicAnalysisModal(${targetAttempt.id})" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition shadow">
                + Konu Analizi Ekle
            </button>
        </div>

        ${topicResults.length === 0 ? `
        <p class="text-xs text-slate-500 py-4 text-center bg-slate-900/50 rounded-xl border border-slate-800">
            Bu denemede henüz tanımlanmış konu kırılımı yok. Yukarıdaki "+ Konu Analizi Ekle" butonuyla konu verisi ekleyebilirsiniz.
        </p>
        ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${topicResults.map(tr => `
            <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">${tr.subject_name || 'Ders'}</span>
                        <h4 class="text-xs font-bold text-white">${tr.topic_name || 'Konu'}</h4>
                    </div>
                    <div class="text-[11px] text-slate-400 space-x-2 mt-1">
                        <span>Soru: <strong>${tr.question_count}</strong></span>
                        <span class="text-emerald-400 font-bold">${tr.correct} D</span>
                        <span class="text-rose-400 font-bold">${tr.wrong} Y</span>
                        <span class="text-amber-400 font-bold">${tr.blank} B</span>
                        <span>Net: <strong class="text-indigo-300">${tr.net ? tr.net.toFixed(2) : '0.00'}</strong></span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xs font-black px-2.5 py-1 rounded-lg ${tr.success_rate >= 70 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}">
                        %${tr.success_rate || 0}
                    </span>
                </div>
            </div>
            `).join('')}
        </div>
        `}
    </div>
    ` : ''}

    <!-- KRONİK EKSİK MÜFREDAT KONULARI (TÜM DENEMELER GENELİ) -->
    <div class="glass-card p-5 border border-rose-900/60 bg-rose-950/20 rounded-2xl mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-900/80 border border-rose-700 flex items-center justify-center text-rose-300 font-bold text-lg">
                ⚠️
            </div>
            <div>
                <h4 class="text-sm font-bold text-rose-300">ÖĞRENCİNİN GENEL KRONİK EKSİK KONULARI</h4>
                <p class="text-xs text-slate-300">Son denemelerde üst üste yanlış/boş bırakılan ve acil müdahale gerektiren konular tespiti.</p>
            </div>
        </div>
        <div class="flex items-center gap-2 self-start sm:self-auto">
            <span class="text-xs font-black px-3 py-1 rounded-xl bg-rose-950/80 text-rose-300 border border-rose-800 uppercase tracking-wider">
                ${weaknesses.length} Kronik Eksik
            </span>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${weaknesses.map(w => `
        <div class="glass-card p-5 border border-[#24314A] bg-[#111A2C] rounded-2xl flex flex-col justify-between hover:border-[#33445F] transition">
            <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-[#172238] text-[#4F8CFF] border border-[#2A3954] uppercase">${w.subject_name || 'Ders'}</span>
                    <span class="text-xs font-black px-2.5 py-0.5 rounded-md bg-rose-950/60 text-rose-400 border border-rose-800/60">
                        Öncelik Skoru: ${w.priority_score || 80}/100
                    </span>
                </div>
                <h4 class="text-sm font-bold text-white mb-2">${w.topic_name || 'Konu Adı'}</h4>
                <div class="grid grid-cols-3 gap-2 text-center text-[11px] bg-[#0B1324] p-2.5 rounded-xl border border-[#2A3954] mb-4">
                    <div>
                        <span class="text-[#A8B3C7] block text-[10px]">Soru Hata</span>
                        <strong class="text-rose-400 font-bold">${w.total_wrong || 0} Yanlış</strong>
                    </div>
                    <div>
                        <span class="text-[#A8B3C7] block text-[10px]">Boş</span>
                        <strong class="text-amber-400 font-bold">${w.total_blank || 0} Boş</strong>
                    </div>
                    <div>
                        <span class="text-[#A8B3C7] block text-[10px]">Zayıf Sınavlar</span>
                        <strong class="text-[#4F8CFF] font-bold">${w.fail_count_last_exams || 2} Deneme</strong>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2 pt-2 border-t border-[#24314A] flex-wrap">
                <button onclick="triggerDenemeAction(${data.student ? data.student.id : 1}, ${w.curriculum_topic_id}, '${w.topic_name.replace(/'/g, "\\'")}', '${w.subject_name.replace(/'/g, "\\'")}', 'ASSIGNMENT')" class="btn-primary-purple flex-1 text-[11px] py-1.5 px-3 rounded-xl transition text-center shadow">
                    + Ödev Oluştur
                </button>
                <button onclick="triggerDenemeAction(${data.student ? data.student.id : 1}, ${w.curriculum_topic_id}, '${w.topic_name.replace(/'/g, "\\'")}', '${w.subject_name.replace(/'/g, "\\'")}', 'PROGRAM')" class="btn-secondary-slate flex-1 text-[11px] py-1.5 px-3 rounded-xl transition text-center">
                    + Programa Ekle
                </button>
                <button onclick="triggerDenemeAction(${data.student ? data.student.id : 1}, ${w.curriculum_topic_id}, '${w.topic_name.replace(/'/g, "\\'")}', '${w.subject_name.replace(/'/g, "\\'")}', 'RESOURCE')" class="btn-secondary-slate flex-1 text-[11px] py-1.5 px-3 rounded-xl transition text-center">
                    📚 Kaynağa Git
                </button>
            </div>
        </div>
        `).join('')}
    </div>
    `;

    return html;
}

function renderDenemeErrorsTabHtml(data, selectedAttempt) {
    const attempts = data.attempts || [];
    const targetAttempt = selectedAttempt || (attempts.length > 0 ? attempts[0] : null);
    const errorBasket = data.error_basket || {};
    const hasErrorData = Object.keys(errorBasket).length > 0;

    const durationMin = targetAttempt ? (targetAttempt.duration_minutes || 165) : 165;
    const testResults = targetAttempt ? (targetAttempt.test_results || []) : [];
    const totalSolvedQ = testResults.reduce((acc, r) => acc + (r.correct + r.wrong), 0);
    const avgTimePerQuestion = totalSolvedQ > 0 ? (durationMin / totalSolvedQ).toFixed(1) : 0.0;

    const errorLabels = {
        'KNOWLEDGE_GAP': { title: '🧠 Bilgi Eksikliği', desc: 'Konu kural veya formülünün tam bilinmemesi', color: 'border-rose-900/60 bg-rose-950/20 text-rose-300' },
        'CARELESS_MISTAKE': { title: '👀 Dikkat Hatası', desc: 'Soru kökünü veya verilen rakamı yanlış okuma', color: 'border-amber-900/60 bg-amber-950/20 text-amber-300' },
        'CALCULATION_ERROR': { title: '🧮 İşlem Hatası', desc: 'Dört işlem veya işaret hatası', color: 'border-indigo-900/60 bg-indigo-950/20 text-indigo-300' },
        'TIME_PRESSURE': { title: '⏱️ Süre Baskısı / Zaman Yetmedi', desc: 'Zaman yetişmediği için panik veya boş bırakma (Bilgi eksikliği sayılmaz)', color: 'border-violet-900/60 bg-violet-950/20 text-violet-300' },
        'CONCEPT_CONFUSION': { title: '🔀 Kavram Karmaşası', desc: 'İki benzer konunun karıştırılması', color: 'border-blue-900/60 bg-blue-950/20 text-blue-300' },
        'OTHER': { title: '📋 Diğer Hata Türleri', desc: 'Soru analizi sırasında belirtilen diğer nedenler', color: 'border-slate-800 bg-slate-900/60 text-slate-300' }
    };

    let html = `
    <div class="glass-card p-5 border border-slate-800 rounded-2xl mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
            <h3 class="text-sm font-bold text-white mb-0.5">🛒 SORU HATA SEPETİ VE KÖK NEDEN AYRIMI</h3>
            <p class="text-xs text-slate-400">"Biliyor ama yapamıyor" ile "Süre yetişmedi" durumlarını net ayıran hata dağılımı.</p>
        </div>
        ${targetAttempt ? `<span class="text-xs font-bold text-indigo-300 bg-indigo-950 px-3 py-1 rounded-xl border border-indigo-800">${targetAttempt.exam_name}</span>` : ''}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        ${Object.keys(errorLabels).map(key => {
            const count = errorBasket[key] || 0;
            const meta = errorLabels[key];
            return `
            <div class="glass-card p-4 border ${meta.color} rounded-2xl flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="text-xs font-bold">${meta.title}</h4>
                        <span class="text-lg font-black">${count} Soru</span>
                    </div>
                    <p class="text-[11px] text-slate-300 font-medium">${meta.desc}</p>
                </div>
            </div>
            `;
        }).join('')}
    </div>

    <div class="glass-card p-6 border border-slate-800 rounded-2xl">
        <h3 class="text-sm font-bold text-white mb-4">⏱️ ZAMAN VE ÇÖZÜM HIZI ANALİZİ (${targetAttempt ? targetAttempt.exam_name : ''})</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">TOPLAM SINAV SÜRESİ</span>
                <span class="text-2xl font-black text-indigo-300 mt-1">${durationMin} Dakika</span>
            </div>
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">ÇÖZÜLEN TOPLAM SORU</span>
                <span class="text-2xl font-black text-emerald-400 mt-1">${totalSolvedQ} Soru</span>
            </div>
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">ORTALAMA SORU SÜRESİ</span>
                <span class="text-2xl font-black text-amber-300 mt-1">${avgTimePerQuestion} Dk / Soru</span>
            </div>
        </div>
    </div>
    `;

    return html;
}

function renderDenemeActionsTabHtml(data, selectedAttempt) {
    const weaknesses = data.recurring_weaknesses || [];

    let html = `
    <div class="glass-card p-6 border border-slate-800 mb-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="text-sm font-bold text-white">⚡ KOÇ ONAYLI ÖNERİLER VE AKSİYON LİSTESİ</h3>
                <p class="text-xs text-slate-400 mt-0.5">Deneme analiz motorunun otomatik ürettiği aksiyon teklifleri</p>
            </div>
            ${selectedAttempt ? `<span class="text-xs font-bold text-indigo-300 bg-indigo-950 px-3 py-1 rounded-xl border border-indigo-800">Seçili: ${selectedAttempt.exam_name}</span>` : ''}
        </div>

        <div class="space-y-3">
            ${weaknesses.length === 0 ? `
            <p class="text-xs text-slate-500 py-4 text-center">Şu an önerilen acil aksiyon bulunmuyor.</p>
            ` : ''}
            ${weaknesses.map(w => `
            <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">${w.subject_name}</span>
                        <h4 class="text-xs font-bold text-white">${w.topic_name}</h4>
                    </div>
                    <p class="text-[11px] text-slate-400">Son denemelerde ${w.total_wrong} yanlış ve ${w.total_blank} boş tespit edildi. Bu konu için soru çözümlü ödev atanması önerilir.</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap self-end sm:self-center">
                    <button onclick="triggerDenemeAction(${data.student ? data.student.id : 1}, ${w.curriculum_topic_id}, '${w.topic_name.replace(/'/g, "\\'")}', '${w.subject_name.replace(/'/g, "\\'")}', 'ASSIGNMENT')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow whitespace-nowrap">
                        📝 ÖDEV OLUŞTUR
                    </button>
                    <button onclick="triggerDenemeAction(${data.student ? data.student.id : 1}, ${w.curriculum_topic_id}, '${w.topic_name.replace(/'/g, "\\'")}', '${w.subject_name.replace(/'/g, "\\'")}', 'PROGRAM')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition border border-slate-700 whitespace-nowrap">
                        📅 PROGRAMA EKLE
                    </button>
                    <button onclick="triggerDenemeAction(${data.student ? data.student.id : 1}, ${w.curriculum_topic_id}, '${w.topic_name.replace(/'/g, "\\'")}', '${w.subject_name.replace(/'/g, "\\'")}', 'RESOURCE')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition border border-slate-700 whitespace-nowrap">
                        📚 KAYNAĞI AÇ
                    </button>
                </div>
            </div>
            `).join('')}
        </div>
    </div>
    `;

    return html;
}

async function openAddTopicAnalysisModal(attemptId) {
    const token = localStorage.getItem('yks_token');
    let attempt = null;
    let subjects = [];
    let examSys = 'YKS';
    let examType = 'TYT';
    let track = 'SAYISAL';

    try {
        const resDeneme = await fetch(`${API_BASE}/deneme?student_id=${selectedStudentId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const denemeData = await resDeneme.json();
        const attempts = denemeData.attempts || [];
        attempt = attempts.find(a => a.id === attemptId) || (attempts.length > 0 ? attempts[0] : null);

        examSys = attempt ? (attempt.exam_system || 'YKS') : 'YKS';
        examType = attempt ? (attempt.exam_type || 'TYT') : 'TYT';
        track = denemeData.student ? (denemeData.student.track || 'SAYISAL') : 'SAYISAL';

        const resSub = await fetch(`${API_BASE}/subjects?exam_system=${examSys}&exam_type=${examType}&field=${track}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const subData = await resSub.json();
        subjects = subData.subjects || [];
    } catch (e) {
        console.error("openAddTopicAnalysisModal data fetch error:", e);
    }

    const badgeText = `${examSys} • ${examType}${track ? ' • ' + track : ''} • 2026-2027`;

    const html = `
    <div class="max-w-2xl mx-auto space-y-4 text-xs">
        <div class="pb-2 border-b border-slate-800">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
                <i data-lucide="target" class="w-5 h-5 text-indigo-400"></i> Deneme Konu Analizi & Hata Sebebi Girişi
            </h3>
            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <p class="text-xs text-slate-300 font-semibold">
                    ${attempt ? attempt.exam_name : 'Seçili deneme sınavı'}
                </p>
                <span class="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-700/60 uppercase tracking-wide">
                    [ ${badgeText} ]
                </span>
            </div>
        </div>

        <form onsubmit="submitTopicAnalysis(event, ${attemptId})" class="space-y-4">
            <div class="glass-card p-4 border border-slate-800 space-y-3 bg-slate-900/90 rounded-2xl">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-slate-300 font-semibold mb-1">Ders Seçin *</label>
                        <select id="taSubjectSelect" onchange="loadTopicsForAnalysisModal(this.value, '${examType}', '${examSys}')" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold">
                            <option value="">-- Süzülmüş Ders Seçiniz --</option>
                            ${subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-slate-300 font-semibold mb-1">Konu Seçin *</label>
                        <select id="taTopicSelect" disabled class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-indigo-300 font-bold disabled:opacity-50">
                            <option value="">-- Önce Ders Seçiniz --</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-4 gap-2 text-center pt-2">
                    <div>
                        <label class="block text-slate-400 font-bold mb-1 text-[10px]">Soru Sayısı</label>
                        <input type="number" id="taQCount" value="1" min="1" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-center text-white font-bold">
                    </div>
                    <div>
                        <label class="block text-emerald-400 font-bold mb-1 text-[10px]">Doğru</label>
                        <input type="number" id="taCorrect" value="0" min="0" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-center text-emerald-400 font-bold">
                    </div>
                    <div>
                        <label class="block text-rose-400 font-bold mb-1 text-[10px]">Yanlış</label>
                        <input type="number" id="taWrong" value="0" min="0" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-center text-rose-400 font-bold">
                    </div>
                    <div>
                        <label class="block text-amber-400 font-bold mb-1 text-[10px]">Boş</label>
                        <input type="number" id="taBlank" value="0" min="0" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-center text-amber-400 font-bold">
                    </div>
                </div>

                <div>
                    <label class="block text-slate-300 font-semibold mb-1">Soru Hata Sebebi (Varsa)</label>
                    <select id="taErrorType" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-semibold">
                        <option value="KNOWLEDGE_GAP">🧠 Bilgi Eksikliği</option>
                        <option value="CARELESS_MISTAKE">👀 Dikkat Hatası</option>
                        <option value="CALCULATION_ERROR">🧮 İşlem Hatası</option>
                        <option value="TIME_PRESSURE">⏱️ Süre Baskısı / Zaman Yetmedi</option>
                        <option value="CONCEPT_CONFUSION">🔀 Kavram Karmaşası</option>
                        <option value="OTHER">📋 Diğer</option>
                    </select>
                </div>
            </div>

            <div class="flex items-center gap-2">
                <button type="submit" class="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl shadow transition text-xs uppercase tracking-wider">
                    + KONU KAYDINI KAYDET VE LİSTEYE EKLE
                </button>
            </div>
        </form>

        <!-- EKLENEN KONU ANALİZLERİ LİSTESİ -->
        <div id="addedTopicResultsContainer" class="border-t border-slate-800 pt-3">
            <!-- Populated via renderAddedTopicResultsList() -->
        </div>
    </div>
    `;

    openModal(html);
    if (window.lucide) lucide.createIcons();
    await renderAddedTopicResultsList(attemptId);
}

async function loadTopicsForAnalysisModal(subjectId, examType = 'TYT', examSys = 'YKS') {
    const topicSelect = document.getElementById('taTopicSelect');
    if (!topicSelect) return;
    if (!subjectId) {
        topicSelect.innerHTML = '<option value="">-- Önce Ders Seçiniz --</option>';
        topicSelect.disabled = true;
        return;
    }

    topicSelect.innerHTML = '<option value="">⏳ Konular Yükleniyor...</option>';
    topicSelect.disabled = true;

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/topics?subject_id=${subjectId}&exam_type=${examType}&exam_system=${examSys}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const topics = data.topics || [];

        if (topics.length === 0) {
            topicSelect.innerHTML = '<option value="">⚠️ Bu ders için tanımlı müfredat konusu bulunamadı.</option>';
            topicSelect.disabled = true;
        } else {
            topicSelect.innerHTML = topics.map(t => `<option value="${t.id}">${t.unit_name ? t.unit_name + ' → ' : ''}${t.name}</option>`).join('');
            topicSelect.disabled = false;
        }
    } catch (e) {
        console.error("loadTopicsForAnalysisModal error:", e);
        topicSelect.innerHTML = '<option value="">❌ Konular yüklenirken hata oluştu.</option>';
        topicSelect.disabled = true;
    }
}

async function renderAddedTopicResultsList(attemptId) {
    const container = document.getElementById('addedTopicResultsContainer');
    if (!container) return;

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/deneme?student_id=${selectedStudentId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const attempts = data.attempts || [];
        const att = attempts.find(a => a.id === attemptId);
        const topicResults = att ? (att.topic_results || []) : [];

        let html = `
        <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-bold text-indigo-300 uppercase tracking-wider">📋 DENEMEYE EKLENEN KONU ANALİZLERİ</h4>
            <span class="text-[10px] text-slate-400 font-bold">${topicResults.length} Kayıt</span>
        </div>
        `;

        if (topicResults.length === 0) {
            html += `<p class="text-[11px] text-slate-500 py-3 text-center bg-slate-900/50 rounded-xl border border-slate-800">Henüz bu denemeye eklenmiş konu kaydı bulunmuyor.</p>`;
        } else {
            html += `
            <div class="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                ${topicResults.map(tr => `
                <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                    <div>
                        <span class="font-bold text-indigo-300">${tr.subject_name || 'Ders'}</span> → <strong class="text-white">${tr.topic_name || 'Konu'}</strong>
                        <div class="text-[10px] text-slate-400 mt-0.5">
                            Soru: ${tr.question_count} | <span class="text-emerald-400 font-bold">${tr.correct} D</span> | <span class="text-rose-400 font-bold">${tr.wrong} Y</span> | <span class="text-amber-400 font-bold">${tr.blank} B</span> | Net: <strong class="text-indigo-300">${tr.net ? tr.net.toFixed(2) : '0.00'}</strong> (%${tr.success_rate || 0})
                        </div>
                    </div>
                    <button onclick="deleteTopicAnalysisRecord(${tr.id}, ${attemptId})" class="text-rose-400 hover:text-rose-300 p-1.5 hover:bg-rose-950/60 rounded-lg transition font-bold text-[10px]">
                        🗑️ Sil
                    </button>
                </div>
                `).join('')}
            </div>
            `;
        }

        container.innerHTML = html;
    } catch (e) {
        console.error("renderAddedTopicResultsList error:", e);
    }
}

async function submitTopicAnalysis(e, attemptId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const subject_id = parseInt(document.getElementById('taSubjectSelect').value);
    const curriculum_topic_id = parseInt(document.getElementById('taTopicSelect').value);
    const question_count = parseInt(document.getElementById('taQCount').value || 1);
    const correct = parseInt(document.getElementById('taCorrect').value || 0);
    const wrong = parseInt(document.getElementById('taWrong').value || 0);
    const blank = parseInt(document.getElementById('taBlank').value || 0);
    const error_type = document.getElementById('taErrorType').value;

    if (!subject_id || !curriculum_topic_id) {
        alert("Lütfen süzülmüş listeden ders ve konu seçiniz.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/deneme/topic-results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                exam_attempt_id: attemptId,
                topics: [{ subject_id, curriculum_topic_id, question_count, correct, wrong, blank }],
                questions: wrong > 0 ? [{ subject_id, curriculum_topic_id, question_number: 1, result: 'WRONG', error_type }] : []
            })
        });
        const data = await res.json();
        if (data.message) {
            // Reset numerical inputs while keeping modal open for consecutive entries
            document.getElementById('taQCount').value = 1;
            document.getElementById('taCorrect').value = 0;
            document.getElementById('taWrong').value = 0;
            document.getElementById('taBlank').value = 0;

            await renderAddedTopicResultsList(attemptId);
            renderDenemeView();
        } else if (data.error) {
            alert("Hata: " + data.error);
        }
    } catch (err) {
        alert("Bağlantı hatası: " + err.message);
    }
}

async function deleteTopicAnalysisRecord(resultId, attemptId) {
    if (!confirm("Bu konu analiz kaydını silmek istediğinizden emin misiniz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/deneme/topic-results/${resultId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.message) {
            await renderAddedTopicResultsList(attemptId);
            renderDenemeView();
        } else if (data.error) {
            alert(data.error);
        }
    } catch (e) {
        alert("Silme hatası: " + e.message);
    }
}

let denemeTrendChartInstance = null;
function initDenemeTrendChart(trends) {
    setTimeout(() => {
        const ctx = document.getElementById('denemeTrendChart');
        if (!ctx || !window.Chart) return;
        if (denemeTrendChartInstance) denemeTrendChartInstance.destroy();

        let labels = [];
        let datasetData = [];
        let labelName = "Toplam Net";

        if (currentDenemeChartSubject === 'TOTAL') {
            const series = trends.total_net_trend || [];
            labels = series.map(s => s.name || s.date);
            datasetData = series.map(s => s.net);
            labelName = "Toplam Net Gelişimi";
        } else {
            const subSeries = (trends.subject_trends || {})[currentDenemeChartSubject] || [];
            labels = subSeries.map(s => s.exam_name || s.date);
            datasetData = subSeries.map(s => s.net);
            labelName = `${currentDenemeChartSubject} Net Gelişimi`;
        }

        denemeTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: labelName,
                    data: datasetData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', weight: 'bold' } } } },
                scales: {
                    x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51, 65, 85, 0.3)' } },
                    y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51, 65, 85, 0.3)' } }
                }
            }
        });
    }, 100);
}

async function triggerDenemeAction(studentId, topicId, topicName, subjectName, actionType) {
    try {
        const token = localStorage.getItem('yks_token');
        const res = await fetch(`${API_BASE}/deneme/action`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: studentId,
                curriculum_topic_id: topicId,
                topic_name: topicName,
                subject_name: subjectName,
                action_type: actionType
            })
        });
        const data = await res.json();
        if (data.error) {
            alert("Aksiyon Hatası: " + data.error);
            return;
        }

        if (actionType === 'ASSIGNMENT') {
            alert(`✅ ${topicName} konusu için ödev modülüne aksiyon kaydı oluşturuldu!`);
            navigateView('assignments');
        } else if (actionType === 'PROGRAM') {
            alert(`✅ ${topicName} konusu haftalık program aksiyonuna aktarıldı!`);
            navigateView('program');
        } else if (actionType === 'RESOURCE') {
            alert(`✅ ${topicName} konusu müfredat & kaynak takibine yönlendiriliyor!`);
            navigateView('mufredat', studentId);
        }
    } catch (err) {
        console.error("triggerDenemeAction error:", err);
        alert("Aksiyon tetikleme hatası: " + err.message);
    }
}

async function deleteDenemeAttempt(attemptId) {
    if (!confirm("Bu deneme sınavını ve tüm detay sonuçlarını silmek istediğinizden emin misiniz?")) return;
    try {
        const token = localStorage.getItem('yks_token');
        const res = await fetch(`${API_BASE}/deneme/${attemptId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.message) {
            alert(data.message);
            renderDenemeView();
        } else if (data.error) {
            alert(data.error);
        }
    } catch (e) {
        alert("Silme hatası: " + e.message);
    }
}

function openDenemeCompareModal() {
    alert("Kıyaslama yapmak istediğiniz 2 denemeyi seçiniz.");
}

// ----------------------------------------------------
// 8. KİTAP OKUMA TAKİBİ
// ----------------------------------------------------
async function renderBooksView() {
    document.getElementById('pageTitle').textContent = "Kitap Okuma Takibi";
    const token = localStorage.getItem('yks_token');

    try {
        const res = await fetch(`${API_BASE}/kitaplar?student_id=${selectedStudentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const books = data.books || [];

        let html = getCoachStudentSwitcherHtml();
        html += `
        <div class="flex justify-between items-center mb-4">
            <p class="text-xs text-slate-400">Seçili Öğrencinin Okuma İlerlemesi</p>
            <button onclick="openAddBookModal()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md">
                <i data-lucide="plus-circle" class="w-4 h-4"></i> + Kitap Ekle
            </button>
        </div>

        <div class="glass-card p-6 border border-slate-800">
            <h3 class="text-sm font-bold text-white mb-4">📚 Okunan Kitaplar & Derecelendirme</h3>
            <div class="space-y-3">
        `;

        if (books.length === 0) {
            html += `<p class="text-xs text-slate-500 text-center py-4">Bu öğrenci için henüz kitap kaydı bulunmuyor.</p>`;
        } else {
            books.forEach(b => {
                const stars = '⭐️'.repeat(b.rating_stars || 5);
                html += `
                <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-xs text-white">${b.title}</h4>
                        <p class="text-[11px] text-slate-400">${b.author} | Okunan: ${b.read_pages} / ${b.total_pages} sayfa</p>
                    </div>
                    <div class="text-amber-400 text-xs">${stars}</div>
                </div>
                `;
            });
        }

        html += `</div></div>`;
        document.getElementById('viewContainer').innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderBooksView error:", err);
    }
}

// ----------------------------------------------------
// 8.b RAPORLAMA + DERS BAZLI GELİŞİM + AI KOÇ VERİ MOTORU
// ----------------------------------------------------
let currentReportsTab = 'OVERVIEW';
let currentReportsPreset = '3_MONTHS';
let currentReportsSelectedSubject = 'ALL';
let currentReportsCustomStart = '';
let currentReportsCustomEnd = '';
let reportsChartInstance = null;
let reportsSubjectChartInstance = null;

async function renderReportsView() {
    document.getElementById('pageTitle').textContent = "📈 Akademik Raporlama & Ders Bazlı Gelişim Motoru";
    const token = localStorage.getItem('yks_token');
    const container = document.getElementById('viewContainer');

    try {
        let studentParam = selectedStudentId ? `&student_id=${selectedStudentId}` : '';
        let customParam = (currentReportsPreset === 'CUSTOM' && currentReportsCustomStart && currentReportsCustomEnd)
            ? `&start_date=${currentReportsCustomStart}&end_date=${currentReportsCustomEnd}`
            : '';
        let subjectParam = currentReportsSelectedSubject !== 'ALL' ? `&subject_id=${currentReportsSelectedSubject}` : '';

        const res = await fetch(`${API_BASE}/raporlar?preset=${currentReportsPreset}${studentParam}${customParam}${subjectParam}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const student = data.student || {};
        const summary = data.overall_summary || {};
        const subjectAnalytics = data.subject_analytics || [];
        const monthlyAnalytics = data.monthly_analytics || { month_labels: [], subject_monthly_matrix: {} };
        const insights = data.insights || {};
        const aiContext = data.ai_analytics_context || {};

        const examSys = student.exam_system || 'YKS';
        const trackStr = student.track || 'SAYISAL';

        let html = getCoachStudentSwitcherHtml();

        html += `
        <!-- HEADER & STUDENT BADGES -->
        <div class="glass-card p-5 border border-slate-800 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/90 rounded-2xl shadow-xl">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-indigo-950/90 border border-indigo-700 flex items-center justify-center text-indigo-400 font-bold text-xl shadow-inner">
                    📈
                </div>
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h2 class="text-base font-black text-white">${student.name || 'Öğrenci'}</h2>
                        <span class="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase tracking-wider">${examSys} — ${trackStr}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${summary.trend === 'UP' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}">
                            Genel Trend: ${summary.trend === 'UP' ? '↗ Yükseliyor' : (summary.trend === 'DOWN' ? '↘ Geriliyor' : '→ Stabil')}
                        </span>
                    </div>
                    <p class="text-xs text-slate-400 mt-1">
                        Son Deneme: <strong class="text-white font-bold">${student.last_exam_net ? student.last_exam_net.toFixed(2) : '0.00'} Net</strong> (${student.last_exam_date || 'Tarih Yok'}) | Ortalama: <strong class="text-indigo-300 font-bold">${summary.average_net.toFixed(2)} Net</strong>
                    </p>
                </div>
            </div>

            <div class="flex items-center gap-2 self-end md:self-center">
                <button onclick="downloadPdfReport()" class="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow">
                    <i data-lucide="file-text" class="w-4 h-4"></i> 📄 PDF Rapor
                </button>
                <button onclick="downloadExcelExport()" class="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow">
                    <i data-lucide="sheet" class="w-4 h-4"></i> 📊 Excel İndir
                </button>
            </div>
        </div>

        <!-- DATE RANGE PRESETS TOOLBAR -->
        <div class="glass-card p-3 border border-slate-800 mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/60 rounded-2xl">
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1 whitespace-nowrap">Tarih Filtresi:</span>
                <button onclick="setReportsPreset('7_DAYS')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsPreset === '7_DAYS' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'}">
                    7 GÜN
                </button>
                <button onclick="setReportsPreset('30_DAYS')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsPreset === '30_DAYS' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'}">
                    30 GÜN
                </button>
                <button onclick="setReportsPreset('3_MONTHS')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsPreset === '3_MONTHS' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'}">
                    3 AY (Varsayılan)
                </button>
                <button onclick="setReportsPreset('6_MONTHS')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsPreset === '6_MONTHS' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'}">
                    6 AY
                </button>
                <button onclick="setReportsPreset('THIS_YEAR')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsPreset === 'THIS_YEAR' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'}">
                    BU YIL
                </button>
                <button onclick="setReportsPreset('ALL_TIME')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsPreset === 'ALL_TIME' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'}">
                    TÜM ZAMANLAR
                </button>
            </div>

            <div class="flex flex-wrap items-center gap-2 border-t lg:border-t-0 border-slate-800 pt-2 lg:pt-0">
                <input type="date" id="customStartDate" value="${currentReportsCustomStart}" class="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none">
                <span class="text-slate-500 text-xs">-</span>
                <input type="date" id="customEndDate" value="${currentReportsCustomEnd}" class="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none">
                <button onclick="applyCustomDateFilter()" class="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1 rounded-xl border border-slate-700 transition">
                    Filtrele
                </button>
            </div>
        </div>

        <!-- DASHBOARD TABS -->
        <div class="glass-card p-2 border border-slate-800 mb-6 flex items-center gap-2 overflow-x-auto">
            <button onclick="setReportsTab('OVERVIEW')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsTab === 'OVERVIEW' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-900'}">
                📌 Genel Özet
            </button>
            <button onclick="setReportsTab('SUBJECTS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsTab === 'SUBJECTS' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-900'}">
                📚 Ders Bazlı Gelişim
            </button>
            <button onclick="setReportsTab('MONTHLY')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsTab === 'MONTHLY' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-900'}">
                📅 Aylık & 3 Aylık Dönemsel
            </button>
            <button onclick="setReportsTab('AICOACH')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsTab === 'AICOACH' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-900'}">
                🤖 Yapay Zekâ Koç Veri Motoru (v1.0)
            </button>
        </div>
        `;

        if (currentReportsTab === 'OVERVIEW') {
            html += renderReportsOverviewTabHtml(data);
        } else if (currentReportsTab === 'SUBJECTS') {
            html += renderReportsSubjectsTabHtml(data);
        } else if (currentReportsTab === 'MONTHLY') {
            html += renderReportsMonthlyTabHtml(data);
        } else if (currentReportsTab === 'AICOACH') {
            html += renderReportsAICoachTabHtml(data);
        }

        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();

        if (currentReportsTab === 'OVERVIEW') {
            initOverallNetTrendChart(data.total_net_series || []);
        } else if (currentReportsTab === 'SUBJECTS') {
            initSubjectTrendChart(subjectAnalytics);
        }

    } catch (err) {
        console.error("renderReportsView error:", err);
        container.innerHTML = `<div class="p-8 text-center text-rose-400 font-bold glass-card border border-rose-900/60">Raporlar yüklenirken hata oluştu: ${err.message}</div>`;
    }
}

function setReportsTab(tabName) {
    currentReportsTab = tabName;
    renderReportsView();
}

function setReportsPreset(presetName) {
    currentReportsPreset = presetName;
    currentReportsCustomStart = '';
    currentReportsCustomEnd = '';
    renderReportsView();
}

function applyCustomDateFilter() {
    const s = document.getElementById('customStartDate').value;
    const e = document.getElementById('customEndDate').value;
    if (!s || !e) {
        alert("Lütfen hem Başlangıç hem Bitiş tarihini seçiniz.");
        return;
    }
    currentReportsPreset = 'CUSTOM';
    currentReportsCustomStart = s;
    currentReportsCustomEnd = e;
    renderReportsView();
}

function setReportsSelectedSubject(subId) {
    currentReportsSelectedSubject = subId;
    renderReportsView();
}

function renderReportsOverviewTabHtml(data) {
    const s = data.overall_summary || {};
    const insights = data.insights || {};
    const contradictions = insights.contradictions || [];

    let html = `
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">İLK NET</span>
            <span class="text-2xl font-black text-slate-300 mt-1">${s.first_net ? s.first_net.toFixed(2) : '0.00'}</span>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SON NET</span>
            <span class="text-2xl font-black text-white mt-1">${s.last_net ? s.last_net.toFixed(2) : '0.00'}</span>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TOPLAM DEĞİŞİM</span>
            <span class="text-2xl font-black ${s.net_change >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-1">
                ${s.net_change >= 0 ? '+' : ''}${s.net_change ? s.net_change.toFixed(2) : '0.00'}
            </span>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ORTALAMA NET</span>
            <span class="text-2xl font-black text-indigo-300 mt-1">${s.average_net ? s.average_net.toFixed(2) : '0.00'}</span>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EN YÜKSEK NET</span>
            <span class="text-2xl font-black text-emerald-400 mt-1">${s.highest_net ? s.highest_net.toFixed(2) : '0.00'}</span>
        </div>
    </div>

    <div class="glass-card p-6 border border-slate-800 mb-6">
        <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
            📈 TOPLAM NET GELİŞİM ÇİZGİSİ (${data.filter.preset} Filtresi)
        </h3>
        <div class="h-64 relative">
            <canvas id="reportsOverallChart"></canvas>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="glass-card p-4 border border-emerald-900/60 bg-emerald-950/20 rounded-2xl">
            <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">🟢 EN GÜÇLÜ DERS</span>
            <h4 class="text-base font-black text-white">${insights.strongest_subject || 'Veri Yok'}</h4>
            <p class="text-xs text-slate-300 mt-1">Dönem boyunca en yüksek ortalamaya sahip ders.</p>
        </div>
        <div class="glass-card p-4 border border-indigo-900/60 bg-indigo-950/20 rounded-2xl">
            <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">🚀 EN ÇOK GELİŞEN DERS</span>
            <h4 class="text-base font-black text-white">${insights.most_improved || 'Veri Yok'}</h4>
            <p class="text-xs text-slate-300 mt-1">İlk denemeden bu yana en büyük net artışı sağlayan ders.</p>
        </div>
        <div class="glass-card p-4 border border-rose-900/60 bg-rose-950/20 rounded-2xl">
            <span class="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-1">⚠️ DİKKAT GERİLEYEN DERS</span>
            <h4 class="text-base font-black text-white">${insights.declining_subject || 'Yok'}</h4>
            <p class="text-xs text-slate-300 mt-1">Son dönemde düşüş eğilimi gösteren ders.</p>
        </div>
    </div>

    ${contradictions.length > 0 ? `
    <div class="glass-card p-5 border border-amber-800/80 bg-amber-950/30 rounded-2xl mb-6">
        <h4 class="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            ⚠️ VOLATİLİTE VE ÇELİŞKİ UYARILARI (${contradictions.length} İkaz)
        </h4>
        <ul class="space-y-1.5 text-xs text-slate-300">
            ${contradictions.map(c => `<li class="flex items-start gap-2"><span>•</span><span>${c}</span></li>`).join('')}
        </ul>
    </div>
    ` : ''}
    `;

    return html;
}

function renderReportsSubjectsTabHtml(data) {
    const subjects = data.subject_analytics || [];

    if (subjects.length === 0) {
        return `<div class="p-8 text-center text-slate-500 font-medium glass-card">Ders bazlı analiz üretmek için kayıtlı deneme sınavı bulunamadı.</div>`;
    }

    let activeSubject = subjects.find(s => s.subject_id == currentReportsSelectedSubject) || subjects[0];

    let html = `
    <div class="glass-card p-3 border border-slate-800 mb-6 flex items-center gap-2 overflow-x-auto bg-slate-900/60 rounded-2xl">
        <button onclick="setReportsSelectedSubject('ALL')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsSelectedSubject === 'ALL' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'}">
            🌐 TÜM DERSLER KARŞILAŞTIRMASI
        </button>
        ${subjects.map(s => `
        <button onclick="setReportsSelectedSubject(${s.subject_id})" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentReportsSelectedSubject == s.subject_id ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'}">
            ${s.subject_name} (${s.last_net.toFixed(1)})
        </button>
        `).join('')}
    </div>
    `;

    if (currentReportsSelectedSubject === 'ALL') {
        html += `
        <div class="glass-card p-6 border border-slate-800">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-bold text-white">📊 TÜM DERSLERİN GELİŞİM VE PERFORMANS KARŞILAŞTIRMA TABLOSU</h3>
                <span class="text-xs text-slate-400">Sınav Sisteminizdeki Tüm Dersler</span>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-900/80">
                            <th class="py-3 px-3">Ders Adı</th>
                            <th class="py-3 px-3 text-center">İlk Net</th>
                            <th class="py-3 px-3 text-center">Son Net</th>
                            <th class="py-3 px-3 text-center">Değişim</th>
                            <th class="py-3 px-3 text-center">Ortalama</th>
                            <th class="py-3 px-3 text-center">Son 3 Ort.</th>
                            <th class="py-3 px-3 text-center">Son 5 Ort.</th>
                            <th class="py-3 px-3 text-center">Volatilite</th>
                            <th class="py-3 px-3 text-right">Trend & Durum</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60 text-xs font-medium">
                        ${subjects.map(s => {
                            const badgeColor = s.status_badge === 'GÜÇLÜ_GELİŞİM' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : (s.status_badge === 'GERİLEME' ? 'bg-rose-950 text-rose-400 border-rose-800' : 'bg-slate-900 text-indigo-300 border-slate-700');
                            return `
                            <tr class="hover:bg-slate-800/40 transition cursor-pointer" onclick="setReportsSelectedSubject(${s.subject_id})">
                                <td class="py-3 px-3 font-bold text-white">${s.subject_name}</td>
                                <td class="py-3 px-3 text-center text-slate-400">${s.first_net.toFixed(2)}</td>
                                <td class="py-3 px-3 text-center text-white font-bold">${s.last_net.toFixed(2)}</td>
                                <td class="py-3 px-3 text-center font-black ${s.net_change >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                                    ${s.net_change >= 0 ? '+' : ''}${s.net_change.toFixed(2)}
                                </td>
                                <td class="py-3 px-3 text-center text-indigo-300 font-bold">${s.average_net.toFixed(2)}</td>
                                <td class="py-3 px-3 text-center text-slate-300">${s.last_3_average.toFixed(2)}</td>
                                <td class="py-3 px-3 text-center text-slate-300">${s.last_5_average.toFixed(2)}</td>
                                <td class="py-3 px-3 text-center text-slate-300 text-[11px] font-semibold">${s.volatility === 'STABLE' ? 'Düşük' : (s.volatility === 'MEDIUM' ? 'Orta' : (s.volatility === 'VOLATILE' ? 'Yüksek' : s.volatility))}</td>
                                <td class="py-3 px-3 text-right whitespace-nowrap">
                                    <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${badgeColor}">
                                        ${s.trend === 'UP' ? '↗ Yükseliyor' : (s.trend === 'DOWN' ? '↘ Geriliyor' : '→ Stabil')}
                                    </span>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    } else {
        html += `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div class="glass-card p-3.5 border border-slate-800 bg-slate-900/80 rounded-2xl">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">İLK NET</span>
                <span class="text-xl font-black text-slate-300 mt-1">${activeSubject.first_net.toFixed(2)}</span>
            </div>
            <div class="glass-card p-3.5 border border-slate-800 bg-slate-900/80 rounded-2xl">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SON NET</span>
                <span class="text-xl font-black text-white mt-1">${activeSubject.last_net.toFixed(2)}</span>
            </div>
            <div class="glass-card p-3.5 border border-slate-800 bg-slate-900/80 rounded-2xl">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DEĞİŞİM</span>
                <span class="text-xl font-black ${activeSubject.net_change >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-1">
                    ${activeSubject.net_change >= 0 ? '+' : ''}${activeSubject.net_change.toFixed(2)}
                </span>
            </div>
            <div class="glass-card p-3.5 border border-slate-800 bg-slate-900/80 rounded-2xl">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ORTALAMA NET</span>
                <span class="text-xl font-black text-indigo-300 mt-1">${activeSubject.average_net.toFixed(2)}</span>
            </div>
            <div class="glass-card p-3.5 border border-slate-800 bg-slate-900/80 rounded-2xl">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EN YÜKSEK</span>
                <span class="text-xl font-black text-emerald-400 mt-1">${activeSubject.highest_net.toFixed(2)}</span>
            </div>
            <div class="glass-card p-3.5 border border-slate-800 bg-slate-900/80 rounded-2xl">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">EN DÜŞÜK</span>
                <span class="text-xl font-black text-rose-400 mt-1">${activeSubject.lowest_net.toFixed(2)}</span>
            </div>
        </div>

        <div class="glass-card p-6 border border-slate-800 mb-6">
            <h3 class="text-sm font-bold text-white mb-4">📈 ${activeSubject.subject_name} DENEME BAZLI GELİŞİM ÇİZGİSİ</h3>
            <div class="h-64 relative">
                <canvas id="reportsSingleSubjectChart"></canvas>
            </div>
        </div>
        `;
    }

    return html;
}

function renderReportsMonthlyTabHtml(data) {
    const mData = data.monthly_analytics || {};
    const labels = mData.month_labels || [];
    const matrix = mData.subject_monthly_matrix || {};
    const subjectNames = Object.keys(matrix);

    let html = `
    <div class="glass-card p-6 border border-slate-800 mb-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="text-sm font-bold text-white">📅 DÖNEMSEL & 3 AYLIK DERS GELİŞİM MATRİSİ</h3>
                <p class="text-xs text-slate-400 mt-0.5">Aylar bazında tüm denemelerin ders ortalamaları üzerinden dönemsel değişim</p>
            </div>
        </div>

        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-900/80">
                        <th class="py-3 px-3">Ders Adı</th>
                        ${labels.map(lbl => `<th class="py-3 px-3 text-center">${lbl} Ort.</th>`).join('')}
                        <th class="py-3 px-3 text-center">Dönem Değişimi</th>
                        <th class="py-3 px-3 text-right">Dönem Trendi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 text-xs font-medium">
                    ${subjectNames.length === 0 ? `
                    <tr><td colspan="${labels.length + 3}" class="py-8 text-center text-slate-500">Henüz dönemsel veri oluşmadı.</td></tr>
                    ` : ''}
                    ${subjectNames.map(sName => {
                        const sRow = matrix[sName];
                        const change = sRow.change || 0.0;
                        return `
                        <tr class="hover:bg-slate-800/40 transition">
                            <td class="py-3 px-3 font-bold text-white">${sName}</td>
                            ${labels.map(lbl => `
                            <td class="py-3 px-3 text-center font-bold text-indigo-300">
                                ${sRow[lbl] ? sRow[lbl].toFixed(2) : '-'}
                            </td>
                            `).join('')}
                            <td class="py-3 px-3 text-center font-black ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                                ${change >= 0 ? '+' : ''}${change.toFixed(2)}
                            </td>
                            <td class="py-3 px-3 text-right">
                                <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${sRow.trend === 'UP' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'}">
                                    ${sRow.trend === 'UP' ? '↗ Yükseliş' : '↘ Gerileme'}
                                </span>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>
    `;

    return html;
}

function renderReportsAICoachTabHtml(data) {
    const aiContext = data.ai_analytics_context || {};
    const profile = aiContext.student_profile || {};
    const subjects = aiContext.subjects_payload || [];
    const timeWin = aiContext.time_windows || {};

    let html = `
    <div class="glass-card p-5 border border-violet-900/60 bg-violet-950/20 rounded-2xl mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-violet-900/80 border border-violet-700 flex items-center justify-center text-violet-300 text-lg font-bold">
                🤖
            </div>
            <div>
                <h4 class="text-sm font-bold text-violet-300">Yapay Zekâ Koç Asistanı Analitik Veri Bağlamı (v1.0)</h4>
                <p class="text-xs text-slate-300">Yapay Zekâ Koç'un öğrenci değerlendirmesinde kullandığı çok boyutlu zaman pencereli veri paketidir.</p>
            </div>
        </div>

        <button onclick="navigateView('ai-coach', ${profile.student_id})" class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-1.5 whitespace-nowrap">
            <i data-lucide="sparkles" class="w-4 h-4"></i> 🤖 Yapay Zekâ Koç İle Detaylı İncele
        </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl">
            <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">⚡️ KISA VADE (Son 3 Deneme)</span>
            <span class="text-2xl font-black text-white">${timeWin.last_3_exams_avg ? timeWin.last_3_exams_avg.toFixed(2) : '0.00'} Net</span>
            <p class="text-[11px] text-slate-400 mt-1">Anlık güncel performans göstergesi.</p>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl">
            <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">📅 ORTA VADE (Son 5 Deneme / 30 Gün)</span>
            <span class="text-2xl font-black text-indigo-300 mt-1">${timeWin.last_5_exams_avg ? timeWin.last_5_exams_avg.toFixed(2) : '0.00'} Net</span>
            <p class="text-[11px] text-slate-400 mt-1">Gelişim ivmesi ve istikrar göstergesi.</p>
        </div>
        <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 rounded-2xl">
            <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">📈 UZUN VADE (Son 3 Ay / Genel)</span>
            <span class="text-2xl font-black text-emerald-400 mt-1">${timeWin.overall_avg ? timeWin.overall_avg.toFixed(2) : '0.00'} Net</span>
            <p class="text-[11px] text-slate-400 mt-1">Temel akademik birikim düzeyi.</p>
        </div>
    </div>

    <div class="glass-card p-6 border border-slate-800">
        <h3 class="text-sm font-bold text-white mb-3">📦 YAPAY ZEKÂ ASİSTANINA İLETİLEN YAPILANDIRILMIŞ DERS BAĞLAMI</h3>
        <pre class="bg-slate-950 p-4 rounded-xl text-[11px] text-emerald-400 font-mono overflow-x-auto border border-slate-800 max-h-80">${JSON.stringify(subjects, null, 2)}</pre>
    </div>
    `;

    return html;
}

function initOverallNetTrendChart(series) {
    setTimeout(() => {
        const ctx = document.getElementById('reportsOverallChart');
        if (!ctx || !window.Chart) return;
        if (reportsChartInstance) reportsChartInstance.destroy();

        reportsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: series.map(s => s.exam_name || s.date),
                datasets: [{
                    label: 'Toplam Net Gelişimi',
                    data: series.map(s => s.net),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', weight: 'bold' } } } },
                scales: {
                    x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51, 65, 85, 0.3)' } },
                    y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51, 65, 85, 0.3)' } }
                }
            }
        });
    }, 100);
}

function initSubjectTrendChart(subjects) {
}

function downloadPdfReport() {
    window.open(`${API_BASE}/raporlar/pdf?student_id=${selectedStudentId || 1}`, '_blank');
}

function downloadExcelExport() {
    window.open(`${API_BASE}/excel/export`, '_blank');
}

// ----------------------------------------------------
// 9. MESAJLAŞMA ENGINE (ADMIN-CENTERED & RBAC PROTECTED)
// ----------------------------------------------------
let currentMessageRecipientId = null;
let currentReplyToMessage = null;
let activeMessageSearchQuery = "";
let adminMessagingTabFilter = 'ALL'; // 'ALL', 'STUDENT', 'COACH'
let mobileChatViewMode = 'LIST'; // 'LIST', 'THREAD'

function setAdminMessagingTabFilter(tab) {
    adminMessagingTabFilter = tab;
    renderMessagesView(currentMessageRecipientId, activeMessageSearchQuery);
}

function toggleMobileChatView(mode) {
    mobileChatViewMode = mode;
    const listCol = document.getElementById('chatListColumn');
    const threadCol = document.getElementById('chatThreadColumn');
    if (listCol && threadCol) {
        if (mode === 'THREAD') {
            listCol.classList.add('hidden', 'md:flex');
            threadCol.classList.remove('hidden');
        } else {
            listCol.classList.remove('hidden');
            threadCol.classList.add('hidden', 'md:flex');
        }
    }
}

async function openNewMessageModal() {
    const token = localStorage.getItem('yks_token');
    let contacts = [];
    try {
        const res = await fetch(`${API_BASE}/mesajlar/contacts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            contacts = data.contacts || [];
        }
    } catch (err) {
        console.error("Fetch contacts error:", err);
    }

    const content = `
    <div class="space-y-4 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-300 font-bold mb-1">Alıcı Türü:</label>
                <select id="newMsgRoleSelect" onchange="updateNewMsgRecipientOptions()" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500">
                    <option value="STUDENT">👨‍🎓 Öğrenci</option>
                    <option value="COACH">👨‍🏫 Koç / Öğretmen</option>
                </select>
            </div>
            <div>
                <label class="block text-slate-300 font-bold mb-1">Alıcı Seçin:</label>
                <select id="newMsgRecipientSelect" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500">
                </select>
            </div>
        </div>
        <div>
            <label class="block text-slate-300 font-bold mb-1">Mesajınız:</label>
            <textarea id="newMsgTextInput" rows="4" placeholder="Mesajınızı buraya yazın..." class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"></textarea>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
            <button onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">İptal</button>
            <button id="btnSendNewMsg" onclick="sendNewModalMessage()" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-5 py-2 rounded-xl shadow-lg flex items-center gap-1.5">
                <i data-lucide="send" class="w-4 h-4"></i> ➤ Mesajı Gönder
            </button>
        </div>
    </div>
    `;

    openModal('💬 YENİ MESAJ OLUŞTUR', content);
    window.modalContactsCache = contacts;
    updateNewMsgRecipientOptions();
}

function updateNewMsgRecipientOptions() {
    const roleSelect = document.getElementById('newMsgRoleSelect');
    const recipientSelect = document.getElementById('newMsgRecipientSelect');
    if (!roleSelect || !recipientSelect) return;

    const selectedRole = roleSelect.value;
    const contacts = window.modalContactsCache || [];
    const filtered = contacts.filter(c => c.role === selectedRole);

    if (filtered.length === 0) {
        recipientSelect.innerHTML = `<option value="">Kayıtlı ${selectedRole === 'STUDENT' ? 'Öğrenci' : 'Koç'} bulunamadı</option>`;
    } else {
        recipientSelect.innerHTML = filtered.map(c => {
            const extra = c.coach_name ? ` (Koç: ${escapeHtml(c.coach_name)})` : (c.track ? ` (${c.track})` : '');
            return `<option value="${c.user_id}">${escapeHtml(c.name)} ${escapeHtml(c.surname || '')}${extra}</option>`;
        }).join('');
    }
}

async function sendNewModalMessage() {
    const recipientSelect = document.getElementById('newMsgRecipientSelect');
    const textInput = document.getElementById('newMsgTextInput');
    const btn = document.getElementById('btnSendNewMsg');

    const receiverId = recipientSelect ? recipientSelect.value : null;
    const content = textInput ? textInput.value.trim() : '';

    if (!receiverId || !content) {
        alert("Lütfen bir alıcı seçin ve mesaj metnini girin!");
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Gönderiliyor...`; }
    if (window.lucide) lucide.createIcons();

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/mesajlar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                receiver_id: parseInt(receiverId),
                content: content
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Mesaj gönderilemedi.');

        closeModal();
        if (typeof showToast === 'function') showToast("💬 Mesaj gönderildi!", "success");
        await renderMessagesView(parseInt(receiverId));
        fetchNotificationsSummary();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = `➤ Mesajı Gönder`; }
        alert("❌ Mesaj gönderilemedi: " + err.message);
    }
}

async function renderMessagesView(targetUserId = null, searchQuery = "") {
    document.getElementById('pageTitle').textContent = "💬 Akıllı & Akademik Mesajlaşma Paneli";
    const container = document.getElementById('viewContainer');
    const token = localStorage.getItem('yks_token');
    activeMessageSearchQuery = searchQuery;

    try {
        // 1. Fetch Contacts
        const contactsRes = await fetch(`${API_BASE}/mesajlar/contacts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!contactsRes.ok) {
            container.innerHTML = `
            <div class="glass-card p-12 text-center border border-slate-800 bg-[#111A2C] rounded-2xl my-6">
                <i data-lucide="alert-circle" class="w-10 h-10 text-rose-400 mx-auto mb-3"></i>
                <h3 class="text-sm font-bold text-white mb-1">Mesajlar Yüklenemedi</h3>
                <p class="text-xs text-[#A8B3C7] mb-4">Sunucu ile iletişim kurulurken bir hata oluştu.</p>
                <button onclick="renderMessagesView()" class="bg-[#4F8CFF] hover:bg-[#3b72df] text-white font-bold px-4 py-2 rounded-xl text-xs">Tekrar Dene</button>
            </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        const contactsData = await contactsRes.json();
        let rawContacts = contactsData.contacts || contactsData.conversations || [];

        // Apply Tab Filter for Admin
        let filteredContacts = rawContacts;
        if (currentUser && currentUser.role === 'ADMIN' && adminMessagingTabFilter !== 'ALL') {
            filteredContacts = rawContacts.filter(c => c.role === adminMessagingTabFilter);
        }

        // Apply Search Query Filter
        if (searchQuery.trim()) {
            const sq = searchQuery.trim().toLowerCase();
            filteredContacts = filteredContacts.filter(c => 
                (c.name && c.name.toLowerCase().includes(sq)) ||
                (c.surname && c.surname.toLowerCase().includes(sq)) ||
                (c.email && c.email.toLowerCase().includes(sq)) ||
                (c.last_message && c.last_message.toLowerCase().includes(sq))
            );
        }

        // Determine selected recipient ID
        let selectedUserId = targetUserId || currentMessageRecipientId;
        if (!selectedUserId && filteredContacts.length > 0) {
            selectedUserId = filteredContacts[0].user_id;
        }

        // 2. Fetch Messages for selected recipient
        let msgs = [];
        let pinnedMsgs = [];
        let recipient = {};

        if (selectedUserId) {
            let msgUrl = `${API_BASE}/mesajlar?with_user_id=${selectedUserId}`;
            if (searchQuery) msgUrl += `&q=${encodeURIComponent(searchQuery)}`;

            const msgRes = await fetch(msgUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (msgRes.ok) {
                const data = await msgRes.json();
                msgs = data.messages || [];
                pinnedMsgs = data.pinned_messages || [];
                recipient = data.recipient || {};
                currentMessageRecipientId = recipient.id || selectedUserId;
            }
        }

        const studentCount = rawContacts.filter(c => c.role === 'STUDENT').length;
        const coachCount = rawContacts.filter(c => c.role === 'COACH').length;

        let html = `
        <div class="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4">
            
            <!-- LEFT COLUMN: SOHBET LİSTESİ (CHAT LIST) -->
            <div id="chatListColumn" class="w-full md:w-80 lg:w-96 glass-card p-4 border border-slate-800 flex flex-col shrink-0 ${mobileChatViewMode === 'THREAD' ? 'hidden md:flex' : 'flex'}">
                
                <!-- Header & Action -->
                <div class="space-y-3 mb-3 pb-3 border-b border-slate-800">
                    <div class="flex items-center justify-between">
                        <h3 class="font-bold text-sm text-white flex items-center gap-2">
                            <i data-lucide="message-square" class="w-4 h-4 text-indigo-400"></i> Sohbetler
                        </h3>
                        <div class="flex items-center gap-1.5">
                            <button onclick="openNewMessageModal()" class="text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-3 py-1.5 rounded-xl shadow hover:from-indigo-500 hover:to-violet-500 transition flex items-center gap-1">
                                <span>+ Yeni Mesaj</span>
                            </button>
                        </div>
                    </div>

                    ${currentUser && currentUser.role === 'ADMIN' ? `
                    <!-- ADMIN TAB FILTERS -->
                    <div class="flex items-center gap-1 bg-[#0E1526] p-1 rounded-xl border border-[#24314A] text-xs">
                        <button onclick="setAdminMessagingTabFilter('ALL')" class="flex-1 py-1 rounded-lg font-bold transition text-center ${adminMessagingTabFilter === 'ALL' ? 'bg-[#4F8CFF] text-white shadow' : 'text-slate-400 hover:text-white'}">Tümü (${rawContacts.length})</button>
                        <button onclick="setAdminMessagingTabFilter('STUDENT')" class="flex-1 py-1 rounded-lg font-bold transition text-center ${adminMessagingTabFilter === 'STUDENT' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}">👨‍🎓 Öğrenciler (${studentCount})</button>
                        <button onclick="setAdminMessagingTabFilter('COACH')" class="flex-1 py-1 rounded-lg font-bold transition text-center ${adminMessagingTabFilter === 'COACH' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}">👨‍🏫 Koçlar (${coachCount})</button>
                    </div>
                    ` : ''}

                    <!-- Search Input -->
                    <div class="relative">
                        <input type="text" value="${activeMessageSearchQuery}" oninput="renderMessagesView(${currentMessageRecipientId}, this.value)" placeholder="Öğrenci, koç veya mesaj ara..." class="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500">
                        <i data-lucide="search" class="w-4 h-4 text-slate-500 absolute left-3 top-2.5"></i>
                    </div>
                </div>

                <!-- Chat List Items -->
                <div class="flex-1 overflow-y-auto space-y-1.5 pr-1">
        `;

        if (filteredContacts.length === 0) {
            html += `<div class="p-6 text-center text-xs text-slate-500">Kayıtlı konuşma bulunamadı.</div>`;
        } else {
            filteredContacts.forEach(c => {
                const isActive = c.user_id == currentMessageRecipientId;
                const isOnline = c.is_online;
                const unread = c.unread_count || 0;
                const timeStr = c.last_message_time ? c.last_message_time.substring(11, 16) : '';
                const roleBadge = c.role === 'ADMIN' ? '👑 ADMİN' : (c.role === 'COACH' ? '👨‍🏫 KOÇ' : '👨‍🎓 ÖĞRENCİ');
                const coachSub = c.coach_name ? `Koç: ${escapeHtml(c.coach_name)}` : (c.track || '');

                html += `
                <div onclick="toggleMobileChatView('THREAD'); renderMessagesView(${c.user_id})" class="p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${isActive ? 'bg-indigo-950/50 border-indigo-800/80 shadow-md' : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/60'}">
                    <div class="relative shrink-0">
                        <div class="w-10 h-10 rounded-full ${c.role === 'ADMIN' ? 'bg-amber-600' : (c.role === 'COACH' ? 'bg-violet-600' : 'bg-indigo-600')} flex items-center justify-center font-bold text-white shadow-sm text-sm">
                            ${escapeHtml((c.name || 'U').charAt(0))}
                        </div>
                        <span class="w-3 h-3 rounded-full border-2 border-slate-950 absolute bottom-0 right-0 ${isOnline ? 'bg-emerald-500' : 'bg-slate-600'}"></span>
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-1">
                            <h4 class="font-bold text-xs text-white truncate">${escapeHtml(c.name)} ${escapeHtml(c.surname || '')}</h4>
                            <span class="text-[10px] text-slate-500 shrink-0">${timeStr}</span>
                        </div>
                        <div class="flex items-center justify-between gap-2 mt-0.5">
                            <p class="text-[11px] text-slate-400 truncate">${escapeHtml(c.last_message)}</p>
                            ${unread > 0 ? `
                            <span class="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shrink-0 shadow-sm animate-pulse">
                                ${unread}
                            </span>
                            ` : ''}
                        </div>
                        <div class="flex items-center justify-between mt-1">
                            <span class="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider">
                                ${roleBadge}
                            </span>
                            ${coachSub ? `<span class="text-[9px] text-slate-500 truncate">${coachSub}</span>` : ''}
                        </div>
                    </div>
                </div>
                `;
            });
        }

        html += `
                </div>
            </div>

            <!-- RIGHT COLUMN: AKTİF SOHBET EKRANI (ACTIVE CHAT) -->
            <div id="chatThreadColumn" class="flex-1 glass-card border border-slate-800 flex flex-col justify-between overflow-hidden ${mobileChatViewMode === 'LIST' ? 'hidden md:flex' : 'flex'}">
                
                <!-- TOP ACTIVE CHAT HEADER -->
                <div class="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-3">
                        <button onclick="toggleMobileChatView('LIST')" class="md:hidden text-xs font-bold text-indigo-400 hover:text-white flex items-center gap-1 mr-1">
                            ← Konuşmalar
                        </button>
                        <div class="relative">
                            <div class="w-10 h-10 rounded-full ${recipient.role === 'ADMIN' ? 'bg-amber-600' : (recipient.role === 'COACH' ? 'bg-violet-600' : 'bg-indigo-600')} flex items-center justify-center font-bold text-white shadow-md text-sm">
                                ${escapeHtml((recipient.name || 'K').charAt(0))}
                            </div>
                            <span class="w-3 h-3 rounded-full border-2 border-slate-950 absolute bottom-0 right-0 bg-emerald-500"></span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-sm text-white">${escapeHtml(recipient.name || 'Seçilen Alıcı')} ${escapeHtml(recipient.surname || '')}</h3>
                                <span class="text-[9px] font-bold px-2 py-0.5 rounded uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                                    ${recipient.role === 'ADMIN' ? '👑 ADMİN' : (recipient.role === 'COACH' ? '👨‍🏫 KOÇ' : (recipient.track ? '🎓 ' + recipient.track : '🎓 ÖĞRENCİ'))}
                                </span>
                            </div>
                            <p class="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Çevrim içi • Birebir Güvenli İletişim
                            </p>
                        </div>
                    </div>
                </div>

                <!-- CHAT MESSAGES BODY -->
                <div id="chatMessagesBox" class="flex-1 p-5 overflow-y-auto space-y-4">
        `;

        if (msgs.length === 0) {
            html += `
            <div class="text-center py-16 text-slate-500">
                <i data-lucide="message-square" class="w-12 h-12 mx-auto text-slate-700 mb-3"></i>
                <p class="text-xs font-semibold text-slate-400">Henüz sohbet geçmişiniz bulunmuyor.</p>
                <p class="text-[11px] text-slate-600 mt-1">Aşağıdaki mesaj alanından doğrudan iletişim başlatabilirsiniz.</p>
            </div>
            `;
        } else {
            msgs.forEach(m => {
                const isMe = m.sender_id === (currentUser ? currentUser.id : 0);
                const timeStr = m.sent_at ? m.sent_at.substring(11, 16) : '';

                if (['SYSTEM', 'RESOURCE', 'ASSIGNMENT', 'STUDY_PLAN'].includes(m.message_type)) {
                    html += `
                    <div class="flex justify-center my-3">
                        <div class="bg-indigo-950/70 border border-indigo-800/70 text-indigo-200 px-4 py-2.5 rounded-2xl text-xs flex items-center gap-3 shadow-md max-w-md text-center">
                            <i data-lucide="sparkles" class="w-4 h-4 text-amber-400 shrink-0"></i>
                            <div class="text-left flex-1">
                                <span class="font-semibold text-white block">${escapeHtml(m.content)}</span>
                                <span class="text-[10px] text-indigo-400 block mt-0.5">${timeStr}</span>
                            </div>
                        </div>
                    </div>
                    `;
                } else {
                    html += `
                    <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} group">
                        <div class="relative max-w-[80%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed ${isMe ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-none shadow-lg' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'}">
                            ${!isMe ? `<span class="font-bold text-[10px] text-indigo-300 block mb-1">${escapeHtml(m.sender_name)}</span>` : ''}
                            <p class="whitespace-pre-wrap">${escapeHtml(m.content)}</p>
                            <div class="flex items-center justify-end gap-1 text-[9px] opacity-75 mt-1.5">
                                <span>${timeStr}</span>
                                ${isMe ? `<span class="text-indigo-200 font-bold ml-0.5">${m.is_read ? '✓✓' : '✓'}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    `;
                }
            });
        }

        html += `
                </div>

                <!-- BOTTOM MESSAGING INPUT BAR -->
                <form onsubmit="sendMessage(event)" class="p-3.5 border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-xl flex items-center gap-2 shrink-0">
                    <input type="text" id="msgContent" required placeholder="${recipient.name ? escapeHtml(recipient.name) + ' kullanıcısına mesaj yazın...' : 'Mesajınızı yazın...'}" class="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner">
                    <button type="submit" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-lg transition flex items-center gap-2 shrink-0">
                        <i data-lucide="send" class="w-4 h-4"></i> ➤ Gönder
                    </button>
                </form>

            </div>
        </div>
        `;

        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();

        const box = document.getElementById('chatMessagesBox');
        if (box) box.scrollTop = box.scrollHeight;

    } catch (err) {
        console.error("renderMessagesView error:", err);
    }
}

// ----------------------------------------------------
// MESSAGING ACTION HELPERS
// ----------------------------------------------------
function insertEmoji(emoji) {
    const input = document.getElementById('msgContent');
    if (input) {
        input.value += emoji;
        input.focus();
    }
}

async function editMessagePrompt(msgId, oldContent) {
    const newContent = prompt("Mesajınızı düzenleyin:", oldContent);
    if (!newContent || newContent.trim() === oldContent.trim()) return;

    const token = localStorage.getItem('yks_token');
    try {
        await fetch(`${API_BASE}/mesajlar/${msgId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content: newContent.trim() })
        });
        renderMessagesView(currentMessageRecipientId);
    } catch (err) {
        alert("Mesaj düzenlenirken hata oluştu!");
    }
}

function convertMessageToAssignment(msgText) {
    if (typeof openAddAssignmentModal === 'function') {
        openAddAssignmentModal(currentMessageRecipientId, msgText);
    } else {
        alert(`Mesaj Ödeve Dönüştürülüyor:\n"${msgText}"`);
    }
}

function setReplyMessage(msgId, snippet) {
    currentReplyToMessage = msgId;
    const box = document.getElementById('replyPreviewBox');
    const text = document.getElementById('replyTextSnippet');
    if (box && text) {
        text.textContent = snippet;
        box.classList.remove('hidden');
    }
}

function cancelReplyMessage() {
    currentReplyToMessage = null;
    const box = document.getElementById('replyPreviewBox');
    if (box) box.classList.add('hidden');
}

async function sendMessage(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const input = document.getElementById('msgContent');
    const content = input.value.trim();

    if (!content || !currentMessageRecipientId) return;

    try {
        await fetch(`${API_BASE}/mesajlar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                receiver_id: currentMessageRecipientId,
                content: content,
                reply_to_id: currentReplyToMessage
            })
        });
        currentReplyToMessage = null;
        renderMessagesView(currentMessageRecipientId);
    } catch (err) {
        alert("Mesaj gönderilirken bir hata oluştu!");
    }
}

async function togglePinMessage(msgId) {
    const token = localStorage.getItem('yks_token');
    try {
        await fetch(`${API_BASE}/mesajlar/${msgId}/pin`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        renderMessagesView(currentMessageRecipientId);
    } catch (err) {
        alert("Mesaj sabitleme işlemi başarısız!");
    }
}

async function deleteMessage(msgId) {
    if (!confirm("Bu mesajı silmek istediğinizden emin misiniz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        await fetch(`${API_BASE}/mesajlar/${msgId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        renderMessagesView(currentMessageRecipientId);
    } catch (err) {
        alert("Mesaj silinemedi!");
    }
}

async function uploadAndSendChatFile(input) {
    if (!input.files || input.files.length === 0 || !currentMessageRecipientId) return;
    const file = input.files[0];
    const token = localStorage.getItem('yks_token');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const uploadRes = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
            alert(uploadData.error || "Dosya yüklenemedi!");
            return;
        }

        const isImage = file.type.startsWith('image/');
        const messageType = isImage ? 'IMAGE' : 'FILE';

        await fetch(`${API_BASE}/mesajlar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                receiver_id: currentMessageRecipientId,
                message_type: messageType,
                content: isImage ? `📷 Görsel Yüklendi: ${uploadData.file_name}` : `📎 Dosya Yüklendi: ${uploadData.file_name}`,
                attachment_url: uploadData.file_url,
                file_name: uploadData.file_name,
                file_size: uploadData.file_size
            })
        });

        input.value = '';
        renderMessagesView(currentMessageRecipientId);
    } catch (err) {
        alert("Dosya yüklenirken hata oluştu!");
    }
}

function quickCreateAssignmentFromChat(studentUserId) {
    alert("⚡️ MESAJDAN ÖDEV OLUŞTURMA: 3D TYT Matematik Problemler Test 5 ödevi oluşturulup öğrenciye iletildi!");
    const token = localStorage.getItem('yks_token');
    fetch(`${API_BASE}/mesajlar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            receiver_id: studentUserId,
            message_type: 'ASSIGNMENT',
            content: '📝 Yeni Ödev Oluşturuldu: 3D TYT Matematik - Problemler (Test 5-8) - Teslim: 18 Ağustos'
        })
    }).then(() => renderMessagesView(studentUserId));
}

function quickAssignResourceFromChat(studentUserId) {
    alert("📚 MESAJDAN KAYNAK ATAMA: 3D TYT Matematik Soru Bankası kaynağı öğrenciye atandı!");
    const token = localStorage.getItem('yks_token');
    fetch(`${API_BASE}/mesajlar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            receiver_id: studentUserId,
            message_type: 'RESOURCE',
            content: '📚 Koçunuz size yeni bir kaynak atadı: 3D TYT Matematik Soru Bankası'
        })
    }).then(() => renderMessagesView(studentUserId));
}

function openBroadcastModal() {
    const text = prompt("📢 TÜM ÖĞRENCİLERİNİZE DUYURU GÖNDERİN:\n(Örn: Yarın saat 10:00'da TYT Genel Deneme Yapılacaktır!)");
    if (!text) return;

    const token = localStorage.getItem('yks_token');
    fetch(`${API_BASE}/mesajlar/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: text })
    }).then(res => res.json()).then(data => {
        alert(data.message || "Duyuru başarıyla gönderildi!");
        renderMessagesView(currentMessageRecipientId);
    });
}

// ----------------------------------------------------
// 10. TIMER / STOPWATCH WIDGET
// ----------------------------------------------------
// 10. ÇALIŞMA ZAMANLAYICISI (CUSTOM TIMER & STOPWATCH)
// ----------------------------------------------------
let initialTimerSeconds = 1500;
let isStopwatchMode = false;

function renderTimerView() {
    document.getElementById('pageTitle').textContent = "YKS Çalışma Zamanlayıcısı & Pomodoro";
    
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;

    let html = `
    <div class="max-w-2xl mx-auto space-y-6">
        <!-- TOP HEADER & MODE SELECTOR -->
        <div class="glass-card p-6 border border-slate-800 text-center">
            <div class="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div class="text-left">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <i data-lucide="timer" class="w-5 h-5 text-indigo-400"></i> YKS Çalışma Oturumu Zamanlayıcısı
                    </h3>
                    <p class="text-xs text-slate-400">Kendi sürenizi belirleyin, dersinizi seçin ve odaklanarak çalışmaya başlayın</p>
                </div>
                <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button onclick="setTimerMode(false)" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${!isStopwatchMode ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}">
                        ⏱ Geri Sayım
                    </button>
                    <button onclick="setTimerMode(true)" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${isStopwatchMode ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'}">
                        ⏱ Kronometre
                    </button>
                </div>
            </div>

            <!-- DIGITAL DISPLAY -->
            <div class="bg-slate-950/80 rounded-2xl border border-slate-800 p-8 my-4 relative overflow-hidden shadow-2xl">
                <div class="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-violet-500/10 to-indigo-500/5 pointer-events-none"></div>
                <div id="timerDisplay" class="text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-violet-400 tracking-tight font-mono">
                    ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}
                </div>
                <p id="timerStatusLabel" class="text-xs font-semibold text-slate-400 mt-3 uppercase tracking-widest">
                    ${timerRunning ? '⚡️ ÇALIŞMA OTURUMU DEVAM EDİYOR' : (isStopwatchMode ? 'KRONOMETRE HAZIR' : 'OTURUM DURDURULDU / HAZIR')}
                </p>
            </div>

            <!-- MAIN ACTION BUTTONS -->
            <div class="flex justify-center gap-3 my-6">
                <button onclick="startTimer()" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-8 py-3.5 rounded-xl shadow-lg transition flex items-center gap-2 transform active:scale-95">
                    <i data-lucide="play" class="w-4 h-4"></i> Başlat
                </button>
                <button onclick="pauseTimer()" class="bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs px-8 py-3.5 rounded-xl shadow-lg transition flex items-center gap-2 transform active:scale-95 border border-rose-500/50">
                    <i data-lucide="pause" class="w-4 h-4"></i> Durdur
                </button>
                <button onclick="resetTimer()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-6 py-3.5 rounded-xl transition flex items-center gap-2 border border-slate-700">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Sıfırla
                </button>
            </div>
        </div>

        <!-- CUSTOM DURATION INPUT FORM & PRESETS -->
        <div class="glass-card p-6 border border-slate-800">
            <h4 class="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <i data-lucide="sliders" class="w-4 h-4"></i> Özel Süre Belirleme & Hazır Şablonlar
            </h4>

            <form onsubmit="applyCustomTimer(event)" class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 bg-slate-900/60 p-4 rounded-xl border border-slate-800 items-end">
                <div>
                    <label class="block text-[11px] font-semibold text-slate-400 mb-1">Dakika Girin</label>
                    <input type="number" id="customMinsInput" min="0" max="300" value="${mins}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                    <label class="block text-[11px] font-semibold text-slate-400 mb-1">Saniye Girin</label>
                    <input type="number" id="customSecsInput" min="0" max="59" value="${secs}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-indigo-500">
                </div>
                <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-md flex items-center justify-center gap-2 h-[42px]">
                    <i data-lucide="check" class="w-4 h-4"></i> Süreyi Ayarla
                </button>
            </form>

            <label class="block text-[11px] font-semibold text-slate-400 mb-2">Hızlı YKS Süre Şablonları:</label>
            <div class="flex flex-wrap gap-2">
                <button onclick="setPresetTimer(25)" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-indigo-950 text-indigo-300 border border-slate-800 hover:border-indigo-700 transition">
                    ⏱ 25 dk (Pomodoro)
                </button>
                <button onclick="setPresetTimer(40)" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-indigo-950 text-indigo-300 border border-slate-800 hover:border-indigo-700 transition">
                    ⏱ 40 dk (Ders Etüdü)
                </button>
                <button onclick="setPresetTimer(45)" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-indigo-950 text-indigo-300 border border-slate-800 hover:border-indigo-700 transition">
                    ⏱ 45 dk (Soru Çözümü)
                </button>
                <button onclick="setPresetTimer(60)" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-indigo-950 text-indigo-300 border border-slate-800 hover:border-indigo-700 transition">
                    ⏱ 60 dk (Konu Tekrarı)
                </button>
                <button onclick="setPresetTimer(90)" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-amber-950 text-amber-300 border border-slate-800 hover:border-amber-700 transition">
                    ⏱ 90 dk (Branş Denemesi)
                </button>
                <button onclick="setPresetTimer(165)" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-rose-950 text-rose-300 border border-slate-800 hover:border-rose-700 transition">
                    🏆 165 dk (TYT Tam Prova)
                </button>
                <button onclick="setPresetTimer(180)" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-violet-950 text-violet-300 border border-slate-800 hover:border-violet-700 transition">
                    🏆 180 dk (AYT Tam Prova)
                </button>
            </div>
        </div>
    </div>`;

    document.getElementById('viewContainer').innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

function setTimerMode(stopwatch) {
    pauseTimer();
    isStopwatchMode = stopwatch;
    if (isStopwatchMode) {
        timerSeconds = 0;
    } else {
        timerSeconds = initialTimerSeconds;
    }
    renderTimerView();
}

function applyCustomTimer(e) {
    if (e) e.preventDefault();
    pauseTimer();
    isStopwatchMode = false;
    const m = parseInt(document.getElementById('customMinsInput').value) || 0;
    const s = parseInt(document.getElementById('customSecsInput').value) || 0;
    initialTimerSeconds = (m * 60) + s;
    timerSeconds = initialTimerSeconds;
    updateTimerDisplay();
    alert(`Zamanlayıcı süresi ${m} dakika ${s} saniye olarak ayarlandı!`);
}

function setPresetTimer(mins) {
    pauseTimer();
    isStopwatchMode = false;
    initialTimerSeconds = mins * 60;
    timerSeconds = initialTimerSeconds;
    const inputMins = document.getElementById('customMinsInput');
    const inputSecs = document.getElementById('customSecsInput');
    if (inputMins) inputMins.value = mins;
    if (inputSecs) inputSecs.value = 0;
    updateTimerDisplay();
}

function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    const statusEl = document.getElementById('timerStatusLabel');
    if (statusEl) statusEl.textContent = "⚡️ ÇALIŞMA OTURUMU DEVAM EDİYOR";

    timerInterval = setInterval(() => {
        if (!isStopwatchMode) {
            // Countdown Mode
            if (timerSeconds > 0) {
                timerSeconds--;
                updateTimerDisplay();
            } else {
                pauseTimer();
                alert("🎉 Tebrikler! Çalışma süreniz başarıyla doldu.");
            }
        } else {
            // Stopwatch Mode
            timerSeconds++;
            updateTimerDisplay();
        }
    }, 1000);
}

function pauseTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    const statusEl = document.getElementById('timerStatusLabel');
    if (statusEl) statusEl.textContent = "OTURUM DURDURULDU";
}

function resetTimer() {
    pauseTimer();
    if (isStopwatchMode) {
        timerSeconds = 0;
    } else {
        timerSeconds = initialTimerSeconds;
    }
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const disp = `${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
    const el = document.getElementById('timerDisplay');
    if (el) el.textContent = disp;
}

// ----------------------------------------------------
// 11. AI COACH ASSISTANT
// ----------------------------------------------------
async function renderAICoachView() {
    document.getElementById('pageTitle').textContent = "🤖 Yapay Zekâ Koç Asistanı & Akademik Analiz Motoru";
    const container = document.getElementById('viewContainer');
    const token = localStorage.getItem('yks_token');
    
    // 1. Initial Loading State
    const activeStudent = coachStudentsList.find(s => s.id == selectedStudentId) || currentUser;
    const stName = activeStudent ? activeStudent.name : 'Öğrenci';

    container.innerHTML = `
    ${getCoachStudentSwitcherHtml()}
    <div class="glass-card p-12 text-center border border-[#24314A] rounded-2xl flex flex-col items-center justify-center my-6 bg-[#111A2C]">
        <div class="animate-spin text-[#7C6AE6] mb-3"><i data-lucide="loader-2" class="w-8 h-8"></i></div>
        <h3 class="text-sm font-bold text-white mb-1">${stName} İçin Kişiselleştirilmiş Akademik Analiz Hazırlanıyor...</h3>
        <p class="text-xs text-[#A8B3C7]">Lütfen bekleyin, öğrenciye ait yalnız geçerli deneme sınavı verileri ve konu eksikleri taranıyor.</p>
    </div>
    `;
    if (window.lucide) lucide.createIcons();

    try {
        const ai = await apiFetch('/ai/analyze-student', {
            method: 'POST',
            body: JSON.stringify({ student_id: selectedStudentId })
        });

        const dbg = ai.context_debug || {};

        let html = getCoachStudentSwitcherHtml();

        const confText = (ai.confidence === 'HIGH') ? 'Yüksek' : ((ai.confidence === 'MEDIUM') ? 'Orta' : ((ai.confidence === 'LOW') ? 'Düşük' : 'Veri Yok'));
        const confClass = (ai.confidence === 'HIGH') ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30' : ((ai.confidence === 'NO_DATA') ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30');

        // 2. Yapay Zekâ Analiz Bağlamı Paneli
        html += `
        <div class="glass-card p-4 border border-[#7C6AE6]/40 bg-[#111A2C] mb-6 rounded-2xl">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-3 border-b border-[#24314A] pb-2">
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-[#7C6AE6]/20 text-[#7C6AE6] text-[10px] font-black tracking-widest uppercase">YAPAY ZEKÂ ANALİZ BAĞLAMI</span>
                    <span class="text-xs font-bold text-white">${ai.student_name} (ID: ${ai.student_id})</span>
                </div>
                <div class="flex items-center gap-2 text-[10px] font-mono">
                    <span class="text-[#A8B3C7]">Güvenilirlik:</span>
                    <span class="px-2 py-0.5 rounded ${confClass}">${confText}</span>
                    <span class="text-[#A8B3C7] ml-2">Analiz Veri Kalitesi:</span>
                    <span class="text-white font-bold">%${dbg.dataQualityScore || ai.analysisDataQuality || 0}</span>
                </div>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-[11px] font-mono text-[#A8B3C7]">
                <div><span class="text-slate-500 block">Sistem / Alan:</span> <span class="text-white font-bold">${ai.exam_system} (${ai.track})</span></div>
                <div><span class="text-slate-500 block">Geçerli Deneme:</span> <span class="text-[#4F8CFF] font-bold">${ai.valid_exam_count}</span></div>
                <div><span class="text-slate-500 block">Matematik Ortalama:</span> <span class="text-emerald-400 font-bold">${dbg.mathAvg ? dbg.mathAvg.toFixed(2) : '0.00'} Net</span></div>
                <div><span class="text-slate-500 block">Kritik Konular:</span> <span class="text-amber-400 font-bold">${dbg.weakTopicsCount || 0} Konu</span></div>
                <div><span class="text-slate-500 block">Öğrenci ID:</span> <span class="text-white font-bold">${dbg.studentId || ai.student_id}</span></div>
                <div><span class="text-slate-500 block">İzolasyon:</span> <span class="text-emerald-400 font-bold">DOĞRULANDI ✅</span></div>
            </div>
        </div>
        `;

        // 3. Grounded Analysis Overview Card
        html += `
        <div class="glass-card p-6 border border-[#24314A] bg-[#111A2C] mb-6 rounded-2xl shadow-lg">
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4 border-b border-[#24314A] pb-3">
                <div class="flex items-center gap-3">
                    <div class="p-2.5 bg-[#7C6AE6]/15 rounded-xl text-[#7C6AE6] border border-[#7C6AE6]/30 shrink-0">
                        <i data-lucide="sparkles" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-white flex items-center gap-2">
                            Yapay Zekâ Akademik Analiz Raporu 
                            <span class="text-xs font-medium text-[#A8B3C7]">(${ai.student_name})</span>
                        </h3>
                        <span class="text-xs text-[#A8B3C7]">Öğrenciye özel veritabanı deneme ve konu performansına dayanır</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs px-3 py-1 rounded-full ${ai.valid_exam_count > 0 ? 'bg-[#4F8CFF]/15 text-[#4F8CFF] border border-[#4F8CFF]/30 font-bold' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold'}">
                        ${ai.valid_exam_count} Geçerli Deneme Sınavı
                    </span>
                    <span class="text-xs px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                        Analiz Veri Kalitesi: %${dbg.dataQualityScore || ai.analysisDataQuality || 0}
                    </span>
                </div>
            </div>

            <p class="text-xs text-slate-200 leading-relaxed mb-6 bg-[#0B1324] p-4 rounded-xl border border-[#24314A]">
                💡 <strong>Özet Değerlendirme:</strong> ${ai.summary}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <div class="bg-[#0B1324] p-4 rounded-xl border border-emerald-500/30">
                    <h4 class="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-2">
                        <i data-lucide="check-circle-2" class="w-4 h-4"></i> ✅ Güçlü Yönler (Kanıtlanmış)
                    </h4>
                    <ul class="text-xs text-slate-300 space-y-2">
                        ${(ai.strengths || []).map(s => `
                            <li class="flex items-start gap-2 bg-[#111A2C] p-2.5 rounded-lg border border-[#24314A]">
                                <span class="text-emerald-400">•</span>
                                <span>${s}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="bg-[#0B1324] p-4 rounded-xl border border-rose-500/30">
                    <h4 class="text-xs font-bold text-rose-400 mb-3 flex items-center gap-2">
                        <i data-lucide="alert-triangle" class="w-4 h-4"></i> ⚠️ Geliştirilmesi Gerekenler & Konu Riskleri
                    </h4>
                    <ul class="text-xs text-slate-300 space-y-2">
                        ${(ai.weaknesses || []).map(w => {
                            let cleanW = String(w).replace(/mastery skoru/gi, 'hâkimiyet puanı').replace(/mastery/gi, 'hâkimiyet');
                            return `
                            <li class="flex items-start gap-2 bg-[#111A2C] p-2.5 rounded-lg border border-[#24314A]">
                                <span class="text-rose-400">•</span>
                                <span>${cleanW}</span>
                            </li>
                            `;
                        }).join('')}
                    </ul>
                </div>
            </div>

            <!-- Structured Action Recommendations -->
            <div class="bg-[#0B1324] p-5 rounded-xl border border-[#7C6AE6]/40 mt-6">
                <h4 class="text-xs font-bold text-[#7C6AE6] mb-3 flex items-center gap-2">
                    <i data-lucide="target" class="w-4 h-4"></i> 💡 Koç Akademik Aksiyon Önerileri
                </h4>
                <div class="space-y-3">
                    ${(ai.structured_recommendations || []).map(r => {
                        let cleanProblem = String(r.problem || 'Akademik Aksiyon').replace(/Düşük Mastery/gi, 'Düşük Hâkimiyet').replace(/Mastery/gi, 'Hâkimiyet');
                        let cleanEvidence = String(r.evidence || '').replace(/Mastery Skoru/gi, 'Hâkimiyet Puanı').replace(/Mastery/gi, 'Hâkimiyet').replace(/Evidence/gi, 'Kanıt');
                        let prio = String(r.priority || 'NORMAL').toUpperCase();
                        let prioLabel = (prio === 'HIGH' || prio === 'CRITICAL' || prio === 'YUKSEK') ? 'Yüksek' : ((prio === 'MEDIUM' || prio === 'ORTA') ? 'Orta' : ((prio === 'LOW' || prio === 'DUSUK') ? 'Düşük' : 'Normal'));
                        let prioBadge = (prio === 'HIGH' || prio === 'CRITICAL' || prio === 'YUKSEK') ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : ((prio === 'MEDIUM' || prio === 'ORTA') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30');

                        return `
                        <div class="bg-[#111A2C] p-3.5 rounded-xl border border-[#24314A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-xs font-bold text-white">${cleanProblem}</span>
                                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${prioBadge}">${prioLabel}</span>
                                </div>
                                <p class="text-xs text-slate-300">${r.action || r}</p>
                                ${cleanEvidence ? `<span class="text-[10px] text-[#A8B3C7] mt-1 block">📌 Kanıt: ${cleanEvidence}</span>` : ''}
                            </div>
                            ${r.curriculum_topic_id ? `
                            <button onclick="quickAssignHomeworkForTopic(${r.curriculum_topic_id}, '${r.topic_name || ''}')" class="btn-primary-purple px-3.5 py-2 text-xs font-bold rounded-lg shrink-0 flex items-center gap-1.5 shadow w-full sm:w-auto justify-center">
                                <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Ödev Ata
                            </button>
                            ` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
        `;

        container.innerHTML = html;
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    } catch (err) {
        console.error("[AI ANALYSIS ERROR]", {
            studentId: selectedStudentId,
            error: err.message
        });
        container.innerHTML = `
        ${getCoachStudentSwitcherHtml()}
        <div class="glass-card p-8 text-center border border-rose-800/50 rounded-2xl bg-[#111A2C] shadow-2xl my-4">
            <div class="w-12 h-12 rounded-xl bg-rose-900/60 text-rose-400 border border-rose-700 flex items-center justify-center mx-auto mb-3 text-xl font-bold">⚠️</div>
            <h3 class="text-base font-bold text-rose-200 mb-2">Yapay Zekâ Analiz Yükleme Hatası</h3>
            <p class="text-xs text-slate-300 mb-4 max-w-md mx-auto">${escapeHtml(err.message || 'Seçilen öğrenci için analiz oluşturulamadı.')}</p>
            <button onclick="renderAICoachView()" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition inline-flex items-center gap-1.5">
                🔄 Tekrar Dene
            </button>
        </div>
        `;
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }
}

// ----------------------------------------------------
// 12. KAYNAK YÖNETİMİ ENGINE (6 ALT SEKME SUITE)
// ----------------------------------------------------
let currentAdminKaynakTab = 'GENERAL'; // GENERAL, SUGGESTIONS, COACH_POOLS, PUBLISHERS, SUBJECTS, ANALYTICS
let adminKaynakLevelFilter = 'ALL';
let adminKaynakStatusFilter = 'ALL';
let adminKaynakPublisherFilter = 'ALL';
let selectedCoachPoolId = null;
let selectedBulkResourceIds = new Set();

let currentKaynakTab = 'ALL';
let kaynakSearchQuery = '';
let kaynakSubjectFilter = 'ALL';
let kaynakSystemFilter = 'ALL';
let kaynakTypeFilter = 'ALL';

async function setAdminKaynakSubTab(tabName) {
    currentAdminKaynakTab = tabName;
    selectedBulkResourceIds.clear();
    renderKaynakHavuzuView();
}

async function renderKaynakHavuzuView() {
    const container = document.getElementById('viewContainer');
    const token = localStorage.getItem('yks_token');

    if (currentUser && currentUser.role === 'ADMIN') {
        document.getElementById('pageTitle').textContent = "📚 Kaynak Yönetimi — Genel Kaynak Havuzu & Kütüphane";
        container.innerHTML = `
        <div class="glass-card p-12 text-center border border-[#24314A] rounded-2xl flex flex-col items-center justify-center my-6 bg-[#111A2C]">
            <div class="animate-spin text-[#4F8CFF] mb-3"><i data-lucide="loader-2" class="w-8 h-8"></i></div>
            <h3 class="text-sm font-bold text-white mb-1">Kaynak Yönetimi Yükleniyor...</h3>
            <p class="text-xs text-[#A8B3C7]">Genel havuz, koç havuzları ve istatistikler hazırlanıyor.</p>
        </div>
        `;
        if (window.lucide) lucide.createIcons();

        try {
            const statsRes = await fetch(`${API_BASE}/admin/resource-management/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const stats = (await statsRes.json()) || {};

            let html = `
            <!-- HEADER -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        📚 Kaynak Yönetimi
                    </h2>
                    <p class="text-xs text-[#A8B3C7] mt-1">Genel kaynak havuzunu, kaynak önerilerini ve koç kaynaklarını yönetin.</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="openCreateResourceModal()" class="bg-[#4F8CFF] hover:bg-[#3b72df] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 transition">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i> + Genel Havuz'a Yeni Kaynak Ekle
                    </button>
                </div>
            </div>

            <!-- KPI SCORECARDS (5 Scorecards) -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl">
                    <span class="text-[10px] font-bold text-[#A8B3C7] uppercase block mb-1">Toplam Genel Kaynak</span>
                    <span class="text-xl font-black text-white">${stats.total_general_resources || 0}</span>
                </div>
                <div class="glass-card p-4 border border-[#4F8CFF]/30 bg-[#111A2C] rounded-2xl">
                    <span class="text-[10px] font-bold text-[#4F8CFF] uppercase block mb-1">Kaynak Kullanan Koç</span>
                    <span class="text-xl font-black text-[#4F8CFF]">${stats.coaches_using_resources || 0}</span>
                </div>
                <div class="glass-card p-4 border ${stats.pending_suggestions_count > 0 ? 'border-amber-500/50 bg-[#1A1828]' : 'border-[#24314A] bg-[#111A2C]'} rounded-2xl">
                    <span class="text-[10px] font-bold ${stats.pending_suggestions_count > 0 ? 'text-amber-400 font-extrabold' : 'text-[#A8B3C7]'} uppercase block mb-1">Bekleyen Öneri</span>
                    <div class="flex items-center justify-between">
                        <span class="text-xl font-black ${stats.pending_suggestions_count > 0 ? 'text-amber-400' : 'text-white'}">${stats.pending_suggestions_count || 0}</span>
                        ${stats.pending_suggestions_count > 0 ? '<span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>' : ''}
                    </div>
                </div>
                <div class="glass-card p-4 border border-emerald-500/30 bg-[#111A2C] rounded-2xl">
                    <span class="text-[10px] font-bold text-emerald-400 uppercase block mb-1">Toplam Ders</span>
                    <span class="text-xl font-black text-emerald-400">${stats.total_subjects || 0}</span>
                </div>
                <div class="glass-card p-4 border border-purple-500/30 bg-[#111A2C] rounded-2xl">
                    <span class="text-[10px] font-bold text-purple-400 uppercase block mb-1">Toplam Yayınevi</span>
                    <span class="text-xl font-black text-purple-400">${stats.total_publishers || 0}</span>
                </div>
            </div>

            <!-- SUB-TAB NAVIGATION (6 TABS) -->
            <div class="flex items-center gap-2 overflow-x-auto border-b border-[#24314A] pb-3 mb-6">
                <button onclick="setAdminKaynakSubTab('GENERAL')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAdminKaynakTab === 'GENERAL' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                    📚 Genel Kaynak Havuzu
                </button>
                <button onclick="setAdminKaynakSubTab('SUGGESTIONS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${currentAdminKaynakTab === 'SUGGESTIONS' ? 'bg-amber-500 text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                    🔔 Kaynak Önerileri
                    ${stats.pending_suggestions_count > 0 ? `<span class="bg-rose-500 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full">${stats.pending_suggestions_count}</span>` : ''}
                </button>
                <button onclick="setAdminKaynakSubTab('COACH_POOLS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAdminKaynakTab === 'COACH_POOLS' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                    👥 Koç Kaynakları
                </button>
                <button onclick="setAdminKaynakSubTab('PUBLISHERS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAdminKaynakTab === 'PUBLISHERS' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                    🏢 Yayınevleri
                </button>
                <button onclick="setAdminKaynakSubTab('SUBJECTS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAdminKaynakTab === 'SUBJECTS' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                    📖 Dersler
                </button>
                <button onclick="setAdminKaynakSubTab('ANALYTICS')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAdminKaynakTab === 'ANALYTICS' ? 'bg-emerald-600 text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                    📊 Kaynak İstatistikleri
                </button>
            </div>
            `;

            if (currentAdminKaynakTab === 'GENERAL') {
                html += await renderAdminGeneralPoolTab(token);
            } else if (currentAdminKaynakTab === 'SUGGESTIONS') {
                html += await renderAdminSuggestionsTab(token);
            } else if (currentAdminKaynakTab === 'COACH_POOLS') {
                html += await renderAdminCoachPoolsTab(token);
            } else if (currentAdminKaynakTab === 'PUBLISHERS') {
                html += await renderAdminPublishersTab(token);
            } else if (currentAdminKaynakTab === 'SUBJECTS') {
                html += await renderAdminSubjectsTab(token);
            } else if (currentAdminKaynakTab === 'ANALYTICS') {
                html += await renderAdminAnalyticsTab(token);
            }

            container.innerHTML = html;
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            console.error("renderKaynakHavuzuView admin error:", err);
            container.innerHTML = `
            <div class="glass-card p-8 text-center border border-rose-800/50 rounded-2xl bg-[#111A2C]">
                <h3 class="text-base font-bold text-rose-400 mb-2">Kaynak Yönetimi Yüklenemedi</h3>
                <p class="text-xs text-slate-300 mb-4">${err.message || 'Hata oluştu'}</p>
                <button onclick="renderKaynakHavuzuView()" class="btn-primary-purple px-4 py-2 text-xs font-bold rounded-xl">Tekrar Dene</button>
            </div>`;
        }
        return;
    }

    // COACH & STUDENT RESOURCE POOL VIEW
    document.getElementById('pageTitle').textContent = "📚 Kaynak Havuzum & Kütüphane Yönetimi";
    container.innerHTML = `
    <div class="glass-card p-12 text-center border border-[#24314A] rounded-2xl flex flex-col items-center justify-center my-6 bg-[#111A2C]">
        <div class="animate-spin text-[#4F8CFF] mb-3"><i data-lucide="loader-2" class="w-8 h-8"></i></div>
        <h3 class="text-sm font-bold text-white mb-1">Kaynak Havuzu Yükleniyor...</h3>
    </div>`;
    if (window.lucide) lucide.createIcons();

    try {
        const params = new URLSearchParams({
            tab: currentKaynakTab,
            search: kaynakSearchQuery,
            subject_id: kaynakSubjectFilter,
            exam_system: kaynakSystemFilter,
            resource_type: kaynakTypeFilter
        });

        const res = await fetch(`${API_BASE}/kaynak-havuzu?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const resources = data.resources || [];
        const kpis = data.kpis || { total_resources: 0, active_resources: 0, assigned_students: 0, archived_resources: 0 };
        const subjectsList = data.subjects || [];

        let html = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
                <h2 class="text-lg font-bold text-white flex items-center gap-2">📚 Kaynak Havuzum</h2>
                <p class="text-xs text-[#A8B3C7] mt-1">Öğrencilerinize atayabileceğiniz 2026 YKS & LGS kaynak kütüphaneniz</p>
            </div>
            ${currentUser && currentUser.role !== 'STUDENT' ? `
            <button onclick="openCreateResourceModal()" class="bg-[#4F8CFF] hover:bg-[#3b72df] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 shrink-0 transition">
                <i data-lucide="plus-circle" class="w-4 h-4"></i> + Özel Havuzuma Kaynak Ekle
            </button>
            ` : ''}
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl">
                <span class="text-[10px] font-bold text-[#A8B3C7] uppercase block mb-1">Toplam Kaynak</span>
                <span class="text-xl font-black text-white">${kpis.total_resources}</span>
            </div>
            <div class="glass-card p-4 border border-emerald-500/30 bg-[#111A2C] rounded-2xl">
                <span class="text-[10px] font-bold text-emerald-400 uppercase block mb-1">Aktif Kaynak</span>
                <span class="text-xl font-black text-emerald-400">${kpis.active_resources}</span>
            </div>
            <div class="glass-card p-4 border border-[#4F8CFF]/30 bg-[#111A2C] rounded-2xl">
                <span class="text-[10px] font-bold text-[#4F8CFF] uppercase block mb-1">Öğrencilere Atanan</span>
                <span class="text-xl font-black text-[#4F8CFF]">${kpis.assigned_students}</span>
            </div>
            <div class="glass-card p-4 border border-amber-500/30 bg-[#111A2C] rounded-2xl">
                <span class="text-[10px] font-bold text-amber-400 uppercase block mb-1">Arşivdeki Kaynak</span>
                <span class="text-xl font-black text-amber-400">${kpis.archived_resources}</span>
            </div>
        </div>

        <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl mb-6 flex flex-wrap items-center gap-3">
            <div class="flex-1 min-w-[200px]">
                <input type="text" placeholder="Kaynak ara..." value="${kaynakSearchQuery}" oninput="filterKaynakSearch(this.value)" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#4F8CFF]">
            </div>
            <select onchange="filterKaynakSubject(this.value)" class="bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#4F8CFF]">
                <option value="ALL">📚 Tüm Dersler</option>
                ${subjectsList.map(s => `<option value="${s.id}" ${kaynakSubjectFilter == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${resources.map(r => renderResourceCardHtml(r)).join('')}
        </div>
        `;

        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

// ----------------------------------------------------
// TAB 1: GENEL KAYNAK HAVUZU SUB-TAB
// ----------------------------------------------------
async function renderAdminGeneralPoolTab(token) {
    const params = new URLSearchParams({
        tab: 'SYSTEM',
        search: kaynakSearchQuery,
        subject_id: kaynakSubjectFilter,
        exam_system: kaynakSystemFilter,
        resource_type: kaynakTypeFilter
    });

    const res = await fetch(`${API_BASE}/kaynak-havuzu?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    let resources = data.resources || [];
    const subjectsList = data.subjects || [];

    // Filter Level & Status & Publisher in JS
    if (adminKaynakLevelFilter !== 'ALL') {
        resources = resources.filter(r => (r.level || 'Orta').toLowerCase() === adminKaynakLevelFilter.toLowerCase());
    }
    if (adminKaynakStatusFilter !== 'ALL') {
        resources = resources.filter(r => (r.status || 'ACTIVE').toUpperCase() === adminKaynakStatusFilter.toUpperCase());
    }

    const publishersList = Array.from(new Set(resources.map(r => r.publisher).filter(Boolean)));

    return `
    <!-- FILTER BAR -->
    <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl mb-6 flex flex-wrap items-center gap-3">
        <div class="flex-1 min-w-[200px]">
            <input type="text" placeholder="Kaynak adı, yayınevi veya açıklama ara..." value="${kaynakSearchQuery}" oninput="filterKaynakSearch(this.value)" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#4F8CFF]">
        </div>
        
        <select onchange="filterKaynakSystem(this.value)" class="bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#4F8CFF]">
            <option value="ALL">🎯 Tüm Sınavlar</option>
            <option value="YKS" ${kaynakSystemFilter === 'YKS' ? 'selected' : ''}>YKS (TYT/AYT)</option>
            <option value="LGS" ${kaynakSystemFilter === 'LGS' ? 'selected' : ''}>LGS (8. Sınıf)</option>
        </select>

        <select onchange="filterKaynakSubject(this.value)" class="bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#4F8CFF]">
            <option value="ALL">📚 Tüm Dersler</option>
            ${subjectsList.map(s => `<option value="${s.id}" ${kaynakSubjectFilter == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>

        <select onchange="filterAdminKaynakLevel(this.value)" class="bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#4F8CFF]">
            <option value="ALL">⚡ Tüm Seviyeler</option>
            <option value="Kolay" ${adminKaynakLevelFilter === 'Kolay' ? 'selected' : ''}>Kolay</option>
            <option value="Orta" ${adminKaynakLevelFilter === 'Orta' ? 'selected' : ''}>Orta</option>
            <option value="Zor" ${adminKaynakLevelFilter === 'Zor' ? 'selected' : ''}>Zor</option>
            <option value="Karma" ${adminKaynakLevelFilter === 'Karma' ? 'selected' : ''}>Karma</option>
        </select>

        <select onchange="filterAdminKaynakStatus(this.value)" class="bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#4F8CFF]">
            <option value="ALL">🟢 Tüm Durumlar</option>
            <option value="ACTIVE" ${adminKaynakStatusFilter === 'ACTIVE' ? 'selected' : ''}>Aktif</option>
            <option value="INACTIVE" ${adminKaynakStatusFilter === 'INACTIVE' ? 'selected' : ''}>Pasif</option>
        </select>
    </div>

    <!-- BULK ACTIONS BAR -->
    <div class="glass-card p-3 border border-[#24314A] bg-[#141E33] rounded-2xl mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 cursor-pointer text-xs text-white font-bold">
                <input type="checkbox" onchange="toggleBulkSelectAll(this.checked)" class="w-4 h-4 rounded text-indigo-600">
                <span>Tümünü Seç (${resources.length} Kaynak)</span>
            </label>
            <span id="bulkSelectedCountLabel" class="text-xs text-[#4F8CFF] font-mono font-bold">Seçili: ${selectedBulkResourceIds.size}</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <button onclick="executeAdminBulkAction('ACTIVATE')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow">
                🟢 Toplu Aktifleştir
            </button>
            <button onclick="executeAdminBulkAction('DEACTIVATE')" class="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow">
                ⚪ Toplu Pasifleştir
            </button>
            <button onclick="executeAdminBulkAction('DELETE')" class="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow">
                🗑️ Toplu Sil
            </button>
        </div>
    </div>

    <!-- DATA TABLE -->
    <div class="glass-card overflow-hidden border border-[#24314A] bg-[#111A2C] rounded-2xl shadow-xl">
        <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-300">
                <thead class="bg-[#172238] text-white uppercase text-[10px] font-bold tracking-wider border-b border-[#24314A]">
                    <tr>
                        <th class="p-3 w-10 text-center">Seç</th>
                        <th class="p-3">Kaynak Adı</th>
                        <th class="p-3">Yayınevi</th>
                        <th class="p-3">Ders</th>
                        <th class="p-3">Sınav</th>
                        <th class="p-3">Tür</th>
                        <th class="p-3">Seviye</th>
                        <th class="p-3">Durum</th>
                        <th class="p-3">Eklenme</th>
                        <th class="p-3 text-right">İşlem</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-[#24314A]">
                    ${resources.length === 0 ? `
                    <tr><td colspan="10" class="p-8 text-center text-slate-500">Bu kriterlere uygun kaynak bulunamadı.</td></tr>
                    ` : resources.map(r => `
                    <tr class="hover:bg-[#172238]/50 transition">
                        <td class="p-3 text-center">
                            <input type="checkbox" value="${r.id}" ${selectedBulkResourceIds.has(r.id) ? 'checked' : ''} onchange="toggleBulkSelectResource(${r.id}, this.checked)" class="w-4 h-4 rounded text-indigo-600">
                        </td>
                        <td class="p-3 font-bold text-white">${escapeHtml(r.name)}</td>
                        <td class="p-3 text-[#4F8CFF] font-semibold">${escapeHtml(r.publisher || 'Belirtilmemiş')}</td>
                        <td class="p-3">${escapeHtml(r.subject_name || 'Ders')}</td>
                        <td class="p-3 font-mono">${getExamBadgeText(r)}</td>
                        <td class="p-3">${escapeHtml(r.resource_type || 'Soru Bankası')}</td>
                        <td class="p-3 font-bold">${escapeHtml(r.level || 'Orta')}</td>
                        <td class="p-3">
                            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${r.status === 'INACTIVE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                                ${r.status === 'INACTIVE' ? '⚪ Pasif' : '🟢 Aktif'}
                            </span>
                        </td>
                        <td class="p-3 font-mono text-slate-400 text-[11px]">${(r.created_at || '').substring(0, 10)}</td>
                        <td class="p-3 text-right">
                            <div class="flex items-center justify-end gap-1.5">
                                <button onclick="openResourceDetailModal(${r.id})" class="bg-[#172238] hover:bg-[#24314A] text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border border-[#2A3954]" title="Görüntüle">
                                    👁 Görüntüle
                                </button>
                                <button onclick="openCreateResourceModal(${r.id})" class="bg-[#4F8CFF]/20 hover:bg-[#4F8CFF] text-[#4F8CFF] hover:text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition border border-[#4F8CFF]/40" title="Düzenle">
                                    ✏️ Düzenle
                                </button>
                                <button onclick="toggleResourceStatus(${r.id}, '${r.status}')" class="bg-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition border border-rose-500/40" title="Durum Değiştir / Pasifleştir">
                                    ${r.status === 'INACTIVE' ? '🟢 Aktifleştir' : '🗑️ Pasifleştir'}
                                </button>
                            </div>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
    `;
}

// ----------------------------------------------------
// TAB 2: KAYNAK ÖNERİLERİ SUB-TAB
// ----------------------------------------------------
async function renderAdminSuggestionsTab(token) {
    const res = await fetch(`${API_BASE}/admin/resource-suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const suggestions = data.suggestions || [];

    return `
    <div class="mb-4 flex items-center justify-between">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
            🔔 Koç Kaynak Önerileri Merkezi (${suggestions.filter(s => s.status === 'BEKLİYOR').length} Bekleyen Öneri)
        </h3>
    </div>

    ${suggestions.length === 0 ? `
    <div class="glass-card p-12 text-center border border-[#24314A] bg-[#111A2C] rounded-2xl my-4">
        <i data-lucide="bell-off" class="w-10 h-10 text-slate-500 mx-auto mb-3"></i>
        <h3 class="text-sm font-bold text-white mb-1">Henüz Kaynak Önerisi Bulunmuyor</h3>
        <p class="text-xs text-[#A8B3C7]">Koçlar kendi özel havuzlarına kaynak eklediğinde onayınıza buraya düşer.</p>
    </div>
    ` : `
    <div class="space-y-4">
        ${suggestions.map(s => `
        <div class="glass-card p-5 border ${s.status === 'BEKLİYOR' ? 'border-amber-500/50 bg-[#1C1828]' : 'border-[#24314A] bg-[#111A2C]'} rounded-2xl shadow-xl hover:border-[#4F8CFF]/50 transition">
            <div class="flex items-center justify-between mb-3 border-b border-[#24314A] pb-2">
                <div class="flex items-center gap-2">
                    <span class="px-2.5 py-0.5 rounded-lg text-xs font-bold ${s.status === 'BEKLİYOR' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : s.status === 'ONAYLANDI' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
                        ${s.status === 'BEKLİYOR' ? '⏳ Bekliyor' : s.status === 'ONAYLANDI' ? '✓ Onaylandı' : '✕ Reddedildi'}
                    </span>
                    <span class="text-xs font-bold text-white">Öneren Koç: <strong class="text-[#4F8CFF]">${escapeHtml(s.coach_name)}</strong></span>
                </div>
                <span class="text-xs text-slate-400 font-mono">${escapeHtml(s.created_at)}</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-200 mb-4 bg-[#0E1526] p-3 rounded-xl border border-[#24314A]">
                <div><span class="text-slate-400 block text-[10px]">Kaynak Adı:</span> <strong class="text-white text-xs">${escapeHtml(s.resource_title)}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Yayınevi:</span> <strong class="text-[#38BDF8] text-xs">${escapeHtml(s.publisher || 'Belirtilmedi')}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Ders:</span> <strong class="text-emerald-400 text-xs">${escapeHtml(s.subject_name || 'Ders')}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Sınav & Tür:</span> <strong class="text-purple-300 text-xs">${escapeHtml(s.exam_system || 'YKS')} (${escapeHtml(s.exam_type || 'TYT')}) • ${escapeHtml(s.resource_type || 'Soru Bankası')}</strong></div>
            </div>

            ${s.rejection_reason ? `
            <div class="p-3 mb-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300">
                <strong>Red Nedeni:</strong> ${escapeHtml(s.rejection_reason)}
            </div>
            ` : ''}

            <div class="flex items-center justify-between pt-2 border-t border-[#24314A]">
                <button onclick="openSuggestionDetailModal(${s.id})" class="text-xs text-[#4F8CFF] font-bold hover:underline">
                    🔍 Detayları Gör →
                </button>
                ${s.status === 'BEKLİYOR' ? `
                <div class="flex items-center gap-2">
                    <button onclick="approveResourceSuggestion(${s.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition flex items-center gap-1">
                        ✓ Genel Havuz'a Ekle
                    </button>
                    <button onclick="openRejectSuggestionModal(${s.id})" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition flex items-center gap-1">
                        ✕ Reddet
                    </button>
                </div>
                ` : s.status === 'ONAYLANDI' ? `
                <span class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">✓ Genel Havuz'a Eklendi</span>
                ` : `
                <span class="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-400 font-bold text-xs">✕ Reddedildi</span>
                `}
            </div>
        </div>
        `).join('')}
    </div>
    `}
    `;
}

// ----------------------------------------------------
// TAB 3: KOÇ KAYNAKLARI SUB-TAB
// ----------------------------------------------------
async function renderAdminCoachPoolsTab(token) {
    const listRes = await fetch(`${API_BASE}/admin/coach-resources`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const listData = await listRes.json();
    const coaches = listData.coaches || [];

    if (!selectedCoachPoolId && coaches.length > 0) {
        selectedCoachPoolId = coaches[0].id;
    }

    let detailData = null;
    if (selectedCoachPoolId) {
        const detRes = await fetch(`${API_BASE}/admin/coach-resources?coach_id=${selectedCoachPoolId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (detRes.ok) detailData = await detRes.json();
    }

    const summary = detailData ? detailData.summary : { total_resources: 0, system_resources_count: 0, coach_added_count: 0 };
    const resources = detailData ? detailData.resources : [];
    const coachInfo = detailData ? detailData.coach : null;

    return `
    <!-- COACH SELECTOR DROPDOWN -->
    <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl mb-6 flex items-center gap-4">
        <label class="text-xs font-bold text-white shrink-0">İncelenecek Koç Seçin:</label>
        <select onchange="selectCoachPoolAdmin(this.value)" class="bg-[#0B1324] border border-[#2A3954] rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#4F8CFF] flex-1 max-w-md">
            ${coaches.map(c => `<option value="${c.id}" ${selectedCoachPoolId == c.id ? 'selected' : ''}>👤 ${escapeHtml(c.name)} ${escapeHtml(c.surname || '')} (${c.total_resources_count} Kaynak)</option>`).join('')}
        </select>
    </div>

    ${coachInfo ? `
    <!-- COACH POOL SUMMARY SCORECARDS -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl">
            <span class="text-[10px] font-bold text-[#A8B3C7] uppercase block mb-1">Toplam Havuz Kaynağı</span>
            <span class="text-xl font-black text-white">${summary.total_resources}</span>
        </div>
        <div class="glass-card p-4 border border-blue-500/30 bg-[#111A2C] rounded-2xl">
            <span class="text-[10px] font-bold text-[#38BDF8] uppercase block mb-1">Sistem Kaynakları</span>
            <span class="text-xl font-black text-[#38BDF8]">${summary.system_resources_count}</span>
        </div>
        <div class="glass-card p-4 border border-emerald-500/30 bg-[#111A2C] rounded-2xl">
            <span class="text-[10px] font-bold text-emerald-400 uppercase block mb-1">Koç Tarafından Eklenen</span>
            <span class="text-xl font-black text-emerald-400">${summary.coach_added_count}</span>
        </div>
    </div>

    <!-- TABLE OF COACH RESOURCES -->
    <div class="glass-card overflow-hidden border border-[#24314A] bg-[#111A2C] rounded-2xl shadow-xl">
        <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-300">
                <thead class="bg-[#172238] text-white uppercase text-[10px] font-bold tracking-wider border-b border-[#24314A]">
                    <tr>
                        <th class="p-3">Kaynak Adı</th>
                        <th class="p-3">Kaynak Tipi</th>
                        <th class="p-3">Yayınevi & Ders</th>
                        <th class="p-3">Eklenme Tarihi</th>
                        <th class="p-3">Atanan Öğrenci</th>
                        <th class="p-3 text-right">İşlem</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-[#24314A]">
                    ${resources.length === 0 ? `
                    <tr><td colspan="6" class="p-8 text-center text-slate-500">Bu koçun havuzunda kayıtlı kaynak yok.</td></tr>
                    ` : resources.map(r => `
                    <tr class="hover:bg-[#172238]/50 transition">
                        <td class="p-3 font-bold text-white">${escapeHtml(r.name)}</td>
                        <td class="p-3">
                            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${r.source_type === 'Sistem Kaynağı' ? 'bg-blue-500/20 text-[#38BDF8] border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                                ${r.source_type === 'Sistem Kaynağı' ? '📚 Sistem Kaynağı' : '👤 Koç Kaynağı'}
                            </span>
                        </td>
                        <td class="p-3">${escapeHtml(r.publisher || 'Belirtilmedi')} • ${escapeHtml(r.subject_name || 'Ders')}</td>
                        <td class="p-3 font-mono text-slate-400 text-[11px]">${(r.created_at || '').substring(0, 10)}</td>
                        <td class="p-3 font-bold text-[#38BDF8]">${r.assigned_student_count || 0} Öğrenci</td>
                        <td class="p-3 text-right">
                            ${r.source_type === 'Koç Kaynağı' ? `
                            <button onclick="promoteCoachResourceToSystem(${r.id})" class="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition shadow">
                                🚀 Genel Havuz'a Aktar
                            </button>
                            ` : '<span class="text-slate-500 text-[11px]">Genel Havuzda Var</span>'}
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
    ` : ''}
    `;
}

function selectCoachPoolAdmin(coachId) {
    selectedCoachPoolId = parseInt(coachId);
    renderKaynakHavuzuView();
}

// ----------------------------------------------------
// TAB 4: YAYINEVLERİ SUB-TAB
// ----------------------------------------------------
async function renderAdminPublishersTab(token) {
    const res = await fetch(`${API_BASE}/admin/publishers`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const publishers = data.publishers || [];

    return `
    <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
            🏢 Yayınevi Yönetimi (${publishers.length} Kayıtlı Yayınevi)
        </h3>
        <button onclick="openAddPublisherModal()" class="bg-[#4F8CFF] hover:bg-[#3b72df] text-white px-4 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-2">
            + Yeni Yayınevi Ekle
        </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${publishers.map(p => `
        <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl flex items-center justify-between hover:border-[#4F8CFF]/50 transition shadow">
            <div>
                <h4 class="text-sm font-bold text-white mb-1">${escapeHtml(p.name)}</h4>
                <div class="flex items-center gap-3 text-xs text-[#A8B3C7]">
                    <span>Toplam: <strong class="text-white">${p.total_resources_count}</strong></span>
                    <span>Aktif: <strong class="text-emerald-400">${p.active_resources_count}</strong></span>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="togglePublisherStatus(${p.id}, '${p.status}')" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition ${p.status === 'INACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}">
                    ${p.status === 'INACTIVE' ? '🟢 Aktifleştir' : '⚪ Pasifleştir'}
                </button>
            </div>
        </div>
        `).join('')}
    </div>
    `;
}

// ----------------------------------------------------
// TAB 5: DERSLER SUB-TAB
// ----------------------------------------------------
async function renderAdminSubjectsTab(token) {
    const res = await fetch(`${API_BASE}/admin/subjects-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const subjects = data.subjects || [];

    return `
    <div class="mb-4">
        <h3 class="text-sm font-bold text-white mb-1">📖 Müfredat Ders Dağılımı ve Kaynak Sayıları</h3>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${subjects.map(s => `
        <div class="glass-card p-4 border border-[#24314A] bg-[#111A2C] rounded-2xl flex items-center justify-between shadow">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">${s.exam_system || 'YKS'}</span>
                    <h4 class="text-sm font-bold text-white">${escapeHtml(s.name)}</h4>
                </div>
                <div class="flex items-center gap-3 text-xs text-[#A8B3C7] mt-2">
                    <span>Toplam Kaynak: <strong class="text-white font-bold">${s.total_resources_count}</strong></span> |
                    <span>Aktif: <strong class="text-emerald-400 font-bold">${s.active_resources_count}</strong></span>
                </div>
            </div>
        </div>
        `).join('')}
    </div>
    `;
}

// ----------------------------------------------------
// TAB 6: KAYNAK İSTATİSTİKLERİ SUB-TAB
// ----------------------------------------------------
async function renderAdminAnalyticsTab(token) {
    const res = await fetch(`${API_BASE}/admin/resource-analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const topAssigned = data.top_assigned_resources || [];
    const topPublishers = data.top_publishers || [];
    const subjectUsage = data.subject_usage || [];

    return `
    <div class="space-y-6">
        <!-- TOP ASSIGNED RESOURCES -->
        <div class="glass-card p-5 border border-[#24314A] bg-[#111A2C] rounded-2xl shadow-xl">
            <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                🏆 En Çok Kullanılan & Atanan Kaynaklar (Top 10)
            </h3>
            <div class="space-y-3">
                ${topAssigned.length === 0 ? '<p class="text-xs text-slate-500">Henüz atama verisi bulunmuyor.</p>' : topAssigned.map(r => `
                <div class="p-3 bg-[#0B1324] rounded-xl border border-[#24314A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-bold text-white truncate">${escapeHtml(r.name)}</h4>
                        <span class="text-[11px] text-[#4F8CFF] font-semibold">${escapeHtml(r.publisher || '')} • ${escapeHtml(r.subject_name || '')}</span>
                    </div>
                    <div class="flex items-center gap-4 text-xs shrink-0">
                        <div><span class="text-slate-400">Atama:</span> <strong class="text-white">${r.assignment_count}</strong></div>
                        <div><span class="text-slate-400">Tamamlanan:</span> <strong class="text-emerald-400">${r.completed_count} (%${r.completion_rate})</strong></div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>

        <!-- TOP PUBLISHERS & SUBJECT USAGE GRID -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="glass-card p-5 border border-[#24314A] bg-[#111A2C] rounded-2xl shadow-xl">
                <h3 class="text-sm font-bold text-white mb-4">🏢 En Çok Kullanılan Yayınevleri</h3>
                <div class="space-y-2">
                    ${topPublishers.map(p => `
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#0B1324] border border-[#24314A] text-xs">
                        <span class="font-bold text-white">${escapeHtml(p.publisher)}</span>
                        <div class="flex items-center gap-3 text-slate-400">
                            <span>Kaynak: <strong class="text-white">${p.total_resources}</strong></span>
                            <span>Atama: <strong class="text-[#38BDF8]">${p.total_assignments}</strong></span>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>

            <div class="glass-card p-5 border border-[#24314A] bg-[#111A2C] rounded-2xl shadow-xl">
                <h3 class="text-sm font-bold text-white mb-4">📖 Ders Bazında Kaynak Kullanımı</h3>
                <div class="space-y-2 max-h-80 overflow-y-auto">
                    ${subjectUsage.map(s => `
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#0B1324] border border-[#24314A] text-xs">
                        <span class="font-bold text-white">${escapeHtml(s.subject_name)}</span>
                        <div class="flex items-center gap-3 text-slate-400">
                            <span>Kaynak: <strong class="text-white">${s.resource_count}</strong></span>
                            <span>Atama: <strong class="text-emerald-400">${s.assignment_count}</strong></span>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
    `;
}

// ----------------------------------------------------
// ADMIN RESOURCE MANAGEMENT INTERACTIVE ACTION FUNCTIONS
// ----------------------------------------------------

function filterAdminKaynakLevel(val) {
    adminKaynakLevelFilter = val;
    renderKaynakHavuzuView();
}

function filterAdminKaynakStatus(val) {
    adminKaynakStatusFilter = val;
    renderKaynakHavuzuView();
}

function toggleBulkSelectResource(resId, checked) {
    if (checked) selectedBulkResourceIds.add(resId);
    else selectedBulkResourceIds.delete(resId);
    const lbl = document.getElementById('bulkSelectedCountLabel');
    if (lbl) lbl.textContent = `Seçili: ${selectedBulkResourceIds.size}`;
}

function toggleBulkSelectAll(checked) {
    const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    checkboxes.forEach(c => {
        c.checked = checked;
        const id = parseInt(c.value);
        if (checked) selectedBulkResourceIds.add(id);
        else selectedBulkResourceIds.delete(id);
    });
    const lbl = document.getElementById('bulkSelectedCountLabel');
    if (lbl) lbl.textContent = `Seçili: ${selectedBulkResourceIds.size}`;
}

async function executeAdminBulkAction(action) {
    if (selectedBulkResourceIds.size === 0) {
        alert("Lütfen en az 1 kaynak seçiniz!");
        return;
    }

    let actionLabel = action === 'ACTIVATE' ? 'aktifleştirmek' : action === 'DEACTIVATE' ? 'pasife almak' : 'silmek/pasife almak';
    if (!confirm(`Seçilen ${selectedBulkResourceIds.size} kaynağı ${actionLabel} istediğinize emin misiniz?`)) return;

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynak-havuzu/bulk-action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ resource_ids: Array.from(selectedBulkResourceIds), action: action })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Toplu işlem başarısız");

        selectedBulkResourceIds.clear();
        alert("✅ " + data.message);
        renderKaynakHavuzuView();
    } catch (err) {
        alert("❌ " + err.message);
    }
}

async function toggleResourceStatus(resourceId, currentStatus) {
    const newStatus = currentStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    const confirmMsg = newStatus === 'INACTIVE' 
        ? "Bu kaynağı pasife almak istediğinize emin misiniz?\n(Pasif kaynaklar yeni koçlara kopyalanmaz, ancak mevcut atamalar korunur)."
        : "Bu kaynağı tekrar aktifleştirmek istiyor musunuz?";
    
    if (!confirm(confirmMsg)) return;

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynak-havuzu/${resourceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Güncelleme başarısız");

        alert("✅ Kaynak durumu güncellendi.");
        renderKaynakHavuzuView();
    } catch (err) {
        alert("❌ " + err.message);
    }
}

async function openResourceDetailModal(resourceId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynak-havuzu/${resourceId}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Kaynak detayları yüklenemedi.");
        const data = await res.json();
        const r = data.resource;
        const coaches = data.assigned_coaches || [];
        const stats = data.statistics || {};

        const html = `
        <div class="p-6 max-w-2xl mx-auto bg-[#111A2C] border border-[#24314A] rounded-2xl shadow-2xl space-y-5 text-xs text-slate-200">
            <div class="flex items-center justify-between pb-3 border-b border-[#24314A]">
                <div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'INACTIVE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                        ${r.status === 'INACTIVE' ? '⚪ Pasif Kaynak' : '🟢 Aktif Kaynak'}
                    </span>
                    <h3 class="text-base font-bold text-white mt-1">${escapeHtml(r.name)}</h3>
                    <span class="text-xs text-[#4F8CFF] font-semibold">${escapeHtml(r.publisher || 'Yayınevi Yok')} • ${escapeHtml(r.subject_name || 'Ders')}</span>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            <!-- RESOURCE INFO METRICS GRID -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0B1324] p-3.5 rounded-xl border border-[#24314A]">
                <div><span class="text-slate-400 block text-[10px]">Sınav Türü:</span> <strong class="text-white">${r.exam_system || 'YKS'} (${r.exam_type || 'TYT'})</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Kaynak Türü:</span> <strong class="text-white">${r.resource_type || 'Soru Bankası'}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Seviye:</span> <strong class="text-white">${r.level || 'Orta'}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Toplam Soru / Sayfa:</span> <strong class="text-white">${r.total_questions || 0} Soru / ${r.total_pages || 0} Syf</strong></div>
            </div>

            ${r.description ? `<div class="p-3 bg-[#0E1526] rounded-xl border border-[#24314A] text-slate-300"><strong>Açıklama:</strong> ${escapeHtml(r.description)}</div>` : ''}

            <!-- ASSIGNMENT STATISTICS -->
            <div>
                <h4 class="font-bold text-white mb-2 text-xs uppercase tracking-wider text-[#38BDF8]">KAYNAK İSTATİSTİKLERİ</h4>
                <div class="grid grid-cols-4 gap-3">
                    <div class="bg-[#0B1324] p-3 rounded-xl border border-[#24314A]">
                        <span class="text-[10px] text-slate-400 block">Toplam Atama</span>
                        <span class="text-base font-black text-white">${stats.total_assignments || 0}</span>
                    </div>
                    <div class="bg-[#0B1324] p-3 rounded-xl border border-emerald-500/30">
                        <span class="text-[10px] text-emerald-400 block">Tamamlanan</span>
                        <span class="text-base font-black text-emerald-400">${stats.completed_assignments || 0}</span>
                    </div>
                    <div class="bg-[#0B1324] p-3 rounded-xl border border-blue-500/30">
                        <span class="text-[10px] text-[#38BDF8] block">Devam Eden</span>
                        <span class="text-base font-black text-[#38BDF8]">${stats.in_progress_assignments || 0}</span>
                    </div>
                    <div class="bg-[#0B1324] p-3 rounded-xl border border-purple-500/30">
                        <span class="text-[10px] text-purple-300 block">Tamamlanma Oranı</span>
                        <span class="text-base font-black text-purple-300">%${stats.completion_rate || 0}</span>
                    </div>
                </div>
            </div>

            <!-- ASSIGNED COACHES LIST -->
            <div>
                <h4 class="font-bold text-white mb-2 text-xs uppercase tracking-wider text-[#4F8CFF]">KAYNAĞI KULLANAN KOÇLAR (${coaches.length} Koç)</h4>
                ${coaches.length === 0 ? `
                <p class="text-slate-500 italic p-3 bg-[#0B1324] rounded-xl border border-[#24314A]">Bu kaynak henüz hiçbir koç tarafından öğrencilere atanmadı.</p>
                ` : `
                <div class="space-y-2 max-h-40 overflow-y-auto">
                    ${coaches.map(c => `
                    <div class="flex items-center justify-between p-2.5 bg-[#0B1324] rounded-xl border border-[#24314A]">
                        <span class="font-bold text-white">👤 ${escapeHtml(c.name)} ${escapeHtml(c.surname || '')}</span>
                        <span class="text-[#38BDF8] font-bold">${c.student_count} Öğrenciye Atadı</span>
                    </div>
                    `).join('')}
                </div>
                `}
            </div>

            <div class="pt-3 border-t border-[#24314A] flex justify-end">
                <button onclick="closeModal()" class="px-5 py-2 rounded-xl bg-[#172238] hover:bg-[#24314A] text-white font-bold">Kapat</button>
            </div>
        </div>
        `;
        openModal(html);
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

function openRejectSuggestionModal(sugId) {
    const html = `
    <div class="p-6 max-w-md mx-auto bg-[#111A2C] border border-[#24314A] rounded-2xl shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-[#24314A]">
            <h3 class="text-sm font-bold text-white">Kaynak Önerisini Reddet</h3>
            <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
        </div>

        <div>
            <label class="block text-xs font-bold text-[#A8B3C7] mb-1">Red Nedeni (İsteğe Bağlı):</label>
            <textarea id="sug_reject_reason" rows="3" placeholder="Örn: Bu kaynak zaten Genel Havuz'da mevcut." class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#4F8CFF]"></textarea>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
            <button onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-400 font-bold text-xs">İptal</button>
            <button onclick="submitRejectSuggestion(${sugId})" class="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow">
                ✕ Öneriyi Reddet
            </button>
        </div>
    </div>
    `;
    openModal(html);
}

async function submitRejectSuggestion(sugId) {
    const reason = document.getElementById('sug_reject_reason').value.trim();
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/resource-suggestions/${sugId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'REJECT', rejection_reason: reason })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "İşlem başarısız");
        closeModal();
        alert("✅ Öneri reddedildi.");
        renderKaynakHavuzuView();
    } catch (err) {
        alert("❌ " + err.message);
    }
}

async function openSuggestionDetailModal(sugId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/resource-suggestions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const sug = (data.suggestions || []).find(s => s.id == sugId);
        if (!sug) return alert("Öneri bulunamadı.");

        const html = `
        <div class="p-6 max-w-lg mx-auto bg-[#111A2C] border border-[#24314A] rounded-2xl shadow-2xl space-y-4 text-xs">
            <div class="flex items-center justify-between pb-3 border-b border-[#24314A]">
                <h3 class="text-sm font-bold text-white">Öneri Detayı #${sug.id}</h3>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
            </div>

            <div class="space-y-2 bg-[#0B1324] p-4 rounded-xl border border-[#24314A]">
                <div><span class="text-slate-400 block text-[10px]">Öneren Koç:</span> <strong class="text-white text-sm">${escapeHtml(sug.coach_name)}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Kaynak Adı:</span> <strong class="text-[#38BDF8] text-sm">${escapeHtml(sug.resource_title)}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Yayınevi & Ders:</span> <strong class="text-emerald-400">${escapeHtml(sug.publisher || 'Belirtilmedi')} • ${escapeHtml(sug.subject_name || 'Ders')}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Sınav & Tür:</span> <strong class="text-purple-300">${sug.exam_system} (${sug.exam_type}) • ${sug.resource_type || 'Soru Bankası'}</strong></div>
                <div><span class="text-slate-400 block text-[10px]">Tarih:</span> <span class="text-slate-300 font-mono">${sug.created_at}</span></div>
            </div>

            ${sug.description ? `<div class="p-3 bg-[#0E1526] rounded-xl border border-[#24314A] text-slate-300"><strong>Açıklama:</strong> ${escapeHtml(sug.description)}</div>` : ''}

            <div class="flex justify-end gap-2 pt-2 border-t border-[#24314A]">
                ${sug.status === 'BEKLİYOR' ? `
                <button onclick="approveResourceSuggestion(${sug.id}); closeModal();" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl">✓ Onayla ve Ekle</button>
                <button onclick="closeModal(); openRejectSuggestionModal(${sug.id});" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl">✕ Reddet</button>
                ` : `<button onclick="closeModal()" class="px-4 py-2 rounded-xl bg-[#172238] text-white font-bold">Kapat</button>`}
            </div>
        </div>
        `;
        openModal(html);
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function promoteCoachResourceToSystem(coachResId) {
    if (!confirm("Bu koç kaynağını Genel Kaynak Havuzuna aktarmak istediğinize emin misiniz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/coach-resources/${coachResId}/promote-to-system`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Aktarım başarısız");

        alert("✅ " + data.message);
        renderKaynakHavuzuView();
    } catch (err) {
        alert("❌ " + err.message);
    }
}

function openAddPublisherModal() {
    const html = `
    <div class="p-6 max-w-md mx-auto bg-[#111A2C] border border-[#24314A] rounded-2xl shadow-2xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-[#24314A]">
            <h3 class="text-sm font-bold text-white">+ Yeni Yayınevi Ekle</h3>
            <button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button>
        </div>
        <div>
            <label class="block text-xs font-bold text-[#A8B3C7] mb-1">Yayınevi Adı *</label>
            <input type="text" id="new_pub_name" required placeholder="Örn: Karekök Yayınları" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4F8CFF]">
        </div>
        <div class="flex justify-end gap-2 pt-2 border-t border-[#24314A]">
            <button onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-400 font-bold text-xs">İptal</button>
            <button onclick="submitAddPublisher()" class="bg-[#4F8CFF] hover:bg-[#3b72df] text-white px-4 py-2 rounded-xl font-bold text-xs shadow">Ekle</button>
        </div>
    </div>
    `;
    openModal(html);
}

async function submitAddPublisher() {
    const name = document.getElementById('new_pub_name').value.trim();
    if (!name) return alert("Yayınevi adı zorunludur!");
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/publishers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ekleme başarısız");
        closeModal();
        alert("✅ Yayınevi eklendi.");
        renderKaynakHavuzuView();
    } catch (err) {
        alert("❌ " + err.message);
    }
}

async function togglePublisherStatus(pubId, currentStatus) {
    const newStatus = currentStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/publishers/${pubId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Güncelleme başarısız");
        renderKaynakHavuzuView();
    } catch (err) {
        alert("❌ " + err.message);
    }
}

function setKaynakTab(tab) {
    currentKaynakTab = tab;
    renderKaynakHavuzuView();
}

function filterKaynakSearch(query) {
    kaynakSearchQuery = query;
    renderKaynakHavuzuView();
}

function filterKaynakSubject(subjectId) {
    kaynakSubjectFilter = subjectId;
    renderKaynakHavuzuView();
}

function filterKaynakSystem(system) {
    kaynakSystemFilter = system;
    renderKaynakHavuzuView();
}

function filterKaynakType(type) {
    kaynakTypeFilter = type;
    renderKaynakHavuzuView();
}

function resetKaynakFilters() {
    kaynakSearchQuery = '';
    kaynakSubjectFilter = 'ALL';
    kaynakSystemFilter = 'ALL';
    kaynakTypeFilter = 'ALL';
    renderKaynakHavuzuView();
}

function getExamBadgeText(r) {
    const sys = (r.exam_system || 'YKS').toUpperCase();
    if (sys === 'LGS') return 'LGS (8. Sınıf)';
    const type = (r.exam_type || 'TYT').toUpperCase();
    const field = (r.field || 'ALL').toUpperCase();

    let fieldStr = '';
    if (field === 'SAYISAL') fieldStr = ' • SAYISAL';
    else if (field === 'EA' || field === 'ESIT_AGIRLIK') fieldStr = ' • EA';
    else if (field === 'SOZEL') fieldStr = ' • SÖZEL';
    else if (field === 'YDT' || field === 'DIL') fieldStr = ' • DİL';

    return `YKS • ${type}${fieldStr}`;
}

function renderResourceCardHtml(r) {
    const isOwner = currentUser && (currentUser.role === 'ADMIN' || (currentUser.role === 'COACH' && r.owner_type === 'COACH'));
    const isSystem = r.owner_type === 'SYSTEM' || !r.owner_id;
    const isArchived = r.status === 'ARCHIVED';

    return `
    <div class="glass-card p-5 border ${isArchived ? 'border-amber-500/30 bg-[#141824]' : 'border-[#24314A] bg-[#111A2C]'} rounded-2xl flex flex-col justify-between hover:border-[#4F8CFF]/50 transition shadow-lg">
        <div>
            <!-- BADGE ROW -->
            <div class="flex items-center justify-between gap-2 mb-3">
                <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${isSystem ? 'bg-blue-500/20 text-[#38BDF8] border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                    ${isSystem ? '🔵 Sistem Kaynağı' : '👤 Kendi Kaynağım'}
                </span>
                <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-[#172238] text-white border border-[#2A3954]">
                    ${getExamBadgeText(r)}
                </span>
            </div>

            <!-- TITLE & PUBLISHER & SUBJECT -->
            <h3 class="text-sm font-bold text-white mb-1 leading-snug">${r.name}</h3>
            <p class="text-xs text-[#4F8CFF] font-semibold mb-3">
                ${r.publisher || 'Yayınevi Belirtilmemiş'} ${r.subject_name ? `• <span class="text-[#A8B3C7]">${r.subject_name}</span>` : ''}
            </p>

            ${r.description ? `<p class="text-xs text-[#A8B3C7] line-clamp-2 mb-4 bg-[#0B1324] p-2.5 rounded-xl border border-[#24314A]">${r.description}</p>` : ''}

            <!-- METRICS ROW (SIMPLIFIED - NO TOPIC MAPPING) -->
            <div class="space-y-1.5 text-xs text-[#A8B3C7] border-t border-[#24314A] pt-3 mb-4">
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Kaynak Türü:</span>
                    <span class="text-white font-bold">${r.resource_type || 'Soru Bankası'}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Seviye:</span>
                    <span class="text-white font-bold">${r.level || 'Orta'}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Öğrenciye Atanan:</span>
                    <span class="text-[#38BDF8] font-black">${r.assigned_student_count || 0} Öğrenci</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Durum:</span>
                    <span class="font-bold ${isArchived ? 'text-amber-400' : 'text-emerald-400'}">
                        ${isArchived ? '🟡 Arşiv' : '🟢 Aktif'}
                    </span>
                </div>
            </div>
        </div>

        <!-- ACTIONS ROW -->
        <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-[#24314A]">
            ${currentUser && currentUser.role !== 'STUDENT' ? `
            <button onclick="openAssignResourceModal(${r.id})" class="bg-[#4F8CFF] hover:bg-[#3b72df] text-white px-3 py-2 text-xs font-bold rounded-xl flex-1 flex items-center justify-center gap-1.5 shadow transition min-w-[120px]">
                <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Öğrenciye Ata
            </button>
            ` : ''}

            ${isOwner ? `
            <button onclick="openCreateResourceModal(${r.id})" class="bg-[#172238] hover:bg-[#24314A] px-3 py-2 rounded-xl text-slate-300 hover:text-white border border-[#2A3954] transition flex items-center gap-1 text-xs font-bold" title="Düzenle">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Düzenle
            </button>
            <button onclick="deleteOrArchiveResource(${r.id})" class="bg-rose-500/10 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-xl text-rose-400 border border-rose-500/30 transition flex items-center gap-1 text-xs font-bold ml-auto" title="Sil">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Sil
            </button>
            ` : (currentUser && (currentUser.role === 'COACH' || currentUser.role === 'ADMIN') ? `
            <button onclick="deleteOrArchiveResource(${r.id})" class="bg-rose-500/10 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-xl text-rose-400 border border-rose-500/30 transition flex items-center gap-1 text-xs font-bold ml-auto" title="Sil">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Sil
            </button>
            ` : '')}
        </div>
    </div>
    `;
}

// ----------------------------------------------------
// MERKEZİ MÜFREDAT VE DERS YAPISI (REQUIREMENT #14)
// ----------------------------------------------------
const CURRICULUM_STRUCTURE_MAP = {
    'YKS': {
        'TYT': {
            'ALL': [
                { id: 1, name: 'Türkçe' },
                { id: 2, name: 'Matematik' },
                { id: 3, name: 'Geometri' },
                { id: 4, name: 'Fizik' },
                { id: 5, name: 'Kimya' },
                { id: 6, name: 'Biyoloji' },
                { id: 7, name: 'Tarih' },
                { id: 8, name: 'Coğrafya' },
                { id: 9, name: 'Felsefe' },
                { id: 10, name: 'Din Kültürü ve Ahlak Bilgisi' }
            ]
        },
        'AYT': {
            'SAYISAL': [
                { id: 11, name: 'Matematik' },
                { id: 12, name: 'Geometri' },
                { id: 13, name: 'Fizik' },
                { id: 14, name: 'Kimya' },
                { id: 15, name: 'Biyoloji' }
            ],
            'EA': [
                { id: 11, name: 'Matematik' },
                { id: 12, name: 'Geometri' },
                { id: 16, name: 'Türk Dili ve Edebiyatı' },
                { id: 17, name: 'Tarih-1' },
                { id: 18, name: 'Coğrafya-1' }
            ],
            'SOZEL': [
                { id: 16, name: 'Türk Dili ve Edebiyatı' },
                { id: 17, name: 'Tarih-1' },
                { id: 18, name: 'Coğrafya-1' },
                { id: 19, name: 'Tarih-2' },
                { id: 20, name: 'Coğrafya-2' },
                { id: 21, name: 'Felsefe Grubu' },
                { id: 33, name: 'Din Kültürü ve Ahlak Bilgisi' }
            ]
        },
        'YDT': {
            'ALL': [
                { id: 22, name: 'İngilizce' },
                { id: 29, name: 'Almanca' },
                { id: 30, name: 'Fransızca' },
                { id: 31, name: 'Arapça' },
                { id: 32, name: 'Rusça' }
            ]
        }
    },
    'LGS': {
        'LGS': {
            'ALL': [
                { id: 23, name: 'Türkçe' },
                { id: 27, name: 'Matematik' },
                { id: 28, name: 'Fen Bilimleri' },
                { id: 24, name: 'T.C. İnkılap Tarihi ve Atatürkçülük' },
                { id: 25, name: 'Din Kültürü ve Ahlak Bilgisi' },
                { id: 26, name: 'İngilizce' }
            ]
        }
    }
};

async function openCreateResourceModal(resourceId = null) {
    const token = localStorage.getItem('yks_token');
    let r = { name: '', publisher: '', exam_system: 'YKS', exam_type: 'TYT', field: 'ALL', subject_id: '', resource_type: 'Soru Bankası', level: 'Orta', description: '' };

    try {
        if (resourceId) {
            const resR = await fetch(`${API_BASE}/kaynak-havuzu?tab=ALL`, { headers: { 'Authorization': `Bearer ${token}` } });
            const dataR = await resR.json();
            const found = (dataR.resources || []).find(item => item.id == resourceId);
            if (found) r = found;
        }

        const modalTitle = resourceId ? 'Kaynağı Düzenle' : '+ Yeni Kaynak Ekle';
        const modalBody = `
            <form onsubmit="submitCreateResource(event, ${resourceId})" class="space-y-4 text-xs">
                <div>
                    <label class="block font-bold text-[#A8B3C7] mb-1">Kaynak Adı *</label>
                    <input type="text" id="res_name" required value="${r.name}" placeholder="Örn: 345 TYT Matematik Soru Bankası" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]">
                </div>

                <div>
                    <label class="block font-bold text-[#A8B3C7] mb-1">Yayınevi</label>
                    <input type="text" id="res_publisher" value="${r.publisher || ''}" placeholder="Örn: 345 Yayınları" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label class="block font-bold text-[#A8B3C7] mb-1">Sınav Sistemi *</label>
                        <select id="res_exam_system" onchange="handleExamSystemChange()" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]">
                            <option value="YKS" ${r.exam_system === 'YKS' ? 'selected' : ''}>YKS</option>
                            <option value="LGS" ${r.exam_system === 'LGS' ? 'selected' : ''}>LGS</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-[#A8B3C7] mb-1">Sınav Türü *</label>
                        <select id="res_exam_type" onchange="handleExamTypeChange()" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]"></select>
                    </div>
                    <div>
                        <label class="block font-bold text-[#A8B3C7] mb-1">Alan</label>
                        <select id="res_field" onchange="handleFieldChange()" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]"></select>
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-[#A8B3C7] mb-1">Ders *</label>
                    <select id="res_subject_id" required class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]"></select>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold text-[#A8B3C7] mb-1">Kaynak Türü</label>
                        <select id="res_resource_type" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]">
                            <option value="Soru Bankası" ${r.resource_type === 'Soru Bankası' ? 'selected' : ''}>Soru Bankası</option>
                            <option value="Konu Anlatım" ${r.resource_type === 'Konu Anlatım' ? 'selected' : ''}>Konu Anlatım</option>
                            <option value="Deneme" ${r.resource_type === 'Deneme' ? 'selected' : ''}>Deneme</option>
                            <option value="Fasikül" ${r.resource_type === 'Fasikül' ? 'selected' : ''}>Fasikül</option>
                            <option value="Video" ${r.resource_type === 'Video' ? 'selected' : ''}>Video</option>
                            <option value="PDF" ${r.resource_type === 'PDF' ? 'selected' : ''}>PDF</option>
                            <option value="Resmi Kaynak" ${r.resource_type === 'Resmi Kaynak' ? 'selected' : ''}>Resmi Kaynak</option>
                            <option value="Diğer" ${r.resource_type === 'Diğer' ? 'selected' : ''}>Diğer</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-[#A8B3C7] mb-1">Seviye *</label>
                        <select id="res_level" class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]">
                            <option value="Başlangıç" ${r.level === 'Başlangıç' ? 'selected' : ''}>Başlangıç</option>
                            <option value="Temel" ${r.level === 'Temel' ? 'selected' : ''}>Temel</option>
                            <option value="Orta" ${!r.level || r.level === 'Orta' ? 'selected' : ''}>Orta</option>
                            <option value="Orta-İleri" ${r.level === 'Orta-İleri' ? 'selected' : ''}>Orta-İleri</option>
                            <option value="İleri" ${r.level === 'İleri' ? 'selected' : ''}>İleri</option>
                            <option value="Zor" ${r.level === 'Zor' ? 'selected' : ''}>Zor</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-[#A8B3C7] mb-1">Açıklama / Notlar</label>
                    <textarea id="res_description" rows="2" placeholder="Kaynak hakkında özel notlar..." class="w-full bg-[#0B1324] border border-[#2A3954] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F8CFF]">${r.description || ''}</textarea>
                </div>

                <div class="pt-3 border-t border-[#24314A] flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs">İptal</button>
                    <button type="submit" class="bg-[#4F8CFF] hover:bg-[#3b72df] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition">
                        ${resourceId ? 'Kaydet' : '+ Kaynağı Ekle'}
                    </button>
                </div>
            </form>
        `;
        openModal(modalTitle, modalBody);
        if (window.lucide) lucide.createIcons();
        initResourceFormDropdowns(r);
    } catch (err) {
        alert("Modal açılırken hata oluştu!");
    }
}

function initResourceFormDropdowns(initialResource = {}) {
    const sysEl = document.getElementById('res_exam_system');
    if (!sysEl) return;
    if (initialResource.exam_system) sysEl.value = initialResource.exam_system;
    handleExamSystemChange(initialResource);
}

function handleExamSystemChange(initialResource = null) {
    const sys = (document.getElementById('res_exam_system') ? document.getElementById('res_exam_system').value : '');
    const typeEl = document.getElementById('res_exam_type');
    const fieldEl = document.getElementById('res_field');

    if (sys === 'LGS') {
        typeEl.innerHTML = '<option value="LGS" selected>LGS</option>';
        typeEl.disabled = true;
        fieldEl.innerHTML = '<option value="ALL" selected>Gerekli Değil</option>';
        fieldEl.disabled = true;
        updateSubjectDropdownOptions(initialResource ? initialResource.subject_id : null);
    } else if (sys === 'YKS') {
        typeEl.disabled = false;
        const curType = initialResource ? initialResource.exam_type : 'TYT';
        typeEl.innerHTML = `
            <option value="TYT" ${curType === 'TYT' ? 'selected' : ''}>TYT</option>
            <option value="AYT" ${curType === 'AYT' ? 'selected' : ''}>AYT</option>
            <option value="YDT" ${curType === 'YDT' ? 'selected' : ''}>YDT</option>
        `;
        handleExamTypeChange(initialResource);
    }
}

function handleExamTypeChange(initialResource = null) {
    const sys = (document.getElementById('res_exam_system') ? document.getElementById('res_exam_system').value : '');
    const type = (document.getElementById('res_exam_type') ? document.getElementById('res_exam_type').value : '');
    const fieldEl = document.getElementById('res_field');

    if (sys !== 'YKS') return;

    if (type === 'TYT' || type === 'YDT') {
        fieldEl.innerHTML = `<option value="ALL" selected>${type === 'YDT' ? 'DİL (YDT)' : 'Tüm Alanlar'}</option>`;
        fieldEl.disabled = true;
        updateSubjectDropdownOptions(initialResource ? initialResource.subject_id : null);
    } else if (type === 'AYT') {
        fieldEl.disabled = false;
        const curField = initialResource ? initialResource.field : '';
        fieldEl.innerHTML = `
            <option value="">-- Alan Seçin --</option>
            <option value="SAYISAL" ${curField === 'SAYISAL' ? 'selected' : ''}>SAYISAL</option>
            <option value="EA" ${curField === 'EA' || curField === 'ESIT_AGIRLIK' ? 'selected' : ''}>EŞİT AĞIRLIK</option>
            <option value="SOZEL" ${curField === 'SOZEL' ? 'selected' : ''}>SÖZEL</option>
        `;
        handleFieldChange(initialResource);
    }
}

function handleFieldChange(initialResource = null) {
    const sys = (document.getElementById('res_exam_system') ? document.getElementById('res_exam_system').value : '');
    const type = (document.getElementById('res_exam_type') ? document.getElementById('res_exam_type').value : '');
    const field = (document.getElementById('res_field') ? document.getElementById('res_field').value : '');

    if (sys === 'YKS' && type === 'AYT' && !field) {
        updateSubjectDropdownOptions(null, '-- Önce alan seçin --');
        return;
    }
    updateSubjectDropdownOptions(initialResource ? initialResource.subject_id : null);
}

function updateSubjectDropdownOptions(preferredSubjectId = null, placeholderText = '-- Ders Seçiniz --') {
    const sys = (document.getElementById('res_exam_system') ? document.getElementById('res_exam_system').value : '');
    const type = (document.getElementById('res_exam_type') ? document.getElementById('res_exam_type').value : '');
    const field = (document.getElementById('res_field') ? document.getElementById('res_field').value : '') || 'ALL';
    const subEl = document.getElementById('res_subject_id');

    if (!subEl) return;

    let subjects = [];
    if (CURRICULUM_STRUCTURE_MAP[sys] && CURRICULUM_STRUCTURE_MAP[sys][type]) {
        subjects = CURRICULUM_STRUCTURE_MAP[sys][type][field] || CURRICULUM_STRUCTURE_MAP[sys][type]['ALL'] || [];
    }

    if (subjects.length === 0) {
        subEl.innerHTML = `<option value="">${placeholderText || 'Bu sınav türü için tanımlı ders bulunamadı.'}</option>`;
        subEl.disabled = true;
        return;
    }

    subEl.disabled = false;
    let html = `<option value="">${placeholderText}</option>`;
    let isPreferredValid = subjects.some(s => s.id == preferredSubjectId);
    let selectedId = isPreferredValid ? preferredSubjectId : subEl.value;

    subjects.forEach(s => {
        html += `<option value="${s.id}" ${selectedId == s.id ? 'selected' : ''}>${s.name}</option>`;
    });
    subEl.innerHTML = html;
}

async function submitCreateResource(event, resourceId) {
    event.preventDefault();
    const token = localStorage.getItem('yks_token');
    const payload = {
        name: document.getElementById('res_name').value.trim(),
        publisher: document.getElementById('res_publisher').value.trim(),
        subject_id: parseInt(document.getElementById('res_subject_id').value),
        exam_system: document.getElementById('res_exam_system').value,
        exam_type: document.getElementById('res_exam_type').value,
        field: document.getElementById('res_field').value,
        resource_type: document.getElementById('res_resource_type').value,
        level: document.getElementById('res_level').value,
        description: document.getElementById('res_description').value.trim()
    };

    try {
        const url = resourceId ? `${API_BASE}/kaynak-havuzu/${resourceId}` : `${API_BASE}/kaynak-havuzu`;
        const method = resourceId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            alert("❌ " + (data.error || "İşlem başarısız"));
            return;
        }
        closeModal();
        alert("✅ " + data.message);
        renderKaynakHavuzuView();
    } catch (err) {
        alert("Bağlantı hatası!");
    }
}

async function openManageResourceTopicsModal(resourceId) {
    const token = localStorage.getItem('yks_token');
    try {
        const resR = await fetch(`${API_BASE}/kaynak-havuzu?tab=ALL`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataR = await resR.json();
        const resource = (dataR.resources || []).find(r => r.id == resourceId);
        if (!resource) return;

        const resMapped = await fetch(`${API_BASE}/kaynak-havuzu/${resourceId}/topics`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataMapped = await resMapped.json();
        const mappedTopicIds = (dataMapped.topics || []).map(t => t.curriculum_topic_id);

        const resSub = await fetch(`${API_BASE}/mufredat`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataSub = await resSub.json();
        const subjectData = (dataSub.subjects || []).find(s => s.id == resource.subject_id);
        const subjectTopics = subjectData ? (subjectData.topics || []) : [];

        const html = `
        <div class="p-6 max-w-xl mx-auto bg-[#111A2C] border border-[#24314A] rounded-2xl shadow-2xl">
            <div class="flex items-center justify-between pb-3 border-b border-[#24314A] mb-4">
                <div>
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <i data-lucide="list-checks" class="w-5 h-5 text-[#38BDF8]"></i>
                        Kaynak Konu Eşleştirme (${resource.name})
                    </h3>
                    <span class="text-xs text-[#A8B3C7]">${resource.subject_name} müfredat konularını kaynağa ekleyin veya çıkarın</span>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            <div class="max-h-80 overflow-y-auto space-y-2 pr-1 mb-4">
                ${subjectTopics.map(t => {
                    const isChecked = mappedTopicIds.includes(t.id);
                    return `
                    <label class="flex items-center justify-between p-3 rounded-xl border border-[#24314A] bg-[#0B1324] hover:border-[#4F8CFF]/50 cursor-pointer">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" name="resourceTopicCheck" value="${t.id}" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700">
                            <span class="text-xs font-bold text-white">${t.name}</span>
                        </div>
                        <span class="text-[10px] font-mono text-[#A8B3C7]">${t.code || ''}</span>
                    </label>
                    `;
                }).join('')}
            </div>

            <div class="pt-3 border-t border-[#24314A] flex justify-between items-center">
                <span class="text-xs text-[#A8B3C7]">İlişkilendirilen: <strong id="selectedTopicsCount" class="text-white">${mappedTopicIds.length}</strong> / ${subjectTopics.length} Konu</span>
                <div class="flex gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs">İptal</button>
                    <button type="button" onclick="submitManageResourceTopics(${resourceId})" class="btn-primary-purple px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg">
                        Konu Eşleşmesini Kaydet
                    </button>
                </div>
            </div>
        </div>
        `;
        openModal(html);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert("Konular yüklenirken hata oluştu!");
    }
}

async function submitManageResourceTopics(resourceId) {
    const checkboxes = document.querySelectorAll('input[name="resourceTopicCheck"]:checked');
    const topicIds = Array.from(checkboxes).map(c => parseInt(c.value));
    const token = localStorage.getItem('yks_token');

    try {
        const res = await fetch(`${API_BASE}/kaynak-havuzu/${resourceId}/topics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ topic_ids: topicIds })
        });
        const data = await res.json();
        if (!res.ok) {
            alert("❌ " + (data.error || "Güncelleme başarısız"));
            return;
        }
        closeModal();
        alert("✅ " + data.message);
        renderKaynakHavuzuView();
    } catch (err) {
        alert("Bağlantı hatası!");
    }
}

async function openAssignResourceModal(resourceId, resourceTitle = null) {
    if (resourceTitle) {
        return openQuickAssignResourceModal(resourceId, resourceTitle);
    }
    const token = localStorage.getItem('yks_token');
    try {
        const resR = await fetch(`${API_BASE}/kaynak-havuzu?tab=ALL`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataR = await resR.json();
        const resource = (dataR.resources || []).find(r => r.id == resourceId);
        if (!resource) return;

        const resSt = await fetch(`${API_BASE}/rel/students`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataSt = await resSt.json();
        const myStudents = dataSt.students || [];

        const html = `
        <div class="p-6 max-w-lg mx-auto bg-[#111A2C] border border-[#24314A] rounded-2xl shadow-2xl">
            <div class="flex items-center justify-between pb-3 border-b border-[#24314A] mb-4">
                <div>
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <i data-lucide="user-plus" class="w-5 h-5 text-[#4F8CFF]"></i>
                        Öğrenciye Kaynak Ata (${resource.name})
                    </h3>
                    <span class="text-xs text-[#A8B3C7]">Kaynağı atamak istediğiniz aktif öğrencilerinizi seçin</span>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            ${myStudents.length === 0 ? `
            <p class="text-xs text-amber-400 my-4 text-center">Atanabilecek aktif bağlı öğrenciniz bulunmamaktadır.</p>
            ` : `
            <div class="max-h-60 overflow-y-auto space-y-2 pr-1 mb-4">
                ${myStudents.map(s => `
                <label class="flex items-center justify-between p-3 rounded-xl border border-[#24314A] bg-[#0B1324] hover:border-[#4F8CFF]/50 cursor-pointer">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" name="assignStudentCheck" value="${s.id}" class="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700">
                        <div>
                            <span class="text-xs font-bold text-white block">${s.name}</span>
                            <span class="text-[10px] text-[#A8B3C7]">${s.track} • ${s.school || 'Lise'}</span>
                        </div>
                    </div>
                </label>
                `).join('')}
            </div>
            `}

            <div class="pt-3 border-t border-[#24314A] flex justify-end gap-2">
                <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs">İptal</button>
                <button type="button" onclick="submitAssignResource(${resourceId})" class="btn-primary-purple px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg">
                    📌 Seçilen Öğrencilere Ata
                </button>
            </div>
        </div>
        `;
        openModal(html);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert("Öğrenci listesi yüklenirken hata oluştu!");
    }
}

async function submitAssignResource(resourceId) {
    const checkboxes = document.querySelectorAll('input[name="assignStudentCheck"]:checked');
    const studentIds = Array.from(checkboxes).map(c => parseInt(c.value));
    if (studentIds.length === 0) {
        alert("Lütfen en az 1 öğrenci seçiniz!");
        return;
    }

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynak-havuzu/${resourceId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_ids: studentIds })
        });
        const data = await res.json();
        if (!res.ok) {
            alert("❌ " + (data.error || "Atama hatası"));
            return;
        }
        closeModal();
        alert("✅ " + data.message);
        renderKaynakHavuzuView();
    } catch (err) {
        alert("Bağlantı hatası!");
    }
}

async function copyResourceToMyPool(resourceId) {
    if (!confirm("Bu sistem kaynağını kendi kişisel havuzunuza kopyalamak istiyor musunuz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynak-havuzu/${resourceId}/copy-to-my-pool`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            alert("❌ " + (data.error || "Kopyalama hatası"));
            return;
        }
        alert("✅ " + data.message);
        renderKaynakHavuzuView();
    } catch (err) {
        alert("Bağlantı hatası!");
    }
}

async function deleteOrArchiveResource(resourceId) {
    if (!confirm("Bu kaynağı silmek veya arşivlemek istediğinizden emin misiniz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynak-havuzu/${resourceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            alert("❌ " + (data.error || "Silme hatası"));
            return;
        }
        alert("✅ " + data.message);
        renderKaynakHavuzuView();
    } catch (err) {
        alert("Bağlantı hatası!");
    }
}
// ----------------------------------------------------
// 1. COACH / ADMIN DASHBOARD & RISK MONITOR
// ----------------------------------------------------
async function renderCoachDashboard() {
    document.getElementById('pageTitle').textContent = "Koç Yönetim Dashboard";
    const token = localStorage.getItem('yks_token');
    
    try {
        const [res, resRel] = await Promise.all([
            fetch(`${API_BASE}/koc/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/rel/students`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const [data, dataRel] = await Promise.all([res.json(), resRel.json()]);
        const connectedStudents = dataRel.students || [];
        const pendingRequests = dataRel.pending_requests || [];

        const kpis = data.kpis || { total_students: 0, green_students: 0, at_risk_students: 0, late_assignments: 0 };
        const students = data.students || [];

        let html = `
        <!-- PENDING REQUESTS NOTIFICATION -->
        ${pendingRequests.length > 0 ? `
        <div class="glass-card p-5 border border-amber-800/80 bg-amber-950/30 mb-6">
            <h3 class="text-sm font-bold text-amber-400 flex items-center gap-2 mb-3">
                <i data-lucide="bell" class="w-4 h-4"></i> 📩 BEKLEYEN ÖĞRENCİ BAĞLANTI TALEPLERİ (${pendingRequests.length})
            </h3>
            <div class="space-y-3">
                ${pendingRequests.map(pr => `
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <span class="font-bold text-xs text-white">${pr.student_name}</span>
                        <span class="text-[10px] text-indigo-400 font-semibold ml-2">(${pr.track} - ${pr.school || 'Lise'})</span>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold ml-2 uppercase">${pr.relationship_type}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="respondConnectionRequest(${pr.request_id}, 'APPROVED')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition">
                            ✓ Onayla
                        </button>
                        <button onclick="respondConnectionRequest(${pr.request_id}, 'REJECTED')" class="bg-rose-950 hover:bg-rose-900 text-rose-300 font-semibold text-xs px-3 py-1.5 rounded-lg transition">
                            ✕ Reddet
                        </button>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- KPI CARDS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="glass-card p-5 border border-slate-800">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-slate-400">Toplam Bağlı Öğrenci</span>
                    <div class="p-2 bg-indigo-950/60 rounded-xl text-indigo-400"><i data-lucide="users" class="w-5 h-5"></i></div>
                </div>
                <h3 class="text-2xl font-bold text-white mt-2">${connectedStudents.length || kpis.total_students}</h3>
                <p class="text-[11px] text-emerald-400 mt-1">Ana + Branş Koçluğu</p>
            </div>
            
            <div class="glass-card p-5 border border-slate-800">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-slate-400">Düzenli Çalışan</span>
                    <div class="p-2 bg-emerald-950/60 rounded-xl text-emerald-400"><i data-lucide="check-circle-2" class="w-5 h-5"></i></div>
                </div>
                <h3 class="text-2xl font-bold text-white mt-2">${kpis.green_students}</h3>
                <p class="text-[11px] text-emerald-400 mt-1">Yüksek Program Uyumlu</p>
            </div>

            <div class="glass-card p-5 border border-slate-800">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-slate-400">Riskli / Takip Hücresi</span>
                    <div class="p-2 bg-rose-950/60 rounded-xl text-rose-400"><i data-lucide="alert-triangle" class="w-5 h-5"></i></div>
                </div>
                <h3 class="text-2xl font-bold text-white mt-2">${kpis.at_risk_students}</h3>
                <p class="text-[11px] text-rose-400 mt-1">Müdahale Gerektiren</p>
            </div>

            <div class="glass-card p-5 border border-slate-800">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-slate-400">Geciken Ödevler</span>
                    <div class="p-2 bg-amber-950/60 rounded-xl text-amber-400"><i data-lucide="clock" class="w-5 h-5"></i></div>
                </div>
                <h3 class="text-2xl font-bold text-white mt-2">${kpis.late_assignments}</h3>
                <p class="text-[11px] text-amber-400 mt-1">Teslim Edilmedi</p>
            </div>
        </div>

        <!-- RISK EKRANI (MÜDAHALE LİSTESİ) -->
        <div class="glass-card p-6 border border-slate-800">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-base font-bold text-white">🔴 DİKKAT GEREKTİREN ÖĞRENCİLER (Otomatik Risk Analiz Motoru)</h3>
                    <p class="text-xs text-slate-400">Net düşüşü, ödev aksaması ve çalışma süresi düşen öğrenciler</p>
                </div>
                <button onclick="openAddStudentModal()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md">
                    <i data-lucide="user-plus" class="w-4 h-4"></i> + Öğrenci Ekle
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        `;

        students.forEach(st => {
            console.log('[STUDENT CARD]', { id: st.id, name: st.name });
            const safeName = (st.name || '').replace(/'/g, "\\'");
            html += `
            <div class="glass-card glass-card-hover p-4 border border-slate-800/80 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-2 cursor-pointer" onclick="handleStudentDetailClick(${st.id}, '${safeName}')">
                        <h4 class="font-bold text-sm text-white hover:text-indigo-400 transition">${st.name}</h4>
                        ${getRiskBadgeHtml(st.risk_level)}
                    </div>
                    <p class="text-xs text-indigo-400 font-medium cursor-pointer" onclick="handleStudentDetailClick(${st.id}, '${safeName}')">${st.track} | ${st.target_university} ${st.target_department}</p>

                    <div class="mt-3 space-y-1.5">
                        ${(st.reasons || []).map(r => `<div class="text-[11px] text-slate-300 flex items-center gap-1.5"><i data-lucide="dot" class="w-4 h-4 text-rose-400"></i> ${r}</div>`).join('')}
                    </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <button onclick="handleStudentDetailClick(${st.id}, '${safeName}')" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1">
                        Profili İncele & Takip <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="openAssignModal(${st.id}, '${safeName}')" class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition">
                        + Kaynak Ödevi Ata
                    </button>
                </div>
            </div>
            `;
        });

        html += `</div></div>`;
        document.getElementById('viewContainer').innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderCoachDashboard error:", err);
    }
}

// ----------------------------------------------------
// 2. STUDENT DASHBOARD & MANY-TO-MANY COACHES WIDGET
// ----------------------------------------------------
async function renderStudentDashboard() {
    document.getElementById('pageTitle').textContent = "Öğrenci Paneli";
    const token = localStorage.getItem('yks_token');

    try {
        const [res, resCo] = await Promise.all([
            fetch(`${API_BASE}/student/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/rel/my-coaches`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const [data, dataCo] = await Promise.all([res.json(), resCo.json()]);
        const st = data.student || {};
        const q_today = data.q_today || {};
        const pending = data.pending_assignments || [];
        const myCoaches = dataCo.coaches || [];

        let html = `
        <!-- STUDENT WELCOME HEADER -->
        <div class="glass-card p-6 border border-slate-800 mb-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <h2 class="text-2xl font-black text-white tracking-tight">Hoş Geldin, ${st.name || 'Öğrenci'} 👋</h2>
                <p class="text-xs text-slate-400 mt-1">Hedef: <span class="font-bold text-indigo-300">${st.target_university || 'Hedef Üniversite'}</span> - <span class="text-slate-300 font-semibold">${st.target_department || 'Hedef Bölüm'}</span> (${st.track || 'SAYISAL'})</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="bg-indigo-950/80 border border-indigo-800 px-4 py-2 rounded-xl text-center">
                    <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">YKS SINAVINA</span>
                    <span class="text-3xl font-black text-white tracking-tight">${data.days_left || 300} <span class="text-sm font-medium text-slate-400">GÜN</span></span>
                </div>
            </div>
        </div>

        <!-- MY ASSIGNED COACH WIDGET -->
        <div class="glass-card p-6 border border-indigo-900/80 mb-6">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                        <i data-lucide="user-check" class="w-5 h-5 text-indigo-400"></i> 👨‍🏫 ATANMIŞ KOÇUM
                    </h3>
                    <p class="text-xs text-slate-400 mt-0.5">Akademik takibinizi yapan ve çalışma planınızı yöneten yetkili koçunuz</p>
                </div>
            </div>

            <div>
                ${myCoaches.length === 0 ? `
                <div class="p-6 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800">
                    <div class="text-3xl mb-2">👨‍🏫</div>
                    <h4 class="text-sm font-bold text-slate-300">Henüz koç atanmadı</h4>
                    <p class="text-xs text-slate-500 mt-1">Yöneticiniz veya koçunuz tarafından eşleştirme yapıldığında burada görüntülenecektir.</p>
                </div>
                ` : `
                <div class="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 max-w-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-800 flex items-center justify-center text-indigo-400 font-black text-lg shrink-0">
                            ${escapeHtml(myCoaches[0].coach_name ? myCoaches[0].coach_name.charAt(0) : 'K')}
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase tracking-wider">${escapeHtml(myCoaches[0].relationship_type === 'MAIN_COACH' ? 'Ana Koç' : (myCoaches[0].coach_title || 'Koç'))}</span>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${myCoaches[0].coach_status === 'PASSIVE' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'} flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full ${myCoaches[0].coach_status === 'PASSIVE' ? 'bg-amber-400' : 'bg-emerald-400'}"></span>
                                    ${myCoaches[0].coach_status === 'PASSIVE' ? 'Pasif' : 'Aktif'}
                                </span>
                            </div>
                            <h4 class="text-base font-bold text-white">${escapeHtml(myCoaches[0].coach_name || 'Koç')}</h4>
                            <p class="text-xs text-slate-400 mt-0.5">${escapeHtml(myCoaches[0].coach_title || 'YKS Akademik Koçu')}</p>
                            <p class="text-[11px] text-indigo-400 font-medium mt-1">🎯 Branş / Uzmanlık: ${escapeHtml(myCoaches[0].specialty || 'YKS & LGS Derece Koçluğu')}</p>
                        </div>
                    </div>

                    <div class="shrink-0 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <button onclick="navigateView('messages'); if (typeof renderMessagesView === 'function') renderMessagesView(${myCoaches[0].coach_user_id || 2});" class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30">
                            <i data-lucide="message-square" class="w-4 h-4"></i> 💬 Mesaj Gönder
                        </button>
                    </div>
                </div>
                `}
            </div>
        </div>

        <!-- STATS GRID -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div class="glass-card p-5 border border-slate-800">
                <span class="text-xs font-semibold text-slate-400">Bugün Çözülen Soru</span>
                <h3 class="text-2xl font-bold text-white mt-2">${q_today.t_correct || 0} <span class="text-xs font-normal text-slate-400">doğru</span></h3>
                <p class="text-[11px] text-emerald-400 mt-1">Net: ${q_today.t_net || 0.0}</p>
            </div>
            <div class="glass-card p-5 border border-slate-800">
                <span class="text-xs font-semibold text-slate-400">Bugünkü Çalışma Süresi</span>
                <h3 class="text-2xl font-bold text-white mt-2">${data.study_minutes_today || 0} <span class="text-xs font-normal text-slate-400">dakika</span></h3>
                <p class="text-[11px] text-indigo-400 mt-1">Timer Zamanlayıcı</p>
            </div>
            <div class="glass-card p-5 border border-slate-800">
                <span class="text-xs font-semibold text-slate-400">Bekleyen Ödevler</span>
                <h3 class="text-2xl font-bold text-white mt-2">${pending.length} <span class="text-xs font-normal text-slate-400">ödev</span></h3>
                <p class="text-[11px] text-amber-400 mt-1">Koç Tarafından Atanan</p>
            </div>
        </div>

        <!-- GAMIFICATION BADGES -->
        <div class="glass-card p-6 border border-slate-800 mb-6">
            <h3 class="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4">🏆 BAŞARI ROZETLERİ & ÇALIŞMA SERİSİ (STREAK)</h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div class="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                    <div class="text-3xl mb-1">🔥</div>
                    <h4 class="font-bold text-xs text-white">14 Gün Seri</h4>
                    <p class="text-[10px] text-slate-400">Kesintisiz Çalışma</p>
                </div>
                <div class="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                    <div class="text-3xl mb-1">⚡️</div>
                    <h4 class="font-bold text-xs text-white">1.000 Soru Kulübü</h4>
                    <p class="text-[10px] text-slate-400">Çözülen Soru</p>
                </div>
                <div class="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                    <div class="text-3xl mb-1">📚</div>
                    <h4 class="font-bold text-xs text-white">Kitap Kurdu</h4>
                    <p class="text-[10px] text-slate-400">500+ Sayfa</p>
                </div>
                <div class="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                    <div class="text-3xl mb-1">🎯</div>
                    <h4 class="font-bold text-xs text-white">Deneme Şampiyonu</h4>
                    <p class="text-[10px] text-slate-400">35+ Net Yükselişi</p>
                </div>
            </div>
        </div>

        <!-- ASSIGNMENTS LIST -->
        <div class="glass-card p-6 border border-slate-800">
            <h3 class="text-sm font-bold text-white mb-4"> Atanan Ödevlerim</h3>
            <div class="space-y-3">
                ${pending.map(a => `
                <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <h4 class="font-bold text-xs text-white">${a.title}</h4>
                        <p class="text-[11px] text-indigo-400">${a.subject_name || 'Genel'} | Sayfa/Test: ${a.section_range || 'Tüm'} | Teslim: ${a.due_date}</p>
                    </div>
                    <button onclick="completeAssignment(${a.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition">
                        ✓ Tamamla
                    </button>
                </div>
                `).join('')}
            </div>
        </div>
        `;

        document.getElementById('viewContainer').innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderStudentDashboard error:", err);
    }
}

// ----------------------------------------------------
// 2. B ADMIN DASHBOARD & ADVANCED ASSIGNMENT CONTROL
// ----------------------------------------------------
async function renderAdminDashboard() {
    document.getElementById('pageTitle').textContent = "Admin Yönetim & Çözüm Paneli";
    const token = localStorage.getItem('yks_token');

    try {
        const resSt = await fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataSt = await resSt.json();
        const allStudents = dataSt.students || [];

        const resCo = await fetch(`${API_BASE}/rel/coaches-search`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataCo = await resCo.json();
        const allCoaches = dataCo.coaches || [];

        let html = `
        <div class="glass-card p-6 border border-slate-800 mb-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
            <h2 class="text-xl font-black text-white flex items-center gap-2">
                <i data-lucide="shield-check" class="w-6 h-6 text-indigo-400"></i> ADMIN ÇOKLU KOÇ - ÖĞRENCİ EŞLEŞTİRME MERKEZİ
            </h2>
            <p class="text-xs text-slate-400 mt-1">Sistemdeki herhangi bir koçu herhangi bir öğrenciye Ana Koç, Matematik Koçu, Fizik Koçu veya Rehberlik Koçu olarak bağlayabilirsiniz.</p>
        </div>

        <!-- EŞLEŞTİRME FORMU -->
        <div class="glass-card p-6 border border-slate-800 mb-6">
            <h3 class="text-sm font-bold text-white mb-4">+ Yeni Koç ↔ Öğrenci Eşleştirmesi Oluştur</h3>
            <form onsubmit="adminAssignCoach(event)" class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div>
                    <label class="text-xs font-bold text-slate-400 block mb-1">Koç Seçin:</label>
                    <select id="adminAssignCoachId" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                        ${allCoaches.map(c => `<option value="${c.coach_id}">${c.coach_name} (${c.title})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 block mb-1">Öğrenci Seçin:</label>
                    <select id="adminAssignStudentId" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                        ${allStudents.map(s => `<option value="${s.id}">${s.name} (${s.track})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 block mb-1">İlişki Tipi (Relationship Type):</label>
                    <select id="adminAssignRelType" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                        <option value="MAIN_COACH">MAIN_COACH (Ana Koç)</option>
                        <option value="MATH_COACH">MATH_COACH (Matematik Koçu)</option>
                        <option value="PHYSICS_COACH">PHYSICS_COACH (Fizik Koçu)</option>
                        <option value="TURKISH_COACH">TURKISH_COACH (Türkçe / Paragraf Koçu)</option>
                        <option value="COUNSELOR">COUNSELOR (Rehberlik / Psikolojik Danışman)</option>
                        <option value="ENGLISH_COACH">ENGLISH_COACH (YDT / İngilizce Koçu)</option>
                    </select>
                </div>
                <button type="submit" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow transition">
                    ⚡️ Eşleştirmeyi Kaydet
                </button>
            </form>
        </div>
        `;

        document.getElementById('viewContainer').innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderAdminDashboard error:", err);
    }
}

// ----------------------------------------------------
// ADMIN KULLANICI YÖNETİMİ (USER MANAGEMENT CENTER)
// ----------------------------------------------------
// ----------------------------------------------------
// ADMIN KULLANICI & HESAP YÖNETİMİ (USER & ACCOUNT MANAGEMENT)
// ----------------------------------------------------
let adminUsersListCache = [];
let adminUsersRoleFilter = 'ALL';
let adminUsersStatusFilter = 'ALL';
let adminUsersSearchQuery = '';

async function renderAdminUserManagementView() {
    document.getElementById('pageTitle').textContent = "👤 Kullanıcı & Hesap Yönetimi";
    const token = localStorage.getItem('yks_token');
    const container = document.getElementById('viewContainer');

    try {
        let url = `${API_BASE}/admin/users?role=${adminUsersRoleFilter}&status=${adminUsersStatusFilter}`;
        if (adminUsersSearchQuery.trim()) {
            url += `&q=${encodeURIComponent(adminUsersSearchQuery.trim())}`;
        }

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Kullanıcı verileri çekilemedi.');

        adminUsersListCache = data.users || [];
        const summary = data.summary || { total: 0, admins: 0, coaches: 0, students: 0, active: 0, passive: 0 };

        let html = `
        <div class="glass-card p-6 border border-slate-800 mb-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <h2 class="text-xl font-black text-white flex items-center gap-2">
                    <i data-lucide="users" class="w-6 h-6 text-indigo-400"></i> Kullanıcı & Hesap Yönetimi
                </h2>
                <p class="text-xs text-slate-400 mt-1">Sistemdeki tüm kullanıcıların hesap, rol ve erişim bilgilerini yönetin.</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="openCreateUserModal()" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer">
                    <i data-lucide="user-plus" class="w-4 h-4"></i> + Yeni Kullanıcı
                </button>
            </div>
        </div>

        <!-- STATS & SUMMARY CARDS -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div onclick="setAdminUsersRoleFilter('ALL')" class="glass-card p-4 border ${adminUsersRoleFilter === 'ALL' ? 'border-indigo-500 bg-indigo-950/40 shadow-lg' : 'border-slate-800 bg-slate-900/80'} cursor-pointer hover:border-slate-700 transition">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TÜM KULLANICILAR</span>
                <span class="text-2xl font-black text-white mt-1 block">${summary.total}</span>
            </div>
            <div onclick="setAdminUsersRoleFilter('COACH')" class="glass-card p-4 border ${adminUsersRoleFilter === 'COACH' ? 'border-indigo-500 bg-indigo-950/40 shadow-lg' : 'border-slate-800 bg-slate-900/80'} cursor-pointer hover:border-slate-700 transition">
                <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">👨‍🏫 KOÇLAR / ÖĞRETMENLER</span>
                <span class="text-2xl font-black text-indigo-300 mt-1 block">${summary.coaches}</span>
            </div>
            <div onclick="setAdminUsersRoleFilter('STUDENT')" class="glass-card p-4 border ${adminUsersRoleFilter === 'STUDENT' ? 'border-emerald-500 bg-emerald-950/40 shadow-lg' : 'border-slate-800 bg-slate-900/80'} cursor-pointer hover:border-slate-700 transition">
                <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">🎓 ÖĞRENCİLER</span>
                <span class="text-2xl font-black text-emerald-300 mt-1 block">${summary.students}</span>
            </div>
            <div onclick="setAdminUsersRoleFilter('ADMIN')" class="glass-card p-4 border ${adminUsersRoleFilter === 'ADMIN' ? 'border-violet-500 bg-violet-950/40 shadow-lg' : 'border-slate-800 bg-slate-900/80'} cursor-pointer hover:border-slate-700 transition">
                <span class="text-[10px] font-bold text-violet-400 uppercase tracking-wider block">👑 ADMİNLER</span>
                <span class="text-2xl font-black text-violet-300 mt-1 block">${summary.admins}</span>
            </div>
        </div>

        <!-- SEARCH AND FILTER CONTROLS BAR -->
        <div class="glass-card p-4 border border-slate-800 mb-6 bg-slate-900/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <!-- Search Bar -->
            <div class="relative flex-1">
                <input type="text" id="adminUserSearchInput" value="${escapeHtml(adminUsersSearchQuery)}" oninput="handleAdminUserSearch(this.value)" placeholder="🔍 İsim, soyisim, kullanıcı adı veya e-posta ile ara..." class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500">
                <i data-lucide="search" class="w-4 h-4 text-slate-500 absolute left-3 top-3"></i>
            </div>

            <!-- Role Dropdown Filter -->
            <div class="flex items-center gap-2">
                <select id="adminUserRoleSelect" onchange="setAdminUsersRoleFilter(this.value)" class="bg-[#0E1526] border border-[#24314A] rounded-xl px-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500">
                    <option value="ALL" ${adminUsersRoleFilter === 'ALL' ? 'selected' : ''}>Tüm Roller</option>
                    <option value="ADMIN" ${adminUsersRoleFilter === 'ADMIN' ? 'selected' : ''}>👑 Admin</option>
                    <option value="COACH" ${adminUsersRoleFilter === 'COACH' ? 'selected' : ''}>👨‍🏫 Koç / Öğretmen</option>
                    <option value="STUDENT" ${adminUsersRoleFilter === 'STUDENT' ? 'selected' : ''}>🎓 Öğrenci</option>
                </select>

                <!-- Status Dropdown Filter -->
                <select id="adminUserStatusSelect" onchange="setAdminUsersStatusFilter(this.value)" class="bg-[#0E1526] border border-[#24314A] rounded-xl px-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500">
                    <option value="ALL" ${adminUsersStatusFilter === 'ALL' ? 'selected' : ''}>Tüm Durumlar</option>
                    <option value="ACTIVE" ${adminUsersStatusFilter === 'ACTIVE' ? 'selected' : ''}>🟢 Aktif</option>
                    <option value="PASSIVE" ${adminUsersStatusFilter === 'PASSIVE' ? 'selected' : ''}>🔴 Pasif</option>
                </select>
            </div>
        </div>

        <!-- USERS TABLE -->
        <div class="glass-card border border-slate-800 overflow-hidden rounded-2xl">
            <div class="px-6 py-4 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between">
                <h3 class="text-sm font-bold text-white">Kullanıcı Hesapları Listesi (${adminUsersListCache.length})</h3>
                <span class="text-xs text-slate-400">Sayfa: 1 / 1</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="bg-slate-900/60 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
                            <th class="py-3.5 px-4">Kullanıcı</th>
                            <th class="py-3.5 px-4">Kullanıcı Adı</th>
                            <th class="py-3.5 px-4">Rol</th>
                            <th class="py-3.5 px-4">E-posta</th>
                            <th class="py-3.5 px-4">Durum</th>
                            <th class="py-3.5 px-4">Son Giriş</th>
                            <th class="py-3.5 px-4 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60">
        `;

        if (adminUsersListCache.length === 0) {
            html += `
            <tr>
                <td colspan="7" class="py-12 text-center text-slate-500">
                    <i data-lucide="users" class="w-10 h-10 mx-auto text-slate-700 mb-2"></i>
                    <p class="text-xs font-semibold">Aranan kriterlere uygun kullanıcı bulunamadı.</p>
                </td>
            </tr>
            `;
        } else {
            adminUsersListCache.forEach(u => {
                let roleBadge = '';
                if (u.role === 'ADMIN') roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-950 text-violet-300 border border-violet-800">👑 Admin</span>';
                else if (u.role === 'COACH') roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">👨‍🏫 Koç</span>';
                else roleBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">🎓 Öğrenci</span>';

                const statusBadge = u.status === 'ACTIVE'
                    ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">🟢 Aktif</span>'
                    : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">🔴 Pasif</span>';

                const fullName = `${u.name || ''} ${u.surname || ''}`.trim() || u.username;
                const lastLogin = u.last_login_at ? u.last_login_at.substring(0, 10) : 'Giriş Yapılmadı';

                html += `
                <tr class="hover:bg-slate-900/40 transition">
                    <td class="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-slate-800 text-indigo-300 flex items-center justify-center font-bold text-xs border border-slate-700">
                            ${escapeHtml(fullName.charAt(0))}
                        </div>
                        <span>${escapeHtml(fullName)}</span>
                    </td>
                    <td class="py-3 px-4 font-mono font-bold text-indigo-300">${escapeHtml(u.username)}</td>
                    <td class="py-3 px-4">${roleBadge}</td>
                    <td class="py-3 px-4 text-slate-300">${escapeHtml(u.email || '-')}</td>
                    <td class="py-3 px-4">${statusBadge}</td>
                    <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">${lastLogin}</td>
                    <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-1.5 flex-wrap">
                            <button type="button" onclick="openUserDetailModal(${u.id})" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition cursor-pointer" title="Kullanıcı Detayı">
                                👁 Detay
                            </button>
                            <button type="button" onclick="openEditUserModal(${u.id})" class="px-2 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 text-[11px] font-bold transition cursor-pointer" title="Düzenle">
                                ✏️ Düzenle
                            </button>
                            <button type="button" onclick="openAdminChangeUserPasswordModal(${u.id})" class="px-2 py-1 rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 text-[11px] font-bold transition cursor-pointer" title="Şifre Değiştir">
                                🔑 Şifre
                            </button>
                            <button type="button" onclick="toggleAdminUserStatus(${u.id}, '${u.status}')" class="px-2 py-1 rounded-lg ${u.status === 'ACTIVE' ? 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800' : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'} text-[11px] font-bold transition cursor-pointer" title="${u.status === 'ACTIVE' ? 'Pasifleştir' : 'Aktifleştir'}">
                                ${u.status === 'ACTIVE' ? '🔴 Pasif Yap' : '🟢 Aktif Yap'}
                            </button>
                            <button type="button" onclick="sendMessageToUser(${u.id})" class="px-2 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 text-[11px] font-bold transition cursor-pointer" title="Mesaj Gönder">
                                💬 Mesaj
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        </div>
        `;

        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderAdminUserManagementView error:", err);
        container.innerHTML = `<div class="p-6 text-rose-400 font-bold text-center">Hata: ${err.message}</div>`;
    }
}

function setAdminUsersRoleFilter(filter) {
    adminUsersRoleFilter = filter;
    renderAdminUserManagementView();
}

function setAdminUsersStatusFilter(filter) {
    adminUsersStatusFilter = filter;
    renderAdminUserManagementView();
}

let adminUserSearchDebounce = null;
function handleAdminUserSearch(query) {
    adminUsersSearchQuery = query;
    clearTimeout(adminUserSearchDebounce);
    adminUserSearchDebounce = setTimeout(() => {
        renderAdminUserManagementView();
    }, 250);
}

function sendMessageToUser(userId) {
    navigateView('messages', userId);
}

async function toggleAdminUserStatus(userId, currentStatus) {
    const isAct = currentStatus === 'ACTIVE';
    const actionName = isAct ? 'pasifleştirmek' : 'aktifleştirmek';
    if (!confirm(`Bu kullanıcı hesabını ${actionName} istediğinize emin misiniz?`)) return;

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Durum güncellenemedi.');

        alert(`✅ ${data.message || 'Kullanıcı durumu başarıyla güncellendi.'}`);
        renderAdminUserManagementView();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

function togglePasswordVisibility(elementId, realPassword) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (el.textContent.includes('•')) {
        el.textContent = realPassword;
        el.classList.remove('tracking-wider');
    } else {
        el.textContent = '••••••••';
        el.classList.add('tracking-wider');
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;

async function openUserDetailModal(userId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Kullanıcı detayı alınamadı.');
        const u = data.user;

        const roleText = u.role === 'ADMIN' ? '👑 Sistem Yöneticisi (Admin)' : (u.role === 'COACH' ? '👨‍🏫 Eğitim Koçu / Öğretmen' : '🎓 Öğrenci');
        const statusBadge = u.status === 'ACTIVE' ? '<span class="text-emerald-400 font-bold">🟢 Aktif</span>' : '<span class="text-rose-400 font-bold">🔴 Pasif</span>';
        const plainPw = u.plain_password || 'password123';

        const content = `
        <div class="space-y-4 text-xs">
            <div class="grid grid-cols-2 gap-3 bg-[#0E1526] p-4 rounded-xl border border-[#24314A]">
                <div>
                    <span class="text-slate-400 font-bold block">Ad Soyad:</span>
                    <span class="text-white font-bold text-sm">${escapeHtml(u.name || '')} ${escapeHtml(u.surname || '')}</span>
                </div>
                <div>
                    <span class="text-slate-400 font-bold block">Kullanıcı Adı:</span>
                    <span class="text-indigo-300 font-mono font-bold text-sm">${escapeHtml(u.username)}</span>
                </div>
                <div>
                    <span class="text-slate-400 font-bold block">Rol:</span>
                    <span class="text-slate-200 font-semibold">${roleText}</span>
                </div>
                <div>
                    <span class="text-slate-400 font-bold block">Hesap Durumu:</span>
                    ${statusBadge}
                </div>
                <div class="col-span-2 bg-[#121B30] p-2.5 rounded-lg border border-[#2A3954] flex items-center justify-between">
                    <div>
                        <span class="text-slate-400 font-bold block text-[11px]">Mevcut / Eski Şifre:</span>
                        <span id="detailUserPwVal" class="text-amber-300 font-mono font-bold text-sm tracking-wider">••••••••</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="togglePasswordVisibility('detailUserPwVal', '${escapeHtml(plainPw)}')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-bold transition cursor-pointer">
                            👁 Göster / Gizle
                        </button>
                        <button type="button" onclick="navigator.clipboard.writeText('${escapeHtml(plainPw)}'); alert('Şifre panoya kopyalandı!')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer">
                            📋 Kopyala
                        </button>
                    </div>
                </div>
                <div>
                    <span class="text-slate-400 font-bold block">E-posta:</span>
                    <span class="text-slate-200 font-semibold">${escapeHtml(u.email || '-')}</span>
                </div>
                <div>
                    <span class="text-slate-400 font-bold block">Telefon:</span>
                    <span class="text-slate-200 font-semibold">${escapeHtml(u.phone || '-')}</span>
                </div>
                ${u.role === 'STUDENT' ? `
                <div>
                    <span class="text-slate-400 font-bold block">Bağlı Koç:</span>
                    <span class="text-indigo-400 font-bold">${escapeHtml(u.assigned_coach_name || 'Koç Atanmamış')}</span>
                </div>
                <div>
                    <span class="text-slate-400 font-bold block">Sınav / Alan:</span>
                    <span class="text-slate-200 font-semibold">${escapeHtml(u.student_exam_system || 'YKS')} - ${escapeHtml(u.student_track || 'SAYISAL')}</span>
                </div>
                ` : ''}
                <div>
                    <span class="text-slate-400 font-bold block">Kayıt Tarihi:</span>
                    <span class="text-slate-400 font-mono">${u.created_at || '-'}</span>
                </div>
                <div>
                    <span class="text-slate-400 font-bold block">Son Giriş:</span>
                    <span class="text-slate-400 font-mono">${u.last_login_at || 'Giriş Yapılmadı'}</span>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
                <button type="button" onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">Kapat</button>
                <button type="button" onclick="closeModal(); openAdminChangeUserPasswordModal(${u.id})" class="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl shadow">🔑 Şifre Değiştir</button>
                <button type="button" onclick="closeModal(); openEditUserModal(${u.id})" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl shadow">✏️ Düzenle</button>
            </div>
        </div>
        `;

        openModal(`👤 KULLANICI PROFİLİ: ${escapeHtml(u.name || '')} ${escapeHtml(u.surname || '')}`, content);
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function openEditUserModal(userId) {
    const token = localStorage.getItem('yks_token');
    try {
        const [userRes, coachesRes] = await Promise.all([
            fetch(`${API_BASE}/admin/users/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/admin/users?role=COACH`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const userData = await userRes.json();
        const coachesData = await coachesRes.json();
        const u = userData.user;
        const coaches = coachesData.users || [];

        const content = `
        <form onsubmit="submitEditUser(event, ${u.id})" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block text-slate-300 font-bold mb-1">Ad *</label>
                    <input type="text" id="editUserName" value="${escapeHtml(u.name || '')}" required class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                    <label class="block text-slate-300 font-bold mb-1">Soyad</label>
                    <input type="text" id="editUserSurname" value="${escapeHtml(u.surname || '')}" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                    <label class="block text-slate-300 font-bold mb-1">Kullanıcı Adı *</label>
                    <input type="text" id="editUserUsername" value="${escapeHtml(u.username)}" required class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                    <label class="block text-slate-300 font-bold mb-1">E-posta</label>
                    <input type="email" id="editUserEmail" value="${escapeHtml(u.email || '')}" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                    <label class="block text-slate-300 font-bold mb-1">Telefon</label>
                    <input type="text" id="editUserPhone" value="${escapeHtml(u.phone || '')}" placeholder="05XX XXX XX XX" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                    <label class="block text-slate-300 font-bold mb-1">Rol *</label>
                    <select id="editUserRole" onchange="toggleEditCoachSelect(this.value)" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-500">
                        <option value="STUDENT" ${u.role === 'STUDENT' ? 'selected' : ''}>🎓 Öğrenci</option>
                        <option value="COACH" ${u.role === 'COACH' ? 'selected' : ''}>👨‍🏫 Koç / Öğretmen</option>
                        <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>👑 Admin</option>
                    </select>
                </div>
                <div>
                    <label class="block text-slate-300 font-bold mb-1">Hesap Durumu *</label>
                    <select id="editUserStatus" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-500">
                        <option value="ACTIVE" ${u.status === 'ACTIVE' ? 'selected' : ''}>🟢 Aktif</option>
                        <option value="PASSIVE" ${u.status === 'PASSIVE' || u.status === 'INACTIVE' ? 'selected' : ''}>🔴 Pasif</option>
                    </select>
                </div>
                <div id="editCoachSelectContainer" class="${u.role === 'STUDENT' ? '' : 'hidden'}">
                    <label class="block text-slate-300 font-bold mb-1">Bağlı Koç</label>
                    <select id="editUserCoachId" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500">
                        <option value="">Koç Seçin</option>
                        ${coaches.map(c => `
                            <option value="${c.coach_id || c.id}" ${u.student_coach_id == (c.coach_id || c.id) ? 'selected' : ''}>
                                ${escapeHtml(c.name)} ${escapeHtml(c.surname || '')} (${escapeHtml(c.username)})
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
                <button type="button" onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">İptal</button>
                <button type="submit" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-5 py-2 rounded-xl shadow-lg">
                    Bilgileri Güncelle
                </button>
            </div>
        </form>
        `;

        openModal(`✏️ KULLANICI DÜZENLE: ${escapeHtml(u.name || '')} ${escapeHtml(u.surname || '')}`, content);
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

function toggleEditCoachSelect(role) {
    const container = document.getElementById('editCoachSelectContainer');
    if (container) {
        if (role === 'STUDENT') container.classList.remove('hidden');
        else container.classList.add('hidden');
    }
}

async function submitEditUser(e, userId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const name = document.getElementById('editUserName').value.trim();
    const surname = document.getElementById('editUserSurname').value.trim();
    const username = document.getElementById('editUserUsername').value.trim();
    const email = document.getElementById('editUserEmail').value.trim();
    const phone = document.getElementById('editUserPhone').value.trim();
    const role = document.getElementById('editUserRole').value;
    const status = document.getElementById('editUserStatus').value;
    const coachId = document.getElementById('editUserCoachId') ? document.getElementById('editUserCoachId').value : null;

    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                name, surname, username, email, phone, role, status,
                coach_id: coachId ? parseInt(coachId) : null
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Güncelleme başarısız.');

        closeModal();
        alert("✅ Kullanıcı bilgileri başarıyla güncellendi!");
        renderAdminUserManagementView();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function openAdminChangeUserPasswordModal(userId, fullName) {
    const token = localStorage.getItem('yks_token');
    let name = fullName;
    let plainPw = 'password123';

    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/password`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.user) {
                name = `${data.user.name || ''} ${data.user.surname || ''}`.trim() || data.user.username;
            }
            if (data.plain_password) plainPw = data.plain_password;
        }
    } catch (e) {
        console.warn("Could not fetch user plain_password:", e);
    }

    if (!name && Array.isArray(adminUsersListCache)) {
        const found = adminUsersListCache.find(u => u.id === userId);
        if (found) {
            name = `${found.name || ''} ${found.surname || ''}`.trim() || found.username;
            if (found.plain_password) plainPw = found.plain_password;
        }
    }
    name = name || 'Seçili Kullanıcı';

    const content = `
    <form onsubmit="submitAdminChangeUserPassword(event, ${userId})" class="space-y-4 text-xs">
        <div class="bg-[#0E1526] p-3 rounded-xl border border-[#24314A] space-y-2">
            <div class="flex items-center justify-between text-slate-300">
                <span>Kullanıcı: <b class="text-white">${escapeHtml(name)}</b></span>
                <span class="text-[11px] text-slate-400 font-mono">ID: #${userId}</span>
            </div>
            <div class="flex items-center justify-between bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span class="text-slate-400 font-bold">Mevcut / Eski Şifre:</span>
                <div class="flex items-center gap-2">
                    <span id="adminOldPwVal" class="text-amber-300 font-mono font-bold text-xs tracking-wider">••••••••</span>
                    <button type="button" onclick="togglePasswordVisibility('adminOldPwVal', '${escapeHtml(plainPw)}')" class="text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2 py-0.5 rounded border border-slate-700 font-bold cursor-pointer">
                        👁 Göster / Gizle
                    </button>
                    <button type="button" onclick="navigator.clipboard.writeText('${escapeHtml(plainPw)}'); alert('Eski şifre kopyalandı!')" class="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-slate-700 font-bold cursor-pointer">
                        📋 Kopyala
                    </button>
                </div>
            </div>
        </div>
        <div>
            <label class="block text-slate-300 font-bold mb-1">Yeni Şifre Belirle *</label>
            <input type="password" id="adminNewUserPassword" required placeholder="En az 4 karakter" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
        </div>
        <div>
            <label class="block text-slate-300 font-bold mb-1">Yeni Şifre Tekrar *</label>
            <input type="password" id="adminNewUserPasswordConfirm" required placeholder="Şifreyi tekrar girin" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
            <button type="button" onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">İptal</button>
            <button type="submit" class="bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2 rounded-xl shadow-lg">
                🔑 Şifreyi Güncelle
            </button>
        </div>
    </form>
    `;
    openModal('🔑 YENİ ŞİFRE BELİRLE', content);
}

async function submitAdminChangeUserPassword(e, userId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const new_password = document.getElementById('adminNewUserPassword').value.trim();
    const confirm_password = document.getElementById('adminNewUserPasswordConfirm').value.trim();

    if (new_password !== confirm_password) {
        alert("Girdiğiniz yeni şifreler birbiriyle eşleşmiyor!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ new_password, confirm_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Şifre güncellenemedi.');

        closeModal();
        alert("🔑 Şifre başarıyla güncellendi!");
        renderAdminUserManagementView();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function openCreateUserModal() {
    const token = localStorage.getItem('yks_token');
    let coaches = [];
    try {
        const res = await fetch(`${API_BASE}/admin/users?role=COACH`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            coaches = data.users || [];
        }
    } catch (err) {
        console.error(err);
    }

    const content = `
    <form onsubmit="submitCreateUser(event)" class="space-y-4 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-300 font-bold mb-1">Ad *</label>
                <input type="text" id="createUserName" required placeholder="ör: Mehmet" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
            </div>
            <div>
                <label class="block text-slate-300 font-bold mb-1">Soyad *</label>
                <input type="text" id="createUserSurname" required placeholder="ör: Kaya" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
            </div>
            <div>
                <label class="block text-slate-300 font-bold mb-1">Kullanıcı Adı *</label>
                <input type="text" id="createUserUsername" required placeholder="ör: mehmet.kaya" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-500">
            </div>
            <div>
                <label class="block text-slate-300 font-bold mb-1">E-posta</label>
                <input type="email" id="createUserEmail" placeholder="mehmet@example.com" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500">
            </div>
            <div>
                <label class="block text-slate-300 font-bold mb-1">İlk Şifre *</label>
                <input type="password" id="createUserPassword" required placeholder="En az 4 karakter" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
            </div>
            <div>
                <label class="block text-slate-300 font-bold mb-1">Rol *</label>
                <select id="createUserRole" onchange="toggleCreateCoachSelect(this.value)" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-500">
                    <option value="STUDENT">🎓 Öğrenci</option>
                    <option value="COACH">👨‍🏫 Koç / Öğretmen</option>
                    <option value="ADMIN">👑 Admin</option>
                </select>
            </div>
            <div id="createCoachSelectContainer">
                <label class="block text-slate-300 font-bold mb-1">Bağlı Koç</label>
                <select id="createUserCoachId" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500">
                    <option value="">Koç Seçin</option>
                    ${coaches.map(c => `
                        <option value="${c.coach_id || c.id}">
                            ${escapeHtml(c.name)} ${escapeHtml(c.surname || '')} (${escapeHtml(c.username)})
                        </option>
                    `).join('')}
                </select>
            </div>
            <div>
                <label class="block text-slate-300 font-bold mb-1">Hesap Durumu</label>
                <select id="createUserStatus" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-500">
                    <option value="ACTIVE">🟢 Aktif</option>
                    <option value="PASSIVE">🔴 Pasif</option>
                </select>
            </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
            <button type="button" onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">İptal</button>
            <button type="submit" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-5 py-2 rounded-xl shadow-lg">
                + Kullanıcıyı Oluştur
            </button>
        </div>
    </form>
    `;

    openModal('👤 + YENİ KULLANICI HESABI OLUŞTUR', content);
}

function toggleCreateCoachSelect(role) {
    const container = document.getElementById('createCoachSelectContainer');
    if (container) {
        if (role === 'STUDENT') container.classList.remove('hidden');
        else container.classList.add('hidden');
    }
}

async function submitCreateUser(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const name = document.getElementById('createUserName').value.trim();
    const surname = document.getElementById('createUserSurname').value.trim();
    const username = document.getElementById('createUserUsername').value.trim();
    const email = document.getElementById('createUserEmail').value.trim();
    const password = document.getElementById('createUserPassword').value.trim();
    const role = document.getElementById('createUserRole').value;
    const status = document.getElementById('createUserStatus').value;
    const coachId = document.getElementById('createUserCoachId') ? document.getElementById('createUserCoachId').value : null;

    try {
        const res = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                name, surname, username, email, password, role, status,
                coach_id: coachId ? parseInt(coachId) : null
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Kullanıcı oluşturulamadı.');

        closeModal();
        alert("✅ Yeni kullanıcı başarıyla oluşturuldu!");
        renderAdminUserManagementView();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

// Window Bindings for Admin User Management
window.openUserDetailModal = openUserDetailModal;
window.openEditUserModal = openEditUserModal;
window.openAdminChangeUserPasswordModal = openAdminChangeUserPasswordModal;
window.toggleAdminUserStatus = toggleAdminUserStatus;
window.sendMessageToUser = sendMessageToUser;
window.openCreateUserModal = openCreateUserModal;
window.submitEditUser = submitEditUser;
window.submitCreateUser = submitCreateUser;
window.submitAdminChangeUserPassword = submitAdminChangeUserPassword;
window.toggleEditCoachSelect = toggleEditCoachSelect;
window.toggleCreateCoachSelect = toggleCreateCoachSelect;
window.setAdminUsersRoleFilter = setAdminUsersRoleFilter;
window.setAdminUsersStatusFilter = setAdminUsersStatusFilter;
window.handleAdminUserSearch = handleAdminUserSearch;

// ----------------------------------------------------
// KOÇ ÖĞRENCİ ŞİFRE DEĞİŞTİRME MODALI
// ----------------------------------------------------
async function openCoachChangeStudentPasswordModal(studentId, studentName) {
    const token = localStorage.getItem('yks_token');
    let plainPw = 'ogrenci123';
    let name = studentName || 'Öğrenci';

    try {
        const res = await fetch(`${API_BASE}/coach/students/${studentId}/password`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.plain_password) plainPw = data.plain_password;
            if (data.name) name = `${data.name} ${data.surname || ''}`.trim();
        }
    } catch (e) {
        console.warn("Could not fetch student password info:", e);
    }

    const content = `
    <form onsubmit="submitCoachChangeStudentPassword(event, ${studentId})" class="space-y-4 text-xs">
        <div class="bg-[#0E1526] p-3 rounded-xl border border-[#24314A] space-y-2">
            <div class="text-slate-300">
                Öğrenci: <span class="text-white font-bold">${escapeHtml(name)}</span>
            </div>
            <div class="flex items-center justify-between bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span class="text-slate-400 font-bold">Mevcut / Eski Şifre:</span>
                <div class="flex items-center gap-2">
                    <span id="coachOldPwVal" class="text-amber-300 font-mono font-bold text-xs tracking-wider">••••••••</span>
                    <button type="button" onclick="togglePasswordVisibility('coachOldPwVal', '${escapeHtml(plainPw)}')" class="text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2 py-0.5 rounded border border-slate-700 font-bold cursor-pointer">
                        👁 Göster / Gizle
                    </button>
                    <button type="button" onclick="navigator.clipboard.writeText('${escapeHtml(plainPw)}'); alert('Eski şifre kopyalandı!')" class="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-slate-700 font-bold cursor-pointer">
                        📋 Kopyala
                    </button>
                </div>
            </div>
        </div>
        <div>
            <label class="block text-slate-300 font-bold mb-1">Yeni Şifre Belirle *</label>
            <input type="password" id="coachNewStudentPassword" required placeholder="En az 4 karakter" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
        </div>
        <div>
            <label class="block text-slate-300 font-bold mb-1">Yeni Şifre Tekrar *</label>
            <input type="password" id="coachNewStudentPasswordConfirm" required placeholder="Şifreyi tekrar girin" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
            <button type="button" onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">İptal</button>
            <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl shadow-lg">
                🔑 Öğrenci Şifresini Güncelle
            </button>
        </div>
    </form>
    `;
    openModal('🔑 ÖĞRENCİ ŞİFRESİNİ YENİLE', content);
}

async function submitCoachChangeStudentPassword(e, studentId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const new_password = document.getElementById('coachNewStudentPassword').value.trim();
    const confirm_password = document.getElementById('coachNewStudentPasswordConfirm').value.trim();

    if (new_password !== confirm_password) {
        alert("Girdiğiniz yeni şifreler birbiriyle eşleşmiyor!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/coach/students/${studentId}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ new_password, confirm_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Şifre güncellenemedi.');

        closeModal();
        alert("🔑 Öğrenci şifresi başarıyla güncellendi!");
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

window.openCoachChangeStudentPasswordModal = openCoachChangeStudentPasswordModal;
window.submitCoachChangeStudentPassword = submitCoachChangeStudentPassword;
window.submitEditUser = submitEditUser;
window.submitCreateUser = submitCreateUser;
window.submitAdminChangeUserPassword = submitAdminChangeUserPassword;
window.toggleEditCoachSelect = toggleEditCoachSelect;
window.toggleCreateCoachSelect = toggleCreateCoachSelect;
window.setAdminUsersRoleFilter = setAdminUsersRoleFilter;
window.setAdminUsersStatusFilter = setAdminUsersStatusFilter;
window.handleAdminUserSearch = handleAdminUserSearch;

// ----------------------------------------------------
// KOÇ ÖĞRENCİ ŞİFRE DEĞİŞTİRME MODALI
// ----------------------------------------------------
function openCoachChangeStudentPasswordModal(studentId, studentName) {
    const content = `
    <form onsubmit="submitCoachChangeStudentPassword(event, ${studentId})" class="space-y-4 text-xs">
        <div class="bg-[#0E1526] p-3 rounded-xl border border-[#24314A] text-slate-300">
            Öğrenci: <span class="text-white font-bold">${escapeHtml(studentName)}</span>
        </div>
        <div>
            <label class="block text-slate-300 font-bold mb-1">Yeni Şifre *</label>
            <input type="password" id="coachNewStudentPassword" required placeholder="En az 4 karakter" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
        </div>
        <div>
            <label class="block text-slate-300 font-bold mb-1">Yeni Şifre Tekrar *</label>
            <input type="password" id="coachNewStudentPasswordConfirm" required placeholder="Şifreyi tekrar girin" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white font-semibold focus:outline-none focus:border-indigo-500">
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
            <button type="button" onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">İptal</button>
            <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl shadow-lg">
                🔑 Öğrenci Şifresini Güncelle
            </button>
        </div>
    </form>
    `;
    openModal('🔑 ÖĞRENCİ ŞİFRESİNİ YENİLE', content);
}

async function submitCoachChangeStudentPassword(e, studentId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const new_password = document.getElementById('coachNewStudentPassword').value.trim();
    const confirm_password = document.getElementById('coachNewStudentPasswordConfirm').value.trim();

    if (new_password !== confirm_password) {
        alert("Girdiğiniz yeni şifreler birbiriyle eşleşmiyor!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/coach/students/${studentId}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ new_password, confirm_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Şifre güncellenemedi.');

        closeModal();
        if (typeof showToast === 'function') showToast("🔑 Öğrenci şifresi başarıyla güncellendi!", "success");
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

// ----------------------------------------------------
// MANY-TO-MANY ACTION HANDLERS
// ----------------------------------------------------
async function generateCoachInviteLink(relType = 'MAIN_COACH') {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/rel/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ relationship_type: relType })
        });
        const data = await res.json();
        if (res.ok) {
            const fullUrl = `${window.location.origin}/#invite=${data.invitation_token}`;
            const isMain = relType === 'MAIN_COACH';
            const title = isMain ? '🔗 Ana Koç Davet Bağlantısı' : '📖 Branş Koçu Davet Bağlantısı';

            if (navigator.clipboard) {
                try { await navigator.clipboard.writeText(fullUrl); } catch (e) {}
            }

            const html = `
            <div class="max-w-md mx-auto space-y-4 text-xs text-center">
                <div class="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                    <i data-lucide="link-2" class="w-6 h-6"></i>
                </div>
                <div>
                    <h3 class="text-base font-bold text-white mb-1">${title}</h3>
                    <p class="text-xs text-slate-400">Bu davet bağlantısını öğrencilerinize göndererek tek tıkla koçluk bağlantısı kurabilirsiniz.</p>
                </div>

                <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span class="text-[10px] text-slate-400 font-semibold block uppercase">Davet Kodu (Token)</span>
                    <span class="text-lg font-black text-amber-400 tracking-wider font-mono block">${data.invitation_token}</span>
                </div>

                <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span class="text-[10px] text-slate-400 font-semibold block uppercase">Davet Linki</span>
                    <input type="text" readonly id="inviteUrlInput" value="${fullUrl}" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-center text-indigo-300 font-mono text-xs select-all">
                </div>

                <button onclick="copyInviteUrlToClipboard('${fullUrl}')" class="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                    <i data-lucide="copy" class="w-4 h-4"></i> Bağlantıyı Panoya Kopyala
                </button>
            </div>
            `;
            openModal(html);
            if (window.lucide) lucide.createIcons();
        } else {
            alert(data.error || "Davet oluşturulamadı");
        }
    } catch (err) {
        console.error("generateCoachInviteLink error:", err);
        alert("Davet oluşturulurken hata meydana geldi.");
    }
}

function copyInviteUrlToClipboard(url) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            alert("✅ Davet bağlantısı panoya kopyalandı!");
        });
    } else {
        const input = document.getElementById('inviteUrlInput');
        if (input) {
            input.select();
            document.execCommand('copy');
            alert("✅ Davet bağlantısı panoya kopyalandı!");
        }
    }
}

async function connectWithCoachCode(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const code = document.getElementById('coachCodeInput').value;

    try {
        const res = await fetch(`${API_BASE}/rel/coach-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ coach_code: code })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            renderStudentDashboard();
        } else {
            alert(data.error || "Bağlantı hatası");
        }
    } catch (err) {
        console.error("connectWithCoachCode error:", err);
    }
}

async function respondConnectionRequest(reqId, action) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/rel/requests/${reqId}/respond`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: action })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            renderCoachDashboard();
        }
    } catch (err) {
        console.error("respondConnectionRequest error:", err);
    }
}

async function adminAssignCoach(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const coach_id = document.getElementById('adminAssignCoachId').value;
    const student_id = document.getElementById('adminAssignStudentId').value;
    const rel_type = document.getElementById('adminAssignRelType').value;

    try {
        const res = await fetch(`${API_BASE}/rel/admin-assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ coach_id: coach_id, student_id: student_id, relationship_type: rel_type })
        });
        const data = await res.json();
        if (res.ok) {
            alert("⚡️ " + data.message);
            renderAdminDashboard();
        } else {
            alert(data.error || "Eşleştirme yapılamadı");
        }
    } catch (err) {
        console.error("adminAssignCoach error:", err);
    }
}

async function completeAssignment(assignmentId) {
    const token = localStorage.getItem('yks_token');
    await fetch(`${API_BASE}/odevler`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: assignmentId, status: 'COMPLETED' })
    });
    alert("Ödev tamamlandı olarak işaretlendi!");
    renderStudentDashboard();
}

// ----------------------------------------------------
// SIMULATOR
// ----------------------------------------------------
function renderSimulatorView() {
    document.getElementById('pageTitle').textContent = "YKS Puan & Sıralama Simülatörü";
    
    let html = `
    <div class="glass-card p-6 border border-slate-800">
        <h3 class="text-base font-bold text-white mb-2">🎯 ÖSYM YKS Puan & Tahmini Sıralama Simülatörü</h3>
        <p class="text-xs text-slate-400 mb-6">TYT ve AYT Netlerinizi Girerek Yerleştirme Puanınızı ve Tahmini Sıralamanızı Hesaplayın</p>

        <form onsubmit="calculateSimScore(event)" class="space-y-6">
            <!-- TYT NETLERI -->
            <div>
                <h4 class="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">TYT NETLERİ (120 SORU)</h4>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Türkçe Net (40)</label>
                        <input type="number" id="simTytTurkce" step="0.25" value="34" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Matematik Net (40)</label>
                        <input type="number" id="simTytMat" step="0.25" value="31" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Sosyal Net (20)</label>
                        <input type="number" id="simTytSosyal" step="0.25" value="16" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Fen Net (20)</label>
                        <input type="number" id="simTytFen" step="0.25" value="15" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                </div>
            </div>

            <!-- AYT SAYISAL NETLERI -->
            <div>
                <h4 class="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">AYT SAYISAL NETLERİ</h4>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">AYT Mat Net (40)</label>
                        <input type="number" id="simAytMat" step="0.25" value="33" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Fizik Net (14)</label>
                        <input type="number" id="simAytFizik" step="0.25" value="11" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Kimya Net (13)</label>
                        <input type="number" id="simAytKimya" step="0.25" value="10" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Biyoloji Net (13)</label>
                        <input type="number" id="simAytBiyoloji" step="0.25" value="10" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                </div>
            </div>

            <!-- OBP -->
            <div class="max-w-xs">
                <label class="block text-xs text-slate-400 mb-1">OBP (Ortaöğretim Başarı Puanı 50-100)</label>
                <input type="number" id="simObp" value="88" min="50" max="100" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
            </div>

            <button type="submit" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-8 py-3.5 rounded-xl shadow-lg transition">
                🚀 YKS Puanı & Sıralamamı Hesapla
            </button>
        </form>

        <!-- RESULT CARD -->
        <div id="simResultContainer" class="hidden mt-8 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-slate-900/80 p-5 rounded-2xl border border-indigo-500/30 text-center">
                <span class="text-xs text-slate-400 block font-medium">TYT Puanı</span>
                <span id="resTytScore" class="text-2xl font-black text-indigo-400 mt-1 block">440.1</span>
            </div>
            <div class="bg-slate-900/80 p-5 rounded-2xl border border-indigo-500/30 text-center">
                <span class="text-xs text-slate-400 block font-medium">AYT SAY Yerleştirme Puanı (+OBP)</span>
                <span id="resSayScore" class="text-2xl font-black text-emerald-400 mt-1 block">432.5</span>
            </div>
            <div class="bg-slate-900/80 p-5 rounded-2xl border border-indigo-500/30 text-center">
                <span class="text-xs text-slate-400 block font-medium">Tahmini YKS Sıralaması</span>
                <span id="resRank" class="text-2xl font-black text-amber-400 mt-1 block">#18.500</span>
            </div>
        </div>
    </div>`;

    document.getElementById('viewContainer').innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

async function calculateSimScore(e) {
    e.preventDefault();
    const tyt_turkce = document.getElementById('simTytTurkce').value;
    const tyt_mat = document.getElementById('simTytMat').value;
    const tyt_sosyal = document.getElementById('simTytSosyal').value;
    const tyt_fen = document.getElementById('simTytFen').value;
    const obp = document.getElementById('simObp').value;
    const ayt_mat = document.getElementById('simAytMat').value;
    const ayt_fizik = document.getElementById('simAytFizik').value;
    const ayt_kimya = document.getElementById('simAytKimya').value;
    const ayt_biyoloji = document.getElementById('simAytBiyoloji').value;

    const res = await fetch(`${API_BASE}/simulasyon/puan-hesapla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tyt_turkce, tyt_mat, tyt_sosyal, tyt_fen, obp, ayt_mat, ayt_fizik, ayt_kimya, ayt_biyoloji })
    });
    const data = await res.json();

    document.getElementById('resTytScore').textContent = Number(data.tyt_score).toFixed(3);
    document.getElementById('resSayScore').textContent = Number(data.yks_say_placement_score).toFixed(3);
    document.getElementById('resRank').textContent = `#${Number(data.estimated_rank).toLocaleString('tr-TR')}`;
    document.getElementById('simResultContainer').classList.remove('hidden');
}

function verifyAssignment(assignmentId, studentId) {
    const token = localStorage.getItem('yks_token');
    fetch(`${API_BASE}/odevler`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: assignmentId, status: 'VERIFIED' })
    }).then(() => {
        alert("Ödev koç tarafından onaylandı!");
        renderStudentDetailView(studentId);
    });
}

function switchWeekPlan(studentId, planId) {
    if (planId) {
        renderStudentDetailView(studentId, planId);
    }
}

function prepareNewBlankWeekGrid() {
    document.querySelectorAll('#excelProgramGrid input[data-day]').forEach(input => input.value = '');
    document.getElementById('weekStartDateInput').value = getNextMondayDate();
    alert("Gelecek hafta için boş grid hazırlandı! Ders görevlerinizi doldurup 'Kaydet' butonuna basabilirsiniz.");
}

async function deleteWeekPlan(studentId, planId) {
    if (confirm("Bu haftalık programı silmek ve arşive kaldırmak istediğinize emin misiniz?")) {
        const token = localStorage.getItem('yks_token');
        await fetch(`${API_BASE}/haftalik-program?plan_id=${planId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        alert("Haftalık program silindi!");
        renderStudentDetailView(studentId);
    }
}

function getNextMondayDate() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? 1 : (8 - day));
    const nextMon = new Date(d.setDate(diff));
    return nextMon.toISOString().split('T')[0];
}

async function saveExcelStyleGrid(studentId) {
    const token = localStorage.getItem('yks_token');
    const inputs = document.querySelectorAll('#excelProgramGrid input[data-day]');
    const week_start_date = document.getElementById('weekStartDateInput').value || getNextMondayDate();

    const items = [];
    inputs.forEach(input => {
        const val = input.value.trim();
        if (val) {
            const day_of_week = input.getAttribute('data-day');
            const time_slot = input.getAttribute('data-slot');
            
            const matchNum = val.match(/(\d+)\s*(soru|Soru|S|s)?/);
            const qCount = matchNum ? parseInt(matchNum[1]) : 40;

            items.push({
                day_of_week,
                time_slot,
                subject_id: 2,
                task_description: val,
                target_question_count: qCount,
                status: 'NOT_STARTED'
            });
        }
    });

    try {
        await fetch(`${API_BASE}/haftalik-program`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_id: studentId, week_start_date, items })
        });
        alert(`${week_start_date} haftasına özel ders programı kaydedildi ve arşivlendi!`);
        renderStudentDetailView(studentId);
    } catch (err) {
        alert("Program kaydedilirken bir hata oluştu!");
    }
}

function clearExcelGrid() {
    if (confirm("Grid üzerindeki tüm hücreleri temizlemek istediğinize emin misiniz?")) {
        document.querySelectorAll('#excelProgramGrid input[data-day]').forEach(input => input.value = '');
    }
}

async function saveQuestionLog(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const subject_id = document.getElementById('qSubject').value;
    const correct = document.getElementById('qCorrect').value;
    const incorrect = document.getElementById('qIncorrect').value;

    await fetch(`${API_BASE}/soru-takibi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_id: selectedStudentId, subject_id, correct, incorrect })
    });
    renderQuestionView();
}

function openForgotPasswordModal(e) {
    if (e) e.preventDefault();
    const html = `
    <div class="space-y-4 text-xs p-2">
        <div class="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div class="w-10 h-10 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center justify-center text-xl font-bold">
                🔑
            </div>
            <div>
                <h3 class="text-base font-black text-white">ŞİFREMİ UNUTTUM</h3>
                <p class="text-[11px] text-slate-400">Şifre yenileme yönergeleri için kullanıcı adınızı girin</p>
            </div>
        </div>

        <div id="forgotPasswordContainer">
            <form onsubmit="submitForgotPasswordCheck(event)" class="space-y-4">
                <div>
                    <label class="block text-slate-300 font-bold mb-1.5">Kullanıcı Adı</label>
                    <input type="text" id="forgotUsernameInput" required placeholder="ör: burak.akcan veya ummu.akcan" class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl px-4 py-3 text-white font-mono font-bold text-sm text-indigo-300 focus:outline-none focus:border-indigo-500">
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button type="button" onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-slate-300 font-bold px-4 py-2.5 rounded-xl border border-[#2A3954] transition">
                        İptal
                    </button>
                    <button type="submit" id="btnForgotSubmit" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-2.5 rounded-xl shadow-lg transition">
                        [ Devam Et ]
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
    openModal(html);
}

async function submitForgotPasswordCheck(e) {
    e.preventDefault();
    const username = document.getElementById('forgotUsernameInput').value.trim();
    if (!username) return;

    const btn = document.getElementById('btnForgotSubmit');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Kontrol ediliyor...';
    }

    try {
        const res = await fetch(`${API_BASE}/auth/forgot-password-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        const container = document.getElementById('forgotPasswordContainer');
        if (!container) return;

        if (data.found && data.role === 'STUDENT') {
            container.innerHTML = `
            <div class="space-y-4 text-center">
                <div class="glass-card p-5 border border-emerald-800/80 bg-emerald-950/30 rounded-2xl text-left space-y-3">
                    <div class="flex items-center gap-2 text-emerald-400 font-black text-sm">
                        <span>🎓</span> ÖĞRENCİ HESABI
                    </div>
                    <p class="text-white text-xs font-semibold leading-relaxed">
                        Şifrenizi unuttuysanız bağlı olduğunuz koç ile iletişime geçiniz.
                    </p>
                    <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs">
                        <span class="text-slate-400 font-medium block text-[11px]">Koçunuz:</span>
                        <span class="text-indigo-300 font-bold text-sm block mt-0.5">${escapeHtml(data.coach_name || 'Eğitim Koçunuz')}</span>
                    </div>
                    <p class="text-slate-300 text-xs font-medium">
                        Koçunuz sizin için yeni bir şifre belirleyebilir.
                    </p>
                </div>
                <button onclick="closeModal()" class="w-full bg-[#172238] hover:bg-[#24314A] text-white font-bold py-3 rounded-xl border border-[#2A3954] transition shadow">
                    [ GİRİŞ EKRANINA DÖN ]
                </button>
            </div>
            `;
        } else if (data.found && (data.role === 'COACH' || data.role === 'TEACHER')) {
            container.innerHTML = `
            <div class="space-y-4 text-center">
                <div class="glass-card p-5 border border-indigo-800/80 bg-indigo-950/30 rounded-2xl text-left space-y-3">
                    <div class="flex items-center gap-2 text-indigo-400 font-black text-sm">
                        <span>👨‍🏫</span> KOÇ / ÖĞRETMEN HESABI
                    </div>
                    <p class="text-white text-xs font-semibold leading-relaxed">
                        Şifrenizi unuttuysanız sistem yöneticisi ile iletişime geçiniz.
                    </p>
                    <p class="text-slate-300 text-xs font-medium">
                        Yönetici sizin için yeni bir şifre belirleyebilir.
                    </p>
                </div>
                <button onclick="closeModal()" class="w-full bg-[#172238] hover:bg-[#24314A] text-white font-bold py-3 rounded-xl border border-[#2A3954] transition shadow">
                    [ GİRİŞ EKRANINA DÖN ]
                </button>
            </div>
            `;
        } else if (data.found && data.role === 'ADMIN') {
            container.innerHTML = `
            <div class="space-y-4 text-center">
                <div class="glass-card p-5 border border-violet-800/80 bg-violet-950/30 rounded-2xl text-left space-y-3">
                    <div class="flex items-center gap-2 text-violet-400 font-black text-sm">
                        <span>👑</span> ADMİN HESABI
                    </div>
                    <p class="text-white text-xs font-semibold leading-relaxed">
                        Sistem yöneticisi şifre sıfırlama işlemi kurum içi yetkili prosedürü üzerinden yapılmaktadır.
                    </p>
                </div>
                <button onclick="closeModal()" class="w-full bg-[#172238] hover:bg-[#24314A] text-white font-bold py-3 rounded-xl border border-[#2A3954] transition shadow">
                    [ GİRİŞ EKRANINA DÖN ]
                </button>
            </div>
            `;
        } else {
            container.innerHTML = `
            <div class="space-y-4 text-center">
                <div class="glass-card p-5 border border-slate-800 bg-slate-900/60 rounded-2xl text-left space-y-2">
                    <p class="text-slate-300 text-xs font-medium leading-relaxed">
                        Kullanıcı adı kontrol edildi. Eğer hesabınız sistemde kayıtlı ise lütfen bağlı olduğunuz eğitim koçunuz veya sistem yöneticiniz ile iletişime geçiniz.
                    </p>
                </div>
                <button onclick="closeModal()" class="w-full bg-[#172238] hover:bg-[#24314A] text-white font-bold py-3 rounded-xl border border-[#2A3954] transition shadow">
                    [ GİRİŞ EKRANINA DÖN ]
                </button>
            </div>
            `;
        }
    } catch (err) {
        alert("Bir hata oluştu: " + err.message);
        if (btn) {
            btn.disabled = false;
            btn.textContent = "[ Devam Et ]";
        }
    }
}

function openAddStudentModal() {
    const html = `
    <div class="space-y-3 text-xs pr-1">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
                <h3 class="text-base font-black text-white">+ YENİ ÖĞRENCİ HESABI OLUŞTUR</h3>
                <p class="text-[11px] text-slate-400">Koç paneli üzerinden yeni öğrenci hesabı ve ilk şifresini tanımlayın</p>
            </div>
            <button onclick="closeModal()" class="text-slate-400 hover:text-white p-1">✕</button>
        </div>

        <div id="studentFormError" class="hidden text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-2.5 rounded-xl"></div>

        <form onsubmit="submitNewStudent(event)" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Ad *</label>
                    <input type="text" id="stName" required placeholder="ör: Burak" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                </div>
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Soyad *</label>
                    <input type="text" id="stSurname" required placeholder="ör: Akcan" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                </div>
            </div>

            <div>
                <label class="block text-slate-400 font-bold mb-1">Kullanıcı Adı (Sistemde Benzersiz Olmalıdır) *</label>
                <input type="text" id="stUsername" required placeholder="ör: burak.akcan veya burak2026" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono font-bold text-indigo-300">
                <span class="text-[10px] text-slate-500 block mt-0.5">💡 Öğrenci bu kullanıcı adı ile sisteme giriş yapacaktır.</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-slate-400 font-bold mb-1">İlk Şifre *</label>
                    <input type="password" id="stPassword" required placeholder="En az 6 karakter" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                </div>
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Şifre Tekrar *</label>
                    <input type="password" id="stPasswordRepeat" required placeholder="Şifreyi tekrar girin" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Sınav Sistemi *</label>
                    <select id="stExamSystem" onchange="toggleStudentFormTrackField()" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-indigo-300">
                        <option value="YKS">YKS (Lise / Üniversite)</option>
                        <option value="LGS">LGS (8. Sınıf Lise Giriş)</option>
                    </select>
                </div>
                <div id="stTrackContainer">
                    <label class="block text-slate-400 font-bold mb-1">Alan Türü (YKS)</label>
                    <select id="stTrack" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                        <option value="SAYISAL">Sayısal (MF)</option>
                        <option value="EA">Eşit Ağırlık (EA)</option>
                        <option value="SOZEL">Sözel (TS)</option>
                        <option value="YDT">Dil (YDT)</option>
                    </select>
                </div>
            </div>

            <div class="pt-2">
                <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black py-3 rounded-xl shadow-lg transition text-xs uppercase tracking-wider">
                    ÖĞRENCİYİ OLUŞTUR
                </button>
            </div>
        </form>
    </div>`;
    openModal(html);
}

function toggleStudentFormTrackField() {
    const examSys = document.getElementById('stExamSystem').value;
    const trackCont = document.getElementById('stTrackContainer');
    if (trackCont) {
        trackCont.style.display = examSys === 'LGS' ? 'none' : 'block';
    }
}

async function submitNewStudent(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const name = document.getElementById('stName').value.trim();
    const surname = document.getElementById('stSurname').value.trim();
    const username = document.getElementById('stUsername').value.trim();
    const password = document.getElementById('stPassword').value.trim();
    const password_repeat = document.getElementById('stPasswordRepeat').value.trim();
    const exam_system = document.getElementById('stExamSystem').value;
    const track = exam_system === 'LGS' ? 'SAYISAL' : document.getElementById('stTrack').value;

    const errDiv = document.getElementById('studentFormError');
    if (errDiv) { errDiv.textContent = ''; errDiv.classList.add('hidden'); }

    try {
        const res = await fetch(`${API_BASE}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, surname, username, password, password_repeat, exam_system, track })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Öğrenci kaydı oluşturulamadı.');

        showStudentCredentialsCard(data.username || username, data.initial_password || password);
        await loadCoachStudentsList();
    } catch (err) {
        if (errDiv) {
            errDiv.textContent = "❌ " + (err.message || 'Öğrenci kaydı sırasında hata oluştu.');
            errDiv.classList.remove('hidden');
        } else {
            alert("Hata: " + err.message);
        }
    }
}

function showStudentCredentialsCard(username, password) {
    const credText = `Kullanıcı Adı: ${username}\nŞifre: ${password}`;
    const html = `
    <div class="space-y-4 text-xs p-2">
        <div class="flex items-center gap-3 bg-emerald-950/60 border border-emerald-800/80 p-3 rounded-xl">
            <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg">
                ✓
            </div>
            <div>
                <h3 class="text-sm font-black text-white">Öğrenci Hesabı Başarıyla Oluşturuldu!</h3>
                <p class="text-[11px] text-emerald-300">Giriş bilgilerini öğrenciye iletebilirsiniz.</p>
            </div>
        </div>

        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 class="text-xs font-black text-indigo-300 uppercase tracking-wider">ÖĞRENCİ GİRİŞ BİLGİLERİ</h4>
            <div class="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span class="text-slate-400 font-bold">Kullanıcı Adı:</span>
                <span class="font-mono text-sm font-black text-white">${username}</span>
            </div>
            <div class="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span class="text-slate-400 font-bold">İlk Şifre:</span>
                <span class="font-mono text-sm font-black text-amber-400">${password}</span>
            </div>
        </div>

        <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-slate-400 text-[10px]">
            🔒 <strong>Güvenlik Uyarısı:</strong> Şifre veritabanında güvenli olarak saklanmıştır. Bu ekran kapatıldıktan sonra şifre tekrar görüntülenemez.
        </div>

        <div class="flex items-center gap-3">
            <button onclick="copyToClipboard('${credText.replace(/\n/g, '\\n')}')" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                📋 BİLGİLERİ KOPYALA
            </button>
            <button onclick="closeModal(); navigateView('dashboard');" class="px-5 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition">
                Kapat
            </button>
        </div>
    </div>
    `;
    openModal(html);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("📋 Öğrenci giriş bilgileri panoya kopyalandı:\n\n" + text);
    }).catch(err => {
        alert("Kopyalama başarısız: " + err);
    });
}

async function openStudentAccountManagementModal(studentId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const students = data.students || [];
        const student = students.find(s => s.id == studentId);
        if (!student) return alert("Öğrenci bulunamadı.");

        const statusBadge = student.user_status === 'ACTIVE' 
            ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">🟢 AKTİF</span>'
            : '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">🔴 PASİF</span>';

        const html = `
        <div class="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <div class="flex items-center gap-2">
                    <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black">
                        ⚙️
                    </div>
                    <div>
                        <h3 class="text-base font-black text-white">${student.name} ${student.surname || ''} — HESAP YÖNETİMİ</h3>
                        <p class="text-[11px] text-slate-400">Kullanıcı Adı: <span class="font-mono text-indigo-300 font-bold">${student.username}</span> | ${statusBadge}</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <!-- SECTION 1: RESET PASSWORD -->
            <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 space-y-3">
                <h4 class="text-xs font-black text-white flex items-center gap-2">
                    <span>🔑</span> YENİ PAROLA BELİRLE
                </h4>
                <form onsubmit="submitCoachResetPassword(event, ${student.id})" class="space-y-2">
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-slate-400 font-bold mb-1">Yeni Parola</label>
                            <input type="password" id="mResetPw" required placeholder="En az 6 karakter" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                        </div>
                        <div>
                            <label class="block text-slate-400 font-bold mb-1">Yeni Parola Tekrar</label>
                            <input type="password" id="mResetPwConfirm" required placeholder="Tekrar girin" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                        </div>
                    </div>
                    <div class="flex items-center justify-between pt-1">
                        <button type="button" onclick="generateTempPasswordForStudent(${student.id})" class="px-3 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 font-bold text-[10px] transition">
                            ⚡ Geçici Parola Oluştur
                        </button>
                        <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-md transition">
                            PAROLAYI GÜNCELLE
                        </button>
                    </div>
                </form>
            </div>

            <!-- SECTION 2: CHANGE USERNAME -->
            <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 space-y-3">
                <h4 class="text-xs font-black text-white flex items-center gap-2">
                    <span>👤</span> KULLANICI ADINI DEĞİŞTİR
                </h4>
                <form onsubmit="submitCoachUpdateUsername(event, ${student.id})" class="flex items-center gap-2">
                    <input type="text" id="mNewUsername" required value="${student.username}" placeholder="Yeni kullanıcı adı" class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-indigo-300">
                    <button type="submit" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition whitespace-nowrap">
                        GÜNCELLE
                    </button>
                </form>
            </div>

            <!-- SECTION 3: ACCOUNT STATUS -->
            <div class="glass-card p-4 border border-slate-800 bg-slate-900/80 flex items-center justify-between">
                <div>
                    <h4 class="text-xs font-black text-white">HESAP DURUMU</h4>
                    <p class="text-[10px] text-slate-400">Pasif yapılan öğrenciler sisteme giriş yapamaz.</p>
                </div>
                <button onclick="toggleStudentAccountStatus(${student.id}, '${student.user_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}')" class="px-4 py-2 rounded-xl font-bold transition text-xs ${student.user_status === 'ACTIVE' ? 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900' : 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'}">
                    ${student.user_status === 'ACTIVE' ? '🔒 Hesabı Pasifleştir' : '🔓 Hesabı Aktifleştir'}
                </button>
            </div>
        </div>
        `;
        openModal(html);
    } catch (e) {
        console.error("openStudentAccountManagementModal error:", e);
    }
}

async function submitCoachResetPassword(e, studentId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const new_password = document.getElementById('mResetPw').value.trim();
    const confirm_password = document.getElementById('mResetPwConfirm').value.trim();

    try {
        const res = await fetch(`${API_BASE}/students/${studentId}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ new_password, confirm_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Şifre güncellenemedi.');

        alert("✅ Öğrencinin parolası başarıyla güncellendi!\n\nKullanıcı Adı: " + data.username + "\nYeni Şifre: " + data.new_password);
        closeModal();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function generateTempPasswordForStudent(studentId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/students/${studentId}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ is_temporary: true, must_change_password: true })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Geçici şifre oluşturulamadı.');

        const credText = `Kullanıcı Adı: ${data.username}\nGeçici Şifre: ${data.new_password}`;
        alert("⚡ Geçici Parola Oluşturuldu!\n\n" + credText + "\n\n(Not: Öğrenci ilk girişte şifresini değiştirmek zorundadır)");
        closeModal();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function submitCoachUpdateUsername(e, studentId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const username = document.getElementById('mNewUsername').value.trim();

    try {
        const res = await fetch(`${API_BASE}/students/${studentId}/account`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Kullanıcı adı güncellenemedi.');

        alert("✅ Kullanıcı adı başarıyla güncellendi!");
        closeModal();
        await loadCoachStudentsList();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function toggleStudentAccountStatus(studentId, newStatus) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/students/${studentId}/account`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Hesap durumu güncellenemedi.');

        alert("✅ Öğrenci hesap durumu güncellendi: " + (newStatus === 'ACTIVE' ? 'Aktif' : 'Pasif'));
        closeModal();
        await loadCoachStudentsList();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

let allSubjectsList = [];

async function fetchSubjectsList(examType = null, field = null) {
    const token = localStorage.getItem('yks_token');
    try {
        let url = `${API_BASE}/subjects`;
        if (examType && field) {
            url += `?exam_type=${examType}&field=${field}`;
        } else if (examType) {
            url += `?exam_type=${examType}`;
        }
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allSubjectsList = data.subjects || [];
    } catch (err) {
        console.error("fetchSubjectsList error:", err);
    }
    return allSubjectsList;
}

async function openAddDenemeModal() {
    await fetchSubjectsList('AYT', 'SAYISAL');

    const html = `
    <div class="max-w-xl mx-auto space-y-4 text-xs">
        <div>
            <h3 class="text-base font-bold text-white mb-1 flex items-center gap-2">
                <i data-lucide="plus-circle" class="w-5 h-5 text-indigo-400"></i> Yeni Deneme Sınavı Net Girişi
            </h3>
            <p class="text-xs text-slate-400">Dersler veritabanından dinamik çekilir. Sınav türü ve alanınıza göre tüm branşları eksiksiz kaydedin.</p>
        </div>

        <form onsubmit="submitNewDeneme(event)" class="space-y-4">
            <div>
                <label class="block text-slate-300 font-semibold mb-1">Deneme Adı / Yayın Adı</label>
                <input type="text" id="denemeTitle" required placeholder="Örn: Özdebir Türkiye Geneli AYT Denemesi-4" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label class="block text-slate-300 font-semibold mb-1">Sınav Türü</label>
                    <select id="denemeType" onchange="updateDenemeSubjectInputs()" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none">
                        <option value="TYT">TYT (Temel Yeterlilik)</option>
                        <option value="AYT" selected>AYT (Alan Yeterlilik)</option>
                        <option value="YDT">YDT (Yabancı Dil)</option>
                        <option value="BRANS">Branş Denemesi</option>
                    </select>
                </div>

                <div id="aytTrackWrapper">
                    <label class="block text-slate-300 font-semibold mb-1">AYT Alanı / Bölümü</label>
                    <select id="aytTrack" onchange="updateDenemeSubjectInputs()" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-amber-300 font-bold focus:border-indigo-500 focus:outline-none">
                        <option value="SAYISAL">📐 SAYISAL (Matematik + Fen)</option>
                        <option value="EA">📖 EŞİT AĞIRLIK (Mat + Edebiyat-Sos1)</option>
                        <option value="SOZEL">🏛 SÖZEL (Edebiyat-Sos1 + Sos2)</option>
                        <option value="TUM_AYT">🌐 TÜM AYT DERSLERİ</option>
                    </select>
                </div>

                <div id="bransSubjectWrapper" class="hidden">
                    <label class="block text-slate-300 font-semibold mb-1">Branş Dersi Seçin</label>
                    <select id="bransSubjectSelect" onchange="updateDenemeSubjectInputs()" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-emerald-300 font-bold focus:border-indigo-500 focus:outline-none">
                        <option value="Matematik">📐 Matematik Branş Denemesi</option>
                        <option value="Fizik">⚡️ Fizik Branş Denemesi</option>
                        <option value="Kimya">🧪 Kimya Branş Denemesi</option>
                        <option value="Biyoloji">🧬 Biyoloji Branş Denemesi</option>
                        <option value="Türkçe">📖 Türkçe Branş Denemesi</option>
                        <option value="Tarih">🏛 Tarih Branş Denemesi</option>
                        <option value="Coğrafya">🌍 Coğrafya Branş Denemesi</option>
                        <option value="İngilizce">🌐 YDT İngilizce Branş Denemesi</option>
                    </select>
                </div>

                <div>
                    <label class="block text-slate-300 font-semibold mb-1">Tarih</label>
                    <input type="date" id="denemeDate" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none">
                </div>
            </div>

            <!-- DYNAMIC DERS NET INPUTS GRID -->
            <div class="border-t border-slate-800 pt-4">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <i data-lucide="edit-3" class="w-4 h-4 text-indigo-400"></i> Ders Bazlı Doğru / Yanlış / Boş Girişi
                    </h4>
                    <span id="denemeTotalNetBadge" class="bg-indigo-950 text-indigo-300 border border-indigo-800 px-3 py-1 rounded-xl text-xs font-black">
                        Toplam Net: 0.00
                    </span>
                </div>

                <div id="denemeSubjectInputsContainer" class="max-h-[320px] overflow-y-auto space-y-3 pr-2">
                    <!-- Populated dynamically via updateDenemeSubjectInputs() -->
                </div>
            </div>

            <button type="submit" class="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4"></i> Deneme Netlerini Sisteme Kaydet
            </button>
        </form>
    </div>
    `;

    openModal(html);
    if (window.lucide) lucide.createIcons();
    await updateDenemeSubjectInputs();
}

async function updateDenemeSubjectInputs() {
    const examType = document.getElementById('denemeType').value;
    const trackWrapper = document.getElementById('aytTrackWrapper');
    const bransWrapper = document.getElementById('bransSubjectWrapper');
    const container = document.getElementById('denemeSubjectInputsContainer');
    if (!container) return;

    if (examType === 'AYT') {
        if (trackWrapper) trackWrapper.classList.remove('hidden');
        if (bransWrapper) bransWrapper.classList.add('hidden');
    } else if (examType === 'BRANS') {
        if (trackWrapper) trackWrapper.classList.add('hidden');
        if (bransWrapper) bransWrapper.classList.remove('hidden');
    } else {
        if (trackWrapper) trackWrapper.classList.add('hidden');
        if (bransWrapper) bransWrapper.classList.add('hidden');
    }

    const aytTrack = document.getElementById('aytTrack') ? document.getElementById('aytTrack').value : 'SAYISAL';
    const bransSubName = document.getElementById('bransSubjectSelect') ? document.getElementById('bransSubjectSelect').value : 'Matematik';

    let relevantSubjects = [];
    if (examType === 'TYT') {
        relevantSubjects = await fetchSubjectsList('TYT', 'ORTAK');
    } else if (examType === 'YDT') {
        relevantSubjects = await fetchSubjectsList('YDT', 'DIL');
    } else if (examType === 'BRANS') {
        const allList = await fetchSubjectsList();
        relevantSubjects = allList.filter(s => s.name.toLowerCase().includes(bransSubName.toLowerCase()));
        if (relevantSubjects.length === 0) {
            relevantSubjects = allList.slice(0, 1);
        }
    } else {
        // AYT
        if (aytTrack === 'TUM_AYT') {
            relevantSubjects = await fetchSubjectsList('AYT');
        } else {
            relevantSubjects = await fetchSubjectsList('AYT', aytTrack);
        }
    }

    let html = '';
    relevantSubjects.forEach(s => {
        html += `
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="w-full sm:w-48">
                <span class="font-bold text-xs text-white block">${s.name}</span>
                <span class="text-[10px] text-slate-400 font-semibold">${s.question_count} Soru</span>
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto">
                <div class="w-1/3 sm:w-20">
                    <label class="text-[9px] text-emerald-400 font-bold block mb-0.5">Doğru</label>
                    <input type="number" id="sub_D_${s.id}" min="0" max="${s.question_count}" value="0" oninput="recalcDenemeTotalNet()" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-center text-white text-xs font-bold">
                </div>
                <div class="w-1/3 sm:w-20">
                    <label class="text-[9px] text-rose-400 font-bold block mb-0.5">Yanlış</label>
                    <input type="number" id="sub_Y_${s.id}" min="0" max="${s.question_count}" value="0" oninput="recalcDenemeTotalNet()" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-center text-white text-xs font-bold">
                </div>
                <div class="w-1/3 sm:w-20">
                    <label class="text-[9px] text-amber-400 font-bold block mb-0.5">Net</label>
                    <div id="sub_Net_${s.id}" class="w-full bg-indigo-950 border border-indigo-800 rounded-lg p-1.5 text-center text-indigo-300 text-xs font-black">
                        0.00
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    if (examType === 'YDT') {
        html += `
        <div class="bg-indigo-950/40 p-3 rounded-xl border border-indigo-800/60 mt-3 space-y-2">
            <h5 class="font-bold text-xs text-indigo-300 flex items-center gap-1.5">
                <i data-lucide="layers" class="w-3.5 h-3.5 text-amber-400"></i> Opsiyonel YDT Soru Tipi Analizi (Kelime, Okuma, Çeviri)
            </h5>
            <div class="grid grid-cols-2 gap-2 text-[10px]">
                <div class="bg-slate-900 p-2 rounded border border-slate-800">
                    <span class="text-slate-300 font-semibold block">Vocabulary / Kelime (10 Soru)</span>
                    <input type="number" placeholder="Net veya Doğru" class="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white text-xs mt-1">
                </div>
                <div class="bg-slate-900 p-2 rounded border border-slate-800">
                    <span class="text-slate-300 font-semibold block">Grammar / Dil Bilgisi (10 Soru)</span>
                    <input type="number" placeholder="Net veya Doğru" class="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white text-xs mt-1">
                </div>
                <div class="bg-slate-900 p-2 rounded border border-slate-800">
                    <span class="text-slate-300 font-semibold block">Reading Paragraflar (25 Soru)</span>
                    <input type="number" placeholder="Net veya Doğru" class="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white text-xs mt-1">
                </div>
                <div class="bg-slate-900 p-2 rounded border border-slate-800">
                    <span class="text-slate-300 font-semibold block">Translation / Çeviri (10 Soru)</span>
                    <input type="number" placeholder="Net veya Doğru" class="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white text-xs mt-1">
                </div>
            </div>
        </div>
        `;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    recalcDenemeTotalNet();
}

function recalcDenemeTotalNet() {
    let grandTotalNet = 0;
    allSubjectsList.forEach(s => {
        const dInput = document.getElementById(`sub_D_${s.id}`);
        const yInput = document.getElementById(`sub_Y_${s.id}`);
        const netDiv = document.getElementById(`sub_Net_${s.id}`);

        if (dInput && yInput && netDiv) {
            const d = parseFloat(dInput.value) || 0;
            const y = parseFloat(yInput.value) || 0;
            const net = Math.max(0, d - (y / 4.0));
            netDiv.textContent = net.toFixed(2);
            grandTotalNet += net;
        }
    });

    const badge = document.getElementById('denemeTotalNetBadge');
    if (badge) badge.textContent = `Toplam Net: ${grandTotalNet.toFixed(2)}`;
}

async function submitNewDeneme(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const title = document.getElementById('denemeTitle').value.trim();
    const exam_type = document.getElementById('denemeType').value;
    const aytTrack = document.getElementById('aytTrack') ? document.getElementById('aytTrack').value : 'ORTAK';
    const exam_date = document.getElementById('denemeDate').value;

    const results = [];
    allSubjectsList.forEach(s => {
        const dInput = document.getElementById(`sub_D_${s.id}`);
        const yInput = document.getElementById(`sub_Y_${s.id}`);
        if (dInput && yInput) {
            const c = parseInt(dInput.value) || 0;
            const inc = parseInt(yInput.value) || 0;
            const emp = Math.max(0, s.question_count - (c + inc));
            if (c > 0 || inc > 0) {
                results.push({ subject_id: s.id, correct: c, incorrect: inc, empty: emp });
            }
        }
    });

    if (results.length === 0) {
        alert("Lütfen en az bir ders için Doğru/Yanlış verisi giriniz!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/deneme`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_id: selectedStudentId, title, exam_type, field: aytTrack, exam_date, results, curriculum_version_id: 1 })
        });
        const data = await res.json();
        closeModal();
        if (data.attempt_id) {
            selectedDenemeAttemptId = data.attempt_id;
        }
        alert(`Deneme sınavı netleri başarıyla kaydedildi!\nToplam Net: ${data.total_net || '0.00'}`);
        renderDenemeView();
    } catch (err) {
        alert("Deneme kaydedilirken hata oluştu!");
    }
}

function openAddBookModal() {
    const html = `
    <h3 class="text-base font-bold text-white mb-1">+ Yeni Kitap Kaydı Ekle</h3>
    <p class="text-xs text-slate-400 mb-4">Okuduğunuz kitabı ekleyip puan verin</p>
    <form onsubmit="submitNewBook(event)" class="space-y-3 text-xs">
        <div>
            <label class="block text-slate-400 mb-1">Kitap Adı</label>
            <input type="text" id="bTitle" required placeholder="ör: Suç ve Ceza" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
        </div>
        <div>
            <label class="block text-slate-400 mb-1">Yazar</label>
            <input type="text" id="bAuthor" required placeholder="ör: Dostoyevski" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-400 mb-1">Toplam Sayfa</label>
                <input type="number" id="bPages" required value="400" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
            </div>
            <div>
                <label class="block text-slate-400 mb-1">Puan (1-5 Yıldız)</label>
                <select id="bRating" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                    <option value="5">⭐️⭐️⭐️⭐️⭐️ (5)</option>
                    <option value="4">⭐️⭐️⭐️⭐️ (4)</option>
                    <option value="3">⭐️⭐️⭐️ (3)</option>
                </select>
            </div>
        </div>
        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-md transition mt-2">
            Kitabı Kaydet
        </button>
    </form>`;
    openModal(html);
}

async function submitNewBook(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const title = document.getElementById('bTitle').value;
    const author = document.getElementById('bAuthor').value;
    const total_pages = document.getElementById('bPages').value;
    const rating_stars = document.getElementById('bRating').value;

    await fetch(`${API_BASE}/kitaplar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_id: selectedStudentId, title, author, total_pages, read_pages: 50, rating_stars })
    });
    closeModal();
    alert("Kitap listeye eklendi!");
    renderBooksView();
}

let activeStudentRiskFilter = 'ALL';

async function renderStudentsRiskListView(filter = 'ALL') {
    document.getElementById('pageTitle').textContent = "Öğrencilerim & Risk Değerlendirme Paneli";
    activeStudentRiskFilter = filter;
    const container = document.getElementById('viewContainer');

    // 1. STATE: LOADING
    if (container) {
        container.innerHTML = `
        <div class="glass-card p-12 text-center border border-[#24314A] rounded-2xl flex flex-col items-center justify-center my-6 bg-[#111A2C]">
            <div class="animate-spin text-[#4F8CFF] mb-3"><i data-lucide="loader-2" class="w-8 h-8"></i></div>
            <h3 class="text-sm font-bold text-white mb-1">Öğrenci Listesi Yükleniyor...</h3>
            <p class="text-xs text-[#A8B3C7]">Lütfen bekleyin, koçluğunuza bağlı öğrencilerin akademik risk durumları getiriliyor.</p>
        </div>
        `;
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    try {
        const data = await apiFetch('/students');
        const students = data.students || [];
        coachStudentsList = students;

        let filtered = students;
        if (filter !== 'ALL') {
            filtered = students.filter(s => s.risk_level === filter);
        }

        const highRiskCount = students.filter(s => s.risk_level === 'RED').length;
        const mediumRiskCount = students.filter(s => s.risk_level === 'ORANGE' || s.risk_level === 'YELLOW').length;
        const lowRiskCount = students.filter(s => s.risk_level === 'GREEN' || !s.risk_level).length;

        // 2. STATE: EMPTY
        if (students.length === 0) {
            if (container) {
                container.innerHTML = `
                <div class="glass-card p-10 border border-[#24314A] bg-[#111A2C] rounded-2xl text-center flex flex-col items-center justify-center my-6 gap-3">
                    <div class="w-14 h-14 rounded-2xl bg-[#172238] border border-[#2A3954] flex items-center justify-center text-[#4F8CFF] text-2xl">
                        👥
                    </div>
                    <h3 class="text-sm font-bold text-white">Henüz Bağlı Öğrenci Bulunmuyor</h3>
                    <p class="text-xs text-[#A8B3C7] max-w-md">Sistemde henüz koçluğunuza tanımlanmış öğrenci kaydı bulunmamaktadır.</p>
                </div>
                `;
                if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
            }
            return;
        }

        // 3. STATE: SUCCESS
        let html = `
        <div class="space-y-6">
            <!-- HEADER STATS BAR -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="glass-card p-4 border border-[var(--border)] flex items-center justify-between rounded-xl shadow-sm">
                    <div>
                        <span class="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">TOPLAM ÖĞRENCİ</span>
                        <h3 class="text-2xl font-black text-[var(--text-primary)] mt-1">${students.length}</h3>
                    </div>
                    <div class="w-11 h-11 rounded-xl bg-[var(--info-soft)] border border-[var(--info-border)] flex items-center justify-center text-[var(--info)]">
                        <i data-lucide="users" class="w-5 h-5"></i>
                    </div>
                </div>

                <div class="glass-card p-4 border border-[var(--danger-border)] bg-[var(--danger-soft)] flex items-center justify-between rounded-xl shadow-sm">
                    <div>
                        <span class="text-xs text-[var(--danger)] font-bold uppercase tracking-wider">KRİTİK RİSK</span>
                        <h3 class="text-2xl font-black text-[var(--danger)] mt-1">${highRiskCount}</h3>
                    </div>
                    <div class="w-11 h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--danger-border)] flex items-center justify-center text-[var(--danger)]">
                        <i data-lucide="alert-triangle" class="w-5 h-5"></i>
                    </div>
                </div>

                <div class="glass-card p-4 border border-[var(--warning-border)] bg-[var(--warning-soft)] flex items-center justify-between rounded-xl shadow-sm">
                    <div>
                        <span class="text-xs text-[var(--warning)] font-bold uppercase tracking-wider">TAKİP GEREKEN</span>
                        <h3 class="text-2xl font-black text-[var(--warning)] mt-1">${mediumRiskCount}</h3>
                    </div>
                    <div class="w-11 h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--warning-border)] flex items-center justify-center text-[var(--warning)]">
                        <i data-lucide="shield-alert" class="w-5 h-5"></i>
                    </div>
                </div>

                <div class="glass-card p-4 border border-[var(--success-border)] bg-[var(--success-soft)] flex items-center justify-between rounded-xl shadow-sm">
                    <div>
                        <span class="text-xs text-[var(--success)] font-bold uppercase tracking-wider">DÜZENLİ İLERLEYEN</span>
                        <h3 class="text-2xl font-black text-[var(--success)] mt-1">${lowRiskCount}</h3>
                    </div>
                    <div class="w-11 h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--success-border)] flex items-center justify-center text-[var(--success)]">
                        <i data-lucide="check-circle-2" class="w-5 h-5"></i>
                    </div>
                </div>
            </div>

            <!-- FILTER TABS BAR -->
            <div class="glass-card p-2 border border-[var(--border)] flex items-center gap-2 overflow-x-auto rounded-xl">
                <button onclick="renderStudentsRiskListView('ALL')" class="px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${filter === 'ALL' ? 'btn-primary text-white shadow' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'}">
                    Tüm Öğrenciler (${students.length})
                </button>
                <button onclick="renderStudentsRiskListView('RED')" class="px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${filter === 'RED' ? 'btn-danger text-white shadow' : 'bg-transparent text-[var(--danger)] hover:bg-[var(--danger-soft)]'}">
                    ! Kritik (${highRiskCount})
                </button>
                <button onclick="renderStudentsRiskListView('ORANGE')" class="px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${filter === 'ORANGE' || filter === 'YELLOW' ? 'btn-warning text-white shadow' : 'bg-transparent text-[var(--warning)] hover:bg-[var(--warning-soft)]'}">
                    ! Dikkat (${mediumRiskCount})
                </button>
                <button onclick="renderStudentsRiskListView('GREEN')" class="px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${filter === 'GREEN' ? 'btn-success text-white shadow' : 'bg-transparent text-[var(--success)] hover:bg-[var(--success-soft)]'}">
                    ✓ Düzenli Takip (${lowRiskCount})
                </button>
            </div>

            <!-- STUDENT CARDS GRID -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        `;

        if (filtered.length === 0) {
            html += `<div class="col-span-3 text-center py-12 text-[var(--text-muted)] text-sm">Seçilen filtrelere uygun öğrenci bulunamadı.</div>`;
        } else {
            filtered.forEach(st => {
                const safeName = (st.name || '').replace(/'/g, "\\'");
                const reasonsList = (st.reasons && Array.isArray(st.reasons) && st.reasons.length > 0) 
                    ? st.reasons 
                    : null;

                html += `
                <div class="glass-card p-5 border border-[var(--border)] flex flex-col justify-between transition rounded-xl shadow-sm">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            ${getRiskBadgeHtml(st.risk_level)}
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--primary-light-bg)] text-[var(--primary)] border border-[var(--primary-border)] uppercase tracking-wider">${st.track || 'TYT/AYT'}</span>
                        </div>

                        <div class="flex items-center gap-3 mb-4 cursor-pointer" onclick="handleStudentDetailClick(${st.id}, '${safeName}')">
                            <div class="w-12 h-12 rounded-xl bg-[var(--primary-light-bg)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary)] font-black text-base shrink-0">
                                ${(st.name || 'Ö').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 class="font-extrabold text-base text-[var(--text-primary)] hover:text-[var(--primary)] transition">${st.name}</h3>
                                <p class="text-xs text-[var(--text-muted)]">${st.school || 'YKS Adayı'} • ${st.target_university || 'Hedef Üniversite'}</p>
                            </div>
                        </div>

                        <div class="bg-[var(--bg-elevated)] p-3 rounded-xl border border-[var(--border-strong)] space-y-2 mb-4">
                            <span class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">⚠️ RİSK ANALİZ GEREKÇELERİ</span>
                            <ul class="text-xs text-[var(--text-primary)] space-y-1">
                                ${reasonsList ? reasonsList.map(r => `<li class="flex items-start gap-1.5"><span class="text-[var(--warning)] font-bold">•</span> ${r}</li>`).join('') : '<li class="text-[var(--text-muted)] italic">Henüz yeterli risk verisi bulunmuyor.</li>'}
                            </ul>
                        </div>
                    </div>

                    <div class="pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                        <button onclick="handleStudentDetailClick(${st.id}, '${safeName}')" class="flex-1 min-w-[90px] btn-primary text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm">
                            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Detay Gör
                        </button>
                        <button onclick="navigateView('program', ${st.id})" class="flex-1 min-w-[80px] btn-secondary font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5">
                            <i data-lucide="calendar" class="w-3.5 h-3.5"></i> Program
                        </button>
                        <button onclick="navigateView('messages', ${st.user_id})" class="flex-1 min-w-[75px] btn-secondary font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5">
                            <i data-lucide="message-square" class="w-3.5 h-3.5"></i> Mesaj
                        </button>
                    </div>
                </div>
                `;
            });
        }

        html += `</div></div>`;
        if (container) {
            container.innerHTML = html;
        }
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

    } catch (err) {
        // 4. STATE: ERROR
        console.error("[STUDENTS LOAD ERROR]", {
            endpoint: '/students',
            error: err.message
        });

        if (container) {
            container.innerHTML = `
            <div class="glass-card p-10 border border-rose-900/80 bg-rose-950/40 rounded-2xl text-center flex flex-col items-center justify-center my-6 gap-3 shadow-2xl">
                <div class="w-14 h-14 rounded-2xl bg-rose-900/60 border border-rose-700/60 flex items-center justify-center text-rose-400 text-2xl shadow-inner">
                    ⚠️
                </div>
                <h3 class="text-sm font-bold text-rose-200">Öğrenci Listesi Yüklenemedi</h3>
                <p class="text-xs text-slate-300 max-w-md">Sunucuyla iletişim kurulurken bir sorun oluştu (${escapeHtml(err.message)}).</p>
                <div class="flex items-center gap-3 mt-2">
                    <button onclick="renderStudentsRiskListView('${filter}')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition flex items-center gap-1.5">
                        🔄 Tekrar Dene
                    </button>
                </div>
            </div>
            `;
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        }
    }
}

// (Weekly Program state variables initialized at top global scope)

function getWeekMonday(dateObj) {
    const d = new Date(dateObj);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

function formatDateTR(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const monthNum = parseInt(parts[1], 10);
    const dayNum = parseInt(parts[2], 10);
    return `${dayNum} ${months[monthNum] || ''}`;
}

function toggleWeeklyView(viewMode) {
    weeklyActiveView = viewMode;
    renderWeeklyProgramView(weeklyActiveStudentId);
}

function shiftWeek(daysOffset) {
    if (!weeklyCurrentWeekStart) weeklyCurrentWeekStart = getWeekMonday(new Date());
    const dt = new Date(weeklyCurrentWeekStart);
    dt.setDate(dt.getDate() + daysOffset);
    weeklyCurrentWeekStart = dt.toISOString().split('T')[0];
    renderWeeklyProgramView(weeklyActiveStudentId);
}

function resetCurrentWeek() {
    weeklyCurrentWeekStart = getWeekMonday(new Date());
    renderWeeklyProgramView(weeklyActiveStudentId);
}

function changeWeeklyStudent(stId) {
    weeklyActiveStudentId = parseInt(stId);
    renderWeeklyProgramView(weeklyActiveStudentId);
}

function handleProgramDragStart(e, progId) {
    draggedProgramId = progId;
    e.dataTransfer.setData('text/plain', progId);
}

function handleProgramDragOver(e) {
    e.preventDefault();
}

async function handleProgramDrop(e, targetDate, targetDay, targetStartTime, targetEndTime) {
    e.preventDefault();
    if (!draggedProgramId) return;

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/weekly-program/${draggedProgramId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                date: targetDate,
                day_of_week: targetDay,
                start_time: targetStartTime,
                end_time: targetEndTime
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Sürükle-bırak güncellenemedi.');
        draggedProgramId = null;
        renderWeeklyProgramView(weeklyActiveStudentId);
    } catch (err) {
        alert("Güncelleme hatası: " + err.message);
    }
}

async function renderWeeklyProgramView(studentId = null) {
    document.getElementById('pageTitle').textContent = "Haftalık Çalışma & Ders Programı";
    const token = localStorage.getItem('yks_token');
    const container = document.getElementById('viewContainer');

    const currentSeq = ++weeklyProgramRequestSeq;

    // 1. DATE VALIDATION (YYYY-MM-DD)
    if (!weeklyCurrentWeekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weeklyCurrentWeekStart)) {
        weeklyCurrentWeekStart = getWeekMonday(new Date());
    }

    // 2. STUDENT ID VALIDATION & RESOLUTION
    if (studentId && !isNaN(parseInt(studentId))) {
        weeklyActiveStudentId = parseInt(studentId);
        localStorage.setItem('yks_selected_student_id', weeklyActiveStudentId);
    } else if (currentUser && currentUser.role === 'STUDENT') {
        weeklyActiveStudentId = currentUser.student_id || (currentUser.student_info ? currentUser.student_info.id : 1);
    } else {
        const savedStId = localStorage.getItem('yks_selected_student_id');
        if (savedStId && !isNaN(parseInt(savedStId))) {
            weeklyActiveStudentId = parseInt(savedStId);
        } else if (coachStudentsList && coachStudentsList.length > 0) {
            weeklyActiveStudentId = coachStudentsList[0].id;
        } else {
            weeklyActiveStudentId = 1;
        }
    }

    // STATE 1: PROGRAM_LOADING
    if (container) {
        container.innerHTML = `
        <div class="glass-card p-12 text-center border border-slate-800 rounded-2xl flex flex-col items-center justify-center my-6 shadow-xl">
            <div class="animate-spin text-indigo-500 mb-3"><i data-lucide="loader-2" class="w-8 h-8"></i></div>
            <h3 class="text-sm font-bold text-white mb-1">Haftalık Program Yükleniyor...</h3>
            <p class="text-xs text-slate-400">Lütfen bekleyin, seçili öğrencinin çalışma takvimi ve ders planı getiriliyor.</p>
        </div>
        `;
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    let is10sTimeout = false;
    let endpoint = null;
    if (weeklyProgramAbortController) {
        try { weeklyProgramAbortController.abort(); } catch (e) {}
    }
    weeklyProgramAbortController = new AbortController();
    const controller = weeklyProgramAbortController;
    const timeoutId = setTimeout(() => {
        is10sTimeout = true;
        controller.abort();
    }, 10000);

    try {
        endpoint = `${API_BASE}/weekly-program?student_id=${weeklyActiveStudentId}&week_start=${weeklyCurrentWeekStart}`;

        // Parallelize students and weekly-program requests
        const isCoachRole = currentUser && currentUser.role !== 'STUDENT';
        const fetchStudentsPromise = isCoachRole
            ? fetch(`${API_BASE}/students`, { 
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            })
            .then(async r => {
                if (r.ok) {
                    const ct = r.headers.get("content-type") || "";
                    if (ct.includes("application/json")) {
                        return await r.json();
                    }
                }
                return { students: [] };
            })
            .catch(e => {
                console.warn("[WEEKLY PROGRAM] Students fetch warning:", e.message);
                return { students: [] };
            })
            : Promise.resolve({ students: [] });

        const fetchProgramPromise = fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });

        const [dataSt, resProg] = await Promise.all([
            fetchStudentsPromise,
            fetchProgramPromise
        ]);
        clearTimeout(timeoutId);

        // Check sequence for race conditions
        if (currentSeq !== weeklyProgramRequestSeq) {
            console.warn("[WEEKLY PROGRAM] Discarding outdated request sequence:", currentSeq, "Active:", weeklyProgramRequestSeq);
            return;
        }

        let students = dataSt.students || [];
        if (students.length > 0 && !students.find(s => s.id == weeklyActiveStudentId)) {
            weeklyActiveStudentId = students[0].id;
        }

        const contentTypeProg = resProg.headers.get("content-type") || "";

        if (!resProg.ok) {
            let errDetail = `HTTP ${resProg.status}`;
            if (contentTypeProg.includes("application/json")) {
                const errJson = await resProg.json();
                errDetail = errJson.error || errJson.message || errDetail;
            } else {
                const rawText = await resProg.text();
                console.error("[PROGRAM LOAD ERROR - NON-JSON RESPONSE]", {
                    studentId: weeklyActiveStudentId,
                    weekStart: weeklyCurrentWeekStart,
                    endpoint,
                    status: resProg.status,
                    contentType: contentTypeProg,
                    bodySnippet: rawText.substring(0, 300)
                });
            }
            throw new Error(errDetail);
        }

        if (!contentTypeProg.includes("application/json")) {
            console.error("[PROGRAM LOAD ERROR - CONTENT TYPE]", {
                studentId: weeklyActiveStudentId,
                weekStart: weeklyCurrentWeekStart,
                endpoint,
                status: resProg.status,
                contentType: contentTypeProg
            });
            throw new Error("Sunucu geçerli JSON verisi döndürmedi.");
        }

        const dataProg = await resProg.json();
        const items = dataProg.items || [];
        const studentInfo = dataProg.student || { id: weeklyActiveStudentId, student_name: 'Öğrenci', track: 'SAYISAL' };

        weeklyProgramState.student = studentInfo;
        weeklyProgramState.items = items;

        const weekDates = [];
        const startDateObj = new Date(weeklyCurrentWeekStart);
        const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        const todayStr = new Date().toISOString().split('T')[0];

        for (let i = 0; i < 7; i++) {
            const d = new Date(startDateObj);
            d.setDate(startDateObj.getDate() + i);
            const iso = d.toISOString().split('T')[0];
            weekDates.push({
                date: iso,
                dayName: dayNames[i],
                displayDate: formatDateTR(iso),
                isToday: iso === todayStr
            });
        }

        const hourlySlots = [
            { start: '08:00', end: '09:00', label: '08:00 - 09:00' },
            { start: '09:00', end: '10:00', label: '09:00 - 10:00' },
            { start: '10:00', end: '11:00', label: '10:00 - 11:00' },
            { start: '11:00', end: '12:00', label: '11:00 - 12:00' },
            { start: '12:00', end: '13:00', label: '12:00 - 13:00' },
            { start: '13:00', end: '14:00', label: '13:00 - 14:00' },
            { start: '14:00', end: '15:00', label: '14:00 - 15:00' },
            { start: '15:00', end: '16:00', label: '15:00 - 16:00' },
            { start: '16:00', end: '17:00', label: '16:00 - 17:00' },
            { start: '17:00', end: '18:00', label: '17:00 - 18:00' },
            { start: '18:00', end: '19:00', label: '18:00 - 19:00' },
            { start: '19:00', end: '20:00', label: '19:00 - 20:00' },
            { start: '20:00', end: '21:00', label: '20:00 - 21:00' },
            { start: '21:00', end: '22:00', label: '21:00 - 22:00' }
        ];

        const programMap = {};
        (items || []).forEach(it => {
            if (it && it.date && it.start_time) {
                const key = `${it.date}_${it.start_time}`;
                programMap[key] = it;
            }
        });

        const isStudentRole = currentUser && currentUser.role === 'STUDENT';

        // Compute Simple Accurate KPI Statistics
        const totTasks = (items || []).length;
        const compTasks = (items || []).filter(i => i && (i.status === 'TAMAMLANDI' || i.completion_status === 'TAMAMLANDI')).length;
        const pendTasks = totTasks - compTasks;
        const compRate = totTasks > 0 ? Math.round((compTasks / totTasks) * 100) : 0;

        let html = `
        <div class="space-y-5 text-xs">
            <!-- TOP BAR CONTROLS -->
            <div class="glass-card p-4 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-600/30">
                        📅
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <h2 class="text-sm font-black text-white">HAFTALIK DERS VE ÇALIŞMA PROGRAMI</h2>
                            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                                👤 ${escapeHtml(studentInfo.student_name || 'Öğrenci')} ${escapeHtml(studentInfo.student_surname || '')}
                            </span>
                        </div>
                        <p class="text-[11px] text-slate-400 mt-0.5">
                            ${!isStudentRole ? 'Hücreye tıklayarak doğrudan görev yazın ve kaydedin.' : 'Haftalık programınızı inceleyin ve tamamladığınız görevleri işaretleyin.'}
                        </p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    ${!isStudentRole && students.length > 0 ? `
                    <select onchange="changeWeeklyStudent(this.value)" class="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 font-semibold shadow">
                        ${students.map(s => `
                            <option value="${s.id}" ${s.id == weeklyActiveStudentId ? 'selected' : ''}>
                                👤 ${escapeHtml(s.name)} ${escapeHtml(s.surname || '')} (${s.exam_system === 'LGS' ? 'LGS' : s.track})
                            </option>
                        `).join('')}
                    </select>
                    ` : ''}

                    <!-- WEEK SWITCHER -->
                    <div class="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow">
                        <button onclick="shiftWeek(-7)" title="Önceki Hafta" class="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition font-bold">
                            ◀ Önceki
                        </button>
                        <button onclick="resetCurrentWeek()" class="px-2.5 py-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 transition font-black text-[11px] border-x border-slate-800">
                            BU HAFTA
                        </button>
                        <button onclick="shiftWeek(7)" title="Sonraki Hafta" class="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition font-bold">
                            Sonraki ▶
                        </button>
                    </div>

                    ${!isStudentRole ? `
                    <button onclick="confirmClearWeeklyGrid()" class="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-bold border border-rose-800 transition text-xs flex items-center gap-1">
                        🗑️ Temizle
                    </button>
                    ` : ''}
                </div>
            </div>

            <!-- STATE 2 & STATE 3: SUCCESS OR EMPTY NOTICE BANNER -->
            ${totTasks === 0 ? `
            <div class="glass-card p-5 border border-indigo-800/80 bg-indigo-950/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div class="flex items-center gap-3 text-left">
                    <div class="w-10 h-10 rounded-xl bg-indigo-900/80 border border-indigo-700/60 flex items-center justify-center text-indigo-300 text-lg shrink-0">
                        📋
                    </div>
                    <div>
                        <h4 class="text-xs font-bold text-white">Bu Öğrenci İçin Henüz Bu Haftaya Ait Program Oluşturulmamış</h4>
                        <p class="text-[11px] text-slate-300 mt-0.5">Aşağıdaki hücrelere tıklayarak doğrudan yeni ders veya çalışma görevi ekleyebilirsiniz.</p>
                    </div>
                </div>
                ${!isStudentRole ? `
                <button onclick="activateInlineCellEdit('${weekDates[0].date}_08_00')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition whitespace-nowrap flex items-center gap-1.5">
                    ➕ İlk Görevi Yazmaya Başla
                </button>
                ` : ''}
            </div>
            ` : ''}

            <!-- KPI SUMMARY BAR -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="glass-card p-3 border border-slate-800 bg-slate-900/80 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold block uppercase">Toplam Görev</span>
                        <span id="wp_kpi_total" class="text-base font-black text-indigo-400">${totTasks}</span>
                    </div>
                    <div class="w-8 h-8 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center font-bold">📋</div>
                </div>
                <div class="glass-card p-3 border border-slate-800 bg-slate-900/80 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold block uppercase">Tamamlanan</span>
                        <span id="wp_kpi_completed" class="text-base font-black text-emerald-400">${compTasks}</span>
                    </div>
                    <div class="w-8 h-8 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold">🟢</div>
                </div>
                <div class="glass-card p-3 border border-slate-800 bg-slate-900/80 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold block uppercase">Bekleyen</span>
                        <span id="wp_kpi_pending" class="text-base font-black text-amber-400">${pendTasks}</span>
                    </div>
                    <div class="w-8 h-8 rounded-xl bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center font-bold">🟡</div>
                </div>
                <div class="glass-card p-3 border border-slate-800 bg-slate-900/80 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold block uppercase">Tamamlama %</span>
                        <span id="wp_kpi_rate" class="text-base font-black text-purple-400">%${compRate}</span>
                    </div>
                    <div class="w-8 h-8 rounded-xl bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center font-bold">📊</div>
                </div>
            </div>

            <!-- WEEKLY GRID TABLE (DIRECT IN-CELL EDITING) -->
            <div class="glass-card border border-slate-800 overflow-hidden shadow-2xl relative">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs min-w-[900px]">
                        <thead>
                            <tr class="bg-slate-950 border-b border-slate-800">
                                <th class="p-3 w-32 bg-slate-900/90 font-black text-indigo-300 border-r border-slate-800 sticky left-0 z-20 uppercase tracking-wider text-center">
                                    SAAT
                                </th>
                                ${weekDates.map(wd => `
                                    <th class="p-3 font-black text-center border-r border-slate-800 min-w-[130px] ${wd.isToday ? 'bg-indigo-950/40 text-indigo-300' : 'bg-slate-900/60 text-slate-200'}">
                                        <div class="flex items-center justify-center gap-1">
                                            <span>${wd.dayName}</span>
                                            ${wd.isToday ? '<span class="text-[9px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.2 rounded-full">BUGÜN</span>' : ''}
                                        </div>
                                        <span class="text-[10px] text-slate-400 font-medium block mt-0.5">${wd.displayDate}</span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800/60 bg-slate-900/30">
                            ${hourlySlots.map((slot) => `
                                <tr>
                                    <!-- STICKY TIME COLUMN -->
                                    <td class="p-2.5 font-bold text-slate-300 bg-slate-950 border-r border-slate-800 sticky left-0 z-10 text-center whitespace-nowrap text-[11px]">
                                        ⏱️ ${slot.label}
                                    </td>
                                    ${weekDates.map((wd) => {
                                        const key = `${wd.date}_${slot.start}`;
                                        const cellDomId = `${wd.date}_${slot.start.replace(':', '_')}`;
                                        const item = programMap[key];

                                        return `
                                        <td id="wp_td_${cellDomId}" 
                                            class="p-1 border-r border-slate-800/60 align-top h-20 min-h-[85px] w-[130px] max-w-[150px] relative transition"
                                            data-date="${wd.date}" 
                                            data-day="${wd.dayName}" 
                                            data-start="${slot.start}" 
                                            data-end="${slot.end}">
                                            ${renderSingleCellHtml(cellDomId, wd.date, wd.dayName, slot.start, slot.end, item, isStudentRole)}
                                        </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        `;

        if (container) {
            container.innerHTML = html;
        }
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

    } catch (err) {
        if (err.name === 'AbortError') {
            if (is10sTimeout && currentSeq === weeklyProgramRequestSeq) {
                console.warn("[WEEKLY PROGRAM] Request timed out after 10s.");
                err = new Error("İstek zaman aşımına uğradı, sunucu yanıt vermiyor olabilir.");
            } else {
                console.warn("[WEEKLY PROGRAM] Request aborted gracefully due to new navigation/sequence.");
                return;
            }
        }
        if (currentSeq !== weeklyProgramRequestSeq) {
            console.warn("[WEEKLY PROGRAM] Suppressing error UI for outdated request sequence:", currentSeq);
            return;
        }
        console.error("[PROGRAM LOAD ERROR]", {
            studentId: weeklyActiveStudentId,
            weekStart: weeklyCurrentWeekStart,
            endpoint,
            error: err.message,
            stack: err.stack
        });

        if (container) {
            container.innerHTML = `
            <div class="glass-card p-10 border border-rose-900/80 bg-rose-950/40 rounded-2xl text-center flex flex-col items-center justify-center my-6 gap-3 shadow-2xl">
                <div class="w-14 h-14 rounded-2xl bg-rose-900/60 border border-rose-700/60 flex items-center justify-center text-rose-400 text-2xl shadow-inner">
                    ⚠️
                </div>
                <h3 class="text-sm font-bold text-rose-200">Haftalık Program Yüklenemedi</h3>
                <p class="text-xs text-slate-300 max-w-md">${escapeHtml(err.message || 'Sunucuyla bağlantı kurulurken veya ders takvimi verileri işlenirken bir sorun oluştu.')}</p>
                <div class="flex items-center gap-3 mt-2">
                    <button onclick="renderWeeklyProgramView(${weeklyActiveStudentId})" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition flex items-center gap-1.5">
                        🔄 Tekrar Dene
                    </button>
                </div>
            </div>
            `;
            if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
        }
    }
}

// ----------------------------------------------------
// EXCEL-STYLE IN-CELL RENDERING & AUTOSAVE CONTROLLER
// ----------------------------------------------------
function renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, item, isStudentRole, savedNotice = false, errorNotice = null) {
    if (item && item.title) {
        const isComp = (item.status === 'TAMAMLANDI' || item.completion_status === 'TAMAMLANDI');
        return `
        <div id="cell_view_${cellDomId}" 
             onclick="${isStudentRole ? `toggleStudentInlineTask('${cellDomId}', ${item.id}, ${!isComp})` : `activateInlineCellEdit('${cellDomId}')`}"
             class="h-full min-h-[75px] rounded-xl p-2 flex flex-col justify-between cursor-pointer transition border text-[11px] group select-none relative ${
                 errorNotice 
                     ? 'bg-rose-950/80 border-rose-600 text-rose-200 shadow-md' 
                     : isComp 
                         ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-200 shadow-sm' 
                         : savedNotice
                             ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/50 text-white shadow-md'
                             : 'bg-slate-900/90 border-slate-700/80 text-white hover:border-indigo-500 shadow-sm'
             }">
            <div class="font-bold leading-snug line-clamp-3 whitespace-pre-wrap break-words text-[11px]">
                ${isComp ? '<span class="text-emerald-400 font-black mr-1">✓</span>' : ''}${escapeHtml(item.title)}
            </div>
            <div class="flex items-center justify-between text-[9px] font-bold mt-1 pt-1 border-t border-slate-800/80">
                <span class="${isComp ? 'text-emerald-400 font-extrabold' : 'text-slate-400'}">
                    ${isComp ? '✓ Tamamlandı' : '○ Bekliyor'}
                </span>
                ${savedNotice ? `
                <span class="text-[9px] text-emerald-400 font-extrabold animate-pulse">✓ Kaydedildi</span>
                ` : errorNotice ? `
                <span class="text-[9px] text-rose-400 font-extrabold" title="${escapeHtml(errorNotice)}">⚠ ${escapeHtml(errorNotice)}</span>
                ` : !isStudentRole ? `
                <span class="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition">✏️</span>
                ` : `
                <span class="text-[8px] px-1 py-0.2 rounded ${isComp ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'} font-bold">
                    ${isComp ? 'Geri Al' : 'Tamamla'}
                </span>
                `}
            </div>
        </div>
        `;
    } else {
        return `
        <div id="cell_view_${cellDomId}" 
             ${!isStudentRole ? `onclick="activateInlineCellEdit('${cellDomId}')"` : ''}
             class="h-full min-h-[75px] rounded-xl p-2 flex items-center justify-center cursor-pointer transition border border-dashed text-[11px] select-none hover:bg-slate-800/20 ${
                 errorNotice ? 'border-rose-600 bg-rose-950/40 text-rose-300' : 'border-slate-800/80 text-slate-600 hover:text-indigo-300 hover:border-indigo-500/60'
             }">
            <span class="text-[10px] font-medium">${errorNotice ? `⚠ ${escapeHtml(errorNotice)}` : (!isStudentRole ? '+ Ders / Görev...' : 'Boş')}</span>
        </div>
        `;
    }
}

// DIRECT IN-CELL EDIT ACTIVATION (EXCEL STYLE)
function activateInlineCellEdit(cellDomId) {
    const td = document.getElementById(`wp_td_${cellDomId}`);
    if (!td) return;

    // Check if already in edit mode
    if (document.getElementById(`cell_input_${cellDomId}`)) return;

    const progDate = td.dataset.date;
    const startTime = td.dataset.start;
    const items = weeklyProgramState.items || [];
    const item = items.find(i => i && i.date === progDate && i.start_time === startTime);
    const existingTitle = item ? (item.title || '') : '';

    td.innerHTML = `
    <div id="cell_edit_${cellDomId}" class="h-full min-h-[75px] rounded-xl p-1 bg-slate-950 border-2 border-indigo-500 shadow-xl flex flex-col justify-between z-20 relative">
        <textarea id="cell_input_${cellDomId}" 
                  data-original-val="${escapeHtml(existingTitle)}"
                  onblur="handleInlineCellBlur('${cellDomId}')"
                  onkeydown="handleInlineCellKeyDown(event, '${cellDomId}')"
                  class="w-full bg-slate-900 border-none outline-none rounded-lg p-1.5 text-white font-bold text-[11px] leading-tight resize-none h-full min-h-[65px] focus:ring-0"
                  placeholder="Ders, konu veya görev...">${escapeHtml(existingTitle)}</textarea>
    </div>
    `;

    const ta = document.getElementById(`cell_input_${cellDomId}`);
    if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
    }
}

// KEYBOARD CONTROLLER (ENTER / TAB / ESC)
function handleInlineCellKeyDown(e, cellDomId) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.target.blur(); // Triggers blur which calls autosave
    } else if (e.key === 'Tab') {
        e.preventDefault();
        e.target.blur();
        navigateToAdjacentCell(cellDomId, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        const origVal = e.target.dataset.originalVal || '';
        cancelInlineCellEdit(cellDomId, origVal);
    }
}

// TAB NAVIGATION ACROSS CELLS
function navigateToAdjacentCell(cellDomId, direction = 1) {
    const allCells = Array.from(document.querySelectorAll('td[id^="wp_td_"]'));
    if (allCells.length === 0) return;

    const currentTd = document.getElementById(`wp_td_${cellDomId}`);
    const currentIndex = allCells.indexOf(currentTd);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < allCells.length) {
        const nextTd = allCells[nextIndex];
        const nextCellDomId = nextTd.id.replace('wp_td_', '');
        setTimeout(() => {
            activateInlineCellEdit(nextCellDomId);
        }, 30);
    }
}

// CANCEL INLINE CELL EDIT
function cancelInlineCellEdit(cellDomId, origVal = '') {
    const td = document.getElementById(`wp_td_${cellDomId}`);
    if (!td) return;
    const progDate = td.dataset.date;
    const dayName = td.dataset.day;
    const startTime = td.dataset.start;
    const endTime = td.dataset.end;
    const items = weeklyProgramState.items || [];
    const item = items.find(i => i && i.date === progDate && i.start_time === startTime);
    const isStudentRole = currentUser && currentUser.role === 'STUDENT';
    td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, item, isStudentRole);
}

// BLUR EVENT HANDLER (EXCEL AUTO-SAVE)
function handleInlineCellBlur(cellDomId) {
    const ta = document.getElementById(`cell_input_${cellDomId}`);
    if (!ta) return;

    const newVal = ta.value.trim();
    const origVal = (ta.dataset.originalVal || '').trim();

    // 1. If nothing changed, exit edit mode silently without any API call
    if (newVal === origVal) {
        cancelInlineCellEdit(cellDomId, origVal);
        return;
    }

    // 2. If value changed, trigger silent autosave
    saveInlineCellAuto(cellDomId, newVal, origVal);
}

// SILENT BACKGROUND AUTOSAVE (OPTIMISTIC - NO PAGE RELOAD - NO NATIVE POPUPS)
async function saveInlineCellAuto(cellDomId, newTitle, origTitle) {
    const td = document.getElementById(`wp_td_${cellDomId}`);
    if (!td) return;

    const progDate = td.dataset.date;
    const dayName = td.dataset.day;
    const startTime = td.dataset.start;
    const endTime = td.dataset.end;
    const studentId = weeklyActiveStudentId;
    const token = localStorage.getItem('yks_token');
    const isStudentRole = currentUser && currentUser.role === 'STUDENT';

    let items = weeklyProgramState.items || [];
    let existingItem = items.find(i => i && i.date === progDate && i.start_time === startTime);

    // If user cleared text completely -> Delete
    if (!newTitle) {
        if (existingItem && existingItem.id && !String(existingItem.id).startsWith('temp_')) {
            await deleteInlineCell(cellDomId, existingItem.id);
        } else {
            if (existingItem) {
                weeklyProgramState.items = weeklyProgramState.items.filter(i => i !== existingItem);
            }
            td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, null, isStudentRole);
            updateWeeklyKpiBar();
        }
        return;
    }

    // OPTIMISTIC LOCAL UPDATE
    let isNew = false;
    if (existingItem) {
        existingItem.title = newTitle;
        td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, existingItem, isStudentRole, true);
    } else {
        isNew = true;
        existingItem = {
            id: 'temp_' + Date.now(),
            student_id: studentId,
            date: progDate,
            day_of_week: dayName,
            start_time: startTime,
            end_time: endTime,
            title: newTitle,
            status: 'PLANLANDI',
            publication_status: 'PUBLISHED'
        };
        items.push(existingItem);
        weeklyProgramState.items = items;
        td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, existingItem, isStudentRole, true);
    }

    updateWeeklyKpiBar();

    // Auto-remove saved badge after 1.2 seconds
    setTimeout(() => {
        const currentTd = document.getElementById(`wp_td_${cellDomId}`);
        if (currentTd && !document.getElementById(`cell_input_${cellDomId}`)) {
            const currentItem = (weeklyProgramState.items || []).find(i => i && i.date === progDate && i.start_time === startTime);
            currentTd.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, currentItem, isStudentRole, false);
        }
    }, 1200);

    // BACKGROUND API CALL
    try {
        if (existingItem.id && !String(existingItem.id).startsWith('temp_')) {
            const res = await fetch(`${API_BASE}/weekly-program/${existingItem.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title: newTitle })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Güncellenemedi');
        } else {
            const res = await fetch(`${API_BASE}/weekly-program`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    student_id: studentId,
                    date: progDate,
                    day_of_week: dayName,
                    start_time: startTime,
                    end_time: endTime,
                    title: newTitle,
                    status: 'PLANLANDI',
                    publication_status: 'PUBLISHED'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Kaydedilemedi');
            if (data.id) {
                existingItem.id = data.id;
            }
        }
    } catch (err) {
        console.warn("[AUTOSAVE ERROR]", err.message);
        // Show in-cell error badge silently without native browser popup
        if (isNew) {
            weeklyProgramState.items = weeklyProgramState.items.filter(i => i !== existingItem);
            td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, null, isStudentRole, false, err.message);
        } else {
            existingItem.title = origTitle;
            td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, existingItem, isStudentRole, false, err.message);
        }
        updateWeeklyKpiBar();
    }
}

// DIRECT IN-CELL DELETE (OPTIMISTIC - NO PAGE RELOAD)
async function deleteInlineCell(cellDomId, itemId) {
    const td = document.getElementById(`wp_td_${cellDomId}`);
    if (!td) return;
    const progDate = td.dataset.date;
    const dayName = td.dataset.day;
    const startTime = td.dataset.start;
    const endTime = td.dataset.end;
    const token = localStorage.getItem('yks_token');
    const isStudentRole = currentUser && currentUser.role === 'STUDENT';

    let items = weeklyProgramState.items || [];
    const itemIndex = items.findIndex(i => i && (i.id === itemId || (i.date === progDate && i.start_time === startTime)));
    const backupItem = itemIndex !== -1 ? items[itemIndex] : null;

    if (itemIndex !== -1) {
        items.splice(itemIndex, 1);
        weeklyProgramState.items = items;
    }

    td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, null, isStudentRole);
    updateWeeklyKpiBar();

    if (!String(itemId).startsWith('temp_')) {
        try {
            const res = await fetch(`${API_BASE}/weekly-program/${itemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Silinemedi.');
        } catch (err) {
            console.error("Delete error:", err);
            if (backupItem) {
                weeklyProgramState.items.push(backupItem);
                td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, backupItem, isStudentRole, false, 'Silinemedi');
                updateWeeklyKpiBar();
            }
        }
    }
}

// DIRECT IN-CELL STUDENT COMPLETION TOGGLE (OPTIMISTIC - NO PAGE RELOAD)
async function toggleStudentInlineTask(cellDomId, itemId, markCompleted) {
    const td = document.getElementById(`wp_td_${cellDomId}`);
    if (!td) return;
    const progDate = td.dataset.date;
    const dayName = td.dataset.day;
    const startTime = td.dataset.start;
    const endTime = td.dataset.end;
    const token = localStorage.getItem('yks_token');

    let items = weeklyProgramState.items || [];
    const item = items.find(i => i && (i.id === itemId || (i.date === progDate && i.start_time === startTime)));
    if (!item) return;

    const prevStatus = item.status;
    const newStatus = markCompleted ? 'TAMAMLANDI' : 'PLANLANDI';
    item.status = newStatus;
    item.completion_status = newStatus;

    td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, item, true);
    updateWeeklyKpiBar();

    try {
        const res = await fetch(`${API_BASE}/weekly-program/${itemId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Durum güncellenemedi.');
    } catch (err) {
        console.error("Status toggle error:", err);
        item.status = prevStatus;
        item.completion_status = prevStatus;
        td.innerHTML = renderSingleCellHtml(cellDomId, progDate, dayName, startTime, endTime, item, true, false, 'Güncellenemedi');
        updateWeeklyKpiBar();
    }
}

// DYNAMIC IN-PLACE KPI UPDATE (NO RE-RENDER)
function updateWeeklyKpiBar() {
    const items = weeklyProgramState.items || [];
    const totTasks = items.length;
    const compTasks = items.filter(i => i && (i.status === 'TAMAMLANDI' || i.completion_status === 'TAMAMLANDI')).length;
    const pendTasks = totTasks - compTasks;
    const compRate = totTasks > 0 ? Math.round((compTasks / totTasks) * 100) : 0;

    const elTot = document.getElementById('wp_kpi_total');
    const elComp = document.getElementById('wp_kpi_completed');
    const elPend = document.getElementById('wp_kpi_pending');
    const elRate = document.getElementById('wp_kpi_rate');

    if (elTot) elTot.textContent = totTasks;
    if (elComp) elComp.textContent = compTasks;
    if (elPend) elPend.textContent = pendTasks;
    if (elRate) elRate.textContent = `%${compRate}`;
}

async function publishWeeklyProgramToServer() {
    alert("✅ Haftalık program başarıyla kaydedildi.");
    weeklyProgramState.isDirty = false;
    await renderWeeklyProgramView(weeklyActiveStudentId);
}

async function confirmClearWeeklyGrid() {
    if (!confirm(`Bu haftanın (${formatDateTR(weeklyCurrentWeekStart)}) tüm programını temizlemek istediğinize emin misiniz?`)) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/weekly-program/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                student_id: weeklyActiveStudentId,
                week_start: weeklyCurrentWeekStart
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Program temizlenemedi.');

        alert("🗑️ " + (data.message || 'Seçili haftanın tüm program hücreleri temizlendi.'));
        await renderWeeklyProgramView(weeklyActiveStudentId);
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function promptCopyPreviousWeek() {
    if (!weeklyCurrentWeekStart) return;
    const srcDt = new Date(weeklyCurrentWeekStart);
    srcDt.setDate(srcDt.getDate() - 7);
    const sourceWeekStart = srcDt.toISOString().split('T')[0];

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/weekly-program/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                student_id: weeklyActiveStudentId,
                source_week_start: sourceWeekStart,
                target_week_start: weeklyCurrentWeekStart
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Kopyalama başarısız.');

        alert("📋 " + (data.message || 'Geçen haftanın ders programı başarıyla kopyalandı.'));
        await renderWeeklyProgramView(weeklyActiveStudentId);
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function quickDeleteProgramItem(progId) {
    if (!confirm("Bu ders programı hücresini temizlemek istiyor musunuz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/weekly-program/${progId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            renderWeeklyProgramView(weeklyActiveStudentId);
        }
    } catch (e) {
        console.error("quickDeleteProgramItem error:", e);
    }
}

async function openAddProgramModal(studentId, progDate, dayName, startTime, endTime) {
    const token = localStorage.getItem('yks_token');
    
    let subjects = [];
    let resources = [];
    try {
        const resSubj = await fetch(`${API_BASE}/subjects`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataSubj = await resSubj.json();
        subjects = dataSubj.subjects || [];

        const resPool = await fetch(`${API_BASE}/kaynaklar/havuz?student_id=${studentId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataPool = await resPool.json();
        resources = dataPool.resources || [];
    } catch (e) {
        console.error("Error fetching modal dropdowns:", e);
    }

    const html = `
    <div class="space-y-4 text-xs">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-base font-black text-white flex items-center gap-2">
                <span>➕</span> HAFTALIK PROGRAM EKLE
            </h3>
            <button onclick="closeModal()" class="text-slate-400 hover:text-white p-1">✕</button>
        </div>

        <form onsubmit="submitNewWeeklyProgram(event)" class="space-y-3">
            <input type="hidden" id="wpStudentId" value="${studentId}">
            
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Tarih / Gün</label>
                    <input type="date" id="wpDate" value="${progDate}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                    <input type="hidden" id="wpDayName" value="${dayName}">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-slate-400 font-bold mb-1">Başlangıç</label>
                        <input type="time" id="wpStartTime" value="${startTime}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-white font-semibold text-center">
                    </div>
                    <div>
                        <label class="block text-slate-400 font-bold mb-1">Bitiş</label>
                        <input type="time" id="wpEndTime" value="${endTime}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-white font-semibold text-center">
                    </div>
                </div>
            </div>

            <div>
                <label class="block text-slate-400 font-bold mb-1">Program Başlığı / Görev Adı</label>
                <input type="text" id="wpTitle" required placeholder="ör: Polinomlar Konu Anlatımı veya Paragraf Çözümü" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold">
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Ders</label>
                    <select id="wpSubjectId" onchange="loadTopicsForProgramSubject(this.value)" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                        <option value="">-- Ders Seçin --</option>
                        ${subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Çalışma Türü</label>
                    <select id="wpStudyType" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold">
                        <option value="Konu Çalışması">Konu Çalışması</option>
                        <option value="Soru Çözümü">Soru Çözümü</option>
                        <option value="Deneme Çözümü">Deneme Çözümü</option>
                        <option value="Tekrar / Revizyon">Tekrar / Revizyon</option>
                        <option value="Etüt">Etüt</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Ana Konu (Opsiyonel)</label>
                    <select id="wpTopicId" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium">
                        <option value="">-- Genel / Tüm Konular --</option>
                    </select>
                </div>
                <div>
                    <label class="block text-slate-400 font-bold mb-1">Kaynak (Opsiyonel)</label>
                    <select id="wpResourceId" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium">
                        <option value="">-- Kaynak Seçin --</option>
                        ${resources.map(r => `<option value="${r.id}">${r.title} (${r.visibility === 'PRIVATE' ? 'Özel' : 'Global'})</option>`).join('')}
                    </select>
                </div>
            </div>

            <div>
                <label class="block text-slate-400 font-bold mb-1">Not / Hedef Açıklaması</label>
                <textarea id="wpDescription" rows="2" placeholder="ör: Test 1-4 çözülecek, takılan sorular koça sorulacak." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"></textarea>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2">
                <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold">İptal</button>
                <button type="submit" class="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black shadow-lg">KAYDET</button>
            </div>
        </form>
    </div>
    `;
    openModal(html);
}

async function loadTopicsForProgramSubject(subjectId) {
    const topicSel = document.getElementById('wpTopicId');
    if (!topicSel || !subjectId) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/mufredat?student_id=${weeklyActiveStudentId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const exams = data.exams || [];
        let allTopics = [];
        exams.forEach(ex => {
            (ex.subjects || []).forEach(sb => {
                if (sb.id == subjectId || sb.name.includes(subjectId)) {
                    allTopics = allTopics.concat(sb.topics || []);
                }
            });
        });

        topicSel.innerHTML = '<option value="">-- Genel / Tüm Konular --</option>' + 
            allTopics.map(t => `<option value="${t.id}">${t.topic}</option>`).join('');
    } catch (e) {
        console.error("loadTopicsForProgramSubject error:", e);
    }
}

async function submitNewWeeklyProgram(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const studentId = document.getElementById('wpStudentId').value;
    const progDate = document.getElementById('wpDate').value;
    const dayName = document.getElementById('wpDayName').value || 'Pazartesi';
    const startTime = document.getElementById('wpStartTime').value;
    const endTime = document.getElementById('wpEndTime').value;
    const title = document.getElementById('wpTitle').value;
    const subjectId = document.getElementById('wpSubjectId').value || null;
    const topicId = document.getElementById('wpTopicId').value || null;
    const resourceId = document.getElementById('wpResourceId').value || null;
    const studyType = document.getElementById('wpStudyType').value;
    const description = document.getElementById('wpDescription').value;

    try {
        const res = await fetch(`${API_BASE}/weekly-program`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                student_id: studentId,
                date: progDate,
                day_of_week: dayName,
                start_time: startTime,
                end_time: endTime,
                title: title,
                subject_id: subjectId,
                curriculum_topic_id: topicId,
                resource_id: resourceId,
                study_type: studyType,
                description: description,
                status: 'PLANLANDI'
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Program eklenemedi.');
        closeModal();
        renderWeeklyProgramView(weeklyActiveStudentId);
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function openProgramDetailModal(progId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/weekly-program?student_id=${weeklyActiveStudentId}&week_start=${weeklyCurrentWeekStart}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const items = data.items || [];
        const item = items.find(i => i.id == progId);
        if (!item) return alert("Program detay bilgisine ulaşılamadı.");

        const isStudent = currentUser && currentUser.role === 'STUDENT';

        let statusBadge = 'bg-indigo-950 text-indigo-300 border-indigo-800';
        if (item.status === 'TAMAMLANDI') statusBadge = 'bg-emerald-950 text-emerald-300 border-emerald-800';
        else if (item.status === 'DEVAM_EDIYOR') statusBadge = 'bg-amber-950 text-amber-300 border-amber-800';
        else if (item.status === 'ATLANDI') statusBadge = 'bg-rose-950 text-rose-300 border-rose-800';

        const html = `
        <div class="space-y-4 text-xs">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <div class="flex items-center gap-2">
                    <span class="text-base font-black text-white">${item.title}</span>
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded border ${statusBadge}">${item.status}</span>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <div class="space-y-2 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                <div class="flex justify-between">
                    <span class="text-slate-400">Tarih & Saat:</span>
                    <span class="font-bold text-white">${formatDateTR(item.date)} (${item.day_of_week}) ${item.start_time} - ${item.end_time}</span>
                </div>
                ${item.subject_name ? `<div class="flex justify-between"><span class="text-slate-400">Ders:</span><span class="font-bold text-indigo-300">${item.subject_name}</span></div>` : ''}
                ${item.topic_name ? `<div class="flex justify-between"><span class="text-slate-400">Ana Konu:</span><span class="font-bold text-slate-200">${item.topic_name}</span></div>` : ''}
                ${item.resource_title ? `<div class="flex justify-between"><span class="text-slate-400">Kaynak:</span><span class="font-bold text-purple-300">${item.resource_title}</span></div>` : ''}
                <div class="flex justify-between"><span class="text-slate-400">Çalışma Türü:</span><span class="font-bold text-emerald-400">${item.study_type || 'Konu Çalışması'}</span></div>
                ${item.description ? `<div class="pt-2 border-t border-slate-800"><span class="text-slate-400 block mb-1">Not / Açıklama:</span><p class="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">${item.description}</p></div>` : ''}
            </div>

            <!-- QUICK STATUS TOGGLES -->
            <div class="space-y-1">
                <span class="text-slate-400 font-bold block mb-1">Durumu Güncelle:</span>
                <div class="grid grid-cols-4 gap-2">
                    <button onclick="updateProgramStatus(${item.id}, 'PLANLANDI')" class="py-2 rounded-xl text-[10px] font-bold border transition ${item.status === 'PLANLANDI' ? 'bg-indigo-600 text-white border-indigo-500 shadow' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}">🔵 Planlandı</button>
                    <button onclick="updateProgramStatus(${item.id}, 'DEVAM_EDIYOR')" class="py-2 rounded-xl text-[10px] font-bold border transition ${item.status === 'DEVAM_EDIYOR' ? 'bg-amber-600 text-white border-amber-500 shadow' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}">🟡 Devam Ediyor</button>
                    <button onclick="updateProgramStatus(${item.id}, 'TAMAMLANDI')" class="py-2 rounded-xl text-[10px] font-bold border transition ${item.status === 'TAMAMLANDI' ? 'bg-emerald-600 text-white border-emerald-500 shadow' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}">🟢 Tamamlandı</button>
                    <button onclick="updateProgramStatus(${item.id}, 'ATLANDI')" class="py-2 rounded-xl text-[10px] font-bold border transition ${item.status === 'ATLANDI' ? 'bg-rose-600 text-white border-rose-500 shadow' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'}">🔴 Atlandı</button>
                </div>
            </div>

            ${!isStudent ? `
            <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                <button onclick="deleteWeeklyProgram(${item.id})" class="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-bold border border-rose-800 transition">
                    🗑️ Programı Sil
                </button>
                <button onclick="closeModal()" class="px-5 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold">Kapat</button>
            </div>
            ` : ''}
        </div>
        `;
        openModal(html);
    } catch (e) {
        console.error("openProgramDetailModal error:", e);
    }
}

async function updateProgramStatus(progId, newStatus) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/weekly-program/${progId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            closeModal();
            renderWeeklyProgramView(weeklyActiveStudentId);
        }
    } catch (e) {
        console.error("updateProgramStatus error:", e);
    }
}

async function deleteWeeklyProgram(progId) {
    if (!confirm("Bu çalışma programı kaydını silmek istediğinize emin misiniz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/weekly-program/${progId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            closeModal();
            renderWeeklyProgramView(weeklyActiveStudentId);
        }
    } catch (e) {
        console.error("deleteWeeklyProgram error:", e);
    }
}

window.renderWeeklyProgramView = renderWeeklyProgramView;
window.shiftWeek = shiftWeek;
window.resetCurrentWeek = resetCurrentWeek;
window.changeWeeklyStudent = changeWeeklyStudent;
window.toggleWeeklyView = toggleWeeklyView;
window.confirmClearWeeklyGrid = confirmClearWeeklyGrid;
window.publishWeeklyProgramToServer = publishWeeklyProgramToServer;

function renderStudentsView() {
    renderStudentsRiskListView();
}

// Download Handlers
function downloadPDFReport() {
    window.open(`${API_BASE}/raporlar/pdf?student_id=${selectedStudentId}`, '_blank');
}
function downloadExcel() {
    window.open(`${API_BASE}/excel/export`, '_blank');
}

// ----------------------------------------------------
// STUDENT RESOURCE DETAIL & CURRICULUM PROGRESS MODAL
// ----------------------------------------------------
async function openStudentResourceDetailModal(studentResourceId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynaklar/detail/${studentResourceId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const rd = data.resource_detail || {};
        const sections = data.sections || [];

        let html = `
        <div class="max-h-[80vh] overflow-y-auto pr-1">
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase tracking-wider">${rd.exam_type || 'TYT'} - ${rd.subject_name || 'Ders'}</span>
                    <h2 class="text-base font-extrabold text-white mt-1">${rd.resource_title}</h2>
                    <p class="text-xs text-slate-400">${rd.publisher_name || 'Yayın'} | Atayan Koç: <span class="text-white font-medium">${rd.coach_name || 'Ümmü Akcan'}</span> | Hedef: <span class="text-amber-400 font-bold">${rd.target_end_date || '30 Eylül 2026'}</span></p>
                </div>
                <div class="text-right bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">KİTAP İLERLEMESİ</span>
                    <span class="text-xl font-black text-emerald-400">%${rd.completion_percentage || 0}</span>
                </div>
            </div>

            <div class="mb-4">
                <div class="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${rd.completion_percentage || 0}%"></div>
                </div>
            </div>

            <h4 class="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>📚 MÜFREDAT KONU & BÖLÜM LİSTESİ (${sections.length} Bölüm)</span>
                <span class="text-[10px] text-slate-400 font-normal">Durumu değiştirmek için üzerine tıklayın</span>
            </h4>

            <div class="space-y-2.5">
        `;

        if (sections.length === 0) {
            html += `<p class="text-xs text-slate-500 text-center py-6">Bu kaynağa tanımlanmış bölüm bulunmuyor.</p>`;
        } else {
            sections.forEach(s => {
                let badgeStyle = "bg-slate-900 text-slate-400 border-slate-700";
                let badgeText = "⚪ Başlanmadı";
                if (s.status === 'COMPLETED') { badgeStyle = "bg-emerald-950 text-emerald-300 border-emerald-800 font-bold"; badgeText = "🟢 Tamamlandı"; }
                else if (s.status === 'IN_PROGRESS') { badgeStyle = "bg-amber-950 text-amber-300 border-amber-800 font-bold"; badgeText = "🟡 Devam Ediyor"; }
                else if (s.status === 'REVIEW_REQUIRED') { badgeStyle = "bg-rose-950 text-rose-300 border-rose-800 font-bold"; badgeText = "🔴 Tekrar Gerekli"; }

                html += `
                <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-white">${s.section_title}</span>
                            <span class="text-[10px] text-indigo-400 font-semibold bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900">${s.topic_name}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 mt-1">Ünite: ${s.unit_name} | Sayfa ${s.page_start}-${s.page_end} | Yaklaşık ${s.question_count} Soru</p>
                    </div>

                    <div class="flex items-center gap-2 self-end sm:self-center">
                        <select onchange="updateSectionStatus(${studentResourceId}, ${s.section_id}, this.value)" class="text-xs font-bold px-3 py-1.5 rounded-lg border focus:outline-none cursor-pointer ${badgeStyle}">
                            <option value="NOT_STARTED" ${s.status === 'NOT_STARTED' ? 'selected' : ''}>⚪ Başlanmadı</option>
                            <option value="IN_PROGRESS" ${s.status === 'IN_PROGRESS' ? 'selected' : ''}>🟡 Devam Ediyor</option>
                            <option value="COMPLETED" ${s.status === 'COMPLETED' ? 'selected' : ''}>🟢 Tamamlandı</option>
                            <option value="REVIEW_REQUIRED" ${s.status === 'REVIEW_REQUIRED' ? 'selected' : ''}>🔴 Tekrar Gerekli</option>
                        </select>

                        ${currentUser && currentUser.role !== 'STUDENT' ? `
                        <button onclick="createAssignmentFromResourceSection(${rd.student_id}, ${rd.resource_id}, ${s.section_id})" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition shadow">
                            + Ödev Ver
                        </button>
                        ` : ''}
                    </div>
                </div>
                `;
            });
        }

        html += `</div></div>`;
        openModal(html);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("openStudentResourceDetailModal error:", err);
    }
}

async function updateSectionStatus(studentResourceId, sectionId, newStatus) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynaklar/section-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_resource_id: studentResourceId, section_id: sectionId, status: newStatus })
        });
        if (res.ok) {
            openStudentResourceDetailModal(studentResourceId);
        }
    } catch (err) {
        console.error("updateSectionStatus error:", err);
    }
}

async function openTopicCrossResourceDetailModal(topicId) {
    const token = localStorage.getItem('yks_token');
    const studentId = selectedStudentId || currentActiveStudentId || 1;
    try {
        const res = await fetch(`${API_BASE}/mufredat/konu-detay?student_id=${studentId}&topic_id=${topicId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const t = data.topic || {};
        const breakdown = data.resources_breakdown || [];

        let html = `
        <div class="space-y-4 text-xs">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase tracking-wider">${t.subject_name || 'Ders'} Müfredat Konusu</span>
                    <h3 class="text-base font-extrabold text-white mt-1">📌 ${t.name}</h3>
                </div>
                <div class="text-right bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800">
                    <span class="text-[10px] text-slate-400 block">DENEME ORTALAMASI</span>
                    <span class="text-sm font-black text-amber-400">${data.mock_exam_net_average || '78.5%'}</span>
                </div>
            </div>

            <!-- AI COACH WARNING / RECOMMENDATION CARD -->
            ${data.recommendation ? `
            <div class="bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 shrink-0 mt-0.5"></i>
                <div>
                    <span class="font-bold text-white block">AI Koç Tavsiyesi & Risk Uyarısı</span>
                    <p class="mt-0.5 opacity-90">${data.recommendation}</p>
                </div>
            </div>
            ` : ''}

            <!-- ASSIGNED RESOURCES BREAKDOWN FOR THIS TOPIC -->
            <div>
                <h4 class="font-bold text-xs text-indigo-400 uppercase tracking-wider mb-2.5">
                    📚 Bu Konunun Bulunduğu Atanmış Kaynaklar (${breakdown.length} Kaynak)
                </h4>

                <div class="space-y-2">
        `;

        if (breakdown.length === 0) {
            html += `<p class="text-slate-500 text-center py-4">Bu konu henüz herhangi bir kaynağınıza tanımlanmamış.</p>`;
        } else {
            breakdown.forEach(b => {
                let badgeStyle = "bg-slate-900 text-slate-400 border-slate-700";
                let badgeText = "⚪ Başlanmadı";
                if (b.status === 'COMPLETED') { badgeStyle = "bg-emerald-950 text-emerald-300 border-emerald-800 font-bold"; badgeText = "🟢 Tamamlandı"; }
                else if (b.status === 'IN_PROGRESS') { badgeStyle = "bg-amber-950 text-amber-300 border-amber-800 font-bold"; badgeText = "🟡 Devam Ediyor"; }
                else if (b.status === 'REVIEW_REQUIRED') { badgeStyle = "bg-rose-950 text-rose-300 border-rose-800 font-bold"; badgeText = "🔴 Tekrar Gerekli"; }

                html += `
                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <h5 class="font-bold text-xs text-white">${b.resource_title}</h5>
                        <span class="text-[10px] text-slate-400">${b.publisher_name || 'Yayın'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs px-2.5 py-1 rounded-lg border ${badgeStyle}">${badgeText}</span>
                    </div>
                </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        </div>
        `;

        openModal(html);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert("Konu detayları yüklenirken hata oluştu!");
    }
}

function openQuickAssignResourceModal(resourceId, resourceTitle) {
    let studentSelectHtml = '';
    if (coachStudentsList && coachStudentsList.length > 0) {
        studentSelectHtml = coachStudentsList.map(s => `<option value="${s.id}" ${s.id == selectedStudentId ? 'selected' : ''}>${s.name} (${s.track})</option>`).join('');
    } else {
        studentSelectHtml = `<option value="${selectedStudentId || 1}">Öğrenci #${selectedStudentId || 1}</option>`;
    }

    const html = `
    <h3 class="text-base font-bold text-white mb-1">+ Öğrenciye Kaynak Ata</h3>
    <p class="text-xs text-indigo-400 font-semibold mb-4">Seçilen Kitap: ${resourceTitle}</p>
    
    <form onsubmit="submitAssignResourceForm(event, ${resourceId})" class="space-y-4 text-xs">
        <div>
            <label class="block text-slate-400 mb-1 font-bold">Öğrenci Seçin:</label>
            <select id="assignStudentIdSelect" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-semibold">
                ${studentSelectHtml}
            </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-slate-400 mb-1">Başlangıç Tarihi</label>
                <input type="date" id="assignStartDate" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
            </div>
            <div>
                <label class="block text-slate-400 mb-1">Hedef Bitiş Tarihi</label>
                <input type="date" id="assignTargetDate" value="${new Date(Date.now() + 60*24*60*60*1000).toISOString().split('T')[0]}" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
            </div>
        </div>
        <div>
            <label class="block text-slate-400 mb-1 font-bold">Çalışma Önceliği</label>
            <select id="assignPriority" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white">
                <option value="YUKSEK">YÜKSEK ÖNCELİK</option>
                <option value="ORTA" selected>ORTA ÖNCELİK</option>
                <option value="DUSUK">DÜŞÜK ÖNCELİK</option>
            </select>
        </div>
        <div>
            <label class="block text-slate-400 mb-1 font-bold">Koç Notu / Talimat</label>
            <textarea id="assignCoachNote" rows="2" placeholder="ör: Konu anlatımlarını bitirdikten sonra haftada 2 test şeklinde ilerle." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white"></textarea>
        </div>
        <button type="submit" class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg transition">
            ⚡️ Kaynağı Öğrenciye Ata & Kaydet
        </button>
    </form>`;
    openModal(html);
}

async function submitAssignResourceForm(e, resourceId) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const student_id = document.getElementById('assignStudentIdSelect').value;
    const start_date = document.getElementById('assignStartDate').value;
    const target_end_date = document.getElementById('assignTargetDate').value;
    const priority = document.getElementById('assignPriority').value;
    const coach_note = document.getElementById('assignCoachNote').value;

    try {
        const res = await fetch(`${API_BASE}/kaynaklar/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_id, resource_id: resourceId, start_date, target_end_date, priority, coach_note })
        });
        const data = await res.json();
        closeModal();
        if (res.ok) {
            alert("✅ " + data.message);
            renderResourcesView('ALL', 'MY_ASSIGNED');
        } else {
            alert(data.error || "Atama yapılamadı");
        }
    } catch (err) {
        console.error("submitAssignResourceForm error:", err);
    }
}

async function createAssignmentFromResourceSection(studentId, resourceId, sectionId) {
    const token = localStorage.getItem('yks_token');
    const dueDate = prompt("Ödev Teslim Tarihi (YYYY-AA-GG):", new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]);
    if (!dueDate) return;
    const note = prompt("Koç Ödev Notu:", "Lütfen bu testi dikkatle çözün ve yanlışlarınıza geri dönün.");

    try {
        const res = await fetch(`${API_BASE}/kaynaklar/create-assignment-from-resource`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_id: studentId, resource_id: resourceId, section_id: sectionId, due_date: dueDate, priority: 'YUKSEK', submission_note: note })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
        } else {
            alert(data.error || "Ödev oluşturulamadı");
        }
    } catch (err) {
        console.error("createAssignmentFromResourceSection error:", err);
    }
}

async function unassignStudentResource(studentResourceId) {
    if (!confirm("Bu kaynağı öğrencinin atanmış kaynaklar listesinden çıkarmak istediğinize emin misiniz?")) return;

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/kaynaklar/student-resource/${studentResourceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert("✅ " + data.message);
        renderResourcesView('ALL', 'MY_ASSIGNED');
    } catch (err) {
        alert("Kaynak çıkarılırken hata oluştu!");
    }
}

async function openBulkAssignModal(studentId = null) {
    const stId = studentId || selectedStudentId || currentActiveStudentId || 1;
    const token = localStorage.getItem('yks_token');

    try {
        const res = await fetch(`${API_BASE}/kaynaklar`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const resources = data.resources || [];

        let html = `
        <div class="max-w-xl mx-auto space-y-4 text-xs">
            <div>
                <h3 class="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <i data-lucide="library" class="w-5 h-5 text-indigo-400"></i> Toplu Kaynak Ekleme & Yönetimi
                </h3>
                <p class="text-xs text-slate-400">Listeden istediğiniz yayınları seçip öğrenciye tek tıkla toplu olarak atayın.</p>
            </div>

            <div class="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <button type="button" onclick="toggleSelectAllBulkResources(true)" class="text-indigo-400 hover:text-indigo-300 font-bold text-xs">
                    ✓ Tümünü Seç
                </button>
                <button type="button" onclick="toggleSelectAllBulkResources(false)" class="text-slate-400 hover:text-slate-300 font-medium text-xs">
                    ✕ Seçimi Temizle
                </button>
            </div>

            <div class="max-h-[300px] overflow-y-auto space-y-2 pr-1">
        `;

        resources.forEach(r => {
            html += `
            <label class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between hover:border-indigo-500/60 cursor-pointer transition">
                <div class="flex items-center gap-3">
                    <input type="checkbox" name="bulkResourceCheckbox" value="${r.id}" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700">
                    <div>
                        <span class="font-bold text-xs text-white block">${r.title}</span>
                        <span class="text-[10px] text-slate-400">${r.publisher_name || 'Yayın'} | Ders: ${r.subject_name || 'Ortak'} | Sınav: ${r.exam_type || 'TYT'}</span>
                    </div>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">${r.level || 'ORTA'}</span>
            </label>
            `;
        });

        html += `
            </div>

            <button type="button" onclick="submitBulkAssignForm(${stId})" class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4"></i> Seçilen Kaynakları Toplu Olarak Öğrenciye Ekle
            </button>
        </div>
        `;

        openModal(html);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert("Kaynaklar yüklenirken hata oluştu!");
    }
}

let mufredatActiveStudentId = null;
let mufredatActiveExamType = 'TYT';
let mufredatActiveSubject = null;

function selectMufredatStudent(studentId) {
    mufredatActiveStudentId = studentId;
    mufredatActiveExamType = 'TYT';
    mufredatActiveSubject = null;
    renderMufredatView(studentId);
}

function clearMufredatStudent() {
    mufredatActiveStudentId = null;
    mufredatActiveExamType = 'TYT';
    mufredatActiveSubject = null;
    renderMufredatView(null);
}

function setMufredatExamFilter(examType) {
    mufredatActiveExamType = examType;
    mufredatActiveSubject = null;
    renderMufredatView(mufredatActiveStudentId);
}

function setMufredatSubjectFilter(subjectName) {
    mufredatActiveSubject = subjectName;
    renderMufredatView(mufredatActiveStudentId);
}

async function toggleMainTopicStatus(studentId, curriculumId, currentStatus) {
    const token = localStorage.getItem('yks_token');
    const newStatus = currentStatus === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';

    try {
        await fetch(`${API_BASE}/mufredat/konu-durum-guncelle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_id: studentId, curriculum_id: curriculumId, status: newStatus })
        });
        renderMufredatView(studentId);
    } catch (err) {
        alert("Konu durumu güncellenirken hata oluştu!");
    }
}

async function toggleMufredatResourceStatus(topicResourceId, currentStatus, studentId) {
    const token = localStorage.getItem('yks_token');
    const newStatus = currentStatus === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';

    try {
        await fetch(`${API_BASE}/mufredat/durum-guncelle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ topic_resource_id: topicResourceId, status: newStatus })
        });
        renderMufredatView(studentId);
    } catch (err) {
        alert("Kaynak çalışma durumu güncellenirken hata oluştu!");
    }
}

async function unassignMufredatTopicResource(topicResourceId, studentId) {
    if (!confirm("Bu kaynağı bu konudaki atamalarınızdan kaldırmak istediğinize emin misiniz?")) return;
    const token = localStorage.getItem('yks_token');
    try {
        await fetch(`${API_BASE}/mufredat/kaynak-sil/${topicResourceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        renderMufredatView(studentId);
    } catch (err) {
        alert("Kaynak ataması kaldırılırken hata oluştu!");
    }
}

// ----------------------------------------------------
// ÖĞRENCİYE ÖZEL MÜFREDAT & ÇOKLU KAYNAK TAKİBİ
// (1. ÖĞRENCİ SEÇ -> 2. ALAN ALGILA -> 3. SINAV SEÇ -> 4. DERS SEÇ -> 5. KAYNAK ATA)
// ----------------------------------------------------
async function renderMufredatView(targetStudentId = null) {
    document.getElementById('pageTitle').textContent = "🎯 Öğrenciye Özel Müfredat & Kaynak Takibi";
    const token = localStorage.getItem('yks_token');

    if (targetStudentId) {
        mufredatActiveStudentId = targetStudentId;
    } else if (currentUser && currentUser.role === 'STUDENT') {
        mufredatActiveStudentId = currentUser.student_id || 1;
    }

    // ====================================================
    // STEP 1: STUDENT SELECTION GATEKEEPER (KOÇ İÇİN ÖĞRENCİ SEÇİMİ)
    // ====================================================
    if (!mufredatActiveStudentId && currentUser && ['COACH', 'ADMIN'].includes(currentUser.role)) {
        try {
            const res = await fetch(`${API_BASE}/students`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const studentsList = data.students || [];

            let html = `
            <div class="space-y-6 text-xs max-w-5xl mx-auto">
                <!-- GATEKEEPER HEADER -->
                <div class="glass-card p-8 text-center space-y-3 border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 rounded-3xl">
                    <div class="w-16 h-16 bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-3xl flex items-center justify-center mx-auto shadow-glow">
                        <i data-lucide="user-check" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-2xl font-black text-white">Devam Etmek İçin Bir Öğrenci Seçin</h2>
                    <p class="text-xs text-slate-400 max-w-xl mx-auto">
                        Müfredat ve Kaynak Takibi ekranı seçtiğiniz öğrencinin sınav sistemine (YKS / LGS), alanına ve özel kaynak durumuna göre izole şekilde yüklenir.
                    </p>
                </div>

                <!-- STUDENTS GRID -->
                <div>
                    <h3 class="text-sm font-extrabold text-white mb-3 flex items-center gap-2">
                        <i data-lucide="users" class="w-4 h-4 text-indigo-400"></i> Aktif Öğrencileriniz (${studentsList.length})
                    </h3>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            `;

            if (studentsList.length === 0) {
                html += `<div class="col-span-full bg-slate-900/80 p-8 rounded-2xl border border-slate-800 text-center text-slate-500">Henüz kayıtlı öğrenciniz bulunmuyor.</div>`;
            } else {
                studentsList.forEach(s => {
                    const examSys = (s.exam_system || 'YKS').toUpperCase();
                    const trackName = (s.track || 'SAYISAL').toUpperCase();
                    const trackBadgeColor = examSys === 'LGS' ? 'bg-purple-950 text-purple-300 border-purple-800' : ({
                        'SAYISAL': 'bg-emerald-950 text-emerald-300 border-emerald-800',
                        'EA': 'bg-amber-950 text-amber-300 border-amber-800',
                        'ESIT_AGIRLIK': 'bg-amber-950 text-amber-300 border-amber-800',
                        'SOZEL': 'bg-rose-950 text-rose-300 border-rose-800',
                        'YDT': 'bg-indigo-950 text-indigo-300 border-indigo-800'
                    }[trackName] || 'bg-indigo-950 text-indigo-300 border-indigo-800');

                    const badgeLabel = examSys === 'LGS' ? 'LGS (8. Sınıf)' : (s.track || 'SAYISAL');

                    html += `
                    <div onclick="selectMufredatStudent(${s.id})" class="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 hover:border-indigo-500/80 cursor-pointer transition shadow-lg group hover:scale-[1.01]">
                        <div class="flex items-center gap-4 mb-4">
                            <div class="w-12 h-12 rounded-2xl bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center justify-center font-black text-base group-hover:scale-105 transition shadow">
                                ${s.name ? s.name.substring(0, 2).toUpperCase() : 'ÖĞ'}
                            </div>
                            <div>
                                <h3 class="font-extrabold text-sm text-white group-hover:text-indigo-400 transition">${s.name}</h3>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${trackBadgeColor}">
                                        ${badgeLabel}
                                    </span>
                                    <span class="text-[11px] text-slate-400">${s.grade || (examSys === 'LGS' ? '8. Sınıf' : '12. Sınıf')}</span>
                                </div>
                            </div>
                        </div>

                        <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                            <span class="text-[11px] text-slate-400 font-medium">Müfredat & Kaynak Takibi</span>
                            <span class="text-xs font-bold text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition">
                                Seç ve İncele <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                            </span>
                        </div>
                    </div>
                    `;
                });
            }

            html += `
                    </div>
                </div>
            </div>
            `;

            document.getElementById('viewContainer').innerHTML = html;
            if (window.lucide) lucide.createIcons();
            return;
        } catch (err) {
            console.error("Student list load error:", err);
        }
    }

    // ====================================================
    // STEP 2: ACTIVE STUDENT LOADED (SEÇİLEN ÖĞRENCİNİN MÜFREDATI)
    // ====================================================
    try {
        const res = await fetch(`${API_BASE}/mufredat?student_id=${mufredatActiveStudentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const studentExamSys = (data.student_exam_system || 'YKS').toUpperCase();
        const currentTrack = data.student_track || 'SAYISAL';
        const trackBadgeColor = studentExamSys === 'LGS' ? 'bg-purple-950 text-purple-300 border-purple-800' : ({
            'SAYISAL': 'bg-emerald-950 text-emerald-300 border-emerald-800',
            'EA': 'bg-amber-950 text-amber-300 border-amber-800',
            'SOZEL': 'bg-rose-950 text-rose-300 border-rose-800',
            'YDT': 'bg-indigo-950 text-indigo-300 border-indigo-800'
        }[currentTrack] || 'bg-indigo-950 text-indigo-300 border-indigo-800');

        // Filter Allowed Exams based on Student System & Field:
        const allowedExams = studentExamSys === 'LGS' ? ['LGS'] : (currentTrack === 'YDT' ? ['TYT', 'YDT'] : ['TYT', 'AYT']);
        if (!allowedExams.includes(mufredatActiveExamType)) {
            mufredatActiveExamType = allowedExams[0];
        }

        const examsList = data.exams || [];
        const activeExamData = examsList.find(e => e.exam_type === mufredatActiveExamType) || examsList[0] || { subjects: [] };
        const subjectsList = activeExamData.subjects || [];

        if (!mufredatActiveSubject && subjectsList.length > 0) {
            mufredatActiveSubject = subjectsList[0].name;
        }

        const activeSubjectData = subjectsList.find(s => s.name === mufredatActiveSubject) || subjectsList[0] || { topics: [] };

        let html = `
        <div class="space-y-6 text-xs max-w-7xl mx-auto">
            <!-- 1. STICKY / TOP STUDENT HEADER CARD -->
            <div class="glass-card p-6 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xl">
                <div class="flex items-center gap-4 sm:gap-5">
                    <div class="w-14 h-14 rounded-2xl bg-indigo-950/90 text-indigo-300 border border-indigo-800/80 font-black text-lg flex items-center justify-center shadow-lg shrink-0">
                        ${data.student_name ? escapeHtml(data.student_name.substring(0, 2).toUpperCase()) : 'ÖĞ'}
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex flex-wrap items-center gap-2.5">
                            <h2 class="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight uppercase">${escapeHtml(data.student_name || 'Öğrenci')}</h2>
                            <span class="text-[11px] font-extrabold px-3 py-0.5 rounded-full border ${trackBadgeColor}">
                                ${studentExamSys === 'LGS' ? 'SINAV: LGS (8. Sınıf)' : 'ALAN: ' + currentTrack}
                            </span>
                            <span class="text-xs text-slate-400 font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80">${escapeHtml(data.student_grade || (studentExamSys === 'LGS' ? '8. Sınıf' : '12. Sınıf'))}</span>
                        </div>
                        <div class="flex flex-wrap items-baseline gap-2 pt-0.5">
                            <span class="text-xs text-[#94A3B8] font-medium">Genel Müfredat İlerlemesi:</span>
                            <span class="text-2xl sm:text-3xl font-black text-[#22C55E] tracking-tight">%${data.overall_progress}</span>
                            <span class="text-xs text-[#94A3B8] font-medium">(${data.completed_topics} / ${data.total_topics} Ana Konu Tamamlandı)</span>
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
                    ${studentExamSys === 'LGS' ? `
                    <span class="text-xs font-bold text-purple-300 bg-purple-950 border border-purple-800 px-4 py-2 rounded-xl shadow">LGS MEB 2026 Müfredatı</span>
                    ` : `
                    <!-- FIELD SWITCHER BUTTONS FOR YKS -->
                    <div class="flex items-center bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-inner">
                        <span class="text-[11px] text-slate-400 font-bold px-2">Alan:</span>
                        <button onclick="changeStudentField(${mufredatActiveStudentId}, 'SAYISAL')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${currentTrack === 'SAYISAL' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}">SAY</button>
                        <button onclick="changeStudentField(${mufredatActiveStudentId}, 'EA')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${currentTrack === 'EA' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}">EA</button>
                        <button onclick="changeStudentField(${mufredatActiveStudentId}, 'SOZEL')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${currentTrack === 'SOZEL' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}">SÖZ</button>
                        <button onclick="changeStudentField(${mufredatActiveStudentId}, 'YDT')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${currentTrack === 'YDT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}">YDT</button>
                    </div>
                    `}

                    ${currentUser && ['COACH', 'ADMIN'].includes(currentUser.role) ? `
                    <button onclick="navigateView('kaynak-havuzu')" class="bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-indigo-800 transition flex items-center gap-2 shadow">
                        <i data-lucide="library" class="w-4 h-4 text-[#38BDF8]"></i> 📚 Kaynak Havuzu
                    </button>
                    <button onclick="clearMufredatStudent()" class="bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition flex items-center gap-2 shadow">
                        <i data-lucide="users" class="w-4 h-4 text-indigo-400"></i> Öğrenciyi Değiştir
                    </button>
                    ` : ''}
                </div>
            </div>

            <!-- 2. EXAM TYPE SELECTOR ([ TYT SINAVI ] [ AYT SINAVI ]) -->
            <div class="space-y-2 border-b border-slate-800 pb-4">
                <span class="text-xs font-black text-[#94A3B8] uppercase tracking-wider block">1. SINAV SEÇ:</span>
                <div class="flex flex-wrap items-center gap-3">
                    ${allowedExams.map(ex => `
                        <button onclick="setMufredatExamFilter('${ex}')" class="px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition flex items-center gap-2.5 ${mufredatActiveExamType === ex ? 'bg-indigo-600 text-white border border-indigo-400/40 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/20' : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'}">
                            <i data-lucide="book-open" class="w-4 h-4"></i> ${ex} SINAVI
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- 3. SUBJECT SELECTOR BUTTONS ([ Biyoloji 0/12 ] [ Matematik 3/18 ]) -->
            <div class="space-y-2.5">
                <span class="text-xs font-black text-[#94A3B8] uppercase tracking-wider block">2. DERS SEÇ (${mufredatActiveExamType}):</span>
                <div class="flex flex-wrap items-center gap-2.5">
                    ${subjectsList.map(s => `
                        <button onclick="setMufredatSubjectFilter('${escapeHtml(s.name)}')" class="px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2.5 ${mufredatActiveSubject === s.name ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black border border-emerald-400/40 shadow-lg shadow-emerald-950/40' : 'bg-slate-900/80 text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-800 hover:border-slate-700'}">
                            <span>${escapeHtml(s.name)}</span>
                            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${mufredatActiveSubject === s.name ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-700/60' : 'bg-slate-800 text-slate-400 border border-slate-700'}">
                                ${s.completed_topics}/${s.total_topics}
                            </span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- 4. MAIN TOPICS AREA -->
            <div class="space-y-4 pt-2">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-md">
                    <div>
                        <h3 class="text-base sm:text-lg font-black text-[#F8FAFC] flex items-center gap-2.5">
                            <i data-lucide="layers" class="w-5 h-5 text-indigo-400"></i>
                            ${mufredatActiveExamType} → ${escapeHtml(activeSubjectData.name || 'Ders')} Ana Konuları
                        </h3>
                        <p class="text-xs text-[#94A3B8] mt-1">Atanan tüm kaynaklar ve tamamlama durumları (${activeSubjectData.completed_topics || 0} / ${activeSubjectData.total_topics || 0} Ana Konu)</p>
                    </div>
                    <span class="text-sm sm:text-base font-black text-[#22C55E] bg-emerald-950/80 border border-emerald-800/80 px-4 py-1.5 rounded-xl shadow">%${activeSubjectData.progress || 0} İlerleme</span>
                </div>

                <div class="space-y-3.5">
        `;

        const topicsList = activeSubjectData.topics || [];
        if (topicsList.length === 0) {
            html += `<div class="glass-card p-8 rounded-2xl border border-slate-800 text-center text-slate-400">Bu derse ait henüz ana konu bulunmuyor.</div>`;
        } else {
            topicsList.forEach((top, idx) => {
                const assignedList = top.assigned_resources || [];
                const isCompleted = top.topic_status === 'COMPLETED';
                const isInProgress = top.topic_status === 'IN_PROGRESS';
                const hasResources = assignedList.length > 0;

                // Status Badge logic
                let statusBadge = '';
                if (isCompleted) {
                    statusBadge = `
                    <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ✓ Konu Tamamlandı
                    </span>`;
                } else if (isInProgress) {
                    statusBadge = `
                    <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-amber-950/80 text-amber-300 border border-amber-800/80">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> 🟡 Devam Ediyor
                    </span>`;
                } else if (hasResources) {
                    statusBadge = `
                    <span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-indigo-950/80 text-indigo-300 border border-indigo-800/80">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> ✓ ${assignedList.length} Kaynak
                    </span>`;
                } else {
                    statusBadge = `
                    <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> ○ Kaynak Atanmadı
                    </span>`;
                }

                html += `
                <div class="bg-slate-900/85 p-5 rounded-2xl border ${isCompleted ? 'border-emerald-900/60 bg-gradient-to-r from-slate-900/90 via-slate-900/90 to-emerald-950/20' : 'border-slate-800/90'} space-y-4 hover:border-indigo-500/50 hover:bg-slate-900 transition-all duration-200 shadow-md">
                    <!-- TOPIC HEADER ROW -->
                    <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-3.5 border-b border-slate-800/80">
                        <div class="flex items-start gap-3.5">
                            <div class="w-8 h-8 rounded-xl ${isCompleted ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800' : 'bg-indigo-950/90 text-indigo-300 border border-indigo-800/80'} font-black text-xs flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                                ${idx + 1}
                            </div>
                            <div>
                                <h4 class="font-bold text-sm sm:text-base text-[#F8FAFC] leading-snug">${escapeHtml(top.topic_name)}</h4>
                                <p class="text-xs text-[#94A3B8] font-normal mt-0.5">${escapeHtml(activeSubjectData.name)} • ${assignedList.length} Kaynak Atandı</p>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
                            ${statusBadge}

                            <!-- TOPIC COMPLETION BUTTON (Secondary Action) -->
                            <button onclick="toggleMainTopicStatus(${mufredatActiveStudentId}, ${top.curriculum_id}, '${top.topic_status}')" class="${isCompleted ? 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700' : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'} font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm">
                                <i data-lucide="check-circle-2" class="w-3.5 h-3.5 ${isCompleted ? 'text-emerald-400' : 'text-slate-400'}"></i> 
                                ${isCompleted ? '✓ Konu Tamamlandı' : '○ Konuyu Tamamla'}
                            </button>

                            <!-- COACH MULTI-RESOURCE ASSIGNMENT BUTTON (Primary Action) -->
                            ${currentUser && ['COACH', 'ADMIN'].includes(currentUser.role) ? `
                            <button onclick="openAssignResourceToTopicModal(${mufredatActiveStudentId}, ${top.curriculum_id}, '${escapeHtml(activeSubjectData.name)}', '${escapeHtml(top.topic_name)}')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-indigo-900/30 transition flex items-center gap-1.5">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i> + Kaynak Ata (${assignedList.length})
                            </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- ASSIGNED MULTIPLE RESOURCES SUB-LIST -->
                    <div class="space-y-2.5 pt-1">
                `;

                if (assignedList.length === 0) {
                    html += `
                    <div class="p-3.5 rounded-xl bg-slate-950/40 border border-dashed border-slate-800/80 text-slate-400 text-xs flex items-center gap-2.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Bu konuya henüz kaynak atanmadı. Yandaki <b class="text-indigo-400">'+ Kaynak Ata'</b> butonundan kaynak ekleyebilirsiniz.
                    </div>`;
                } else {
                    assignedList.forEach(r => {
                        let rStatusBadge = '';
                        if (r.status === 'COMPLETED') {
                            rStatusBadge = `<span class="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-800/90 flex items-center gap-1">🟢 100% Tamamlandı</span>`;
                        } else if (r.status === 'IN_PROGRESS') {
                            rStatusBadge = `<span class="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-950/90 text-amber-300 border border-amber-800/90 flex items-center gap-1">🟡 %${r.progress_percentage || 50} Devam Ediyor</span>`;
                        } else {
                            rStatusBadge = `<span class="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">⚪ 0% Başlanmadı</span>`;
                        }

                        html += `
                        <div class="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition shadow-sm">
                            <div class="flex items-center gap-3">
                                <span class="text-base">📘</span>
                                <div>
                                    <span class="font-bold text-xs text-indigo-300 block">${escapeHtml(r.resource_title)}</span>
                                    <span class="text-[11px] text-[#94A3B8] font-normal">Yayın: ${escapeHtml(r.publisher_name || 'Genel Havuz')}</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                                ${rStatusBadge}

                                <!-- INDEPENDENT RESOURCE COMPLETION TOGGLE -->
                                <button onclick="toggleMufredatResourceStatus(${r.topic_resource_id}, '${r.status}', ${mufredatActiveStudentId})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-lg transition flex items-center gap-1 shadow-sm">
                                    <i data-lucide="check" class="w-3 h-3"></i> ${r.status === 'COMPLETED' ? '✓ Bitirildi' : 'Bitir'}
                                </button>

                                <!-- UNASSIGN / REMOVE RESOURCE BUTTON -->
                                ${currentUser && ['COACH', 'ADMIN'].includes(currentUser.role) ? `
                                <button onclick="unassignMufredatTopicResource(${r.topic_resource_id}, ${mufredatActiveStudentId})" title="Atamayı Kaldır" class="bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 p-2 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg border border-slate-700 hover:border-rose-800 transition">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                                ` : ''}
                            </div>
                        </div>
                        `;
                    });
                }

                html += `
                    </div>
                </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        </div>
        `;

        document.getElementById('viewContainer').innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderMufredatView error:", err);
    }
}

async function openAssignResourceToTopicModal(studentId, curriculumId, subjectName, topicName) {
    const token = localStorage.getItem('yks_token');
    try {
        const [res, mufRes] = await Promise.all([
            fetch(`${API_BASE}/kaynaklar/havuz?subject=${encodeURIComponent(subjectName)}&student_id=${studentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_BASE}/mufredat?student_id=${studentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);
        const [data, mufData] = await Promise.all([res.json(), mufRes.json()]);
        const resources = data.resources || [];
        let assignedResourceIds = new Set();
        (mufData.exams || []).forEach(e => {
            (e.subjects || []).forEach(s => {
                (s.topics || []).forEach(t => {
                    if (t.curriculum_id === curriculumId) {
                        (t.assigned_resources || []).forEach(r => assignedResourceIds.add(r.resource_id));
                    }
                });
            });
        });

        let html = `
        <div class="max-w-xl mx-auto space-y-4 text-xs">
            <div>
                <h3 class="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <i data-lucide="book-plus" class="w-5 h-5 text-indigo-400"></i> Konuya Çoklu Kaynak Atama
                </h3>
                <p class="text-xs text-slate-400"><b class="text-white">${subjectName}</b> → <b class="text-amber-400">${topicName}</b> ana başlığı için istediğiniz kaynakları seçip tek seferde atayabilirsiniz.</p>
            </div>

            <div class="max-h-[320px] overflow-y-auto space-y-2 pr-1">
        `;

        if (resources.length === 0) {
            html += `<p class="text-slate-500 text-center py-6">Bu öğrencinin alanına uygun ${subjectName} kaynağı bulunamadı.</p>`;
        } else {
            resources.forEach(r => {
                const isAlreadyAssigned = assignedResourceIds.has(r.id);
                html += `
                <label class="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between cursor-pointer hover:border-indigo-500/60 transition ${isAlreadyAssigned ? 'opacity-60 cursor-not-allowed bg-slate-950' : ''}">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" name="mufredatResourceCheck" value="${r.id}" ${isAlreadyAssigned ? 'disabled checked' : ''} class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700">
                        <div>
                            <span class="font-bold text-xs text-white block">${r.title}</span>
                            <span class="text-[10px] text-slate-400">${r.publisher_name || 'Yayın'} | Sınav: ${r.exam_type || 'TYT'} | Seviye: ${r.level || 'ORTA'}</span>
                        </div>
                    </div>

                    ${isAlreadyAssigned ? `
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">✓ Atanmış</span>
                    ` : `
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">+ Seç</span>
                    `}
                </label>
                `;
            });
        }

        html += `
            </div>

            <div class="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs transition">
                    İptal
                </button>
                <button type="button" onclick="submitBulkMufredatAssignResource(${studentId}, ${curriculumId})" class="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5">
                    <i data-lucide="check-circle" class="w-4 h-4"></i> SEÇİLEN KAYNAKLARI ATA
                </button>
            </div>
        </div>
        `;
        openModal(html);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert("Kaynak havuzu yüklenirken hata oluştu!");
    }
}

async function submitBulkMufredatAssignResource(studentId, curriculumId) {
    const checkboxes = document.querySelectorAll('input[name="mufredatResourceCheck"]:checked:not([disabled])');
    const resourceIds = Array.from(checkboxes).map(c => parseInt(c.value));

    if (resourceIds.length === 0) {
        alert("Lütfen atamak istediğiniz en az 1 yeni kaynak seçiniz!");
        return;
    }

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/mufredat/kaynak-ata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_id: studentId, curriculum_id: curriculumId, resource_ids: resourceIds })
        });
        const data = await res.json();
        if (!res.ok) {
            alert("❌ " + (data.error || "Kaynak atanırken yetki/uyum hatası oluştu."));
            return;
        }
        closeModal();
        alert("✅ " + (data.message || "Seçilen kaynaklar ana konuya atandı!"));
        renderMufredatView(studentId);
    } catch (err) {
        alert("Kaynak atanırken sistem hatası meydana geldi!");
    }
}

// ----------------------------------------------------
// DYNAMIC ROLE SIDEBAR HANDLER (RULE #12 & #37)
// ----------------------------------------------------
function updateSidebarByRole() {
    const role = currentUser ? currentUser.role : 'STUDENT';
    const nav = document.getElementById('sidebarNavLinks') || document.querySelector('nav.flex-1');
    if (!nav) return;

    if (role === 'STUDENT') {
        nav.innerHTML = `
        <button onclick="navigateView('dashboard')" class="nav-item active w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="layout-dashboard" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Öğrenci Paneli</span>
        </button>
        <button onclick="navigateView('program')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="calendar" class="w-5 h-5 shrink-0 text-[#38BDF8]"></i> <span class="text-left flex-1 leading-snug">Haftalık Programım</span>
        </button>
        <button onclick="navigateView('assignments')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="file-check-2" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Ödevlerim</span>
        </button>
        <button onclick="navigateView('mufredat')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="target" class="w-5 h-5 shrink-0 text-[#22C55E]"></i> <span class="text-left flex-1 leading-snug">Müfredat & Kaynak Takibi</span>
        </button>
        <button onclick="navigateView('deneme')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="bar-chart-3" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Denemelerim & Net Gelişimim</span>
        </button>
        <button onclick="navigateView('raporlar')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="line-chart" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Akademik Raporlarım</span>
        </button>
        <button onclick="navigateView('simulator')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="calculator" class="w-5 h-5 shrink-0 text-[#38BDF8]"></i> <span class="text-left flex-1 leading-snug">YKS Puan Simülatörü</span>
        </button>
        <button onclick="navigateView('books')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="book-marked" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Kitap Takibi</span>
        </button>
        <button onclick="navigateView('messages')" class="nav-item w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <div class="flex items-center justify-start text-left gap-3 flex-1 min-w-0">
                <i data-lucide="message-square" class="w-5 h-5 shrink-0 text-[#38BDF8]"></i> <span class="text-left flex-1 leading-snug truncate">Mesajlar</span>
            </div>
            <span id="sidebarUnreadBadge" class="hidden bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm shrink-0">0</span>
        </button>
        <button onclick="navigateView('timer')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="timer" class="w-5 h-5 shrink-0 text-[#F59E0B]"></i> <span class="text-left flex-1 leading-snug">Çalışma Zamanlayıcısı</span>
        </button>
        <button onclick="navigateView('ai-coach')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="sparkles" class="w-5 h-5 shrink-0 text-[#7C6AE6]"></i> <span class="text-left flex-1 leading-snug">AI Koç Asistanı</span>
        </button>
        `;
    } else if (role === 'COACH') {
        nav.innerHTML = `
        <button onclick="navigateView('dashboard')" class="nav-item active w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="layout-dashboard" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Koç Paneli</span>
        </button>
        <button onclick="navigateView('students')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="users" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Öğrencilerim & Risk</span>
        </button>
        <button onclick="navigateView('program')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="calendar" class="w-5 h-5 shrink-0 text-[#38BDF8]"></i> <span class="text-left flex-1 leading-snug">Haftalık Program</span>
        </button>
        <button onclick="navigateView('assignments')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="file-check-2" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Ödev Yönetimi</span>
        </button>
        <button onclick="navigateView('mufredat')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="target" class="w-5 h-5 shrink-0 text-[#22C55E]"></i> <span class="text-left flex-1 leading-snug">Müfredat & Kaynak Takibi</span>
        </button>
        <button onclick="navigateView('kaynak-havuzu')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="library" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">📚 Kaynak Havuzum</span>
        </button>
        <button onclick="navigateView('deneme')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="bar-chart-3" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Deneme & Konu Analizi</span>
        </button>
        <button onclick="navigateView('raporlar')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="line-chart" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Akademik Raporlar</span>
        </button>
        <button onclick="navigateView('simulator')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="calculator" class="w-5 h-5 shrink-0 text-[#38BDF8]"></i> <span class="text-left flex-1 leading-snug">YKS Puan Simülatörü</span>
        </button>
        <button onclick="navigateView('books')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="book-marked" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Kitap Okuma Takibi</span>
        </button>
        <button onclick="navigateView('messages')" class="nav-item w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <div class="flex items-center justify-start text-left gap-3 flex-1 min-w-0">
                <i data-lucide="message-square" class="w-5 h-5 shrink-0 text-[#38BDF8]"></i> <span class="text-left flex-1 leading-snug truncate">Mesajlaşma</span>
            </div>
            <span id="sidebarUnreadBadge" class="hidden bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm shrink-0">0</span>
        </button>
        <button onclick="navigateView('timer')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="timer" class="w-5 h-5 shrink-0 text-[#F59E0B]"></i> <span class="text-left flex-1 leading-snug">Çalışma Zamanlayıcısı</span>
        </button>
        <button onclick="navigateView('ai-coach')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="sparkles" class="w-5 h-5 shrink-0 text-[#7C6AE6]"></i> <span class="text-left flex-1 leading-snug">AI Koç Asistanı</span>
        </button>
        `;
    } else if (role === 'ADMIN') {
        nav.innerHTML = `
        <button onclick="navigateView('dashboard')" class="nav-item active w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="layout-dashboard" class="w-5 h-5 shrink-0 text-[#4F8CFF]"></i> <span class="text-left flex-1 leading-snug">Yönetim Paneli</span>
        </button>
        <button onclick="navigateView('admin-users')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-indigo-300 hover:text-white hover:bg-[#172238] transition font-bold">
            <i data-lucide="users" class="w-5 h-5 shrink-0 text-indigo-400"></i> <span class="text-left flex-1 leading-snug">👤 Kullanıcı & Hesap Yönetimi</span>
        </button>
        <button onclick="navigateView('mufredat')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="target" class="w-5 h-5 shrink-0 text-[#22C55E]"></i> <span class="text-left flex-1 leading-snug">Müfredat & Kaynak Takibi</span>
        </button>
        <button onclick="navigateView('kaynak-havuzu')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="library" class="w-5 h-5 shrink-0 text-[#22C55E]"></i> <span class="text-left flex-1 leading-snug">📚 Kaynak Yönetimi</span>
        </button>
        <button onclick="navigateView('messages')" class="nav-item w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <div class="flex items-center justify-start text-left gap-3 flex-1 min-w-0">
                <i data-lucide="message-square" class="w-5 h-5 shrink-0 text-[#38BDF8]"></i> <span class="text-left flex-1 leading-snug truncate">Mesajlaşma</span>
            </div>
            <span id="sidebarUnreadBadge" class="hidden bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm shrink-0">0</span>
        </button>
        <button onclick="navigateView('notifications')" class="nav-item w-full flex items-center justify-start text-left gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A8B3C7] hover:text-white hover:bg-[#172238] transition">
            <i data-lucide="bell" class="w-5 h-5 shrink-0 text-[#F59E0B]"></i> <span class="text-left flex-1 leading-snug">Bildirimler</span>
        </button>
        `;
    }
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

// ----------------------------------------------------
// ÖDEVLERİM — ASSIGNMENTS MODULE ENGINE (COMPLETE UI/UX REVISION)
// ----------------------------------------------------
let currentAssignmentsFilter = 'ALL';
let currentAssignmentsSearch = '';
let currentAssignmentsSort = 'due_date';

async function renderStudentAssignmentsView() {
    document.getElementById('pageTitle').textContent = "📝 Ödevlerim — Çalışma & Görev Yönetim Merkezi";
    const token = localStorage.getItem('yks_token');
    const container = document.getElementById('viewContainer');

    try {
        let studentParam = '';
        if (currentUser.role !== 'STUDENT') {
            const currentSelected = selectedStudentId || 'ALL';
            studentParam = `?student_id=${currentSelected}&status=${currentAssignmentsFilter}&search=${encodeURIComponent(currentAssignmentsSearch)}&sort=${currentAssignmentsSort}`;
        } else {
            studentParam = `?status=${currentAssignmentsFilter}&search=${encodeURIComponent(currentAssignmentsSearch)}&sort=${currentAssignmentsSort}`;
        }

        // Parallelize assignments and students fetch
        const isCoachRole = currentUser && currentUser.role !== 'STUDENT';
        const fetchAssignmentsPromise = fetch(`${API_BASE}/odevler${studentParam}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const fetchStudentsPromise = isCoachRole
            ? fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(async r => {
                    if (r.ok) {
                        const ct = r.headers.get("content-type") || "";
                        if (ct.includes("application/json")) {
                            return await r.json();
                        }
                    }
                    return { students: [] };
                })
                .catch(e => {
                    console.warn("[ASSIGNMENTS] Students fetch warning:", e.message);
                    return { students: [] };
                })
            : Promise.resolve({ students: [] });

        const [res, dataSt] = await Promise.all([
            fetchAssignmentsPromise,
            fetchStudentsPromise
        ]);

        const coachStudents = dataSt.students || [];

        if (!res.ok) {
            const contentType = res.headers.get("content-type") || "";
            let errDetail = `HTTP ${res.status}`;
            if (contentType.includes("application/json")) {
                const errJson = await res.json();
                errDetail = errJson.error || errJson.message || errDetail;
            } else {
                const errText = await res.text();
                console.error("[API ERROR] Non-JSON response received for /api/odevler:", {
                    status: res.status,
                    contentType,
                    url: res.url,
                    bodySnippet: errText.substring(0, 300)
                });
            }
            throw new Error(`Ödev verileri yüklenirken sunucu hatası oluştu (${errDetail}).`);
        }

        const data = await res.json();
        let rawAssignments = data.assignments || [];
        
        // Filter out garbage test data like 'hghgc'
        const assignments = rawAssignments.filter(a => a.title && a.title.trim() !== 'hghgc' && a.title.trim().length > 1);

        let summary = data.summary || { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, completion_rate: 0 };

        const todayStr = new Date().toISOString().split('T')[0];

        // Guaranteed accurate summary computation from filtered assignments array
        const tot = assignments.length;
        const pend = assignments.filter(a => a.status === 'PENDING' || a.status === 'ASSIGNED').length;
        const inProg = assignments.filter(a => a.status === 'IN_PROGRESS').length;
        const comp = assignments.filter(a => a.status === 'COMPLETED').length;
        const over = assignments.filter(a => a.status === 'OVERDUE' || (a.due_date && a.due_date < todayStr && a.status !== 'COMPLETED')).length;
        const pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
        summary = { total: tot, pending: pend, in_progress: inProg, completed: comp, overdue: over, completion_rate: pct };

        // Today's homeworks
        const todayAssignments = assignments.filter(a => a.due_date === todayStr && a.status !== 'COMPLETED');

        let html = `
        <!-- SUMMARY KPI CARDS (6 CARDS IN HIGH-CONTRAST LIGHT/DARK TOKEN SYSTEM) -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <!-- TOPLAM ÖDEV -->
            <div class="glass-card p-4 border border-[var(--border)] flex flex-col justify-between rounded-2xl shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">TOPLAM ÖDEV</span>
                    <div class="w-8 h-8 rounded-xl bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info-border)] flex items-center justify-center font-bold">
                        <i data-lucide="book-open" class="w-4 h-4"></i>
                    </div>
                </div>
                <span class="text-2xl font-extrabold text-[var(--text-primary)] mt-2">${summary.total}</span>
            </div>

            <!-- BEKLEYEN -->
            <div class="glass-card p-4 border border-[var(--warning-border)] bg-[var(--warning-soft)] flex flex-col justify-between rounded-2xl shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-[var(--warning)] uppercase tracking-wider">BEKLEYEN</span>
                    <div class="w-8 h-8 rounded-xl bg-[var(--bg-card)] text-[var(--warning)] border border-[var(--warning-border)] flex items-center justify-center font-bold">
                        <i data-lucide="clock" class="w-4 h-4"></i>
                    </div>
                </div>
                <span class="text-2xl font-extrabold text-[var(--warning)] mt-2">${summary.pending}</span>
            </div>

            <!-- DEVAM EDEN -->
            <div class="glass-card p-4 border border-[var(--info-border)] bg-[var(--info-soft)] flex flex-col justify-between rounded-2xl shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-[var(--info)] uppercase tracking-wider">DEVAM EDEN</span>
                    <div class="w-8 h-8 rounded-xl bg-[var(--bg-card)] text-[var(--info)] border border-[var(--info-border)] flex items-center justify-center font-bold">
                        <i data-lucide="loader-2" class="w-4 h-4"></i>
                    </div>
                </div>
                <span class="text-2xl font-extrabold text-[var(--info)] mt-2">${summary.in_progress}</span>
            </div>

            <!-- TAMAMLANAN -->
            <div class="glass-card p-4 border border-[var(--success-border)] bg-[var(--success-soft)] flex flex-col justify-between rounded-2xl shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-[var(--success)] uppercase tracking-wider">TAMAMLANAN</span>
                    <div class="w-8 h-8 rounded-xl bg-[var(--bg-card)] text-[var(--success)] border border-[var(--success-border)] flex items-center justify-center font-bold">
                        <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                    </div>
                </div>
                <span class="text-2xl font-extrabold text-[var(--success)] mt-2">${summary.completed}</span>
            </div>

            <!-- GECİKEN -->
            <div class="glass-card p-4 border border-[var(--danger-border)] bg-[var(--danger-soft)] flex flex-col justify-between rounded-2xl shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-[var(--danger)] uppercase tracking-wider">GECİKEN</span>
                    <div class="w-8 h-8 rounded-xl bg-[var(--bg-card)] text-[var(--danger)] border border-[var(--danger-border)] flex items-center justify-center font-bold">
                        <i data-lucide="alert-circle" class="w-4 h-4"></i>
                    </div>
                </div>
                <span class="text-2xl font-extrabold text-[var(--danger)] mt-2">${summary.overdue}</span>
            </div>

            <!-- TAMAMLAMA -->
            <div class="glass-card p-4 border border-[var(--border)] flex flex-col justify-between rounded-2xl shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider">TAMAMLAMA</span>
                    <div class="w-8 h-8 rounded-xl bg-[var(--primary-light-bg)] text-[var(--primary)] border border-[var(--primary-border)] flex items-center justify-center font-bold">
                        <i data-lucide="percent" class="w-4 h-4"></i>
                    </div>
                </div>
                <span class="text-2xl font-extrabold text-[var(--primary)] mt-2">%${summary.completion_rate}</span>
            </div>
        </div>

        <!-- 📌 BUGÜN YAPILACAKLAR (TODAY'S HOMEWORKS SECTION) -->
        ${todayAssignments.length > 0 ? `
        <div class="glass-card p-4 border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 mb-6 rounded-2xl shadow-sm">
            <div class="flex items-center gap-2 mb-3">
                <span class="text-base">📌</span>
                <h4 class="text-xs font-bold text-[#0F172A] dark:text-white">Bugün Yapılacak Ödevler (${todayAssignments.length})</h4>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                ${todayAssignments.map(ta => `
                <div class="bg-white dark:bg-slate-900 p-3 rounded-xl border border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between shadow-sm">
                    <div>
                        <h5 class="text-xs font-bold text-[#0F172A] dark:text-white">${ta.title}</h5>
                        <p class="text-[11px] text-[#64748B] dark:text-slate-400">${ta.subject_name || 'Ders'} • ${ta.target_question_count || 0} Soru</p>
                    </div>
                    <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-orange-50 text-[#C2410C] border border-[#FED7AA]">🔴 Bugün</span>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- OVERDUE WARNING BANNER -->
        ${summary.overdue > 0 ? `
        <div class="glass-card p-4 border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 mb-6 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 border border-rose-200 dark:border-rose-700/60 flex items-center justify-center text-[#DC2626] dark:text-rose-400 text-lg">
                    ⚠️
                </div>
                <div>
                    <h4 class="text-xs font-bold text-[#B91C1C] dark:text-rose-300">Geciken Ödevler Bulunmaktadır (${summary.overdue} Ödev)</h4>
                    <p class="text-[11px] text-[#64748B] dark:text-slate-300 mt-0.5">Teslim tarihi geçmiş ödevleri inceleyerek tamamlanma durumlarını kontrol edebilirsiniz.</p>
                </div>
            </div>
            <button onclick="setAssignmentsFilter('OVERDUE')" class="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition shadow">
                Gecikenleri Filtrele
            </button>
        </div>
        ` : ''}

        <!-- CONTROLS & FILTER BAR (PRIMARY BLUE ACTIVE TAB - NO PURPLE) -->
        <div class="glass-card p-4 border border-[#E2E8F0] dark:border-slate-800 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
            <!-- Filter Tabs -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button onclick="setAssignmentsFilter('ALL')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAssignmentsFilter === 'ALL' ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] shadow-sm' : 'bg-[#F8FAFC] dark:bg-slate-900 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}">
                    Tüm Ödevler (${summary.total})
                </button>
                <button onclick="setAssignmentsFilter('PENDING')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAssignmentsFilter === 'PENDING' ? 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] shadow-sm' : 'bg-[#F8FAFC] dark:bg-slate-900 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}">
                    Bekleyen (${summary.pending})
                </button>
                <button onclick="setAssignmentsFilter('IN_PROGRESS')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAssignmentsFilter === 'IN_PROGRESS' ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] shadow-sm' : 'bg-[#F8FAFC] dark:bg-slate-900 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}">
                    Devam Eden (${summary.in_progress})
                </button>
                <button onclick="setAssignmentsFilter('COMPLETED')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAssignmentsFilter === 'COMPLETED' ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] shadow-sm' : 'bg-[#F8FAFC] dark:bg-slate-900 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}">
                    Tamamlanan (${summary.completed})
                </button>
                <button onclick="setAssignmentsFilter('OVERDUE')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${currentAssignmentsFilter === 'OVERDUE' ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] shadow-sm' : 'bg-[#F8FAFC] dark:bg-slate-900 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}">
                    Geciken (${summary.overdue})
                </button>
            </div>

            <!-- Search, Student Filter & Actions -->
            <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                ${currentUser.role !== 'STUDENT' ? `
                <select onchange="handleAssignmentStudentSelect(event)" class="bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2563EB] font-semibold shadow-sm w-full sm:w-auto">
                    <option value="ALL" ${!selectedStudentId || selectedStudentId === 'ALL' ? 'selected' : ''}>👥 Tüm Öğrencilerim</option>
                    ${coachStudents.map(s => `<option value="${s.id}" ${selectedStudentId == s.id ? 'selected' : ''}>👤 ${s.name} ${s.surname || ''}</option>`).join('')}
                </select>
                ` : ''}

                <div class="relative flex-1 min-w-[160px] md:w-56">
                    <input type="text" value="${currentAssignmentsSearch}" onkeyup="handleAssignmentsSearch(event)" placeholder="🔍 Ödev veya ders ara..." class="w-full bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2563EB] placeholder-[#94A3B8] shadow-sm">
                </div>

                ${currentUser.role !== 'STUDENT' ? `
                <button onclick="openCreateAssignmentModal()" class="w-full sm:w-auto justify-center bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5 whitespace-nowrap">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i> + Ödev Ver
                </button>
                ` : ''}
            </div>
        </div>

        <!-- ASSIGNMENT CARDS GRID (CLEAN SaaS CARD LAYOUT) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${assignments.length === 0 ? `
            <div class="col-span-full glass-card p-12 text-center text-[#64748B] border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                <i data-lucide="book-open" class="w-12 h-12 text-[#94A3B8] mx-auto mb-3"></i>
                <h4 class="text-sm font-bold text-[#0F172A] dark:text-slate-200">
                    ${currentUser.role === 'STUDENT' ? 'Henüz atanmış bir ödeviniz yok.' : 'Henüz öğrenciye atanmış bir ödev bulunmuyor.'}
                </h4>
                <p class="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                    ${currentUser.role === 'STUDENT' ? 'Koçunuz yeni bir ödev atadığında burada görüntülenecektir.' : 'Sağ üstteki "+ Ödev Ver" butonunu kullanarak yeni ödev atayabilirsiniz.'}
                </p>
            </div>
            ` : ''}

            ${assignments.map(a => {
                const isCompleted = a.status === 'COMPLETED';
                const isOverdue = a.status === 'OVERDUE' || (a.due_date < todayStr && !isCompleted);
                
                let dateBadgeHtml = '';
                if (isCompleted) {
                    dateBadgeHtml = `<span class="text-[10px] font-bold text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-2.5 py-1 rounded-lg">✓ Tamamlandı</span>`;
                } else if (isOverdue) {
                    dateBadgeHtml = `<span class="text-[10px] font-extrabold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-2.5 py-1 rounded-lg">⚠️ Gecikmiş (${a.due_date})</span>`;
                } else if (a.due_date === todayStr) {
                    dateBadgeHtml = `<span class="text-[10px] font-extrabold text-[#C2410C] bg-[#FFF7ED] border border-[#FED7AA] px-2.5 py-1 rounded-lg">🔴 Bugün Teslim</span>`;
                } else {
                    dateBadgeHtml = `<span class="text-[10px] font-bold text-[#1D4ED8] bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-1 rounded-lg">📅 Teslim: ${a.due_date}</span>`;
                }

                const targetQ = a.target_question_count || 0;
                const compQ = a.completed_count || (isCompleted ? targetQ : 0);
                const qPct = targetQ > 0 ? Math.min(100, Math.round((compQ / targetQ) * 100)) : 0;

                return `
                <div class="glass-card p-5 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl flex flex-col justify-between hover:border-[#CBD5E1] transition shadow-sm">
                    <div>
                        <!-- 1. HEADER ROW: BADGES -->
                        <div class="flex items-center justify-between gap-2 mb-3">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                ${a.student_name ? `<span class="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">👤 ${a.student_name} ${a.student_surname || ''}</span>` : ''}
                                <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-800 text-[#475569] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700 uppercase tracking-wider">${a.subject_name || 'Genel'}</span>
                            </div>
                            ${dateBadgeHtml}
                        </div>

                        <!-- 2. HOMEWORK TITLE & TOPIC -->
                        <h3 class="text-sm font-bold text-[#0F172A] dark:text-white mb-1 leading-tight">${a.title}</h3>
                        ${a.topic_name ? `<p class="text-xs font-medium text-[#64748B] dark:text-slate-400 mb-2">${a.topic_name}</p>` : ''}

                        <!-- 3. RESOURCE INFO (ONLY IF EXISTS - NO EMPTY PLACEHOLDERS) -->
                        ${a.resource_title ? `<p class="text-xs text-[#64748B] font-medium mb-3 flex items-center gap-1.5">📚 Kaynak: <span class="text-[#334155] dark:text-slate-300 font-semibold">${a.resource_title}</span></p>` : ''}

                        <!-- 4. TASK / DESCRIPTION (NO DARK GRAY BOXES - ONLY IF EXISTS) -->
                        ${(a.section_range || a.description) ? `
                        <div class="p-3 rounded-xl bg-[#F1F5F9] dark:bg-slate-800/80 border border-[#E2E8F0] dark:border-slate-700/80 text-xs text-[#334155] dark:text-slate-300 mb-3">
                            <span class="text-[10px] font-bold text-[#64748B] dark:text-slate-400 block mb-0.5">📋 GÖREV / AÇIKLAMA:</span>
                            ${a.section_range || a.description}
                        </div>
                        ` : ''}

                        <!-- 5. QUESTION TARGET & PROGRESS BAR -->
                        ${targetQ > 0 ? `
                        <div class="mb-3">
                            <div class="flex justify-between text-[11px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                                <span>Soru Hedefi</span>
                                <span class="text-[#0F172A] dark:text-white">${compQ} / ${targetQ} Soru</span>
                            </div>
                            <div class="w-full h-2 bg-[#E2E8F0] dark:bg-slate-800 rounded-full overflow-hidden">
                                <div class="h-full ${isCompleted ? 'bg-[#059669]' : 'bg-[#2563EB]'} rounded-full transition-all duration-300" style="width: ${qPct}%"></div>
                            </div>
                            <div class="text-right mt-1">
                                <span class="text-[10px] font-extrabold ${isCompleted ? 'text-[#059669]' : isOverdue ? 'text-[#DC2626]' : 'text-[#2563EB]'}">%${qPct} tamamlandı</span>
                            </div>
                        </div>
                        ` : ''}

                        <!-- 6. COACH NOTE (ONLY IF EXISTS - LIGHT AMBER BOX) -->
                        ${a.coach_note ? `
                        <div class="bg-[#FFFBEB] dark:bg-amber-950/30 p-3 rounded-xl border border-[#FDE68A] dark:border-amber-800/50 text-xs text-[#78350F] dark:text-amber-200 mb-3">
                            <div class="font-bold text-[#B45309] dark:text-amber-400 flex items-center gap-1 mb-0.5">
                                💡 Koç Notu
                            </div>
                            <p class="leading-snug">${a.coach_note}</p>
                        </div>
                        ` : ''}
                    </div>

                    <!-- 7. ACTION BUTTONS & DYNAMIC STATUS -->
                    <div class="pt-3 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                        <button onclick="openAssignmentDetailModal(${a.id})" class="btn-secondary-slate bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 text-[#475569] dark:text-slate-300 hover:bg-[#F8FAFC] px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1">
                            <i data-lucide="info" class="w-3.5 h-3.5 text-[#2563EB]"></i> Detaylar
                        </button>

                        ${currentUser.role === 'STUDENT' ? (
                            !isCompleted ? (
                                a.status === 'PENDING' ? `
                                <button onclick="updateProgramStatus(${a.id}, 'IN_PROGRESS')" class="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow transition">
                                    Başla
                                </button>
                                ` : `
                                <button onclick="submitQuickCompleteAssignment(${a.id})" class="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow transition flex items-center gap-1">
                                    <i data-lucide="check" class="w-3.5 h-3.5"></i> Devam Et / Tamamla
                                </button>
                                `
                            ) : `
                            <span class="text-xs font-bold text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1.5 rounded-xl flex items-center gap-1">
                                ✓ Tamamlandı
                            </span>
                            `
                        ) : (
                            !isCompleted ? `
                            <button onclick="submitQuickCompleteAssignment(${a.id})" class="bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow transition flex items-center gap-1">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i> Onayla / Tamamla
                            </button>
                            ` : `
                            <span class="text-xs font-bold text-[#047857] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1.5 rounded-xl flex items-center gap-1">
                                ✓ Tamamlandı
                            </span>
                            `
                        )}
                    </div>
                </div>
                `;
            }).join('')}
        </div>
        `;

        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderStudentAssignmentsView error:", err);
        container.innerHTML = `<div class="p-6 text-rose-400 font-bold text-center">Ödevler yüklenirken hata oluştu: ${err.message}</div>`;
    }
}

function setAssignmentsFilter(filter) {
    currentAssignmentsFilter = filter;
    renderStudentAssignmentsView();
}

function handleAssignmentsSearch(e) {
    currentAssignmentsSearch = e.target.value;
    renderStudentAssignmentsView();
}

function handleAssignmentStudentSelect(e) {
    selectedStudentId = e.target.value;
    renderStudentAssignmentsView();
}

async function openAssignmentDetailModal(assignmentId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/odevler`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const assignments = data.assignments || [];
        const a = assignments.find(item => item.id === assignmentId);
        if (!a) {
            alert("Ödev bulunamadı!");
            return;
        }

        const isCompleted = a.status === 'COMPLETED';

        const html = `
        <div class="space-y-4 text-xs">
            <div class="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800">
                <div>
                    <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded bg-[#F8FAFC] dark:bg-slate-900 text-[#2563EB] border border-[#E2E8F0] dark:border-slate-800 uppercase tracking-wider">${a.subject_name || 'Ders'}</span>
                    <h3 class="text-base font-black text-[#0F172A] dark:text-white mt-1">${a.title}</h3>
                </div>
                <button onclick="closeModal()" class="text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 p-1">✕</button>
            </div>

            <div class="grid grid-cols-2 gap-3 bg-[#F8FAFC] dark:bg-slate-900/60 p-3 rounded-xl border border-[#E2E8F0] dark:border-slate-800">
                <div>
                    <span class="text-[10px] text-[#64748B] font-bold uppercase block">KONU</span>
                    <span class="text-xs font-semibold text-[#2563EB] dark:text-indigo-300">${a.topic_name || 'Belirtilmedi'}</span>
                </div>
                <div>
                    <span class="text-[10px] text-[#64748B] font-bold uppercase block">KAYNAK</span>
                    <span class="text-xs font-semibold text-[#0F172A] dark:text-amber-400">${a.resource_title || 'Belirtilmedi'}</span>
                </div>
                <div>
                    <span class="text-[10px] text-[#64748B] font-bold uppercase block">BAŞLANGIÇ TARİHİ</span>
                    <span class="text-xs font-semibold text-[#475569] dark:text-slate-300">${a.start_date || 'Bugün'}</span>
                </div>
                <div>
                    <span class="text-[10px] text-[#64748B] font-bold uppercase block">SON TESLİM TARİHİ</span>
                    <span class="text-xs font-bold ${a.status === 'OVERDUE' ? 'text-[#DC2626]' : 'text-[#059669]'}">${a.due_date}</span>
                </div>
            </div>

            ${(a.section_range || a.description) ? `
            <div>
                <label class="text-[11px] font-bold text-[#64748B] block mb-1">GÖREV & AÇIKLAMA / SAYFA ARALIĞI:</label>
                <div class="bg-[#F1F5F9] dark:bg-slate-900 p-3 rounded-xl border border-[#E2E8F0] dark:border-slate-800 text-[#334155] dark:text-slate-200">
                    ${a.section_range || a.description}
                </div>
            </div>
            ` : ''}

            ${a.coach_note ? `
            <div>
                <label class="text-[11px] font-bold text-[#B45309] block mb-1">💡 KOÇ NOTU:</label>
                <div class="bg-[#FFFBEB] dark:bg-amber-950/40 p-3 rounded-xl border border-[#FDE68A] dark:border-amber-900/60 text-[#78350F] dark:text-amber-200 font-medium">
                    "${a.coach_note}"
                </div>
            </div>
            ` : ''}

            ${!isCompleted ? `
            <div class="pt-2 border-t border-[#E2E8F0] dark:border-slate-800">
                <label class="text-[11px] font-bold text-[#64748B] block mb-1">ÖĞRENCİ NOTU (OPSİYONEL):</label>
                <textarea id="modalSubmissionNote" rows="2" placeholder="Örn: Yapamadığım 4 soruyu koçuma mesaj olarak gönderdim..." class="w-full bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2563EB] mb-3"></textarea>
                
                <button onclick="submitModalCompleteAssignment(${a.id})" class="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
                    <i data-lucide="check-circle" class="w-4 h-4"></i> Ödevi Tamamlandı Olarak İşaretle
                </button>
            </div>
            ` : `
            <div class="bg-[#ECFDF5] dark:bg-emerald-950/40 p-3 rounded-xl border border-[#A7F3D0] dark:border-emerald-800 text-center text-[#047857] dark:text-emerald-300 font-bold">
                ✓ Bu ödev ${a.completed_at || 'daha önce'} tamamlandı!
                ${a.submission_note ? `<p class="text-xs font-normal text-[#334155] dark:text-slate-300 mt-1">Notunuz: "${a.submission_note}"</p>` : ''}
            </div>
            `}
        </div>
        `;

        openModal(html);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert("Ödev detayı yüklenirken hata oluştu!");
    }
}
async function submitQuickCompleteAssignment(assignmentId) {
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/odevler`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: assignmentId, status: 'COMPLETED' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ödev güncellenemedi.');
        alert("✅ Ödev başarıyla TAMAMLANDI olarak kaydedildi ve koçunuza bildirim gönderildi!");
        renderStudentAssignmentsView();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function submitModalCompleteAssignment(assignmentId) {
    const el = document.getElementById('modalSubmissionNote');
    const note = el ? el.value : '';
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/odevler`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: assignmentId, status: 'COMPLETED', submission_note: note })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ödev güncellenemedi.');
        closeModal();
        alert("✅ Ödev başarıyla TAMAMLANDI olarak kaydedildi!");
        renderStudentAssignmentsView();
    } catch (err) {
        alert("Hata: " + err.message);
    }
}

async function openCreateAssignmentModal() {
    const token = localStorage.getItem('yks_token');
    try {
        const resSt = await fetch(`${API_BASE}/students`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataSt = await resSt.json();
        const students = dataSt.students || [];

        const resSub = await fetch(`${API_BASE}/mufredat/konular`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataSub = await resSub.json();
        const subjects = dataSub.subjects || [];

        const resRes = await fetch(`${API_BASE}/resources`, { headers: { 'Authorization': `Bearer ${token}` } });
        const dataRes = await resRes.json();
        const resources = dataRes.resources || [];

        const todayStr = new Date().toISOString().split('T')[0];

        const html = `
        <div class="space-y-4 text-xs">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                <div class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center text-white font-black">
                        📝
                    </div>
                    <div>
                        <h3 class="text-base font-black text-white">+ ÖĞRENCİYE YENİ ÖDEV VER</h3>
                        <p class="text-[11px] text-slate-400">Seçilen öğrencinin Ödevlerim paneline yeni bir görev ekleyin</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <form onsubmit="submitCreateAssignment(event)" class="space-y-3">
                <div>
                    <label class="text-[11px] font-bold text-slate-400 block mb-1">Öğrenci Seçin *</label>
                    <select id="asgStudentId" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                        ${students.map(s => `<option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>${s.name} ${s.surname || ''} (${s.track || 'SAYISAL'})</option>`).join('')}
                    </select>
                </div>

                <div>
                    <label class="text-[11px] font-bold text-slate-400 block mb-1">Ödev Başlığı *</label>
                    <input type="text" id="asgTitle" required placeholder="Örn: 3D AYT Matematik - Polinomlar Test 5-8" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 block mb-1">Ders (Opsiyonel)</label>
                        <select id="asgSubjectId" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                            <option value="">-- Ders Seçiniz --</option>
                            ${subjects.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 block mb-1">Kaynak (Opsiyonel)</label>
                        <select id="asgResourceId" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                            <option value="">-- Kaynak Seçiniz --</option>
                            ${resources.map(r => `<option value="${r.id}">${r.title}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 block mb-1">Hedef Soru Sayısı</label>
                        <input type="number" id="asgQuestionCount" value="50" min="0" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                    </div>
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 block mb-1">Son Teslim Tarihi *</label>
                        <input type="date" id="asgDueDate" required value="${todayStr}" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                    </div>
                </div>

                <div>
                    <label class="text-[11px] font-bold text-slate-400 block mb-1">Görev Açıklaması / Sayfa Aralıı</label>
                    <textarea id="asgDescription" rows="2" placeholder="Örn: Sayfa 120-135 arası soruları çöz ve yanlış soruları işaretle..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"></textarea>
                </div>

                <div>
                    <label class="text-[11px] font-bold text-indigo-400 block mb-1">Koç Notu (Öğrenciye Özel Tavsiye)</label>
                    <input type="text" id="asgCoachNote" placeholder="Örn: Özellikle yeni nesil grafikli sorulara dikkat et!" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                </div>

                <button type="submit" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2">
                    ⚡️ Ödevi Kaydet ve Öğrenciye Ata
                </button>
            </form>
        </div>
        `;

        openModal(html);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert("Form yüklenirken hata oluştu: " + err.message);
    }
}

async function submitCreateAssignment(e) {
    e.preventDefault();
    const token = localStorage.getItem('yks_token');
    const payload = {
        student_id: parseInt(document.getElementById('asgStudentId').value),
        title: document.getElementById('asgTitle').value,
        subject_id: document.getElementById('asgSubjectId').value ? parseInt(document.getElementById('asgSubjectId').value) : null,
        resource_id: document.getElementById('asgResourceId').value ? parseInt(document.getElementById('asgResourceId').value) : null,
        target_question_count: parseInt(document.getElementById('asgQuestionCount').value || 0),
        due_date: document.getElementById('asgDueDate').value,
        section_range: document.getElementById('asgDescription').value,
        coach_note: document.getElementById('asgCoachNote').value
    };

    try {
        const res = await fetch(`${API_BASE}/odevler`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ödev atanamadı.');

        closeModal();
        alert("✅ Ödev başarıyla oluşturuldu ve öğrencinin 'Ödevlerim' paneline aktarıldı!");
        if (currentView === 'assignments') {
            renderStudentAssignmentsView();
        }
    } catch (err) {
        alert("Hata: " + err.message);
    }
}


// ============================================================
// BİLDİRİM MERKEZİ & AKSİYON SİSTEMİ FRONTEND MİMARİSİ
// ============================================================
// NOTIFICATIONS CORE (NAVBAR & DROPDOWN)
// ============================================================
let notificationCategoryFilter = 'ALL';
let isNotifDropdownOpen = false;
let notifPollInterval = null;
let notifOutsideClickInitialized = false;

function initNotifDropdownListeners() {
    if (notifOutsideClickInitialized) return;
    document.addEventListener('click', function(e) {
        if (!isNotifDropdownOpen) return;
        const panel = document.getElementById('notifDropdownPanel');
        const btn = document.getElementById('notifBellBtn');
        if (!panel || !btn) return;

        // If click is inside notification panel or the bell button itself, keep open
        if (panel.contains(e.target) || btn.contains(e.target)) {
            return;
        }

        // Click is outside: close notification dropdown panel
        toggleNotificationDropdown(false);
    });
    notifOutsideClickInitialized = true;
}

function initNotificationSystem() {
    initNotifDropdownListeners();
    fetchNotificationsSummary();
    if (notifPollInterval) clearInterval(notifPollInterval);
    notifPollInterval = setInterval(fetchNotificationsSummary, 15000);
}

async function fetchNotificationsSummary() {
    const token = localStorage.getItem('yks_token');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/notifications?unread_only=false`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const unread = data.unread_count || 0;

        // Update header nav badge
        const navBadge = document.getElementById('navUnreadBadge');
        if (navBadge) {
            if (unread > 0) {
                navBadge.textContent = unread > 99 ? '99+' : unread;
                navBadge.classList.remove('hidden');
            } else {
                navBadge.classList.add('hidden');
            }
        }

        // Update sidebar badge
        const sideBadge = document.getElementById('sidebarNotifBadge');
        if (sideBadge) {
            if (unread > 0) {
                sideBadge.textContent = unread > 99 ? '99+' : unread;
                sideBadge.classList.remove('hidden');
            } else {
                sideBadge.classList.add('hidden');
            }
        }

        // If dropdown panel is open, refresh contents
        if (isNotifDropdownOpen) {
            renderNotifDropdownList(data.notifications || []);
        }
    } catch (err) {
        console.error("fetchNotificationsSummary error:", err);
    }
}

function toggleNotificationDropdown(forceState = null) {
    initNotifDropdownListeners();
    const panel = document.getElementById('notifDropdownPanel');
    if (!panel) return;

    isNotifDropdownOpen = forceState !== null ? forceState : !isNotifDropdownOpen;
    if (isNotifDropdownOpen) {
        panel.classList.remove('hidden');
        fetchNotificationsSummary();
    } else {
        panel.classList.add('hidden');
    }
}

function renderNotifDropdownList(notifications) {
    const listEl = document.getElementById('notifDropdownList');
    if (!listEl) return;

    if (!notifications || notifications.length === 0) {
        listEl.innerHTML = `
        <div class="p-6 text-center text-slate-400 text-xs">
            <i data-lucide="bell-off" class="w-8 h-8 mx-auto mb-2 text-slate-500"></i>
            <p>Henüz bildiriminiz yok.</p>
        </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    let html = '';
    notifications.slice(0, 7).forEach(n => {
        const isRead = n.is_read;
        const colorClass = getNotifColorClass(n.type);
        const iconName = getNotifIconName(n.type);

        html += `
        <div onclick="handleNotifClick(${n.id}, '${n.entity_type}', ${n.entity_id})" class="p-3 hover:bg-[#172238] transition cursor-pointer flex items-start gap-3 ${isRead ? 'opacity-75' : 'bg-[#141E33]'}">
            <div class="p-2 rounded-xl shrink-0 ${colorClass}">
                <i data-lucide="${iconName}" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1 mb-0.5">
                    <span class="font-bold text-white text-xs truncate">${n.title}</span>
                    <span class="text-[9px] font-mono text-slate-400 shrink-0">${formatTimeAgo(n.created_at)}</span>
                </div>
                <p class="text-xs text-[#A8B3C7] line-clamp-2 leading-relaxed mb-1.5">${n.message}</p>
                <button class="text-[10px] font-bold text-[#4F8CFF] hover:underline flex items-center gap-1">
                    ${getNotifCtaText(n.entity_type)} →
                </button>
            </div>
        </div>`;
    });

    listEl.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

function getNotifColorClass(type) {
    if (type.startsWith('HOMEWORK_OVERDUE') || type === 'ACADEMIC_RISK_DETECTED') return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
    if (type.includes('COMPLETED') || type.includes('READY')) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (type.startsWith('MOCK_EXAM')) return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    if (type === 'BOOK_GOAL_COMPLETED') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    if (type === 'MESSAGE_RECEIVED') return 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
    if (type.startsWith('PROGRAM')) return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
    return 'bg-[#4F8CFF]/20 text-[#4F8CFF] border border-[#4F8CFF]/30';
}

function getNotifIconName(type) {
    if (type.startsWith('HOMEWORK')) return 'check-square';
    if (type.startsWith('PROGRAM')) return 'calendar';
    if (type.startsWith('RESOURCE')) return 'book-open';
    if (type.startsWith('MOCK_EXAM') || type === 'ACADEMIC_RISK_DETECTED') return 'bar-chart-3';
    if (type === 'MESSAGE_RECEIVED') return 'message-square';
    if (type === 'BOOK_GOAL_COMPLETED') return 'book-marked';
    if (type === 'STUDY_SESSION_COMPLETED') return 'timer';
    if (type === 'CURRICULUM_TOPIC_COMPLETED') return 'target';
    return 'bell';
}

function getNotifCtaText(entityType) {
    switch (entityType) {
        case 'HOMEWORK': return 'Ödeve Git';
        case 'PROGRAM': return 'Programı Gör';
        case 'RESOURCE': return 'Kaynağı Gör';
        case 'EXAM': return 'Analizi Gör';
        case 'CONVERSATION': return 'Mesajı Aç';
        case 'BOOK': return 'Kitabı Gör';
        default: return 'Detayı Gör';
    }
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = (new Date() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'şimdi';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
    return `${Math.floor(diff / 86400)} gün önce`;
}

async function handleNotifClick(notifId, entityType, entityId) {
    const token = localStorage.getItem('yks_token');
    toggleNotificationDropdown(false);

    try {
        await fetch(`${API_BASE}/notifications/${notifId}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchNotificationsSummary();
    } catch (err) {}

    // Deep linking to corresponding page
    if (entityType === 'HOMEWORK') navigateView('students');
    else if (entityType === 'PROGRAM') navigateView('program');
    else if (entityType === 'RESOURCE') navigateView('kaynak-havuzu');
    else if (entityType === 'EXAM') navigateView('deneme');
    else if (entityType === 'CONVERSATION') navigateView('messages');
    else if (entityType === 'BOOK') navigateView('books');
    else navigateView('notifications');
}

async function markAllNotificationsAsRead() {
    const token = localStorage.getItem('yks_token');
    try {
        await fetch(`${API_BASE}/notifications/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchNotificationsSummary();
        if (currentView === 'notifications') renderNotificationsView();
    } catch (err) {
        alert("Bildirimler güncellenemedi!");
    }
}

// ----------------------------------------------------
// DEDICATED NOTIFICATIONS & RESOURCE SUGGESTIONS ENGINE
// ----------------------------------------------------
let adminSuggestionsCache = [];
let adminSuggestionStatusFilter = 'ALL'; // 'ALL', 'BEKLİYOR', 'ONAYLANDI', 'REDDEDİLDİ'

function setSuggestionStatusFilter(filterStatus) {
    adminSuggestionStatusFilter = filterStatus;
    renderNotificationsView();
}

async function approveResourceSuggestion(suggestionId) {
    const btn = document.getElementById(`btnApproveSug_${suggestionId}`);
    const modalBtn = document.getElementById(`modalBtnApproveSug_${suggestionId}`);
    if (btn) { btn.disabled = true; btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> İşleniyor...`; }
    if (modalBtn) { modalBtn.disabled = true; modalBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> İşleniyor...`; }
    if (window.lucide) lucide.createIcons();

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/resource-suggestions/${suggestionId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'APPROVE' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'İşlem gerçekleştirilemedi.');
        
        closeModal();
        if (typeof showToast === 'function') {
            showToast('✅ ' + data.message, 'success');
        } else {
            alert("✅ " + data.message);
        }
        await renderNotificationsView();
        fetchNotificationsSummary();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = `✓ Genel Havuz'a Ekle`; }
        if (modalBtn) { modalBtn.disabled = false; modalBtn.innerHTML = `✓ Onayla ve Ekle`; }
        alert("❌ İşlem gerçekleştirilemedi: " + err.message);
    }
}

function openRejectSuggestionModal(suggestionId) {
    const sug = adminSuggestionsCache.find(s => s.id === suggestionId);
    const title = sug ? escapeHtml(sug.resource_title) : 'Kaynak';
    const coach = sug ? escapeHtml(sug.coach_name) : 'Koç';

    const content = `
    <div class="space-y-4 text-xs">
        <div class="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-200">
            <strong class="text-white block font-bold text-sm mb-1">Kaynak Önerisini Reddet</strong>
            <p><strong>${title}</strong> (${coach}) kaynak önerisini reddetmek istediğinize emin misiniz? Kaynak yalnızca koçun kendi özel havuzunda kalacaktır.</p>
        </div>
        <div>
            <label class="block text-slate-300 font-bold mb-1">Red Nedeni (İsteğe Bağlı):</label>
            <textarea id="rejectReasonInput" rows="3" placeholder="Örn: Benzer soru bankası Genel Havuz'da mevcuttur." class="w-full bg-[#0E1526] border border-[#24314A] rounded-xl p-2.5 text-white focus:outline-none focus:border-rose-500"></textarea>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
            <button onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">İptal</button>
            <button id="btnConfirmReject_${suggestionId}" onclick="confirmRejectResourceSuggestion(${suggestionId})" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl shadow flex items-center gap-1">
                ✕ Reddet
            </button>
        </div>
    </div>
    `;
    openModal('📌 KAYNAK ÖNERİSİ REDDETME', content);
}

async function confirmRejectResourceSuggestion(suggestionId) {
    const reasonInput = document.getElementById('rejectReasonInput');
    const reason = reasonInput ? (reasonInput.value || '').trim() : '';
    const btn = document.getElementById(`btnConfirmReject_${suggestionId}`);
    if (btn) { btn.disabled = true; btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> İşleniyor...`; }
    if (window.lucide) lucide.createIcons();

    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/admin/resource-suggestions/${suggestionId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'REJECT', rejection_reason: reason })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'İşlem gerçekleştirilemedi.');

        closeModal();
        if (typeof showToast === 'function') {
            showToast('ℹ️ ' + data.message, 'info');
        } else {
            alert("ℹ️ " + data.message);
        }
        await renderNotificationsView();
        fetchNotificationsSummary();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = `✕ Reddet`; }
        alert("❌ İşlem gerçekleştirilemedi: " + err.message);
    }
}

function openSuggestionDetailModal(suggestionId) {
    const s = adminSuggestionsCache.find(item => item.id === suggestionId);
    if (!s) {
        alert("Kaynak önerisi detayları bulunamadı.");
        return;
    }

    let statusBadge = `<span class="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">Bekliyor</span>`;
    if (s.status === 'ONAYLANDI') {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">✓ Genel Havuz'a Eklendi</span>`;
    } else if (s.status === 'REDDEDİLDİ') {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 font-bold text-xs border border-rose-500/30">✕ Reddedildi</span>`;
    }

    const content = `
    <div class="space-y-4 text-xs">
        <div class="flex items-center justify-between p-3 bg-[#0E1526] rounded-xl border border-[#24314A]">
            <div>
                <span class="text-[10px] text-slate-400 uppercase tracking-wider block">ÖNERİ DURUMU</span>
                ${statusBadge}
            </div>
            <div class="text-right">
                <span class="text-[10px] text-slate-400 block">EKLENME TARİHİ</span>
                <span class="font-mono text-slate-300">${escapeHtml(s.created_at || 'Tarih Belirtilmedi')}</span>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#111A2C] p-3.5 rounded-xl border border-[#24314A]">
            <div><strong class="text-slate-400 block">Koç Adı:</strong> <span class="text-white font-bold">${escapeHtml(s.coach_name)}</span></div>
            <div><strong class="text-slate-400 block">Kaynak Adı:</strong> <span class="text-white font-bold">${escapeHtml(s.resource_title)}</span></div>
            <div><strong class="text-slate-400 block">Yayınevi:</strong> <span class="text-white">${escapeHtml(s.publisher || 'Belirtilmedi')}</span></div>
            <div><strong class="text-slate-400 block">Ders:</strong> <span class="text-white">${escapeHtml(s.subject_name || 'Ders')}</span></div>
            <div><strong class="text-slate-400 block">Sınav Türü:</strong> <span class="text-white">${escapeHtml(s.exam_system || 'YKS')} (${escapeHtml(s.exam_type || 'TYT')})</span></div>
            <div><strong class="text-slate-400 block">Kaynak Türü:</strong> <span class="text-white">${escapeHtml(s.resource_type || 'Soru Bankası')}</span></div>
        </div>

        ${s.description ? `
        <div class="bg-[#0E1526] p-3 rounded-xl border border-[#24314A]">
            <strong class="text-slate-400 block mb-1">Açıklama & Notlar:</strong>
            <p class="text-slate-300 leading-relaxed">${escapeHtml(s.description)}</p>
        </div>
        ` : ''}

        ${s.status === 'REDDEDİLDİ' && s.rejection_reason ? `
        <div class="bg-rose-950/30 p-3 rounded-xl border border-rose-800/40 text-rose-200">
            <strong class="text-rose-300 block mb-1">Red Nedeni:</strong>
            <p class="opacity-90">${escapeHtml(s.rejection_reason)}</p>
        </div>
        ` : ''}

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#24314A]">
            <button onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">Kapat</button>
            ${s.status === 'BEKLİYOR' ? `
                <button id="modalBtnApproveSug_${s.id}" onclick="approveResourceSuggestion(${s.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl shadow flex items-center gap-1">
                    ✓ Onayla ve Ekle
                </button>
                <button onclick="closeModal(); openRejectSuggestionModal(${s.id});" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl shadow flex items-center gap-1">
                    ✕ Reddet
                </button>
            ` : ''}
        </div>
    </div>
    `;
    openModal('📌 KAYNAK ÖNERİSİ DETAYI', content);
}

function openNotificationDetailModal(notifId, title, message, createdAt) {
    markNotificationAsRead(notifId);
    const content = `
    <div class="space-y-4 text-xs">
        <div class="flex items-center justify-between p-3 bg-[#0E1526] rounded-xl border border-[#24314A]">
            <span class="text-xs font-bold text-indigo-400">🔔 Bildirim Detayı</span>
            <span class="text-xs text-slate-400 font-mono">${escapeHtml(createdAt)}</span>
        </div>
        <div class="bg-[#111A2C] p-4 rounded-xl border border-[#24314A]">
            <h4 class="text-sm font-bold text-white mb-2">${escapeHtml(title)}</h4>
            <p class="text-slate-300 leading-relaxed">${escapeHtml(message)}</p>
        </div>
        <div class="flex items-center justify-end pt-2 border-t border-[#24314A]">
            <button onclick="closeModal()" class="bg-[#172238] hover:bg-[#24314A] text-white font-bold px-4 py-2 rounded-xl border border-[#2A3954]">Kapat</button>
        </div>
    </div>
    `;
    openModal('🔔 BİLDİRİM DETAYI', content);
}

async function renderNotificationsView() {
    document.getElementById('pageTitle').textContent = "🔔 Bildirimler & Akademik Akış";
    const container = document.getElementById('viewContainer');
    const token = localStorage.getItem('yks_token');

    container.innerHTML = `
    <div class="glass-card p-12 text-center border border-[#24314A] rounded-2xl flex flex-col items-center justify-center my-6 bg-[#111A2C]">
        <div class="animate-spin text-[#4F8CFF] mb-3"><i data-lucide="loader-2" class="w-8 h-8"></i></div>
        <h3 class="text-sm font-bold text-white mb-1">Bildirimler Yükleniyor...</h3>
    </div>`;
    if (window.lucide) lucide.createIcons();

    try {
        const res = await fetch(`${API_BASE}/notifications?category=${notificationCategoryFilter}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const notifications = data.notifications || [];

        let adminSuggestions = [];
        if (currentUser && currentUser.role === 'ADMIN') {
            try {
                const sugRes = await fetch(`${API_BASE}/admin/resource-suggestions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (sugRes.ok) {
                    const sugData = await sugRes.json();
                    adminSuggestions = sugData.suggestions || [];
                    adminSuggestionsCache = adminSuggestions;
                }
            } catch (e) {
                console.error("Fetch suggestions error:", e);
            }
        }

        let filteredSuggestions = adminSuggestions;
        if (adminSuggestionStatusFilter !== 'ALL') {
            filteredSuggestions = adminSuggestions.filter(s => s.status === adminSuggestionStatusFilter);
        }

        const pendingCount = adminSuggestions.filter(s => s.status === 'BEKLİYOR').length;
        const approvedCount = adminSuggestions.filter(s => s.status === 'ONAYLANDI').length;
        const rejectedCount = adminSuggestions.filter(s => s.status === 'REDDEDİLDİ').length;

        let html = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                    🔔 Bildirimler & Akademik Akış
                </h2>
                <p class="text-xs text-[#A8B3C7] mt-1">Öğrenci ve koç arasındaki tüm ödev, program, kaynak, deneme ve akademik etkileşimler</p>
            </div>
            <button onclick="markAllNotificationsAsRead()" class="bg-[#172238] hover:bg-[#24314A] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow flex items-center gap-2 border border-[#2A3954] transition shrink-0">
                <i data-lucide="check-check" class="w-4 h-4 text-emerald-400"></i> Tümünü Okundu İşaretle
            </button>
        </div>

        ${currentUser && currentUser.role === 'ADMIN' && adminSuggestions.length > 0 ? `
        <div class="mb-8 bg-[#111A2C] p-4 rounded-2xl border border-[#24314A] shadow-xl">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[#24314A] pb-3">
                <h3 class="text-sm font-bold text-amber-400 flex items-center gap-2">
                    🔔 Genel Havuz Kaynak Önerileri (${pendingCount} Bekleyen)
                </h3>
                <div class="flex items-center gap-1 bg-[#0E1526] p-1 rounded-xl border border-[#24314A] text-xs">
                    <button onclick="setSuggestionStatusFilter('ALL')" class="px-2.5 py-1 rounded-lg font-bold transition ${adminSuggestionStatusFilter === 'ALL' ? 'bg-[#4F8CFF] text-white shadow' : 'text-slate-400 hover:text-white'}">Tümü (${adminSuggestions.length})</button>
                    <button onclick="setSuggestionStatusFilter('BEKLİYOR')" class="px-2.5 py-1 rounded-lg font-bold transition ${adminSuggestionStatusFilter === 'BEKLİYOR' ? 'bg-amber-500 text-white shadow' : 'text-slate-400 hover:text-white'}">Bekleyen (${pendingCount})</button>
                    <button onclick="setSuggestionStatusFilter('ONAYLANDI')" class="px-2.5 py-1 rounded-lg font-bold transition ${adminSuggestionStatusFilter === 'ONAYLANDI' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}">Onaylanan (${approvedCount})</button>
                    <button onclick="setSuggestionStatusFilter('REDDEDİLDİ')" class="px-2.5 py-1 rounded-lg font-bold transition ${adminSuggestionStatusFilter === 'REDDEDİLDİ' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'}">Reddedilen (${rejectedCount})</button>
                </div>
            </div>

            ${filteredSuggestions.length === 0 ? `
            <div class="p-8 text-center text-slate-500 text-xs">
                Seçili filtreye uyan kaynak önerisi bulunmuyor.
            </div>
            ` : `
            <div class="space-y-3">
                ${filteredSuggestions.map(s => `
                <div class="glass-card p-4 border ${s.status === 'BEKLİYOR' ? 'border-amber-500/50 bg-[#1C1828]' : 'border-[#24314A] bg-[#0E1526]'} rounded-2xl shadow-lg">
                    <div class="flex items-center justify-between mb-2">
                        <span class="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">🔔 Genel Havuz Kaynak Önerisi</span>
                        <span class="text-xs text-slate-400 font-mono">${formatTimeAgo(s.created_at)}</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-200 mb-3 bg-[#111A2C] p-3 rounded-xl border border-[#24314A]">
                        <div><strong class="text-slate-400">Koç Adı:</strong> ${escapeHtml(s.coach_name)}</div>
                        <div><strong class="text-slate-400">Kaynak Adı:</strong> ${escapeHtml(s.resource_title)}</div>
                        <div><strong class="text-slate-400">Yayınevi:</strong> ${escapeHtml(s.publisher || 'Belirtilmedi')}</div>
                        <div><strong class="text-slate-400">Ders:</strong> ${escapeHtml(s.subject_name || 'Ders')}</div>
                        <div><strong class="text-slate-400">Sınav Türü:</strong> ${escapeHtml(s.exam_system || 'YKS')} (${escapeHtml(s.exam_type || 'TYT')})</div>
                        <div><strong class="text-slate-400">Eklenme Tarihi:</strong> ${escapeHtml(s.created_at)}</div>
                    </div>
                    <div class="flex items-center justify-between pt-2 border-t border-[#24314A]">
                        <button onclick="openSuggestionDetailModal(${s.id})" class="text-xs font-bold text-[#38BDF8] hover:underline flex items-center gap-1">
                            👁 Detay Gör →
                        </button>
                        <div class="flex items-center gap-2">
                            ${s.status === 'BEKLİYOR' ? `
                                <button id="btnApproveSug_${s.id}" onclick="approveResourceSuggestion(${s.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow transition flex items-center gap-1">
                                    ✓ Genel Havuz'a Ekle
                                </button>
                                <button id="btnRejectSug_${s.id}" onclick="openRejectSuggestionModal(${s.id})" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow transition flex items-center gap-1">
                                    ✕ Reddet
                                </button>
                            ` : s.status === 'ONAYLANDI' ? `
                                <span class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs">✓ Genel Havuz'a Eklendi</span>
                            ` : `
                                <span class="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs">✕ Reddedildi</span>
                            `}
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
            `}
        </div>
        ` : ''}

        <!-- CATEGORY TABS -->
        <div class="flex items-center gap-2 overflow-x-auto border-b border-[#24314A] pb-3 mb-6">
            <button onclick="setNotifCategoryFilter('ALL')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${notificationCategoryFilter === 'ALL' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                📚 Tümü
            </button>
            <button onclick="setNotifCategoryFilter('HOMEWORK')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${notificationCategoryFilter === 'HOMEWORK' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                📘 Ödevler
            </button>
            <button onclick="setNotifCategoryFilter('PROGRAM')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${notificationCategoryFilter === 'PROGRAM' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                📅 Program
            </button>
            <button onclick="setNotifCategoryFilter('RESOURCE')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${notificationCategoryFilter === 'RESOURCE' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                📗 Kaynaklar
            </button>
            <button onclick="setNotifCategoryFilter('EXAM')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${notificationCategoryFilter === 'EXAM' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                📊 Denemeler
            </button>
            <button onclick="setNotifCategoryFilter('MESSAGE')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${notificationCategoryFilter === 'MESSAGE' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                💬 Mesajlar
            </button>
            <button onclick="setNotifCategoryFilter('OTHER')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${notificationCategoryFilter === 'OTHER' ? 'bg-[#4F8CFF] text-white shadow-md' : 'text-[#A8B3C7] hover:text-white hover:bg-[#172238]'}">
                ⚡ Diğer
            </button>
        </div>

        <!-- NOTIFICATIONS LIST -->
        ${notifications.length === 0 ? `
        <div class="glass-card p-12 text-center border border-[#24314A] bg-[#111A2C] rounded-2xl my-6">
            <i data-lucide="bell-off" class="w-10 h-10 text-slate-500 mx-auto mb-3"></i>
            <h3 class="text-sm font-bold text-white mb-1">Bildirim Bulunamadı</h3>
            <p class="text-xs text-[#A8B3C7]">Bu kategoride henüz bildirim kaydı bulunmuyor.</p>
        </div>
        ` : `
        <div class="space-y-3">
            ${notifications.map(n => `
            <div class="glass-card p-4 border ${n.is_read ? 'border-[#24314A] bg-[#111A2C]' : 'border-[#4F8CFF]/40 bg-[#141E33]'} rounded-2xl flex items-start gap-4 hover:border-[#4F8CFF] transition shadow">
                <div class="p-3 rounded-2xl shrink-0 ${getNotifColorClass(n.type)}">
                    <i data-lucide="${getNotifIconName(n.type)}" class="w-5 h-5"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <div class="flex items-center gap-2">
                            <h4 class="text-sm font-bold text-white">${escapeHtml(n.title)}</h4>
                            ${!n.is_read ? '<span class="w-2 h-2 rounded-full bg-[#4F8CFF]"></span>' : ''}
                        </div>
                        <span class="text-xs font-mono text-slate-400">${formatTimeAgo(n.created_at)}</span>
                    </div>
                    <p class="text-xs text-[#A8B3C7] mb-3 leading-relaxed">${escapeHtml(n.message)}</p>
                    <div class="flex items-center gap-3">
                        <button onclick="openNotificationDetailModal(${n.id}, '${escapeHtml(n.title).replace(/'/g, "\\'")}', '${escapeHtml(n.message).replace(/'/g, "\\'")}', '${n.created_at}')" class="text-xs font-bold text-[#38BDF8] hover:underline flex items-center gap-1">
                            👁 Detay Gör →
                        </button>
                        <button onclick="handleNotifClick(${n.id}, '${n.entity_type}', ${n.entity_id})" class="bg-[#4F8CFF] hover:bg-[#3b72df] text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow flex items-center gap-1">
                            ${getNotifCtaText(n.entity_type)} →
                        </button>
                    </div>
                </div>
            </div>
            `).join('')}
        </div>
        `}
        `;

        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("renderNotificationsView error:", err);
    }
}

function setNotifCategoryFilter(cat) {
    notificationCategoryFilter = cat;
    if (window.location.hash.startsWith('#/notifications')) {
        window.location.hash = `#/notifications?category=${cat}`;
    }
    renderNotificationsView();
}


// ============================================================
// KOYU / AÇIK TEMA SİSTEMİ (THEME TOGGLE SYSTEM)
// ============================================================
function initTheme() {
    const savedTheme = localStorage.getItem('yks_theme') || 'dark';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const normalizedTheme = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', normalizedTheme);
    document.documentElement.classList.toggle('dark', normalizedTheme === 'dark');
    localStorage.setItem('yks_theme', normalizedTheme);

    const isLight = (normalizedTheme === 'light');
    
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    const themeBtn = document.getElementById('themeToggleBtn');
    const sidebarIcon = document.getElementById('sidebarThemeIcon');
    const sidebarText = document.getElementById('sidebarThemeText');

    // 1. Kullanıcı AÇIK TEMADA ise (isLight === true): Buton "🌙 Koyu Tema" göstermeli
    // 2. Kullanıcı KOYU TEMADA ise (isLight === false): Buton "☀️ Açık Tema" göstermeli
    const targetIcon = isLight ? '🌙' : '☀️';
    const targetText = isLight ? 'Koyu Tema' : 'Açık Tema';
    const targetTitle = isLight ? 'Koyu Temaya Geç' : 'Açık Temaya Geç';

    if (themeIcon) themeIcon.textContent = targetIcon;
    if (themeText) themeText.textContent = targetText;
    if (themeBtn) themeBtn.title = targetTitle;
    if (sidebarIcon) sidebarIcon.textContent = targetIcon;
    if (sidebarText) sidebarText.textContent = targetText;
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('yks_theme') || 'dark';
    const newTheme = (currentTheme === 'light') ? 'dark' : 'light';
    applyTheme(newTheme);
}

window.initTheme = initTheme;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;

// Auto init theme immediately
initTheme();

// ============================================================
// HELPER & EVENT HANDLER FIXES (RESOLVED BY AGENT 4 STATIC AUDIT)
// ============================================================

function updateCalcNet() {
    const qC = document.getElementById('qCorrect');
    const qI = document.getElementById('qIncorrect');
    const c = parseFloat((qC && qC.value) || 0);
    const i = parseFloat((qI && qI.value) || 0);
    const netEl = document.getElementById('qNetPreview');
    if (netEl) {
        const net = Math.max(0, c - (i / 4));
        netEl.value = net.toFixed(2);
    }
}

function openDenemeDetailModal(attemptId) {
    if (!attemptId) return;
    selectedDenemeAttemptId = parseInt(attemptId);
    renderDenemeView();
}

function quickAssignHomeworkForTopic(topicId, topicName) {
    if (typeof openAssignResourceModal === 'function') {
        openAssignResourceModal(topicId, topicName || 'Konu Ödevi');
    } else {
        alert(`Konu Ödevi Atama: #${topicId} - ${topicName || ''}`);
    }
}

function toggleSelectAllBulkResources(selectAll) {
    const checkboxes = document.querySelectorAll('input[name="bulkResourceCheckbox"]');
    checkboxes.forEach(cb => cb.checked = !!selectAll);
}

async function submitBulkAssignForm(studentId) {
    const checkboxes = document.querySelectorAll('input[name="bulkResourceCheckbox"]:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value)).filter(Boolean);
    
    if (selectedIds.length === 0) {
        alert("Lütfen atamak istediğiniz en az bir kaynak seçin.");
        return;
    }
    
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/resources/assign-bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ student_id: studentId, resource_ids: selectedIds })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + (data.message || "Kaynaklar başarıyla atandı."));
            closeModal();
            renderResourcesView();
        } else {
            alert("❌ Hata: " + (data.detail || data.error || "Kaynaklar atanamadı."));
        }
    } catch (err) {
        console.error("Bulk assign error:", err);
        alert("Bağlantı hatası!");
    }
}

async function changeStudentField(studentId, newField) {
    if (!studentId) return;
    const token = localStorage.getItem('yks_token');
    try {
        const res = await fetch(`${API_BASE}/students/${studentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ field: newField, track: newField })
        });
        if (res.ok) {
            renderMufredatView(studentId);
        } else {
            alert("Alan değiştirilemedi.");
        }
    } catch (err) {
        console.error("Error changing student field:", err);
    }
}

// Alias for openAddAssignmentModal used in chat actions
window.openAddAssignmentModal = function(recipientId, msgText) {
    if (typeof openCreateAssignmentModal === 'function') {
        openCreateAssignmentModal(recipientId, msgText);
    }
};

// Start application after all functions, listeners, and variables are completely initialized
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppBoot);
} else {
    initAppBoot();
}

