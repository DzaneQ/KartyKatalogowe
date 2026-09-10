<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import backgroundImage from './background.jpg'
import './fonts/fonts.css'

interface ProductSpecRow {
  key: string
  value: string
}

interface CollectiveProduct {
  slug: string
  productName: string
  specifications: ProductSpecRow[]
  imageUrl: string
  heightMm?: number
  galleryScale?: number
}

type ProductJson = {
  productName?: string
  name?: string
  specifications?: unknown
  details?: unknown
  order?: number
}

const productPreviewAssets = import.meta.glob(
  '/public/resources/collective/*/products/*/preview.png',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>
const specImageAssets = import.meta.glob(
  '/public/resources/collective/*/specImg/*.{png,jpg,jpeg,webp,gif,avif}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

const products = ref<CollectiveProduct[]>([])
const sharedSpecifications = ref<ProductSpecRow[]>([])
const productName = ref('')
const specImageEntries = ref<Array<{ url: string; isFire: boolean }>>([])
const distributorCredentials = reactive({
  companyName: '',
  phoneNumbers: [] as Array<{ number: string }>,
  emailAddress: '',
})
const productsWithSpecifications = computed(() => products.value.filter((product) => product.specifications.length > 0))
const productTitleLines = computed(() => {
  const cleaned = productName.value.trim().split(/\s+/).filter(Boolean)

  if (cleaned.length <= 2) {
    return { firstLine: cleaned.join(' '), secondLine: '' }
  }

  return {
    firstLine: cleaned.slice(0, 2).join(' '),
    secondLine: cleaned.slice(2).join(' '),
  }
})
const productSpecificationRows = computed(() => {
  const rows = new Map<string, ProductSpecRow>()

  for (const product of productsWithSpecifications.value) {
    for (const specification of product.specifications) {
      if (!rows.has(specification.key)) {
        rows.set(specification.key, { key: specification.key, value: '' })
      }
    }
  }

  return [...rows.values()]
})
const logoPreview = ref('/resources/logo.png')

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

const formatChemicalValue = (value: string): string => value.replace(/_([0-9]+)/g, (_, digits: string) =>
  digits.split('').map((digit) => chemicalSubscripts[digit] ?? digit).join(''),
)

const parseHeightMmFromSpecifications = (rows: ProductSpecRow[]): number | undefined => {
  const heightRow = rows.find((row) => row.key.trim().toLowerCase() === 'całkowita wysokość')
  if (!heightRow) return undefined

  const match = heightRow.value.match(/[0-9]+(?:[.,][0-9]+)?/)
  if (!match) return undefined

  const parsed = Number.parseFloat(match[0].replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

const galleryImageStyle = (product: CollectiveProduct): Record<string, string> => ({
  transform: `scale(${1.5 * (product.galleryScale ?? 1)})`,
  transformOrigin: 'center center',
})

const normalizeSpecifications = (input: unknown): ProductSpecRow[] => {
  if (Array.isArray(input)) {
    return input
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const row = entry as Record<string, unknown>
        const key = typeof row.key === 'string' ? row.key : typeof row.label === 'string' ? row.label : ''
        const rawValue = typeof row.value === 'string' ? row.value : typeof row.val === 'string' ? row.val : String(row.value ?? '')
        return key ? { key, value: formatChemicalValue(rawValue) } : null
      })
      .filter((row): row is ProductSpecRow => Boolean(row))
  }

  if (input && typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: formatChemicalValue(typeof value === 'string' ? value : String(value ?? '')),
    }))
  }

  return []
}

const resourceFolder = (): string => {
  const pathname = window.location.pathname.replace(/\/+$/, '')
  return pathname.match(/^\/resources\/collective\/[^/]+/)?.[0] ?? '/resources/collective/ubl'
}

const slugFromAssetPath = (path: string): string => {
  const match = path.match(/\/products\/([^/]+)\/preview\.png$/)
  return match?.[1] ?? ''
}

const displayName = (slug: string): string => slug.toUpperCase()

type DistributorCredentialsData = {
  companyName?: string
  phoneNumbers?: Array<{ number?: string }>
  emailAddress?: string
}

const applyDistributorCredentials = (json: DistributorCredentialsData) => {
  distributorCredentials.companyName = typeof json.companyName === 'string' ? json.companyName : ''
  distributorCredentials.phoneNumbers = Array.isArray(json.phoneNumbers)
    ? json.phoneNumbers.filter((entry): entry is { number: string } => Boolean(entry && typeof entry.number === 'string'))
    : []
  distributorCredentials.emailAddress = typeof json.emailAddress === 'string' ? json.emailAddress : ''
}

const loadCredentials = async () => {
  try {
    const response = await fetch('/resources/credentials.json')
    if (!response.ok) return

    applyDistributorCredentials((await response.json()) as DistributorCredentialsData)
  } catch (error) {
    console.error('Failed to load distributor credentials:', error)
  }
}

