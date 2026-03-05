/**
 * Known broker export formats — column mappings & metadata skip rows
 * for automatic parsing of holdings XLSX/PDF files.
 */

export interface BrokerFormat {
  id: string
  label: string
  /** Rows to skip before reaching the header row (0-indexed). */
  headerRow: number
  /** Expected sheet name (null = use first sheet). */
  sheetName: string | null
  /** Map from our internal field to the broker's column header(s) (case-insensitive match). */
  columnMap: {
    isin?: string[]
    company_name?: string[]
    trading_symbol?: string[]
    quantity?: string[]
    avg_price?: string[]
    ltp?: string[]
    invested_amount?: string[]
    unrealized_pl?: string[]
  }
  /** URL to broker export guide. */
  exportGuideUrl: string
  /** Steps for user to export holdings. */
  exportSteps: string[]
  /** Supported file types. */
  fileTypes: ("xlsx" | "csv" | "pdf")[]
  /** URL to the broker's official logo image. */
  logoUrl?: string
}

export const BROKER_FORMATS: Record<string, BrokerFormat> = {
  upstox: {
    id: "upstox",
    label: "Upstox",
    headerRow: 9,
    sheetName: "HOLDING",
    columnMap: {
      isin: ["ISIN"],
      company_name: ["Scrip Name"],
      quantity: ["Current Qty"],
      avg_price: ["Rate"],            // "Rate" in Upstox report = average cost price
      invested_amount: ["Valuation"], // "Valuation" = qty × avg_price
    },
    exportGuideUrl: "https://account.upstox.com/reports/holding/all",
    exportSteps: [
      "Log in to your Upstox account at upstox.com",
      "Go to Account → Reports → Holdings",
      "Select the date for the report",
      'Click the download icon and choose "Excel" format',
      "Upload the downloaded .xlsx file here",
    ],
    fileTypes: ["xlsx", "pdf"],
    logoUrl: "https://assets.upstox.com/website/images/upstox-new-logo.svg",
  },

  zerodha: {
    id: "zerodha",
    label: "Zerodha",
    headerRow: 0,
    sheetName: null,
    columnMap: {
      isin: ["ISIN"],
      company_name: ["Stock", "Instrument", "Stock Name"],
      trading_symbol: ["Symbol", "Trading Symbol"],
      quantity: ["Qty", "Qty."],
      avg_price: ["Avg. cost", "Avg Cost", "Average Price"],
      ltp: ["LTP", "Current Price", "CMP"],
      invested_amount: ["Invested Value", "Invested"],
      unrealized_pl: ["P&L", "Profit & Loss", "Unrealised P&L"],
    },
    exportGuideUrl: "https://console.zerodha.com/portfolio/holdings",
    exportSteps: [
      "Log in to Zerodha Console (console.zerodha.com)",
      "Click on Portfolio → Holdings",
      'Click "XLSX" beside the Download button',
      "Select the date if needed, then download",
      "Upload the downloaded .xlsx file here",
    ],
    fileTypes: ["xlsx"],
    logoUrl: "https://zerodha.com/static/images/logo.svg",
  },

  groww: {
    id: "groww",
    label: "Groww",
    headerRow: 0,
    sheetName: null,
    columnMap: {
      isin: ["ISIN"],
      company_name: ["Company Name", "Stock Name", "Name"],
      trading_symbol: ["Symbol", "Trading Symbol"],
      quantity: ["Quantity", "Qty"],
      avg_price: ["Avg. Price", "Average Price", "Buy Price"],
      ltp: ["LTP", "Current Price", "CMP"],
      invested_amount: ["Invested Value", "Invested"],
      unrealized_pl: ["P&L", "Returns", "Unrealised P&L"],
    },
    exportGuideUrl: "https://groww.in/stocks/user/explore",
    exportSteps: [
      "Log in to your Groww account",
      "Go to Profile → Reports → Holdings",
      'Click "CMR Copy" or "Holding Statement"',
      "Download the report received via email",
      "Upload the downloaded file here",
    ],
    fileTypes: ["xlsx", "csv", "pdf"],
    logoUrl: "https://resources.groww.in/web-assets/img/website-logo/groww_logo.webp",
  },

  angelone: {
    id: "angelone",
    label: "Angel One",
    headerRow: 0,
    sheetName: null,
    columnMap: {
      isin: ["ISIN"],
      company_name: ["Scrip Name", "Stock Name", "Company"],
      trading_symbol: ["Symbol", "Scrip Code"],
      quantity: ["Quantity", "Qty", "Net Qty"],
      avg_price: ["Avg. Price", "Average Price", "Buy Average"],
      ltp: ["LTP", "Current Price", "CMP"],
      invested_amount: ["Invested Value", "Invested"],
      unrealized_pl: ["P&L", "Unrealised P&L"],
    },
    exportGuideUrl: "https://www.angelone.in/support/reports-and-statements/holding-statement",
    exportSteps: [
      "Log in to your Angel One account",
      "Go to My Account → Reports & Statements",
      "Select Holding Statement",
      "Choose the date range and download as Excel",
      "Upload the downloaded .xlsx file here",
    ],
    fileTypes: ["xlsx", "pdf"],
    logoUrl: "https://w3assets.angelone.in/wp-content/uploads/2024/04/IPL_COMPOSITE-LOGO_ANGELONE_HORIZONTAL_WHITE_VERSION-192x100-1.png",
  },

  sharekhan: {
    id: "sharekhan",
    label: "Sharekhan",
    headerRow: 0,
    sheetName: null,
    columnMap: {
      isin: ["ISIN"],
      company_name: ["Scrip Name", "Stock Name", "Company Name"],
      trading_symbol: ["Symbol", "Scrip Code"],
      quantity: ["Quantity", "Qty", "Net Qty"],
      avg_price: ["Avg. Price", "Average Price", "Buy Avg"],
      ltp: ["LTP", "Current Price", "CMP"],
      invested_amount: ["Invested Value", "Invested Amount"],
      unrealized_pl: ["P&L", "Unrealised P&L", "Profit/Loss"],
    },
    exportGuideUrl: "https://www.sharekhan.com/",
    exportSteps: [
      "Log in to your Sharekhan account",
      "Go to Reports → Demat Holding Statement",
      "Select the date and click Generate",
      "Download in Excel or PDF format",
      "Upload the downloaded file here",
    ],
    fileTypes: ["xlsx", "pdf"],
    logoUrl: "https://www.sharekhan.com/CmsApp/MediaGalary/images/sharekhan_logo-202207131537046949004.svg",
  },

  dhan: {
    id: "dhan",
    label: "Dhan",
    headerRow: 0,
    sheetName: null,
    columnMap: {
      isin: ["ISIN"],
      company_name: ["Company Name", "Stock Name", "Scrip Name"],
      trading_symbol: ["Symbol", "Trading Symbol"],
      quantity: ["Quantity", "Qty"],
      avg_price: ["Avg. Price", "Buy Avg"],
      ltp: ["LTP", "Current Price"],
      invested_amount: ["Invested Value"],
      unrealized_pl: ["P&L", "Unrealised P&L"],
    },
    exportGuideUrl: "https://web.dhan.co/",
    exportSteps: [
      "Log in to your Dhan account at web.dhan.co",
      "Go to Portfolio → Holdings",
      "Click the download/export icon",
      "Download the file in Excel format",
      "Upload the downloaded file here",
    ],
    fileTypes: ["xlsx", "csv"],
    logoUrl: "https://dhan.co/_next/static/media/Dhanlogo.8a85768d.svg",
  },

  icici_direct: {
    id: "icici_direct",
    label: "ICICI Direct",
    headerRow: 0,
    sheetName: null,
    columnMap: {
      isin: ["ISIN"],
      company_name: ["Company Name", "Stock Name"],
      trading_symbol: ["Stock Code", "Symbol"],
      quantity: ["Quantity", "Qty", "Balance Qty"],
      avg_price: ["Avg Buy Price", "Average Price"],
      ltp: ["LTP", "Current Price", "CMP"],
      invested_amount: ["Invested Value", "Cost Value"],
      unrealized_pl: ["Profit/Loss", "P&L", "Unrealised P/L"],
    },
    exportGuideUrl: "https://www.icicidirect.com/",
    exportSteps: [
      "Log in to your ICICI Direct account",
      "Go to Portfolio → Holdings",
      "Click the download/export button",
      "Choose Excel format and download",
      "Upload the downloaded file here",
    ],
    fileTypes: ["xlsx", "pdf"],
    logoUrl: "https://www.icicidirect.com/Content/images/ICICI-logo-white.svg",
  },

  motilal_oswal: {
    id: "motilal_oswal",
    label: "Motilal Oswal",
    headerRow: 0,
    sheetName: null,
    columnMap: {
      isin: ["ISIN"],
      company_name: ["Scrip Name", "Stock Name", "Company"],
      trading_symbol: ["Symbol", "Script Code"],
      quantity: ["Quantity", "Qty", "Net Qty"],
      avg_price: ["Avg. Price", "Average Price"],
      ltp: ["LTP", "Current Price"],
      invested_amount: ["Invested Value"],
      unrealized_pl: ["P&L", "Unrealised P&L"],
    },
    exportGuideUrl: "https://www.motilaloswal.com/",
    exportSteps: [
      "Log in to your Motilal Oswal account",
      "Go to Portfolio → Demat Holdings",
      "Click on the download/export option",
      "Choose Excel format and download",
      "Upload the downloaded file here",
    ],
    fileTypes: ["xlsx"],
    logoUrl: "https://www.motilaloswal.com/media_16de0a321de10a0a08e55668008fbcaa32ec9c982.svg",
  },

  other: {
    id: "other",
    label: "Other Broker",
    headerRow: 0,
    sheetName: null,
    columnMap: {},
    exportGuideUrl: "",
    exportSteps: [
      "Log in to your broker's website or app",
      "Navigate to Portfolio → Holdings section",
      "Look for a Download / Export option",
      "Download as Excel (.xlsx) or CSV file",
      "Upload the downloaded file here",
    ],
    fileTypes: ["xlsx", "csv", "pdf"],
  },
}

export const BROKER_LIST = Object.values(BROKER_FORMATS)
