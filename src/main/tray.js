const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

function createTray(petWindow, openSettings, app) {
  // Create a simple 16x16 tray icon programmatically
  const icon = nativeImage.createFromBuffer(createTrayIconBuffer());

  const tray = new Tray(icon);
  tray.setToolTip('Tamugatchi - Your Dev Pet');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Pet',
      click: () => {
        if (petWindow && !petWindow.isDestroyed()) {
          petWindow.show();
        }
      }
    },
    {
      label: 'Settings',
      click: () => openSettings()
    },
    { type: 'separator' },
    {
      label: 'Pause',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        if (petWindow && !petWindow.isDestroyed()) {
          petWindow.webContents.send('pet-state-change',
            menuItem.checked ? 'sleeping' : 'idle'
          );
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.isVisible() ? petWindow.hide() : petWindow.show();
    }
  });

  return tray;
}

function createTrayIconBuffer() {
  // Create a simple 16x16 PNG tray icon (pink circle with face)
  // This is a minimal valid PNG
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - 7.5, dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 7) {
        // Pink circle
        canvas[idx] = 255;     // R
        canvas[idx + 1] = 150; // G
        canvas[idx + 2] = 200; // B
        canvas[idx + 3] = 255; // A

        // Eyes (two dots)
        if ((Math.abs(x - 5) < 1 && Math.abs(y - 6) < 1) ||
            (Math.abs(x - 10) < 1 && Math.abs(y - 6) < 1)) {
          canvas[idx] = 60;
          canvas[idx + 1] = 60;
          canvas[idx + 2] = 60;
        }

        // Smile
        if (y === 9 && x >= 6 && x <= 9) {
          canvas[idx] = 60;
          canvas[idx + 1] = 60;
          canvas[idx + 2] = 60;
        }
      } else {
        canvas[idx + 3] = 0; // Transparent
      }
    }
  }

  return nativeImage.createFromBuffer(
    createPngFromRgba(canvas, size, size)
  ).toPNG();
}

function createPngFromRgba(rgba, width, height) {
  // Minimal PNG encoder for tray icon
  // For simplicity, return the RGBA buffer — Electron's nativeImage handles it
  return nativeImage.createFromBuffer(rgba, {
    width, height, scaleFactor: 1.0
  }).toPNG();
}

module.exports = { createTray };
