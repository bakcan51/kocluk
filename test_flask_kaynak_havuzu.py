import sys
sys.path.append('backend')
from database import init_db, get_db
from app import app

def test_scenario_flask():
    print("🚀 RUNNING FLASK TEST CLIENT FOR KAYNAK HAVUZU REFACTOR & POOL ISOLATION...")
    init_db()

    client = app.test_client()

    # Clear old test users if exist
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE username IN ('koca_test', 'kocb_test', 'kocc_test');")
    cursor.execute("DELETE FROM resource_suggestions;")
    cursor.execute("UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE username = 'admin';")
    conn.commit()

    # 1. Admin Login
    res = client.post('/api/login', json={'username': 'admin', 'password': 'password123'})
    assert res.status_code == 200, f"Admin login failed: {res.get_data(as_text=True)}"
    admin_token = res.get_json()['token']
    admin_headers = {'Authorization': f'Bearer {admin_token}'}

    # Admin Genel Havuz Initial Count
    res = client.get('/api/kaynak-havuzu', headers=admin_headers)
    assert res.status_code == 200, f"Admin kaynak havuzu failed: {res.get_data(as_text=True)}"
    genel_initial_resources = res.get_json()['resources']
    genel_initial_count = len(genel_initial_resources)
    print(f"✅ Step 1: Admin Genel Kaynak Havuzu initial count: {genel_initial_count}")

    # 2. Create Coach A & Coach B
    res_ca = client.post('/api/coaches', json={
        "username": "koca_test", "email": "koca@test.com", "password": "password123", "password_repeat": "password123",
        "name": "Koç", "surname": "A"
    }, headers=admin_headers)
    assert res_ca.status_code == 200, f"Create Coach A failed: {res_ca.get_data(as_text=True)}"

    res_cb = client.post('/api/coaches', json={
        "username": "kocb_test", "email": "kocb@test.com", "password": "password123", "password_repeat": "password123",
        "name": "Koç", "surname": "B"
    }, headers=admin_headers)
    assert res_cb.status_code == 200, f"Create Coach B failed: {res_cb.get_data(as_text=True)}"

    # 3. Log in as Coach A
    res_a = client.post('/api/login', json={'username': 'koca_test', 'password': 'password123'})
    assert res_a.status_code == 200
    token_a = res_a.get_json()['token']
    headers_a = {'Authorization': f'Bearer {token_a}'}

    res_a_pool = client.get('/api/kaynak-havuzu', headers=headers_a)
    assert res_a_pool.status_code == 200
    resources_a = res_a_pool.get_json()['resources']
    count_a_initial = len(resources_a)
    print(f"✅ Step 2: Coach A personal pool initialized with {count_a_initial} resources (Copied from Genel Havuz)")
    assert count_a_initial == genel_initial_count

    # 4. Log in as Coach B
    res_b = client.post('/api/login', json={'username': 'kocb_test', 'password': 'password123'})
    assert res_b.status_code == 200
    token_b = res_b.get_json()['token']
    headers_b = {'Authorization': f'Bearer {token_b}'}

    res_b_pool = client.get('/api/kaynak-havuzu', headers=headers_b)
    assert res_b_pool.status_code == 200
    count_b_initial = len(res_b_pool.get_json()['resources'])
    print(f"✅ Step 3: Coach B personal pool initialized with {count_b_initial} resources")
    assert count_b_initial == genel_initial_count

    # 5. Coach A Deletes 1 Resource from Personal Pool
    delete_res_id = resources_a[0]['id']
    res_del = client.delete(f'/api/kaynak-havuzu/{delete_res_id}', headers=headers_a)
    assert res_del.status_code == 200, f"Delete failed: {res_del.get_data(as_text=True)}"

    # Verify counts
    res_a_del = client.get('/api/kaynak-havuzu', headers=headers_a)
    count_a_del = len(res_a_del.get_json()['resources'])

    res_b_del = client.get('/api/kaynak-havuzu', headers=headers_b)
    count_b_del = len(res_b_del.get_json()['resources'])

    res_g_del = client.get('/api/kaynak-havuzu', headers=admin_headers)
    count_g_del = len(res_g_del.get_json()['resources'])

    print(f"✅ Step 4: After Coach A deleted 1 resource -> Coach A: {count_a_del}, Coach B: {count_b_del}, Genel: {count_g_del}")
    assert count_a_del == count_a_initial - 1
    assert count_b_del == count_b_initial
    assert count_g_del == genel_initial_count

    # 6. Coach A Adds a New Resource (Suggestion 1)
    res_add1 = client.post('/api/kaynak-havuzu', json={
        "name": "Apotemi TYT Geometri Bankası - Koç A Özel",
        "publisher": "Apotemi Yayınları",
        "exam_system": "YKS",
        "exam_type": "TYT",
        "subject_id": 1,
        "resource_type": "Soru Bankası"
    }, headers=headers_a)
    assert res_add1.status_code == 200, f"Add resource failed: {res_add1.get_data(as_text=True)}"
    print("✅ Step 5: Coach A added new resource to personal pool.")

    # 7. Check Admin Suggestions & Reject
    res_sug = client.get('/api/admin/resource-suggestions', headers=admin_headers)
    assert res_sug.status_code == 200
    sugs = res_sug.get_json()['suggestions']
    pending_sug1 = [s for s in sugs if s["resource_title"] == "Apotemi TYT Geometri Bankası - Koç A Özel"][0]
    assert pending_sug1["status"] == "BEKLİYOR"
    print(f"✅ Step 6: Admin received suggestion ID {pending_sug1['id']} with status BEKLİYOR")

    # Admin Rejects Suggestion 1
    res_rej = client.post(f"/api/admin/resource-suggestions/{pending_sug1['id']}/respond", json={"action": "REJECT"}, headers=admin_headers)
    assert res_rej.status_code == 200
    assert res_rej.get_json()["status"] == "REDDEDİLDİ"
    print("✅ Step 7: Admin REJECTED suggestion 1 -> Status updated to REDDEDİLDİ")

    # Verify Genel count unchanged, Coach A retains resource
    res_g_rej = client.get('/api/kaynak-havuzu', headers=admin_headers)
    assert len(res_g_rej.get_json()['resources']) == genel_initial_count
    print("✅ Step 8: Genel Havuz count unchanged after rejection.")

    # 8. Coach A Adds Second New Resource (Suggestion 2)
    res_add2 = client.post('/api/kaynak-havuzu', json={
        "name": "3D TYT Kimya Soru Bankası - Koç A Öneri",
        "publisher": "3D Yayınları",
        "exam_system": "YKS",
        "exam_type": "TYT",
        "subject_id": 3,
        "resource_type": "Soru Bankası"
    }, headers=headers_a)
    assert res_add2.status_code == 200

    res_sug2 = client.get('/api/admin/resource-suggestions', headers=admin_headers)
    pending_sug2 = [s for s in res_sug2.get_json()["suggestions"] if s["resource_title"] == "3D TYT Kimya Soru Bankası - Koç A Öneri"][0]

    # 9. Admin Approves Suggestion 2
    res_app = client.post(f"/api/admin/resource-suggestions/{pending_sug2['id']}/respond", json={"action": "APPROVE"}, headers=admin_headers)
    assert res_app.status_code == 200
    assert res_app.get_json()["status"] == "ONAYLANDI"
    print("✅ Step 9: Admin APPROVED suggestion 2 -> Status updated to ONAYLANDI")

    res_g_app = client.get('/api/kaynak-havuzu', headers=admin_headers)
    count_g_post_app = len(res_g_app.get_json()['resources'])
    assert count_g_post_app == genel_initial_count + 1
    print(f"✅ Step 10: Genel Havuz count increased from {genel_initial_count} to {count_g_post_app}")

    res_b_app = client.get('/api/kaynak-havuzu', headers=headers_b)
    count_b_post_app = len(res_b_app.get_json()['resources'])
    assert count_b_post_app == count_b_initial
    print(f"✅ Step 11: Existing Coach B count remained untouched ({count_b_post_app})")

    # 10. Create New Coach C & Verify Initialization
    res_cc = client.post('/api/coaches', json={
        "username": "kocc_test", "email": "kocc@test.com", "password": "password123", "password_repeat": "password123",
        "name": "Koç", "surname": "C"
    }, headers=admin_headers)
    assert res_cc.status_code == 200

    res_c = client.post('/api/login', json={'username': 'kocc_test', 'password': 'password123'})
    assert res_c.status_code == 200
    token_c = res_c.get_json()['token']
    headers_c = {'Authorization': f'Bearer {token_c}'}

    res_c_pool = client.get('/api/kaynak-havuzu', headers=headers_c)
    assert res_c_pool.status_code == 200
    count_c = len(res_c_pool.get_json()['resources'])
    print(f"✅ Step 12: Newly created Coach C initialized with updated Genel Havuz count: {count_c}")
    assert count_c == count_g_post_app

    print("\n🎉🎉 ALL TEST STEPS PASSED PERFECTLY! KAYNAK HAVUZU REFACTOR IS 100% VERIFIED!")

if __name__ == "__main__":
    test_scenario_flask()
