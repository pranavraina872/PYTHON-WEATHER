import shutil
from pathlib import Path

root = Path(__file__).resolve().parent
source = root / "static"
target = root / "public" / "static"

if target.exists():
    shutil.rmtree(target)
shutil.copytree(source, target)
