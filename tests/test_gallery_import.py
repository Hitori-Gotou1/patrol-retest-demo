"""Importer integration tests using temporary repositories and generated images."""

import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from PIL import Image


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/import-gallery.py"
SPEC = importlib.util.spec_from_file_location("gallery_import", SCRIPT)
importer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(importer)


class GalleryImportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "repository"
        self.input = self.base / "input"
        self.input.mkdir()
        self.public = self.root / "public"
        self.public.mkdir(parents=True)
        self.manifest = self.root / importer.MANIFEST
        self.manifest.parent.mkdir(parents=True)
        self.manifest.write_text("[]\n", encoding="utf-8")

    def image(self, path, size=(80, 40), color=(220, 40, 70), mode="RGB", **options):
        path.parent.mkdir(parents=True, exist_ok=True)
        with Image.new(mode, size, color) as image:
            image.save(path, **options)
        return path

    def read_records(self):
        return json.loads(self.manifest.read_text(encoding="utf-8"))

    def snapshot(self):
        return {path.relative_to(self.root).as_posix(): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file()}

    def cli(self, *arguments):
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--root", str(self.root), *map(str, arguments)],
            capture_output=True, text=True, check=False,
        )

    def existing_record(self):
        self.image(self.public / "assets/old.jpg", color=(0, 100, 200))
        self.image(self.public / "assets/old.webp", color=(0, 100, 200))
        return {
            "id": "collection-existing", "category": "collection",
            "src": "assets/old.jpg", "thumbnail": "assets/old.webp",
            "originalSrc": "assets/old.jpg", "width": 80, "height": 40,
            "title": "既有收藏", "subtitle": "原有说明", "tag": "收藏",
            "alt": "原有描述", "credit": "原有来源", "custom": {"preserve": True},
        }

    def write_records(self, records):
        self.manifest.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def test_cli_imports_supported_formats_with_bounded_previews_and_metadata(self):
        jpg = self.image(self.input / "summer-night.JPG", (2400, 1200))
        self.image(self.input / "nested/small.png", (23, 17), (20, 130, 180))
        self.image(self.input / "third.webp", (40, 90), (70, 80, 90))
        (self.input / "notes.txt").write_text("ignored", encoding="utf-8")
        metadata = self.input / "metadata.json"
        metadata.write_text(json.dumps({"summer-night.JPG": {
            "title": " 夏日夜晚 ", "alt": " 演出的灯光 ", "credit": " 原作者 "
        }}, ensure_ascii=False), encoding="utf-8")
        result = self.cli(self.input, "--metadata", metadata)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Imported 3", result.stdout)
        records = self.read_records()
        self.assertEqual(len(records), 3)
        record = next(item for item in records if item["title"] == "夏日夜晚")
        digest = hashlib.sha256(jpg.read_bytes()).hexdigest()
        self.assertEqual(record["id"], f"collection-{digest}")
        self.assertEqual(record["alt"], "演出的灯光")
        self.assertEqual(record["credit"], "原作者")
        self.assertEqual((record["width"], record["height"]), (2400, 1200))
        self.assertEqual((self.public / record["originalSrc"]).read_bytes(), jpg.read_bytes())
        with Image.open(self.public / record["src"]) as preview:
            self.assertEqual(preview.format, "WEBP")
            self.assertEqual(preview.size, (1600, 800))
        with Image.open(self.public / record["thumbnail"]) as thumbnail:
            self.assertEqual(thumbnail.size, (640, 320))
        small = next(item for item in records if item["title"] == "small")
        with Image.open(self.public / small["src"]) as preview:
            self.assertEqual(preview.size, (23, 17))
        self.assertEqual(self.cli("--check").returncode, 0)

    def test_repeated_import_and_identical_new_files_are_no_ops(self):
        source = self.image(self.input / "first-image.png")
        (self.input / "second-name.png").write_bytes(source.read_bytes())
        self.assertEqual(importer.import_images(self.root, self.input), (1, 1))
        self.assertEqual(self.read_records()[0]["title"], "first image")
        before = self.snapshot()
        self.assertEqual(importer.import_images(self.root, self.input), (0, 2))
        self.assertEqual(self.snapshot(), before)

    def test_existing_records_ids_text_and_assets_survive_and_duplicates_are_skipped(self):
        record = self.existing_record()
        # Deliberately use non-default formatting to detect unnecessary rewriting.
        original_text = "[\n  " + json.dumps(record, ensure_ascii=False) + "\n]\n"
        self.manifest.write_text(original_text, encoding="utf-8")
        before = self.snapshot()
        (self.input / "renamed-old.jpeg").write_bytes((self.public / "assets/old.jpg").read_bytes())
        self.image(self.input / "new.png")
        self.assertEqual(importer.import_images(self.root, self.input), (1, 1))
        self.assertEqual(self.read_records()[0], record)
        self.assertTrue(self.manifest.read_text(encoding="utf-8").startswith(original_text[:-3] + ","))
        for path, content in before.items():
            if path != importer.MANIFEST.as_posix():
                self.assertEqual((self.root / path).read_bytes(), content)

    def test_check_does_not_write(self):
        self.write_records([self.existing_record()])
        before = self.snapshot()
        result = self.cli("--check")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("1 entries", result.stdout)
        self.assertEqual(self.snapshot(), before)

    def test_missing_assets_block_check_and_import(self):
        record = self.existing_record()
        self.image(self.input / "new.png")
        for field in ("src", "thumbnail", "originalSrc"):
            with self.subTest(field=field):
                self.write_records([{**record, field: "assets/missing.png"}])
                before = self.snapshot()
                result = self.cli("--check")
                self.assertEqual(result.returncode, 1)
                self.assertIn("missing asset", result.stderr)
                with self.assertRaisesRegex(importer.ImportError, "missing asset"):
                    importer.import_images(self.root, self.input)
                self.assertEqual(self.snapshot(), before)

    def test_invalid_ids_dimensions_and_structure_are_rejected(self):
        record = self.existing_record()
        invalid = [
            {}, [None], [record, record], [{**record, "id": "quiet-guitar"}],
            [{**record, "id": "bad id"}], [{**record, "width": True}],
            [{**record, "height": 0}], [{**record, "title": " "}],
            [{**record, "category": "unknown"}], [{**record, "alt": None}],
        ]
        for records in invalid:
            with self.subTest(records=records):
                self.write_records(records)
                with self.assertRaises(importer.ImportError):
                    importer.read_manifest(self.root)
        for content in ('[{"id":"one","id":"two"}]', '[NaN]', '{broken'):
            self.manifest.write_text(content, encoding="utf-8")
            with self.assertRaises(importer.ImportError):
                importer.read_manifest(self.root)

    def test_unsafe_manifest_paths_are_rejected(self):
        record = self.existing_record()
        for value in ("../outside.png", "/assets/old.jpg", "assets/../assets/old.jpg",
                      "https://example.com/image.jpg", "assets\\old.jpg", "assets/old.jpg?query=1",
                      "assets//old.jpg", "assets/./old.jpg"):
            with self.subTest(path=value):
                self.write_records([{**record, "src": value}])
                with self.assertRaises(importer.ImportError):
                    importer.read_manifest(self.root)
        outside = self.image(self.base / "outside.png")
        (self.public / "outside.png").symlink_to(outside)
        self.write_records([{**record, "src": "outside.png"}])
        with self.assertRaisesRegex(importer.ImportError, "escapes public"):
            importer.read_manifest(self.root)

    def test_all_candidates_must_decode_before_any_gallery_files_change(self):
        self.image(self.input / "a-good.png")
        valid_jpeg = self.image(self.base / "valid.jpg").read_bytes()
        for filename, content in (("z-bad.png", b"not an image"),
                                  ("z-bad.jpg", valid_jpeg[:-30]),
                                  ("z-wrong.png", valid_jpeg)):
            with self.subTest(filename=filename):
                bad = self.input / filename
                bad.write_bytes(content)
                before = self.snapshot()
                result = self.cli(self.input)
                self.assertEqual(result.returncode, 1)
                self.assertIn("Gallery import failed", result.stderr)
                self.assertEqual(self.snapshot(), before)
                bad.unlink()

    def test_animation_is_rejected_instead_of_silently_dropping_frames(self):
        with Image.new("RGB", (10, 20), "red") as first, Image.new("RGB", (10, 20), "blue") as second:
            first.save(self.input / "animated.webp", save_all=True, append_images=[second], duration=100, loop=0)
        with self.assertRaisesRegex(importer.ImportError, "animated"):
            importer.import_images(self.root, self.input)
        self.assertEqual(self.read_records(), [])

    def test_exif_orientation_applies_to_derivatives_and_dimensions_only(self):
        path = self.input / "rotated.jpg"
        with Image.new("RGB", (80, 40), "red") as image:
            image.paste("blue", (40, 0, 80, 40))
            exif = Image.Exif()
            exif[274] = 6  # 90 degrees clockwise: left red half becomes top half.
            image.save(path, exif=exif, quality=95)
        original = path.read_bytes()
        importer.import_images(self.root, self.input)
        record = self.read_records()[0]
        self.assertEqual((record["width"], record["height"]), (40, 80))
        self.assertEqual((self.public / record["originalSrc"]).read_bytes(), original)
        for field in ("src", "thumbnail"):
            with Image.open(self.public / record[field]) as image:
                self.assertEqual(image.size, (40, 80))
                self.assertIsNone(image.getexif().get(274))
                self.assertGreater(image.getpixel((20, 10))[0], 200)
                self.assertGreater(image.getpixel((20, 70))[2], 200)

    def test_rgba_and_palette_transparency_survive(self):
        self.image(self.input / "alpha.png", color=(210, 90, 30, 128), mode="RGBA")
        with Image.new("P", (80, 40), 0) as palette:
            palette.putpalette([255, 0, 0, 0, 0, 255] + [0] * (256 * 3 - 6))
            palette.paste(1, (40, 0, 80, 40))
            palette.save(self.input / "palette.png", transparency=0)
        importer.import_images(self.root, self.input)
        for record in self.read_records():
            for field in ("src", "thumbnail"):
                with Image.open(self.public / record[field]) as image:
                    self.assertEqual(image.mode, "RGBA")
                    self.assertEqual(image.getchannel("A").getextrema(),
                                     (128, 128) if record["title"] == "alpha" else (0, 255))

    def test_preexisting_destination_is_never_overwritten(self):
        source = self.image(self.input / "new.png")
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        destination = self.public / importer.ASSET_DIRECTORY / "previews" / (digest + ".webp")
        destination.parent.mkdir(parents=True)
        destination.write_bytes(b"existing unrelated file")
        before = self.snapshot()
        with self.assertRaisesRegex(importer.ImportError, "Refusing to overwrite"):
            importer.import_images(self.root, self.input)
        self.assertEqual(self.snapshot(), before)

    def test_manifest_replacement_failure_rolls_back_new_assets(self):
        self.image(self.input / "new.png")
        before = self.snapshot()
        with mock.patch.object(importer.os, "replace", side_effect=OSError("simulated write failure")):
            with self.assertRaisesRegex(OSError, "simulated write failure"):
                importer.import_images(self.root, self.input)
        self.assertEqual(self.snapshot(), before)

    def test_bad_metadata_does_not_change_gallery(self):
        self.image(self.input / "new.png")
        metadata_path = self.base / "metadata.json"
        for value in ([], {"missing.png": {}}, {"new.png": {"id": "custom"}},
                      {"new.png": {"title": " "}}, {"new.png": {"alt": 42}},
                      {"new.png": {"title": "x" * 121}}):
            with self.subTest(metadata=value):
                metadata_path.write_text(json.dumps(value), encoding="utf-8")
                before = self.snapshot()
                with self.assertRaises(importer.ImportError):
                    importer.import_images(self.root, self.input, metadata_path)
                self.assertEqual(self.snapshot(), before)

    def test_size_limits_empty_input_and_input_symlinks(self):
        with self.assertRaisesRegex(importer.ImportError, "No JPG"):
            importer.import_images(self.root, self.input)
        source = self.image(self.input / "new.png")
        with mock.patch.object(importer, "MAX_PIXELS", 1):
            with self.assertRaisesRegex(importer.ImportError, "pixels"):
                importer.import_images(self.root, self.input)
        with mock.patch.object(importer, "MAX_BYTES", 1):
            with self.assertRaisesRegex(importer.ImportError, "MiB"):
                importer.import_images(self.root, self.input)
        (self.input / "link.png").symlink_to(source)
        with self.assertRaisesRegex(importer.ImportError, "not a link"):
            importer.import_images(self.root, self.input)
        self.assertEqual(self.read_records(), [])


if __name__ == "__main__":
    unittest.main()
