/**
 * Popup Script - Clean and minimal popup interface
 */
class PopupManager {
  constructor() {
    this.storageKey = "qayt_extension_enabled"
    this.chrome = window.chrome
    this.init()
  }

  async init() {
    await this.loadSettings()
    this.setupEventListeners()
    this.localizeInterface()
  }

  // Localization
  localizeInterface() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n")
      const message = this.chrome.i18n.getMessage(key)
      if (message) {
        element.textContent = message
      }
    })
  }

  // Load extension settings
  async loadSettings() {
    try {
      const result = await this.chrome.storage.local.get(this.storageKey)
      const isEnabled = result[this.storageKey] !== false // Default to true
      document.getElementById("extensionToggle").checked = isEnabled

      // Set initial text and color based on state
      const controlTitle = document.querySelector(".control-title")
      if (controlTitle) {
        if (isEnabled) {
          controlTitle.textContent = this.chrome.i18n.getMessage("extensionEnabled") || "Extension Enabled"
          controlTitle.style.color = "#065fd4" // Blue when enabled
        } else {
          controlTitle.textContent = this.chrome.i18n.getMessage("extensionDisabled") || "Extension Disabled"
          controlTitle.style.color = "#f44336" // Red when disabled
        }
      }

      // Update control item visual state
      this.updateControlItemState(isEnabled)
    } catch (error) {
      console.error("Failed to load settings:", error)
    }
  }

  // Save extension settings
  async saveSettings(enabled) {
    try {
      await this.chrome.storage.local.set({ [this.storageKey]: enabled })

      // Update the control title text based on state
      const controlTitle = document.querySelector(".control-title")
      if (controlTitle) {
        if (enabled) {
          controlTitle.textContent = this.chrome.i18n.getMessage("extensionEnabled") || "Extension Enabled"
          controlTitle.style.color = "#065fd4" // Blue when enabled
        } else {
          controlTitle.textContent = this.chrome.i18n.getMessage("extensionDisabled") || "Extension Disabled"
          controlTitle.style.color = "#f44336" // Red when disabled
        }
      }

      const message = enabled
        ? this.chrome.i18n.getMessage("extensionEnabled") || "Extension enabled"
        : this.chrome.i18n.getMessage("extensionDisabled") || "Extension disabled"
      this.showToast(message, enabled ? "success" : "warning")
    } catch (error) {
      console.error("Failed to save settings:", error)
      this.showToast("Failed to save settings", "error")
    }
  }

  // Event listeners
  setupEventListeners() {
    // Extension toggle
    document.getElementById("extensionToggle").addEventListener("change", (e) => {
      this.saveSettings(e.target.checked)
      this.updateControlItemState(e.target.checked)
    })

    // YouTube Studio button
    document.getElementById("openYouTubeStudioBtn").addEventListener("click", () => {
      this.openYouTubeStudio()
    })

    // Buy Me a Coffee button
    document.getElementById("buyMeCoffeeBtn").addEventListener("click", () => {
      this.openBuyMeCoffee()
    })

    // Contact/Feedback button
    document.getElementById("contactBtn").addEventListener("click", () => {
      this.openContactEmail()
    })

    // Email click to copy
    const emailInfo = document.querySelector(".email-info")
    if (emailInfo) {
      emailInfo.addEventListener("click", () => {
        this.copyToClipboard("wtw0212.hk@gmail.com")
        this.showToast("Email copied to clipboard!", "success")
      })
    }
  }

  // Update control item visual state
  updateControlItemState(enabled) {
    const controlItem = document.getElementById("extensionControl")
    if (controlItem) {
      if (enabled) {
        controlItem.classList.remove("disabled")
        controlItem.classList.add("enabled")
      } else {
        controlItem.classList.remove("enabled")
        controlItem.classList.add("disabled")
      }
    }
  }

  // Open YouTube Studio
  openYouTubeStudio() {
    const studioUrl = "https://studio.youtube.com"
    this.chrome.tabs.create({ url: studioUrl })
    this.showToast(this.chrome.i18n.getMessage("openingYouTubeStudio") || "Opening YouTube Studio...", "info")
    setTimeout(() => window.close(), 500)
  }

  // Open Buy Me a Coffee
  openBuyMeCoffee() {
    const coffeeUrl = "https://buymeacoffee.com/wtw0212"
    this.chrome.tabs.create({ url: coffeeUrl })
    this.showToast(this.chrome.i18n.getMessage("thankYouSupport") || "Thank you for your support! ☕", "success")
    setTimeout(() => window.close(), 500)
  }

  // Open contact email
  openContactEmail() {
    const emailSubject = encodeURIComponent("YouTube Multilingual Tool - Feedback")
    const emailBody = encodeURIComponent(`Hi there,

I'm writing to provide feedback about the YouTube Multilingual Tool extension.

Extension Version: v1.0
Browser: ${navigator.userAgent}

My feedback/question:
[Please write your feedback here]

Best regards,`)

    const mailtoUrl = `mailto:wtw0212.hk@gmail.com?subject=${emailSubject}&body=${emailBody}`

    // Try to open email client
    try {
      this.chrome.tabs.create({ url: mailtoUrl })
      this.showToast(this.chrome.i18n.getMessage("openingEmailClient") || "Opening email client...", "info")
    } catch (error) {
      // Fallback: copy email to clipboard
      this.copyToClipboard("wtw0212.hk@gmail.com")
      this.showToast(
        this.chrome.i18n.getMessage("emailCopied") || "Email copied to clipboard: wtw0212.hk@gmail.com",
        "success",
      )
    }

    setTimeout(() => window.close(), 1000)
  }

  // Copy text to clipboard
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
    }
  }

  // Toast notifications
  showToast(message, type = "success") {
    const toast = document.getElementById("toast")
    const toastContent = document.getElementById("toastContent")

    toastContent.textContent = message
    toast.className = `toast ${type}`
    toast.classList.add("show")

    // Adjust position to ensure it's fully visible within popup
    toast.style.right = "8px"
    toast.style.top = "8px"

    setTimeout(() => {
      toast.classList.remove("show")
    }, 2000)
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PopupManager()
})
