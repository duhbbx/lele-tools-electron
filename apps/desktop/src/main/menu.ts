import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'

function openSettings(): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu:open-settings')
}

export function setupMenu(): void {
  const isMac = process.platform === 'darwin'

  const settingsItem: MenuItemConstructorOptions = {
    label: '设置…',
    accelerator: 'CmdOrCtrl+,',
    click: openSettings,
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: '乐乐的工具箱',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              settingsItem,
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          } as MenuItemConstructorOptions,
        ]
      : [
          {
            label: '文件',
            submenu: [
              settingsItem,
              { type: 'separator' as const },
              { role: 'quit' as const, label: '退出' },
            ],
          } as MenuItemConstructorOptions,
        ]),
    { role: 'editMenu' as const },
    { role: 'viewMenu' as const },
    { role: 'windowMenu' as const },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
