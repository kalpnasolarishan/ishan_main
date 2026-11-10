/* Kalpna Docs (browser version). Everything runs on the user's device. Nothing is sent anywhere and no customer data is stored. */
const { PDFDocument, rgb, StandardFonts } = PDFLib;
const C = { black: rgb(0, 0, 0), navy: rgb(0, .145, .38), blue: rgb(.063, .165, .345), gray: rgb(.75, .75, .75), light: rgb(.953, .953, .953), ink: rgb(.067, .067, .2) };
const AW = 595.56, AH = 842.04, W = 595, H = 842;
const $ = id => document.getElementById(id);

/* ---------- where seals, signatures and details go (positions are points on A4; pages: agreement 1 = e-stamp, 2-5 = Annexure) ---------- */
const E = (id, label, kind, pages, x, y, w, h, o = {}) => Object.assign({ id, label, kind, pages, x, y, w, h: h || null, show: true }, o);
const LAYOUT = {
  agreement: [
    E("estamp_seal", "Seal on the e-stamp page", "image", [1], 368, 528, 170, 0, { src: "seal" }),
    E("estamp_sign", "Customer sign on the e-stamp page", "sign", [1], 30, 530, 160, 72),
    E("bottom_seal", "Seal at the bottom of Annexure pages 1-3", "image", [2, 3, 4], 428, 783, 130, 0, { src: "seal" }),
    E("bottom_seal_last", "Seal at the bottom of the LAST page", "image", [5], 428, 783, 130, 0, { src: "seal" }),
    E("bottom_sign", "Customer sign at the bottom of Annexure pages 1-3", "sign", [2, 3, 4], 36, 756, 146, 82),
    E("bottom_sign_last", "Customer sign at the bottom of the LAST page", "sign", [5], 36, 756, 146, 82, { show: false }),
    E("last_sign", "Customer sign on the First Party 'Sign' line", "sign", [5], 94, 679, 200, 34),
    E("last_vendor", "Vendor sign on the Second Party 'Sign' line", "image", [5], 452, 691, 82, 0, { src: "vendor_sign" }),
    E("day", "Agreement date: day", "text", [2], 246, 149, 36, 15.5, { field: "day", align: "c" }),
    E("month", "Agreement date: month", "text", [2], 296, 149, 36, 15.5, { field: "month", align: "c" }),
    E("year", "Agreement date: year", "text", [2], 362, 149, 34, 15.5, { field: "year", align: "c" }),
    E("name2", "Customer name (page 2)", "text", [2], 70, 254.5, 144, 15.5, { field: "name" }),
    E("address2", "Customer address (page 2)", "text", [2], 70, 276.5, 207, 15.5, { field: "address" }),
    E("name5", "Customer name (last page)", "text", [5], 112, 642.5, 300, 15.5, { field: "name" }),
    E("address5", "Customer address (last page)", "text", [5], 112, 664.5, 300, 15.5, { field: "address" }),
    E("date_first", "Date next to First Party", "text", [5], 94, 708.5, 120, 15.5, { field: "date" }),
    E("date_second", "Date next to Second Party", "text", [5], 456, 708.5, 100, 15.5, { field: "date" }),
  ],
  invoice: [
    E("vendor_sign", "Vendor sign above 'Authorized signatory'", "image", [1], 428, 691, 100, 0, { src: "vendor_sign", show: false }),
    E("seal", "Seal", "image", [1], 300, 745, 130, 0, { src: "seal", show: false }),
    E("customer_sign", "Customer sign", "sign", [1], 66, 690, 130, 45, { show: false }),
  ],
  receipt: [
    E("seal", "Seal", "image", [1], 360, 445, 150, 0, { src: "seal", show: false }),
    E("customer_sign", "Customer sign", "sign", [1], 76, 445, 150, 60, { show: false }),
  ],
  quotation: [
    E("seal", "Seal on the scope page", "image", [2], 380, 650, 130, 0, { src: "seal", show: false }),
    E("customer_sign", "Customer sign on the scope page", "sign", [2], 76, 640, 146, 70, { show: false }),
  ],
};
const TITLES = { agreement: "Agreement", receipt: "Receipt", invoice: "Invoice", quotation: "Quotation" };

/* ---------- settings: kept only in this browser, and only if you tick "Remember" ---------- */
const DEFAULTS = {
  addr: ["Regd. Office : Opp. Baheti Resort,", "Near Sitaramji ki bavri , Bhopalganj,", "Bhilwara – 311001", "M.no.:-9660699985"],
  bank: [], partners: [], show: {}, seal: null, vsign: null, remember: false, goods_share: .7, goods_rate: .05, service_rate: .18,
};
let S = JSON.parse(JSON.stringify(DEFAULTS));
try { const s = localStorage.getItem("kdocs_settings"); if (s) S = Object.assign(S, JSON.parse(s)); } catch (e) { }
const shown = (doc, e) => (doc + "." + e.id) in S.show ? S.show[doc + "." + e.id] : e.show;

