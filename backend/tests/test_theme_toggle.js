const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser DOM environment
class MockElement {
    constructor(id) {
        this.id = id;
        this.textContent = '';
        this.title = '';
        this.attributes = {};
        this.classList = {
            classes: new Set(),
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
}

const elements = {
    themeIcon: new MockElement('themeIcon'),
    themeText: new MockElement('themeText'),
    themeToggleBtn: new MockElement('themeToggleBtn'),
    sidebarThemeIcon: new MockElement('sidebarThemeIcon'),
    sidebarThemeText: new MockElement('sidebarThemeText')
};

const docElement = new MockElement('html');

const mockLocalStorage = {
    store: {},
    getItem: (k) => mockLocalStorage.store[k] || null,
    setItem: (k, v) => { mockLocalStorage.store[k] = String(v); },
    removeItem: (k) => { delete mockLocalStorage.store[k]; }
};

global.document = {
    documentElement: docElement,
    getElementById: (id) => elements[id] || null
};
global.localStorage = mockLocalStorage;
global.window = {};
global.initAppBoot = () => {};

// Read app.js theme functions
const appJs = fs.readFileSync(path.join(__dirname, '../../frontend/app.js'), 'utf-8');

// Evaluate theme functions in this mock environment
const themeFunctionsCode = `
${appJs.slice(appJs.indexOf('// KOYU / AÇIK TEMA SİSTEMİ'))}
`;
eval(themeFunctionsCode);

console.log("=== 1. TESTING INITIAL THEME (DEFAULT: DARK) ===");
initTheme();
assert.strictEqual(docElement.getAttribute('data-theme'), 'dark', "Default data-theme should be dark");
assert.strictEqual(elements.themeIcon.textContent, '☀️', "In dark theme, themeIcon must show ☀️ (Açık Tema option)");
assert.strictEqual(elements.themeText.textContent, 'Açık Tema', "In dark theme, themeText must show Açık Tema");
assert.strictEqual(elements.themeToggleBtn.title, 'Açık Temaya Geç', "In dark theme, title must indicate switching to Açık Tema");
console.log("✓ Default dark theme correctly displays: [ ☀️ Açık Tema ]");

console.log("\n=== 2. TESTING TOGGLE: DARK -> LIGHT ===");
toggleTheme();
assert.strictEqual(docElement.getAttribute('data-theme'), 'light', "After toggle, data-theme should be light");
assert.strictEqual(mockLocalStorage.getItem('yks_theme'), 'light', "localStorage should be saved as light");
assert.strictEqual(elements.themeIcon.textContent, '🌙', "In light theme, themeIcon must show 🌙 (Koyu Tema option)");
assert.strictEqual(elements.themeText.textContent, 'Koyu Tema', "In light theme, themeText must show Koyu Tema");
assert.strictEqual(elements.themeToggleBtn.title, 'Koyu Temaya Geç', "In light theme, title must indicate switching to Koyu Tema");
console.log("✓ Light theme correctly displays: [ 🌙 Koyu Tema ]");

console.log("\n=== 3. TESTING TOGGLE: LIGHT -> DARK ===");
toggleTheme();
assert.strictEqual(docElement.getAttribute('data-theme'), 'dark', "After second toggle, data-theme should be dark");
assert.strictEqual(mockLocalStorage.getItem('yks_theme'), 'dark', "localStorage should be saved as dark");
assert.strictEqual(elements.themeIcon.textContent, '☀️', "In dark theme, themeIcon must show ☀️");
assert.strictEqual(elements.themeText.textContent, 'Açık Tema', "In dark theme, themeText must show Açık Tema");
assert.strictEqual(elements.themeToggleBtn.title, 'Açık Temaya Geç', "In dark theme, title must indicate switching to Açık Tema");
console.log("✓ Switched back to dark theme: [ ☀️ Açık Tema ]");

console.log("\n=== 4. TESTING PERSISTENCE ACROSS SESSIONS ===");
// Simulate page reload with 'light' in localStorage
mockLocalStorage.setItem('yks_theme', 'light');
initTheme();
assert.strictEqual(docElement.getAttribute('data-theme'), 'light');
assert.strictEqual(elements.themeIcon.textContent, '🌙');
assert.strictEqual(elements.themeText.textContent, 'Koyu Tema');
console.log("✓ Page reload with light theme preserves: [ 🌙 Koyu Tema ]");

console.log("\n🎉 ALL THEME TOGGLE TESTS PASSED WITH 100% SUCCESS!");
