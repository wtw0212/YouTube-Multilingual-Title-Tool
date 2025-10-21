/**
 * Storage Manager - Handles Chrome storage operations
 */
class StorageManager {
  static STORAGE_KEY = "qayt_saved_languages"

  static getDefaultLanguages() {
    const chrome = window.chrome // Declare the chrome variable
    return [
      chrome.i18n.getMessage("chineseSimplified"),
      chrome.i18n.getMessage("spanish"),
      chrome.i18n.getMessage("english"),
      chrome.i18n.getMessage("hindi"),
      chrome.i18n.getMessage("arabic"),
      chrome.i18n.getMessage("bengali"),
      chrome.i18n.getMessage("portuguese"),
      chrome.i18n.getMessage("russian"),
      chrome.i18n.getMessage("japanese"),
      chrome.i18n.getMessage("korean"),
    ]
  }

  static async saveLanguages(languages) {
    try {
      await window.chrome.storage.local.set({ [this.STORAGE_KEY]: languages })
      console.log("Languages saved successfully:", languages)
    } catch (error) {
      console.error("Failed to save languages:", error)
      throw error
    }
  }

  static async loadLanguages() {
    try {
      const result = await window.chrome.storage.local.get(this.STORAGE_KEY)
      return result[this.STORAGE_KEY] || this.getDefaultLanguages()
    } catch (error) {
      console.error("Failed to load languages:", error)
      return this.getDefaultLanguages()
    }
  }

  static async resetToDefault() {
    const defaultLanguages = this.getDefaultLanguages()
    await this.saveLanguages(defaultLanguages)
    return defaultLanguages
  }
}

// Make it available globally
window.StorageManager = StorageManager