/* ---------- small helpers ---------- */
const r2 = x => Math.round((x + 1e-9) * 100) / 100;
const commas = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const rs = n => "₹" + commas(r2(n).toFixed(2));
const plain = n => commas(r2(n).toFixed(r2(n) % 1 ? 2 : 0));
const two = n => String(n).padStart(2, "0");
const clean = s => String(s == null ? "" : s).replace(/[^\x20-\x7E\n\u2013\u2018\u2019\u201C\u201D\u00A0-\u00FF\u20B9]/g, "?");
function gst(total) {
  const g = r2(total * S.goods_share), s = r2(total - g), tg = r2(g - g / (1 + S.goods_rate)), ts = r2(s - s / (1 + S.service_rate));
  return { g, s, tg, ts, bg: r2(g - tg), bs: r2(s - ts), tt: r2(tg + ts) };
}
const b64ToBytes = d => Uint8Array.from(atob(d.split(",")[1]), c => c.charCodeAt(0));
const fetchBytes = async u => new Uint8Array(await (await fetch(u)).arrayBuffer());

/* ---------- drawing helper: every box is (x, y from the top, w, h) in points ---------- */
class Pg {
  constructor(page, F, Hh) { this.p = page; this.F = F; this.H = Hh; }
  rect(x, y, w, h, col) { this.p.drawRectangle({ x, y: this.H - y - h, width: w, height: h, color: col }); }
  hl(x1, x2, y, col = C.black, lw = .6) { this.p.drawLine({ start: { x: x1, y: this.H - y }, end: { x: x2, y: this.H - y }, thickness: lw, color: col }); }
  vl(x, y1, y2, col = C.black, lw = .6) { this.p.drawLine({ start: { x, y: this.H - y1 }, end: { x, y: this.H - y2 }, thickness: lw, color: col }); }
  width(s, size, bold) {
    const f = bold ? this.F.b : this.F.r, parts = s.split("₹"), g = RUPEE[bold ? "bold" : "reg"];
    return parts.reduce((a, p) => a + (p ? f.widthOfTextAtSize(p, size) : 0), 0) + (parts.length - 1) * g.adv * size / RUPEE.upm;
  }
  wrap(s, w, size, bold) {
    const out = []; let cur = "";
    for (const word of s.split(" ")) { const t = cur ? cur + " " + word : word; if (cur && this.width(t, size, bold) > w) { out.push(cur); cur = word; } else cur = t; }
    out.push(cur); return out;
  }
  draw(x, by, s, size, bold, col) {
    const f = bold ? this.F.b : this.F.r, g = RUPEE[bold ? "bold" : "reg"], parts = s.split("₹");
    parts.forEach((p, i) => {
      if (p) { this.p.drawText(p, { x, y: by, size, font: f, color: col }); x += f.widthOfTextAtSize(p, size); }
      if (i < parts.length - 1) { this.p.drawSvgPath(g.d, { x, y: by, scale: size / RUPEE.upm, color: col }); x += g.adv * size / RUPEE.upm; }
    });
  }
  t(x, y, w, h, s, size = 10.5, bold = false, al = "l", col = C.black, wrap = false, top = false) {
    s = clean(s); let lines, lh = 0, y0;
    if (wrap) { lines = []; for (const part of s.split("\n")) lines.push(...this.wrap(part, w, size, bold)); lh = size * 1.2; y0 = y + (top ? size : (h - lh * lines.length) / 2 + size * .9); }
    else { while (size > 5 && this.width(s, size, bold) > w) size -= .25; lines = [s]; y0 = y + h / 2 + size * .33; }
    lines.forEach((ln, i) => { const wd = this.width(ln, size, bold); this.draw(al === "l" ? x : al === "c" ? x + (w - wd) / 2 : x + w - wd, this.H - (y0 + i * lh), ln, size, bold, col); });
  }
  img(im, x, y, w, h) { this.p.drawImage(im, { x, y: this.H - y - h, width: w, height: h }); }
  fit(im, x, y, w, h) { const k = Math.min(w / im.width, h / im.height); this.img(im, x + (w - im.width * k) / 2, y + (h - im.height * k) / 2, im.width * k, im.height * k); }
}

