/**
 * Language Manager - Handles internationalization
 */
class LanguageManager {
  static getMessage(key, substitutions = []) {
    const message = window.chrome.i18n.getMessage(key, substitutions)

    // Fallback to English if message is not found
    if (!message && key) {
      console.warn(`Missing translation for key: ${key}`)
      return key
    }

    return message
  }

  static formatMessage(key, ...args) {
    const message = this.getMessage(key)
    return message.replace(/\{(\d+)\}/g, (match, index) => {
      return args[Number.parseInt(index)] || match
    })
  }

  static getCurrentLocale() {
    return window.chrome.i18n.getUILanguage()
  }

  static isChineseLocale() {
    const locale = this.getCurrentLocale().toLowerCase()
    return locale.startsWith("zh")
  }

  static getCommonLanguageNames() {
    return [
      this.getMessage("english"),
      this.getMessage("chineseSimplified"),
      this.getMessage("chineseTraditional"),
      this.getMessage("japanese"),
      this.getMessage("korean"),
      this.getMessage("french"),
      this.getMessage("german"),
      this.getMessage("spanish"),
      this.getMessage("portuguese"),
      this.getMessage("russian"),
      this.getMessage("italian"),
      this.getMessage("hindi"),
      this.getMessage("arabic"),
      this.getMessage("bengali"),
    ]
  }
}

// Make it available globally
window.LanguageManager = LanguageManager
