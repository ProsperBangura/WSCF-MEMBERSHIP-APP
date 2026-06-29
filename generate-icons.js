// Generate PWA icons from existing logo
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const SOURCE = path.join(__dirname, 'assets', 'logo.png.jpeg');
const OUTPUT_DIR = path.join(__dirname, 'assets', 'icons');

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Source image:', SOURCE);
  console.log('Source exists:', fs.existsSync(SOURCE));
  console.log('Output dir:', OUTPUT_DIR);

  try {
    const image = await Jimp.read(SOURCE);
    console.log('Image loaded successfully, size:', image.bitmap.width, 'x', image.bitmap.height);
    
    for (const size of SIZES) {
      const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
      const cloned = image.clone();
      cloned.resize({ w: size, h: size });
      await cloned.write(outputPath);
      console.log(`Generated ${size}x${size} icon`);
    }
    
    console.log('All PWA icons generated successfully!');
  } catch (err) {
    console.error('Error generating from logo:', err.message);
    console.log('Generating fallback colored square icons...');
    for (const size of SIZES) {
      try {
        const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
        const img = new Jimp({ width: size, height: size, color: 0x3b82f6ff });
        await img.write(outputPath);
        console.log(`Generated fallback ${size}x${size} icon`);
      } catch (e) {
        console.error(`Failed to create fallback icon ${size}x${size}:`, e.message);
      }
    }
    console.log('Fallback icons generated successfully!');
  }
}

generateIcons();