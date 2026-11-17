import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { openDB, requestPersistence } from './db/idb'
import './style.css'

openDB().catch((err) => console.error(err))
requestPersistence()

createApp(App).use(router).mount('#app')
