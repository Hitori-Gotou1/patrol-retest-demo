"""Local safety-guard checks only; these never call or simulate backend success."""
import importlib.util
from pathlib import Path
import unittest
from uuid import uuid4
spec = importlib.util.spec_from_file_location('browser_sync_live', Path(__file__).with_name('browser-sync-live.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LiveSyncGuards(unittest.TestCase):
    def row(self, space, entity, deleted=True, payload=None):
        return {'space':space,'entity_id':entity,'deleted':deleted,'payload':payload,'revision':1}

    def test_any_active_record_is_rejected(self):
        row=self.row('draft','photobooth',False,{'caption':'anything'})
        with self.assertRaises(module.AcceptanceFailure):
            module.validate_fresh_dedicated_account({module.key_of(row):row},'A')

    def test_only_known_test_tombstones_are_allowed(self):
        for space,entity in [('favorite','test-'+str(uuid4())),('work','test-work-'+str(uuid4())),
                             ('draft','studio'),('practice','test-practice-'+str(uuid4())),('rhythm','easy')]:
            self.assertTrue(module.known_tombstone(self.row(space,entity),'A'))
            self.assertTrue(module.known_tombstone(self.row(space,entity),'B'))
        for space,entity in [('private','photobooth'),('draft','unknown'),('favorite','someone-else'),('work','customer-record')]:
            self.assertFalse(module.known_tombstone(self.row(space,entity),'A'))
        self.assertTrue(module.known_tombstone(self.row('draft','photobooth'),'B'))
        self.assertTrue(module.known_tombstone(self.row('favorite','quiet-guitar'),'B'))

    def test_public_config_rejects_server_keys_and_non_https(self):
        for root,key in [('http://example.com','sb_publishable_fixture'),('https://example.com','sb_secret_forbidden')]:
            with self.assertRaises(module.AcceptanceFailure):
                module.validate_public_config({'HITORI_SYNC_TEST_URL':root,'HITORI_SYNC_TEST_PUBLIC_KEY':key})
        module.validate_public_config({'HITORI_SYNC_TEST_URL':'https://example.supabase.co','HITORI_SYNC_TEST_PUBLIC_KEY':'sb_publishable_fixture'})

    def test_nested_report_redacts_credentials_and_unlisted_bearer_tokens(self):
        source={'failure':'password is p@ss"word','nested':[{'message':'Bearer accidental-token'}]}
        result=module.safe_report(source,['p@ss"word'])
        self.assertNotIn('p@ss"word',str(result))
        self.assertNotIn('accidental-token',str(result))
        self.assertIn('[REDACTED]',str(result))

if __name__=='__main__':unittest.main()
