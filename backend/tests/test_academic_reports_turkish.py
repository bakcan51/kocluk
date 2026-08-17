import unittest
import sys
import os
import json

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from database import get_db

class TestAcademicReportsTurkish(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

        # Login as admin
        res = self.app.post('/api/login', json={'username': 'admin', 'password': 'password123'})
        data = res.get_json()
        self.token = data['token']
        self.headers = {'Authorization': f"Bearer {self.token}", 'Content-Type': 'application/json'}

    def test_ai_analyze_student_turkish_text(self):
        # Request AI analysis for student 1
        res = self.app.post('/api/ai/analyze-student', headers=self.headers, json={'student_id': 1})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        # Check structured recommendations
        recs = data.get('structured_recommendations', [])
        self.assertTrue(len(recs) > 0, "Recommendations should not be empty")

        for r in recs:
            prob = r.get('problem', '')
            evid = r.get('evidence', '')
            
            # Assert NO English "Mastery" in problem or evidence
            self.assertNotIn("Mastery", prob, f"Problem should not contain 'Mastery': {prob}")
            self.assertNotIn("Mastery Skoru", evid, f"Evidence should not contain 'Mastery Skoru': {evid}")
            self.assertNotIn("Mastery Score", evid, f"Evidence should not contain 'Mastery Score': {evid}")

        # Check weaknesses text
        weaknesses = data.get('weaknesses', [])
        for w in weaknesses:
            self.assertNotIn("mastery skoru", w.lower(), f"Weakness should not contain 'mastery skoru': {w}")

        print("✓ Backend /api/ai/analyze-student returns 100% Turkish localized recommendations & evidence.")

    def test_frontend_templates_turkish(self):
        frontend_app_path = os.path.join(os.path.dirname(backend_dir), 'frontend', 'app.js')
        with open(frontend_app_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check for forbidden English phrases in frontend/app.js template strings
        forbidden = [
            "AI Akademik Analiz Raporu",
            "Confidence:",
            ">AI CONTEXT DEBUG<",
            ">Düşük Mastery<",
            ">Mastery Skoru"
        ]

        for phrase in forbidden:
            self.assertNotIn(phrase, content, f"frontend/app.js contains forbidden untranslated phrase: '{phrase}'")

        # Check for required Turkish phrases
        required = [
            "Yapay Zekâ Akademik Analiz Raporu",
            "Güvenilirlik:",
            "YAPAY ZEKÂ ANALİZ BAĞLAMI",
            "Düşük Hâkimiyet",
            "Hâkimiyet Puanı",
            "Geliştirilmesi Gerekenler & Konu Riskleri",
            "Ödev Ata"
        ]

        for phrase in required:
            self.assertIn(phrase, content, f"frontend/app.js is missing required Turkish phrase: '{phrase}'")

        print("✓ frontend/app.js contains all required Turkish phrases and 0 forbidden English phrases.")

if __name__ == '__main__':
    unittest.main()
