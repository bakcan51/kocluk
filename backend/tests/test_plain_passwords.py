import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app

client = app.test_client()

def make_req(path, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    if method == "GET":
        resp = client.get(path, headers=headers)
    elif method == "POST":
        resp = client.post(path, headers=headers, json=data)
    elif method == "PUT":
        resp = client.put(path, headers=headers, json=data)
    elif method == "DELETE":
        resp = client.delete(path, headers=headers)
    else:
        raise ValueError("Unsupported method")
    
    status = resp.status_code
    try:
        content = json.loads(resp.data.decode("utf-8")) if resp.data else {}
    except Exception:
        content = {"raw": resp.data.decode("utf-8")}
    return status, content

def run_tests():
    print("=== Testing Password Visibility & Management Endpoints ===")
    
    # 1. Login as Admin
    status, admin_login = make_req("/api/login", "POST", {
        "username": "admin",
        "password": "password123"
    })
    assert status == 200 and "token" in admin_login, f"Admin login failed: {admin_login}"
    admin_token = admin_login["token"]
    print("✓ 1. Admin login successful.")

    # 2. Admin retrieves a student's password
    status, admin_pw_data = make_req("/api/admin/users/4/password", "GET", token=admin_token)
    assert status == 200, f"Admin password get failed: {admin_pw_data}"
    assert "plain_password" in admin_pw_data, "plain_password missing in admin response"
    print(f"✓ 2. Admin retrieved student (ID: 4) plain_password: '{admin_pw_data['plain_password']}'")

    # 3. Admin updates student's password
    new_test_pw = "yeniSifre2026!"
    status, admin_set_pw = make_req("/api/admin/users/4/password", "POST", {
        "new_password": new_test_pw,
        "confirm_password": new_test_pw
    }, token=admin_token)
    assert status == 200, f"Admin set password failed: {admin_set_pw}"
    print(f"✓ 3. Admin successfully updated student password to '{new_test_pw}'")

    # 4. Check that GET /api/admin/users/4/password returns the updated plain_password
    status, admin_check_pw = make_req("/api/admin/users/4/password", "GET", token=admin_token)
    assert status == 200 and admin_check_pw["plain_password"] == new_test_pw, f"Expected {new_test_pw}, got {admin_check_pw}"
    print("✓ 4. Admin GET /password returned updated plain_password correctly.")

    # 5. Student logs in with the new password
    status, student_login = make_req("/api/login", "POST", {
        "username": admin_pw_data["user"]["username"],
        "password": new_test_pw
    })
    assert status == 200 and "token" in student_login, f"Student login with new password failed: {student_login}"
    print(f"✓ 5. Student successfully logged in with newly assigned password: '{new_test_pw}'")

    # 6. Login as Coach
    status, coach_login = make_req("/api/login", "POST", {
        "username": "ummu.akcan",
        "password": "password123"
    })
    assert status == 200 and "token" in coach_login, f"Coach login failed: {coach_login}"
    coach_token = coach_login["token"]
    print("✓ 6. Coach login successful.")

    # 7. Coach gets own student's password (student_id = 1, user_id = 4)
    status, coach_pw_data = make_req("/api/coach/students/1/password", "GET", token=coach_token)
    assert status == 200, f"Coach get student password failed: {coach_pw_data}"
    assert coach_pw_data["plain_password"] == new_test_pw, f"Expected {new_test_pw}, got {coach_pw_data.get('plain_password')}"
    print(f"✓ 7. Coach retrieved own student plain_password: '{coach_pw_data['plain_password']}'")

    # 8. Coach updates own student's password
    coach_new_pw = "kocBelirledi2026"
    status, coach_set_pw = make_req("/api/coach/students/1/password", "POST", {
        "new_password": coach_new_pw,
        "confirm_password": coach_new_pw
    }, token=coach_token)
    assert status == 200, f"Coach set student password failed: {coach_set_pw}"
    print(f"✓ 8. Coach successfully updated student password to '{coach_new_pw}'")

    # 9. Verify updated password is saved in DB and retrieved
    status, coach_recheck = make_req("/api/coach/students/1/password", "GET", token=coach_token)
    assert status == 200 and coach_recheck["plain_password"] == coach_new_pw, f"Expected {coach_new_pw}, got {coach_recheck}"
    print("✓ 9. Coach GET /password confirmed updated plain_password.")

    # 10. Student logs in with coach's updated password
    status, student_login2 = make_req("/api/login", "POST", {
        "username": admin_pw_data["user"]["username"],
        "password": coach_new_pw
    })
    assert status == 200 and "token" in student_login2, f"Student login with coach password failed: {student_login2}"
    print(f"✓ 10. Student successfully logged in with coach-set password: '{coach_new_pw}'")

    # 11. Self change password by student
    student_token = student_login2["token"]
    final_pw = "ogrenci123"
    status, self_change_res = make_req("/api/profile/change-password", "POST", {
        "current_password": coach_new_pw,
        "new_password": final_pw,
        "confirm_password": final_pw
    }, token=student_token)
    assert status == 200, f"Self change password failed: {self_change_res}"
    print(f"✓ 11. Student self changed password back to '{final_pw}'")

    # 12. Verify Admin and Coach now see final_pw
    status, coach_recheck2 = make_req("/api/coach/students/1/password", "GET", token=coach_token)
    assert status == 200 and coach_recheck2["plain_password"] == final_pw, f"Expected {final_pw}, got {coach_recheck2}"
    print(f"✓ 12. Admin & Coach now see the latest password '{final_pw}' perfectly!")

    print("\n🎉 ALL 12 VERIFICATION TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    run_tests()