const loadProducts = async () => {
  const folder = resourceFolder()
  const productEntries = Object.entries(productPreviewAssets)
    .filter(([path]) => path.startsWith(`/public${folder}/products/`))

  const productData = await Promise.all(productEntries.map(async ([path, imageUrl]) => {
    const slug = slugFromAssetPath(path)
    let json: ProductJson = {}

    try {
      const response = await fetch(`${folder}/products/${slug}/product.json`)
      const contentType = response.headers.get('content-type') ?? ''
      if (response.ok && contentType.includes('application/json')) {
        json = await response.json() as ProductJson
      }
    } catch (error) {
      console.error(`Failed to load product ${slug}:`, error)
    }

    const specifications = normalizeSpecifications(json.specifications ?? json.details)

    return {
      slug,
      productName: json.productName ?? json.name ?? displayName(slug),
      specifications,
      imageUrl,
      order: typeof json.order === 'number' ? json.order : Number.MAX_SAFE_INTEGER,
      heightMm: parseHeightMmFromSpecifications(specifications),
    }
  }))

  const maxHeight = Math.max(...productData.map((product) => product.heightMm ?? 0)) || 1

  products.value = productData
    .map((product) => ({
      ...product,
      galleryScale: product.heightMm ? product.heightMm / maxHeight : 1,
    }))
    .sort((first, second) => first.order - second.order)
}

const loadSharedSpecifications = async () => {
  try {
    const response = await fetch(`${resourceFolder()}/product.json`)
    if (response.ok) {
      const json = await response.json() as ProductJson
      productName.value = typeof json.productName === 'string' ? json.productName : ''
      sharedSpecifications.value = normalizeSpecifications(json.specifications ?? json.details)
    }
  } catch (error) {
    console.error('Failed to load collective specifications:', error)
  }
}

const loadSpecImages = () => {
  const folder = resourceFolder()
  const resourcePath = `/public${folder}/specImg/`
  specImageEntries.value = Object.entries(specImageAssets)
    .filter(([path]) => path.startsWith(resourcePath))
    .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
    .map(([path, imageUrl]) => {
      const fileName = path.split('/').pop() ?? ''
      const isFire = /^fire/i.test(fileName)
      return { url: imageUrl, isFire }
    })
}

onMounted(() => {
  loadCredentials()
  loadProducts()
  loadSharedSpecifications()
  loadSpecImages()
})
</script>

<template>
  <main class="page-shell">
    <article class="a4-card" aria-label="Collective product catalogue card">
      <img class="card-background" :src="backgroundImage" alt="" aria-hidden="true" />

      <section class="image-panel">
        <section class="product-gallery" aria-label="Products">
          <article v-for="product in products" :key="product.slug" class="gallery-item">
            <img :src="product.imageUrl" :alt="product.productName" :style="galleryImageStyle(product)" />
          </article>
        </section>
      </section>

      <aside class="info-panel">
        <section class="info-top-row">
          <div class="info-top-left">
            <header class="card-header">
              <h1>
                <span class="card-title-line card-title-line-first">{{ productTitleLines.firstLine }}</span>
                <span v-if="productTitleLines.secondLine" class="card-title-line card-title-line-second">{{ productTitleLines.secondLine }}</span>
              </h1>
            </header>

            <section v-if="specImageEntries.length" class="spec-image-row" aria-label="Product detail images">
              <img
                v-for="entry in specImageEntries"
                :key="entry.url"
                :src="entry.url"
                :class="entry.isFire ? 'fire-spec-image' : 'non-fire-spec-image'"
                alt=""
              />
            </section>
          </div>

          <footer class="distributor-footer" aria-label="Distributor credentials">
            <div v-if="distributorCredentials.companyName" class="distributor-name">
              {{ distributorCredentials.companyName }}
            </div>

            <div class="distributor-footer-row">
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
            </div>
          </footer>
        </section>

        <section class="info-bottom-row">
          <section v-if="productSpecificationRows.length" class="product-specifications">
            <p class="section-label">Informacje techniczne sprzętu:</p>
            <table class="product-table">
              <tbody>
                <tr v-for="row in productSpecificationRows" :key="row.key">
                  <th>{{ row.key }}</th>
                  <td v-for="product in productsWithSpecifications" :key="`${product.slug}-${row.key}`">
                    {{ product.specifications.find((specification) => specification.key === row.key)?.value ?? '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section v-if="sharedSpecifications.length" class="shared-section">
            <p class="section-label">Ogólne informacje techniczne:</p>
            <table class="shared-table">
              <tbody>
                <tr v-for="row in sharedSpecifications" :key="row.key">
                  <th>{{ row.key }}</th>
                  <td>{{ row.value }}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </section>
      </aside>
    </article>
  </main>
</template>

<style scoped>
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

html,
body {
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
  width: 210mm;
  min-height: 297mm;
  height: 297mm;
  padding: 0;
  margin: 0;
  overflow: visible;
}

.a4-card {
  position: relative;
  width: 210mm;
  min-height: 297mm;
  height: 297mm;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
  overflow: visible;
}

.card-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  z-index: 0;
  pointer-events: none;
}

.image-panel {
  position: relative;
  z-index: 1;
  flex: 0 0 45%;
  width: 100%;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
}

.product-gallery {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  align-content: center;
  justify-items: center;
  gap: 12px;
  margin: 0;
  background: transparent;
  border-bottom: 0;
}

.gallery-item {
  min-width: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111827;
  font-family: "Segoe UI", sans-serif;
  font-size: 8px;
  line-height: 1.1;
  text-align: center;
}

.gallery-item img {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 100%;
  padding: 0;
  object-fit: contain;
  mix-blend-mode: multiply;
  margin: 0;
}

.spec-image-row {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  min-height: 72px;
  margin-top: 0;
}

.spec-image-row img {
  display: block;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  height: 54px;
}

.spec-image-row img.non-fire-spec-image {
  transform: scale(0.9);
  transform-origin: left bottom;
}

.info-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.88);
  padding: 20px 20px 16px;
}

