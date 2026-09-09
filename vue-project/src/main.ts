import { createApp } from 'vue'
import CollectiveCard from './CollectiveCard.vue'
import IndividualCard from './IndividualCard.vue'

const isCollectiveResource = window.location.pathname.startsWith('/resources/collective/')

createApp(isCollectiveResource ? CollectiveCard : IndividualCard).mount('#app')
