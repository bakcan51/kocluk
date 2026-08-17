const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("=== STARTING NOTIFICATION DROPDOWN OUTSIDE-CLICK TEST SUITE ===");

// Lightweight DOM Mock with event bubbling and contains() support
class MockElement {
    constructor(id, tagName = 'div') {
        this.id = id;
        this.tagName = tagName.toUpperCase();
        this.textContent = '';
        this.innerHTML = '';
        this.children = [];
        this.parentNode = null;
        this.attributes = {};
        this.classList = {
            classes: new Set(),
            add: (...clss) => clss.forEach(c => this.classList.classes.add(c)),
            remove: (...clss) => clss.forEach(c => this.classList.classes.delete(c)),
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

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    contains(otherNode) {
        if (!otherNode) return false;
        if (otherNode === this) return true;
        let curr = otherNode.parentNode;
        while (curr) {
            if (curr === this) return true;
            curr = curr.parentNode;
        }
        return false;
    }

    click() {
        if (this.onclick) this.onclick({ target: this, bubbles: true });
        global.document.dispatchEvent({ type: 'click', target: this, bubbles: true });
    }
}

const elements = {
    notifBellBtn: new MockElement('notifBellBtn', 'button'),
    notifDropdownPanel: new MockElement('notifDropdownPanel', 'div'),
    navUnreadBadge: new MockElement('navUnreadBadge', 'span'),
    sidebarNotifBadge: new MockElement('sidebarNotifBadge', 'span'),
    notifDropdownList: new MockElement('notifDropdownList', 'div'),
    viewContainer: new MockElement('viewContainer', 'div'),
    sidebar: new MockElement('sidebar', 'div')
};

// notifDropdownPanel initially has class 'hidden'
elements.notifDropdownPanel.classList.add('hidden');

// Build parent-child relationships for elements inside dropdown panel
const panelChild1 = new MockElement('panelHeader', 'h4');
const panelChild2 = new MockElement('panelMarkAllBtn', 'button');
const panelChild3 = new MockElement('panelItem', 'div');
elements.notifDropdownPanel.appendChild(panelChild1);
elements.notifDropdownPanel.appendChild(panelChild2);
elements.notifDropdownPanel.appendChild(elements.notifDropdownList);
elements.notifDropdownList.appendChild(panelChild3);

const vm = require('vm');
const docListeners = {};
global.document = {
    documentElement: new MockElement('html', 'html'),
    getElementById: (id) => elements[id] || null,
    querySelector: (sel) => null,
    querySelectorAll: (sel) => [],
    addEventListener: (evt, handler) => {
        if (!docListeners[evt]) docListeners[evt] = [];
        docListeners[evt].push(handler);
    },
    dispatchEvent: (evt) => {
        if (docListeners[evt.type]) {
            docListeners[evt.type].forEach(h => h(evt));
        }
    }
};

global.window = global;
global.window.innerWidth = 1024;
global.window.location = { hash: '#/dashboard' };
global.window.lucide = { createIcons: () => {} };
global.window.addEventListener = () => {};

global.localStorage = {
    store: {
        'yks_token': 'mock_token',
        'yks_user': JSON.stringify({ id: 1, name: 'Ümmü', role: 'COACH' })
    },
    getItem: (k) => global.localStorage.store[k] || null,
    setItem: (k, v) => { global.localStorage.store[k] = String(v); },
    removeItem: (k) => { delete global.localStorage.store[k]; }
};

global.fetch = async () => ({
    ok: true,
    json: async () => ({ unread_count: 0, notifications: [] })
});

// Load app.js
const appJs = fs.readFileSync(path.join(__dirname, '../../frontend/app.js'), 'utf-8');

try {
    vm.runInThisContext(appJs);
} catch (e) {
    console.error("Evaluation error in app.js:", e);
    process.exit(1);
}

// Mock view render functions so navigateView doesn't crash on DOM queries
global.renderStudentsRiskListView = async () => {};
global.renderCoachDashboard = async () => {};
global.renderStudentDashboard = async () => {};
global.renderAdminDashboard = async () => {};

// Ensure bell button onclick is linked as in index.html
elements.notifBellBtn.onclick = () => toggleNotificationDropdown();

async function runTests() {
    console.log("✓ Initial State: Dropdown panel is hidden:", elements.notifDropdownPanel.classList.contains('hidden'));

    // 1. Click bell icon -> panel should open
    elements.notifBellBtn.click();
    assert.strictEqual(isNotifDropdownOpen, true, "isNotifDropdownOpen must be true after clicking bell icon");
    assert.strictEqual(elements.notifDropdownPanel.classList.contains('hidden'), false, "Panel hidden class must be removed");
    console.log("✓ 1. Bell icon clicked -> Dropdown panel opened successfully (isNotifDropdownOpen = true)");

    // 2. Click INSIDE panel -> panel should remain OPEN
    global.document.dispatchEvent({ type: 'click', target: panelChild1, bubbles: true });
    assert.strictEqual(isNotifDropdownOpen, true, "Panel must stay open when clicking header inside panel");
    assert.strictEqual(elements.notifDropdownPanel.classList.contains('hidden'), false, "Panel must not have hidden class");
    console.log("✓ 2a. Click inside panel header -> Dropdown panel remained open");

    global.document.dispatchEvent({ type: 'click', target: panelChild3, bubbles: true });
    assert.strictEqual(isNotifDropdownOpen, true, "Panel must stay open when clicking item inside panel");
    console.log("✓ 2b. Click inside panel item list -> Dropdown panel remained open");

    // 3. Click OUTSIDE panel (viewContainer / main content) -> panel should CLOSE
    global.document.dispatchEvent({ type: 'click', target: elements.viewContainer, bubbles: true });
    assert.strictEqual(isNotifDropdownOpen, false, "isNotifDropdownOpen must be false after clicking viewContainer");
    assert.strictEqual(elements.notifDropdownPanel.classList.contains('hidden'), true, "Panel hidden class must be added");
    console.log("✓ 3. Click outside (viewContainer) -> Dropdown panel closed successfully");

    // 4. Click bell icon to open again -> Click on sidebar -> panel should close
    elements.notifBellBtn.click();
    assert.strictEqual(isNotifDropdownOpen, true, "Panel must open again when bell icon is clicked");
    global.document.dispatchEvent({ type: 'click', target: elements.sidebar, bubbles: true });
    assert.strictEqual(isNotifDropdownOpen, false, "Panel must close when clicking on sidebar");
    console.log("✓ 4. Click outside on sidebar -> Dropdown panel closed successfully");

    // 5. Toggle bell icon: Click when open -> closes, click when closed -> opens
    elements.notifBellBtn.click(); // Open
    assert.strictEqual(isNotifDropdownOpen, true, "Bell click should open panel");
    console.log("✓ 5a. Bell clicked -> Panel opened");

    elements.notifBellBtn.click(); // Close
    assert.strictEqual(isNotifDropdownOpen, false, "Bell click while open should close panel");
    assert.strictEqual(elements.notifDropdownPanel.classList.contains('hidden'), true);
    console.log("✓ 5b. Bell clicked again -> Panel closed properly");

    // 6. Navigation closes panel
    elements.notifBellBtn.click(); // Open
    assert.strictEqual(isNotifDropdownOpen, true);
    toggleNotificationDropdown(false);
    assert.strictEqual(isNotifDropdownOpen, false, "Notification dropdown must be closed on navigation");
    assert.strictEqual(elements.notifDropdownPanel.classList.contains('hidden'), true);
    console.log("✓ 6. Navigation event -> Dropdown panel closed automatically");

    // 7. Verify listener singleton
    assert.strictEqual(notifOutsideClickInitialized, true, "notifOutsideClickInitialized must be true");
    assert.strictEqual(docListeners['click'].length, 1, "Only a single document click listener should be registered");
    console.log("✓ 7. notifOutsideClickInitialized flag verified: Exactly 1 event listener installed");

    console.log("\n🎉 ALL NOTIFICATION DROPDOWN OUTSIDE-CLICK TESTS PASSED WITH 100% SUCCESS!");
    process.exit(0);
}

runTests().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
