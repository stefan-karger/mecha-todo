# MECHA//TODO adaptive app icon

This directory contains the vector source layers and Android resource templates for the future Kotlin/Compose app. Jetpack Compose does not change launcher-icon packaging. Android still reads these files from the app module's `res` directory.

## Files

| File | Purpose |
| --- | --- |
| `appicon-background.svg` | Opaque color background layer. |
| `appicon-foreground.svg` | Transparent color foreground layer. |
| `appicon-monochrome.svg` | Single-color alpha layer for themed icons. |
| `android/drawable/ic_launcher_*.xml` | Android-ready vector drawables matching the SVG layers. |
| `android/mipmap-anydpi-v26/ic_launcher.xml` | Adaptive icon definition for Android 8 through 12L. |
| `android/mipmap-anydpi-v33/ic_launcher.xml` | Android 13+ definition with the monochrome layer. |
| `verify-assets.ps1` | Checks dimensions, transforms, path geometry, and resource references. |

The three SVG files are the editable design sources. The Android XML files mirror their geometry and colors. Run the verification script after editing either format.

## Design contract

- Every layer is `108 × 108 dp`. The SVG files use a `512 × 512` view box for direct reuse of the original helmet paths.
- The helmet uses a centered `0.6` scale. Its filled geometry is about `59 × 56 dp`, and the complete mark fits inside the guaranteed `66 dp` safe circle.
- The outer `18 dp` on each side belongs to the launcher mask and motion effects. No important foreground detail enters that area.
- The background is opaque and full bleed. It does not contain a rounded-square or circle mask.
- The foreground has transparent negative space and no baked outline shadow. Launcher masks and motion therefore remain clean.
- The monochrome layer is white on transparency. Android uses its alpha and applies the user's theme colors.

The foreground starts with `../mecha_todo_helmet.svg`. The optimized mark omits small bolt cutouts because they render below one pixel at common launcher sizes. Wider checklist strokes and round caps keep both rows readable. Separate purple values give the armor depth without the glow and raster artifacts in `../appicon_idea.png`. A dark diagonal gradient carries the reference image's purple and green edge lighting without baking a launcher mask into the background.

## Palette

| Role | Value |
| --- | --- |
| Primary armor | `#B86CFF` |
| Armor variants | `#C77DFF`, `#A735FF`, `#9129DC`, `#8E2DE2` |
| Checklist and status accents | `#45FF63` |
| Background gradient | `#231133` to `#0B0911` to `#0C2118` |

## Android integration

1. Copy the contents of `android/` into the future app module's `src/main/res/` directory, preserving the folder names.
2. Set `android:icon="@mipmap/ic_launcher"` on the `<application>` element.
3. Open `ic_launcher.xml` in Android Studio and inspect every mask preview and the themed-icon modes.
4. If the app supports Android 7.1 or earlier, use Android Studio's Image Asset Studio to generate the density-specific legacy mipmaps from these sources. Use the same tool to make the separate 512-pixel Google Play listing image when release packaging starts.

The API 26 file omits `<monochrome>`. The API 33 override adds it where themed icons are supported, while older Android versions receive only elements they understand.

Run the local consistency check from this directory:

```powershell
pwsh -File ./verify-assets.ps1
```

## References

- [Android adaptive icon design and implementation](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)
- [Android Studio app icon generation](https://developer.android.com/studio/write/create-app-icons)
- [Android vector drawables](https://developer.android.com/develop/ui/views/graphics/vector-drawable-resources)
- [Google Design: Designing Adaptive Icons](https://medium.com/google-design/designing-adaptive-icons-515af294c783)

The current Android guidance specifies vector-preferred foreground and background layers, an optional monochrome layer for user theming, a `108 × 108 dp` canvas, a `66 dp` safe zone, and a `48` to `66 dp` logo size.
