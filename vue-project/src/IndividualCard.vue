<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import backgroundImage from './background.jpg'
import "./fonts/fonts.css";
import './common.css'

interface ProductSpecRow {
  key: string
  value: string
}

interface ProductData {
  productName: string
  subtitle: string
  specifications: ProductSpecRow[]
}

const defaultProduct: ProductData = {
  productName: '',
  subtitle: '',
  specifications: [],
}

const product = reactive<ProductData>({ ...defaultProduct, specifications: [...defaultProduct.specifications] })
const productData = ref<Record<string, unknown> | null>(null)
const imagePreview = ref<string | null>(null)
const logoPreview = ref<string | null>(null)
const isTitleInputFocused = ref(false)
const specImageUrls = ref<string[]>([])
const certificateImageUrls = ref<string[]>([])
const uploadedCertificateUrls = ref<string[]>([])
const distributorCredentials = reactive({
  companyName: '',
  phoneNumbers: [] as Array<{ number: string }>,
  emailAddress: '',
})
const currentRouteHasResource = ref(false)
const specImageAssets = import.meta.glob(
  '/public/resources/**/specImg/*.{png,jpg,jpeg,webp,gif,avif}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>
const certificateImageAssets = import.meta.glob(
  '/public/resources/**/certificates/*.{png,jpg,jpeg,webp,gif,avif}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>
const certificateImageRows = computed(() => {
  const rows: string[][] = []

  for (let index = 0; index < certificateImageUrls.value.length; index += 5) {
    rows.push(certificateImageUrls.value.slice(index, index + 5))
  }

  return rows
})
const hasProductTitle = computed(() => product.productName.trim().length > 0)

type DistributorCredentialsData = {
  companyName?: string
  phoneNumbers?: Array<{ number?: string }>
  emailAddress?: string
}

const resolveResourceFolder = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const pathname = window.location.pathname.replace(/\/+$/, '')
  if (!pathname || pathname === '/') {
    return null
  }

  const folderMatch = pathname.match(/^\/resources\/[^/]+\/[^/]+/)
  if (!folderMatch) {
    return null
  }

  return folderMatch[0]
}

const loadDistributorCredentials = async () => {
  try {
    const response = await fetch('/resources/credentials.json')
    if (!response.ok) {
      return
    }

    applyDistributorCredentials((await response.json()) as DistributorCredentialsData)
  } catch (error) {
    console.error('Failed to load distributor credentials:', error)
  }
}

const applyDistributorCredentials = (json: DistributorCredentialsData) => {
  distributorCredentials.companyName = typeof json.companyName === 'string' ? json.companyName : ''
  distributorCredentials.phoneNumbers = Array.isArray(json.phoneNumbers)
    ? json.phoneNumbers.filter((entry): entry is { number: string } => Boolean(entry && typeof entry.number === 'string'))
    : []
  distributorCredentials.emailAddress = typeof json.emailAddress === 'string' ? json.emailAddress : ''
}

const loadRouteProductData = async () => {
  const resourceFolder = resolveResourceFolder()
  if (!resourceFolder) {
    return
  }

  try {
    const response = await fetch(`${resourceFolder}/product.json`)
    if (!response.ok) {
      return
    }

    const json = (await response.json()) as Record<string, unknown>
    applyProductData(json)
    imagePreview.value = `${resourceFolder}/preview.png`
    logoPreview.value = '/resources/logo.png'
    const resourcePath = `/public${resourceFolder}/specImg/`
    specImageUrls.value = Object.entries(specImageAssets)
      .filter(([path]) => path.startsWith(resourcePath))
      .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
      .map(([, imageUrl]) => imageUrl)
    const certificatePath = `/public${resourceFolder}/certificates/`
    certificateImageUrls.value = Object.entries(certificateImageAssets)
      .filter(([path]) => path.startsWith(certificatePath))
      .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
      .map(([, imageUrl]) => imageUrl)
  } catch (error) {
    console.error('Failed to load route product data:', error)
  }
}

onMounted(() => {
  const resourceFolder = resolveResourceFolder()
  currentRouteHasResource.value = Boolean(resourceFolder)

  loadDistributorCredentials()

  if (resourceFolder) {
    loadRouteProductData()
  }
})

const chemicalSubscripts: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
}

