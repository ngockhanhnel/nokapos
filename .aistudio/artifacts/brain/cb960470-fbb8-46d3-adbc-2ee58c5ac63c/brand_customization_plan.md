# Brand Customization Implementation Plan

## 1. Data Structure Update
- Extend `Shop` type to include `brandConfig`:
  ```ts
  interface BrandConfig {
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    fontFamily: string;
  }
  ```

## 2. SettingsView UI Refactor
- Add a new "Brand Customization" tab in `SettingsView`.
- Implement color pickers, logo upload/URL input, and font selection dropdown.
- Update `handleSaveSettings` to persist `brandConfig` to the shop document.

## 3. Dynamic Theme Application
- Create a `ThemeContext` or `ThemeProvider` that reads `brandConfig` from Firestore.
- Update CSS variables in the root or a dedicated `<style>` tag dynamically on load and save.
- Use `useStyleSheet` or similar to inject theme overrides.

## 4. Execution Steps
1. Update `types` definition.
2. Add UI controls to `SettingsView.tsx`.
3. Implement theme application logic in a top-level provider.
4. Verify dynamic application across the app (Navbar, Sidebar, etc.).
