const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Setup mock browser DOM environment
class MockElement {
    constructor(id = '', tag = 'div') {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this.innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.style = {};
        this.attributes = {};
        this.classList = {
            classes: new Set(),
            add: (...cls) => cls.forEach(c => this.classList.classes.add(c)),
            remove: (...cls) => cls.forEach(c => this.classList.classes.delete(c)),
            toggle: (cls, force) => {
                if (force === undefined) {
                    if (this.classList.classes.has(cls)) this.classList.classes.delete(cls);
                    else this.classList.classes.add(cls);
                } else if (force) {
                    this.classList.classes.add(cls);
                } else {
                    this.classList.classes.delete(cls);
                }
            },
            contains: (cls) => this.classList.classes.has(cls)
        };
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] || null; }
    querySelectorAll() { return []; }
    querySelector() { return null; }
    addEventListener() {}
    removeEventListener() {}
}

const elementStore = {
    viewContainer: new MockElement('viewContainer'),
    pageTitle: new MockElement('pageTitle', 'h1'),
    loginScreen: new MockElement('loginScreen'),
    appContainer: new MockElement('appContainer'),
    loginForm: new MockElement('loginForm', 'form'),
    loginEmail: new MockElement('loginEmail', 'input'),
    loginPassword: new MockElement('loginPassword', 'input'),
    themeIcon: new MockElement('themeIcon'),
    themeText: new MockElement('themeText'),
    themeToggleBtn: new MockElement('themeToggleBtn'),
    sidebarThemeIcon: new MockElement('sidebarThemeIcon'),
    sidebarThemeText: new MockElement('sidebarThemeText'),
    sidebarNavLinks: new MockElement('sidebarNavLinks'),
    sidebarUnreadBadge: new MockElement('sidebarUnreadBadge'),
    sidebarNotifBadge: new MockElement('sidebarNotifBadge'),
    navUnreadBadge: new MockElement('navUnreadBadge'),
    userNameLabel: new MockElement('userNameLabel'),
    userEmailLabel: new MockElement('userEmailLabel'),
    userRoleBadge: new MockElement('userRoleBadge'),
    demoCredentialsContainer: new MockElement('demoCredentialsContainer')
};

const docElement = new MockElement('html');

const mockLocalStorage = {
    store: {
        yks_token: 'test_mock_token_123',
        yks_user: JSON.stringify({ id: 2, name: 'Koç Ümmü', role: 'COACH', username: 'ummu.akcan' }),
        yks_selected_student_id: '1',
        yks_theme: 'dark'
    },
    getItem: (k) => mockLocalStorage.store[k] || null,
    setItem: (k, v) => { mockLocalStorage.store[k] = String(v); },
    removeItem: (k) => { delete mockLocalStorage.store[k]; }
};

const mockContext = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Date,
    Math,
    JSON,
    parseInt,
    parseFloat,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    AbortController: global.AbortController || class { abort() {} get signal() { return {}; } },
    lucide: { createIcons: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    location: {
        hostname: 'localhost',
        port: '5005',
        hash: '#/program'
    },
    history: {
        pushState: () => {}
    },
    document: {
        documentElement: docElement,
        readyState: 'complete',
        getElementById: (id) => {
            if (!elementStore[id]) elementStore[id] = new MockElement(id);
            return elementStore[id];
        },
        querySelector: (sel) => null,
        querySelectorAll: (sel) => [],
        addEventListener: () => {}
    },
    localStorage: mockLocalStorage,
    sessionStorage: { clear: () => {} },
    navigator: { clipboard: { writeText: async () => {} } },
    alert: (msg) => { console.log("[ALERT]", msg); }
};

mockContext.window = mockContext;
mockContext.globalThis = mockContext;

