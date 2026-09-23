"""Optional authoring tests: python tools/test_generate_assets.py (requires Pillow)."""

from pathlib import Path
import hashlib
import subprocess
import sys
import tempfile
import unittest

GENERATOR = Path(__file__).with_name("generate-assets.py")


def hashes(root):
    return {
        p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in root.rglob("*")
        if p.is_file()
    }


class EditingMastersTest(unittest.TestCase):
    def test_generation_protects_manual_edits_before_any_writes(self):
        with tempfile.TemporaryDirectory(prefix="molen-art-masters-") as directory:
            root = Path(directory)
            command = [sys.executable, str(GENERATOR), "--out-dir", str(root)]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(
                subprocess.run(command + ["--check"], capture_output=True).returncode, 0
            )
            # Test both a model and a data map; preserving only geometry is insufficient.
            for relative in ["models/ashlar-wall.glb", "textures/limestone-normal.png"]:
                path = root / relative
                original = path.read_bytes()
                path.write_bytes(original + b"manual edit")
                before = hashes(root)
                attempted = subprocess.run(command, capture_output=True, text=True)
                self.assertNotEqual(attempted.returncode, 0)
                self.assertIn("Preserving hand-edited", attempted.stderr)
                self.assertEqual(hashes(root), before)
                path.write_bytes(original)
            self.assertEqual(
                subprocess.run(command + ["--check"], capture_output=True).returncode, 0
            )


if __name__ == "__main__":
    unittest.main()
