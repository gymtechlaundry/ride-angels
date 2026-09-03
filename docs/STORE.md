# Store & device testing — pointers

Procedures are **not** duplicated in this repo. Use the studio playbooks plus this app’s identity and smoke list.

Studio root: `~/Projects/hyperion-studio`

| Task | Open |
| --- | --- |
| iOS device / simulator / TestFlight testing | `Playbooks/testing/ios.md` |
| Android device / emulator / Play testing | `Playbooks/testing/android.md` |
| iOS archive → App Store | `Playbooks/store/ios.md` |
| Android AAB → Play production | `Playbooks/store/android.md` |
| Versioning, listing pack, accounts | `Playbooks/store/README.md` |
| This app’s IDs and version table | [IDENTITY.md](./IDENTITY.md) |
| This app’s smoke list | [SMOKE.md](./SMOKE.md) |
| This app’s listing copy | [LISTING.md](./LISTING.md) |
| This app’s full submission packet | [STORE-SUBMISSION.md](./STORE-SUBMISSION.md) |
| Pre-upload checks | `npm run store:preflight` |
| Legal (repo mirrors) | [legal/](./legal/) → live `https://hyperionappstudio.com/rideangels/` |

```bash
# iOS store binary
npm run release:ios

# Android Play AAB
npm run android:bundle
```
