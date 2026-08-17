import unittest
import sys
import os
import json
import io

# Add backend directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from database import init_db

class TestAPIContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()
        cls.admin_headers = {'Authorization': 'Bearer 1', 'Content-Type': 'application/json'}
        cls.coach_headers = {'Authorization': 'Bearer 2', 'Content-Type': 'application/json'}
        cls.student_headers = {'Authorization': 'Bearer 4', 'Content-Type': 'application/json'}

    # 1. Static & Health / Auth Endpoints
    def test_001_serve_uploaded_file(self):
        res = self.client.get('/uploads/nonexistent.png')
        self.assertIn(res.status_code, [404, 200])

    def test_002_upload_file(self):
        res_unauth = self.client.post('/api/upload')
        self.assertEqual(res_unauth.status_code, 401)
        res = self.client.post('/api/upload', headers=self.admin_headers, json={})
        self.assertEqual(res.status_code, 400)
        self.assertIn('application/json', res.content_type)

    def test_003_serve_index(self):
        res = self.client.get('/')
        self.assertIn(res.status_code, [200, 404])

    def test_004_005_login(self):
        res = self.client.post('/api/login', json={'username': 'admin', 'password': '123'})
        self.assertIn(res.status_code, [200, 400, 401, 429])
        self.assertIn('application/json', res.content_type)

        res2 = self.client.post('/api/auth/login', json={})
        self.assertIn(res2.status_code, [400, 401, 429])
        self.assertIn('application/json', res2.content_type)


    def test_006_handle_students(self):
        res_unauth = self.client.get('/api/students')
        self.assertEqual(res_unauth.status_code, 401)
        res = self.client.get('/api/students', headers=self.coach_headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn('application/json', res.content_type)

    def test_007_get_single_student_detail(self):
        res = self.client.get('/api/students/1', headers=self.coach_headers)
        self.assertIn(res.status_code, [200, 404])
        res_404 = self.client.get('/api/students/999999', headers=self.coach_headers)
        self.assertEqual(res_404.status_code, 404)

    def test_008_reset_student_password(self):
        res = self.client.post('/api/students/1/reset-password', headers=self.coach_headers, json={})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_009_update_student_account(self):
        res = self.client.put('/api/students/1/account', headers=self.coach_headers, json={'name': 'Updated Name'})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_010_admin_change_student_coach(self):
        res = self.client.post('/api/admin/students/1/change-coach', headers=self.admin_headers, json={'new_coach_id': 2})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_011_handle_coaches(self):
        res = self.client.get('/api/coaches', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)

    def test_012_reset_coach_password(self):
        res = self.client.post('/api/coaches/1/reset-password', headers=self.admin_headers, json={})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_013_update_coach_account(self):
        res = self.client.put('/api/coaches/1/account', headers=self.admin_headers, json={'title': 'Senior Coach'})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_014_get_admin_users(self):
        res = self.client.get('/api/admin/users', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)

    def test_015_change_self_password(self):
        res = self.client.post('/api/profile/change-password', headers=self.student_headers, json={'old_password': '123', 'new_password': '456'})
        self.assertIn(res.status_code, [200, 400])

    def test_016_get_me(self):
        res = self.client.get('/api/auth/me', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_017_get_coach_dashboard(self):
        res = self.client.get('/api/koc/dashboard', headers=self.coach_headers)
        self.assertEqual(res.status_code, 200)

    def test_018_get_student_dashboard(self):
        res = self.client.get('/api/student/dashboard', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_019_calculate_yks_score(self):
        res = self.client.post('/api/simulasyon/puan-hesapla', json={'tyt': {'turkce_d': 35, 'turkce_y': 5}})
        self.assertEqual(res.status_code, 200)

    def test_020_import_excel(self):
        res = self.client.post('/api/excel/import', headers=self.admin_headers)
        self.assertIn(res.status_code, [400, 422])

    def test_021_handle_mock_exams(self):
        res = self.client.get('/api/deneme', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_022_delete_deneme_attempt(self):
        res = self.client.delete('/api/deneme/999999', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_023_compare_mock_exams(self):
        res = self.client.get('/api/deneme/compare', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 400])


    def test_024_handle_deneme_action(self):
        res = self.client.post('/api/deneme/action', headers=self.student_headers, json={'action': 'test'})
        self.assertIn(res.status_code, [200, 400])

    def test_025_add_deneme_topic_results(self):
        res = self.client.post('/api/deneme/topic-results', headers=self.student_headers, json={})
        self.assertIn(res.status_code, [200, 400])

    def test_026_027_get_subjects(self):
        res = self.client.get('/api/subjects')
        self.assertEqual(res.status_code, 200)

    def test_028_get_topics(self):
        res = self.client.get('/api/topics?subject_id=1')
        self.assertIn(res.status_code, [200, 400])

    def test_029_delete_deneme_topic_result(self):
        res = self.client.delete('/api/deneme/topic-results/999999', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_030_handle_mock_topic_analysis(self):
        res = self.client.get('/api/deneme/analiz', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_031_handle_question_logs(self):
        res = self.client.get('/api/soru-takibi', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_032_handle_study_plans(self):
        res = self.client.get('/api/haftalik-program', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_033_update_plan_item_status(self):
        res = self.client.post('/api/haftalik-program/item-status', headers=self.student_headers, json={'item_id': 1, 'is_completed': 1})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_034_handle_assignments(self):
        res = self.client.get('/api/odevler', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_035_save_timer_session(self):
        res = self.client.post('/api/timer', headers=self.student_headers, json={'duration_seconds': 120})
        self.assertEqual(res.status_code, 200)

    def test_036_handle_resources(self):
        res = self.client.get('/api/kaynaklar', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_037_handle_single_resource(self):
        res = self.client.put('/api/kaynaklar/1', headers=self.admin_headers, json={'title': 'Update Resource'})
        self.assertIn(res.status_code, [200, 404])

    def test_038_handle_resource_discovery(self):
        res = self.client.get('/api/kaynaklar/kesif', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)

    def test_039_auto_discover_resources(self):
        res = self.client.post('/api/kaynaklar/kesif/auto-discover', headers=self.admin_headers)
        self.assertIn(res.status_code, [200, 400])

    def test_040_delete_resource_discovery_item(self):
        res = self.client.delete('/api/kaynaklar/kesif/999999', headers=self.admin_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_041_042_get_topic_resource_analysis(self):
        res = self.client.get('/api/kaynaklar/student', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)
        res2 = self.client.get('/api/kaynaklar/ogrenci', headers=self.student_headers)
        self.assertEqual(res2.status_code, 200)

    def test_043_044_assign_resource_to_student(self):
        res = self.client.post('/api/kaynaklar/assign', headers=self.coach_headers, json={'student_id': 1, 'resource_id': 1})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_045_remove_student_resource(self):
        res = self.client.delete('/api/kaynaklar/student-resource/999999', headers=self.coach_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_046_bulk_assign_resources(self):
        res = self.client.post('/api/kaynaklar/bulk-assign', headers=self.coach_headers, json={'student_ids': [1], 'resource_id': 1})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_047_get_student_mufredat(self):
        res = self.client.get('/api/mufredat', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_048_mufredat_assign_resource(self):
        res = self.client.post('/api/mufredat/kaynak-ata', headers=self.coach_headers, json={})
        self.assertIn(res.status_code, [200, 400])

    def test_049_mufredat_update_topic_status(self):
        res = self.client.post('/api/mufredat/konu-durum-guncelle', headers=self.student_headers, json={})
        self.assertIn(res.status_code, [200, 400])

    def test_050_mufredat_update_status(self):
        res = self.client.post('/api/mufredat/durum-guncelle', headers=self.student_headers, json={})
        self.assertIn(res.status_code, [200, 400])

    def test_051_mufredat_change_resource(self):
        res = self.client.post('/api/mufredat/kaynak-degistir', headers=self.coach_headers, json={})
        self.assertIn(res.status_code, [200, 400])

    def test_052_mufredat_delete_resource(self):
        res = self.client.delete('/api/mufredat/kaynak-sil/999999', headers=self.coach_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_053_get_resource_pool(self):
        res = self.client.get('/api/kaynaklar/havuz', headers=self.coach_headers)
        self.assertEqual(res.status_code, 200)

    def test_054_create_resource(self):
        res = self.client.post('/api/kaynaklar', headers=self.admin_headers, json={'title': 'Sample Book', 'subject_id': 1})
        self.assertIn(res.status_code, [200, 201])

    def test_055_create_and_assign_resource(self):
        res = self.client.post('/api/kaynaklar/create-and-assign', headers=self.coach_headers, json={'title': 'New Book', 'subject_id': 1, 'student_id': 1})
        self.assertIn(res.status_code, [200, 201, 400])

    def test_056_get_weekly_program(self):
        res = self.client.get('/api/weekly-program', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_057_create_weekly_program(self):
        res = self.client.post('/api/weekly-program', headers=self.coach_headers, json={'student_id': 1})
        self.assertIn(res.status_code, [200, 201, 400])

    def test_058_update_weekly_program(self):
        res = self.client.put('/api/weekly-program/1', headers=self.student_headers, json={})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_059_publish_weekly_program(self):
        res = self.client.post('/api/weekly-program/publish', headers=self.coach_headers, json={'student_id': 1})
        self.assertIn(res.status_code, [200, 400])

    def test_060_clear_weekly_program(self):
        res = self.client.post('/api/weekly-program/clear', headers=self.coach_headers, json={'student_id': 1})
        self.assertIn(res.status_code, [200, 400])

    def test_061_copy_weekly_program(self):
        res = self.client.post('/api/weekly-program/copy', headers=self.coach_headers, json={'source_student_id': 1, 'target_student_id': 1})
        self.assertIn(res.status_code, [200, 400])

    def test_062_delete_weekly_program(self):
        res = self.client.delete('/api/weekly-program/999999', headers=self.coach_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_063_update_weekly_program_status(self):
        res = self.client.post('/api/weekly-program/1/status', headers=self.student_headers, json={'status': 'COMPLETED'})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_064_get_admin_dashboard(self):
        res = self.client.get('/api/admin/dashboard', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)

    def test_065_get_activity_logs(self):
        res = self.client.get('/api/admin/activity-logs', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)

    def test_066_update_student_field(self):
        res = self.client.post('/api/student/update-field', headers=self.coach_headers, json={'student_id': 1, 'field': 'track', 'value': 'SAYISAL'})
        self.assertIn(res.status_code, [200, 400])

    def test_067_get_resource_curriculum_progress(self):
        res = self.client.get('/api/kaynaklar/1/mufredat-ilerleme', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_068_update_resource_topic_status(self):
        res = self.client.post('/api/kaynaklar/1/konu-durumu', headers=self.coach_headers, json={'topic_id': 1, 'status': 'COMPLETED'})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_069_get_topic_cross_resource_detail(self):
        res = self.client.get('/api/mufredat/konu-detay?topic_id=1', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 400])

    def test_070_handle_books(self):
        res = self.client.get('/api/kitaplar', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_071_get_message_contacts(self):
        res = self.client.get('/api/mesajlar/contacts', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_072_get_unread_message_summary(self):
        res = self.client.get('/api/mesajlar/unread-summary', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_073_handle_messages(self):
        res = self.client.get('/api/mesajlar', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_074_toggle_pin_message(self):
        res = self.client.post('/api/mesajlar/1/pin', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_075_handle_single_message_action(self):
        res = self.client.delete('/api/mesajlar/999999', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_076_update_conversation_settings(self):
        res = self.client.post('/api/mesajlar/settings', headers=self.student_headers, json={'target_user_id': 1})
        self.assertIn(res.status_code, [200, 400])

    def test_077_broadcast_messages(self):
        res = self.client.post('/api/mesajlar/broadcast', headers=self.coach_headers, json={'message': 'Hello Team'})
        self.assertIn(res.status_code, [200, 400])

    def test_078_generate_pdf_report(self):
        res = self.client.get('/api/raporlar/pdf', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 400, 404])

    def test_079_export_excel(self):
        res = self.client.get('/api/excel/export')
        self.assertEqual(res.status_code, 200)

    def test_080_get_reports_analytics(self):
        res = self.client.get('/api/raporlar', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_081_clear_demo_data(self):
        res = self.client.post('/api/admin/clear-demo-data', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)

    def test_082_ai_analyze_student(self):
        res = self.client.post('/api/ai/analyze-student', headers=self.coach_headers, json={'student_id': 1})
        self.assertIn(res.status_code, [200, 400])

    def test_083_get_my_connected_students(self):
        res = self.client.get('/api/rel/students', headers=self.coach_headers)
        self.assertEqual(res.status_code, 200)

    def test_084_get_my_coaches(self):
        res = self.client.get('/api/rel/my-coaches', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_085_admin_assign_coach(self):
        res = self.client.post('/api/rel/admin-assign', headers=self.admin_headers, json={'coach_id': 1, 'student_id': 1})
        self.assertIn(res.status_code, [200, 400])

    def test_086_create_coach_invitation(self):
        res = self.client.post('/api/rel/invite', headers=self.coach_headers, json={})
        self.assertEqual(res.status_code, 200)

    def test_087_get_invitation_details(self):
        res = self.client.get('/api/rel/invite/invalid_token')
        self.assertIn(res.status_code, [200, 404])

    def test_088_respond_invitation(self):
        res = self.client.post('/api/rel/invite/invalid_token/respond', headers=self.student_headers, json={'action': 'ACCEPT'})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_089_connect_with_coach_code(self):
        res = self.client.post('/api/rel/coach-code', headers=self.student_headers, json={'coach_code': 'INVALID'})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_090_search_coaches(self):
        res = self.client.get('/api/rel/coaches-search?q=Ahmet')
        self.assertEqual(res.status_code, 200)

    def test_091_respond_connection_request(self):
        res = self.client.post('/api/rel/requests/999999/respond', headers=self.coach_headers, json={'action': 'ACCEPT'})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_092_handle_coach_notes(self):
        res = self.client.get('/api/rel/coach-notes', headers=self.coach_headers)
        self.assertEqual(res.status_code, 200)

    def test_093_handle_kaynak_havuzu(self):
        res = self.client.get('/api/kaynak-havuzu', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_094_handle_kaynak_havuzu_detail(self):
        res = self.client.put('/api/kaynak-havuzu/999999', headers=self.admin_headers, json={'title': 'Updated Title'})
        self.assertIn(res.status_code, [200, 404])

    def test_095_handle_kaynak_topics(self):
        res = self.client.get('/api/kaynak-havuzu/1/topics', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_096_handle_kaynak_assign(self):
        res = self.client.post('/api/kaynak-havuzu/1/assign', headers=self.coach_headers, json={'student_id': 1})
        self.assertIn(res.status_code, [200, 400, 404])

    def test_097_get_student_resource_assignments(self):
        res = self.client.get('/api/kaynak-havuzu/student-assignments', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_098_update_kaynak_topic_progress(self):
        res = self.client.post('/api/kaynak-havuzu/topic-progress', headers=self.student_headers, json={'resource_id': 1, 'topic_id': 1, 'status': 'COMPLETED'})
        self.assertIn(res.status_code, [200, 400])

    def test_099_copy_resource_to_my_pool(self):
        res = self.client.post('/api/kaynak-havuzu/1/copy-to-my-pool', headers=self.coach_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_100_get_notifications(self):
        res = self.client.get('/api/notifications', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_101_mark_notification_read(self):
        res = self.client.post('/api/notifications/999999/read', headers=self.student_headers)
        self.assertIn(res.status_code, [200, 404])

    def test_102_mark_all_notifications_read(self):
        res = self.client.post('/api/notifications/read-all', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_103_get_academic_activity_logs(self):
        res = self.client.get('/api/activity-logs', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

    def test_104_handle_notification_preferences(self):
        res = self.client.get('/api/notification-preferences', headers=self.student_headers)
        self.assertEqual(res.status_code, 200)

if __name__ == '__main__':
    unittest.main()
