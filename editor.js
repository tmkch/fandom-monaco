/* global monaco, browser, JSHINT */
require(['vs/editor/editor.main'], async () => {
  async function getBackgroundData () {
    return (await browser.runtime.getBackgroundPage()).data
  }

  async function getPageContent () {
    const data = await getBackgroundData()
    const response = await window.fetch(`${data.api}/api.php?action=query&titles=${data.title}&prop=revisions&rvprop=content&format=json&cb=${Math.floor(new Date().getTime() / 1000)}`, {
      cache: 'no-store'
    })
    const json = await response.json()
    const content = json.query.pages[Object.keys(json.query.pages)[0]].revisions ? json.query.pages[Object.keys(json.query.pages)[0]].revisions[0]['*'] : ''
    return content
  }

  function hideSpinner () {
    document.getElementsByClassName('overlay')[0].classList.add('hidden')
    setTimeout(() => {
      document.getElementsByClassName('overlay')[0].style.display = 'none'
      document.getElementsByClassName('spinner')[0].style.display = 'none'
    }, 500)
  }

  window.editorVisible = true
  const { title, url, lang, mode } = await getBackgroundData()
  console.log(mode)
  document.title = title
  document.getElementById('pagename').textContent = title
  document.getElementById('pagename').setAttribute('href', url)
  if (mode !== 'inspect') {
    document.getElementById('diff').style.display = 'block'
    document.getElementById('summary').style.display = 'inline-block'
    document.getElementById('diff-container').style.display = 'block'
  }
  window.previousContent = await getPageContent()

  if (lang === 'javascript') {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      (await (await window.fetch('./lib.d.ts')).text()),
      'lib.d.ts'
    )
  }

  window.editor = monaco.editor.create(document.getElementById('editor-container'), {
    value: window.previousContent,
    language: lang,
    theme: 'vs-dark',
    readOnly: true
  })

  if (lang === 'javascript') {
    JSHINT.jshint(window.editor.getValue(), {
      esversion: 5,
      curly: true,
      eqeqeq: true,
      freeze: true,
      futurehostile: true,
      latedef: true,
      nocomma: true,
      nonbsp: true,
      shadow: false,
      strict: 'implied',
      '-W117': true,
      unused: true,
      asi: true,
      eqnull: true
    })
    monaco.editor.setModelMarkers(window.editor.getModel(), 'jshint', (JSHINT.jshint.data().errors || []).map(e => {
      return {
        startLineNumber: e.line,
        startColumn: e.character,
        endLineNumber: e.line,
        endColumn: e.character,
        message: e.reason,
        severity: e.code.startsWith('E') ? monaco.Severity.Error : monaco.Severity.Warning
      }
    }))
  }

  hideSpinner()

  if (mode !== 'inspect') {
    window.editor.model.onDidChangeContent((event) => {
      if (window.editor.getValue() !== window.previousContent) {
        document.getElementById('publish').textContent = window.previousContent === '' ? 'Publikuj' : 'Zapisz'
      } else {
        document.getElementById('publish').textContent = 'Zamknij'
      }
      if (lang === 'javascript') {
        JSHINT.jshint(window.editor.getValue(), {
          esversion: 5,
          curly: true,
          eqeqeq: true,
          freeze: true,
          futurehostile: true,
          latedef: true,
          nocomma: true,
          nonbsp: true,
          shadow: false,
          strict: 'implied',
          '-W117': true,
          unused: true,
          asi: true,
          eqnull: true
        })
        monaco.editor.setModelMarkers(window.editor.getModel(), 'jshint', (JSHINT.jshint.data().errors || []).map(e => {
          return {
            startLineNumber: e.line,
            startColumn: e.character,
            endLineNumber: e.line,
            endColumn: e.character,
            message: e.reason,
            severity: e.code.startsWith('E') ? monaco.Severity.Error : monaco.Severity.Warning
          }
        }))
      }
    })

    window.diffEditor = monaco.editor.createDiffEditor(document.getElementById('diff-container'))

    window.editor.updateOptions({ readOnly: false })
  }

  window.addEventListener('resize', () => {
    window.editor.layout()
    if (mode !== 'inspect') {
      window.diffEditor.layout()
    }
  })

  if (mode !== 'inspect') {
    document.getElementById('diff').addEventListener('click', async () => {
      if (window.editorVisible) {
        window.editorVisible = false
        document.getElementById('editor-container').style.setProperty('flex', '0')
        document.getElementById('diff-container').style.setProperty('flex', '1')
        document.getElementById('diff').textContent = 'Edytuj'

        const originalModel = monaco.editor.createModel(window.previousContent, `text/${lang}`)
        const modifiedModel = monaco.editor.createModel(window.editor.getValue(), `text/${lang}`)

        window.diffEditor.setModel({
          original: originalModel,
          modified: modifiedModel
        })
      } else {
        window.editorVisible = true
        document.getElementById('editor-container').style.setProperty('flex', '1')
        document.getElementById('diff-container').style.setProperty('flex', '0')
        document.getElementById('diff').textContent = 'Różnica'
      }
      window.editor.layout()
      window.diffEditor.layout()
    })
  }

  document.getElementById('publish').addEventListener('click', () => {
    if (window.editor.getValue() !== window.previousContent && mode !== 'inspect') {
      // TODO: Check for 'editwarning' here
      // TODO: Also check for edit conflicts
      browser.runtime.sendMessage({
        type: 'make_edit',
        data: {
          text: window.editor.getValue(),
          summary: document.getElementById('summary').value
        }
      })
    } else {
      browser.runtime.sendMessage({
        type: 'close_editor'
      })
    }
  })
})