.info-top-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}

.info-top-left {
  flex: 1 1 auto;
  min-width: 0;
}

.card-header {
  display: block;
  width: 100%;
  padding: 8px 0 8px;
  border: double;
  background: #fff;
  text-align: center;
}

.card-header h1 {
  margin: 0;
  color: #f16b1d;
  font-size: 34px;
  line-height: 1.4;
  font-style: italic;
}

.card-title-line {
  display: block;
}

.card-title-line-first {
  white-space: normal;
}

.card-title-line-second {
  white-space: normal;
}

.info-bottom-row {
  display: flex;
  align-items: stretch;
  gap: 12px;
  width: 100%;
}

.product-specifications,
.shared-section {
  background: transparent;
  border: 0;
}

.product-specifications {
  width: 55%;
}

.shared-section {
  width: 45%;
}

.section-label {
  margin: 0 0 10px;
  color: #111827;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: none;
}

.product-table,
.shared-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: "Oswald Bold", "Arial Narrow", sans-serif;
  font-size: 8px;
  line-height: 1.12;
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
  padding: 5px 5px;
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
  background: #fff;
}

.distributor-footer {
  width: 45%;
  flex: 0 0 45%;
  min-width: 180px;
  display: flex;
  flex-wrap: nowrap;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 4px;
  padding-top: 10px;
  margin-top: 0;
  border-top: 0;
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

.distributor-footer-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
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

@media (max-width: 780px) {
  .page-shell {
    width: 100%;
    min-height: auto;
    height: auto;
    padding: 12px;
  }

  .a4-card {
    width: min(100%, 210mm);
    min-height: auto;
    height: auto;
  }

  .image-panel {
    min-height: auto;
    height: auto;
    flex-basis: auto;
  }

  .product-gallery {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .product-specifications {
    width: 100%;
  }

  .distributor-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-contacts {
    align-items: flex-start;
    text-align: left;
  }
}

@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  :root,
  html,
  body {
    width: 210mm;
    min-height: 297mm;
    height: 297mm;
    margin: 0;
    overflow: hidden;
    background: transparent;
  }

  body {
    display: block;
    place-items: initial;
    background: transparent;
  }

  .page-shell {
    width: 210mm;
    min-height: 297mm;
    height: 297mm;
    padding: 0;
    margin: 0;
    overflow: hidden;
  }

  .a4-card {
    width: 210mm;
    min-height: 297mm;
    height: 297mm;
    margin: 0;
    box-shadow: none;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: avoid;
    break-after: avoid;
  }

  .image-panel {
    flex: 0 0 45%;
    min-height: 170px;
    background: transparent;
    overflow: hidden;
  }

  .product-gallery {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    padding: 0;
    margin: 0;
    align-items: center;
    align-content: center;
  }

  .info-bottom-row {
    display: flex;
    width: 100%;
    align-items: stretch;
    gap: 12px;
  }

  .product-specifications {
    width: 55%;
    flex: 0 0 55%;
  }

  .shared-section {
    width: 45%;
    flex: 0 0 45%;
  }

  .distributor-footer {
    display: flex;
    flex-wrap: nowrap;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-end;
    gap: 4px;
    padding-bottom: 10px;
    margin-top: auto;
    max-width: 100%;
    box-sizing: border-box;
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

  .distributor-footer-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    width: 100%;
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

  .info-panel {
    background: rgba(255, 255, 255, 0.88);
    flex: 1 1 auto;
  }
}
</style>
