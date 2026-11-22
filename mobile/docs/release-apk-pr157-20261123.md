# 2026-11-23 Android Release APK smoke build

This document triggers a disposable PR build of the exact **main** application code after PR #157.

- Source revision: `c76f0590679d70d4483b1b394f52e366a52d78d7`
- Changes under test: previously saved member habit reminders, permission-resume reconciliation, approved V2 launcher artwork, Android reflection back navigation
- Android workflow: `.github/workflows/android-poc.yml`
- Resulting artifact: `byeolharu-android-release-apk-test-signed`
- Signing: **temporary, disposable development test certificate**; not the Google Play signing key
- Validation: Android tests, packaged WebView startup smoke, release APK compile, zipalign, apksigner verify, package name check
- Caution: test builds signed with different ephemeral certificates cannot necessarily overwrite a previous install. Back up local data before uninstalling.
- This PR is an artifact-generation trigger; do **not** merge this document to main.
