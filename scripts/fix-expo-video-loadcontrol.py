from pathlib import Path
import re

path = Path("node_modules/expo-video/android/src/main/java/expo/modules/video/player/DefaultLoadControl.java")
if not path.is_file():
    raise SystemExit(f"Expected Expo Video DefaultLoadControl source was not found: {path}")

source = path.read_text(encoding="utf-8")
if "getAllocator(androidx.media3.exoplayer.analytics.PlayerId" in source:
    print("PlayerId-aware getAllocator is already present in DefaultLoadControl.java.")
    raise SystemExit(0)

if not re.search(r"public class DefaultLoadControl\\s+implements LoadControl", source):
    raise SystemExit("DefaultLoadControl.java no longer directly implements Media3 LoadControl; refusing to patch an unexpected source.")

method = """
  // Media3 1.9 requires the PlayerId-aware overload. Keep the existing allocator behavior.
  @Override
  public androidx.media3.exoplayer.upstream.Allocator getAllocator(
      androidx.media3.exoplayer.analytics.PlayerId playerId
  ) {
    return getAllocator();
  }
"""

# Insert immediately before the class's final closing brace.
updated, count = re.subn(r"\\n}\\s*$", "\\n" + method + "}\\n", source, count=1)
if count != 1:
    raise SystemExit("Could not safely locate the final class brace; no changes made.")

path.write_text(updated, encoding="utf-8")
print("Patched Expo Video DefaultLoadControl.java with getAllocator(PlayerId).")
