import unittest
from monitor import transitions

class AlertLifecycle(unittest.TestCase):
    def test_alert_deduplication_and_recovery(self):
        current = {'worker': 'Worker is unhealthy'}
        self.assertEqual(transitions({}, current)[0]['status'], 'alert')
        self.assertEqual(transitions(current, current), [])
        self.assertEqual(transitions(current, {})[0]['status'], 'resolved')
    def test_changed_count_produces_new_observation(self):
        self.assertEqual(len(transitions({'failedJobs': '1'}, {'failedJobs': '2'})), 1)

if __name__ == '__main__': unittest.main()
