# Changes in the copied Review 2 project

Base commit: `2aaeb150721e232ac5b4ead708475da21fbb45e9` (includes `111abd8`).

## Existing files changed

- `.gitignore`
- `README.md`
- `package-lock.json`
- `package.json`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/map/GroupGPSMiniMap.tsx`
- `src/components/map/LeafletMap.tsx`
- `src/context/SimulationContext.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/EmergencyPage.tsx`
- `src/pages/GroupAwarenessPage.tsx`
- `src/pages/GroupLobbyPage.tsx`
- `src/pages/LinkStatusPage.tsx`
- `src/pages/TrailMapPage.tsx`
- `src/services/communicationService.ts`
- `src/types/index.ts`

## New modules

- `src/hardware/`: BLE transport, framed protocol, command correlation, central hardware hook, existing-state projection and measured link assessment.
- `src/components/hardware/`: embedded device controls and live link panel.
- `src/__tests__/hardware*.test.*`: protocol and existing-app integration tests.
- `firmware/`: Heltec V3 bridge source and pinned PlatformIO environment.
- `android/` and `capacitor.config.ts`: optional native shell, no compiled APK.
- `START_HERE.md` and `docs/`: staged setup, protocol, master context, checks and preservation hashes.

All existing server/model/utility files and the nested legacy source are unchanged relative to this base. No original files were removed from the Review 2 copy. See `PRESERVED_FILES.json` for 88 compared source/assets.
