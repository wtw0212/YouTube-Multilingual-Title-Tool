const fs = require("fs-extra")
const { execSync } = require("child_process")
const path = require("path")

async function packageExtension() {
  console.log("🚀 Starting extension packaging process...\n")

  try {
    // Step 1: Build the extension
    console.log("📦 Step 1: Building extension...")
    execSync("node build.js", { stdio: "inherit" })

    // Step 2: Create ZIP package
    console.log("\n📦 Step 2: Creating ZIP package...")
    execSync("node zip.js", { stdio: "inherit" })

    // Step 3: Create installation guide
    await createInstallationGuide()

    console.log("\n✅ Packaging complete!")
  } catch (error) {
    console.error("❌ Packaging failed:", error.message)
  }
}

async function createInstallationGuide() {
  const guide = `# YouTube Multilingual Tool - Installation Guide

## 📦 Package Contents
- youtube-multilingual-tool-v1.0.zip - Extension package
- dist/ - Unpacked extension files

## 🔧 Installation Methods

### Method 1: Load Unpacked (Recommended for Development)
1. Open Chrome browser
2. Navigate to \`chrome://extensions/\`
3. Enable "Developer mode" toggle in the top right
4. Click "Load unpacked" button
5. Select the \`dist/\` folder
6. The extension will be installed and ready to use

### Method 2: Install from ZIP
1. Extract \`youtube-multilingual-tool-v1.0.zip\` to a folder
2. Follow Method 1 steps with the extracted folder

### Method 3: Chrome Web Store (For Distribution)
1. Go to Chrome Web Store Developer Dashboard
2. Upload the ZIP file
3. Fill in store listing details
4. Submit for review

## 🎯 Usage
1. Go to YouTube Studio
2. Navigate to any video's translation page
3. Look for the "🚀 Language Quick Tool" and "⚡ Bulk Command" buttons
4. Use the popup (click extension icon) to toggle features

## 🐛 Troubleshooting
- If buttons don't appear, refresh the YouTube Studio page
- Check that the extension is enabled in chrome://extensions/
- Ensure you're on a video translation page in YouTube Studio

## 📧 Support
For issues or feedback, contact: wtw0212.hk@gmail.com

## 📄 Version
v1.0.0 - Last Updated: 25/01/2025
`

  await fs.writeFile("INSTALLATION.md", guide)
  console.log("📋 Created INSTALLATION.md guide")
}

packageExtension()