async function fonts(doc) { return { r: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold) }; }
async function images(doc, signBytes) {
  const o = {};
  if (signBytes) o.sign = await doc.embedPng(signBytes);
  if (S.seal) o.seal = await doc.embedPng(b64ToBytes(S.seal));
  if (S.vsign) o.vendor_sign = await doc.embedPng(b64ToBytes(S.vsign));
  return o;
}
function elements(pg, doc, page, ctx, vals) {
  for (const e of LAYOUT[doc]) {
    if (!shown(doc, e) || !e.pages.includes(page)) continue;
    if (e.kind === "text") { pg.t(e.x, e.y, e.w, e.h || 15.5, vals[e.field] || "", 11, false, e.align || "l", C.ink); continue; }
    const im = e.kind === "sign" ? ctx.sign : ctx[e.src];
    if (!im) continue;
    if (e.h) pg.fit(im, e.x, e.y, e.w, e.h); else pg.img(im, e.x, e.y, e.w, e.w * im.height / im.width);
  }
}
function missing(doc, need) {                                  // what the user still has to provide for this document
  const m = [];
  for (const e of LAYOUT[doc]) {
    if (!shown(doc, e) || e.kind === "text") continue;
    const k = e.kind === "sign" ? "sign" : e.src;
    if (!need[k] && !m.includes(k)) m.push(k);
  }
  return m.map(k => ({ sign: "the customer's signature (sign in the box)", seal: "your seal image (Setup)", vendor_sign: "your signature image (Setup)" }[k]));
}
function header(pg, ctx, ty, logo, ay, ady, asz, bold, x) {
  pg.t(x, ty, 300, 22, "KALPNA SOLAR ENERGY", 19.3, true, "l", C.blue);
  S.addr.forEach((ln, i) => pg.t(x, ay + i * ady, 300, ady, ln, asz, bold));
  pg.img(ctx.logo, logo[0], logo[1], logo[2], logo[2]);
}
const bankLines = () => S.bank;

/* ---------- the four documents ---------- */
async function newDoc(signBytes) {
  const doc = await PDFDocument.create(), F = await fonts(doc), ctx = await images(doc, signBytes);
  ctx.logo = await doc.embedJpg(await fetchBytes("assets/logo.jpg"));
  return { doc, F, ctx };
}
const partnerOf = c => S.partners.find(p => p.key === c.partner) || { name: "", phone: "" };

async function buildReceipt(c, sign) {
  const miss = missing("receipt", { sign: !!sign, seal: !!S.seal, vendor_sign: !!S.vsign }); if (miss.length) throw Object.assign(new Error("Needs " + miss.join(", ")), { missing: miss });
  const { doc, F, ctx } = await newDoc(sign), p = new Pg(doc.addPage([W, H]), F, H);
  p.rect(35.4, 139.7, 524.2, 13.6, C.navy);
  header(p, ctx, 171, [428.9, 166.3, 91.1], 203.4, 13.75, 11.3, false, 76.9);
  p.t(194, 262.2, 200, 16, "RECEIPT", 15.3, true, "c");
  p.t(76.9, 283, 70, 12.5, "Receipt No.:", 11.3, true, "l", C.blue); p.t(150, 283, 160, 12.5, c.rno, 11.3, true, "l", C.blue);
  p.t(360, 283, 158.1, 12.5, "Date.: " + c.dateStr, 11.3, true, "r", C.blue);
  const ys = [333.9, 360.0, 378.6, 397.1, 415.7]; ys.forEach(y => p.hl(74.7, 520.3, y, C.black, 1)); [74.7, 274.3, 520.3].forEach(x => p.vl(x, ys[0], ys[4], C.black, 1));
  [["CUSTOMER NAME", c.name], ["ADDRESS", c.address], ["AMOUNT", plain(c.received)], ["CASH/CHEQUE/NEFT", c.mode.toUpperCase()]].forEach(([a, b], i) => {
    p.t(76.9, ys[i], 195, ys[i + 1] - ys[i], a, 12.1, true); p.t(278, ys[i], 240, ys[i + 1] - ys[i], b, 10.5);
  });
  elements(p, "receipt", 1, ctx, {}); return doc.save();
}