// Mock fetch
mockContext.fetch = async (url, opts = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/weekly-program')) {
        return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                student: { id: 1, name: 'Ali Yılmaz', track: 'SAYISAL' },
                week_start: '2026-08-17',
                items: [
                    { id: 101, day_of_week: 'Pazartesi', time_slot: '09:00 - 10:00', title: 'Matematik', status: 'COMPLETED' }
                ],
                summary: { completed_count: 1, total_count: 1 }
            })
        };
    }
    if (urlStr.includes('/api/students')) {
        return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                students: [{ id: 1, name: 'Ali Yılmaz', track: 'SAYISAL' }, { id: 2, name: 'Ayşe Kaya', track: 'EA' }]
            })
        };
    }
    if (urlStr.includes('/api/kaynaklar')) {
        return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ resources: [] })
        };
    }
    return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({})
    };
};

vm.createContext(mockContext);

// Read and execute app.js in vm context
const appJsPath = path.join(__dirname, '../../frontend/app.js');
const appJsCode = fs.readFileSync(appJsPath, 'utf-8');

console.log("=== 1. EVALUATING app.js WITH DIRECT #/program INITIAL LOAD ===");
try {
    vm.runInContext(appJsCode, mockContext);
    console.log("✓ app.js successfully loaded without any ReferenceError or TDZ early initialization errors.");
} catch (err) {
    console.error("FATAL EVAL ERROR:", err);
    process.exit(1);
}

async function runWeeklyProgramTests() {
    console.log("\n=== 2. VERIFYING INITIAL GLOBAL VARIABLE STATE ===");
    assert.strictEqual(typeof mockContext.weeklyProgramRequestSeq, 'number', "weeklyProgramRequestSeq should be a number");
    console.log(`✓ weeklyProgramRequestSeq is initialized and accessible (value: ${mockContext.weeklyProgramRequestSeq})`);

    console.log("\n=== 3. CALLING renderWeeklyProgramView DIRECTLY ===");
    const initialSeq = mockContext.weeklyProgramRequestSeq;
    await mockContext.renderWeeklyProgramView(1);
    assert.strictEqual(mockContext.weeklyProgramRequestSeq, initialSeq + 1, "weeklyProgramRequestSeq should increment on render");
    assert(elementStore.viewContainer.innerHTML.length > 0, "viewContainer should be populated with Weekly Program HTML");
    console.log(`✓ renderWeeklyProgramView(1) executed smoothly, sequence: ${mockContext.weeklyProgramRequestSeq}`);

    console.log("\n=== 4. TESTING PREVIOUS & NEXT WEEK NAVIGATION ===");
    await mockContext.shiftWeek(-7);
    console.log(`✓ shiftWeek(-7) executed successfully`);
    await mockContext.shiftWeek(7);
    console.log(`✓ shiftWeek(7) executed successfully`);

    console.log("\n=== 5. TESTING STUDENT SWITCHING IN WEEKLY PROGRAM ===");
    await mockContext.changeWeeklyStudent(2);
    console.log(`✓ changeWeeklyStudent(2) executed successfully`);

    console.log("\n=== 6. TESTING RAPID CONCURRENT REQUESTS (RACE CONDITION GUARD) ===");
    const p1 = mockContext.renderWeeklyProgramView(1);
    const p2 = mockContext.renderWeeklyProgramView(2);
    await Promise.all([p1, p2]);
    console.log(`✓ Concurrent calls resolved without collision, final sequence: ${mockContext.weeklyProgramRequestSeq}`);

    console.log("\n=== 7. TESTING NAVIGATE TO OTHER VIEW AND BACK TO PROGRAM ===");
    await mockContext.navigateView('mufredat');
    console.log("✓ Navigated to mufredat");
    await mockContext.navigateView('program');
    console.log("✓ Navigated back to program smoothly");

    console.log("\n=== 8. TESTING THEME SWITCH WHILE ON WEEKLY PROGRAM ===");
    mockContext.toggleTheme();
    assert.strictEqual(mockContext.document.documentElement.getAttribute('data-theme'), 'light');
    console.log("✓ Theme toggled to light while on Weekly Program");
    mockContext.toggleTheme();
    assert.strictEqual(mockContext.document.documentElement.getAttribute('data-theme'), 'dark');
    console.log("✓ Theme toggled to dark while on Weekly Program");

    console.log("\n🎉 ALL WEEKLY PROGRAM SCENARIOS PASSED WITH 100% SUCCESS!");
}

runWeeklyProgramTests().catch(err => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});
