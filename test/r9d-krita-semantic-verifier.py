import importlib.util
import unittest
from pathlib import Path
from PIL import Image

path=Path(__file__).resolve().parents[1]/'scripts'/'r9d-krita-semantic-verify.py'
spec=importlib.util.spec_from_file_location('r9d_semantic',path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestSemanticR9d(unittest.TestCase):
    def setUp(self):
        self.base=Image.new('RGBA',(5,5),(0,0,0,0))
        for y in range(1,4):
            for x in range(1,4): self.base.putpixel((x,y),(55,125,210,255))
    def test_transparent_border_crop_and_offset_is_semantically_exact(self):
        cropped=self.base.crop((1,1,4,4))
        metrics=mod.layer_semantic_delta(self.base,12,18,cropped,13,19,(40,45))
        self.assertEqual(metrics,{'changedVisiblePixels':0,'maxChannelDelta':0})
    def test_recolored_visible_layer_pixel_is_a_hard_failure(self):
        bad=self.base.crop((1,1,4,4))
        bad.putpixel((1,1),(58,125,210,255))
        self.assertGreater(mod.layer_semantic_delta(self.base,12,18,bad,13,19,(40,45))['changedVisiblePixels'],0)
    def test_wrong_world_offset_is_not_treated_as_transparent_trim(self):
        cropped=self.base.crop((1,1,4,4))
        self.assertGreater(mod.layer_semantic_delta(self.base,12,18,cropped,15,19,(40,45))['changedVisiblePixels'],0)
    def test_alpha_change_not_allowed(self):
        cropped=self.base.crop((1,1,4,4))
        cropped.putpixel((1,1),(55,125,210,254))
        self.assertGreater(mod.layer_semantic_delta(self.base,12,18,cropped,13,19,(40,45))['changedVisiblePixels'],0)

if __name__=='__main__':unittest.main()
