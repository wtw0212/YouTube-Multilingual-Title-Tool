const fs = require("fs-extra")
const path = require("path")

async function buildExtension() {
  const buildDir = "dist"

  // Clean build directory
  await fs.remove(buildDir)
  await fs.ensureDir(buildDir)

  // Copy all necessary files
  const filesToCopy = ["manifest.json", "_locales", "icons", "popup", "src", "styles"]

  for (const file of filesToCopy) {
    const srcPath = path.join(__dirname, file)
    const destPath = path.join(buildDir, file)

    if (await fs.pathExists(srcPath)) {
      await fs.copy(srcPath, destPath)
      console.log(`✅ Copied ${file}`)
    } else {
      console.log(`⚠️  ${file} not found, skipping...`)
    }
  }

  // Copy individual files that might be in root
  const individualFiles = ["script.js", "style.css"]

  for (const file of individualFiles) {
    const srcPath = path.join(__dirname, file)
    const destPath = path.join(buildDir, file)

    if (await fs.pathExists(srcPath)) {
      await fs.copy(srcPath, destPath)
      console.log(`✅ Copied ${file}`)
    }
  }

  console.log("\n🎉 Extension built successfully in dist/ directory")
  console.log("\n📦 To install the extension:")
  console.log("1. Open Chrome and go to chrome://extensions/")
  console.log('2. Enable "Developer mode" in the top right')
  console.log('3. Click "Load unpacked" and select the dist/ folder')
}

buildExtension().catch(console.error)