const formatChemicalValue = (value: string): string => {
  if (!value) {
    return value
  }

  return value.replace(/_([0-9]+)/g, (_, digits: string) =>
    digits
      .split('')
      .map((digit) => chemicalSubscripts[digit] ?? digit)
      .join(''),
  )
}

const normalizeSpecifications = (input: unknown): ProductSpecRow[] => {
  if (Array.isArray(input)) {
    return input
      .map((entry) => {
        if (typeof entry === 'object' && entry !== null) {
          const row = entry as Record<string, unknown>
          const key = typeof row.key === 'string' ? row.key : typeof row.label === 'string' ? row.label : ''
          const rawValue = typeof row.value === 'string' ? row.value : typeof row.val === 'string' ? row.val : String(row.value ?? '')
          const value = formatChemicalValue(rawValue)
          return key ? { key, value } : null
        }

        return null
      })
      .filter((row): row is ProductSpecRow => Boolean(row && row.key))
  }

  if (input && typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: formatChemicalValue(typeof value === 'string' ? value : String(value ?? '')),
    }))
  }

  return []
}

const applyProductData = (json: Record<string, unknown>) => {
  productData.value = json

  if (typeof json.productName === 'string') {
    product.productName = json.productName
  }

  const subtitle = json.subtitle
  if (typeof subtitle === 'string') {
    product.subtitle = subtitle
  }

  if ('specifications' in json) {
    const rows = normalizeSpecifications(json.specifications)
    if (rows.length > 0) {
      product.specifications = rows
    }
  } else if ('details' in json) {
    const rows = normalizeSpecifications(json.details)
    if (rows.length > 0) {
      product.specifications = rows
    }
  }
}

const onImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  imagePreview.value = URL.createObjectURL(file)
}

const onLogoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  logoPreview.value = URL.createObjectURL(file)
}

const onCredentialsUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const json = JSON.parse(await file.text()) as DistributorCredentialsData
    applyDistributorCredentials(json)
  } catch (error) {
    console.error('Failed to load credentials file:', error)
  }
}

const onProductUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const json = JSON.parse(await file.text()) as Record<string, unknown>
    applyProductData(json)
    isTitleInputFocused.value = false
  } catch (error) {
    console.error('Failed to load product file:', error)
  }
}

const onCertificateDirectoryUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? []).filter((file) => file.type.startsWith('image/'))
  if (!files.length) return

  uploadedCertificateUrls.value.forEach((url) => URL.revokeObjectURL(url))
  uploadedCertificateUrls.value = files.map((file) => URL.createObjectURL(file))
  certificateImageUrls.value = [...uploadedCertificateUrls.value]
}


</script>

