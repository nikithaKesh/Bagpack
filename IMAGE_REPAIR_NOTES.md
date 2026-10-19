# Image repair
- File selection shows an immediate local blob preview.
- Encoding runs asynchronously, and Save awaits completion.
- Edit and create flows use the same image selection logic.
- Startup no longer writes to IndexedDB before hydration.
- Existing browser data is not reset.
- Old service workers are unregistered so updated scripts load on refresh.
- Images persist locally, not on other devices.
