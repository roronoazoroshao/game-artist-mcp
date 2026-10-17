import importlib.util
import unittest
from pathlib import Path
from PIL import Image

SOURCE = Path(__file__).resolve().parents[1] / 'scripts' / 'r9b-editor-interop-verify.py'
spec = importlib.util.spec_from_file_location('r9b_editor_verifier', SOURCE)
verify_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify_module)


class FidelityUnitTests(unittest.TestCase):
    def test_pixel_delta_exact_and_one_lsb_quantization(self):
        a = Image.new('RGBA', (2, 1))
        a.putdata([(10, 20, 30, 255), (50, 60, 70, 12)])
        exact = a.copy()
        self.assertEqual(verify_module.pixel_delta_metrics(a, exact),
                         {'changedPixels': 0, 'maxChannelDelta': 0, 'sumChannelDelta': 0})
        b = a.copy()
        b.putdata([(10, 20, 31, 255), (49, 60, 70, 12)])
        self.assertEqual(verify_module.pixel_delta_metrics(a, b),
                         {'changedPixels': 2, 'maxChannelDelta': 1, 'sumChannelDelta': 2})

    def test_reject_mismatched_dimensions(self):
        a = Image.new('RGBA', (2, 2))
        b = Image.new('RGBA', (2, 3))
        with self.assertRaises(ValueError):
            verify_module.pixel_delta_metrics(a, b)


if __name__ == '__main__':
    unittest.main()
