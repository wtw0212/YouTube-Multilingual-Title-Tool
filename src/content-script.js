/**
 * Main Content Script - Entry point and initialization
 */
;(() => {
  // Declare variables before using them
  const LanguageManager = window.LanguageManager
  const UIManager = window.UIManager
  const TranslationProcessor = window.TranslationProcessor
  const chrome = window.chrome // Declare the chrome variable

  console.log(`🚀 YouTube Multilingual Extension v1.0 - ${LanguageManager.getCurrentLocale()}`)

  let uiManager
  let translationProcessor
  let lastUrl = location.href

  // Check if extension is enabled
  async function isExtensionEnabled() {
    try {
      const result = await chrome.storage.local.get("qayt_extension_enabled")
      return result["qayt_extension_enabled"] !== false // Default to true
    } catch (error) {
      console.error("Failed to check extension status:", error)
      return true // Default to enabled if check fails
    }
  }

  // Clean up any existing buttons from other scripts
  function cleanupExistingButtons() {
    // Remove any existing buttons with similar IDs
    const existingButtons = document.querySelectorAll(
      '#quick-add-title-btn, #bulk-command-btn, #bulk-edit-btn, [id*="batch"], [id*="bulk"], [class*="qayt"]',
    )
    existingButtons.forEach((btn) => {
      if (btn.textContent.includes("語言") || btn.textContent.includes("批量") || btn.textContent.includes("修改")) {
        console.log("🧹 Removing existing button:", btn.textContent)
        btn.remove()
      }
    })
  }

  // Initialize the extension
  async function initializeExtension() {
    try {
      // Check if extension is enabled
      const enabled = await isExtensionEnabled()
      if (!enabled) {
        console.log("🔒 Extension is disabled, skipping initialization")
        return
      }

      // Clean up any existing buttons first
      cleanupExistingButtons()

      // Wait for the "Add Language" button to appear
      const anchor = await new UIManager().waitForElement({
        selector: "//ytcp-button[contains(., '新增語言') or contains(., 'Add language')]",
        xpath: true,
        timeout: 8000,
      })

      // Double check - prevent duplicate initialization
      if (document.getElementById("quick-add-title-btn")) {
        console.log("🔄 Buttons already exist, skipping...")
        return
      }

      // Initialize managers
      uiManager = new UIManager()
      translationProcessor = new TranslationProcessor(uiManager)

      // Create action buttons with unique styling
      const { quickToolBtn, bulkCommandBtn, editBtn } = uiManager.createActionButtons()

      // Add distinctive styling to prevent conflicts
      quickToolBtn.style.cssText = `
        background: linear-gradient(135deg, #1976d2, #0d47a1) !important;
        color: white !important;
        border: 2px solid #1976d2 !important;
        margin-left: 8px !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        z-index: 9999 !important;
        position: relative !important;
      `

      bulkCommandBtn.style.cssText = `
        background: linear-gradient(135deg, #ff6b35, #e55a2b) !important;
        color: white !important;
        border: 2px solid #ff6b35 !important;
        margin-left: 8px !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        z-index: 9999 !important;
        position: relative !important;
      `

      editBtn.style.cssText = `
        background: linear-gradient(135deg, #28a745, #218838) !important;
        color: white !important;
        border: 2px solid #28a745 !important;
        margin-left: 8px !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        z-index: 9999 !important;
        position: relative !important;
      `

      // Set up event listeners
      quickToolBtn.addEventListener("click", async () => {
        const confirmBtn = await uiManager.openMainModal()
        confirmBtn.addEventListener("click", () => {
          translationProcessor.processMainModalLanguages()
        })
      })

      bulkCommandBtn.addEventListener("click", () => {
        const executeBtn = uiManager.openBulkModal()
        executeBtn.addEventListener("click", () => {
          translationProcessor.processBulkCommands()
        })
      })

      editBtn.addEventListener("click", async () => {
        try {
          const executeBtn = await uiManager.openBulkEditModal()
          if (executeBtn && typeof executeBtn.addEventListener === "function") {
            executeBtn.addEventListener("click", () => {
              translationProcessor.processBulkEdit()
            })
          } else {
            console.error("Execute button not properly returned from openBulkEditModal")
          }
        } catch (error) {
          console.error("Error opening bulk edit modal:", error)
        }
      })

      // Insert buttons into the page with spacing
      const buttonContainer = document.createElement("div")
      buttonContainer.style.cssText = `
        display: inline-flex !important;
        gap: 8px !important;
        margin-left: 16px !important;
        align-items: center !important;
      `

      buttonContainer.appendChild(quickToolBtn)
      buttonContainer.appendChild(bulkCommandBtn)
      buttonContainer.appendChild(editBtn)

      anchor.parentNode.insertBefore(buttonContainer, anchor.nextSibling)

      console.log("✅ Extension initialized successfully with 3 buttons:", {
        quickTool: quickToolBtn.textContent,
        bulkCommand: bulkCommandBtn.textContent,
        bulkEdit: editBtn.textContent,
      })
    } catch (error) {
      console.error("❌ Extension initialization failed:", error)
    }
  }

  // Handle URL changes (SPA navigation)
  function handleUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      if (lastUrl.includes("/translations")) {
        setTimeout(initializeExtension, 800)
      }
    }
  }

  // Set up observers and initial load
  const observer = new MutationObserver(handleUrlChange)
  observer.observe(document.body, { childList: true, subtree: true })

  // Initialize if already on translations page
  if (location.href.includes("/translations")) {
    setTimeout(initializeExtension, 800)
  }

  // Listen for extension enable/disable changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.qayt_extension_enabled) {
      const isEnabled = changes.qayt_extension_enabled.newValue
      if (isEnabled && location.href.includes("/translations")) {
        // Re-initialize if enabled
        setTimeout(initializeExtension, 800)
      } else if (!isEnabled) {
        // Remove buttons if disabled
        cleanupExistingButtons()
      }
    }
  })

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    observer.disconnect()
  })
})()
