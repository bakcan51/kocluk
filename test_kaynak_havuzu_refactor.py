import urllib.request
import json

BASE_URL = "http://127.0.0.1:5005/api"

def http_post(url, data=None, headers=None):
    if headers is None:
        headers = {}
    headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8') if data else b"", headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def http_get(url, headers=None):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def http_delete(url, headers=None):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def test_full_scenario():
    print("🚀 STARTING KAYNAK HAVUZU REFACTOR & POOL ISOLATION TEST...")
    
    # 1. Admin Login
    code, res = http_post(f"{BASE_URL}/login", {"username": "admin", "password": "password123"})
    if code != 200:
        code, res = http_post(f"{BASE_URL}/login", {"username": "admin", "password": "admin123"})
    assert code == 200, f"Admin login failed: {res}"
    admin_token = res["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Check Admin Genel Havuz initial count
    code, res = http_get(f"{BASE_URL}/kaynak-havuzu", headers=admin_headers)
    assert code == 200, f"Admin kaynak havuzu failed: {res}"
    genel_initial_count = len(res["resources"])
    print(f"✅ Step 1: Admin Genel Kaynak Havuzu initial count: {genel_initial_count}")

    # 2. Create Coach A & Coach B
    http_post(f"{BASE_URL}/admin/users", {
        "username": "koca_test", "email": "koca@test.com", "password": "password123",
        "role": "COACH", "name": "Koç", "surname": "A"
    }, headers=admin_headers)

    http_post(f"{BASE_URL}/admin/users", {
        "username": "kocb_test", "email": "kocb@test.com", "password": "password123",
        "role": "COACH", "name": "Koç", "surname": "B"
    }, headers=admin_headers)

    # 3. Log in as Coach A
    code_a, res_a = http_post(f"{BASE_URL}/login", {"username": "koca_test", "password": "password123"})
    assert code_a == 200, f"Coach A login failed: {res_a}"
    token_a = res_a["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    code_ap, res_a_pool = http_get(f"{BASE_URL}/kaynak-havuzu", headers=headers_a)
    assert code_ap == 200
    resources_a = res_a_pool["resources"]
    count_a_initial = len(resources_a)
    print(f"✅ Step 2: Coach A personal pool initialized with {count_a_initial} resources (Copied from Genel Havuz)")
    assert count_a_initial == genel_initial_count, f"Expected {genel_initial_count}, got {count_a_initial}"

    # 4. Log in as Coach B
    code_b, res_b = http_post(f"{BASE_URL}/login", {"username": "kocb_test", "password": "password123"})
    assert code_b == 200, f"Coach B login failed: {res_b}"
    token_b = res_b["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    code_bp, res_b_pool = http_get(f"{BASE_URL}/kaynak-havuzu", headers=headers_b)
    assert code_bp == 200
    count_b_initial = len(res_b_pool["resources"])
    print(f"✅ Step 3: Coach B personal pool initialized with {count_b_initial} resources")
    assert count_b_initial == genel_initial_count

    # 5. Coach A Deletes 1 Resource
    delete_res_id = resources_a[0]["id"]
    code_del, res_del = http_delete(f"{BASE_URL}/kaynak-havuzu/{delete_res_id}", headers=headers_a)
    assert code_del == 200, f"Coach A delete resource failed: {res_del}"

    # Verify counts
    _, res_a_after_del = http_get(f"{BASE_URL}/kaynak-havuzu", headers=headers_a)
    count_a_del = len(res_a_after_del["resources"])
    
    _, res_b_after_del = http_get(f"{BASE_URL}/kaynak-havuzu", headers=headers_b)
    count_b_del = len(res_b_after_del["resources"])

    _, res_genel_after_del = http_get(f"{BASE_URL}/kaynak-havuzu", headers=admin_headers)
    count_genel_del = len(res_genel_after_del["resources"])

    print(f"✅ Step 4: After Coach A deleted 1 resource -> Coach A: {count_a_del}, Coach B: {count_b_del}, Genel: {count_genel_del}")
    assert count_a_del == count_a_initial - 1
    assert count_b_del == count_b_initial
    assert count_genel_del == genel_initial_count

    # 6. Coach A Adds a New Resource (Suggestion 1)
    code_add1, res_add1 = http_post(f"{BASE_URL}/kaynak-havuzu", {
        "name": "Apotemi TYT Geometri Bankası - Koç A Özel",
        "publisher": "Apotemi Yayınları",
        "exam_system": "YKS",
        "exam_type": "TYT",
        "subject_id": 1,
        "resource_type": "Soru Bankası"
    }, headers=headers_a)
    assert code_add1 == 200, f"Coach A add resource failed: {res_add1}"
    print("✅ Step 5: Coach A added new resource to personal pool.")

    # 7. Check Admin Suggestions & Reject
    code_sug, res_sug = http_get(f"{BASE_URL}/admin/resource-suggestions", headers=admin_headers)
    assert code_sug == 200
    sugs = res_sug["suggestions"]
    pending_sug1 = [s for s in sugs if s["resource_title"] == "Apotemi TYT Geometri Bankası - Koç A Özel"][0]
    assert pending_sug1["status"] == "BEKLİYOR"
    print(f"✅ Step 6: Admin received notification/suggestion ID {pending_sug1['id']} with status BEKLİYOR")

    # Admin Rejects Suggestion 1
    code_rej, res_rej = http_post(f"{BASE_URL}/admin/resource-suggestions/{pending_sug1['id']}/respond", {"action": "REJECT"}, headers=admin_headers)
    assert code_rej == 200
    assert res_rej["status"] == "REDDEDİLDİ"
    print("✅ Step 7: Admin REJECTED suggestion 1 -> Status updated to REDDEDİLDİ")

    # Verify Genel count unchanged, Coach A retains resource
    _, res_genel_rej = http_get(f"{BASE_URL}/kaynak-havuzu", headers=admin_headers)
    count_genel_post_rej = len(res_genel_rej["resources"])
    assert count_genel_post_rej == genel_initial_count
    print("✅ Step 8: Genel Havuz count unchanged after rejection.")

    # 8. Coach A Adds Second New Resource (Suggestion 2)
    code_add2, res_add2 = http_post(f"{BASE_URL}/kaynak-havuzu", {
        "name": "3D TYT Kimya Soru Bankası - Koç A Öneri",
        "publisher": "3D Yayınları",
        "exam_system": "YKS",
        "exam_type": "TYT",
        "subject_id": 3,
        "resource_type": "Soru Bankası"
    }, headers=headers_a)
    assert code_add2 == 200

    _, res_sug2 = http_get(f"{BASE_URL}/admin/resource-suggestions", headers=admin_headers)
    pending_sug2 = [s for s in res_sug2["suggestions"] if s["resource_title"] == "3D TYT Kimya Soru Bankası - Koç A Öneri"][0]

    # 9. Admin Approves Suggestion 2
    code_app, res_app = http_post(f"{BASE_URL}/admin/resource-suggestions/{pending_sug2['id']}/respond", {"action": "APPROVE"}, headers=admin_headers)
    assert code_app == 200
    assert res_app["status"] == "ONAYLANDI"
    print("✅ Step 9: Admin APPROVED suggestion 2 -> Status updated to ONAYLANDI")

    _, res_genel_app = http_get(f"{BASE_URL}/kaynak-havuzu", headers=admin_headers)
    count_genel_post_app = len(res_genel_app["resources"])
    assert count_genel_post_app == genel_initial_count + 1
    print(f"✅ Step 10: Genel Havuz count increased from {genel_initial_count} to {count_genel_post_app}")

    _, res_b_app = http_get(f"{BASE_URL}/kaynak-havuzu", headers=headers_b)
    count_b_post_app = len(res_b_app["resources"])
    assert count_b_post_app == count_b_initial
    print(f"✅ Step 11: Existing Coach B count remained untouched ({count_b_post_app})")

    # 10. Create New Coach C & Verify Initialization
    http_post(f"{BASE_URL}/admin/users", {
        "username": "kocc_test", "email": "kocc@test.com", "password": "password123",
        "role": "COACH", "name": "Koç", "surname": "C"
    }, headers=admin_headers)

    code_c, res_c = http_post(f"{BASE_URL}/login", {"username": "kocc_test", "password": "password123"})
    assert code_c == 200
    token_c = res_c["token"]
    headers_c = {"Authorization": f"Bearer {token_c}"}

    code_cp, res_c_pool = http_get(f"{BASE_URL}/kaynak-havuzu", headers=headers_c)
    assert code_cp == 200
    count_c = len(res_c_pool["resources"])
    print(f"✅ Step 12: Newly created Coach C initialized with updated Genel Havuz count: {count_c}")
    assert count_c == count_genel_post_app

    print("\n🎉🎉 ALL 12 TEST STEPS PASSED PERFECTLY! KAYNAK HAVUZU REFACTOR IS 100% VERIFIED!")

if __name__ == "__main__":
    test_full_scenario()
