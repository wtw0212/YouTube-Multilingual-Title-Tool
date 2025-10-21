/**
 * UI Manager - Handles all UI creation and management
 */
class UIManager {
  constructor() {
    this.backdrop = null
    this.modal = null
    this.bulkBackdrop = null
    this.bulkModal = null
    this.editBackdrop = null
    this.editModal = null
    this.LanguageManager = window.LanguageManager // Declare LanguageManager
    this.StorageManager = window.StorageManager // Declare StorageManager
    this.elementCache = new Map() // 添加元素緩存
  }

  // Utility methods
  createElement(tag, props = {}, children = []) {
    const element = document.createElement(tag)
    Object.assign(element, props)
    children.forEach((child) => {
      if (typeof child === "string") {
        element.appendChild(document.createTextNode(child))
      } else {
        element.appendChild(child)
      }
    })
    return element
  }

  removeAllChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  }

  async waitForElement({ selector, context = document, xpath = false, timeout = 5000 }) {
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

  // Clear element cache when page changes
  clearElementCache() {
    this.elementCache.clear()
  }

  // Create main action buttons
  createActionButtons() {
    const quickToolBtn = this.createElement("button", {
      id: "quick-add-title-btn",
      textContent: this.LanguageManager.getMessage("languageQuickTool"),
      className: "qayt-btn-primary",
    })

    const bulkCommandBtn = this.createElement("button", {
      id: "bulk-command-btn",
      textContent: this.LanguageManager.getMessage("bulkCommand"),
      className: "qayt-btn-bulk",
    })

    const editBtn = this.createElement("button", {
      id: "bulk-edit-btn",
      textContent: "✏️ 批量修改",
      className: "qayt-btn-edit",
    })

    return { quickToolBtn, bulkCommandBtn, editBtn }
  }

  // Create warning box component
  createWarningBox() {
    return this.createElement("div", {
      className: "qayt-warning-box",
      innerHTML: `
        <div class="qayt-warning-icon">⚠️</div>
        <div class="qayt-warning-content">
          <strong>${this.LanguageManager.getMessage("importantReminder")}</strong>
          ${this.LanguageManager.getMessage("languageNameWarning")}
          <br><span class="qayt-warning-example">${this.LanguageManager.getMessage("languageNameExample")}</span>
        </div>
      `,
    })
  }

  // Create language reference guide
  createLanguageGuide() {
    const commonLanguages = this.LanguageManager.getCommonLanguageNames()
    const languageTags = commonLanguages.map((lang) => `<span class="qayt-lang-tag">${lang}</span>`).join("")

    return this.createElement("div", {
      className: "qayt-bulk-description",
      innerHTML: `
        <div class="qayt-lang-reminder">
          <strong>${this.LanguageManager.getMessage("commonLanguageNames")}</strong>
          ${languageTags}
        </div>
      `,
    })
  }

  // Create language row for main modal
  createLanguageRow(name, isCustom = false) {
    const row = this.createElement("div", { className: "qayt-lang-row" })
    const header = this.createElement("div", { className: "qayt-lang-header" })
    const details = this.createElement("div", { className: "qayt-lang-details" })

    const safeName = name.replace(/[^a-zA-Z0-9]/g, "")
    const checkbox = this.createElement("input", {
      type: "checkbox",
      className: "qayt-checkbox",
      checked: true,
      id: `qayt-cb-${safeName}`,
    })

    const expandBtn = this.createElement("button", {
      className: "qayt-expand-btn",
      textContent: "▶",
    })

    const toggleDetails = (e) => {
      e.stopPropagation()
      const isExpanded = row.classList.toggle("expanded")
      // Fixed arrow rotation - now properly points down when expanded
      expandBtn.style.transform = isExpanded ? "rotate(90deg)" : "rotate(0deg)"
      expandBtn.textContent = "▶" // Keep consistent arrow character
    }

    expandBtn.addEventListener("click", toggleDetails)

    const label = this.createElement("label", {
      className: "qayt-lang-name",
      textContent: name,
    })
    label.addEventListener("click", toggleDetails)

    const titleInput = this.createElement("input", {
      className: "qayt-title-input",
      placeholder: this.LanguageManager.getMessage("titleRequired"),
      id: `qayt-title-${safeName}`,
    })

    const descTextarea = this.createElement("textarea", {
      className: "qayt-desc-textarea",
      placeholder: this.LanguageManager.getMessage("descriptionOptional"),
      rows: 3,
      id: `qayt-desc-${safeName}`,
    })

    details.append(titleInput, descTextarea)

    const deleteBtn = this.createElement("button", {
      className: "qayt-delete-lang",
      textContent: "×",
    })

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      row.remove()
      this.saveLanguagesFromUI()
    })

    if (isCustom) {
      row.classList.add("editing")
      const wrapper = this.createElement("div", { className: "qayt-input-wrapper" })
      const input = this.createElement("input", {
        className: "qayt-custom-input",
        placeholder: `${this.LanguageManager.getMessage("languageName")} - ${this.LanguageManager.getMessage("languageNameWarning")}`,
        value: name,
        id: `qayt-custom-input-${Date.now()}`,
      })

      const confirmBtn = this.createElement("button", {
        className: "qayt-confirm-lang",
        textContent: "✓",
      })

      confirmBtn.addEventListener("click", () => {
        const value = input.value.trim()
        if (!value) {
          row.remove()
          this.saveLanguagesFromUI()
          return
        }
        row.dataset.name = value
        label.textContent = value
        row.classList.remove("editing")
        this.saveLanguagesFromUI()
      })

      wrapper.append(input, confirmBtn)
      header.append(checkbox, expandBtn, wrapper, deleteBtn)
    } else {
      row.dataset.name = name
      header.append(checkbox, expandBtn, label, deleteBtn)
    }

    row.append(header, details)
    return row
  }

  // Save languages from UI
  async saveLanguagesFromUI() {
    const rows = [...document.querySelectorAll("#qayt-langs-container .qayt-lang-row:not(.editing)")]
    const names = rows.map((row) => row.dataset.name).filter(Boolean)
    await this.StorageManager.saveLanguages(names)
  }

  // Create main modal
  createMainModal() {
    if (this.backdrop) return

    this.backdrop = this.createElement("div", { id: "qayt-modal-backdrop" })
    this.modal = this.createElement("div", { id: "qayt-modal-content" })

    const title = this.createElement("h2", {
      textContent: this.LanguageManager.getMessage("languageQuickTool"),
    })

    const warningBox = this.createWarningBox()
    const languageGuide = this.createLanguageGuide()

    const subtitle = this.createElement("h3", {
      textContent: this.LanguageManager.getMessage("selectLanguages"),
    })

    // Global controls
    const controls = this.createElement("div", { id: "qayt-global-controls" })
    const masterCheckbox = this.createElement("input", {
      type: "checkbox",
      id: "qayt-master-checkbox",
    })
    const masterLabel = this.createElement("label", {
      htmlFor: "qayt-master-checkbox",
      textContent: this.LanguageManager.getMessage("selectAllToggle"),
    })

    masterCheckbox.addEventListener("change", (e) => {
      this.modal
        .querySelectorAll("#qayt-langs-container .qayt-checkbox:not(:disabled)")
        .forEach((cb) => (cb.checked = e.target.checked))
    })

    const resetBtn = this.createElement("button", {
      id: "qayt-reset-btn",
      textContent: this.LanguageManager.getMessage("resetDefault"),
    })

    resetBtn.addEventListener("click", async () => {
      if (confirm(this.LanguageManager.getMessage("resetConfirm"))) {
        await this.StorageManager.resetToDefault()
        await this.populateLanguageList()
      }
    })

    controls.append(masterCheckbox, masterLabel, resetBtn)

    // Language container and add button
    const languageContainer = this.createElement("div", { id: "qayt-langs-container" })

    // Create add custom button with proper ⊕ symbol sizing
    const addCustomBtn = this.createElement("button", {
      id: "qayt-add-custom-btn",
      className: "qayt-add-custom-btn",
    })

    // Add the ⊕ symbol and text with proper styling
    const plusSymbol = this.createElement("span", {
      textContent: "⊕",
      style: "font-size: 15px; line-height: 1; margin-right: 8px;",
    })

    const buttonText = this.createElement("span", {
      textContent: this.LanguageManager.getMessage("addCustomLanguage").replace("⊕ ", ""),
      style: "font-size: 15px; line-height: 1;",
    })

    addCustomBtn.append(plusSymbol, buttonText)

    addCustomBtn.addEventListener("click", () => {
      languageContainer.append(this.createLanguageRow("", true))
      this.saveLanguagesFromUI()
    })

    // Progress elements
    const progressLabel = this.createElement("div", {
      className: "qayt-progress-label",
      textContent: this.LanguageManager.getMessage("preparing"),
    })
    progressLabel.style.display = "none"

    const progressBarOuter = this.createElement("div", { className: "qayt-progress-bar-outer" })
    const progressBarInner = this.createElement("div", { className: "qayt-progress-bar-inner" })
    progressBarOuter.style.display = "none"
    progressBarOuter.append(progressBarInner)

    // Buttons
    const buttonBar = this.createElement("div", { className: "qayt-modal-buttons" })
    const cancelBtn = this.createElement("button", {
      id: "qayt-cancel-btn",
      textContent: this.LanguageManager.getMessage("close"),
    })
    const confirmBtn = this.createElement("button", {
      id: "qayt-confirm-btn",
      textContent: this.LanguageManager.getMessage("startAdding"),
    })

    cancelBtn.addEventListener("click", () => this.closeMainModal())
    buttonBar.append(cancelBtn, confirmBtn)

    this.modal.append(
      title,
      warningBox,
      languageGuide,
      subtitle,
      controls,
      progressLabel,
      progressBarOuter,
      languageContainer,
      addCustomBtn,
      buttonBar,
    )

    this.backdrop.append(this.modal)
    document.body.append(this.backdrop)

    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.closeMainModal()
    })

    return confirmBtn
  }

  // Create bulk command modal - 移除常見語言展示
  createBulkModal() {
    // 如果已存在，先清理舊的modal
    if (this.bulkBackdrop) {
      this.bulkBackdrop.remove()
      this.bulkBackdrop = null
      this.bulkModal = null
    }

    this.bulkBackdrop = this.createElement("div", { id: "qayt-bulk-modal-backdrop" })
    this.bulkModal = this.createElement("div", { id: "qayt-bulk-modal-content" })

    const title = this.createElement("h2", {
      textContent: this.LanguageManager.getMessage("bulkCommandExecutor"),
    })

    const warningBox = this.createWarningBox()

    const description = this.createElement("div", {
      className: "qayt-bulk-description",
      innerHTML: `
        <p><strong>${this.LanguageManager.getMessage("inputFormat")}</strong><code>{{${this.LanguageManager.getMessage("language")}|${this.LanguageManager.getMessage("title")}|${this.LanguageManager.getMessage("descriptionLabel")}},...}</code></p>
        <p><strong>${this.LanguageManager.getMessage("example")}</strong><code>{{English|My Title|My Description},{French|Mon Titre|Ma Description}}</code></p>
        <p><strong>${this.LanguageManager.getMessage("description")}</strong>${this.LanguageManager.getMessage("formatDescription")}</p>
      `,
    })

    // 移除語言指南，不再顯示常見語言列表
    // const languageGuide = this.createLanguageGuide()

    const textarea = this.createElement("textarea", {
      id: "qayt-bulk-only-textarea",
      placeholder: this.LanguageManager.getMessage("pasteBulkCommand"),
      rows: 8,
      value: "", // 確保初始值為空
    })

    // Preview container
    const previewContainer = this.createElement("div", { id: "qayt-bulk-preview-container" })
    const previewTitle = this.createElement("h3", {
      textContent: this.LanguageManager.getMessage("previewResults"),
    })
    const previewList = this.createElement("div", { id: "qayt-bulk-preview-list" })
    previewContainer.append(previewTitle, previewList)
    previewContainer.style.display = "none"

    // Real-time preview - 重新綁定事件監聽器
    textarea.addEventListener("input", () => {
      this.updateBulkPreview(textarea.value.trim(), previewContainer, previewList)
    })

    // Progress elements
    const progressLabel = this.createElement("div", {
      className: "qayt-bulk-progress-label",
      textContent: this.LanguageManager.getMessage("preparing"),
    })
    progressLabel.style.display = "none"

    const progressBarOuter = this.createElement("div", { className: "qayt-bulk-progress-bar-outer" })
    const progressBarInner = this.createElement("div", { className: "qayt-bulk-progress-bar-inner" })
    progressBarOuter.style.display = "none"
    progressBarOuter.append(progressBarInner)

    // Buttons
    const buttonBar = this.createElement("div", { className: "qayt-bulk-modal-buttons" })
    const cancelBtn = this.createElement("button", {
      id: "qayt-bulk-cancel-btn",
      textContent: this.LanguageManager.getMessage("close"),
      className: "qayt-btn-secondary",
    })
    const executeBtn = this.createElement("button", {
      id: "qayt-bulk-execute-btn",
      textContent: this.LanguageManager.getMessage("executeNow"),
      className: "qayt-btn-primary",
    })

    cancelBtn.addEventListener("click", () => this.closeBulkModal())
    buttonBar.append(cancelBtn, executeBtn)

    // 移除語言指南，只保留核心元素
    this.bulkModal.append(
      title,
      warningBox,
      description,
      // languageGuide, // 移除這行
      textarea,
      previewContainer,
      progressLabel,
      progressBarOuter,
      buttonBar,
    )

    this.bulkBackdrop.append(this.bulkModal)
    document.body.append(this.bulkBackdrop)

    this.bulkBackdrop.addEventListener("click", (e) => {
      if (e.target === this.bulkBackdrop) this.closeBulkModal()
    })

    return executeBtn
  }

  // Update bulk preview
  updateBulkPreview(text, previewContainer, previewList) {
    if (!text) {
      previewContainer.style.display = "none"
      return
    }

    try {
      const entries = this.parseBulkCommands(text)
      this.removeAllChildren(previewList)

      entries.forEach((entry, index) => {
        const item = this.createElement("div", { className: "qayt-preview-item" })
        item.innerHTML = `
          <div class="qayt-preview-number">${index + 1}</div>
          <div class="qayt-preview-content">
            <div class="qayt-preview-lang">${this.LanguageManager.getMessage("language")} ${entry.lang}</div>
            <div class="qayt-preview-title">${this.LanguageManager.getMessage("title")} ${entry.title}</div>
            <div class="qayt-preview-desc">${this.LanguageManager.getMessage("descriptionLabel")} ${entry.desc || this.LanguageManager.getMessage("none")}</div>
          </div>
        `
        previewList.append(item)
      })

      previewContainer.style.display = "block"
    } catch (error) {
      this.removeAllChildren(previewList)
      const errorItem = this.createElement("div", {
        className: "qayt-preview-error",
        textContent: `❌ ${error.message}`,
      })
      previewList.append(errorItem)
      previewContainer.style.display = "block"
    }
  }

  // Parse bulk commands
  parseBulkCommands(str) {
    const trimmed = str.replace(/^\s*\{\{|\}\}\s*$/g, "")
    const parts = trimmed.split(/\}\s*,\s*\{/)

    return parts.map((part, index) => {
      const clean = part.replace(/^\{|\}$/g, "").trim()
      const segments = clean.split("|")

      if (segments.length < 2) {
        throw new Error(`Item ${index + 1} format error: at least language and title required`)
      }

      const lang = segments[0] ? segments[0].trim() : ""
      const title = segments[1] ? segments[1].trim() : ""
      const desc = segments[2] ? segments[2].trim() : ""

      if (!lang || !title) {
        throw new Error(`Item ${index + 1} missing language or title`)
      }

      return { lang, title, desc }
    })
  }

  // Populate language list
  async populateLanguageList() {
    const languages = await this.StorageManager.loadLanguages()
    const existingLanguages = new Set(
      [...document.querySelectorAll(".language-text")].map((el) => el.innerText.replace(/$$.*$$/, "").trim()),
    )

    const container = document.getElementById("qayt-langs-container")
    this.removeAllChildren(container)

    languages.forEach((lang) => {
      const row = this.createLanguageRow(lang, false)
      if (existingLanguages.has(lang)) {
        row.classList.add("disabled")
        row.querySelector(".qayt-checkbox").checked = false
      }
      container.append(row)
    })

    document.getElementById("qayt-master-checkbox").checked = true
  }

  // Modal control methods
  async openMainModal() {
    const confirmBtn = this.createMainModal()
    await this.populateLanguageList()
    this.backdrop.style.display = "flex"
    return confirmBtn
  }

  closeMainModal() {
    if (this.backdrop) {
      this.backdrop.style.display = "none"
    }
  }

  // 修復批量指令modal的開啟方法
  openBulkModal() {
    const executeBtn = this.createBulkModal() // 每次都重新創建以確保狀態正確
    this.bulkBackdrop.style.display = "flex"

    // 確保textarea獲得焦點並且值為空
    setTimeout(() => {
      const textarea = document.getElementById("qayt-bulk-only-textarea")
      if (textarea) {
        textarea.value = "" // 清空內容
        textarea.focus()
        console.log("Bulk modal opened, textarea cleared and focused")
      }
    }, 100)

    return executeBtn
  }

  closeBulkModal() {
    if (this.bulkBackdrop) {
      this.bulkBackdrop.style.display = "none"
    }
  }

  // Create bulk edit modal
  createBulkEditModal() {
    if (this.editBackdrop) {
      this.editBackdrop.remove()
      this.editBackdrop = null
      this.editModal = null
    }

    this.editBackdrop = this.createElement("div", { id: "qayt-edit-modal-backdrop" })
    this.editModal = this.createElement("div", { id: "qayt-edit-modal-content" })

    const title = this.createElement("h2", { textContent: "✏️ 批量修改翻譯" })

    // Warning box for bulk edit
    const warningBox = this.createElement("div", {
      className: "qayt-warning-box",
      innerHTML: `
        <div class="qayt-warning-icon">ℹ️</div>
        <div class="qayt-warning-content">
          <strong>批量修改功能：</strong>修改已存在的翻譯內容。如果某個語言沒有翻譯，將會被跳過。
          <br><span class="qayt-warning-example">格式與批量新增相同：{{語言|新標題|新簡介}}</span>
        </div>
      `,
    })

    const description = this.createElement("div", {
      className: "qayt-bulk-description",
      innerHTML: `
        <p><strong>輸入格式：</strong><code>{{語言|新標題|新簡介},{語言|新標題|新簡介},...}</code></p>
        <p><strong>範例：</strong><code>{{English|Updated Title|Updated Description},{中文（簡體）|新標題|新描述}}</code></p>
        <p><strong>說明：</strong>只會修改已存在的翻譯，不會新增新的語言翻譯</p>
      `,
    })

    // Existing translations container
    const existingContainer = this.createElement("div", { id: "qayt-existing-translations" })
    const existingTitle = this.createElement("h3", { textContent: "📋 現有翻譯列表：" })
    const existingList = this.createElement("div", { id: "qayt-existing-list" })
    existingContainer.append(existingTitle, existingList)

    const editTextarea = this.createElement("textarea", {
      id: "qayt-edit-textarea",
      placeholder: "輸入要修改的翻譯，如：{{English|New Title|New Description},{中文（簡體）|新標題|新描述}}",
      rows: 8,
      value: "",
    })

    // Preview container
    const previewContainer = this.createElement("div", { id: "qayt-edit-preview-container" })
    const previewTitle = this.createElement("h3", { textContent: "預覽修改結果：" })
    const previewList = this.createElement("div", { id: "qayt-edit-preview-list" })
    previewContainer.append(previewTitle, previewList)
    previewContainer.style.display = "none"

    // Real-time preview
    editTextarea.addEventListener("input", () => {
      this.updateEditPreview(editTextarea.value.trim(), previewContainer, previewList)
    })

    // Progress elements
    const progressLabel = this.createElement("div", {
      className: "qayt-edit-progress-label",
      textContent: "準備中…",
    })
    progressLabel.style.display = "none"

    const progressBarOuter = this.createElement("div", { className: "qayt-edit-progress-bar-outer" })
    const progressBarInner = this.createElement("div", { className: "qayt-edit-progress-bar-inner" })
    progressBarOuter.style.display = "none"
    progressBarOuter.append(progressBarInner)

    // Buttons
    const buttonBar = this.createElement("div", { className: "qayt-edit-modal-buttons" })
    const cancelBtn = this.createElement("button", {
      id: "qayt-edit-cancel-btn",
      textContent: "關閉",
      className: "qayt-btn-secondary",
    })
    const executeBtn = this.createElement("button", {
      id: "qayt-edit-execute-btn",
      textContent: "✏️ 開始修改",
      className: "qayt-btn-primary",
    })

    cancelBtn.addEventListener("click", () => this.closeBulkEditModal())
    buttonBar.append(cancelBtn, executeBtn)

    this.editModal.append(
      title,
      warningBox,
      description,
      existingContainer,
      editTextarea,
      previewContainer,
      progressLabel,
      progressBarOuter,
      buttonBar,
    )

    this.editBackdrop.append(this.editModal)
    document.body.append(this.editBackdrop)

    this.editBackdrop.addEventListener("click", (e) => {
      if (e.target === this.editBackdrop) this.closeBulkEditModal()
    })

    return executeBtn
  }

  // Get existing translations
  async getExistingTranslations() {
    const translations = []

    try {
      // Wait a bit for the page to fully load
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Try multiple selectors to find translation rows
      const possibleSelectors = [
        "ytgn-video-translation-row",
        "[class*='translation-row']",
        "[class*='language-row']",
        "tr[class*='translation']",
      ]

      let rows = []
      for (const selector of possibleSelectors) {
        rows = document.querySelectorAll(selector)
        if (rows.length > 0) {
          console.log(`Found ${rows.length} translation rows using selector: ${selector}`)
          break
        }
      }

      if (rows.length === 0) {
        console.log("No translation rows found, trying alternative approach...")
        // Try to find any elements containing language text
        const languageElements = document.querySelectorAll('[class*="language"], [class*="lang"]')
        console.log(`Found ${languageElements.length} potential language elements`)

        // Look for common language names in the page
        const commonLanguages = [
          "English",
          "中文",
          "日本語",
          "한국어",
          "Español",
          "Français",
          "Deutsch",
          "Português",
          "Русский",
          "العربية",
        ]
        const pageText = document.body.innerText
        const foundLanguages = commonLanguages.filter((lang) => pageText.includes(lang))

        if (foundLanguages.length > 0) {
          console.log("Found languages in page text:", foundLanguages)
          // Create mock translation objects for found languages
          foundLanguages.forEach((lang, index) => {
            translations.push({
              language: lang,
              title: `Sample title for ${lang}`,
              description: `Sample description for ${lang}`,
              row: null,
            })
          })
          return translations
        }
      }

      for (const row of rows) {
        try {
          // Try multiple ways to find language text
          let langElement =
            row.querySelector(".language-text") ||
            row.querySelector("[class*='language']") ||
            row.querySelector("[class*='lang']")

          if (!langElement) {
            // Try to find any text that looks like a language name
            const textElements = row.querySelectorAll("*")
            for (const el of textElements) {
              const text = el.textContent?.trim()
              if (text && text.length > 2 && text.length < 50) {
                // Check if it looks like a language name
                if (/^[A-Za-z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff\u0600-\u06ff\s$$$$]+$/.test(text)) {
                  langElement = el
                  break
                }
              }
            }
          }

          if (!langElement) continue

          const language = langElement.textContent.trim()

          // Skip original language entries
          if (
            language === "原始語言" ||
            language === "Original language" ||
            language === "原文" ||
            language.toLowerCase().includes("original")
          ) {
            continue
          }

          // Look for title and description elements
          const titleElement =
            row.querySelector(".title-text") ||
            row.querySelector("[class*='title']") ||
            row.querySelector("input[type='text']") ||
            row.querySelector("textarea")

          const descElement =
            row.querySelector(".description-text") ||
            row.querySelector("[class*='description']") ||
            row.querySelector("textarea:not([class*='title'])")

          // Only add if we found some content or if it's clearly a translation row
          if (titleElement || descElement || language.length > 0) {
            translations.push({
              language: language,
              title: titleElement ? titleElement.textContent?.trim() || titleElement.value?.trim() || "" : "",
              description: descElement ? descElement.textContent?.trim() || descElement.value?.trim() || "" : "",
              row: row,
            })
          }
        } catch (e) {
          console.warn("Error processing translation row:", e)
        }
      }

      console.log(
        `Found ${translations.length} translations:`,
        translations.map((t) => t.language),
      )
      return translations
    } catch (error) {
      console.error("Error in getExistingTranslations:", error)
      return []
    }
  }

  // Update edit preview
  updateEditPreview(text, previewContainer, previewList) {
    if (!text) {
      previewContainer.style.display = "none"
      return
    }

    try {
      const entries = this.parseBulkCommands(text)
      this.removeAllChildren(previewList)

      entries.forEach((entry, index) => {
        const item = this.createElement("div", { className: "qayt-preview-item" })
        item.innerHTML = `
          <div class="qayt-preview-number">${index + 1}</div>
          <div class="qayt-preview-content">
            <div class="qayt-preview-lang">🌐 語言：${entry.lang}</div>
            <div class="qayt-preview-title">📝 新標題：${entry.title}</div>
            ${entry.desc ? `<div class="qayt-preview-desc">📄 新簡介：${entry.desc}</div>` : '<div class="qayt-preview-desc">📄 新簡介：(保持不變)</div>'}
          </div>
        `
        previewList.append(item)
      })

      previewContainer.style.display = "block"
    } catch (error) {
      this.removeAllChildren(previewList)
      const errorItem = this.createElement("div", {
        className: "qayt-preview-error",
        textContent: `❌ ${error.message}`,
      })
      previewList.append(errorItem)
      previewContainer.style.display = "block"
    }
  }

  // Open bulk edit modal
  async openBulkEditModal() {
    try {
      console.log("🔧 Opening bulk edit modal...")
      const executeBtn = this.createBulkEditModal()

      // Load existing translations with better error handling
      try {
        const existingTranslations = await this.getExistingTranslations()
        const existingList = document.getElementById("qayt-existing-list")

        if (!existingList) {
          console.error("Could not find existing list element")
          return executeBtn
        }

        this.removeAllChildren(existingList)

        if (existingTranslations.length === 0) {
          const noTranslations = this.createElement("div", {
            className: "qayt-no-translations",
            innerHTML: `
              <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">未找到現有翻譯</div>
                <div style="font-size: 14px; color: #aaa; line-height: 1.4;">
                  請確保您在視頻的翻譯頁面，並且已經添加了一些翻譯內容。<br>
                  如果您剛添加了翻譯，請刷新頁面後再試。
                </div>
              </div>
            `,
          })
          existingList.append(noTranslations)
        } else {
          existingTranslations.forEach((trans, index) => {
            const item = this.createElement("div", { className: "qayt-existing-item" })
            item.innerHTML = `
              <div class="qayt-existing-number">${index + 1}</div>
              <div class="qayt-existing-content">
                <div class="qayt-existing-lang">🌐 ${trans.language}</div>
                <div class="qayt-existing-title">📝 ${trans.title || "(無標題)"}</div>
                <div class="qayt-existing-desc">📄 ${trans.description || "(無簡介)"}</div>
              </div>
            `
            existingList.append(item)
          })
        }
      } catch (error) {
        console.error("Error loading existing translations:", error)
        const existingList = document.getElementById("qayt-existing-list")
        if (existingList) {
          existingList.innerHTML = `
            <div class="qayt-no-translations">
              <div style="text-align: center; padding: 20px; color: #f44336;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">載入翻譯時發生錯誤</div>
                <div style="font-size: 14px; color: #aaa;">請刷新頁面後重試</div>
              </div>
            </div>
          `
        }
      }

      this.editBackdrop.style.display = "flex"

      // Focus on textarea after a short delay
      setTimeout(() => {
        const textarea = document.getElementById("qayt-edit-textarea")
        if (textarea) {
          textarea.focus()
        }
      }, 100)

      return executeBtn
    } catch (error) {
      console.error("Error in openBulkEditModal:", error)
      alert("打開批量修改窗口時發生錯誤，請刷新頁面後重試。")
      return null
    }
  }

  // Close bulk edit modal
  closeBulkEditModal() {
    if (this.editBackdrop) {
      this.editBackdrop.style.display = "none"
    }
  }

  // Show edit progress
  showEditProgress() {
    document.getElementById("qayt-existing-translations").style.display = "none"
    document.getElementById("qayt-edit-textarea").style.display = "none"
    document.getElementById("qayt-edit-preview-container").style.display = "none"
    document.querySelector(".qayt-edit-modal-buttons").style.display = "none"
    document.querySelector(".qayt-bulk-description").style.display = "none"
    document.querySelector(".qayt-warning-box").style.display = "none"

    const progressLabel = this.editModal.querySelector(".qayt-edit-progress-label")
    const progressBarOuter = this.editModal.querySelector(".qayt-edit-progress-bar-outer")
    progressLabel.style.display = "block"
    progressBarOuter.style.display = "block"
  }

  // Update edit progress
  updateEditProgress(current, total, currentLang) {
    // 節流：只在百分比變化時更新
    const percent = Math.round((current / total) * 100)
    const lastPercent = this.lastEditPercent || 0

    if (percent !== lastPercent || current % 3 === 0 || current === total) {
      const progressLabel = this.editModal.querySelector(".qayt-edit-progress-label")
      const progressBarInner = this.editModal.querySelector(".qayt-edit-progress-bar-inner")

      progressLabel.textContent = `正在修改 ${current}/${total}: ${currentLang} (${percent}%)`
      progressBarInner.style.width = `${percent}%`

      this.lastEditPercent = percent
    }
  }

  // Complete edit progress
  completeEditProgress(successCount, totalCount) {
    const progressLabel = this.editModal.querySelector(".qayt-edit-progress-label")
    progressLabel.textContent = `🎉 批量修改完成！成功修改 ${successCount}/${totalCount} 個翻譯`

    setTimeout(() => {
      this.closeBulkEditModal()
      // Reset interface
      if (this.editBackdrop) {
        this.editBackdrop.remove()
        this.editBackdrop = null
        this.editModal = null
      }
    }, 3000)
  }

  // Progress update methods
  updateMainProgress(current, total, currentLang) {
    // 只在百分比變化或每5個項目時更新
    const percent = Math.round((current / total) * 100)
    const lastPercent = this.lastMainPercent || 0

    if (percent !== lastPercent || current % 5 === 0 || current === total) {
      const progressLabel = this.modal.querySelector(".qayt-progress-label")
      const progressBarInner = this.modal.querySelector(".qayt-progress-bar-inner")

      progressLabel.textContent = `${this.LanguageManager.getMessage("processing")} ${current}/${total}: ${currentLang} (${percent}%)`
      progressBarInner.style.width = `${percent}%`

      this.lastMainPercent = percent
    }
  }

  updateBulkProgress(current, total, currentLang) {
    const percent = Math.round((current / total) * 100)
    const lastPercent = this.lastBulkPercent || 0

    if (percent !== lastPercent || current % 5 === 0 || current === total) {
      const progressLabel = this.bulkModal.querySelector(".qayt-bulk-progress-label")
      const progressBarInner = this.bulkModal.querySelector(".qayt-bulk-progress-bar-inner")

      progressLabel.textContent = `${this.LanguageManager.getMessage("processing")} ${current}/${total}: ${currentLang} (${percent}%)`
      progressBarInner.style.width = `${percent}%`

      this.lastBulkPercent = percent
    }
  }

  showMainProgress() {
    // Hide input interface, show progress
    document.getElementById("qayt-global-controls").style.display = "none"
    document.getElementById("qayt-langs-container").style.display = "none"
    document.getElementById("qayt-add-custom-btn").style.display = "none"
    document.querySelector(".qayt-modal-buttons").style.display = "none"
    document.querySelector(".qayt-warning-box").style.display = "none"
    document.querySelector(".qayt-bulk-description").style.display = "none"

    const progressLabel = this.modal.querySelector(".qayt-progress-label")
    const progressBarOuter = this.modal.querySelector(".qayt-progress-bar-outer")
    progressLabel.style.display = "block"
    progressBarOuter.style.display = "block"
  }

  showBulkProgress() {
    // Hide input interface, show progress
    document.getElementById("qayt-bulk-only-textarea").style.display = "none"
    document.getElementById("qayt-bulk-preview-container").style.display = "none"
    document.querySelector(".qayt-bulk-modal-buttons").style.display = "none"
    document.querySelector(".qayt-bulk-description").style.display = "none"
    document.querySelector(".qayt-warning-box").style.display = "none"

    const progressLabel = this.bulkModal.querySelector(".qayt-bulk-progress-label")
    const progressBarOuter = this.bulkModal.querySelector(".qayt-bulk-progress-bar-outer")
    progressLabel.style.display = "block"
    progressBarOuter.style.display = "block"
  }

  completeMainProgress() {
    const progressLabel = this.modal.querySelector(".qayt-progress-label")
    progressLabel.textContent = this.LanguageManager.getMessage("allCompleted")

    setTimeout(() => {
      this.closeMainModal()
      // Reset interface
      document.querySelector(".qayt-warning-box").style.display = "flex"
      document.querySelector(".qayt-bulk-description").style.display = "block"
    }, 800)
  }

  // 修復批量指令完成後的重置
  completeBulkProgress() {
    const progressLabel = this.bulkModal.querySelector(".qayt-bulk-progress-label")
    progressLabel.textContent = this.LanguageManager.getMessage("completed")

    setTimeout(() => {
      this.closeBulkModal()

      // 完全清理舊的modal，下次開啟時會重新創建
      if (this.bulkBackdrop) {
        this.bulkBackdrop.remove()
        this.bulkBackdrop = null
        this.bulkModal = null
      }

      console.log("Bulk modal completed and cleaned up")
    }, 2000)
  }
}

// Make it available globally
window.UIManager = UIManager
