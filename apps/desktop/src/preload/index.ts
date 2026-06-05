import { contextBridge } from 'electron'

// Task 5 / Task 9 往这里加 store / ai 桥
const api = {}

contextBridge.exposeInMainWorld('api', api)
