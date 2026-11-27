import { useEffect, useRef, useState } from 'react'
import { AppDialog, useAppDialog } from './components/AppDialog'
import { NewSongDialog } from './components/NewSongDialog'
import { SongbookDialog } from './components/SongbookDialog'
import { MicCheck } from './components/MicCheck'
import { RecordScreen } from './components/RecordScreen'
import { Snackbar } from './components/ui/Snackbar'
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
  const dialog = useAppDialog()
  const [naming, setNaming] = useState(false)
  const [songbookOpen, setSongbookOpen] = useState(false)
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
      if (action === 'micCheck') setScreen('micCheck')
      else if (!onboarded) return
      else if (action === 'newSong') setNaming(true)
      else if (action === 'open') void tabs.open()
      else if (action === 'songbook') setSongbookOpen(true)
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
          onSongbook={() => setSongbookOpen(true)}
        />
      ))}
      {!showMicCheck && tabs.error && <p className="error app-error">{tabs.error}</p>}
      <Snackbar />
      {showMicCheck && <MicCheck mic={mic} onboarding={!onboarded} onDone={finishMicCheck} />}
      {dialog.section && (
        <AppDialog section={dialog.section} onSection={dialog.show} onClose={dialog.close} />
      )}
      {naming && (
        <NewSongDialog
          onCreate={(name, artist, note) => {
            setNaming(false)
            void tabs.newSong(name, artist, note)
          }}
          onClose={() => setNaming(false)}
        />
      )}
      {songbookOpen && (
        <SongbookDialog
          openFolders={tabs.tabs.map((tab) => {
            const dir = tabs.info[tab.id]?.dir ?? tab.initial.dir
            // Basename only: openFolders is compared against the folder name under
            // the songs folder, not an arbitrary path.
            return dir.split(/[\\/]/).pop() ?? ''
          })}
          onOpen={(folder) => {
            setSongbookOpen(false)
            void tabs.openByName(folder)
          }}
          onNew={() => {
            setSongbookOpen(false)
            setNaming(true)
          }}
          onStart={(name, artist, note) => {
            setSongbookOpen(false)
            void tabs.newSong(name, artist, note)
          }}
          onClose={() => setSongbookOpen(false)}
        />
      )}
    </>
  )
}

export default App
