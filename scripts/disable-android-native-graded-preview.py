from pathlib import Path

path = Path("node_modules/@dahab-tech/react-native-media-editor/src/video/VideoEditor.tsx")
source = path.read_text()

old = """  const nativeRatePreviewActive =
    rateSynced &&
    colorPreviewMounted &&
    !nativePreviewFailed &&
    (state.overlayId == null || previewWashUri != null);"""

new = """  // Android workaround: use the existing Skia preview pipeline instead of the
  // package's separate Media3 ExoPlayer (GradedPreviewView), which can crash
  // with AbstractMethodError on LoadControl.getAllocator(PlayerId).
  // iOS keeps its native rate-controlled preview unchanged.
  const nativeRatePreviewActive =
    Platform.OS !== 'android' &&
    rateSynced &&
    colorPreviewMounted &&
    !nativePreviewFailed &&
    (state.overlayId == null || previewWashUri != null);"""

if source.count(old) != 1:
    raise SystemExit(
        "Expected exactly one nativeRatePreviewActive block in the installed media-editor package; "
        "refusing to patch an unknown version."
    )

path.write_text(source.replace(old, new, 1))
print("Patched Android VideoEditor to use the existing Skia preview instead of native Media3 ExoPlayer.")
