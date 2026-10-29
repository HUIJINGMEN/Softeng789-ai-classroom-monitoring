import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("model_install", Path(__file__).parents[1] / "scripts/install_cv_models.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class ModelInstallPathTest(unittest.TestCase):
    def test_inside_paths_are_allowed(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            self.assertEqual(installer.confined_path(base, "nested/model.onnx"), base.resolve() / "nested/model.onnx")
            self.assertEqual(installer.confined_path(base, base.resolve()), base.resolve())

    def test_parent_absolute_and_prefix_sibling_escapes_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder) / "models"
            for value in ("../outside", base.parent / "outside", str(base) + "-outside"):
                with self.subTest(value=value), self.assertRaises(ValueError):
                    installer.confined_path(base, value)

    def test_symlink_escape_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder) / "models"
            base.mkdir()
            outside = Path(folder) / "outside"
            outside.mkdir()
            try:
                (base / "link").symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest("Symlinks require OS privileges")
            with self.assertRaises(ValueError):
                installer.confined_path(base, "link/model.onnx")

    def test_cli_rejects_escape_before_writing_or_downloading(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder) / "models"
            outside = Path(folder) / "outside"
            with patch.object(installer, "MODEL_ROOT", base), patch("sys.argv", ["install", "--output", str(outside)]), patch.object(installer, "urlopen") as download:
                with self.assertRaises(ValueError):
                    installer.main()
                download.assert_not_called()
            self.assertFalse(outside.exists())
