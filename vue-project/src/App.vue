<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

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
  subtitle: 'Podtytuł',
  specifications: [],
}

const product = reactive<ProductData>({ ...defaultProduct, specifications: [...defaultProduct.specifications] })
const imagePreview = ref<string | null>(null)
const logoPreview = ref<string | null>(null)
const currentRouteHasResource = ref(false)

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
    logoPreview.value = '/resources/logo.jpg'
  } catch (error) {
    console.error('Failed to load route product data:', error)
  }
}

onMounted(() => {
  const resourceFolder = resolveResourceFolder()
  currentRouteHasResource.value = Boolean(resourceFolder)

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
          <span>Image area</span>
        </div>
      </section>

      <aside class="info-panel">
        <header class="brand-header">
          <label v-if="!currentRouteHasResource" class="upload-button upload-button-small">
            Upload logo
            <input type="file" accept="image/*" @change="onLogoUpload" />
          </label>

          <div v-if="logoPreview" class="logo-box logo-box-image">
            <img :src="logoPreview" alt="Brand logo" />
          </div>
          <div v-else class="logo-box">
            {{ product.logoText }}
          </div>
        </header>

        <div class="meta-block">
          <h1>{{ product.productName }}</h1>
          <p class="subtitle">{{ product.subtitle }}</p>
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
      </aside>
    </article>
  </main>
</template>

<style>
:root {
  font-family: "Futura Bold Condensed", "Arial Narrow", sans-serif;
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
  background: #ffffff;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.image-panel {
  position: relative;
  background: linear-gradient(180deg, #edf2f7 0%, #dfe7ec 100%);
  padding: 0;
  display: flex;
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
  font-family: "Futura Bold Condensed", "Arial Narrow", sans-serif;
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
  height: 100%;
  min-height: 297mm;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  border-radius: 0;
}

.image-frame {
  overflow: hidden;
  background: #f8fafc;
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

.info-panel {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  padding: 20px 20px 16px;
}

.brand-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 2px solid #dfe7ee;
}

.logo-box {
  flex: 1;
  min-height: 72px;
  display: grid;
  place-items: center;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: center;
  padding: 8px 10px;
}

.logo-box-image {
  overflow: hidden;
  padding: 0;
}

.logo-box-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.meta-block {
  padding: 24px 0 12px;
}

.eyebrow {
  margin: 0 0 10px;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-family: "Futura Bold Condensed", sans-serif;
  font-size: 24px;
  line-height: 1;
  letter-spacing: -0.02em;
  font-weight: bold;
  font-style: italic;
  text-align: center;
  color: #111827;
}

.subtitle {
  margin: 8px 0 0;
  font-family: "Futura Bold Condensed", sans-serif;
  color: #ff0000;
  font-size: 16px;
  font-style: italic;
  line-height: 1.45;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-align: center;
  text-transform: uppercase;
}

.specifications-header {
  margin: 16px 0 10px;
  font-family: "Futura Bold Condensed", "Arial Narrow", sans-serif;
  color: #111827;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: none;
}

.table-wrap {
  border: 1px solid #dfe7ee;
  overflow: hidden;
  background: #fff;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-family: "Futura Bold Condensed", "Arial Narrow", sans-serif;
}

tr + tr {
  border-top: 1px solid #e2e8f0;
}

th, td {
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  font-family: "Futura Bold Condensed", "Arial Narrow", sans-serif;
  font-size: 10.5px;
  line-height: 1.35;
}

th {
  width: 60%;
  color: #1f2937;
  font-weight: 700;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  text-align: left;
}

td {
  width: 33.33%;
  color: #334155;
  font-weight: 500;
  text-align: center;
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
  }
}

@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }

  body {
    background: #fff;
  }

  .page-shell {
    padding: 0;
  }

  .a4-card {
    width: 210mm;
    min-height: 297mm;
    box-shadow: none;
  }
}
</style>
