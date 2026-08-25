<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import "./fonts/fonts.css";

interface ProductSpecRow {
  key: string
  value: string
}

interface ProductData {
  logoText: string
  productName: string
  subtitle: string
  specifications: ProductSpecRow[]
}

const defaultProduct: ProductData = {
  logoText: 'Logo',
  productName: 'Tytuł',
  subtitle: '',
  specifications: [],
}

const product = reactive<ProductData>({ ...defaultProduct, specifications: [...defaultProduct.specifications] })
const imagePreview = ref<string | null>(null)
const logoPreview = ref<string | null>(null)
const specImageUrls = ref<string[]>([])
const certificateImageUrls = ref<string[]>([])
const phoneNumbers = ref<string[]>([])
const distributorCredentials = reactive({
  companyName: '',
  phoneNumbers: [] as Array<{ number: string }>,
  emailAddress: '',
})
const currentRouteHasResource = ref(false)
const specImageAssets = import.meta.glob(
  '/public/resources/*/specImg/*.{png,jpg,jpeg,webp,gif,avif}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>
const certificateImageAssets = import.meta.glob(
  '/public/resources/*/certificates/*.{png,jpg,jpeg,webp,gif,avif}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>
const certificateImageRows = computed(() => [
  certificateImageUrls.value.slice(0, 5),
  certificateImageUrls.value.slice(5),
].filter((row) => row.length > 0))

const resolveResourceFolder = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const pathname = window.location.pathname.replace(/\/+$/, '')
  if (!pathname || pathname === '/') {
    return null
  }

  const folderMatch = pathname.match(/^\/resources\/[^/]+/)
  if (!folderMatch) {
    return null
  }

  return folderMatch[0]
}

const loadPhoneNumbers = async () => {
  try {
    const response = await fetch('/resources/phone_numbers.txt')
    if (!response.ok) {
      return
    }

    const text = await response.text()
    phoneNumbers.value = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch (error) {
    console.error('Failed to load phone numbers:', error)
  }
}

const loadDistributorCredentials = async () => {
  try {
    const response = await fetch('/resources/credentials.json')
    if (!response.ok) {
      return
    }

    const json = (await response.json()) as {
      companyName?: string
      phoneNumbers?: Array<{ number?: string }>
      emailAddress?: string
    }

    distributorCredentials.companyName = typeof json.companyName === 'string' ? json.companyName : ''
    distributorCredentials.phoneNumbers = Array.isArray(json.phoneNumbers)
      ? json.phoneNumbers.filter((entry): entry is { number: string } => Boolean(entry && typeof entry.number === 'string'))
      : []
    distributorCredentials.emailAddress = typeof json.emailAddress === 'string' ? json.emailAddress : ''
  } catch (error) {
    console.error('Failed to load distributor credentials:', error)
  }
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

  loadPhoneNumbers()
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
  if (typeof json.logoText === 'string') {
    product.logoText = json.logoText
  }

  if (typeof json.productName === 'string') {
    product.productName = json.productName
  }

  if (typeof json.subtitle === 'string') {
    product.subtitle = json.subtitle
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


</script>

<template>
  <main class="page-shell">
    <article class="a4-card" aria-label="Product catalogue card template">
      <section class="image-panel">
        <div v-if="!currentRouteHasResource" class="upload-top">
          <label class="upload-button">
            Upload image
            <input type="file" accept="image/*" @change="onImageUpload" />
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

        <div class="meta-block">
          <h1>{{ product.productName }}</h1>
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
:root {
  font-family: "Oswald Bold", "Arial Narrow", sans-serif;
  color: #111827;
  background: #e5e7eb;
  line-height: 1.4;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

html, body, #app {
  margin: 0;
  min-height: 100%;
  min-height: 100vh;
}

body {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #dfe6ec 0%, #bfc9d3 100%);
}

.page-shell {
  padding: 24px;
}

.a4-card {
  width: 210mm;
  min-height: 297mm;
  background-color: #ffffff;
  background-image: url('./background.jpg');
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.image-panel {
  position: relative;
  background: transparent;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;
  min-height: 100%;
}

.upload-top {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 3;
}

.upload-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid #0f172a;
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
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

.upload-button-small {
  min-height: 32px;
  padding: 8px 12px;
  font-size: 10px;
  letter-spacing: 0.06em;
}

.accent {
  background: #111827;
  color: #f8fafc;
  border-color: #111827;
}

.image-frame,
.image-placeholder {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  border-radius: 0;
}

.image-frame {
  overflow: hidden;
  background: transparent;
}

.image-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  transform: scale(1.12);
  transform-origin: center center;
}

.image-placeholder {
  color: #475569;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.image-subtitle {
  flex-shrink: 0;
  padding: 12px 16px 14px;
  background: rgba(255, 255, 255, 0.60);
  color: #000000;
  font-size: 44px;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  white-space: pre-line;
}

.info-panel {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.85);
  padding: 20px 20px 16px;
}

.distributor-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 4px;
  padding-bottom: 20px;
}

.distributor-logo {
  width: 143px;
  height: 65px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  transform: translateY(-5px);
}

.distributor-logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.distributor-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  text-align: right;
}

.distributor-name {
  width: 100%;
  color: #111827;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.25;
  text-align: right;
}

.distributor-contact-list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.distributor-contact-item {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  color: #0f172a;
  font-family: "Segoe UI", "Arial Narrow", sans-serif;
  font-size: 15px;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.distributor-contact-item img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}

.meta-block {
  padding: 24px 0 24px;
  border: double;
  background:white;
}

.eyebrow {
  margin: 0 0 10px;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.92);
}

