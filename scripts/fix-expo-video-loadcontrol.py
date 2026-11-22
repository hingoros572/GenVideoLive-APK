from pathlib import Path

path = Path("node_modules/expo-video/android/src/main/java/expo/modules/video/player/DefaultLoadControl.java")
if not path.is_file():
    raise SystemExit(f"Expected Expo Video DefaultLoadControl source was not found: {path}")

source = path.read_text(encoding="utf-8")

# Match the exact declaration observed in the diagnostic build log.
if "public class DefaultLoadControl implements LoadControl" not in source:
    raise SystemExit("DefaultLoadControl declaration differs from the inspected source; refusing to patch.")

signature = "  public Allocator getAllocator() {"
if "getAllocator(androidx.media3.exoplayer.analytics.PlayerId" in source:
    print("PlayerId-aware getAllocator is already present in DefaultLoadControl.java.")
    raise SystemExit(0)

if source.count(signature) != 1:
    raise SystemExit("Expected exactly one existing getAllocator() method; refusing to patch.")

method = """  // Media3 1.9 requires the PlayerId-aware allocator overload.
  @Override
  public androidx.media3.exoplayer.upstream.Allocator getAllocator(
      androidx.media3.exoplayer.analytics.PlayerId playerId
  ) {
    return getAllocator();
  }

"""
updated = source.replace(signature, method + signature, 1)
path.write_text(updated, encoding="utf-8")
print("Patched DefaultLoadControl.java with getAllocator(PlayerId).")