async function buildInvoice(c, sign) {
  const miss = missing("invoice", { sign: !!sign, seal: !!S.seal, vendor_sign: !!S.vsign }); if (miss.length) throw Object.assign(new Error("Needs " + miss.join(", ")), { missing: miss });
  const g = gst(c.total), pt = partnerOf(c), { doc, F, ctx } = await newDoc(sign), p = new Pg(doc.addPage([W, H]), F, H), G = C.gray;
  p.rect(35.4, 58.4, 524.2, 20.1, C.navy); p.t(197, 83.5, 200, 20.5, "INVOICE", 19.6, true, "c", C.blue);
  header(p, ctx, 107.4, [430.3, 101.1, 99.8], 140.5, 13.95, 11.4, false, 66.8);
  [[231.3, 64.5], [248.3, 64.5], [263.4, 225.9], [323.8, 64.5]].forEach(([y, x1]) => p.hl(x1, 530.5, y, G));
  p.vl(64.5, 231.3, 323.8, G); p.vl(225.9, 231.3, 323.8, G); p.vl(332.7, 231.3, 263.4, G); p.vl(530.5, 231.3, 323.8, G);
  p.t(66.8, 231.3, 156, 17, "BUYER DETAILS", 11.4, true); p.t(225.9, 231.3, 106.8, 17, "DATE", 11.4, true, "c"); p.t(332.7, 231.3, 197.8, 17, "Invoice Number", 11.4, true, "c");
  p.t(66.8, 248.3, 156, 15.1, c.name, 9.8, true); p.t(225.9, 248.3, 106.8, 15.1, c.dateStr, 9.8, true, "c"); p.t(332.7, 248.3, 197.8, 15.1, c.ino, 9.8, true, "c");
  p.t(66.8, 266, 156, 56, c.address, 9.8, true, "l", C.black, true, true);
  p.t(232, 265, 296.1, 11, "Authorized sales & service partner for this project", 9.8, true, "r"); p.t(232, 277, 296.1, 11, pt.name, 9.8, true, "r"); p.t(232, 289, 296.1, 11, "M.NO.: - " + pt.phone, 9.8, true, "r");
  p.rect(64.5, 375.2, 466, 51.5, C.light);
  const ys = [350.1, 375.2, 426.7, 478.1, 498.2, 584.9, 642.6]; ys.forEach(y => p.hl(64.5, 530.5, y, G)); p.vl(64.5, ys[0], ys[6], G); p.vl(530.5, ys[0], ys[6], G);
  p.vl(301.9, ys[0], 478.1, G); p.vl(332.7, ys[0], 584.9, G); p.vl(398.6, ys[0], 498.2, G); p.vl(464.5, ys[0], 498.2, G);
  p.t(66.8, 350.1, 200, 25.1, "Description", 9.8, true);
  [["Qty", 301.9, 332.7], ["Unit price", 332.7, 398.6], ["Tax", 398.6, 464.5], ["Total price", 464.5, 530.5]].forEach(([t, a, b]) => p.t(a, 350.1, b - a, 25.1, t, 9.8, true, "c"));
  p.t(66.8, 376, 232, 49.5, c.kw + "KW SOLAR POWER GENERATING SYSTEM (SOLAR PANELS & GRID TIE INVERTER)", 8.2, false, "l", C.black, true);
  p.t(66.8, 427.5, 232, 50, "SOLAR STR, WIRING, INSTALLATION\nSOLAR ACCESSORIES.: - ACDB, DCDB, GI PIPE, METER, MC4 CONNECTOR, EARTHING KIT, LA, FASTNER, ZINC SPRAY FREIGHT, &INSTALLATION CHARGES", 8.2, false, "l", C.black, true);
  [[375.2, 426.7, [g.bg, g.tg, g.g]], [426.7, 478.1, [g.bs, g.ts, g.s]]].forEach(([y1, y2, vals]) => {
    p.t(301.9, y1, 30.8, y2 - y1, "1", 8.2, false, "c");
    [[332.7, 398.6], [398.6, 464.5], [464.5, 530.5]].forEach(([a, b], i) => p.t(a, y1, b - a, y2 - y1, rs(vals[i]), 8.2, false, "c"));
  });
  p.t(66.8, 478.1, 100, 20.1, "Notes:", 8.2, true); p.t(332.7, 478.1, 65.9, 20.1, "TOTAL", 8.2, true, "c");
  p.t(398.6, 478.1, 65.9, 20.1, rs(g.tt), 8.2, true, "c"); p.t(464.5, 478.1, 66, 20.1, rs(c.total), 8.2, true, "c");
  ["Terms of delivery:", "100% before dispatch/delivery", "Installation charges as per actual", "PI valid for 7 days from the date of invoice", "Prices mentioned above are inclusive of GST"].forEach((ln, i) => p.t(66.8, 517.7 + i * 9.97, 250, 9.97, ln, 8.2));
  bankLines().forEach((ln, i) => p.t(336, 503.3 + i * 10, 192.1, 10, ln, 8.2, false, "r"));
  p.t(66.8, 595, 200, 10, "Declaration:", 8.2); p.t(66.8, 605, 460, 10, "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.", 8.2);
  p.t(300, 677.5, 228.1, 12.5, "For KALPNA SOLAR ENERGY", 12.2, true, "r"); p.t(300, 722.3, 228.1, 12.5, "Authorized signatory", 12.2, true, "r");
  elements(p, "invoice", 1, ctx, {}); return doc.save();
}

