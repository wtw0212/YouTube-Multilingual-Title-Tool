;(() => {
  console.log("🚀 YT 多語言快速新增工具 v6.7.0 啟動")

  const STORAGE_KEY = "qayt_saved_languages"
  const DEFAULT_LANGS = [
    "中文（簡體）",
    "西班牙文",
    "英文",
    "印地文",
    "阿拉伯文",
    "孟加拉文",
    "葡萄牙文",
    "俄文",
    "日文",
    "韓文",
  ]

  /** 通用等待函式 **/
  function waitFor({ selector, context = document, xpath = false, timeout = 8000 }) {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      const iv = setInterval(() => {
        let el
        if (xpath) {
          el = document.evaluate(selector, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        } else {
          el = context.querySelector(selector)
        }
        if (el) {
          clearInterval(iv)
          resolve(el)
        } else if (Date.now() - start > timeout) {
          clearInterval(iv)
          reject(`等待元素超時：${selector}`)
        }
      }, 80)
    })
  }

  /** 關閉所有對話框 **/
  function forceCloseAllDialogs() {
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

  /** 建立元素 **/
  function createEl(tag, props = {}, children = []) {
    const e = document.createElement(tag)
    Object.assign(e, props)
    children.forEach((c) => e.appendChild(c))
    return e
  }
  function removeAll(el) {
    while (el.firstChild) el.removeChild(el.firstChild)
  }

  /** 儲存／讀取語言列表 **/
  async function saveLangs(chrome) {
    const rows = [...document.querySelectorAll("#qayt-langs-container .qayt-lang-row:not(.editing)")]
    const names = rows.map((r) => r.dataset.name).filter(Boolean)
    await chrome.storage.local.set({ [STORAGE_KEY]: names })
  }
  async function loadLangs(chrome) {
    const res = await chrome.storage.local.get(STORAGE_KEY)
    return res[STORAGE_KEY] || DEFAULT_LANGS
  }

  let backdrop, modal, bulkBackdrop, bulkModal, editBackdrop, editModal

  /** 解析批量指令字串 - 新格式：{{語言|標題|簡介},{...}} **/
  function parseBulkCommands(str) {
    // 移除外層的 {{ 和 }}
    const trimmed = str.replace(/^\s*\{\{|\}\}\s*$/g, "")

    // 按 },{ 分割各個項目
    const parts = trimmed.split(/\}\s*,\s*\{/)

    return parts.map((part, index) => {
      // 移除單個項目的 { 和 }
      const clean = part.replace(/^\{|\}$/g, "").trim()

      // 按 | 分割：語言|標題|簡介
      const segments = clean.split("|")

      if (segments.length < 2) {
        throw new Error(`第 ${index + 1} 項格式錯誤：至少需要語言和標題`)
      }

      const lang = segments[0] ? segments[0].trim() : ""
      const title = segments[1] ? segments[1].trim() : ""
      const desc = segments[2] ? segments[2].trim() : ""

      if (!lang || !title) {
        throw new Error(`第 ${index + 1} 項缺少語言或標題`)
      }

      return { lang, title, desc }
    })
  }

  /** 獲取現有翻譯內容 **/
  async function getExistingTranslations() {
    const translations = []
    const rows = document.querySelectorAll("ytgn-video-translation-row")

    for (const row of rows) {
      try {
        const langElement = row.querySelector(".language-text")
        if (!langElement) continue

        const language = langElement.textContent.trim()
        if (language === "原始語言") continue // 跳過原始語言

        // 檢查是否有翻譯內容
        const titleElement = row.querySelector(".title-text")
        const descElement = row.querySelector(".description-text")

        if (titleElement || descElement) {
          translations.push({
            language: language,
            title: titleElement ? titleElement.textContent.trim() : "",
            description: descElement ? descElement.textContent.trim() : "",
            row: row,
          })
        }
      } catch (e) {
        console.warn("獲取翻譯內容時出錯：", e)
      }
    }

    return translations
  }

  /** 建立批量修改專用 Modal **/
  function createBulkEditModal() {
    if (editBackdrop) return

    editBackdrop = createEl("div", { id: "qayt-edit-modal-backdrop" })
    editModal = createEl("div", { id: "qayt-edit-modal-content" })

    const h2 = createEl("h2", { textContent: "✏️ 批量修改翻譯" })

    // 添加說明
    const warningBox = createEl("div", {
      className: "qayt-warning-box",
      innerHTML: `
        <div class="qayt-warning-icon">ℹ️</div>
        <div class="qayt-warning-content">
          <strong>批量修改功能：</strong>修改已存在的翻譯內容。如果某個語言沒有翻譯，將會被跳過。
          <br><span class="qayt-warning-example">格式與批量新增相同：{{語言|新標題|新簡介}}</span>
        </div>
      `,
    })

    const description = createEl("div", {
      className: "qayt-bulk-description",
      innerHTML: `
        <p><strong>輸入格式：</strong><code>{{語言|新標題|新簡介},{語言|新標題|新簡介},...}</code></p>
        <p><strong>範例：</strong><code>{{英文|Updated Title|Updated Description},{中文（簡體）|更新的標題|更新的描述}}</code></p>
        <p><strong>說明：</strong>只會修改已存在的翻譯，不會新增新的語言翻譯</p>
      `,
    })

    // 顯示現有翻譯
    const existingContainer = createEl("div", { id: "qayt-existing-translations" })
    const existingTitle = createEl("h3", { textContent: "📋 現有翻譯列表：" })
    const existingList = createEl("div", { id: "qayt-existing-list" })
    existingContainer.append(existingTitle, existingList)

    const editTextarea = createEl("textarea", {
      id: "qayt-edit-textarea",
      placeholder: "輸入要修改的翻譯，如：{{英文|New Title|New Description},{中文（簡體）|新標題|新描述}}",
      rows: 8,
    })

    // 預覽區域
    const previewContainer = createEl("div", { id: "qayt-edit-preview-container" })
    const previewTitle = createEl("h3", { textContent: "預覽修改結果：" })
    const previewList = createEl("div", { id: "qayt-edit-preview-list" })
    previewContainer.append(previewTitle, previewList)
    previewContainer.style.display = "none"

    // 即時預覽功能
    editTextarea.addEventListener("input", () => {
      const text = editTextarea.value.trim()
      if (!text) {
        previewContainer.style.display = "none"
        return
      }

      try {
        const entries = parseBulkCommands(text)
        removeAll(previewList)

        entries.forEach((entry, index) => {
          const item = createEl("div", { className: "qayt-preview-item" })
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
      } catch (e) {
        removeAll(previewList)
        const errorItem = createEl("div", {
          className: "qayt-preview-error",
          textContent: `❌ ${e.message}`,
        })
        previewList.append(errorItem)
        previewContainer.style.display = "block"
      }
    })

    // 進度顯示
    const progressLabel = createEl("div", { className: "qayt-edit-progress-label", textContent: "準備中…" })
    const barOuter = createEl("div", { className: "qayt-edit-progress-bar-outer" })
    const barInner = createEl("div", { className: "qayt-edit-progress-bar-inner" })
    progressLabel.style.display = "none"
    barOuter.style.display = "none"
    barOuter.append(barInner)

    // 按鈕區
    const btnBar = createEl("div", { className: "qayt-edit-modal-buttons" })
    const btnCancel = createEl("button", {
      id: "qayt-edit-cancel-btn",
      textContent: "關閉",
      className: "qayt-btn-secondary",
    })
    const btnExecute = createEl("button", {
      id: "qayt-edit-execute-btn",
      textContent: "✏️ 開始修改",
      className: "qayt-btn-primary",
    })

    btnCancel.addEventListener("click", closeBulkEditModal)
    btnExecute.addEventListener("click", () => executeBulkEdit(window.chrome))
    btnBar.append(btnCancel, btnExecute)

    editModal.append(
      h2,
      warningBox,
      description,
      existingContainer,
      editTextarea,
      previewContainer,
      progressLabel,
      barOuter,
      btnBar,
    )
    editBackdrop.append(editModal)
    document.body.append(editBackdrop)

    editBackdrop.addEventListener("click", (e) => {
      if (e.target === editBackdrop) closeBulkEditModal()
    })
  }

  async function openBulkEditModal(chrome) {
    createBulkEditModal()

    // 載入現有翻譯
    const existingTranslations = await getExistingTranslations()
    const existingList = document.getElementById("qayt-existing-list")
    removeAll(existingList)

    if (existingTranslations.length === 0) {
      const noTranslations = createEl("div", {
        className: "qayt-no-translations",
        textContent: "❌ 沒有找到現有的翻譯內容",
      })
      existingList.append(noTranslations)
    } else {
      existingTranslations.forEach((trans, index) => {
        const item = createEl("div", { className: "qayt-existing-item" })
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

    editBackdrop.style.display = "flex"
    document.getElementById("qayt-edit-textarea").focus()
  }

  function closeBulkEditModal() {
    if (editBackdrop) editBackdrop.style.display = "none"
  }

  /** 執行批量修改 **/
  async function executeBulkEdit(chrome) {
    const text = document.getElementById("qayt-edit-textarea").value.trim()
    if (!text) return alert("請輸入要修改的翻譯內容。")

    let tasks
    try {
      tasks = parseBulkCommands(text)
    } catch (e) {
      return alert(`批量修改指令解析錯誤：${e.message}\n\n正確格式：{{語言|新標題|新簡介},{語言|新標題|新簡介}}`)
    }

    if (!tasks.length) return alert("未找到有效的修改指令。")

    // 檢查哪些語言存在翻譯
    const existingTranslations = await getExistingTranslations()
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
      return alert("沒有找到可以修改的語言翻譯。")
    }

    const langNames = validTasks.map((task) => task.lang).join("、")
    const confirmMessage = `即將修改 ${validTasks.length} 個語言的翻譯：${langNames}\n\n確定要執行嗎？`

    if (!confirm(confirmMessage)) return

    // 隱藏輸入界面，顯示進度
    document.getElementById("qayt-existing-translations").style.display = "none"
    document.getElementById("qayt-edit-textarea").style.display = "none"
    document.getElementById("qayt-edit-preview-container").style.display = "none"
    document.querySelector(".qayt-edit-modal-buttons").style.display = "none"
    document.querySelector(".qayt-bulk-description").style.display = "none"
    document.querySelector(".qayt-warning-box").style.display = "none"

    const progressLabel = editModal.querySelector(".qayt-edit-progress-label")
    const progressBarOuter = editModal.querySelector(".qayt-edit-progress-bar-outer")
    const progressBarInner = editModal.querySelector(".qayt-edit-progress-bar-inner")
    progressLabel.style.display = "block"
    progressBarOuter.style.display = "block"
    progressBarInner.style.width = "0%"

    // 執行批量修改
    let successCount = 0
    for (let i = 0; i < validTasks.length; i++) {
      const { lang, title, desc } = validTasks[i]
      const percent = Math.round(((i + 1) / validTasks.length) * 100)
      progressLabel.textContent = `正在修改 ${i + 1}/${validTasks.length}: ${lang} (${percent}%)`
      progressBarInner.style.width = `${percent}%`

      try {
        console.log(`✏️ 批量修改第${i + 1}/${validTasks.length}：${lang}`)
        await editSingleTranslation(lang, title, desc)
        successCount++
        console.log(`✅ 修改完成「${lang}」`)
      } catch (e) {
        console.error(`❌ 修改「${lang}」失敗：`, e)
      }
    }

    progressLabel.textContent = `🎉 批量修改完成！成功修改 ${successCount}/${validTasks.length} 個翻譯`
    setTimeout(() => {
      closeBulkEditModal()
      // 重置界面
      document.getElementById("qayt-existing-translations").style.display = "block"
      document.getElementById("qayt-edit-textarea").style.display = "block"
      document.getElementById("qayt-edit-textarea").value = ""
      document.querySelector(".qayt-edit-modal-buttons").style.display = "flex"
      document.querySelector(".qayt-bulk-description").style.display = "block"
      document.querySelector(".qayt-warning-box").style.display = "flex"
      progressLabel.style.display = "none"
      progressBarOuter.style.display = "none"
    }, 3000)
  }

  /** 修改單一翻譯 **/
  async function editSingleTranslation(name, title, desc) {
    forceCloseAllDialogs()
    await new Promise((r) => setTimeout(r, 300))

    // 找到對應的翻譯行
    const rowEl = await waitFor({
      selector: `//ytgn-video-translation-row[.//div[contains(@class,'language-text') and normalize-space(.)='${name}']]`,
      xpath: true,
    })

    const metadataCell = await waitFor({
      selector: ".//td[contains(@class,'tablecell-metadata')]",
      context: rowEl,
      xpath: true,
    })
    const hoverCell = await waitFor({
      selector: ".//ytgn-video-translation-hover-cell",
      context: metadataCell,
      xpath: true,
    })

    // 觸發懸停狀態
    rowEl.focus()
    hoverCell.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
    hoverCell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
    hoverCell.setAttribute("is-hovered", "")
    await new Promise((r) => setTimeout(r, 300))

    // 找到編輯按鈕（不是新增按鈕）
    const editBtn = [...hoverCell.querySelectorAll("ytcp-icon-button,ytcp-button")].find((btn) => {
      const ariaLabel = btn.getAttribute("aria-label")
      return ariaLabel && (ariaLabel.includes("編輯") || ariaLabel.includes("Edit"))
    })

    if (!editBtn) {
      // 如果沒有找到編輯按鈕，嘗試點擊翻譯內容區域
      const titleElement = rowEl.querySelector(".title-text, .description-text")
      if (titleElement) {
        titleElement.click()
      } else {
        throw new Error("找不到編輯按鈕或翻譯內容")
      }
    } else {
      editBtn.click()
    }

    const editorDialog = await waitFor({
      selector: "#metadata-editor[opened], tp-yt-paper-dialog[opened]",
      timeout: 8000,
    })
    if (editorDialog.hasAttribute("aria-hidden")) editorDialog.removeAttribute("aria-hidden")
    document.querySelectorAll("#metadata-editor, tp-yt-paper-dialog").forEach((d) => {
      if (d !== editorDialog) {
        d.style.display = "none"
        d.removeAttribute("opened")
      }
    })

    await new Promise((r) => setTimeout(r, 1000))

    const titleEl = await waitFor({ selector: "#translated-title textarea", context: editorDialog, timeout: 3000 })
    titleEl.focus()
    await new Promise((r) => setTimeout(r, 200))
    titleEl.select()
    titleEl.value = title
    titleEl.dispatchEvent(new Event("input", { bubbles: true }))
    titleEl.dispatchEvent(new Event("change", { bubbles: true }))

    // 修改簡介（如果提供）
    if (desc) {
      const descEl = editorDialog.querySelector("#translated-description textarea")
      if (descEl) {
        descEl.focus()
        await new Promise((r) => setTimeout(r, 200))
        descEl.value = desc
        descEl.dispatchEvent(new Event("input", { bubbles: true }))
        descEl.dispatchEvent(new Event("change", { bubbles: true }))
      }
    }
    await new Promise((r) => setTimeout(r, 800))

    const publishBtn = await waitFor({ selector: "#publish-button", context: editorDialog, timeout: 5000 })
    publishBtn.click()
    await new Promise((r) => setTimeout(r, 2000))

    hoverCell.removeAttribute("is-hovered")
  }

  /** 建立批量指令專用 Modal **/
  function createBulkModal() {
    if (bulkBackdrop) return

    bulkBackdrop = createEl("div", { id: "qayt-bulk-modal-backdrop" })
    bulkModal = createEl("div", { id: "qayt-bulk-modal-content" })

    const h2 = createEl("h2", { textContent: "🚀 批量指令執行器" })

    // 添加語言名稱重要提醒
    const warningBox = createEl("div", {
      className: "qayt-warning-box",
      innerHTML: `
        <div class="qayt-warning-icon">⚠️</div>
        <div class="qayt-warning-content">
          <strong>重要提醒：</strong>語言名稱必須與 YouTube 新增語言選項中的名稱完全相同，包括所有符號和括號！
          <br><span class="qayt-warning-example">例如：使用「中文（簡體）」而不是「中文简体」或「中文(簡體)」</span>
        </div>
      `,
    })

    const description = createEl("div", {
      className: "qayt-bulk-description",
      innerHTML: `
        <p><strong>輸入格式：</strong><code>{{語言|標題|簡介},{語言|標題|簡介},...}</code></p>
        <p><strong>範例：</strong><code>{{英文|My Title|My Description},{法文|Mon Titre|Ma Description}}</code></p>
        <p><strong>說明：</strong>使用 <code>|</code> 分隔語言、標題、簡介，簡介可以省略</p>
        <div class="qayt-lang-reminder">
          <strong>📝 常見語言名稱：</strong>
          <span class="qayt-lang-tag">英文</span>
          <span class="qayt-lang-tag">中文（簡體）</span>
          <span class="qayt-lang-tag">中文（繁體）</span>
          <span class="qayt-lang-tag">日文</span>
          <span class="qayt-lang-tag">韓文</span>
          <span class="qayt-lang-tag">法文</span>
          <span class="qayt-lang-tag">德文</span>
          <span class="qayt-lang-tag">西班牙文</span>
          <span class="qayt-lang-tag">葡萄牙文</span>
          <span class="qayt-lang-tag">俄文</span>
          <span class="qayt-lang-tag">義大利文</span>
          <span class="qayt-lang-tag">印地文</span>
          <span class="qayt-lang-tag">阿拉伯文</span>
          <span class="qayt-lang-tag">孟加拉文</span>
        </div>
      `,
    })

    const bulkTextarea = createEl("textarea", {
      id: "qayt-bulk-only-textarea",
      placeholder: "貼上批量指令，如：{{英文|My Title|My Description},{中文（簡體）|我的標題|我的描述}}",
      rows: 8,
    })

    // 預覽區域
    const previewContainer = createEl("div", { id: "qayt-bulk-preview-container" })
    const previewTitle = createEl("h3", { textContent: "預覽解析結果：" })
    const previewList = createEl("div", { id: "qayt-bulk-preview-list" })
    previewContainer.append(previewTitle, previewList)
    previewContainer.style.display = "none"

    // 即時預覽功能
    bulkTextarea.addEventListener("input", () => {
      const text = bulkTextarea.value.trim()
      if (!text) {
        previewContainer.style.display = "none"
        return
      }

      try {
        const entries = parseBulkCommands(text)
        removeAll(previewList)

        entries.forEach((entry, index) => {
          const item = createEl("div", { className: "qayt-preview-item" })
          item.innerHTML = `
            <div class="qayt-preview-number">${index + 1}</div>
            <div class="qayt-preview-content">
              <div class="qayt-preview-lang">🌐 語言：${entry.lang}</div>
              <div class="qayt-preview-title">📝 標題：${entry.title}</div>
              ${entry.desc ? `<div class="qayt-preview-desc">📄 簡介：${entry.desc}</div>` : '<div class="qayt-preview-desc">📄 簡介：(無)</div>'}
            </div>
          `
          previewList.append(item)
        })

        previewContainer.style.display = "block"
      } catch (e) {
        removeAll(previewList)
        const errorItem = createEl("div", {
          className: "qayt-preview-error",
          textContent: `❌ ${e.message}`,
        })
        previewList.append(errorItem)
        previewContainer.style.display = "block"
      }
    })

    // 進度顯示
    const progressLabel = createEl("div", { className: "qayt-bulk-progress-label", textContent: "準備中…" })
    const barOuter = createEl("div", { className: "qayt-bulk-progress-bar-outer" })
    const barInner = createEl("div", { className: "qayt-bulk-progress-bar-inner" })
    progressLabel.style.display = "none"
    barOuter.style.display = "none"
    barOuter.append(barInner)

    // 按鈕區
    const btnBar = createEl("div", { className: "qayt-bulk-modal-buttons" })
    const btnCancel = createEl("button", {
      id: "qayt-bulk-cancel-btn",
      textContent: "關閉",
      className: "qayt-btn-secondary",
    })
    const btnExecute = createEl("button", {
      id: "qayt-bulk-execute-btn",
      textContent: "🚀 立即執行",
      className: "qayt-btn-primary",
    })

    btnCancel.addEventListener("click", closeBulkModal)
    btnExecute.addEventListener("click", () => executeBulkCommands(window.chrome))
    btnBar.append(btnCancel, btnExecute)

    bulkModal.append(h2, warningBox, description, bulkTextarea, previewContainer, progressLabel, barOuter, btnBar)
    bulkBackdrop.append(bulkModal)
    document.body.append(bulkBackdrop)

    bulkBackdrop.addEventListener("click", (e) => {
      if (e.target === bulkBackdrop) closeBulkModal()
    })
  }

  function openBulkModal(chrome) {
    createBulkModal()
    bulkBackdrop.style.display = "flex"
    document.getElementById("qayt-bulk-only-textarea").focus()
  }

  function closeBulkModal() {
    if (bulkBackdrop) bulkBackdrop.style.display = "none"
  }

  /** 執行批量指令 - 添加語言驗證 **/
  async function executeBulkCommands(chrome) {
    const text = document.getElementById("qayt-bulk-only-textarea").value.trim()
    if (!text) return alert("請輸入批量指令。")

    let tasks
    try {
      tasks = parseBulkCommands(text)
    } catch (e) {
      return alert(`批量指令解析錯誤：${e.message}\n\n正確格式：{{語言|標題|簡介},{語言|標題|簡介}}`)
    }

    if (!tasks.length) return alert("未找到有效的批量指令。")

    // 添加語言名稱驗證提醒
    const langNames = tasks.map((task) => task.lang).join("、")
    const confirmMessage = `即將處理 ${tasks.length} 個語言：${langNames}\n\n⚠️ 請確認語言名稱與 YouTube 新增語言選項完全相同（包括符號）\n\n確定要執行嗎？`

    if (!confirm(confirmMessage)) return

    // 隱藏輸入界面，顯示進度
    document.getElementById("qayt-bulk-only-textarea").style.display = "none"
    document.getElementById("qayt-bulk-preview-container").style.display = "none"
    document.querySelector(".qayt-bulk-modal-buttons").style.display = "none"
    document.querySelector(".qayt-bulk-description").style.display = "none"
    document.querySelector(".qayt-warning-box").style.display = "none"

    const progressLabel = bulkModal.querySelector(".qayt-bulk-progress-label")
    const progressBarOuter = bulkModal.querySelector(".qayt-bulk-progress-bar-outer")
    const progressBarInner = bulkModal.querySelector(".qayt-bulk-progress-bar-inner")
    progressLabel.style.display = "block"
    progressBarOuter.style.display = "block"
    progressBarInner.style.width = "0%"

    // 執行批量處理
    for (let i = 0; i < tasks.length; i++) {
      const { name, title, desc } = tasks[i]
      const percent = Math.round(((i + 1) / tasks.length) * 100)
      progressLabel.textContent = `正在處理 ${i + 1}/${tasks.length}: ${name} (${percent}%)`
      progressBarInner.style.width = `${percent}%`

      try {
        console.log(`🚀 批量處理第${i + 1}/${tasks.length}：${name}`)
        await processSingleLanguage(name, title, desc)
        console.log(`✅ 批量完成「${name}」`)
      } catch (e) {
        console.error(`❌ 批量處理「${name}」失敗：`, e)
      }
    }

    progressLabel.textContent = "🎉 批量執行完成！"
    setTimeout(() => {
      closeBulkModal()
      // 重置界面
      document.getElementById("qayt-bulk-only-textarea").style.display = "block"
      document.getElementById("qayt-bulk-only-textarea").value = ""
      document.querySelector(".qayt-bulk-modal-buttons").style.display = "flex"
      document.querySelector(".qayt-bulk-description").style.display = "block"
      document.querySelector(".qayt-warning-box").style.display = "flex"
      progressLabel.style.display = "none"
      progressBarOuter.style.display = "none"
    }, 2000)
  }

  /** 處理單一語言（從原本的 handleAll 抽取出來） **/
  async function processSingleLanguage(name, title, desc) {
    forceCloseAllDialogs()
    await new Promise((r) => setTimeout(r, 500))
    ;(await waitFor({ selector: "//ytcp-button[contains(., '新增語言')]", xpath: true })).click()
    const dlg = await waitFor({ selector: "#dialog[role='dialog']" })
    ;(await waitFor({ selector: `//tp-yt-paper-item[contains(.,'${name}')]`, context: dlg, xpath: true })).click()

    const rowEl = await waitFor({
      selector: `//ytgn-video-translation-row[.//div[contains(@class,'language-text') and normalize-space(.)='${name}']]`,
      xpath: true,
    })
    const metadataCell = await waitFor({
      selector: ".//td[contains(@class,'tablecell-metadata')]",
      context: rowEl,
      xpath: true,
    })
    const hoverCell = await waitFor({
      selector: ".//ytgn-video-translation-hover-cell",
      context: metadataCell,
      xpath: true,
    })

    rowEl.focus()
    hoverCell.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
    hoverCell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
    hoverCell.setAttribute("is-hovered", "")
    await new Promise((r) => setTimeout(r, 300))

    const addBtn = [...hoverCell.querySelectorAll("ytcp-icon-button,ytcp-button")].find((btn) =>
      ["新增", "Add"].includes(btn.getAttribute("aria-label")),
    )
    if (!addBtn) throw new Error("找不到新增按鈕")
    addBtn.click()

    const editorDialog = await waitFor({
      selector: "#metadata-editor[opened], tp-yt-paper-dialog[opened]",
      timeout: 8000,
    })
    if (editorDialog.hasAttribute("aria-hidden")) editorDialog.removeAttribute("aria-hidden")
    document.querySelectorAll("#metadata-editor, tp-yt-paper-dialog").forEach((d) => {
      if (d !== editorDialog) {
        d.style.display = "none"
        d.removeAttribute("opened")
      }
    })

    await new Promise((r) => setTimeout(r, 1000))

    const titleEl = await waitFor({ selector: "#translated-title textarea", context: editorDialog, timeout: 3000 })
    titleEl.focus()
    await new Promise((r) => setTimeout(r, 200))
    titleEl.select()
    titleEl.value = title
    titleEl.dispatchEvent(new Event("input", { bubbles: true }))
    titleEl.dispatchEvent(new Event("change", { bubbles: true }))

    if (desc) {
      const descEl = editorDialog.querySelector("#translated-description textarea")
      if (descEl) {
        descEl.focus()
        await new Promise((r) => setTimeout(r, 200))
        descEl.value = desc
        descEl.dispatchEvent(new Event("input", { bubbles: true }))
        descEl.dispatchEvent(new Event("change", { bubbles: true }))
      }
    }
    await new Promise((r) => setTimeout(r, 800))

    const publishBtn = await waitFor({ selector: "#publish-button", context: editorDialog, timeout: 5000 })
    publishBtn.click()
    await new Promise((r) => setTimeout(r, 2000))

    hoverCell.removeAttribute("is-hovered")
  }

  /** 建立單一語言列 **/
  function createLangRow(name, custom = false) {
    const row = createEl("div", { className: "qayt-lang-row" })
    const header = createEl("div", { className: "qayt-lang-header" })
    const details = createEl("div", { className: "qayt-lang-details" })

    const safeName = name.replace(/[^a-zA-Z0-9]/g, "")
    const cb = createEl("input", {
      type: "checkbox",
      className: "qayt-checkbox",
      checked: true,
      id: `qayt-cb-${safeName}`,
    })
    const expandBtn = createEl("button", { className: "qayt-expand-btn", textContent: "▶" })
    const toggleDetails = (e) => {
      e.stopPropagation()
      row.classList.toggle("expanded")
      expandBtn.textContent = row.classList.contains("expanded") ? "▼" : "▶"
    }
    expandBtn.addEventListener("click", toggleDetails)

    const lbl = createEl("label", { className: "qayt-lang-name", textContent: name })
    lbl.addEventListener("click", toggleDetails)

    const titleInput = createEl("input", {
      className: "qayt-title-input",
      placeholder: "標題 (必填)",
      id: `qayt-title-${safeName}`,
    })
    const descTextarea = createEl("textarea", {
      className: "qayt-desc-textarea",
      placeholder: "簡介 (選填)",
      rows: 3,
      id: `qayt-desc-${safeName}`,
    })
    details.append(titleInput, descTextarea)

    const delBtn = createEl("button", { className: "qayt-delete-lang", textContent: "×" })
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      row.remove()
      saveLangs(window.chrome)
    })

    if (custom) {
      row.classList.add("editing")
      const wrap = createEl("div", { className: "qayt-input-wrapper" })
      const inp = createEl("input", {
        className: "qayt-custom-input",
        placeholder: "語言名稱",
        value: name,
        id: `qayt-custom-input-${Date.now()}`,
      })
      const ok = createEl("button", { className: "qayt-confirm-lang", textContent: "✓" })
      ok.addEventListener("click", () => {
        const v = inp.value.trim()
        if (!v) {
          row.remove()
          saveLangs(window.chrome)
          return
        }
        row.dataset.name = v
        lbl.textContent = v
        row.classList.remove("editing")
        saveLangs(window.chrome)
      })
      wrap.append(inp, ok)
      header.append(cb, expandBtn, wrap, delBtn)
    } else {
      row.dataset.name = name
      header.append(cb, expandBtn, lbl, delBtn)
    }

    row.append(header, details)
    return row
  }

  /** 填充已儲存清單 **/
  async function populateList(chrome) {
    const langs = await loadLangs(chrome)
    const existSet = new Set(
      [...document.querySelectorAll(".language-text")].map((el) => el.innerText.replace(/$$.*$$/, "").trim()),
    )
    const container = document.getElementById("qayt-langs-container")
    removeAll(container)
    langs.forEach((l) => {
      const row = createLangRow(l, false)
      if (existSet.has(l)) {
        row.classList.add("disabled")
        row.querySelector(".qayt-checkbox").checked = false
      }
      container.append(row)
    })
    document.getElementById("qayt-master-checkbox").checked = true
  }

  /** 建立原有的 Modal - 添加語言名稱重要提醒 **/
  function createModal() {
    if (backdrop) return
    backdrop = createEl("div", { id: "qayt-modal-backdrop" })
    modal = createEl("div", { id: "qayt-modal-content" })

    const h2 = createEl("h2", { textContent: "🚀 語言快速工具" })

    // 添加語言名稱重要提醒（與批量指令相同）
    const warningBox = createEl("div", {
      className: "qayt-warning-box",
      innerHTML: `
        <div class="qayt-warning-icon">⚠️</div>
        <div class="qayt-warning-content">
          <strong>重要提醒：</strong>語言名稱必須與 YouTube 新增語言選項中的名稱完全相同，包括所有符號和括號！
          <br><span class="qayt-warning-example">例如：使用「中文（簡體）」而不是「中文简体」或「中文(簡體)」</span>
        </div>
      `,
    })

    // 添加語言參考指南
    const languageGuide = createEl("div", {
      className: "qayt-bulk-description",
      innerHTML: `
        <div class="qayt-lang-reminder">
          <strong>📝 常見語言名稱參考：</strong>
          <span class="qayt-lang-tag">英文</span>
          <span class="qayt-lang-tag">中文（簡體）</span>
          <span class="qayt-lang-tag">中文（繁體）</span>
          <span class="qayt-lang-tag">日文</span>
          <span class="qayt-lang-tag">韓文</span>
          <span class="qayt-lang-tag">法文</span>
          <span class="qayt-lang-tag">德文</span>
          <span class="qayt-lang-tag">西班牙文</span>
          <span class="qayt-lang-tag">葡萄牙文</span>
          <span class="qayt-lang-tag">俄文</span>
          <span class="qayt-lang-tag">義大利文</span>
          <span class="qayt-lang-tag">印地文</span>
          <span class="qayt-lang-tag">阿拉伯文</span>
          <span class="qayt-lang-tag">孟加拉文</span>
        </div>
      `,
    })

    const h3 = createEl("h3", { textContent: "選擇語言並展開填寫標題與簡介" })

    // 全選／重設
    const ctrl = createEl("div", { id: "qayt-global-controls" })
    const masterCb = createEl("input", { type: "checkbox", id: "qayt-master-checkbox" })
    const masterLb = createEl("label", { htmlFor: "qayt-master-checkbox", textContent: " 全選／取消全選" })
    masterCb.addEventListener("change", (e) => {
      modal
        .querySelectorAll("#qayt-langs-container .qayt-checkbox:not(:disabled)")
        .forEach((cb) => (cb.checked = e.target.checked))
    })
    const resetBtn = createEl("button", { id: "qayt-reset-btn", textContent: "↺ 重設預設" })
    resetBtn.addEventListener("click", async () => {
      if (confirm("重設為預設語言？自訂將遺失。")) {
        await window.chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_LANGS })
        await populateList(window.chrome)
      }
    })
    ctrl.append(masterCb, masterLb, resetBtn)

    // 語言列表 & 按鈕
    const list = createEl("div", { id: "qayt-langs-container" })
    const addCustom = createEl("button", { id: "qayt-add-custom-btn", textContent: "⊕ 新增自訂語言" })
    addCustom.addEventListener("click", () => {
      list.append(createLangRow("", true))
      saveLangs(window.chrome)
    })

    const progressLabel = createEl("div", { className: "qayt-progress-label", textContent: "準備中…" })
    const barOuter = createEl("div", { className: "qayt-progress-bar-outer" })
    const barInner = createEl("div", { className: "qayt-progress-bar-inner" })
    progressLabel.style.display = "none"
    barOuter.style.display = "none"
    barOuter.append(barInner)

    const btnBar = createEl("div", { className: "qayt-modal-buttons" })
    const btnCancel = createEl("button", { id: "qayt-cancel-btn", textContent: "關閉" })
    const btnOk = createEl("button", { id: "qayt-confirm-btn", textContent: "開始新增" })
    btnCancel.addEventListener("click", closeModal)
    btnOk.addEventListener("click", () => handleAll(window.chrome))
    btnBar.append(btnCancel, btnOk)

    // 修改元素順序，將警告提醒放在最上方
    modal.append(h2, warningBox, languageGuide, h3, ctrl, progressLabel, barOuter, list, addCustom, btnBar)
    backdrop.append(modal)
    document.body.append(backdrop)
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal()
    })
  }

  function openModal(chrome) {
    createModal()
    populateList(chrome)
    backdrop.style.display = "flex"
  }
  function closeModal() {
    if (backdrop) backdrop.style.display = "none"
  }

  /** 處理並新增所有翻譯（原有功能）- 添加確認提醒 **/
  async function handleAll(chrome) {
    await saveLangs(chrome)
    const rows = Array.from(document.querySelectorAll("#qayt-langs-container .qayt-lang-row"))
    const tasks = []
    for (const row of rows) {
      const cb = row.querySelector(".qayt-checkbox")
      if (!row.classList.contains("disabled") && cb.checked) {
        tasks.push({
          name: row.dataset.name,
          title: row.querySelector(".qayt-title-input").value.trim(),
          desc: row.querySelector(".qayt-desc-textarea").value.trim(),
        })
      }
    }
    for (const { name, title } of tasks) {
      if (!title) return alert(`請為「${name}」填入標題或取消勾選。`)
    }
    if (!tasks.length) return alert("未選擇任何語言。")

    // 添加語言名稱驗證提醒（與批量指令相同）
    const langNames = tasks.map((task) => task.name).join("、")
    const confirmMessage = `即將處理 ${tasks.length} 個語言：${langNames}\n\n⚠️ 請確認語言名稱與 YouTube 新增語言選項完全相同（包括符號）\n\n確定要執行嗎？`

    if (!confirm(confirmMessage)) return

    // 隱藏界面，顯示進度
    document.getElementById("qayt-global-controls").style.display = "none"
    document.getElementById("qayt-langs-container").style.display = "none"
    document.getElementById("qayt-add-custom-btn").style.display = "none"
    document.querySelector(".qayt-modal-buttons").style.display = "none"
    document.querySelector(".qayt-warning-box").style.display = "none"
    document.querySelector(".qayt-bulk-description").style.display = "none"

    const progressLabel = modal.querySelector(".qayt-progress-label")
    const progressBarOuter = modal.querySelector(".qayt-progress-bar-outer")
    const progressBarInner = modal.querySelector(".qayt-progress-bar-inner")
    progressLabel.style.display = "block"
    progressBarOuter.style.display = "block"
    progressBarInner.style.width = "0%"

    for (let i = 0; i < tasks.length; i++) {
      const { name, title, desc } = tasks[i]
      const percent = Math.round(((i + 1) / tasks.length) * 100)
      progressLabel.textContent = `處理 ${i + 1}/${tasks.length} (${percent}%)`
      progressBarInner.style.width = `${percent}%`

      try {
        console.log(`🚀 處理第${i + 1}/${tasks.length}：${name}`)
        await processSingleLanguage(name, title, desc)
        console.log(`✅ 完成「${name}」`)
      } catch (e) {
        console.error(`❌ 處理「${name}」失敗：`, e)
      }
    }

    progressLabel.textContent = "全部完成！"
    setTimeout(() => {
      closeModal()
      // 重置界面
      document.querySelector(".qayt-warning-box").style.display = "flex"
      document.querySelector(".qayt-bulk-description").style.display = "block"
    }, 800)
  }

  /** 初始化按鈕 **/
  async function init() {
    try {
      const anchor = await waitFor({ selector: "//ytcp-button[contains(., '新增語言')]", xpath: true, timeout: 8000 })
      if (document.getElementById("quick-add-title-btn")) return

      // 原有的語言快速工具按鈕
      const btn = createEl("button", { id: "quick-add-title-btn", textContent: "🚀 語言快速工具" })
      btn.addEventListener("click", () => openModal(window.chrome))

      // 新增的批量指令按鈕
      const bulkBtn = createEl("button", { id: "bulk-command-btn", textContent: "⚡ 批量指令" })
      bulkBtn.addEventListener("click", () => openBulkModal(window.chrome))

      // 新增的批量修改按鈕
      const editBtn = createEl("button", { id: "bulk-edit-btn", textContent: "✏️ 批量修改" })
      editBtn.addEventListener("click", () => openBulkEditModal(window.chrome))

      anchor.parentNode.insertBefore(btn, anchor.nextSibling)
      anchor.parentNode.insertBefore(bulkBtn, btn.nextSibling)
      anchor.parentNode.insertBefore(editBtn, bulkBtn.nextSibling)
    } catch (e) {
      console.error("初始化失敗：", e)
    }
  }

  let lastUrl = location.href
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      if (lastUrl.includes("/translations")) setTimeout(() => init(), 800)
    }
  }).observe(document.body, { childList: true, subtree: true })

  if (location.href.includes("/translations")) setTimeout(() => init(), 800)
})()