<template>
  <main class="page-shell">
    <article class="a4-card" aria-label="Product catalogue card template">
      <img class="card-background" :src="backgroundImage" alt="" aria-hidden="true" />
      <section class="image-panel">
        <div v-if="!currentRouteHasResource && !imagePreview" class="upload-top">
          <label class="upload-button">
            Załaduj obraz
            <input type="file" accept="image/*" @change="onImageUpload" />
          </label>
        </div>

        <div v-if="!currentRouteHasResource" class="default-resource-inputs">
          <label v-if="!productData" class="upload-button">
            Wczytaj JSON produktu
            <input type="file" accept=".json,application/json" @change="onProductUpload" />
          </label>
          <label v-if="!certificateImageUrls.length" class="upload-button">
            Wczytaj certyfikaty
            <input
              type="file"
              accept="image/*"
              multiple
              webkitdirectory
              directory
              @change="onCertificateDirectoryUpload"
            />
          </label>
        </div>

        <div v-if="imagePreview" class="image-frame">
          <img :src="imagePreview" alt="Product preview" />
        </div>
        <div v-else class="image-placeholder">
          <span>Zdjęcie</span>
        </div>

        <div v-if="product.subtitle" class="image-subtitle">
          {{ product.subtitle }}
        </div>
      </section>

      <aside class="info-panel">
        <footer class="distributor-footer" aria-label="Distributor credentials">
          <div v-if="distributorCredentials.companyName" class="distributor-name">
            {{ distributorCredentials.companyName }}
          </div>

          <div class="distributor-logo">
            <img :src="logoPreview || '/resources/logo.png'" alt="Distributor logo" />
          </div>

          <div class="distributor-details">
            <div v-if="distributorCredentials.phoneNumbers.length" class="distributor-contact-list">
              <div v-for="phone in distributorCredentials.phoneNumbers" :key="phone.number" class="distributor-contact-item">
                <img src="/resources/phone_icon.png" alt="Phone icon" />
                <span>{{ phone.number }}</span>
              </div>
            </div>

            <div v-if="distributorCredentials.emailAddress" class="distributor-contact-item">
              <img src="/resources/mail_icon.png" alt="Email icon" />
              <span>{{ distributorCredentials.emailAddress }}</span>
            </div>
          </div>
        </footer>

        <div class="card-header">
          <input
            v-if="!currentRouteHasResource && (!hasProductTitle || isTitleInputFocused)"
            v-model="product.productName"
            class="title-input"
            type="text"
            placeholder="Wpisz tytuł"
            aria-label="Tytuł produktu"
            @focus="isTitleInputFocused = true"
            @keydown.enter.prevent="isTitleInputFocused = false"
          />
          <h1 v-else-if="hasProductTitle">{{ product.productName }}</h1>
        </div>

        <div v-if="specImageUrls.length" class="spec-image-row" aria-label="Product detail images">
          <img
            v-for="imageUrl in specImageUrls"
            :key="imageUrl"
            :src="imageUrl"
            alt=""
          />
        </div>

        <div v-if="product.specifications.length" class="specifications-header">
          Informacje techniczne:
        </div>

        <div v-if="product.specifications.length" class="table-wrap">
          <table>
            <tbody>
              <tr v-for="row in product.specifications" :key="`${row.key}-${row.value}`">
                <th>{{ row.key }}</th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="certificateImageUrls.length" class="certificate-image-row" aria-label="Product certificates">
          <div v-for="(imageRow, rowIndex) in certificateImageRows" :key="rowIndex" class="certificate-image-line">
            <img
              v-for="imageUrl in imageRow"
              :key="imageUrl"
              :src="imageUrl"
              alt=""
            />
          </div>
        </div>

      </aside>
    </article>
  </main>
</template>

<style>
.a4-card {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
}

.image-panel {
  position: relative;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.upload-top {
  position: absolute;
  top: 16px;
  left: 16px;
}

.default-resource-inputs {
  position: absolute;
  top: 64px;
  left: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.upload-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid #0f172a;
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-size: 12px;;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.upload-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
}

.upload-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.image-frame,
.image-placeholder {
  flex: 1;
  display: grid;
  place-items: center;
}

.image-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: center center;
}

.image-placeholder {
  color: #475569;
  font-size: 22px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.image-subtitle {
  padding: 12px 16px 14px;
  background: rgba(255, 255, 255, 0.60);
  color: #000000;
  font-size: 44px;
  line-height: 1.25;
  text-align: center;
  white-space: pre-line;
}

.info-panel {
  position: relative;
  display: flex;
  flex-direction: column;
}

.distributor-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 4px;
  padding-bottom: 20px;
}

.card-header {
  padding: 18px 0 18px;
}

.title-input {
  display: block;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #f16b1d;
  font: inherit;
  font-size: 34px;
  font-style: italic;
  font-weight: bold;
  text-align: center;
}

.title-input::placeholder {
  color: #94a3b8;
  opacity: 1;
}

h1 {
  line-height: 1;
}

.spec-image-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.spec-image-row img {
  display: block;
  width: 100%;
  max-width: 31%;
  height: 72px;
  object-fit: contain;
}

.certificate-image-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}

.certificate-image-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.certificate-image-line img {
  flex: 1 1 0;
  display: block;
  width: 0;
  height: 58px;
  object-fit: contain;
}

.specifications-header {
  margin: 16px 0 10px;
  color: #111827;
  font-size: 23px;
  letter-spacing: 0.02em;
  text-transform: none;
}

.table-wrap {
  border: 1px solid #dfe7ee;
  overflow: hidden;
}

th, td {
  padding: 3px 8px;
  line-height: 1.35;
}

th {
  width: 49%;
}

td {
  width: 33.33%;
}

</style>
