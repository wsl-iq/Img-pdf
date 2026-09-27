### *Transformation From Image To pdf & docx*

Transform any image (`.png`, `.jpg`, `.jpeg`, `.webp`) into a PDF or DOCX document.

A fast, offline-capable, native-feel web application built with pure HTML5, CSS3, and vanilla JavaScript. No frameworks. No libraries. No tracking. No server.

---
### **Download**
[![Windows](https://custom-icon-badges.demolab.com/badge/Windows-0078D6?logo=windows11&logoColor=white)](https://github.com/wsl-iq/Img-pdf/releases/download/1.0.0/Image-pdf-V1.0.0.exe)
[![Android](https://img.shields.io/badge/Android-3DDC84?logo=android&logoColor=white)](https://github.com/wsl-iq/Img-pdf/releases/download/1.0.0/From.Images.To.pdf.docx.apk)
---

## Features

### Image Handling

* Upload multiple images at once
* Supported formats: JPG, JPEG, PNG, WEBP
* Drag and drop on desktop
* Native file picker on mobile and tablet
* Live preview grid before export
* Reorder images with drag or arrow buttons
* Remove individual images
* Clear all images with confirmation
* Duplicate image detection
* Automatic page orientation suggestion based on image layout

### PDF Export

* Pure JavaScript PDF generator with no external libraries
* Page sizes: A4, Letter, Auto
* Orientation: Portrait, Landscape, Auto
* Margin options: None, Small, Medium
* Quality control: Medium, High, Maximum
* Smart compression: Small File, Balanced, Maximum Quality
* Optional page numbering
* Automatic image scaling without distortion
* Landscape and portrait images handled correctly per page

### DOCX Export

* Word-compatible export
* One image per page
* Full-resolution image embedding

### Image Editor

* Rotate 90° or 180°
* Free rotation
* Brightness adjustment
* Contrast adjustment
* White background removal
* Non-destructive editing

### Interface

* Full Arabic interface with right-to-left support
* Dark, Light, and Auto themes
* Multiple Arabic fonts:

  * Cairo
  * Tajawal
  * Noto Kufi Arabic
  * System
* Responsive layout for mobile, tablet, and desktop
* Bottom navigation bar on all devices
* Native-feel touch interactions
* Smooth animations and transitions
* Toast notifications
* Confirmation modals

### Data and Persistence

* Session persistence with IndexedDB
* Images are restored automatically after reopening the app
* Settings saved in LocalStorage
* Activity records with total PDFs and images processed
* Weekly statistics chart
* Export and import settings as JSON
* Full storage wipe option

### Progressive Web App

* Installable on mobile and desktop
* Offline support through Service Worker
* Standalone display mode
* Application badge support
* Share Target ready

### Accessibility and Performance

* Keyboard shortcuts:

  * `Ctrl + O`
  * `Ctrl + S`
  * `Ctrl + Z`
  * `Ctrl + Shift + Z`
  * `Escape`
* Haptic feedback on supported devices
* Reduced motion support
* Native scroll and touch behavior
* Optimized for low-end devices

---

## How It Works

### 1. Image Selection

Images are loaded through the file input or drag-and-drop area.

Each image is validated for format and size, then converted to an object URL and stored in memory. The preview grid displays every selected image along with its name, size, and dimensions.

### 2. Image Processing

Before export, each image passes through a Canvas processing pipeline:

* The image is drawn onto a canvas
* Rotation transforms are applied
* Brightness and contrast filters are applied
* White background removal is applied if enabled
* The result is encoded as JPEG using the selected quality

This provides a consistent output format and helps keep the final file size predictable.

### 3. PDF Generation

The application builds a PDF file byte by byte following the PDF 1.4 specification.

The generation process includes:

1. Creating the PDF catalog and pages tree
2. Embedding each image as a JPEG stream using the `DCTDecode` filter
3. Creating a content stream for each page
4. Positioning and scaling images without distortion
5. Generating the cross-reference table
6. Appending the PDF trailer
7. Wrapping the final byte array in a `Blob`
8. Triggering the download

No third-party PDF library is used. The entire generator is implemented in vanilla JavaScript.

### 4. DOCX Generation

Images are converted to Base64 data URLs and wrapped in an HTML document with a Microsoft Word-compatible header.

The resulting file uses the `.doc` extension and can be opened by:

* Microsoft Word
* Google Docs
* LibreOffice

### 5. Persistence

The current session is saved to IndexedDB whenever images change.

Settings and activity records are stored in LocalStorage.

On the next launch, previously stored images are restored automatically and saved settings are reapplied.

### 6. Theme and Font

The application theme is controlled using a `data-theme` attribute on the root element.

The selected font family is controlled using a `data-font` attribute.

Both settings are persisted in LocalStorage and applied before the first paint to minimize visual flickering.

### 7. Responsive Layout

Device detection uses `matchMedia()` to determine three responsive breakpoints:

| Device  |            Width |
| ------- | ---------------: |
| Mobile  |      Up to 767px |
| Tablet  |   768px – 1199px |
| Desktop | 1200px and above |

Each breakpoint loads its corresponding CSS file and adjusts grid columns, spacing, navigation, and layout behavior.

The bottom navigation bar remains fixed across all devices with slight differences in button orientation and spacing.

### 8. Offline Support

A Service Worker caches application assets during the first visit.

Fonts are cached separately using a cache-first strategy.

After the initial load, the application can operate completely offline without requiring network access.

---

### Module Responsibilities

| Module            | Responsibility                                   |
| ----------------- | ------------------------------------------------ |
| `core.js`         | Global namespace and error handling              |
| `utils.js`        | Formatting, ID generation, and image loading     |
| `storage.js`      | LocalStorage settings and activity records       |
| `idb.js`          | IndexedDB session persistence                    |
| `theme.js`        | Dark, Light, and Auto theme switching            |
| `fonts.js`        | Dynamic Arabic font loading                      |
| `sizeScreen.js`   | Device detection and responsive breakpoints      |
| `haptics.js`      | Vibration and haptic feedback                    |
| `history.js`      | Undo and redo stack                              |
| `shortcuts.js`    | Keyboard shortcut manager                        |
| `badge.js`        | Application icon badge                           |
| `images.js`       | In-memory image collection                       |
| `pdf.js`          | PDF generation engine                            |
| `docx.js`         | Word document export                             |
| `editor.js`       | Image rotation, brightness, and contrast editing |
| `suggest.js`      | Page orientation suggestions                     |
| `stats.js`        | Weekly activity statistics and chart             |
| `exportImport.js` | Settings backup and restoration                  |
| `ui.js`           | DOM cache, toasts, modals, and view switching    |
| `app.js`          | Main application controller                      |

---

## Usage

### Running Locally

Open `index.html` directly in a modern browser.

No build step is required.

For complete PWA and Service Worker support, serve the project through any static HTTP server.

For example, using Python:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### Basic Workflow

1. Open the application.
2. Click the upload area or drag images onto it.
3. Reorder images if needed using reorder mode.
4. Open the image editor to rotate or adjust an image.
5. Configure PDF settings from the settings page.
6. Press **إنشاء PDF** to generate and download the PDF.
7. Press **Word** to export the images as a Word-compatible document.

---

## Keyboard Shortcuts

| Shortcut           | Action              |
| ------------------ | ------------------- |
| `Ctrl + O`         | Open image picker   |
| `Ctrl + S`         | Generate PDF        |
| `Ctrl + Z`         | Undo                |
| `Ctrl + Shift + Z` | Redo                |
| `Escape`           | Return to main view |

---

## Browser Support

* Chrome 90+
* Firefox 88+
* Safari 14+
* Microsoft Edge 90+

The application requires:

* IndexedDB
* Canvas API
* Blob API
* CSS Custom Properties

---

## Privacy

All processing happens entirely inside the browser.

No image, setting, activity record, or personal data is uploaded to a server.

The application does not use tracking or analytics services.

After the initial application load, it can operate completely offline.

---

## Developer

**Mohammed Al-Baqer**

Imam Ja'far Al-Sadiq University (PBUH)
College of Education — Department of English

---

## License

Copyright © 2026, lnc. Mohammed Al-Baqer. All rights reserved.