async function buildQuotation(c, sign) {
  const miss = missing("quotation", { sign: !!sign, seal: !!S.seal, vendor_sign: !!S.vsign }); if (miss.length) throw Object.assign(new Error("Needs " + miss.join(", ")), { missing: miss });
  const pt = partnerOf(c), { doc, F, ctx } = await newDoc(sign), p = new Pg(doc.addPage([W, H]), F, H);
  p.rect(35.4, 37.1, 524.2, 13.6, C.navy);
  header(p, ctx, 68, [400.4, 63.8, 120.8], 113.6, 12.75, 10.5, true, 75.7);
  p.t(75.7, 188.6, 220, 11, "Quotation No.: " + c.qno, 10.5, true); p.t(398.5, 188.6, 50, 11, "DATE", 10.5, true); p.t(440, 188.6, 79.3, 11, c.dateStr, 10.5, false, "r");
  p.t(197.3, 204.6, 200, 11, "QUOTATION", 10.5, true, "c", C.blue);
  const table = (ys, rows, x1 = 73.5, x2 = 521.8, mid = 271.2) => {
    ys.forEach(y => p.hl(x1, x2, y)); [x1, mid, x2].forEach(x => p.vl(x, ys[0], ys[ys.length - 1]));
    rows.forEach(([a, b], i) => { p.t(x1 + 2.2, ys[i], mid - x1 - 4, ys[i + 1] - ys[i], a, 10.5, true, "l", C.black, true); p.t(mid + 2.8, ys[i], x2 - mid - 5, ys[i + 1] - ys[i], b, 10.5, false, "l", C.black, true); });
  };
  table([230.1, 246.3, 262.4, 278.5, 331.1], [["Client Name", c.name], ["K Number (Discom)", c.kno], ["Mobile No.", c.mobile], ["Site Address", c.address]]);
  p.t(75.7, 352.8, 200, 11, "Project Details", 10.5, true);
  table([383.2, 400.6, 417.9, 435.3, 452.6, 470.0, 487.3, 504.7, 522.0], [["Solar Panels", c.kw + "KW POWER GENERATING PANEL"], ["Solar Grid Tie Inverter", c.kw + "KW SOLAR INVERTER"], ["Mounting Structure", "TATA/APOLLO"], ["ACDB & DCDB", "INCLUDE"], ["Earthing & LA", "INCLUDE"], ["Solar & Net Meter", "HPL/ L&T"], ["Installation", "INCLUDED"], ["Transportation", "INCLUDED"]]);
  [539.4, 580.3].forEach(y => p.hl(73.5, 521.8, y)); [73.5, 271.2, 521.8].forEach(x => p.vl(x, 539.4, 580.3));
  p.t(75.7, 539.4, 190, 40.9, "Authorized Sales & Service Partner for this Project", 10.5, true, "l", C.black, true);
  p.t(275, 543.5, 244.3, 14, pt.name, 10.5, false, "r"); p.t(275, 563.5, 244.3, 14, "MO. NO. - " + pt.phone, 10.5, false, "r");
  p.t(75.7, 595.7, 200, 11, "Net Investment", 10.5, true);
  [611.2, 633.5].forEach(y => p.hl(73.5, 521.8, y)); [73.5, 271.2, 521.8].forEach(x => p.vl(x, 611.2, 633.5));
  p.t(75.7, 611.2, 193, 22.3, "Total project cost", 10.5, true); p.t(271.2, 611.2, 250.6, 22.3, rs(c.total), 10.5, false, "c");
  p.t(75.7, 655.2, 300, 11, "Payment Schedule – " + c.schedule, 10.5, true);
  p.hl(73.5, 271.5, 670.7); p.hl(73.5, 271.5, 804.6); p.vl(73.5, 670.7, 804.6); p.vl(271.5, 670.7, 804.6);
  bankLines().forEach((ln, i) => p.t(75.7, 694.8 + i * 12.8, 195, 12.8, ln, 10.5));
  elements(p, "quotation", 1, ctx, {});
  const q = new Pg(doc.addPage([W, H]), F, H);
  q.t(75.7, 258.9, 300, 11, "In Our Scope -", 10.5, true);
  ["1. Design, Engineering, Procurement and Supply of all the components mentioned above.", "2. Installation and commissioning of complete system.", "3. Freight, loading and unloading of materials at site."].forEach((ln, i) => q.t(75.7, 294.8 + i * 12.8, 440, 12.8, ln, 10.5));
  q.t(75.7, 382.2, 300, 11, "In Customer\u2019s Scope \u2013", 10.5, true);
  ["1. Every kind of expenses related to Discom is under your scope", "2. Currently Net meters are provided by Discom , if in any case, government doesn\u2019t provide meters", "    then the cost of meters to be borne by the customer.", "3. Provide shadow free area to install solar panels on roof as per our design.", "4. Provide path for movement of materials from ground to roof.", "5. Provide storage space at site during the time of project execution.", "6. Provide electricity and water during project execution.", "7. Any kind of civil work is in customer\u2019s scope.", "8. Necessary documents for net metering as per govt. guidelines.", "9. Regular cleaning & monitoring of solar project for better generation from solar power plant.", "10. All payments to be done on mentioned time frame, delay in payment may cause delay in project", "      execution time."].forEach((ln, i) => q.t(75.7, 425 + i * 12.77, 440, 12.77, ln, 10.5));
  elements(q, "quotation", 2, ctx, {}); return doc.save();
}

