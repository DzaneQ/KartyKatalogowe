## Instrukcja

```sh
npm install
```

### Tryb dewelopera

```sh
npm run dev
```

### Tryb produkcyjny

```sh
npm run build
```

## Zasoby

Usuń suffix `.sample` dla folderu `public/resources.sample/`, a następnie dostosuj według wzoru podmieniając właściwości. Możesz dodawać nowe produkty dla indywidualnej karty jako `public/resources/individual/(nazwaProduktu)` bądź zbiorowej jako `public/resources/collective/(nazwaZbioruProdutków)/(nazwaProduktu)`.

Aby wyświetlić kartę z danymi, dopisz do URL `resources/individual/(nazwaProduktu)` by wyświetlić kartę indywidualną produktu bądź `resources/collective/(nazwaZbioruProduktów)` dla karty zbiorowej.