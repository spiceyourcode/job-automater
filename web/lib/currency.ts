/**
 * Locale to currency mapping for location-aware currency display.
 * Based on CLDR (Common Locale Data Repository) standards.
 */
export const LOCALE_CURRENCY_MAP: Record<string, string> = {
  // Kenya
  "en-KE": "KES",
  "sw-KE": "KES",

  // United States
  "en-US": "USD",
  "es-US": "USD",

  // United Kingdom
  "en-GB": "GBP",
  "cy-GB": "GBP",
  "gd-GB": "GBP",

// Eurozone
  "de-DE": "EUR",
  "de-AT": "EUR",
  "de-CH": "CHF",
  "fr-FR": "EUR",
  "fr-BE": "EUR",
  "fr-CH": "CHF",
  "fr-LU": "EUR",
  "fr-MC": "EUR",
  "it-IT": "EUR",
  "it-CH": "CHF",
  "es-ES": "EUR",
  "es-MX": "MXN",
  "nl-NL": "EUR",
  "nl-BE": "EUR",
  "pl-PL": "PLN",
  "cs-CZ": "CZK",
  "sk-SK": "EUR",
  "hu-HU": "HUF",
  "ro-RO": "RON",
  "bg-BG": "BGN",
  "hr-HR": "EUR",
  "sl-SI": "EUR",
  "et-EE": "EUR",
  "lv-LV": "EUR",
  "lt-LT": "EUR",
  "fi-FI": "EUR",
  "sv-SE": "SEK",
  "da-DK": "DKK",
  "no-NO": "NOK",
  "is-IS": "ISK",
  "ga-IE": "EUR",
  "mt-MT": "EUR",
  "el-GR": "EUR",
  "el-CY": "EUR",

  // Africa
  "en-NG": "NGN",
  "ha-NG": "NGN",
  "yo-NG": "NGN",
  "ig-NG": "NGN",
  "en-ZA": "ZAR",
  "af-ZA": "ZAR",
  "zu-ZA": "ZAR",
  "xh-ZA": "ZAR",
  "en-GH": "GHS",
  "en-TZ": "TZS",
  "sw-TZ": "TZS",
  "en-UG": "UGX",
  "en-RW": "RWF",
  "en-ET": "ETB",
  "am-ET": "ETB",
  "en-ZW": "ZWL",
  "en-BW": "BWP",
  "en-MZ": "MZN",
  "pt-MZ": "MZN",
  "en-ZM": "ZMW",
  "en-MW": "MWK",
  "en-LS": "LSL",
  "en-SZ": "SZL",
  "en-NA": "NAD",
  "af-NA": "NAD",
  "en-MU": "MUR",
  "fr-MU": "MUR",
  "en-SC": "SCR",
  "fr-SC": "SCR",
  "en-KM": "KMF",
  "fr-KM": "KMF",
  "en-DJ": "DJF",
  "fr-DJ": "DJF",
  "en-SO": "SOS",
  "so-SO": "SOS",
  "en-ER": "ERN",
  "ti-ER": "ERN",
  "en-SS": "SSP",
  "en-SD": "SDG",
  "ar-SD": "SDG",
  "en-TD": "XAF",
  "fr-TD": "XAF",
  "ar-TD": "XAF",
  "en-CF": "XAF",
  "fr-CF": "XAF",
  "en-CM": "XAF",
  "fr-CM": "XAF",
  "en-GQ": "XAF",
  "es-GQ": "XAF",
  "fr-GQ": "XAF",
  "en-GA": "XAF",
  "fr-GA": "XAF",
  "en-CG": "XAF",
  "fr-CG": "XAF",
  "en-CD": "CDF",
  "fr-CD": "CDF",
  "ln-CD": "CDF",
  "en-AO": "AOA",
  "pt-AO": "AOA",
  "en-ST": "STN",
  "pt-ST": "STN",
  "en-CV": "CVE",
  "pt-CV": "CVE",
  "en-GW": "XOF",
  "pt-GW": "XOF",
  "en-GM": "GMD",
  "en-SN": "XOF",
  "fr-SN": "XOF",
  "en-ML": "XOF",
  "fr-ML": "XOF",
  "en-BF": "XOF",
  "fr-BF": "XOF",
  "en-CI": "XOF",
  "fr-CI": "XOF",
  "en-GN": "GNF",
  "fr-GN": "GNF",
  "en-SL": "SLL",
  "en-LR": "LRD",
  "en-MR": "MRU",
  "ar-MR": "MRU",
  "fr-MR": "MRU",
  "en-MA": "MAD",
  "ar-MA": "MAD",
  "fr-MA": "MAD",
  "en-DZ": "DZD",
  "ar-DZ": "DZD",
  "fr-DZ": "DZD",
  "en-TN": "TND",
  "ar-TN": "TND",
  "fr-TN": "TND",
  "en-LY": "LYD",
  "ar-LY": "LYD",
  "en-EG": "EGP",
  "ar-EG": "EGP",

  // Middle East
  "ar-SA": "SAR",
  "ar-AE": "AED",
  "ar-QA": "QAR",
  "ar-KW": "KWD",
  "ar-BH": "BHD",
  "ar-OM": "OMR",
  "ar-JO": "JOD",
  "ar-LB": "LBP",
  "ar-SY": "SYP",
  "ar-IQ": "IQD",
  "ar-YE": "YER",
  "ar-PS": "ILS",
  "he-IL": "ILS",
  "ar-IR": "IRR",
  "fa-IR": "IRR",

  // Asia Pacific
  "en-AU": "AUD",
  "en-NZ": "NZD",
  "en-SG": "SGD",
  "zh-SG": "SGD",
  "ms-SG": "SGD",
  "ta-SG": "SGD",
  "en-HK": "HKD",
  "zh-HK": "HKD",
  "en-MO": "MOP",
  "zh-MO": "MOP",
  "zh-CN": "CNY",
  "zh-TW": "TWD",
  "ja-JP": "JPY",
  "ko-KR": "KRW",
  "th-TH": "THB",
  "vi-VN": "VND",
  "id-ID": "IDR",
  "ms-MY": "MYR",
  "en-MY": "MYR",
  "zh-MY": "MYR",
  "ta-MY": "MYR",
  "en-PH": "PHP",
  "fil-PH": "PHP",
  "en-IN": "INR",
  "hi-IN": "INR",
  "bn-IN": "INR",
  "ta-IN": "INR",
  "te-IN": "INR",
  "mr-IN": "INR",
  "gu-IN": "INR",
  "kn-IN": "INR",
  "ml-IN": "INR",
  "pa-IN": "INR",
  "or-IN": "INR",
  "as-IN": "INR",
  "en-PK": "PKR",
  "ur-PK": "PKR",
  "en-BD": "BDT",
  "bn-BD": "BDT",
  "en-LK": "LKR",
  "si-LK": "LKR",
  "ta-LK": "LKR",
  "en-NP": "NPR",
  "ne-NP": "NPR",
  "en-MM": "MMK",
  "my-MM": "MMK",
  "en-KH": "KHR",
  "km-KH": "KHR",
  "en-LA": "LAK",
  "lo-LA": "LAK",
  "en-MN": "MNT",
  "mn-MN": "MNT",
  "en-BT": "BTN",
  "dz-BT": "BTN",
  "en-MV": "MVR",
  "dv-MV": "MVR",

  // Americas (non-US)
  "en-CA": "CAD",
  "en-BS": "BSD",
  "en-JM": "JMD",
  "en-TT": "TTD",
  "en-BB": "BBD",
  "en-GD": "XCD",
  "en-LC": "XCD",
  "en-VC": "XCD",
  "en-AG": "XCD",
  "en-KN": "XCD",
  "en-DM": "XCD",
  "en-BZ": "BZD",
  "en-GT": "GTQ",
  "es-GT": "GTQ",
  "en-SV": "USD",
  "es-SV": "USD",
  "en-HN": "HNL",
  "es-HN": "HNL",
  "en-NI": "NIO",
  "es-NI": "NIO",
  "en-CR": "CRC",
  "es-CR": "CRC",
  "en-PA": "PAB",
  "es-PA": "PAB",
  "en-CU": "CUP",
  "es-CU": "CUP",
  "en-DO": "DOP",
  "es-DO": "DOP",
  "en-HT": "HTG",
  "fr-HT": "HTG",
  "en-PR": "USD",
  "es-PR": "USD",

  // South America
  "es-CO": "COP",
  "es-EC": "USD",
  "es-PE": "PEN",
  "es-BO": "BOB",
  "es-CL": "CLP",
  "es-UY": "UYU",
  "es-PY": "PYG",
  "es-GY": "GYD",
  "en-GY": "GYD",
  "nl-SR": "SRD",
  "en-SR": "SRD",
  "es-GF": "EUR",
  "fr-GF": "EUR",
};