async function buildAgreement(c, sign, stampBytes) {
  const miss = missing("agreement", { sign: !!sign, seal: !!S.seal, vendor_sign: !!S.vsign }); if (!stampBytes) miss.unshift("the e-stamp photo");
  if (miss.length) throw Object.assign(new Error("Needs " + miss.join(", ")), { missing: miss });
  const doc = await PDFDocument.load(await fetchBytes("assets/annexure.pdf")), F = await fonts(doc), ctx = await images(doc, sign);
  const stamp = await doc.embedJpg(stampBytes), first = doc.insertPage(0, [AW, AH]), pages = doc.getPages();
  new Pg(first, F, AH).fit(stamp, 0, 0, AW, AH);
  const d = c.date, vals = { name: c.name, address: c.address, day: two(d.getDate()), month: two(d.getMonth() + 1), year: String(d.getFullYear()), date: `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}` };
  pages.forEach((pg, i) => elements(new Pg(pg, F, AH), "agreement", i + 1, ctx, vals));
  return doc.save();
}

/* ---------- inputs ---------- */
const state = { sign: null, padSign: null, photoSign: null, mode: "pad", photoFile: null, estamp: null, strokes: [], current: "agreement", token: 0, url: null };
const applySign = () => { state.sign = state.mode === "pad" ? state.padSign : state.photoSign; schedule(); };
function data() {
  const v = id => $(id).value.trim(), num = id => parseFloat(v(id).replace(/,/g, "")) || 0;
  const d = v("date") ? new Date(v("date") + "T00:00:00") : new Date();
  const ref = v("ref") || `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(new Date().getHours())}${two(new Date().getMinutes())}`;
  return { name: v("name"), mobile: v("mobile"), address: v("address").replace(/\s+/g, " "), kno: v("kno"), kw: v("kw"), total: num("total"), received: num("received"), mode: v("mode") || "Cash",
    partner: v("partner"), schedule: v("schedule") || "Loan", date: d, dateStr: `${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}`, rno: "RCT-" + ref, ino: "INV-" + ref, qno: "QTN-" + ref, ref };
}
async function shrinkStamp(file, side) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }), k = Math.min(1, side / Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k); const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Uint8Array(await (await new Promise(r => cv.toBlob(r, "image/jpeg", .8))).arrayBuffer());
}
async function build(kind) {
  const c = data();
  if (!c.name || !c.address) throw Object.assign(new Error("Enter the customer's name and address"), { missing: ["name and address"] });
  if (kind === "receipt") { if (!c.received) throw Object.assign(new Error("Enter the amount received"), { missing: ["amount received"] }); return buildReceipt(c, state.sign); }
  if (kind !== "receipt" && (!c.total || !c.kw) && kind !== "agreement") throw Object.assign(new Error("Enter the system size (kW) and the total project cost"), { missing: ["kW and total cost"] });
  if (kind === "invoice") return buildInvoice(c, state.sign);
  if (kind === "quotation") return buildQuotation(c, state.sign);
  let bytes;
  for (const side of [2400, 1800, 1400, 1100, 900, 700]) {              // shrink the e-stamp photo until the PDF is under 2 MB
    bytes = await buildAgreement(c, state.sign, state.estamp ? await shrinkStamp(state.estamp, side) : null);
    if (bytes.length <= 1950000) break;
  }
  return bytes;
}
async function signPng() {
  const pts = state.strokes.flat(); if (pts.length < 2) return null;
  const mn = (a, f) => a.reduce((x, y) => Math.min(x, f(y)), Infinity), mx = (a, f) => a.reduce((x, y) => Math.max(x, f(y)), -Infinity), m = 6;
  const x0 = Math.max(0, mn(pts, p => p[0]) - m), y0 = Math.max(0, mn(pts, p => p[1]) - m), w = mx(pts, p => p[0]) + m - x0, h = mx(pts, p => p[1]) + m - y0, k = 3;
  const cv = document.createElement("canvas"); cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k); const g = cv.getContext("2d");
  g.scale(k, k); g.translate(-x0, -y0); g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#12206e";
  for (const s of state.strokes) { g.beginPath(); g.moveTo(s[0][0], s[0][1]); if (s.length === 1) g.lineTo(s[0][0] + .1, s[0][1]); s.forEach(p => g.lineTo(p[0], p[1])); g.stroke(); }
  return new Uint8Array(await (await new Promise(r => cv.toBlob(r, "image/png"))).arrayBuffer());
}

