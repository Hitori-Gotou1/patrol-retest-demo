#!/usr/bin/env python3
"""Prepare new repository gallery images without modifying existing entries."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tempfile
import warnings


MANIFEST = Path("src/data/gallery-upload.json")
ASSET_DIRECTORY = PurePosixPath("assets/gallery/imported")
FORMATS = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}
EXTENSIONS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
MAX_PIXELS = 40_000_000
MAX_BYTES = 50 * 1024 * 1024
PREVIEW_EDGE = 1600
THUMBNAIL_EDGE = 640
TEXT_LIMITS = {"title": 120, "alt": 300, "credit": 200}
RESERVED_IDS = {"quiet-guitar", "pink-frequency", "live-ticket"}


class ImportError(ValueError):
    """An actionable input or gallery validation error."""


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ImportError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(content, label):
    def reject_constant(value):
        raise ImportError(f"{label}: invalid JSON value {value}")

    try:
        return json.loads(content, object_pairs_hook=unique_object, parse_constant=reject_constant)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ImportError(f"{label}: invalid JSON ({error})") from error


def asset_path(public, value, label, must_exist=True):
    if not isinstance(value, str) or not value or any(char in value for char in "\\?#:"):
        raise ImportError(f"{label}: expected a local path relative to public/")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in ("", ".", "..") for part in value.split("/")):
        raise ImportError(f"{label}: unsafe asset path {value!r}")
    destination = public.joinpath(*path.parts)
    if not destination.resolve().is_relative_to(public.resolve()):
        raise ImportError(f"{label}: asset path escapes public/: {value}")
    if must_exist and not destination.is_file():
        raise ImportError(f"{label}: missing asset {value}")
    return destination


def read_manifest(root):
    path = root / MANIFEST
    if path.is_symlink():
        raise ImportError(f"Manifest must be a regular file: {path}")
    raw = path.read_bytes()
    records = read_json(raw, str(MANIFEST))
    if not isinstance(records, list):
        raise ImportError("Gallery manifest must contain a JSON array")
    ids = set(RESERVED_IDS)
    for index, item in enumerate(records):
        label = f"Gallery entry {index + 1}"
        if not isinstance(item, dict):
            raise ImportError(f"{label}: expected an object")
        identifier = item.get("id")
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", identifier):
            raise ImportError(f"{label}: invalid id")
        if identifier in ids:
            raise ImportError(f"{label}: duplicate or reserved id {identifier!r}")
        ids.add(identifier)
        if item.get("category") not in ("collection", "illustration", "poster"):
            raise ImportError(f"{label}: invalid category")
        for field in ("title", "subtitle", "tag", "alt", "credit"):
            value = item.get(field)
            if not isinstance(value, str) or (field == "title" and not value.strip()):
                raise ImportError(f"{label}: invalid {field}")
        for field in ("width", "height"):
            if type(item.get(field)) is not int or item[field] <= 0:
                raise ImportError(f"{label}: {field} must be a positive integer")
        for field in ("src", "thumbnail", "originalSrc"):
            asset_path(root / "public", item.get(field), f"{label} {field}")
    return raw, records


def candidates_in(directory):
    if not directory.is_dir():
        raise ImportError(f"Input directory does not exist: {directory}")
    candidates = sorted(
        (path for path in directory.rglob("*") if path.suffix.lower() in FORMATS),
        key=lambda path: path.relative_to(directory).as_posix(),
    )
    if not candidates:
        raise ImportError("No JPG, JPEG, PNG, or WebP files found in the input directory")
    for path in candidates:
        if path.is_symlink() or not path.is_file():
            raise ImportError(f"Input must be a regular image file, not a link: {path}")
    return candidates


def read_metadata(path, filenames):
    if path is None:
        return {}
    metadata = read_json(path.read_bytes(), str(path))
    if not isinstance(metadata, dict):
        raise ImportError("Metadata must be an object keyed by relative image filename")
    for filename, fields in metadata.items():
        if filename not in filenames:
            raise ImportError(f"Metadata refers to an unknown image: {filename}")
        if not isinstance(fields, dict) or set(fields) - TEXT_LIMITS.keys():
            raise ImportError(f"{filename}: metadata supports only title, alt, and credit")
        for field, value in fields.items():
            if not isinstance(value, str) or len(value.strip()) > TEXT_LIMITS[field]:
                raise ImportError(f"{filename}: {field} must be text of at most {TEXT_LIMITS[field]} characters")
            if field == "title" and not value.strip():
                raise ImportError(f"{filename}: title cannot be empty")
    return metadata


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def decode_image(raw, path):
    # Import lazily so --check only needs the Python standard library.
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as probe:
                image_format = probe.format
                if image_format != FORMATS[path.suffix.lower()]:
                    raise ImportError(f"{path.name}: image contents do not match the filename extension")
                if probe.width * probe.height > MAX_PIXELS:
                    raise ImportError(f"{path.name}: image exceeds {MAX_PIXELS:,} pixels")
                if getattr(probe, "n_frames", 1) != 1:
                    raise ImportError(f"{path.name}: animated images are not supported")
                probe.verify()
            with Image.open(io.BytesIO(raw)) as source:
                source.load()  # verify() alone does not decode every format.
                oriented = ImageOps.exif_transpose(source)
                alpha = "A" in oriented.getbands() or "transparency" in oriented.info
                image = oriented.convert("RGBA" if alpha else "RGB")
                # EXIF (including orientation and GPS) is deliberately not copied.
                image.info.clear()
                return image, image_format
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as error:
        raise ImportError(f"{path.name}: invalid image ({error})") from error


def save_webp(image, path, edge, quality):
    from PIL import Image

    resized = image.copy()
    try:
        resized.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        resized.save(path, format="WEBP", quality=quality, method=6)
    finally:
        resized.close()


def append_records(raw, existing, additions):
    # Keep every existing object's text, key order, and ID unchanged.
    content = raw.decode("utf-8")
    end = content.rfind("]")
    new_objects = [
        "\n".join("  " + line for line in json.dumps(item, ensure_ascii=False, indent=2).splitlines())
        for item in additions
    ]
    return (content[:end].rstrip() + (",\n" if existing else "\n")
            + ",\n".join(new_objects) + "\n]" + content[end + 1:]).encode("utf-8")


def publish(root, raw_manifest, records, additions, outputs, staged_manifest):
    manifest = root / MANIFEST
    if manifest.read_bytes() != raw_manifest:
        raise ImportError("Gallery manifest changed during import; retry with the updated manifest")
    staged_manifest.write_bytes(append_records(raw_manifest, records, additions))
    created = []
    try:
        for staged, destination in outputs:
            destination.parent.mkdir(parents=True, exist_ok=True)
            # Exclusive creation never overwrites even an untracked existing asset.
            with destination.open("xb") as target:
                created.append(destination)
                with staged.open("rb") as source:
                    shutil.copyfileobj(source, target)
        if manifest.read_bytes() != raw_manifest:
            raise ImportError("Gallery manifest changed during import; retry with the updated manifest")
        os.replace(staged_manifest, manifest)
    except BaseException:
        for path in reversed(created):
            path.unlink()
        raise


def import_images(root, directory, metadata_path=None):
    raw_manifest, records = read_manifest(root)
    candidates = candidates_in(directory)
    metadata = read_metadata(metadata_path, {path.relative_to(directory).as_posix() for path in candidates})
    existing_hashes = {
        sha256_file(asset_path(root / "public", item["originalSrc"], item["id"]))
        for item in records
    }
    existing_ids = {item["id"] for item in records} | RESERVED_IDS
    additions, outputs = [], []
    duplicates = 0
    # Staging stays on the manifest's filesystem for the final atomic replacement.
    with tempfile.TemporaryDirectory(prefix=".gallery-import-", dir=root) as temporary:
        staging = Path(temporary)
        for source in candidates:
            if source.stat().st_size > MAX_BYTES:
                raise ImportError(f"{source.name}: image exceeds {MAX_BYTES // (1024 * 1024)} MiB")
            raw = source.read_bytes()
            if len(raw) > MAX_BYTES:
                raise ImportError(f"{source.name}: image exceeds {MAX_BYTES // (1024 * 1024)} MiB")
            image, image_format = decode_image(raw, source)
            try:
                digest = hashlib.sha256(raw).hexdigest()
                if digest in existing_hashes:
                    duplicates += 1
                    continue
                identifier = f"collection-{digest}"
                if identifier in existing_ids:
                    raise ImportError(f"Generated id already exists with different image bytes: {identifier}")
                filename = source.relative_to(directory).as_posix()
                title = re.sub(r"[-_]+", " ", source.stem).strip()[:TEXT_LIMITS["title"]] or "站主收藏"
                fields = {key: value.strip() for key, value in metadata.get(filename, {}).items()}
                title = fields.get("title", title)
                original = str(ASSET_DIRECTORY / "originals" / (digest + EXTENSIONS[image_format]))
                preview = str(ASSET_DIRECTORY / "previews" / (digest + ".webp"))
                thumbnail = str(ASSET_DIRECTORY / "thumbs" / (digest + ".webp"))
                item = {
                    "id": identifier, "category": "collection", "src": preview,
                    "thumbnail": thumbnail, "originalSrc": original,
                    "width": image.width, "height": image.height, "title": title,
                    "subtitle": "站主收藏 · 新收录", "tag": "站主收藏",
                    "alt": fields.get("alt", title),
                    "credit": fields.get("credit", "站主提供 · 原作者信息待补充"),
                }
                for role, relative in (("original", original), ("preview", preview), ("thumbnail", thumbnail)):
                    destination = asset_path(root / "public", relative, identifier, must_exist=False)
                    if destination.exists() or destination.is_symlink():
                        raise ImportError(f"Refusing to overwrite existing asset: {destination}")
                    staged = staging / f"{digest}-{role}"
                    if role == "original":
                        staged.write_bytes(raw)
                    else:
                        save_webp(image, staged, PREVIEW_EDGE if role == "preview" else THUMBNAIL_EDGE,
                                  86 if role == "preview" else 82)
                    outputs.append((staged, destination))
                additions.append(item)
                existing_hashes.add(digest)
                existing_ids.add(identifier)
            finally:
                image.close()
        if additions:
            publish(root, raw_manifest, records, additions, outputs, staging / "manifest.json")
    return len(additions), duplicates


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_directory", nargs="?", type=Path, help="recursively import JPG, PNG, and WebP images")
    parser.add_argument("--check", action="store_true", help="validate the existing manifest and asset paths without writing")
    parser.add_argument("--metadata", type=Path, help="JSON map of relative filenames to title, alt, and credit")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1], help="repository root (defaults to this script's repository)")
    args = parser.parse_args(argv)
    if args.check and (args.input_directory or args.metadata):
        parser.error("--check cannot be combined with an input directory or --metadata")
    if not args.check and not args.input_directory:
        parser.error("provide an input directory or use --check")
    try:
        root = args.root.resolve()
        if args.check:
            _, records = read_manifest(root)
            print(f"Gallery check passed: {len(records)} entries; all asset paths exist.")
        else:
            added, skipped = import_images(root, args.input_directory.resolve(), args.metadata)
            print(f"Imported {added} image(s); skipped {skipped} byte-identical duplicate(s).")
        return 0
    except ModuleNotFoundError as error:
        if error.name != "PIL":
            raise
        print("Gallery import failed: install dependencies with python -m pip install -r tests/requirements-gallery.txt", file=sys.stderr)
        return 1
    except (ImportError, OSError, ValueError) as error:
        print(f"Gallery import failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
