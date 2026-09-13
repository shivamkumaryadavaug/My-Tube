MYTUBE — Capacitor Android Setup
================================

TARGET BRANCH
-------------
Work ONLY on:
    capacitor-android

NEVER modify:
    main

PURPOSE
-------
Package the existing MYTUBE website as an Android APK using Capacitor.
This is NOT a rebuild of MYTUBE. Preserve the existing frontend and backend behavior.

FILES IN THIS PACKAGE
---------------------
package.json
capacitor.config.ts
scripts/prepare-capacitor.mjs
.github/workflows/android-debug.yml

WHAT TO DO
----------
1. Inspect the existing repository first.
2. Keep the existing HTML/CSS/JS/backend intact unless an Android compatibility fix is actually required.
3. Add/merge these files into the capacitor-android branch.
4. Run npm install.
5. Generate the Android project with:
       npx cap add android
   if android/ does not already exist.
6. Run:
       npm run cap:sync
7. Verify the Android project uses:
       appId = com.mytube.study
       appName = MYTUBE
8. Run the GitHub Actions workflow:
       MYTUBE Android Debug APK
9. The workflow must produce:
       android/app/build/outputs/apk/debug/app-debug.apk
10. Upload the APK as a GitHub Actions artifact named:
       mytube-debug-apk

IMPORTANT MYTUBE REQUIREMENTS
----------------------------
- Existing website must remain the source of truth.
- Do not rebuild the UI from scratch.
- Do not replace the backend.
- Keep the existing Render API URL and authentication flow.
- Keep real YouTube IFrame playback.
- Test Study Mode, login/guest flow, Library, playlists and progress persistence.
- Test Android back navigation.
- Test YouTube playback/fullscreen behavior.
- Do not introduce HTTP/mixed-content requests.
- Do not commit generated secrets, tokens, or credentials.

GIT SAFETY
----------
Before making changes:
    git status
    git branch --show-current

The current branch must be:
    capacitor-android

Do not push or merge anything into main.

SUCCESS CONDITION
-----------------
A successful GitHub Actions run produces a downloadable debug APK artifact.
After the APK is verified, a PR to main may be considered separately.
