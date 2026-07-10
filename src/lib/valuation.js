// Shared valuation math for cash offer / as-is / full retail calculations.
// Used by PropertyDrawer.jsx and PropertyFullView.jsx so the two views can
// never drift apart the way ProposalModal's separate copy already has.
export function calcOffers(p, repairs) {
  const arv       = parseFloat(p.arv)||0
  const reno      = repairs.reduce((s,r)=>s+(parseFloat(r.cost)||0),0)
  const commList  = (parseFloat(p.comm_list_pct)||6)/100
  const profitPct = (parseFloat(p.profit_margin)||15)/100
  const profit    = p.profit_override ? parseFloat(p.profit_override) : arv*profitPct
  const asisDisc  = (parseFloat(p.asis_pct)||50)/100
  const asisVal   = p.asis_override ? parseFloat(p.asis_override) : arv-(asisDisc*reno)
  const cashHoldMo= parseFloat(p.hold_cash_months)||6
  const cashHold  = (parseFloat(p.hold_cash_pct)||0.75)/100*cashHoldMo*arv

  // Cash Offer commission is two pieces: a % of the cash offer itself, and a % of ARV.
  // Since the cash offer depends on its own commission, solve the two simultaneously:
  //   cashOffer = arv - reno - (commOfferPct*cashOffer + commArvPct*arv) - cashHold - profit
  //   cashOffer*(1+commOfferPct) = arv*(1-commArvPct) - reno - cashHold - profit
  // NOTE: parseFloat(null) is NaN, and NaN ?? fallback never triggers (?? only
  // catches null/undefined) — so the null-check has to happen BEFORE parseFloat.
  const commOfferPct = (p.comm_cash_offer_pct!=null && p.comm_cash_offer_pct!=='' ? parseFloat(p.comm_cash_offer_pct) : 3)/100
  const commArvPct   = (p.comm_cash_arv_pct!=null && p.comm_cash_arv_pct!=='' ? parseFloat(p.comm_cash_arv_pct) : 6)/100
  const cashOffer = p.cash_offer_override
    ? parseFloat(p.cash_offer_override)
    : (arv*(1-commArvPct) - reno - cashHold - profit) / (1+commOfferPct)
  const commOfferAmt = commOfferPct*cashOffer
  const commArvAmt   = commArvPct*arv
  const commCashTotal= commOfferAmt+commArvAmt

  const opt2HoldMo= parseFloat(p.hold_opt2_months)||3
  const opt2Comm  = commList*asisVal
  const opt2Hold  = (parseFloat(p.hold_opt2_pct)||0.5)/100*opt2HoldMo*arv
  const opt2Net   = asisVal-opt2Comm-opt2Hold
  const opt3HoldMo= parseFloat(p.hold_opt3_months)||6
  const opt3Comm  = commList*arv
  const opt3Hold  = (parseFloat(p.hold_opt3_pct)||0.5)/100*opt3HoldMo*arv
  const opt3Net   = arv-reno-opt3Comm-opt3Hold
  return {
    arv, reno, cashOffer, asisVal, asisDeduction:asisDisc*reno, opt2Net, opt3Net, profit,
    commOfferPct, commArvPct, commOfferAmt, commArvAmt, commCashTotal,
    commListPct:commList,
    cashHold, cashHoldMo, opt2Comm, opt2Hold, opt2HoldMo, opt3Comm, opt3Hold, opt3HoldMo,
  }
}
