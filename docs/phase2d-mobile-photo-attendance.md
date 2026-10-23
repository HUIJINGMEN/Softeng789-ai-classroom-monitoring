# Phase 2D — mobile classroom photo attendance

[한국어 가이드](phase2d-mobile-photo-attendance.ko.md)

Branch: `DoJun/phase2d-mobile-photo-attendance`, based on Phase 2C commit `6be4117`.

## Teacher workflow

1. On mobile, open **Capture → Attendance photo**, choose the class and date, then **Continue to camera**. **Feedback photo** preserves the existing student report capture flow. On desktop, open **Attendance → session detail → Photo attendance · teacher review**.
2. Choose one capture route:
   - **Open camera**: requests the rear camera first. Select Front / laptop camera if appropriate. The browser may fall back to an available camera; check the preview.
   - **Use phone camera**: the device's file capture control, with a rear-camera hint.
   - **Choose saved photo**: a separate JPEG/PNG picker without a capture hint.
3. For the in-page camera, confirm that everyone in frame consented, then press **Take photo**. This stops the camera and shows a local preview; it does not send a recognition request.
4. Choose **Retake photo**, **Close camera**, or **Use photo and recognize**. Retaking clears the previous photo and participation capture consent checkbox; recheck consent for the new frame. Uploading a file similarly shows its preview and requires consent before **Recognize faces**.
5. Recognition displays numbered face boxes and a numbered navigation row. Tap a box or number to see that face's enlarged crop and suggested students. The crop is drawn locally from the same prepared photo; it is not a new server upload.
6. Explicitly select a candidate or choose an eligible student from the identity dropdown. A student selected for another face is unavailable until that previous selection is cleared. Use **Mark this student late** when appropriate. Changing identity clears the previous identity's late flag.
7. Use **Next face** / **Next unreviewed** to continue. Progress shows selected, excluded and remaining faces. Unknown, uncertain and low-quality faces require human review. Choose **Exclude / cannot identify** if identity cannot be confirmed.
8. After every face has an explicit decision, confirm the teacher review checkbox and press **Confirm and save attendance**. Selecting candidates alone does not save attendance. Excluded or missing faces never mark students absent.
9. **Open manual attendance** returns focus to the compact attendance table, where Manual / Correct opens the existing correction dialog. Use it for people not enrolled for face recognition or whose identity cannot be established from the photo. If manual attendance changes during a pending photo review, the existing server conflict checks may require a fresh photo review.

Student self check-in still starts with the front camera and uses its existing **Capture and request attendance** flow. Registration capture and supervised face enrollment keep their existing flow.

The Capture picker excludes cancelled sessions and requires an explicit session selection. Closing discards unsaved local photos and releases the camera; a save already sent to the server may still complete. **Close camera → Open manual attendance** opens the selected session's attendance workspace. When photo attendance is disabled, the dialog offers manual attendance instead.

For laptop testing, use Chrome DevTools device mode at about 390px wide to reveal the teacher's bottom Capture button, then select **Front / laptop camera**. This uses the laptop webcam, not a simulated phone camera.

## Local and phone access

The existing local start/stop commands still apply. This phase changes frontend code only and adds no DB migration, backend endpoint, model or dependency. A running Vite frontend picks up changes; refresh the page.

```powershell
powershell -ExecutionPolicy Bypass -File .\data\local-dev\start.ps1
powershell -ExecutionPolicy Bypass -File .\data\local-dev\stop.ps1
```

These are machine-local ignored scripts. On this development machine, use `http://localhost:5173` from the laptop. A phone's `localhost` refers to the phone itself, and the existing loopback server configuration has not been exposed to the network. Real phone testing needs a reachable, trusted HTTPS origin with same-origin API routing and the application's authentication configuration verified. No public tunnel, deployment, firewall change or certificate installation is included in this phase.

In-page camera access requires a secure context (HTTPS, or a locally trusted context such as localhost). Merely opening the laptop's LAN IP over plain HTTP will not provide equivalent camera access. See [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). Native file capture UI and support depend on device/browser; `capture="environment"` is a hint, not a universal guarantee. See [MDN capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture).

JPEG/PNG input remains limited to 20 MB and 25 megapixels before preparation; HEIC is rejected with the existing guidance. Existing image preparation applies orientation, strips metadata and scales the longest side to at most 4096 pixels. In-page captures fit within 1920×1440 while preserving aspect ratio. Photograph smaller groups if distant faces are too small. The existing maximum of 30 detected faces is a service limit, not an accuracy claim for a 30-person classroom.

## Implementation and safeguards

- `MobileConsoleChrome.tsx`, `AttendanceCaptureDialog.tsx`, `TeacherApp.tsx`: reuse the bottom Capture entry for attendance or feedback, select a staff-scoped session before capture, and link back to that session's manual attendance.
- `RecognitionCamera.tsx`: rear-camera preference for teachers, local preview/retake and explicit submission; front camera and immediate self-check-in callback preserved for students.
- `PhotoFaceReview.tsx`: single-face review card, local crop, clickable boxes, keyboard-accessible numbered controls, progress, duplicate-selection prevention and explicit exclusions.
- `SessionPhotoPanel.tsx`: separate native capture/gallery controls, new review component, manual attendance navigation and stale async-result guards when leaving a session.
- `SessionDetail.tsx`: manual attendance focus/scroll target.
- `useCameraCapture.ts`: acquired tracks are released if camera playback fails. Existing cleanup on switching, closing, capture and unmount remains.
- `photoAttendance.css`: responsive review layout and touch-sized navigation controls.

The same recognition and confirmation endpoints, student consent, staff permissions, teacher confirmation, expiry, roster checks and idempotency keys are reused. Failed recognition can retry the same prepared photo with its existing key. Pending review choices stay in browser memory. Photos/crops are not added to localStorage or downloaded automatically. Object URLs are revoked on replacement/unmount; review expiry and successful save clear the prepared photo. Closing the camera discards its local capture. A request already sent to the server can still finish after navigation; stale UI results and subsequent callbacks are ignored.

## Validation

- Production build and 346 frontend tests passed. New camera tests cover switching and late permission responses, track cleanup after playback failure, retry recovery, portrait aspect ratio and unready capture rejection.
- Chrome 390×844: Capture chooser, explicit session selection, cancelled session exclusion, preview without upload, close/reopen cleanup, original feedback file callback, disabled-CV manual fallback and empty-session state passed with no JavaScript errors. These menu checks used the actual React components with synthetic session/API fixtures.
- Playwright Chrome, 1440×1000 and 390×1000: teacher rear-camera preference, direction change, consent gating, no upload before explicit submission, retake/close cleanup, 3-face review, local crop, duplicate block, Late and Exclude decisions, explicit final save and cleared preview.
- Synthetic API cases: recognition error/retry with the same idempotency key, zero faces, expiry, permission denial, navigation cleanup, 30-face navigation, manual-attendance callback and unchanged student capture behavior. No relevant JavaScript errors, blank screen, framework overlay or horizontal overflow.
- Actual local application at `http://localhost:5173`: authenticated session/detail reads, camera preview/capture/cancel and manual-attendance focus verified. This live smoke test did not upload a photo or change user attendance.
- Browser plugin was unavailable; the existing Playwright runtime was used. Screenshots and temporary browser scripts are outside the repository. No browser dependency was installed.

Physical Android/iPhone cameras, native file chooser behavior, Safari, EXIF variants from real phone photos and multi-person face recognition accuracy remain to be tested with consenting participants. Browser emulation and synthetic recognition responses do not validate biometric accuracy or physical rear-camera selection.
