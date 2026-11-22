import { useEffect, useRef, useState } from 'react'
import { HelpDialog } from './components/HelpDialog'
import { NewSongDialog } from './components/NewSongDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { MicCheck } from './components/MicCheck'
import { RecordScreen } from './components/RecordScreen'
import { Command, onCommand, useShortcutKeys } from './state/commands/commands'
import { syncKeymap } from './state/commands/keymap'
import { hasOnboarded, markOnboarded } from './state/ui/onboarding'
import { useMicrophone } from './state/transport/useMicrophone'
import { useTabs } from './state/tabs/useTabs'
import './App.css'

type Screen = 'micCheck' | 'record'

function App(): React.JSX.Element {
  const mic = useMicrophone()
  const [onboarded, setOnboarded] = useState(hasOnboarded)
  const [screen, setScreen] = useState<Screen>(onboarded ? 'record' : 'micCheck')
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const tabs = useTabs(onboarded)

  const showMicCheck = screen === 'micCheck' || mic.access === 'denied'
  const tabInfo = tabs.tabs.map((tab) => ({
    id: tab.id,
    name: tabs.info[tab.id]?.name ?? tab.initial.name
  }))

  const finishMicCheck = (): void => {
    if (!onboarded) {
      markOnboarded()
      setOnboarded(true)
    }
    setScreen('record')
  }

  useEffect(syncKeymap, [])
  useShortcutKeys()

  // App-wide commands. Song edits (undo, split…) are handled by the active tab.
  const menu = useRef<(action: Command) => void>(() => {})
  useEffect(() => {
    menu.current = (action) => {
      if (action === 'help') setHelpOpen(true)
      else if (action === 'settings') setSettingsOpen(true)
      else if (action === 'micCheck') setScreen('micCheck')
      else if (!onboarded) return
      else if (action === 'newSong') setNaming(true)
      else if (action === 'open') void tabs.open()
      else if (action === 'closeSong' && tabs.activeId) tabs.close(tabs.activeId)
      else if ((action === 'moveSongLeft' || action === 'moveSongRight') && tabs.activeId) {
        const at = tabs.tabs.findIndex((item) => item.id === tabs.activeId)
        tabs.move(tabs.activeId, action === 'moveSongLeft' ? at - 1 : at + 1)
      }
    }
  })
  useEffect(() => onCommand((action) => menu.current(action)), [])

  return (
    <>
      {/* Every open song stays mounted so switching tabs keeps its place and undo history. */}
      {tabs.tabs.map((tab) => (
        <RecordScreen
          key={tab.id}
          tabId={tab.id}
          initial={tab.initial}
          active={!showMicCheck && tab.id === tabs.activeId}
          tabs={tabInfo}
          mic={mic}
          onInfo={(info) => tabs.setInfo(tab.id, info)}
          onSwitch={tabs.switchTo}
          onMove={tabs.move}
          onClose={tabs.close}
          onNew={() => setNaming(true)}
        />
      ))}
      {!showMicCheck && tabs.error && <p className="error app-error">{tabs.error}</p>}
      {showMicCheck && <MicCheck mic={mic} onboarding={!onboarded} onDone={finishMicCheck} />}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {naming && (
        <NewSongDialog
          onCreate={(name) => {
            setNaming(false)
            void tabs.newSong(name)
          }}
          onClose={() => setNaming(false)}
        />
      )}
    </>
  )
}

export default App
