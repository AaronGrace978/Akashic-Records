(() => {
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const OBLIQUITY = 23.4392911;

  const SIGNS = [
    { id: "aries", name: "Aries", constellationId: "aries" },
    { id: "taurus", name: "Taurus", constellationId: "taurus" },
    { id: "gemini", name: "Gemini", constellationId: "gemini" },
    { id: "cancer", name: "Cancer", constellationId: "cancer" },
    { id: "leo", name: "Leo", constellationId: "leo" },
    { id: "virgo", name: "Virgo", constellationId: "virgo" },
    { id: "libra", name: "Libra", constellationId: "libra" },
    { id: "scorpio", name: "Scorpio", constellationId: "scorpius" },
    { id: "sagittarius", name: "Sagittarius", constellationId: "sagittarius" },
    { id: "capricorn", name: "Capricorn", constellationId: "capricornus" },
    { id: "aquarius", name: "Aquarius", constellationId: "aquarius" },
    { id: "pisces", name: "Pisces", constellationId: "pisces" },
  ];

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  function norm(deg) {
    return ((deg % 360) + 360) % 360;
  }

  function hm(h, m, s = 0) {
    return h + m / 60 + s / 3600;
  }

  function dm(d, m, s = 0) {
    const sign = d < 0 || Object.is(d, -0) ? -1 : 1;
    return sign * (Math.abs(d) + m / 60 + s / 3600);
  }

  function S(id, name, hours, dec, mag) {
    return { id, name, ra: hours * 15, dec, mag };
  }

  function toVec(raDeg, decDeg) {
    const ra = raDeg * RAD;
    const dec = decDeg * RAD;
    const c = Math.cos(dec);
    return { x: c * Math.cos(ra), y: c * Math.sin(ra), z: Math.sin(dec) };
  }

  function fromVec(x, y, z) {
    const len = Math.hypot(x, y, z) || 1;
    const vx = x / len;
    const vy = y / len;
    const vz = z / len;
    return {
      ra: norm(Math.atan2(vy, vx) * DEG),
      dec: Math.asin(Math.max(-1, Math.min(1, vz))) * DEG,
    };
  }

  function angSep(ra1, dec1, ra2, dec2) {
    const a = toVec(ra1, dec1);
    const b = toVec(ra2, dec2);
    const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
    return Math.acos(dot) * DEG;
  }

  function slerp(a, b, t) {
    const va = toVec(a.ra, a.dec);
    const vb = toVec(b.ra, b.dec);
    const dot = Math.max(-1, Math.min(1, va.x * vb.x + va.y * vb.y + va.z * vb.z));
    let omega = Math.acos(dot);
    if (omega < 1e-4) return { ra: b.ra, dec: b.dec };
    if (omega > Math.PI - 1e-3) omega = Math.PI - 1e-3;
    const s = Math.sin(omega);
    const k0 = Math.sin((1 - t) * omega) / s;
    const k1 = Math.sin(t * omega) / s;
    return fromVec(va.x * k0 + vb.x * k1, va.y * k0 + vb.y * k1, va.z * k0 + vb.z * k1);
  }

  function galacticToEquatorial(lDeg, bDeg) {
    const l = lDeg * RAD;
    const b = bDeg * RAD;
    const aNgp = 192.85948 * RAD;
    const dNgp = 27.12825 * RAD;
    const lNcp = 122.93192 * RAD;
    const sinD =
      Math.sin(dNgp) * Math.sin(b) + Math.cos(dNgp) * Math.cos(b) * Math.cos(lNcp - l);
    const dec = Math.asin(Math.max(-1, Math.min(1, sinD)));
    const y = Math.cos(b) * Math.sin(lNcp - l);
    const x =
      Math.cos(dNgp) * Math.sin(b) - Math.sin(dNgp) * Math.cos(b) * Math.cos(lNcp - l);
    const ra = Math.atan2(y, x) + aNgp;
    return { ra: norm(ra * DEG), dec: dec * DEG };
  }

  function eclipticToEquatorial(lonDeg, latDeg = 0) {
    const eps = OBLIQUITY * RAD;
    const lon = lonDeg * RAD;
    const lat = latDeg * RAD;
    const sinE = Math.sin(eps);
    const cosE = Math.cos(eps);
    const ra = Math.atan2(
      Math.sin(lon) * cosE - Math.tan(lat) * sinE,
      Math.cos(lon)
    );
    const dec = Math.asin(
      Math.max(-1, Math.min(1, Math.sin(lat) * cosE + Math.cos(lat) * sinE * Math.sin(lon)))
    );
    return { ra: norm(ra * DEG), dec: dec * DEG };
  }

  function julianDay(year, month, day, hour) {
    let y = year;
    let m = month;
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return (
      Math.floor(365.25 * (y + 4716)) +
      Math.floor(30.6001 * (m + 1)) +
      day +
      hour / 24 +
      B -
      1524.5
    );
  }

  function zoneOffsetMinutes(timeZone, utcDate) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = {};
    for (const p of dtf.formatToParts(utcDate)) parts[p.type] = p.value;
    let hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hour,
      Number(parts.minute),
      Number(parts.second)
    );
    return (asUtc - utcDate.getTime()) / 60000;
  }

  function civilToUtc(year, month, day, hour, minute, timeZone) {
    let utc = Date.UTC(year, month - 1, day, hour, minute);
    for (let i = 0; i < 4; i++) {
      const off = zoneOffsetMinutes(timeZone, new Date(utc));
      const next = Date.UTC(year, month - 1, day, hour, minute) - off * 60000;
      if (Math.abs(next - utc) < 500) return new Date(next);
      utc = next;
    }
    return new Date(utc);
  }

  function toJulian(year, month, day, hour, minute, lon, timeZone) {
    if (timeZone) {
      try {
        const utc = civilToUtc(year, month, day, hour, minute, timeZone);
        return julianDay(
          utc.getUTCFullYear(),
          utc.getUTCMonth() + 1,
          utc.getUTCDate(),
          utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600
        );
      } catch {
        /* fall through to mean solar time */
      }
    }
    let ut = hour + minute / 60 - (lon || 0) / 15;
    const utc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + ut * 3600000);
    return julianDay(
      utc.getUTCFullYear(),
      utc.getUTCMonth() + 1,
      utc.getUTCDate(),
      utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600 + utc.getUTCMilliseconds() / 3600000
    );
  }

  function sunLongitude(jd) {
    const n = jd - 2451545.0;
    const L = 280.46 + 0.9856474 * n;
    const g = (357.528 + 0.9856003 * n) * RAD;
    return norm(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  }

  function moonPosition(jd) {
    const d = jd - 2451545.0;
    const L = 218.316 + 13.176396 * d;
    const M = (134.963 + 13.064993 * d) * RAD;
    const F = (93.272 + 13.22935 * d) * RAD;
    return {
      lon: norm(L + 6.289 * Math.sin(M)),
      lat: 5.128 * Math.sin(F),
    };
  }

  function gmstDegrees(jd) {
    const T = (jd - 2451545.0) / 36525;
    const theta =
      280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * T * T -
      (T * T * T) / 38710000;
    return norm(theta);
  }

  function ascendantLongitude(ramcDeg, latDeg) {
    const lat = Math.max(-66, Math.min(66, latDeg));
    const obl = OBLIQUITY * RAD;
    const ramc = ramcDeg * RAD;
    const y = Math.cos(ramc);
    const x = -(Math.sin(ramc) * Math.cos(obl) + Math.tan(lat * RAD) * Math.sin(obl));
    return norm(Math.atan2(y, x) * DEG);
  }

  function signAt(lon) {
    return SIGNS[Math.floor(norm(lon) / 30) % 12];
  }

  function buildCatalog() {
    const raw = [
      {
        id: "aries",
        name: "Aries",
        zodiac: true,
        stars: [
          S("hamal", "Hamal", hm(2, 7, 10), dm(23, 27, 45), 2.01),
          S("sheratan", "Sheratan", hm(1, 54, 38), dm(20, 48, 29), 2.64),
          S("mesarthim", "Mesarthim", hm(1, 53, 32), dm(19, 17, 37), 3.88),
        ],
        lines: [["sheratan", "hamal"], ["sheratan", "mesarthim"]],
      },
      {
        id: "taurus",
        name: "Taurus",
        zodiac: true,
        stars: [
          S("alcyone", "Alcyone", 3.79141014, 24.10513714, 2.85),
          S("atlas", "Atlas", 3.81937293, 24.05341547, 3.62),
          S("electra", "Electra", 3.74792703, 24.11333922, 3.72),
          S("maia", "Maia", 3.76377962, 24.36774851, 3.87),
          S("merope", "Merope", 3.77210384, 23.94835835, 4.14),
          S("ain", "Ain", hm(4, 28, 37), dm(19, 10, 49), 3.53),
          S("aldebaran", "Aldebaran", 4.5986774, 16.50930138, 0.87),
          S("hyadum", "Hyadum", hm(4, 19, 47), dm(15, 37, 39), 3.65),
          S("tianguan", "Tianguan", hm(5, 37, 39), dm(21, 8, 33), 3.0),
          S("elnath", "Elnath", 5.43819816, 28.60745, 1.65),
        ],
        lines: [
          ["alcyone", "atlas"], ["alcyone", "electra"], ["alcyone", "maia"], ["alcyone", "merope"],
          ["alcyone", "ain"], ["ain", "aldebaran"], ["aldebaran", "hyadum"],
          ["aldebaran", "tianguan"], ["tianguan", "elnath"],
        ],
      },
      {
        id: "gemini",
        name: "Gemini",
        zodiac: true,
        stars: [
          S("castor", "Castor", 7.57662855, 31.88827631, 1.58),
          S("pollux", "Pollux", 7.75526397, 28.02619865, 1.16),
          S("mebsuta", "Mebsuta", hm(6, 43, 56), dm(25, 7, 52), 3.06),
          S("tejat", "Tejat", hm(6, 22, 58), dm(22, 30, 49), 2.87),
          S("propus", "Propus", hm(6, 14, 53), dm(22, 30, 24), 3.31),
          S("wasat", "Wasat", hm(7, 20, 7), dm(21, 58, 56), 3.53),
          S("alhena", "Alhena", 6.62852808, 16.39925217, 1.93),
        ],
        lines: [
          ["castor", "pollux"],
          ["castor", "mebsuta"], ["mebsuta", "tejat"], ["tejat", "propus"],
          ["pollux", "wasat"], ["wasat", "alhena"],
        ],
      },
      {
        id: "cancer",
        name: "Cancer",
        zodiac: true,
        stars: [
          S("tegmine", "Tegmine", hm(8, 12, 13), dm(17, 38, 52), 4.67),
          S("asellus-b", "Asellus Borealis", hm(8, 43, 17), dm(21, 28, 7), 4.66),
          S("asellus-a", "Asellus Australis", hm(8, 44, 41), dm(18, 9, 15), 3.94),
          S("acubens", "Acubens", hm(8, 58, 29), dm(11, 51, 28), 4.25),
          S("altarf", "Altarf", hm(8, 16, 31), dm(9, 11, 8), 3.53),
        ],
        lines: [
          ["tegmine", "asellus-b"], ["asellus-b", "asellus-a"],
          ["asellus-a", "acubens"], ["asellus-a", "altarf"],
        ],
      },
      {
        id: "leo",
        name: "Leo",
        zodiac: true,
        stars: [
          S("rasalas", "Rasalas", hm(9, 52, 46), dm(26, 0, 25), 3.88),
          S("raselased", "Ras Elased", hm(9, 45, 51), dm(23, 46, 27), 2.98),
          S("adhafera", "Adhafera", hm(10, 16, 41), dm(23, 25, 2), 3.43),
          S("algieba", "Algieba", 10.33287623, 19.84148875, 2.01),
          S("regulus", "Regulus", 10.13953074, 11.96720709, 1.36),
          S("zosma", "Zosma", hm(11, 14, 6), dm(20, 31, 25), 2.56),
          S("chertan", "Chertan", hm(11, 14, 14), dm(15, 25, 46), 3.33),
          S("denebola", "Denebola", 11.81766043, 14.57206038, 2.14),
        ],
        lines: [
          ["rasalas", "raselased"], ["raselased", "adhafera"], ["adhafera", "algieba"],
          ["algieba", "regulus"], ["algieba", "zosma"], ["zosma", "denebola"],
          ["zosma", "chertan"], ["chertan", "regulus"],
        ],
      },
      {
        id: "virgo",
        name: "Virgo",
        zodiac: true,
        stars: [
          S("zavijava", "Zavijava", hm(11, 50, 42), dm(1, 45, 53), 3.61),
          S("zaniah", "Zaniah", hm(12, 19, 54), dm(-0, 40, 0), 3.89),
          S("porrima", "Porrima", hm(12, 41, 40), dm(-1, 26, 58), 2.74),
          S("auva", "Auva", hm(12, 55, 36), dm(3, 23, 51), 3.38),
          S("vindemiatrix", "Vindemiatrix", 13.03627697, 10.95915039, 2.85),
          S("heze", "Heze", hm(13, 34, 42), dm(-0, 35, 45), 3.37),
          S("spica", "Spica", 13.41988313, -11.16132203, 0.98),
        ],
        lines: [
          ["zavijava", "porrima"], ["porrima", "zaniah"], ["porrima", "auva"],
          ["auva", "vindemiatrix"], ["auva", "heze"], ["auva", "spica"],
        ],
      },
      {
        id: "libra",
        name: "Libra",
        zodiac: true,
        stars: [
          S("zubenelgenubi", "Zubenelgenubi", 14.84797587, -16.04177819, 2.75),
          S("zubeneschamali", "Zubeneschamali", hm(15, 17, 0), dm(-9, 22, 58), 2.61),
          S("brachium", "Brachium", hm(15, 4, 4), dm(-25, 16, 55), 3.25),
          S("zubenelhakrabi", "Zubenelhakrabi", hm(15, 35, 31), dm(-14, 47, 22), 3.91),
        ],
        lines: [
          ["zubenelgenubi", "zubeneschamali"],
          ["zubenelgenubi", "brachium"],
          ["zubeneschamali", "zubenelhakrabi"],
        ],
      },
      {
        id: "scorpius",
        name: "Scorpius",
        zodiac: true,
        stars: [
          S("acrab", "Acrab", hm(16, 5, 26), dm(-19, 48, 19), 2.56),
          S("dschubba", "Dschubba", hm(16, 0, 20), dm(-22, 37, 18), 2.29),
          S("antares", "Antares", 16.49012803, -26.4320025, 1.06),
          S("paikauhale", "Paikauhale", hm(16, 35, 53), dm(-28, 12, 58), 2.82),
          S("larawag", "Larawag", hm(16, 50, 10), dm(-34, 17, 36), 2.29),
          S("shaula", "Shaula", 17.56014444, -37.10382115, 1.62),
          S("lesath", "Lesath", hm(17, 30, 45), dm(-37, 17, 45), 2.7),
          S("sargas", "Sargas", hm(17, 37, 19), dm(-42, 59, 52), 1.86),
        ],
        lines: [
          ["acrab", "dschubba"], ["dschubba", "antares"], ["antares", "paikauhale"],
          ["paikauhale", "larawag"], ["larawag", "shaula"], ["shaula", "lesath"],
          ["shaula", "sargas"],
        ],
      },
      {
        id: "sagittarius",
        name: "Sagittarius",
        zodiac: true,
        stars: [
          S("kaus-borealis", "Kaus Borealis", hm(18, 27, 58), dm(-25, 25, 18), 2.82),
          S("kaus-media", "Kaus Media", hm(18, 20, 59), dm(-29, 49, 41), 2.7),
          S("kaus-australis", "Kaus Australis", 18.4028662, -34.38461611, 1.79),
          S("ascella", "Ascella", hm(19, 2, 37), dm(-29, 52, 49), 2.6),
          S("nunki", "Nunki", 18.92109048, -26.29672225, 2.05),
          S("albaldah", "Albaldah", hm(19, 9, 46), dm(-21, 1, 25), 2.89),
          S("polis", "Polis", hm(18, 13, 46), dm(-21, 6, 24), 3.86),
        ],
        lines: [
          ["polis", "kaus-borealis"], ["kaus-borealis", "kaus-media"],
          ["kaus-media", "kaus-australis"], ["kaus-australis", "ascella"],
          ["ascella", "nunki"], ["nunki", "kaus-borealis"], ["nunki", "albaldah"],
        ],
      },
      {
        id: "capricornus",
        name: "Capricornus",
        zodiac: true,
        stars: [
          S("algedi", "Algedi", hm(20, 18, 3), dm(-12, 32, 41), 3.58),
          S("dabih", "Dabih", hm(20, 21, 0), dm(-14, 46, 53), 3.05),
          S("nashira", "Nashira", hm(21, 40, 5), dm(-16, 39, 44), 3.69),
          S("deneb-algedi", "Deneb Algedi", hm(21, 47, 2), dm(-16, 7, 38), 2.85),
          S("omega-cap", "Omega", hm(20, 51, 49), dm(-26, 55, 9), 4.12),
        ],
        lines: [
          ["algedi", "dabih"], ["dabih", "nashira"], ["nashira", "deneb-algedi"],
          ["dabih", "omega-cap"],
        ],
      },
      {
        id: "aquarius",
        name: "Aquarius",
        zodiac: true,
        stars: [
          S("albali", "Albali", hm(20, 47, 41), dm(-9, 29, 45), 3.77),
          S("sadalsuud", "Sadalsuud", hm(21, 31, 33), dm(-5, 34, 16), 2.9),
          S("sadalmelik", "Sadalmelik", 22.09639881, -0.31985069, 2.95),
          S("sadachbia", "Sadachbia", hm(22, 21, 39), dm(-1, 23, 14), 3.86),
          S("ancha", "Ancha", hm(22, 16, 50), dm(-7, 46, 59), 4.17),
          S("skat", "Skat", hm(22, 54, 39), dm(-15, 49, 15), 3.27),
          S("hydor", "Hydor", hm(22, 52, 37), dm(-7, 34, 47), 3.73),
        ],
        lines: [
          ["albali", "sadalsuud"], ["sadalsuud", "sadalmelik"],
          ["sadalmelik", "sadachbia"], ["sadalmelik", "ancha"],
          ["ancha", "skat"], ["sadachbia", "hydor"], ["hydor", "skat"],
        ],
      },
      {
        id: "pisces",
        name: "Pisces",
        zodiac: true,
        stars: [
          S("alpherg", "Alpherg", hm(1, 31, 29), dm(15, 20, 45), 3.62),
          S("alrescha", "Alrescha", hm(2, 2, 3), dm(2, 45, 49), 3.82),
          S("zeta-psc", "Zeta", hm(1, 13, 44), dm(7, 34, 31), 5.21),
          S("epsilon-psc", "Epsilon", hm(1, 2, 57), dm(7, 53, 24), 4.27),
          S("delta-psc", "Delta", hm(0, 48, 41), dm(7, 35, 6), 4.43),
          S("omega-psc", "Omega", hm(23, 59, 19), dm(6, 51, 48), 4.01),
          S("iota-psc", "Iota", hm(23, 39, 57), dm(5, 37, 35), 4.13),
          S("theta-psc", "Theta", hm(23, 27, 58), dm(6, 22, 44), 4.27),
          S("gamma-psc", "Gamma", hm(23, 17, 10), dm(3, 16, 56), 3.7),
          S("kappa-psc", "Kappa", hm(23, 26, 56), dm(1, 15, 20), 4.94),
          S("lambda-psc", "Lambda", hm(23, 42, 3), dm(1, 46, 48), 4.5),
        ],
        lines: [
          ["alpherg", "alrescha"], ["alrescha", "zeta-psc"], ["zeta-psc", "epsilon-psc"],
          ["epsilon-psc", "delta-psc"], ["delta-psc", "omega-psc"],
          ["omega-psc", "iota-psc"], ["iota-psc", "theta-psc"], ["theta-psc", "gamma-psc"],
          ["gamma-psc", "kappa-psc"], ["kappa-psc", "lambda-psc"], ["lambda-psc", "omega-psc"],
        ],
      },
      {
        id: "orion",
        name: "Orion",
        zodiac: false,
        stars: [
          S("betelgeuse", "Betelgeuse", 5.91952924, 7.40706274, 0.45),
          S("bellatrix", "Bellatrix", 5.41885085, 6.34970223, 1.64),
          S("mintaka", "Mintaka", 5.53344464, -0.29909204, 2.25),
          S("alnilam", "Alnilam", 5.60355929, -1.20191983, 1.69),
          S("alnitak", "Alnitak", 5.67931309, -1.94257224, 1.74),
          S("saiph", "Saiph", 5.79594135, -9.66960477, 2.07),
          S("rigel", "Rigel", 5.24229787, -8.20164055, 0.18),
        ],
        lines: [
          ["betelgeuse", "bellatrix"], ["bellatrix", "mintaka"], ["mintaka", "alnilam"],
          ["alnilam", "alnitak"], ["alnitak", "saiph"], ["saiph", "rigel"],
          ["rigel", "mintaka"], ["betelgeuse", "alnitak"],
        ],
      },
      {
        id: "ursa-major",
        name: "Ursa Major",
        zodiac: false,
        stars: [
          S("dubhe", "Dubhe", 11.06213019, 61.75103324, 1.81),
          S("merak", "Merak", 11.03068799, 56.38242685, 2.34),
          S("phecda", "Phecda", 11.89717984, 53.69476015, 2.41),
          S("megrez", "Megrez", 12.25710003, 57.03261698, 3.32),
          S("alioth", "Alioth", 12.90048595, 55.95982123, 1.76),
          S("mizar", "Mizar", 13.39876192, 54.92536183, 2.23),
          S("alkaid", "Alkaid", 13.79234379, 49.31326512, 1.85),
        ],
        lines: [
          ["dubhe", "merak"], ["merak", "phecda"], ["phecda", "megrez"], ["megrez", "dubhe"],
          ["megrez", "alioth"], ["alioth", "mizar"], ["mizar", "alkaid"],
        ],
      },
      {
        id: "cassiopeia",
        name: "Cassiopeia",
        zodiac: false,
        stars: [
          S("segin", "Segin", hm(1, 54, 24), dm(63, 40, 12), 3.35),
          S("ruchbah", "Ruchbah", hm(1, 25, 49), dm(60, 14, 7), 2.68),
          S("navi", "Navi", hm(0, 56, 42), dm(60, 43, 0), 2.15),
          S("schedar", "Schedar", 0.67512237, 56.53733107, 2.24),
          S("caph", "Caph", 0.15296808, 59.1497795, 2.28),
        ],
        lines: [["segin", "ruchbah"], ["ruchbah", "navi"], ["navi", "schedar"], ["schedar", "caph"]],
      },
      {
        id: "cygnus",
        name: "Cygnus",
        zodiac: false,
        stars: [
          S("deneb", "Deneb", 20.69053187, 45.280338, 1.25),
          S("sadr", "Sadr", 20.37047275, 40.25667924, 2.23),
          S("albireo", "Albireo", 19.51202239, 27.95968112, 3.05),
          S("gienah-cyg", "Gienah", hm(20, 46, 12), dm(33, 58, 13), 2.48),
          S("fawaris", "Fawaris", hm(19, 44, 58), dm(45, 7, 51), 2.87),
        ],
        lines: [["deneb", "sadr"], ["sadr", "albireo"], ["gienah-cyg", "sadr"], ["sadr", "fawaris"]],
      },
      {
        id: "canis-major",
        name: "Canis Major",
        zodiac: false,
        stars: [
          S("sirius", "Sirius", 6.75247697, -16.71611569, -1.44),
          S("mirzam", "Mirzam", 6.37832924, -17.95591772, 1.98),
          S("adhara", "Adhara", 6.97709679, -28.97208374, 1.5),
          S("wezen", "Wezen", 7.13985674, -26.39319967, 1.83),
          S("aludra", "Aludra", hm(7, 24, 6), dm(-29, 18, 11), 2.45),
        ],
        lines: [
          ["mirzam", "sirius"], ["sirius", "wezen"], ["wezen", "aludra"],
          ["sirius", "adhara"], ["adhara", "wezen"],
        ],
      },
      {
        id: "lyra",
        name: "Lyra",
        zodiac: false,
        stars: [
          S("vega", "Vega", 18.61564903, 38.78369185, 0.03),
          S("sheliak", "Sheliak", 18.83466519, 33.36266704, 3.52),
          S("sulafat", "Sulafat", 18.98239518, 32.68955742, 3.25),
          S("delta-lyr", "Delta", hm(18, 54, 31), dm(36, 53, 55), 4.22),
        ],
        lines: [["vega", "sheliak"], ["sheliak", "sulafat"], ["vega", "delta-lyr"], ["delta-lyr", "sheliak"]],
      },
      {
        id: "auriga",
        name: "Auriga",
        zodiac: false,
        stars: [
          S("capella", "Capella", 5.27815528, 45.99799106, 0.08),
          S("menkalinan", "Menkalinan", 5.99214525, 44.94743277, 1.9),
          S("mahasim", "Mahasim", hm(5, 59, 43), dm(37, 12, 45), 2.65),
          S("hassaleh", "Hassaleh", hm(4, 57, 0), dm(33, 9, 58), 2.69),
          S("almaaz", "Almaaz", hm(5, 1, 58), dm(43, 49, 24), 2.99),
        ],
        lines: [
          ["capella", "menkalinan"], ["menkalinan", "mahasim"], ["mahasim", "hassaleh"],
          ["hassaleh", "almaaz"], ["almaaz", "capella"],
        ],
      },
      {
        id: "bootes",
        name: "Bootes",
        zodiac: false,
        stars: [
          S("arcturus", "Arcturus", 14.26102001, 19.18241038, -0.05),
          S("izar", "Izar", 14.7497827, 27.07422246, 2.35),
          S("seginus", "Seginus", hm(14, 32, 5), dm(38, 18, 30), 3.04),
          S("nekkar", "Nekkar", hm(15, 1, 57), dm(40, 23, 26), 3.49),
        ],
        lines: [["arcturus", "izar"], ["izar", "nekkar"], ["nekkar", "seginus"], ["seginus", "arcturus"]],
      },
      {
        id: "aquila",
        name: "Aquila",
        zodiac: false,
        stars: [
          S("altair", "Altair", 19.84638864, 8.86832203, 0.76),
          S("tarazed", "Tarazed", 19.7709943, 10.61326121, 2.72),
          S("alshain", "Alshain", 19.92188706, 6.40676348, 3.71),
        ],
        lines: [["tarazed", "altair"], ["altair", "alshain"]],
      },
      {
        id: "crux",
        name: "Crux",
        zodiac: false,
        stars: [
          S("acrux", "Acrux", 12.44330439, -63.09909168, 0.77),
          S("mimosa", "Mimosa", 12.79535087, -59.68876364, 1.25),
          S("gacrux", "Gacrux", 12.51943314, -57.11321175, 1.59),
          S("imai", "Imai", hm(12, 15, 9), dm(-58, 44, 56), 2.79),
        ],
        lines: [["gacrux", "acrux"], ["mimosa", "imai"]],
      },
    ];

    return raw.map((c) => {
      const index = {};
      c.stars.forEach((star, i) => {
        if (index[star.id] != null) throw new Error(`Duplicate star ${star.id} in ${c.id}`);
        star.v = toVec(star.ra, star.dec);
        star.constellationId = c.id;
        index[star.id] = i;
      });
      return {
        id: c.id,
        name: c.name,
        zodiac: c.zodiac,
        stars: c.stars,
        lines: c.lines.map(([a, b]) => {
          if (index[a] == null || index[b] == null) {
            throw new Error(`Missing star ${a}–${b} in ${c.id}`);
          }
          return [index[a], index[b]];
        }),
      };
    });
  }

  const constellations = buildCatalog();
  const byId = Object.fromEntries(constellations.map((c) => [c.id, c]));

  const beacons = [
    S("polaris", "Polaris", 2.530301, 89.26410949, 1.97),
    S("procyon", "Procyon", 7.65503283, 5.22499314, 0.4),
    S("canopus", "Canopus", 6.39919718, -52.69566045, -0.62),
    S("achernar", "Achernar", 1.62856849, -57.23675744, 0.45),
    S("fomalhaut", "Fomalhaut", 22.96084626, -29.62223601, 1.17),
    S("rigil", "Rigil Kentaurus", 14.66013779, -60.83397588, -0.01),
    S("hadar", "Hadar", 14.06372347, -60.37303932, 0.61),
  ].map((s) => ({ ...s, v: toVec(s.ra, s.dec) }));

  function centroid(constellation) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const star of constellation.stars) {
      x += star.v.x;
      y += star.v.y;
      z += star.v.z;
    }
    return fromVec(x, y, z);
  }

  function nearestZodiac(ra, dec) {
    let best = constellations[0];
    let bestD = Infinity;
    for (const c of constellations) {
      if (!c.zodiac) continue;
      for (const star of c.stars) {
        const d = angSep(ra, dec, star.ra, star.dec);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    return { constellation: best, distance: bestD };
  }

  function cleanName(name) {
    const trimmed = String(name || "").replace(/\s+/g, " ").trim().slice(0, 48);
    return trimmed || "The Subject";
  }

  function formatWhen(date, time, place) {
    const [y, m, d] = date.split("-").map(Number);
    let text = `${d} ${MONTHS[m - 1]} ${y}`;
    if (time) text += ` · ${time}`;
    if (place) text += ` · ${place}`;
    return text;
  }

  function birthHour(name) {
    if (name === "The Subject") return "the hour of this birth";
    const poss = /s$/i.test(name) ? `${name}'` : `${name}'s`;
    return `the hour of ${poss} birth`;
  }

  function skyline(sunSign, among, agrees, moonSign, rising) {
    const sunLine = agrees
      ? `The sun stands in ${sunSign.name}, and those stars answer.`
      : `Born under ${sunSign.name}. The sun's light rests among the stars of ${among.name}.`;
    let line = `${sunLine} The moon is ${moonSign.name}.`;
    if (rising) line += ` ${rising.name} was rising.`;
    return line;
  }

  function chartFor(input) {
    const date = String(input?.date || "");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return { error: "The sky needs a date of birth." };
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1 || year > 3999) {
      return { error: "That date does not open." };
    }
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
      return { error: "That date does not open." };
    }

    let lat = input.lat == null || input.lat === "" ? null : Number(input.lat);
    let lon = input.lon == null || input.lon === "" ? null : Number(input.lon);
    if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      return { error: "Latitude must sit between −90 and 90." };
    }
    if (lon != null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) {
      return { error: "Longitude must sit between −180 and 180." };
    }
    if ((lat == null) !== (lon == null)) {
      return { error: "A place needs both latitude and longitude." };
    }

    const time = String(input.time || "");
    let hour = 12;
    let minute = 0;
    let timed = false;
    if (time) {
      const tm = /^(\d{1,2}):(\d{2})$/.exec(time);
      if (!tm) return { error: "That hour does not open." };
      hour = Number(tm[1]);
      minute = Number(tm[2]);
      if (hour > 23 || minute > 59) return { error: "That hour does not open." };
      timed = true;
    }

    const name = cleanName(input.name);
    const place = String(input.place || "").trim();
    const timeZone = input.timeZone || null;
    const jd = toJulian(year, month, day, hour, minute, lon || 0, lat == null ? null : timeZone);

    const sunLon = sunLongitude(jd);
    const sunSign = signAt(sunLon);
    const sunEq = eclipticToEquatorial(sunLon, 0);
    const sunConst = byId[sunSign.constellationId];
    const among = nearestZodiac(sunEq.ra, sunEq.dec);
    const agrees = among.constellation.id === sunConst.id;

    const moon = moonPosition(jd);
    const moonSign = signAt(moon.lon);
    const moonEq = eclipticToEquatorial(moon.lon, moon.lat);
    const moonConst = byId[moonSign.constellationId];

    let rising = null;
    if (timed && lat != null) {
      const lst = norm(gmstDegrees(jd) + lon);
      const asc = ascendantLongitude(lst, lat);
      const risingSign = signAt(asc);
      const risingEq = eclipticToEquatorial(asc, 0);
      rising = {
        lon: asc,
        sign: risingSign,
        eq: risingEq,
        constellationId: risingSign.constellationId,
      };
    }

    const signCenter = centroid(sunConst);
    const camEnd = slerp(signCenter, sunEq, agrees ? 0.32 : 0.48);
    const points = [...sunConst.stars, sunEq];
    if (!agrees) {
      for (const star of among.constellation.stars) {
        if (angSep(sunEq.ra, sunEq.dec, star.ra, star.dec) < 18) points.push(star);
      }
    }
    let maxSep = 11;
    for (const p of points) {
      const d = angSep(camEnd.ra, camEnd.dec, p.ra, p.dec);
      if (d < 80) maxSep = Math.max(maxSep, d);
    }
    const fov = Math.max(40, Math.min(68, maxSep * 2.4 + 12));
    const camStart = {
      ra: norm(camEnd.ra + 128),
      dec: Math.max(-40, Math.min(58, -camEnd.dec * 0.15 + 32)),
    };

    const when = formatWhen(date, timed ? time : "", place);
    const line = skyline(sunSign, among.constellation, agrees, moonSign, rising ? rising.sign : null);
    const ending = name === "The Subject"
      ? "The sky gathered into the one who was born."
      : `The sky gathered, and the subject was ${name}.`;

    return {
      error: null,
      name,
      when,
      place,
      jd,
      veilOpen: Boolean(input.veilOpen),
      sun: {
        lon: sunLon,
        sign: sunSign,
        eq: sunEq,
        v: toVec(sunEq.ra, sunEq.dec),
        constellationId: sunConst.id,
        among,
        agrees,
        sector: [Math.floor(sunLon / 30) * 30, Math.floor(sunLon / 30) * 30 + 30],
      },
      moon: {
        lon: moon.lon,
        lat: moon.lat,
        sign: moonSign,
        eq: moonEq,
        v: toVec(moonEq.ra, moonEq.dec),
        constellationId: moonConst.id,
      },
      rising,
      camStart,
      camEnd,
      fov,
      copy: {
        warpKicker: "Departure",
        warpTitle: "Outward",
        warpCaption: `The static tears. Distance pours through, toward ${birthHour(name)}.`,
        slewKicker: "The long light",
        slewTitle: sunSign.name,
        slewCaption: name === "The Subject"
          ? "Seeking the stars that stood when this life began."
          : `Seeking the stars that stood when ${name} was born.`,
        chartKicker: "Natal sky",
        chartTitle: sunSign.name,
        chartCaption: `${line} ${when}.`,
        subjectKicker: "The subject",
        subjectTitle: name,
        subjectCaption: "The camera falls inward. The sky gathers into a life.",
        holdKicker: "Held in the hour",
        holdTitle: name,
        holdCaption: `${when}. ${line} ${ending}`,
        summary: `${when}. ${line} ${ending}`,
      },
    };
  }

  function project(raDeg, decDeg, camRa, camDec, fovDeg, w, h) {
    const cam = prepCamera(camRa, camDec, fovDeg);
    return projectVec(toVec(raDeg, decDeg), cam, w, h);
  }

  function prepCamera(camRa, camDec, fovDeg) {
    const cr = camRa * RAD;
    const cd = camDec * RAD;
    return {
      ra: camRa,
      dec: camDec,
      fov: fovDeg,
      cosR: Math.cos(cr),
      sinR: Math.sin(cr),
      cosD: Math.cos(cd),
      sinD: Math.sin(cd),
      f: 0.5 / Math.tan((fovDeg * RAD) / 2),
    };
  }

  function projectVec(v, cam, w, h) {
    const x1 = v.x * cam.cosR + v.y * cam.sinR;
    const y1 = -v.x * cam.sinR + v.y * cam.cosR;
    const z1 = v.z;
    const x2 = x1 * cam.cosD + z1 * cam.sinD;
    const y2 = y1;
    const z2 = -x1 * cam.sinD + z1 * cam.cosD;
    if (x2 <= 0.025) return null;
    const s = (h * cam.f) / x2;
    return { x: w * 0.5 + y2 * s, y: h * 0.5 - z2 * s, depth: x2 };
  }

  window.AkashicAstro = {
    SIGNS,
    constellations,
    byId,
    beacons,
    chartFor,
    angSep,
    slerp,
    centroid,
    galacticToEquatorial,
    eclipticToEquatorial,
    julianDay,
    sunLongitude,
    project,
    prepCamera,
    projectVec,
    toVec,
    civilToUtc,
    nearestZodiac,
  };
})();
