import os
import sys
import unittest
from unittest.mock import MagicMock
import numpy as np

# Add directory to path
sys.path.insert(0, os.path.dirname(__file__))

from recommendation import app, MAX_EXPERIENCES, MAX_USER_VIBES

class TestRecommendationService(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_health_endpoint(self):
        response = self.app.get('/health')
        self.assertIn(response.status_code, [200, 500])
        data = response.get_json()
        self.assertIn('service', data)
        self.assertEqual(data['service'], 'HiddenGemsAI ML Service')
        self.assertIn('model_loaded', data)

    def test_predict_invalid_json_format(self):
        response = self.app.post('/predict', data="not json", content_type='text/plain')
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn('message', data)

    def test_predict_non_dict_json(self):
        response = self.app.post('/predict', json=["invalid", "array"])
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn('Invalid JSON payload structure', data.get('message', ''))

    def test_predict_missing_experiences(self):
        response = self.app.post('/predict', json={"user_vibes": []})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn("Field 'experiences' must be an array", data.get('message', ''))

    def test_predict_experiences_not_list(self):
        response = self.app.post('/predict', json={"experiences": "not_an_array"})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn("Field 'experiences' must be an array", data.get('message', ''))

    def test_predict_user_vibes_not_list(self):
        response = self.app.post('/predict', json={"experiences": [], "user_vibes": "not_an_array"})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn("Field 'user_vibes' must be an array", data.get('message', ''))

    def test_predict_oversized_experiences(self):
        oversized = [{"id": i, "name": f"Exp {i}"} for i in range(MAX_EXPERIENCES + 5)]
        response = self.app.post('/predict', json={"experiences": oversized, "user_vibes": []})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn('Too many experiences provided', data.get('message', ''))

    def test_predict_oversized_user_vibes(self):
        oversized_vibes = [f"Vibe {i}" for i in range(MAX_USER_VIBES + 5)]
        response = self.app.post('/predict', json={"experiences": [], "user_vibes": oversized_vibes})
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn('Too many user_vibes provided', data.get('message', ''))

    def test_predict_oversized_request_body(self):
        # 1.2 MB string body
        large_body = "a" * (1024 * 1024 + 200000)
        response = self.app.post('/predict', data=large_body, content_type='application/json')
        self.assertEqual(response.status_code, 413)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn('maximum allowed size limit', data.get('message', ''))

    def test_predict_normal_request_with_mock(self):
        import recommendation
        original_model = recommendation.model
        try:
            # Mock model
            mock_model = MagicMock()

            class FakeTensor:
                def tolist(self):
                    return [0.85, 0.92]

            class FakeCosSim:
                def __getitem__(self, item):
                    return FakeTensor()

            recommendation.model = mock_model
            recommendation.util = MagicMock()
            recommendation.util.cos_sim.return_value = FakeCosSim()

            payload = {
                "start_time": "10:00 AM",
                "time_available_hours": 4,
                "budget_limit": 1000,
                "user_vibes": ["Culture & Heritage"],
                "experiences": [
                    {"id": 1, "name": "Fort Tour", "cost": 200, "duration_hours": 2, "latitude": 16.9, "longitude": 73.3},
                    {"id": 2, "name": "Pottery", "cost": 300, "duration_hours": 1.5, "latitude": 16.91, "longitude": 73.31}
                ]
            }

            response = self.app.post('/predict', json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertIn('itinerary', data)
            self.assertIn('totalSpent', data)
            self.assertIn('budgetLimit', data)
            self.assertEqual(data['budgetLimit'], 1000)
            self.assertTrue(isinstance(data['itinerary'], list))
        finally:
            recommendation.model = original_model

if __name__ == '__main__':
    unittest.main()
