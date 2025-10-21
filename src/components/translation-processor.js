/**
 * Translation Processor - Handles the core translation processing logic
 */
class TranslationProcessor {
  constructor(uiManager) {
    this.uiManager = uiManager
    this.LanguageManager = window.LanguageManager // Declare LanguageManager variable
    // 速度配置 - 大幅減少等待時間
    this.speedConfig = {
      dialogClose: 100, // 從 200 減少到 100
      elementWait: 50, // 從 150 減少到 50
      inputDelay: 50, // 從 100-200 減少到 50
      actionDelay: 200, // 從 400-800 減少到 200
      publishWait: 800, // 從 1000-2000 減少到 800
      hoverWait: 100, // 從 300 減少到 100
      editorWait: 500, // 從 1000 減少到 500
      fastTimeout: 2000, // 從 3000 減少到 2000
      normalTimeout: 5000, // 從 8000 減少到 5000
    }
  }

  // Fast element finder with shorter timeout for known elements
  async fastWaitForElement({ selector, context = document, xpath = false, timeout = 2000 }) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const interval = setInterval(() => {
        let element
        if (xpath) {
          element = document.evaluate(
            selector,
            context,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
          ).singleNodeValue
        } else {
          element = context.querySelector(selector)
        }

        if (element) {
          clearInterval(interval)
          resolve(element)
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval)
          reject(new Error(`Element not found: ${selector}`))
        }
      }, 25) // 從 50ms 減少到 25ms，更頻繁檢查
    })
  }

  // Force close all dialogs
  forceCloseAllDialogs() {
    document.querySelectorAll("#metadata-editor, tp-yt-paper-dialog[opened]").forEach((dialog) => {
      const cancelBtn = dialog.querySelector(
        'ytcp-button[aria-label*="取消"], ytcp-button[aria-label*="Cancel"], button[aria-label*="取消"], button[aria-label*="Cancel"]',
      )
      if (cancelBtn) {
        cancelBtn.click()
        return
      }
      dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      dialog.removeAttribute("opened")
      dialog.style.display = "none"
    })
  }

  // Process a single language translation
  async processSingleLanguage(name, title, desc) {
    console.log(`🚀 Processing language: ${name}`)

    this.forceCloseAllDialogs()
    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.dialogClose))

    // Click "Add Language" button
    const addLanguageBtn = await this.uiManager.waitForElement({
      selector: "//ytcp-button[contains(., '新增語言') or contains(., 'Add language')]",
      xpath: true,
      timeout: this.speedConfig.normalTimeout,
    })
    addLanguageBtn.click()

    // Select language from dropdown
    const dialog = await this.fastWaitForElement({
      selector: "#dialog[role='dialog']",
      timeout: this.speedConfig.fastTimeout,
    })

    const languageOption = await this.fastWaitForElement({
      selector: `//tp-yt-paper-item[contains(.,'${name}')]`,
      context: dialog,
      xpath: true,
      timeout: this.speedConfig.fastTimeout,
    })
    languageOption.click()

    // Find the translation row
    const rowElement = await this.fastWaitForElement({
      selector: `//ytgn-video-translation-row[.//div[contains(@class,'language-text') and normalize-space(.)='${name}']]`,
      xpath: true,
      timeout: this.speedConfig.normalTimeout,
    })

    const metadataCell = await this.fastWaitForElement({
      selector: ".//td[contains(@class,'tablecell-metadata')]",
      context: rowElement,
      xpath: true,
      timeout: this.speedConfig.fastTimeout,
    })

    const hoverCell = await this.fastWaitForElement({
      selector: ".//ytgn-video-translation-hover-cell",
      context: metadataCell,
      xpath: true,
      timeout: this.speedConfig.fastTimeout,
    })

    // Trigger hover state - Reduce wait time
    rowElement.focus()
    hoverCell.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
    hoverCell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
    hoverCell.setAttribute("is-hovered", "")
    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.hoverWait))

    // Find and click the add button
    const addBtn = [...hoverCell.querySelectorAll("ytcp-icon-button,ytcp-button")].find((btn) =>
      ["新增", "Add"].includes(btn.getAttribute("aria-label")),
    )

    if (!addBtn) {
      throw new Error("Add button not found")
    }
    addBtn.click()

    // Wait for editor dialog - Reduce wait time
    const editorDialog = await this.fastWaitForElement({
      selector: "#metadata-editor[opened], tp-yt-paper-dialog[opened]",
      timeout: this.speedConfig.normalTimeout,
    })

    if (editorDialog.hasAttribute("aria-hidden")) {
      editorDialog.removeAttribute("aria-hidden")
    }

    // Hide other dialogs
    document.querySelectorAll("#metadata-editor, tp-yt-paper-dialog").forEach((d) => {
      if (d !== editorDialog) {
        d.style.display = "none"
        d.removeAttribute("opened")
      }
    })

    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.editorWait))

    // Fill in the title - Optimize input speed
    const titleElement = await this.fastWaitForElement({
      selector: "#translated-title textarea",
      context: editorDialog,
      timeout: this.speedConfig.fastTimeout,
    })

    titleElement.focus()
    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.inputDelay))
    titleElement.select()
    titleElement.value = title
    titleElement.dispatchEvent(new Event("input", { bubbles: true }))
    titleElement.dispatchEvent(new Event("change", { bubbles: true }))

    // Fill in the description if provided
    if (desc) {
      const descElement = editorDialog.querySelector("#translated-description textarea")
      if (descElement) {
        descElement.focus()
        await new Promise((resolve) => setTimeout(resolve, this.speedConfig.inputDelay))
        descElement.value = desc
        descElement.dispatchEvent(new Event("input", { bubbles: true }))
        descElement.dispatchEvent(new Event("change", { bubbles: true }))
      }
    }

    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.actionDelay))

    // Click publish button
    const publishBtn = await this.fastWaitForElement({
      selector: "#publish-button",
      context: editorDialog,
      timeout: this.speedConfig.normalTimeout,
    })
    publishBtn.click()

    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.publishWait))

    // Clean up hover state
    hoverCell.removeAttribute("is-hovered")

    console.log(`✅ Completed language: ${name}`)
  }

  // Process multiple languages from main modal
  async processMainModalLanguages() {
    console.log("🚀 Processing main modal languages...")
    await this.uiManager.saveLanguagesFromUI()

    const rows = Array.from(document.querySelectorAll("#qayt-langs-container .qayt-lang-row"))
    const tasks = []

    for (const row of rows) {
      const checkbox = row.querySelector(".qayt-checkbox")
      if (!row.classList.contains("disabled") && checkbox.checked) {
        tasks.push({
          name: row.dataset.name,
          title: row.querySelector(".qayt-title-input").value.trim(),
          desc: row.querySelector(".qayt-desc-textarea").value.trim(),
        })
      }
    }

    // Validate tasks
    for (const { name, title } of tasks) {
      if (!title) {
        alert(this.LanguageManager.formatMessage("fillTitleOrUncheck", name))
        return
      }
    }

    if (!tasks.length) {
      alert(this.LanguageManager.getMessage("noLanguageSelected"))
      return
    }

    // Confirm execution
    const langNames = tasks.map((task) => task.name).join("、")
    const confirmMessage = this.LanguageManager.formatMessage("confirmExecution", tasks.length, langNames)

    if (!confirm(confirmMessage)) return

    // Show progress and process
    this.uiManager.showMainProgress()

    const failedLanguages = []

    for (let i = 0; i < tasks.length; i++) {
      const { name, title, desc } = tasks[i]
      this.uiManager.updateMainProgress(i + 1, tasks.length, name)

      try {
        await this.processSingleLanguage(name, title, desc)
      } catch (error) {
        console.error(`❌ Failed to process "${name}":`, error)
        failedLanguages.push(name)
      }
    }

    this.uiManager.completeMainProgress()

    // Show failed languages if any
    if (failedLanguages.length > 0) {
      setTimeout(() => {
        const failedList = failedLanguages.join("、")
        const errorMessage = this.LanguageManager.formatMessage("languageProcessingFailed", failedList)
        alert(errorMessage)
      }, 1000)
    }
  }

  // Process bulk commands - Fix input validation issue
  async processBulkCommands() {
    console.log("⚡ Processing bulk commands...")
    // Re-get textarea element to ensure getting the latest value
    const textarea = document.getElementById("qayt-bulk-only-textarea")
    if (!textarea) {
      console.error("Textarea not found!")
      alert(this.LanguageManager.getMessage("inputBulkCommand"))
      return
    }

    const text = textarea.value.trim()
    console.log("Bulk command input:", text) // Debug log

    if (!text) {
      alert(this.LanguageManager.getMessage("inputBulkCommand"))
      return
    }

    let tasks
    try {
      tasks = this.uiManager.parseBulkCommands(text)
      console.log("Parsed tasks:", tasks) // Debug log
    } catch (error) {
      console.error("Parse error:", error) // Debug log
      alert(this.LanguageManager.formatMessage("bulkCommandParseError", error.message))
      return
    }

    if (!tasks.length) {
      alert(this.LanguageManager.getMessage("noValidBulkCommand"))
      return
    }

    // Confirm execution
    const langNames = tasks.map((task) => task.lang).join("、")
    const confirmMessage = this.LanguageManager.formatMessage("confirmExecution", tasks.length, langNames)

    if (!confirm(confirmMessage)) return

    // Show progress and process
    this.uiManager.showBulkProgress()

    const failedLanguages = []

    for (let i = 0; i < tasks.length; i++) {
      const { lang, title, desc } = tasks[i]
      this.uiManager.updateBulkProgress(i + 1, tasks.length, lang)

      try {
        await this.processSingleLanguage(lang, title, desc)
      } catch (error) {
        console.error(`❌ Failed to process "${lang}":`, error)
        failedLanguages.push(lang)
      }
    }

    this.uiManager.completeBulkProgress()

    // Show failed languages if any
    if (failedLanguages.length > 0) {
      setTimeout(() => {
        const failedList = failedLanguages.join("、")
        const errorMessage = this.LanguageManager.formatMessage("languageProcessingFailed", failedList)
        alert(errorMessage)
      }, 2500)
    }
  }

  // Process bulk edit commands
  async processBulkEdit() {
    try {
      console.log("🔧 Processing bulk edit...")
      const textarea = document.getElementById("qayt-edit-textarea")
      if (!textarea) {
        console.error("Edit textarea not found!")
        alert("找不到輸入框，請重新打開批量修改窗口。")
        return
      }

      const text = textarea.value.trim()
      if (!text) {
        alert("請輸入要修改的翻譯內容。")
        return
      }

      let tasks
      try {
        tasks = this.uiManager.parseBulkCommands(text)
      } catch (error) {
        alert(`批量修改指令解析錯誤：${error.message}\n\n正確格式：{{語言|新標題|新簡介},{語言|新標題|新簡介}}`)
        return
      }

      if (!tasks.length) {
        alert("未找到有效的修改指令。")
        return
      }

      // Check which languages have existing translations
      const existingTranslations = await this.uiManager.getExistingTranslations()
      const existingLangs = new Set(existingTranslations.map((t) => t.language))

      const validTasks = tasks.filter((task) => existingLangs.has(task.lang))
      const invalidTasks = tasks.filter((task) => !existingLangs.has(task.lang))

      if (invalidTasks.length > 0) {
        const invalidLangs = invalidTasks.map((t) => t.lang).join("、")
        if (!confirm(`以下語言沒有現有翻譯，將被跳過：${invalidLangs}\n\n是否繼續修改其他語言？`)) {
          return
        }
      }

      if (validTasks.length === 0) {
        alert("沒有找到可以修改的語言翻譯。請確保語言名稱與 YouTube 的翻譯列表完全匹配。")
        return
      }

      const langNames = validTasks.map((task) => task.lang).join("、")
      const confirmMessage = `即將修改 ${validTasks.length} 個語言的翻譯：${langNames}\n\n確定要執行嗎？`

      if (!confirm(confirmMessage)) return

      // Show progress and process
      this.uiManager.showEditProgress()

      const failedLanguages = []
      let successCount = 0

      for (let i = 0; i < validTasks.length; i++) {
        const { lang, title, desc } = validTasks[i]
        this.uiManager.updateEditProgress(i + 1, validTasks.length, lang)

        try {
          console.log(`✏️ 批量修改第${i + 1}/${validTasks.length}：${lang}`)
          await this.editSingleTranslation(lang, title, desc)
          successCount++
          console.log(`✅ 修改完成「${lang}」`)
        } catch (error) {
          console.error(`❌ 修改「${lang}」失敗：`, error)
          failedLanguages.push(lang)
        }
      }

      this.uiManager.completeEditProgress(successCount, validTasks.length)

      // Show failed languages if any
      if (failedLanguages.length > 0) {
        setTimeout(() => {
          const failedList = failedLanguages.join("、")
          alert(`以下語言修改失敗：${failedList}\n\n請檢查語言名稱是否與 YouTube 的翻譯列表完全匹配。`)
        }, 3500)
      }
    } catch (error) {
      console.error("Error in processBulkEdit:", error)
      alert("批量修改過程中發生錯誤，請檢查控制台日誌並重試。")
    }
  }

  // Edit single translation (modify existing translation)
  async editSingleTranslation(name, title, desc) {
    this.forceCloseAllDialogs()
    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.dialogClose))

    // Find the corresponding translation row
    const rowElement = await this.fastWaitForElement({
      selector: `//ytgn-video-translation-row[.//div[contains(@class,'language-text') and normalize-space(.)='${name}']]`,
      xpath: true,
      timeout: this.speedConfig.normalTimeout,
    })

    const metadataCell = await this.fastWaitForElement({
      selector: ".//td[contains(@class,'tablecell-metadata')]",
      context: rowElement,
      xpath: true,
      timeout: this.speedConfig.fastTimeout,
    })

    const hoverCell = await this.fastWaitForElement({
      selector: ".//ytgn-video-translation-hover-cell",
      context: metadataCell,
      xpath: true,
      timeout: this.speedConfig.fastTimeout,
    })

    // Trigger hover state - Reduce wait time
    rowElement.focus()
    hoverCell.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
    hoverCell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
    hoverCell.setAttribute("is-hovered", "")
    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.hoverWait))

    // Find edit button (not add button)
    const editBtn = [...hoverCell.querySelectorAll("ytcp-icon-button,ytcp-button")].find((btn) => {
      const ariaLabel = btn.getAttribute("aria-label")
      return ariaLabel && (ariaLabel.includes("編輯") || ariaLabel.includes("Edit"))
    })

    if (!editBtn) {
      // If no edit button found, try clicking on translation content area
      const titleElement = rowElement.querySelector(".title-text, .description-text")
      if (titleElement) {
        titleElement.click()
      } else {
        throw new Error("找不到編輯按鈕或翻譯內容")
      }
    } else {
      editBtn.click()
    }

    const editorDialog = await this.fastWaitForElement({
      selector: "#metadata-editor[opened], tp-yt-paper-dialog[opened]",
      timeout: this.speedConfig.normalTimeout,
    })

    if (editorDialog.hasAttribute("aria-hidden")) {
      editorDialog.removeAttribute("aria-hidden")
    }

    // Hide other dialogs
    document.querySelectorAll("#metadata-editor, tp-yt-paper-dialog").forEach((d) => {
      if (d !== editorDialog) {
        d.style.display = "none"
        d.removeAttribute("opened")
      }
    })

    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.editorWait))

    // Fill in the title - Optimize speed
    const titleElement = await this.fastWaitForElement({
      selector: "#translated-title textarea",
      context: editorDialog,
      timeout: this.speedConfig.fastTimeout,
    })

    titleElement.focus()
    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.inputDelay))
    titleElement.select()
    titleElement.value = title
    titleElement.dispatchEvent(new Event("input", { bubbles: true }))
    titleElement.dispatchEvent(new Event("change", { bubbles: true }))

    // Fill in the description if provided
    if (desc) {
      const descElement = editorDialog.querySelector("#translated-description textarea")
      if (descElement) {
        descElement.focus()
        await new Promise((resolve) => setTimeout(resolve, this.speedConfig.inputDelay))
        descElement.value = desc
        descElement.dispatchEvent(new Event("input", { bubbles: true }))
        descElement.dispatchEvent(new Event("change", { bubbles: true }))
      }
    }

    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.actionDelay))

    // Click publish button
    const publishBtn = await this.fastWaitForElement({
      selector: "#publish-button",
      context: editorDialog,
      timeout: this.speedConfig.normalTimeout,
    })
    publishBtn.click()

    await new Promise((resolve) => setTimeout(resolve, this.speedConfig.publishWait))

    // Clean up hover state
    hoverCell.removeAttribute("is-hovered")
  }
}

// Make it available globally
window.TranslationProcessor = TranslationProcessor