/**
 * Get currency code from locale string (e.g., "en-KE" -> "KES")
 */
export function getCurrencyFromLocale(locale: string): string {
  // Exact match first
  if (LOCALE_CURRENCY_MAP[locale]) {
    return LOCALE_CURRENCY_MAP[locale];
  }

  // Try with just the region part (e.g., "en-KE" -> "KE")
  const parts = locale.split("-");
  if (parts.length >= 2) {
    const region = parts[1].toUpperCase();
    const genericLocale = `${parts[0]}-${region}`;
    if (LOCALE_CURRENCY_MAP[genericLocale]) {
      return LOCALE_CURRENCY_MAP[genericLocale];
    }
  }

  // Default to USD
  return "USD";
}

/**
 * Currency display information
 */
export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  decimalDigits: number;
}

/**
 * Currency metadata for display
 */
export const CURRENCY_INFO: Record<string, CurrencyInfo> = {
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", decimalDigits: 0 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimalDigits: 2 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimalDigits: 2 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimalDigits: 2 },
  CAD: { code: "CAD", symbol: "CA$", name: "Canadian Dollar", decimalDigits: 2 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", decimalDigits: 2 },
  NZD: { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", decimalDigits: 2 },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc", decimalDigits: 2 },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimalDigits: 0 },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", decimalDigits: 2 },
  KRW: { code: "KRW", symbol: "₩", name: "South Korean Won", decimalDigits: 0 },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", decimalDigits: 2 },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimalDigits: 2 },
  HKD: { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", decimalDigits: 2 },
  TWD: { code: "TWD", symbol: "NT$", name: "New Taiwan Dollar", decimalDigits: 2 },
  THB: { code: "THB", symbol: "฿", name: "Thai Baht", decimalDigits: 2 },
  VND: { code: "VND", symbol: "₫", name: "Vietnamese Dong", decimalDigits: 0 },
  IDR: { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", decimalDigits: 0 },
  MYR: { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", decimalDigits: 2 },
  PHP: { code: "PHP", symbol: "₱", name: "Philippine Peso", decimalDigits: 2 },
  PKR: { code: "PKR", symbol: "₨", name: "Pakistani Rupee", decimalDigits: 2 },
  BDT: { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", decimalDigits: 2 },
  LKR: { code: "LKR", symbol: "₨", name: "Sri Lankan Rupee", decimalDigits: 2 },
  NPR: { code: "NPR", symbol: "₨", name: "Nepalese Rupee", decimalDigits: 2 },
  MMK: { code: "MMK", symbol: "K", name: "Myanmar Kyat", decimalDigits: 0 },
  KHR: { code: "KHR", symbol: "៛", name: "Cambodian Riel", decimalDigits: 0 },
  LAK: { code: "LAK", symbol: "₭", name: "Lao Kip", decimalDigits: 0 },
  MNT: { code: "MNT", symbol: "₮", name: "Mongolian Tögrög", decimalDigits: 0 },
  BTN: { code: "BTN", symbol: "Nu.", name: "Bhutanese Ngultrum", decimalDigits: 2 },
  MVR: { code: "MVR", symbol: "Rf", name: "Maldivian Rufiyaa", decimalDigits: 2 },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand", decimalDigits: 2 },
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira", decimalDigits: 2 },
  GHS: { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", decimalDigits: 2 },
  TZS: { code: "TZS", symbol: "Sh", name: "Tanzanian Shilling", decimalDigits: 0 },
  UGX: { code: "UGX", symbol: "USh", name: "Ugandan Shilling", decimalDigits: 0 },
  RWF: { code: "RWF", symbol: "RF", name: "Rwandan Franc", decimalDigits: 0 },
  ETB: { code: "ETB", symbol: "Br", name: "Ethiopian Birr", decimalDigits: 2 },
  ZWL: { code: "ZWL", symbol: "Z$", name: "Zimbabwean Dollar", decimalDigits: 2 },
  BWP: { code: "BWP", symbol: "P", name: "Botswana Pula", decimalDigits: 2 },
  MZN: { code: "MZN", symbol: "MT", name: "Mozambican Metical", decimalDigits: 2 },
  ZMW: { code: "ZMW", symbol: "ZK", name: "Zambian Kwacha", decimalDigits: 2 },
  MWK: { code: "MWK", symbol: "MK", name: "Malawian Kwacha", decimalDigits: 2 },
  LSL: { code: "LSL", symbol: "L", name: "Lesotho Loti", decimalDigits: 2 },
  SZL: { code: "SZL", symbol: "E", name: "Eswatini Lilangeni", decimalDigits: 2 },
  NAD: { code: "NAD", symbol: "N$", name: "Namibian Dollar", decimalDigits: 2 },
  MUR: { code: "MUR", symbol: "₨", name: "Mauritian Rupee", decimalDigits: 2 },
  SCR: { code: "SCR", symbol: "₨", name: "Seychellois Rupee", decimalDigits: 2 },
  KMF: { code: "KMF", symbol: "CF", name: "Comorian Franc", decimalDigits: 0 },
  DJF: { code: "DJF", symbol: "Fdj", name: "Djiboutian Franc", decimalDigits: 0 },
  SOS: { code: "SOS", symbol: "Sh", name: "Somali Shilling", decimalDigits: 0 },
  ERN: { code: "ERN", symbol: "Nfk", name: "Eritrean Nakfa", decimalDigits: 2 },
  SSP: { code: "SSP", symbol: "£", name: "South Sudanese Pound", decimalDigits: 2 },
  SDG: { code: "SDG", symbol: "£", name: "Sudanese Pound", decimalDigits: 2 },
  XAF: { code: "XAF", symbol: "FCFA", name: "Central African CFA Franc", decimalDigits: 0 },
  XOF: { code: "XOF", symbol: "CFA", name: "West African CFA Franc", decimalDigits: 0 },
  CDF: { code: "CDF", symbol: "FC", name: "Congolese Franc", decimalDigits: 2 },
  AOA: { code: "AOA", symbol: "Kz", name: "Angolan Kwanza", decimalDigits: 2 },
  STN: { code: "STN", symbol: "Db", name: "São Tomé and Príncipe Dobra", decimalDigits: 2 },
  CVE: { code: "CVE", symbol: "$", name: "Cape Verdean Escudo", decimalDigits: 2 },
  GMD: { code: "GMD", symbol: "D", name: "Gambian Dalasi", decimalDigits: 2 },
  GNF: { code: "GNF", symbol: "FG", name: "Guinean Franc", decimalDigits: 0 },
  SLL: { code: "SLL", symbol: "Le", name: "Sierra Leonean Leone", decimalDigits: 2 },
  LRD: { code: "LRD", symbol: "$", name: "Liberian Dollar", decimalDigits: 2 },
  MRU: { code: "MRU", symbol: "UM", name: "Mauritanian Ouguiya", decimalDigits: 2 },
  MAD: { code: "MAD", symbol: "د.م.", name: "Moroccan Dirham", decimalDigits: 2 },
  DZD: { code: "DZD", symbol: "د.ج", name: "Algerian Dinar", decimalDigits: 2 },
  TND: { code: "TND", symbol: "د.ت", name: "Tunisian Dinar", decimalDigits: 3 },
  LYD: { code: "LYD", symbol: "ل.د", name: "Libyan Dinar", decimalDigits: 3 },
  EGP: { code: "EGP", symbol: "£", name: "Egyptian Pound", decimalDigits: 2 },
  SAR: { code: "SAR", symbol: "﷼", name: "Saudi Riyal", decimalDigits: 2 },
  AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimalDigits: 2 },
  QAR: { code: "QAR", symbol: "﷼", name: "Qatari Riyal", decimalDigits: 2 },
  KWD: { code: "KWD", symbol: "د.ك", name: "Kuwaiti Dinar", decimalDigits: 3 },
  BHD: { code: "BHD", symbol: ".د.ب", name: "Bahraini Dinar", decimalDigits: 3 },
  OMR: { code: "OMR", symbol: "﷼", name: "Omani Rial", decimalDigits: 3 },
  JOD: { code: "JOD", symbol: "د.ا", name: "Jordanian Dinar", decimalDigits: 3 },
  LBP: { code: "LBP", symbol: "ل.ل", name: "Lebanese Pound", decimalDigits: 0 },
  SYP: { code: "SYP", symbol: "£", name: "Syrian Pound", decimalDigits: 0 },
  IQD: { code: "IQD", symbol: "ع.د", name: "Iraqi Dinar", decimalDigits: 3 },
  YER: { code: "YER", symbol: "﷼", name: "Yemeni Rial", decimalDigits: 2 },
  ILS: { code: "ILS", symbol: "₪", name: "Israeli New Shekel", decimalDigits: 2 },
  IRR: { code: "IRR", symbol: "﷼", name: "Iranian Rial", decimalDigits: 0 },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real", decimalDigits: 2 },
  MXN: { code: "MXN", symbol: "$", name: "Mexican Peso", decimalDigits: 2 },
  ARS: { code: "ARS", symbol: "$", name: "Argentine Peso", decimalDigits: 2 },
  CLP: { code: "CLP", symbol: "$", name: "Chilean Peso", decimalDigits: 0 },
  COP: { code: "COP", symbol: "$", name: "Colombian Peso", decimalDigits: 0 },
  PEN: { code: "PEN", symbol: "S/", name: "Peruvian Sol", decimalDigits: 2 },
  BOB: { code: "BOB", symbol: "Bs.", name: "Bolivian Boliviano", decimalDigits: 2 },
  UYU: { code: "UYU", symbol: "$", name: "Uruguayan Peso", decimalDigits: 2 },
  PYG: { code: "PYG", symbol: "₲", name: "Paraguayan Guarani", decimalDigits: 0 },
  VES: { code: "VES", symbol: "Bs.", name: "Venezuelan Bolívar", decimalDigits: 2 },
  GYD: { code: "GYD", symbol: "$", name: "Guyanese Dollar", decimalDigits: 2 },
  SRD: { code: "SRD", symbol: "$", name: "Surinamese Dollar", decimalDigits: 2 },
  BSD: { code: "BSD", symbol: "$", name: "Bahamian Dollar", decimalDigits: 2 },
  BBD: { code: "BBD", symbol: "$", name: "Barbadian Dollar", decimalDigits: 2 },
  JMD: { code: "JMD", symbol: "J$", name: "Jamaican Dollar", decimalDigits: 2 },
  TTD: { code: "TTD", symbol: "TT$", name: "Trinidad and Tobago Dollar", decimalDigits: 2 },
  XCD: { code: "XCD", symbol: "$", name: "East Caribbean Dollar", decimalDigits: 2 },
  BZD: { code: "BZD", symbol: "BZ$", name: "Belize Dollar", decimalDigits: 2 },
  GTQ: { code: "GTQ", symbol: "Q", name: "Guatemalan Quetzal", decimalDigits: 2 },
  HNL: { code: "HNL", symbol: "L", name: "Honduran Lempira", decimalDigits: 2 },
  NIO: { code: "NIO", symbol: "C$", name: "Nicaraguan Córdoba", decimalDigits: 2 },
  CRC: { code: "CRC", symbol: "₡", name: "Costa Rican Colón", decimalDigits: 2 },
  PAB: { code: "PAB", symbol: "B/.", name: "Panamanian Balboa", decimalDigits: 2 },
  CUP: { code: "CUP", symbol: "$", name: "Cuban Peso", decimalDigits: 2 },
  DOP: { code: "DOP", symbol: "RD$", name: "Dominican Peso", decimalDigits: 2 },
  HTG: { code: "HTG", symbol: "G", name: "Haitian Gourde", decimalDigits: 2 },
  PLN: { code: "PLN", symbol: "zł", name: "Polish Złoty", decimalDigits: 2 },
  CZK: { code: "CZK", symbol: "Kč", name: "Czech Koruna", decimalDigits: 2 },
  HUF: { code: "HUF", symbol: "Ft", name: "Hungarian Forint", decimalDigits: 0 },
  RON: { code: "RON", symbol: "lei", name: "Romanian Leu", decimalDigits: 2 },
  BGN: { code: "BGN", symbol: "лв", name: "Bulgarian Lev", decimalDigits: 2 },
  SEK: { code: "SEK", symbol: "kr", name: "Swedish Krona", decimalDigits: 2 },
  DKK: { code: "DKK", symbol: "kr", name: "Danish Krone", decimalDigits: 2 },
  NOK: { code: "NOK", symbol: "kr", name: "Norwegian Krone", decimalDigits: 2 },
  ISK: { code: "ISK", symbol: "kr", name: "Icelandic Króna", decimalDigits: 0 },
  RUB: { code: "RUB", symbol: "₽", name: "Russian Ruble", decimalDigits: 2 },
  UAH: { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia", decimalDigits: 2 },
  BYN: { code: "BYN", symbol: "Br", name: "Belarusian Ruble", decimalDigits: 2 },
  MDL: { code: "MDL", symbol: "L", name: "Moldovan Leu", decimalDigits: 2 },
  GEL: { code: "GEL", symbol: "₾", name: "Georgian Lari", decimalDigits: 2 },
  AZN: { code: "AZN", symbol: "₼", name: "Azerbaijani Manat", decimalDigits: 2 },
  AMD: { code: "AMD", symbol: "֏", name: "Armenian Dram", decimalDigits: 2 },
  TRY: { code: "TRY", symbol: "₺", name: "Turkish Lira", decimalDigits: 2 },
};

/**
 * Get currency info for a currency code
 */
export function getCurrencyInfo(currency: string): CurrencyInfo {
  return CURRENCY_INFO[currency] ?? {
    code: currency,
    symbol: currency,
    name: currency,
    decimalDigits: 2,
  };
}

/**
 * Format salary in cents to display string using user's preferred currency
 */
export function formatSalaryCents(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string = "USD",
): string | null {
  if (min == null && max == null) return null;

  const info = getCurrencyInfo(currency);
  const fmt = (cents: number) => {
    const amount = cents / 100;
    if (amount >= 1000 && info.decimalDigits === 0) {
      return `${info.symbol}${Math.round(amount / 1000)}k`;
    }
    if (amount >= 1000) {
      return `${info.symbol}${(amount / 1000).toFixed(1)}k`;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: info.decimalDigits,
      minimumFractionDigits: info.decimalDigits,
    }).format(amount);
  };

  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `from ${fmt(min)}`;
  return `up to ${fmt(max!)}`;
}

/**
 * List of supported currencies for UI selectors
 */
export const SUPPORTED_CURRENCIES = [
  "KES",
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "JPY",
  "CNY",
  "INR",
  "SGD",
  "HKD",
  "ZAR",
  "NGN",
  "GHS",
  "EGP",
  "AED",
  "SAR",
  "BRL",
  "MXN",
  "ARS",
  "CLP",
  "COP",
  "PEN",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];