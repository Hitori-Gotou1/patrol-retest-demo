"""No-network guards for the opt-in live browser acceptance script."""
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

path = Path(__file__).with_name('browser-gallery-live.py')
spec = importlib.util.spec_from_file_location('hitori_gallery_live_browser', path)
live = importlib.util.module_from_spec(spec)
spec.loader.exec_module(live)

def sample():
    return {'HITORI_SYNC_TEST_ALLOW_WRITES':'yes-isolated-accounts',
        'HITORI_SYNC_TEST_URL':'https://gallery-live-fixture.supabase.co',
        'HITORI_SYNC_TEST_PUBLIC_KEY':'sb_publishable_fixture_only',
        'HITORI_SYNC_TEST_A_EMAIL':'a@example.test','HITORI_SYNC_TEST_A_PASSWORD':'not-real-a',
        'HITORI_SYNC_TEST_B_EMAIL':'b@example.test','HITORI_SYNC_TEST_B_PASSWORD':'not-real-b'}

class GalleryLiveGuards(unittest.TestCase):
    def test_explicit_write_and_public_configuration_guards(self):
        self.assertEqual(live.configuration(sample())['B_UID'], '')
        for key in sample():
            env = sample(); del env[key]
            with self.assertRaises(live.LiveFailure): live.configuration(env)
        for updates in [{'HITORI_SYNC_TEST_PUBLIC_KEY':'sb_secret_forbidden'},
            {'HITORI_SYNC_TEST_A_UID':'11111111-1111-4111-8111-111111111111'},
            {'HITORI_SYNC_TEST_URL':'http://gallery-live-fixture.supabase.co'},
            {'HITORI_SYNC_TEST_URL':'https://user:secret@gallery-live-fixture.supabase.co'},
            {'HITORI_SYNC_TEST_B_EMAIL':'A@example.test'}]:
            with self.assertRaises(live.LiveFailure): live.configuration({**sample(),**updates})

    def test_storage_paths_are_exact_dedicated_account_generated_ids(self):
        generated = live.EXPECTED_A_UID+'/11111111-1111-4111-8111-111111111111-preview.webp'
        self.assertTrue(live.generated_resource_path(generated))
        for value in ['../other.png','other/'+generated,live.EXPECTED_A_UID+'/existing.png',generated+'/extra']:
            self.assertFalse(live.generated_resource_path(value))

    def test_real_source_images_are_different_large_transparent_pngs(self):
        first = live.generated_png('LIVE-GALLERY-0123456789abcdef',0)
        second = live.generated_png('LIVE-GALLERY-0123456789abcdef',1)
        self.assertNotEqual(first, second)
        for payload, size in [(first,(3000,2000)),(second,(2000,3000))]:
            image = Image.open(io.BytesIO(payload))
            self.assertEqual(image.size,size)
            self.assertEqual(image.mode,'RGBA')
            self.assertEqual(image.getpixel((0,0))[3],0)

    def test_guard_only_does_not_authenticate_or_start_browser_and_redacts_report(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);dist=root/'dist';(dist/'assets').mkdir(parents=True)
            (dist/'assets/index.js').write_text('/* fixture build entry */')
            (dist/'build-info.json').write_text(json.dumps({'base':live.BASE,'entry':'assets/index.js'}))
            env={**sample(),'REPORT_DIR':str(root/'report')}
            with patch.object(live,'LiveApi',side_effect=AssertionError('network must not start')),patch.object(live,'sync_playwright',side_effect=AssertionError('browser must not start')):
                result=live.run(dist,env=env,guard_only=True)
            self.assertEqual(result['status'],'NOT_RUN')
            self.assertFalse(result['liveBackendAttempted'])
            self.assertFalse(result['verified'])
            self.assertIsNone(result['failure'])
            serialized=(root/'report/browser-gallery-live.json').read_text()
            for value in ['a@example.test','not-real-a','not-real-b','sb_publishable_fixture_only']:
                self.assertNotIn(value,serialized)

if __name__=='__main__':unittest.main()
