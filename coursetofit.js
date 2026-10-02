/*
 * course-to-fit core: parse a course file (GPX or TCX) and write a FIT
 * running activity from it. No dependencies; runs in any browser and in Node.
 */
(function (root) {
  'use strict';

  // ---------- Devices ----------
  // Garmin product IDs from the FIT SDK profile (garmin_product type).
  const DEVICES = {
    fenix8:             { id: 4536, label: 'fēnix 8 (AMOLED 47/51 mm)' },
    fenix8_small:       { id: 4534, label: 'fēnix 8 (AMOLED 43 mm)' },
    fenix8_solar:       { id: 4532, label: 'fēnix 8 Solar (47 mm)' },
    fenix8_solar_large: { id: 4533, label: 'fēnix 8 Solar (51 mm)' },
    fenix8_pro:         { id: 4631, label: 'fēnix 8 Pro' },
  };

  // ---------- Parsing ----------
  function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

  function parseCourse(text) {
    const doc = new DOMParserImpl().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is not valid XML.');
    let pts = [];
    let name = null;

    // GPX: track points, falling back to route points
    const gpxPts = byTag(doc, 'trkpt').length ? byTag(doc, 'trkpt') : byTag(doc, 'rtept');
    if (gpxPts.length) {
      for (const p of gpxPts) {
        const ele = firstChildText(p, 'ele');
        pts.push({ lat: num(p.getAttribute('lat')), lon: num(p.getAttribute('lon')), ele: ele == null ? null : num(ele) });
      }
      const n = byTag(doc, 'name')[0];
      name = n ? n.textContent.trim() : null;
    } else {
      // TCX course or activity
      for (const tp of byTag(doc, 'Trackpoint')) {
        const lat = firstChildText(tp, 'LatitudeDegrees');
        const lon = firstChildText(tp, 'LongitudeDegrees');
        if (lat == null || lon == null) continue;
        const ele = firstChildText(tp, 'AltitudeMeters');
        pts.push({ lat: num(lat), lon: num(lon), ele: ele == null ? null : num(ele) });
      }
      const n = byTag(doc, 'Name')[0];
      name = n ? n.textContent.trim() : null;
    }

    pts = pts.filter(p => p.lat != null && p.lon != null);
    if (pts.length < 2) throw new Error('No route points found. Export the course from Garmin Connect as GPX or TCX.');

    // Fill missing elevations from neighbours
    const hasEle = pts.some(p => p.ele != null);
    if (hasEle) {
      let last = pts.find(p => p.ele != null).ele;
      for (const p of pts) { if (p.ele == null) p.ele = last; else last = p.ele; }
    } else {
      for (const p of pts) p.ele = 0;
    }
    return { name, points: pts, hasElevation: hasEle };
  }

  function byTag(doc, tag) {
    // namespace-agnostic lookup
    const all = doc.getElementsByTagName('*');
    const out = [];
    for (let i = 0; i < all.length; i++) {
      const ln = all[i].localName || all[i].nodeName.split(':').pop();
      if (ln === tag) out.push(all[i]);
    }
    return out;
  }
  function firstChildText(el, tag) {
    const kids = el.getElementsByTagName('*');
    for (let i = 0; i < kids.length; i++) {
      const ln = kids[i].localName || kids[i].nodeName.split(':').pop();
      if (ln === tag) return kids[i].textContent.trim();
    }
    return null;
  }

  // ---------- Geometry ----------
  function haversine(a, b) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function courseStats(points) {
    let dist = 0, asc = 0, desc = 0;
    const cum = [0];
    for (let i = 1; i < points.length; i++) {
      dist += haversine(points[i - 1], points[i]);
      cum.push(dist);
      const dz = points[i].ele - points[i - 1].ele;
      if (dz > 0) asc += dz; else desc -= dz;
    }
    return { distance: dist, ascent: asc, descent: desc, cum };
  }

  // Seeded RNG so the same settings give the same file
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };
  }

  // Resample the course to one point per second at a constant pace,
  // adding synthetic heart rate and cadence.
  function buildSamples(points, opts) {
    const st = courseStats(points);
    const speed = 1000 / opts.paceSecPerKm; // m/s
    const n = Math.floor(st.distance / speed);
    const rand = rng(opts.seed || 7);
    const hrStart = opts.hrStart, hrEnd = opts.hrEnd;
    let hr = Math.min(100, hrStart);
    const out = [];
    let j = 0;
    for (let s = 0; s <= n; s++) {
      const d = Math.min(s * speed, st.distance);
      while (j < st.cum.length - 2 && st.cum[j + 1] < d) j++;
      const seg = st.cum[j + 1] - st.cum[j];
      const f = seg ? (d - st.cum[j]) / seg : 0;
      const a = points[j], b = points[j + 1];
      const target = hrStart + (hrEnd - hrStart) * Math.min(1, (s / Math.max(1, n)) * 1.2);
      hr += (target - hr) * (s > 300 ? 0.02 : 0.01);
      out.push({
        t: s,
        lat: a.lat + f * (b.lat - a.lat),
        lon: a.lon + f * (b.lon - a.lon),
        ele: a.ele + f * (b.ele - a.ele),
        dist: d,
        speed,
        hr: opts.includeHr ? Math.round(hr + (rand() * 3 - 1.5)) : null,
        cad: opts.includeCadence ? (s === 0 ? 0 : Math.round(opts.cadence / 2 + (rand() * 4 - 2))) : null,
      });
    }
    return { samples: out, stats: st, duration: n };
  }

  // ---------- FIT writer ----------
  const FIT_EPOCH = 631065600; // 1989-12-31T00:00:00Z
  const T = { enum: [0x00, 1], uint8: [0x02, 1], uint16: [0x84, 2], sint32: [0x85, 4], uint32: [0x86, 4], uint32z: [0x8C, 4] };
  const CRC_TABLE = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
    0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
  function crc16(bytes, start, end, crc = 0) {
    for (let i = start; i < end; i++) {
      const byte = bytes[i];
      let tmp = CRC_TABLE[crc & 0xF];
      crc = (crc >> 4) & 0x0FFF; crc = crc ^ tmp ^ CRC_TABLE[byte & 0xF];
      tmp = CRC_TABLE[crc & 0xF];
      crc = (crc >> 4) & 0x0FFF; crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xF];
    }
    return crc;
  }
  const INVALID = { enum: 0xFF, uint8: 0xFF, uint16: 0xFFFF, sint32: 0x7FFFFFFF, uint32: 0xFFFFFFFF, uint32z: 0 };

  // Message layouts: [fieldNum, type]
  const MSG = {
    file_id:     { num: 0,  fields: { type: [0, 'enum'], manufacturer: [1, 'uint16'], product: [2, 'uint16'], serial_number: [3, 'uint32z'], time_created: [4, 'uint32'] } },
    device_info: { num: 23, fields: { timestamp: [253, 'uint32'], device_index: [0, 'uint8'], manufacturer: [2, 'uint16'], serial_number: [3, 'uint32z'], product: [4, 'uint16'] } },
    event:       { num: 21, fields: { timestamp: [253, 'uint32'], event: [0, 'enum'], event_type: [1, 'enum'] } },
    record:      { num: 20, fields: { timestamp: [253, 'uint32'], position_lat: [0, 'sint32'], position_long: [1, 'sint32'], altitude: [2, 'uint16'], heart_rate: [3, 'uint8'], cadence: [4, 'uint8'], distance: [5, 'uint32'], speed: [6, 'uint16'] } },
    lap:         { num: 19, fields: { timestamp: [253, 'uint32'], event: [0, 'enum'], event_type: [1, 'enum'], start_time: [2, 'uint32'], start_position_lat: [3, 'sint32'], start_position_long: [4, 'sint32'], total_elapsed_time: [7, 'uint32'], total_timer_time: [8, 'uint32'], total_distance: [9, 'uint32'], avg_speed: [13, 'uint16'], max_speed: [14, 'uint16'], avg_heart_rate: [15, 'uint8'], max_heart_rate: [16, 'uint8'], avg_cadence: [17, 'uint8'], total_ascent: [21, 'uint16'], total_descent: [22, 'uint16'], sport: [25, 'enum'] } },
    session:     { num: 18, fields: { timestamp: [253, 'uint32'], event: [0, 'enum'], event_type: [1, 'enum'], start_time: [2, 'uint32'], start_position_lat: [3, 'sint32'], start_position_long: [4, 'sint32'], sport: [5, 'enum'], sub_sport: [6, 'enum'], total_elapsed_time: [7, 'uint32'], total_timer_time: [8, 'uint32'], total_distance: [9, 'uint32'], avg_speed: [14, 'uint16'], max_speed: [15, 'uint16'], avg_heart_rate: [16, 'uint8'], max_heart_rate: [17, 'uint8'], avg_cadence: [18, 'uint8'], total_ascent: [22, 'uint16'], total_descent: [23, 'uint16'], first_lap_index: [25, 'uint16'], num_laps: [26, 'uint16'] } },
    activity:    { num: 34, fields: { timestamp: [253, 'uint32'], total_timer_time: [0, 'uint32'], num_sessions: [1, 'uint16'], type: [2, 'enum'], event: [3, 'enum'], event_type: [4, 'enum'], local_timestamp: [5, 'uint32'] } },
  };

  class FitWriter {
    constructor() { this.buf = []; this.locals = {}; this.nextLocal = 0; }
    u8(v) { this.buf.push(v & 0xFF); }
    put(type, v) {
      const size = T[type][1];
      if (v == null || !Number.isFinite(v)) v = INVALID[type];
      v = Math.round(v);
      if (type === 'sint32' && v < 0) v = v + 0x100000000;
      for (let i = 0; i < size; i++) this.u8(Math.floor(v / Math.pow(256, i)) % 256);
    }
    write(name, values) {
      const m = MSG[name];
      const keys = Object.keys(m.fields).filter(k => values[k] != null);
      const sig = name + ':' + keys.join(',');
      let local = this.locals[sig];
      if (local == null) {
        local = this.nextLocal++ % 16;
        for (const s in this.locals) if (this.locals[s] === local) delete this.locals[s];
        this.locals[sig] = local;
        // definition message
        this.u8(0x40 | local); this.u8(0); this.u8(0); // reserved, little-endian
        this.u8(m.num & 0xFF); this.u8(m.num >> 8);
        this.u8(keys.length);
        for (const k of keys) { const [fn, ty] = m.fields[k]; this.u8(fn); this.u8(T[ty][1]); this.u8(T[ty][0]); }
      }
      this.u8(local);
      for (const k of keys) this.put(m.fields[k][1], values[k]);
    }
    toBytes() {
      const data = Uint8Array.from(this.buf);
      const out = new Uint8Array(14 + data.length + 2);
      out[0] = 14; out[1] = 0x20;
      out[2] = 2132 & 0xFF; out[3] = 2132 >> 8;
      const len = data.length;
      out[4] = len & 0xFF; out[5] = (len >> 8) & 0xFF; out[6] = (len >> 16) & 0xFF; out[7] = (len >>> 24) & 0xFF;
      out[8] = 0x2E; out[9] = 0x46; out[10] = 0x49; out[11] = 0x54; // ".FIT"
      const hcrc = crc16(out, 0, 12);
      out[12] = hcrc & 0xFF; out[13] = hcrc >> 8;
      out.set(data, 14);
      const fcrc = crc16(out, 0, 14 + len);
      out[14 + len] = fcrc & 0xFF; out[15 + len] = fcrc >> 8;
      return out;
    }
  }

  const semi = deg => deg * (2147483648 / 180);
  const fitTime = date => Math.floor(date.getTime() / 1000) - FIT_EPOCH;

  /**
   * opts: { paceSecPerKm, start (Date), device (key of DEVICES), serial,
   *         includeHr, hrStart, hrEnd, includeCadence, cadence (spm), seed }
   */
  function courseToFit(course, opts) {
    const dev = DEVICES[opts.device] || DEVICES.fenix8;
    const { samples, stats, duration } = buildSamples(course.points, opts);
    const t0 = fitTime(opts.start);
    const t1 = t0 + duration;
    const serial = opts.serial || 3412789650;
    const w = new FitWriter();

    w.write('file_id', { type: 4, manufacturer: 1, product: dev.id, serial_number: serial, time_created: t0 });
    w.write('device_info', { timestamp: t0, device_index: 0, manufacturer: 1, serial_number: serial, product: dev.id });
    w.write('event', { timestamp: t0, event: 0, event_type: 0 }); // timer start

    let hrSum = 0, hrMax = 0, asc = 0, desc = 0, prevEle = null;
    for (const s of samples) {
      w.write('record', {
        timestamp: t0 + s.t,
        position_lat: semi(s.lat), position_long: semi(s.lon),
        altitude: (s.ele + 500) * 5,
        heart_rate: s.hr, cadence: s.cad,
        distance: s.dist * 100, speed: s.speed * 1000,
      });
      if (s.hr != null) { hrSum += s.hr; hrMax = Math.max(hrMax, s.hr); }
      if (prevEle != null) { const dz = s.ele - prevEle; if (dz > 0) asc += dz; else desc -= dz; }
      prevEle = s.ele;
    }
    w.write('event', { timestamp: t1, event: 0, event_type: 4 }); // stop all

    const totalDist = samples[samples.length - 1].dist;
    const common = {
      timestamp: t1, event: 9, event_type: 1, start_time: t0,
      start_position_lat: semi(samples[0].lat), start_position_long: semi(samples[0].lon),
      total_elapsed_time: duration * 1000, total_timer_time: duration * 1000,
      total_distance: totalDist * 100,
      avg_speed: samples[0].speed * 1000, max_speed: samples[0].speed * 1000,
      avg_heart_rate: opts.includeHr ? Math.round(hrSum / samples.length) : null,
      max_heart_rate: opts.includeHr ? hrMax : null,
      avg_cadence: opts.includeCadence ? Math.round(opts.cadence / 2) : null,
      total_ascent: Math.round(asc), total_descent: Math.round(desc),
      sport: 1, // running
    };
    w.write('lap', common);
    w.write('session', Object.assign({}, common, { event: 8, sub_sport: 0, first_lap_index: 0, num_laps: 1 }));
    const tzOffset = -opts.start.getTimezoneOffset() * 60;
    w.write('activity', { timestamp: t1, total_timer_time: duration * 1000, num_sessions: 1, type: 0, event: 26, event_type: 1, local_timestamp: t1 + tzOffset });

    return { bytes: w.toBytes(), duration, distance: totalDist, ascent: asc, descent: desc, stats };
  }

  // DOMParser in browsers; in Node, tests inject one.
  let DOMParserImpl = (typeof DOMParser !== 'undefined') ? DOMParser : null;
  const api = {
    DEVICES, parseCourse, courseStats, courseToFit,
    setDOMParser(p) { DOMParserImpl = p; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CourseToFit = api;
})(this);