/* ---------- screen ---------- */
let timer = null;
const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 600); };     // regenerate after every change
async function refresh() {
  const my = ++state.token, st = $("status"); st.textContent = "Making " + TITLES[state.current] + "..."; st.className = "";
  try {
    const bytes = await build(state.current); if (my !== state.token) return;
    if (state.url) URL.revokeObjectURL(state.url);
    state.url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); $("view").src = state.url; $("view").style.display = "block";
    $("open").href = state.url; $("open").style.display = "inline"; st.textContent = TITLES[state.current] + " ready (" + Math.round(bytes.length / 1024) + " KB)";
  } catch (e) { if (my !== state.token) return; $("view").style.display = "none"; $("open").style.display = "none"; st.textContent = e.message; st.className = e.missing ? "need" : "err"; }
}
async function download(kind) {
  try {
    const bytes = await build(kind), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    a.download = `${TITLES[kind]}-${data().ref}.pdf`; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { alert(e.message); }
}
async function join() {
  const kinds = [...document.querySelectorAll(".jk:checked")].map(x => x.value); if (!kinds.length) return alert("Tick at least one document");
  try {
    const out = await PDFDocument.create();
    for (const k of kinds) { const src = await PDFDocument.load(await build(k)); (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p)); }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([await out.save()], { type: "application/pdf" })); a.target = "_blank"; a.download = `Print-set-${data().ref}.pdf`; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { alert(e.message); }
}
function pad() {
  const cv = $("pad"), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const g = cv.getContext("2d"); g.scale(dpr, dpr); g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#12206e"; let cur = null;
  const pt = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const redraw = () => { g.clearRect(0, 0, cv.width, cv.height); for (const s of state.strokes) { g.beginPath(); g.moveTo(s[0][0], s[0][1]); s.forEach(p => g.lineTo(p[0], p[1])); g.stroke(); } };
  cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); cur = [pt(e)]; state.strokes.push(cur); g.beginPath(); g.moveTo(cur[0][0], cur[0][1]); });
  cv.addEventListener("pointermove", e => { if (!cur) return; const p = pt(e); cur.push(p); g.lineTo(p[0], p[1]); g.stroke(); });
  const up = async () => { if (!cur) return; cur = null; state.padSign = await signPng(); applySign(); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  $("undo").onclick = async () => { state.strokes.pop(); redraw(); state.padSign = await signPng(); applySign(); };
  $("clear").onclick = async () => { state.strokes = []; redraw(); state.padSign = null; applySign(); };
}
function readFile(f) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); }
function setup() {
  $("addr").value = S.addr.join("\n"); $("bank").value = S.bank.join("\n"); $("partners").value = S.partners.map(p => `${p.key} | ${p.name} | ${p.phone}`).join("\n"); $("remember").checked = S.remember;
  const fill = () => { $("partner").innerHTML = "<option></option>" + S.partners.map(p => `<option>${p.key}</option>`).join(""); }; fill();
  $("toggles").innerHTML = Object.keys(LAYOUT).map(doc => `<details><summary>${TITLES[doc]}: seals, signs and details</summary>` + LAYOUT[doc].map(e => `<label class="tg"><input type="checkbox" data-k="${doc}.${e.id}" ${shown(doc, e) ? "checked" : ""}> ${e.label}</label>`).join("") + "</details>").join("");
  $("save").onclick = async () => {
    S.addr = $("addr").value.split("\n").map(x => x.trim()).filter(Boolean); S.bank = $("bank").value.split("\n").map(x => x.trim()).filter(Boolean);
    S.partners = $("partners").value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(a => a.length >= 3 && a[0]).map(a => ({ key: a[0], name: a[1], phone: a[2] }));
    S.remember = $("remember").checked; S.show = {}; document.querySelectorAll("#toggles input").forEach(i => { S.show[i.dataset.k] = i.checked; });
    if ($("sealf").files[0]) S.seal = await readFile($("sealf").files[0]); if ($("vsignf").files[0]) S.vsign = await readFile($("vsignf").files[0]);
    try { if (S.remember) localStorage.setItem("kdocs_settings", JSON.stringify(S)); else localStorage.removeItem("kdocs_settings"); } catch (e) { alert("This browser would not save the settings; they will last until you close the page."); }
    fill(); $("setupmsg").textContent = "Saved" + (S.remember ? " on this device." : " for this visit only."); schedule();
  };
}
/* signature from a photo: white paper -> transparent, cropped, with a preview */
async function cleanPhoto(file, strength) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }), k = Math.min(1, 900 / bmp.width), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const g = cv.getContext("2d"); g.drawImage(bmp, 0, 0, w, h);
  const im = g.getImageData(0, 0, w, h), d = im.data, n = w * h, lum = new Uint8Array(n), hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) { const l = (d[i * 4] * 77 + d[i * 4 + 1] * 151 + d[i * 4 + 2] * 28) >> 8; lum[i] = l; hist[l]++; }
  let acc = 0, bg = 255; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * .75) { bg = v; break; } }       // paper brightness
  const hi = bg * strength, lo = bg * .45, alpha = new Uint8Array(n); let x0 = w, y0 = h, x1 = -1, y1 = -1, sr = 0, sg = 0, sb = 0, sc = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, l = lum[i], a = l >= hi ? 0 : l <= lo ? 255 : Math.round(255 * (hi - l) / (hi - lo)); alpha[i] = a;
    if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (a === 255) { sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2]; sc++; } }
  }
  if (x1 < 0) throw new Error("No signature found in the photo. Sign with dark ink on plain white paper.");
  const ink = sc ? [Math.round(sr / sc), Math.round(sg / sc), Math.round(sb / sc)] : [20, 30, 110], m = 4;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = document.createElement("canvas"); out.width = cw; out.height = ch;
  const og = out.getContext("2d"), oi = og.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const o = (y * cw + x) * 4; oi.data[o] = ink[0]; oi.data[o + 1] = ink[1]; oi.data[o + 2] = ink[2]; oi.data[o + 3] = alpha[(y + y0) * w + x + x0]; }
  og.putImageData(oi, 0, 0); return out;
}
async function usePhoto() {
  const msg = $("photomsg"); if (!state.photoFile) { state.photoSign = null; applySign(); return; }
  try {
    const cv = await cleanPhoto(state.photoFile, parseFloat($("strength").value)), pv = $("photoprev"); pv.width = cv.width; pv.height = cv.height; pv.getContext("2d").clearRect(0, 0, cv.width, cv.height); pv.getContext("2d").drawImage(cv, 0, 0);
    pv.style.display = "block"; state.photoSign = new Uint8Array(await (await new Promise(r => cv.toBlob(r, "image/png"))).arrayBuffer()); msg.textContent = "Background removed. Check the preview above; use the slider if marks remain or the ink looks thin.";
  } catch (e) { state.photoSign = null; $("photoprev").style.display = "none"; msg.textContent = e.message; }
  applySign();
}
function setMode(m) { state.mode = m; $("padbox").style.display = m === "pad" ? "block" : "none"; $("photobox").style.display = m === "photo" ? "block" : "none"; applySign(); }

