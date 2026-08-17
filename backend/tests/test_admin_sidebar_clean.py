import sys
import os
import json
import re

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app

client = app.test_client()

def test_admin_sidebar_logic():
    print("=== 1. AUDITING FRONTEND SIDEBAR TEMPLATES IN app.js ===")
    app_js_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/app.js'))
    with open(app_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract updateSidebarByRole function
    fn_match = re.search(r'function updateSidebarByRole\(\)\s*\{(.*?)\n\}', content, re.DOTALL)
    assert fn_match, "updateSidebarByRole function not found in app.js"
    fn_body = fn_match.group(1)

    # Extract ADMIN branch
    admin_branch_match = re.search(r'else if \(role === [\'"]ADMIN[\'"]\)\s*\{[\s\n]*nav\.innerHTML\s*=\s*`(.*?)`;', fn_body, re.DOTALL)
    assert admin_branch_match, "ADMIN branch not found in updateSidebarByRole"
    admin_html = admin_branch_match.group(1)

    # 9 Forbidden modules for ADMIN
    forbidden_modules = [
        ("Öğrenciler & Risk", "students"),
        ("Haftalık Program", "program"),
        ("Ödev Yönetimi", "assignments"),
        ("Deneme & Konu Analizi", "deneme"),
        ("Akademik Raporlar", "raporlar"),
        ("YKS Puan Simülatörü", "simulator"),
        ("Kitap Okuma Takibi", "books"),
        ("Çalışma Zamanlayıcısı", "timer"),
        ("AI Koç Asistanı", "ai-coach")
    ]

    for name, view_key in forbidden_modules:
        assert f"navigateView('{view_key}')" not in admin_html, f"FAIL: {name} ({view_key}) found in ADMIN sidebar!"
        print(f"✓ ADMIN sidebar correctly excludes: {name} ('{view_key}')")

    # Required modules for ADMIN
    required_admin_modules = [
        ("Yönetim Paneli", "dashboard"),
        ("Kullanıcı & Hesap Yönetimi", "admin-users"),
        ("Müfredat & Kaynak Takibi", "mufredat"),
        ("Kaynak Yönetimi", "kaynak-havuzu"),
        ("Mesajlaşma", "messages"),
        ("Bildirimler", "notifications")
    ]

    for name, view_key in required_admin_modules:
        assert f"navigateView('{view_key}')" in admin_html, f"FAIL: {name} ({view_key}) missing from ADMIN sidebar!"
        print(f"✓ ADMIN sidebar retains: {name} ('{view_key}')")

    # Extract COACH branch
    coach_branch_match = re.search(r'else if \(role === [\'"]COACH[\'"]\)\s*\{[\s\n]*nav\.innerHTML\s*=\s*`(.*?)`;', fn_body, re.DOTALL)
    assert coach_branch_match, "COACH branch not found"
    coach_html = coach_branch_match.group(1)
    # Check that Coach sidebar is untouched and has all key views
    coach_expected = ['dashboard', 'students', 'program', 'assignments', 'mufredat', 'kaynak-havuzu', 'deneme', 'raporlar', 'simulator', 'books', 'messages', 'timer', 'ai-coach']
    for v in coach_expected:
        assert f"navigateView('{v}')" in coach_html, f"FAIL: Coach sidebar lost {v}!"
    print(f"✓ COACH sidebar is fully intact with all {len(coach_expected)} modules.")

    # Extract STUDENT branch
    student_branch_match = re.search(r'if \(role === [\'"]STUDENT[\'"]\)\s*\{[\s\n]*nav\.innerHTML\s*=\s*`(.*?)`;', fn_body, re.DOTALL)
    assert student_branch_match, "STUDENT branch not found"
    student_html = student_branch_match.group(1)
    student_expected = ['dashboard', 'program', 'assignments', 'mufredat', 'deneme', 'raporlar', 'simulator', 'books', 'messages', 'timer', 'ai-coach']
    for v in student_expected:
        assert f"navigateView('{v}')" in student_html, f"FAIL: Student sidebar lost {v}!"
    print(f"✓ STUDENT sidebar is fully intact with all {len(student_expected)} modules.")

    print("\n=== 2. TESTING BACKEND ENDPOINT INTEGRITY FOR ADMIN ===")
    
    # Login as Admin
    admin_login_res = client.post("/api/login", json={"username": "admin", "password": "password123"})
    assert admin_login_res.status_code == 200, "Admin login failed"
    admin_token = json.loads(admin_login_res.data)["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

    # Check Kullanıcı & Hesap Yönetimi API
    users_res = client.get("/api/admin/users", headers=admin_headers)
    assert users_res.status_code == 200, f"GET /api/admin/users failed: {users_res.data}"
    users_data = json.loads(users_res.data)
    assert "users" in users_data and len(users_data["users"]) > 0, "Users list empty"
    print(f"✓ Kullanıcı & Hesap Yönetimi API working ({len(users_data['users'])} users).")

    # Check Kaynak Yönetimi API
    kaynak_res = client.get("/api/kaynaklar", headers=admin_headers)
    assert kaynak_res.status_code == 200, f"GET /api/kaynaklar failed: {kaynak_res.data}"
    kaynak_data = json.loads(kaynak_res.data)
    assert "resources" in kaynak_data, "Resources missing"
    print(f"✓ Kaynak Yönetimi API working ({len(kaynak_data['resources'])} resources).")

    # Check Mesajlaşma API
    msg_res = client.get("/api/mesajlar/unread-summary", headers=admin_headers)
    assert msg_res.status_code == 200, f"GET /api/mesajlar/unread-summary failed: {msg_res.data}"
    print("✓ Mesajlaşma API working.")

    # Check Bildirimler API
    notif_res = client.get("/api/notifications?unread_only=false", headers=admin_headers)
    assert notif_res.status_code == 200, f"GET /api/notifications failed: {notif_res.data}"
    print("✓ Bildirimler API working.")

    # Check Çoklu Koç / Öğrenci Eşleştirme API
    rel_res = client.get("/api/rel/coaches-search", headers=admin_headers)
    assert rel_res.status_code == 200, f"GET /api/rel/coaches-search failed: {rel_res.data}"
    print("✓ Öğrenci & Koç Eşleştirme API working.")

    print("\n🎉 ALL ADMIN SIDEBAR & PLATFORM CHECKS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    test_admin_sidebar_logic()
