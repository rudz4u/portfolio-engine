/**
 * Auto-classify a holding's segment/sector based on company name keyword matching.
 * Used during portfolio import when no segment is available from broker data.
 *
 * Priority order matters — more specific sectors are listed first to prevent
 * generic keywords (e.g. "bank" in BFSI) from overriding specific matches.
 */

const SECTOR_KEYWORDS: [string, string[]][] = [
  ["Defence",     ["hal", "bel", "bharat dynamics", "bdl", "mazagon", "garden reach", "grse", "cochin shipyard", "paras defence"]],
  ["EV",          ["ola electric", "ather energy"]],
  ["Technology",  ["infosys", "tcs", "wipro", "hcl tech", "tech mahindra", "persistent", "ltimindtree", "coforge", "mphasis", "cyient", "niit", "hexaware", "zensar", "kpit", "birlasoft", "mastek", "intellect design", "happiest minds"]],
  ["Telecom",     ["bharti airtel", "indus towers", "sterlite tech", "vodafone", "tata communications", "route mobile", "tanla"]],
  ["BFSI",        ["bank", "hdfc", "kotak", "icici", "sbi", "axis", "bajaj fin", "insurance", "financial services", "credit", "shriram", "muthoot", "chola", "pnb", "canara", "uco bank", "indian bank", "yes bank", "indusind", "federal bank", "bandhan", "au small finance", "ujjivan", "equitas", "capital first", "five star", "microfinance"]],
  ["Pharma",      ["pharma", "sun pharma", "cipla", "dr reddy", "lupin", "biocon", "divis", "glenmark", "torrent pharma", "alkem", "ipca", "natco", "granules", "laurus", "strides", "shilpa", "ajanta", "syngene"]],
  ["Auto",        ["tata motors", "maruti", "mahindra & mahindra", "hero moto", "bajaj auto", "eicher", "tvs motor", "ashok leyland", "force motors", "escorts", "suprajit", "motherson", "bharat forge", "minda", "gabriel", "endurance", "samvardhana", "sona blw"]],
  ["FMCG",        ["hindustan unilever", "hul", "itc", "nestle", "britannia", "dabur", "marico", "godrej consumer", "emami", "colgate", "procter", "patanjali", "bikaji", "jyothy", "varun beverages", "radico khaitan", "united spirits"]],
  ["Energy",      ["reliance industries", "ongc", "indian oil", "iocl", "bpcl", "hpcl", "gail", "petronet", "oil india", "castrol", "gulf oil", "mangalore refinery"]],
  ["Power",       ["power grid", "ntpc", "adani green", "adani power", "tata power", "torrent power", "nhpc", "sjvn", "cesc", "suzlon", "greenko", "jsw energy", "rpower", "kalpataru power", "inox wind", "orient green"]],
  ["Metals",      ["tata steel", "jsw steel", "hindalco", "vedanta", "coal india", "nmdc", "jindal steel", "sail", "nalco", "ratnamani", "welspun", "graphite india", "heg", "mishra dhatu", "moil"]],
  ["Infrastructure",["larsen", "l&t", "ultratech", "ambuja", "acc", "adani ports", "dlf", "godrej properties", "prestige", "oberoi realty", "brigade", "sobha", "irb infra", "rvnl", "ircon", "rites", "hg infra", "knr constructions", "pnc infratech"]],
  ["Healthcare",  ["apollo hospitals", "max health", "fortis", "narayana", "medanta", "aster", "global health", "vijaya diagnostic", "dr lal", "metropolis", "krsnaa", "healthium"]],
  ["Consumer",    ["titan", "voltas", "havells", "whirlpool", "blue star", "dixon", "amber enterprises", "asian paints", "berger", "pidilite", "page industries", "bata", "relaxo", "metro brands", "vedant fashions", "aditya birla fashion", "zudio", "v-mart"]],
  ["Chemicals",   ["aarti", "deepak nitrite", "gujarat fluorochem", "tata chemicals", "kansai nerolac", "astral", "finolex", "nocil", "vinati", "navin fluorine", "clean science", "fine organic", "galaxy surfactants"]],
  ["Agri",        ["upl", "pi industries", "coromandel", "bayer", "kaveri seed", "chambal fertilisers", "gnfc", "gujarat narmada", "national fertilizers", "rashtriya chemicals", "dhanuka", "rallis"]],
  ["Media",       ["zee entertainment", "sun tv", "network18", "dish tv", "inox leisure", "pvr", "tips music", "saregama"]],
  ["Logistics",   ["delhivery", "blue dart", "container corporation", "concor", "allcargo", "mahindra logistics", "tvs supply chain", "gati"]],
  ["PSU",         ["bharat electronics", "bhel", "nationalised", "hindustan aeronautics", "bharat petroleum", "hindustan petroleum", "oil and natural", "mahanagar"]],
]

/**
 * Returns the best-matching sector for a given company name.
 * Falls back to "Others" if no match is found.
 */
export function classifySegment(companyName: string): string {
  if (!companyName) return "Others"
  const lower = companyName.toLowerCase()
  for (const [sector, keywords] of SECTOR_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return sector
    }
  }
  return "Others"
}
