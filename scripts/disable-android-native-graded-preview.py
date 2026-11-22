from pathlib import Path
import re

root = Path("node_modules/@dahab-tech/react-native-media-editor")
if not root.is_dir():
    raise SystemExit("Media editor package folder was not found after npm install.")

# npm publishes compiled JavaScript under build/, not the TypeScript src/ folder.
candidates = list((root / "build").rglob("*.js"))
matches = []

for path in candidates:
    source = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"((?:const|let|var)\s+nativeRatePreviewActive\s*=\s*)(rateSynced\s*&&)"
    )
    updated, count = pattern.subn(
        r"\1Platform.OS !== 'android' && \2",
        source,
        count=1,
    )
    if count:
        matches.append((path, updated))

if len(matches) != 1:
    raise SystemExit(
        f"Expected exactly one compiled nativeRatePreviewActive expression, found {len(matches)}. "
        "No package files were changed."
    )

path, updated = matches[0]
path.write_text(updated, encoding="utf-8")
print(f"Patched {path}: Android now uses the existing Skia preview; iOS is unchanged.")