h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1;
  letter-spacing: -0.02em;
  font-weight: bold;
  font-style: italic;
  text-align: center;
  color: #f16b1d;
}

.spec-image-row {
  display: flex;
  align-items: center;
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
  max-width: 100%;
}

.certificate-image-line:first-child {
  width: 100%;
  justify-content: space-between;
}

.certificate-image-line img {
  display: block;
  width: auto;
  max-width: 100%;
  height: 58px;
  object-fit: contain;
}

.specifications-header {
  margin: 16px 0 10px;
  color: #111827;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: none;
}

.contact-block {
  margin: 8px 0 12px;
  padding: 8px 4px;
}

.contact-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.contact-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #0f172a;
  font-family: "Segoe UI", "Arial Narrow", sans-serif;
  font-weight: 400;
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: 0.04em;
}

.contact-block img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex-shrink: 0;
}

.table-wrap {
  border: 1px solid #dfe7ee;
  overflow: hidden;
  background: #fff;
}

table {
  width: 100%;
  border-collapse: collapse;
}

tr + tr {
  border-top: 1px solid #e2e8f0;
}

th, td {
  padding: 3px 8px;
  text-align: left;
  vertical-align: middle;
  font-size: 14px;
  line-height: 1.35;
}

th {
  width: 49%;
  color: #1f2937;
  font-weight: 700;
  background: linear-gradient(180deg, #ffc40a 0%, #fc0008 100%);
  border-right: 1px solid #dbe7f1;
  text-align: left;
}

td {
  width: 33.33%;
  color: #f16b1d;
  font-weight: 500;
  text-align: center;
  background: rgba(255, 255, 255, 0.85);
}

@media (max-width: 780px) {
  .page-shell {
    padding: 12px;
  }

  .a4-card {
    width: min(100%, 210mm);
    min-height: auto;
    grid-template-columns: 1fr;
  }

  .image-panel {
    min-height: 250px;
  }

  .image-frame,
  .image-placeholder {
    height: 260px;
    flex: none;
  }
}

@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  .page-shell {
    padding: 0;
  }

  .a4-card {
    width: 210mm;
    height: 297mm;
    min-height: 0;
    grid-template-columns: 1.15fr 1fr;
    box-shadow: none;
    overflow: hidden;
  }

  .image-panel {
    min-height: 0;
    height: 100%;
  }

  .image-frame,
  .image-placeholder {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
  }

  .image-frame img {
    transform: none;
  }

  .image-subtitle {
    flex: 0 0 auto;
  }
}
</style>