/* download everything ticked: separate PDFs one after another, or all in one ZIP (not merged) */
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [], u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; let off = 0;
  const now = new Date(), tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(tm), ...u16(dt), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0)]);
    parts.push(lh, nm, f.data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(tm), ...u16(dt), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
    off += lh.length + nm.length + sz;
  }
  const cd = central.reduce((a, c) => a + c.length, 0), end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cd), ...u32(off), 0, 0]);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
const saveBlob = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000); };
async function downloadAll(asZip) {
  const kinds = [...document.querySelectorAll(".jk:checked")].map(x => x.value), msg = $("dlmsg"); if (!kinds.length) { msg.textContent = "Tick at least one document."; return; }
  msg.textContent = "Making the documents..."; const made = [], failed = [], ref = data().ref;
  for (const k of kinds) { try { made.push({ name: `${TITLES[k]}-${ref}.pdf`, data: await build(k) }); } catch (e) { failed.push(`${TITLES[k]} (${e.message})`); } }
  if (made.length) {
    if (asZip) saveBlob(makeZip(made), `Kalpna-${ref}.zip`);
    else for (const f of made) { saveBlob(new Blob([f.data], { type: "application/pdf" }), f.name); await new Promise(r => setTimeout(r, 500)); }
  }
  msg.textContent = (made.length ? `Downloaded ${made.length} file(s). ` : "") + (failed.length ? "Could not make: " + failed.join("; ") : "");
}
function init() {
  pad(); setup();
  document.querySelectorAll("#form input, #form select, #form textarea").forEach(el => el.addEventListener("input", schedule));
  $("estamp").onchange = e => { state.estamp = e.target.files[0] || null; schedule(); };
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => { state.current = b.dataset.k; document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === b)); refresh(); });
  document.querySelectorAll(".dl").forEach(b => b.onclick = () => download(b.dataset.k)); $("join").onclick = join;
  document.querySelectorAll("input[name=sm]").forEach(r => r.onchange = () => setMode(r.value));
  $("photof").onchange = e => { state.photoFile = e.target.files[0] || null; usePhoto(); };
  let st = null; $("strength").oninput = () => { clearTimeout(st); st = setTimeout(usePhoto, 150); };
  $("dlsep").onclick = () => downloadAll(false); $("dlzip").onclick = () => downloadAll(true);
  $("date").value = new Date().toISOString().slice(0, 10); refresh();
}
window.App = { build, state, S, data, init, signPng, cleanPhoto, makeZip };
window.addEventListener("DOMContentLoaded", init);
